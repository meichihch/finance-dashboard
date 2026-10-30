import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, cloudEnabled } from '../lib/supabase'
import { mockData } from '../data/mockData'
import { MONTHLY_GOALS } from '../data/goals'

const STORAGE_KEY = 'finance_dashboard_v1'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// The month a recurring item was set up, so backfill never invents history from
// before the user created it. New items carry startMonth; older ones only have a
// timestamped id (`rec-1712345678901` / `recinc-1712345678901`).
function startMonthOf(item, fallback) {
  if (item.startMonth) return item.startMonth
  const ts = Number(String(item.id ?? '').split('-')[1])
  return Number.isFinite(ts) && ts > 0 ? monthKey(new Date(ts)) : fallback
}

// Every occurrence from the item's start month through the current month whose
// due day has already passed, minus the ones already in the ledger. Past months
// are always due; the current month only once the day arrives.
function missedOccurrences(items, transactions, { dayField, idPrefix, sign, dismissed }) {
  const now = new Date()
  const today = now.getDate()
  const thisMonth = monthKey(now)
  const out = []

  items.forEach(item => {
    const dueDay = item[dayField]
    if (!dueDay) return
    const start = startMonthOf(item, thisMonth)
    if (start > thisMonth) return

    let [y, m] = start.split('-').map(Number)
    const [endY, endM] = thisMonth.split('-').map(Number)

    while (y < endY || (y === endY && m <= endM)) {
      const month = `${y}-${String(m).padStart(2, '0')}`
      const isCurrentMonth = month === thisMonth
      if (!isCurrentMonth || today >= dueDay) {
        const id = `${idPrefix}-${item.id}-${month}`
        const lastDay = new Date(y, m, 0).getDate() // clamp day 31 in a 30-day month
        const alreadyLogged = transactions.some(tx =>
          tx.description === item.name &&
          tx.category === item.category &&
          tx.date.startsWith(month)
        )
        if (!alreadyLogged && !dismissed.has(id)) {
          out.push({
            id,
            date: `${month}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`,
            description: item.name,
            amount: sign * item.amount,
            category: item.category,
          })
        }
      }
      m++
      if (m > 12) { m = 1; y++ }
    }
  })

  return out
}

// Normalise a stored state (older shapes included) and auto-log every recurring
// occurrence that came due since it was last opened. `loaded` is null for a
// brand-new user. Shared by local (localStorage) and cloud (Supabase) modes.
function hydrate(loaded) {
  if (!loaded) return {
    accounts: mockData.accounts,
    transactions: mockData.transactions,
    budgetCategories: mockData.budgetCategories,
    holdings: mockData.holdings,
    portfolioSnapshots: mockData.portfolioSnapshots,
    netWorthHistory: mockData.netWorthHistory,
    settings: {
      ...mockData.settings,
      ...Object.fromEntries(MONTHLY_GOALS.map(g => [g.settingsKey, g.defaultAmount])),
    },
    recurringExpenses: [],
    recurringIncomes: [],
    goalChecks: {},
    dismissedRecurring: [],
  }
  if (!loaded.recurringExpenses) loaded.recurringExpenses = []
  if (!loaded.recurringIncomes) loaded.recurringIncomes = []
  if (!loaded.goalChecks) loaded.goalChecks = {}
  if (!loaded.dismissedRecurring) loaded.dismissedRecurring = []
  // Migrate legacy single-goal retirementChecks (month -> bool) into goalChecks (month -> {goalId: bool})
  if (loaded.retirementChecks) {
    Object.entries(loaded.retirementChecks).forEach(([month, wasChecked]) => {
      if (wasChecked) {
        loaded.goalChecks[month] = { ...(loaded.goalChecks[month] ?? {}), retirement: true }
      }
    })
    delete loaded.retirementChecks
  }
  if (loaded.settings) {
    MONTHLY_GOALS.forEach(g => {
      if (loaded.settings[g.settingsKey] == null) loaded.settings[g.settingsKey] = g.defaultAmount
    })
  }

  // Auto-log every recurring occurrence that came due while the app was closed,
  // not just this month's — a payday that passed in a month the app never
  // loaded would otherwise be skipped forever.
  const dismissed = new Set(loaded.dismissedRecurring ?? [])
  const existing = loaded.transactions ?? []
  const autoLogged = [
    ...missedOccurrences(loaded.recurringExpenses, existing, {
      dayField: 'billingDay', idPrefix: 'tx-rec', sign: -1, dismissed,
    }),
    ...missedOccurrences(loaded.recurringIncomes, existing, {
      dayField: 'payDay', idPrefix: 'tx-recinc', sign: 1, dismissed,
    }),
  ]
  if (autoLogged.length > 0) {
    loaded.transactions = [...autoLogged, ...existing]
  }
  return loaded
}

// ── Cloud sync (Supabase) ────────────────────────────────────────────────────
// One row per user holds the whole state. Every save is conditional on the
// version this device last saw, so a phone and a laptop editing at once can't
// silently overwrite each other: the loser reloads the newer copy instead.
const SAVE_DELAY_MS = 600

function useCloudSync(state, setState, user) {
  const [status, setStatus] = useState(cloudEnabled ? 'loading' : 'local')
  const [error, setError] = useState(null)
  const version = useRef(0)
  const skipNextSave = useRef(false)   // don't echo back a state we just loaded
  const saving = useRef(false)
  const userId = user?.id

  const applyRow = useCallback((row) => {
    const raw = JSON.stringify(row.data)
    const hydrated = hydrate(row.data)
    version.current = row.version
    // hydrate may auto-log recurring items; only then is there something to save
    skipNextSave.current = JSON.stringify(hydrated) === raw
    setState(hydrated)
  }, [setState])

  // First load after sign-in. On the very first sign-in the cloud row doesn't
  // exist yet: seed it from this browser's local data (that's the migration —
  // do it on the Mac browser that holds the history), or from defaults.
  useEffect(() => {
    if (!cloudEnabled || !userId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('app_state').select('data, version').eq('user_id', userId).maybeSingle()
      if (cancelled) return
      if (error) { setStatus('error'); setError(error.message); return }
      if (data) { applyRow(data); setStatus('saved'); return }

      const local = loadState()
      const seed = hydrate(local)
      const { error: insertError } = await supabase
        .from('app_state').insert({ user_id: userId, data: seed, version: 1 })
      if (cancelled) return
      if (insertError) { setStatus('error'); setError(insertError.message); return }
      version.current = 1
      skipNextSave.current = true
      setState(seed)
      setStatus(local ? 'migrated' : 'saved')
    })()
    return () => { cancelled = true }
  }, [userId, applyRow, setState])

  // Debounced save of every change, guarded by the version check.
  useEffect(() => {
    if (!cloudEnabled || !userId || !state || version.current === 0) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    setStatus('saving')
    const timer = setTimeout(async () => {
      saving.current = true
      const v = version.current
      const { data, error } = await supabase
        .from('app_state')
        .update({ data: state, version: v + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('version', v)
        .select('version')
      saving.current = false
      if (error) { setStatus('error'); setError(error.message); return }
      if (data.length === 0) {
        // Another device saved first. Take its copy; this edit has to be redone.
        const { data: row } = await supabase
          .from('app_state').select('data, version').eq('user_id', userId).single()
        if (row) applyRow(row)
        setStatus('conflict')
        return
      }
      version.current = v + 1
      setStatus('saved')
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state, userId, applyRow])

  // Coming back to the tab (e.g. after editing on the phone): pull newer edits.
  useEffect(() => {
    if (!cloudEnabled || !userId) return
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || saving.current || version.current === 0) return
      const { data } = await supabase
        .from('app_state').select('data, version').eq('user_id', userId).maybeSingle()
      if (data && data.version > version.current) applyRow(data)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, applyRow])

  return { status, error }
}

export function useFinanceStore(user = null) {
  // Cloud mode starts empty and fills in once the signed-in user's row arrives.
  const [state, setState] = useState(() => cloudEnabled ? null : hydrate(loadState()))
  const cloud = useCloudSync(state, setState, user)

  useEffect(() => {
    if (!cloudEnabled && state) saveState(state)
  }, [state])

  const update = useCallback((updater) => {
    setState(prev => {
      const next = updater(prev)
      return next
    })
  }, [])

  // --- Accounts ---
  const addAccount = useCallback((account) => {
    update(s => ({
      ...s,
      accounts: [...s.accounts, { ...account, id: `acc-${Date.now()}` }],
    }))
  }, [update])

  const updateAccount = useCallback((id, changes) => {
    update(s => ({
      ...s,
      accounts: s.accounts.map(a => a.id === id ? { ...a, ...changes } : a),
    }))
  }, [update])

  const deleteAccount = useCallback((id) => {
    update(s => ({ ...s, accounts: s.accounts.filter(a => a.id !== id) }))
  }, [update])

  // --- Transactions ---
  const addTransaction = useCallback((tx) => {
    update(s => ({
      ...s,
      transactions: [{ ...tx, id: `tx-${Date.now()}` }, ...s.transactions],
    }))
  }, [update])

  const addTransactions = useCallback((txList) => {
    update(s => ({
      ...s,
      transactions: [
        ...txList.map((tx, i) => ({ ...tx, id: `tx-${Date.now()}-${i}` })),
        ...s.transactions,
      ],
    }))
  }, [update])

  const updateTransaction = useCallback((id, changes) => {
    update(s => ({
      ...s,
      transactions: s.transactions.map(t => t.id === id ? { ...t, ...changes } : t),
    }))
  }, [update])

  const deleteTransaction = useCallback((id) => {
    update(s => ({
      ...s,
      transactions: s.transactions.filter(t => t.id !== id),
      // Remember deleted auto-logged entries so the backfill won't re-add them
      ...(/^tx-rec(inc)?-/.test(id)
        ? { dismissedRecurring: [...new Set([...(s.dismissedRecurring ?? []), id])] }
        : {}),
    }))
  }, [update])

  // --- Budget Categories ---
  const addBudgetCategory = useCallback((cat) => {
    update(s => ({
      ...s,
      budgetCategories: [...s.budgetCategories, { ...cat, id: `bgt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }],
    }))
  }, [update])

  const updateBudgetCategory = useCallback((id, changes) => {
    update(s => ({
      ...s,
      budgetCategories: s.budgetCategories.map(c => c.id === id ? { ...c, ...changes } : c),
    }))
  }, [update])

  const deleteBudgetCategory = useCallback((id) => {
    update(s => ({ ...s, budgetCategories: s.budgetCategories.filter(c => c.id !== id) }))
  }, [update])

  // --- Holdings ---
  const addHolding = useCallback((holding) => {
    update(s => ({
      ...s,
      holdings: [...s.holdings, { ...holding, id: `hld-${Date.now()}` }],
    }))
  }, [update])

  const updateHolding = useCallback((id, changes) => {
    update(s => ({
      ...s,
      holdings: s.holdings.map(h => h.id === id ? { ...h, ...changes } : h),
    }))
  }, [update])

  const deleteHolding = useCallback((id) => {
    update(s => ({ ...s, holdings: s.holdings.filter(h => h.id !== id) }))
  }, [update])

  // --- Recurring Expenses ---
  const addRecurring = useCallback((item) => {
    update(s => {
      const newItem = { ...item, id: `rec-${Date.now()}`, startMonth: monthKey(new Date()) }
      // If this month's billing day has already passed, log it right away
      const due = missedOccurrences([newItem], s.transactions, {
        dayField: 'billingDay', idPrefix: 'tx-rec', sign: -1,
        dismissed: new Set(s.dismissedRecurring ?? []),
      })
      return {
        ...s,
        recurringExpenses: [...(s.recurringExpenses ?? []), newItem],
        transactions: [...due, ...s.transactions],
      }
    })
  }, [update])

  const updateRecurring = useCallback((id, changes) => {
    update(s => ({
      ...s,
      recurringExpenses: (s.recurringExpenses ?? []).map(r => r.id === id ? { ...r, ...changes } : r),
    }))
  }, [update])

  const deleteRecurring = useCallback((id) => {
    update(s => ({ ...s, recurringExpenses: (s.recurringExpenses ?? []).filter(r => r.id !== id) }))
  }, [update])

  // --- Recurring Incomes ---
  const addRecurringIncome = useCallback((item) => {
    update(s => {
      const newItem = { ...item, id: `recinc-${Date.now()}`, startMonth: monthKey(new Date()) }
      // If this month's pay day has already passed, log it right away
      const due = missedOccurrences([newItem], s.transactions, {
        dayField: 'payDay', idPrefix: 'tx-recinc', sign: 1,
        dismissed: new Set(s.dismissedRecurring ?? []),
      })
      return {
        ...s,
        recurringIncomes: [...(s.recurringIncomes ?? []), newItem],
        transactions: [...due, ...s.transactions],
      }
    })
  }, [update])

  const updateRecurringIncome = useCallback((id, changes) => {
    update(s => ({
      ...s,
      recurringIncomes: (s.recurringIncomes ?? []).map(r => r.id === id ? { ...r, ...changes } : r),
    }))
  }, [update])

  const deleteRecurringIncome = useCallback((id) => {
    update(s => ({ ...s, recurringIncomes: (s.recurringIncomes ?? []).filter(r => r.id !== id) }))
  }, [update])

  // --- Monthly Goal Checks ---
  const toggleGoalCheck = useCallback((month, goalId) => {
    update(s => {
      const checks = { ...(s.goalChecks ?? {}) }
      const monthChecks = { ...(checks[month] ?? {}) }
      monthChecks[goalId] = !monthChecks[goalId]
      checks[month] = monthChecks
      return { ...s, goalChecks: checks }
    })
  }, [update])

  // --- Settings ---
  const updateSettings = useCallback((changes) => {
    update(s => ({ ...s, settings: { ...s.settings, ...changes } }))
  }, [update])

  // --- Clear all data ---
  const clearAllData = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setState({
      accounts: [],
      transactions: [],
      budgetCategories: [],
      holdings: [],
      portfolioSnapshots: [],
      netWorthHistory: [],
      settings: {
        anthropicApiKey: state?.settings?.anthropicApiKey ?? '',
        currency: 'TWD',
        currentMonth: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })(),
        exchangeRates: {
          USD: 32.5,
          EUR: 35.5,
          JPY: 0.22,
          GBP: 41.5,
        },
      },
    })
  }, [state?.settings?.anthropicApiKey])

  return {
    ...state,
    ready: state !== null,
    cloud,
    clearAllData,
    addAccount, updateAccount, deleteAccount,
    addTransaction, addTransactions, updateTransaction, deleteTransaction,
    addBudgetCategory, updateBudgetCategory, deleteBudgetCategory,
    addHolding, updateHolding, deleteHolding,
    addRecurring, updateRecurring, deleteRecurring,
    addRecurringIncome, updateRecurringIncome, deleteRecurringIncome,
    toggleGoalCheck,
    updateSettings,
  }
}
