import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid,
} from 'recharts'
import { Plus, Pencil, Trash2, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, TrendingUp, TrendingDown, CheckCircle, Eye, EyeOff, Check } from 'lucide-react'
import clsx from 'clsx'
import { Card, SectionHeader, Button, Modal, Input, Select, StatCard } from '../components/ui'
import { formatCurrency, formatMonthYear } from '../utils/formatters'
import { CATEGORIES, EMOJI_MAP, BUDGET_GROUPS, GROUP_MAP, GROUP_EMOJI_MAP, INCOME_CATEGORY_SET } from '../data/categories'
import { MONTHLY_GOALS } from '../data/goals'
import { useInvestmentActuals } from '../hooks/useInvestmentActuals'

function CategoryIcon({ name }) {
  return <span className="text-base leading-none">{EMOJI_MAP[name] ?? GROUP_EMOJI_MAP[name] ?? '📦'}</span>
}

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 font-medium">{item.name}</p>
      <p className="text-white font-semibold">{formatCurrency(item.value)}</p>
    </div>
  )
}

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.name === 'Budget' ? '#94a3b8' : p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

const EMPTY_FORM = { name: BUDGET_GROUPS[0].name, limit: '', color: BUDGET_GROUPS[0].color, month: '' }
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function BudgetPage({
  budgetCategories, transactions, settings,
  addBudgetCategory, updateBudgetCategory, deleteBudgetCategory,
  updateTransaction, deleteTransaction, updateSettings,
  goalChecks = {}, toggleGoalCheck,
}) {
  // Always derived from computer clock — auto-advances each month (use local TZ, not UTC)
  const _now = new Date()
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const thisMonth = today.slice(0, 7)
  const thisYear = String(_now.getFullYear())

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [viewMode, setViewMode] = useState('month')
  const [viewDate, setViewDate] = useState(thisMonth)
  const [recommendationsApplied, setRecommendationsApplied] = useState(false)
  const [txGroupFilter, setTxGroupFilter] = useState('All')
  const [txCatFilter, setTxCatFilter] = useState('All')
  const [editTx, setEditTx] = useState(null) // transaction being edited
  const [txForm, setTxForm] = useState({})
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [editingGoalId, setEditingGoalId] = useState(null)
  const [goalDraft, setGoalDraft] = useState('')
  const investments = useInvestmentActuals()

  // ── Navigation ──────────────────────────────────────────────────────────────
  function navigate(dir) {
    if (viewMode === 'day') {
      const d = new Date(viewDate + 'T00:00:00')
      d.setDate(d.getDate() + dir)
      setViewDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    } else if (viewMode === 'month') {
      const [y, m] = viewDate.split('-').map(Number)
      const d = new Date(y, m - 1 + dir)
      setViewDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    } else {
      setViewDate(String(Number(viewDate) + dir))
    }
  }

  // Switching mode always jumps to the current real-world period
  function switchMode(newMode) {
    if (newMode === viewMode) return
    setViewMode(newMode)
    if (newMode === 'day') setViewDate(today)
    else if (newMode === 'month') setViewDate(thisMonth)
    else setViewDate(thisYear)
  }

  function periodLabel() {
    if (viewMode === 'day') {
      return new Date(viewDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }
    if (viewMode === 'month') return formatMonthYear(viewDate)
    return viewDate
  }

  // ── Copy last month's budget ────────────────────────────────────────────────
  const prevMonth = (() => {
    const [y, m] = thisMonth.split('-').map(Number)
    const d = new Date(y, m - 2)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })()
  const thisMonthHasBudget = budgetCategories.some(c => c.month === thisMonth)
  const prevMonthCategories = budgetCategories.filter(c => c.month === prevMonth)
  const showCopyBudget = viewMode === 'month' && viewDate === thisMonth && !thisMonthHasBudget && prevMonthCategories.length > 0

  function copyLastMonthBudget() {
    prevMonthCategories.forEach(c =>
      addBudgetCategory({ name: c.name, limit: c.limit, color: c.color, month: thisMonth })
    )
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const datePrefix = viewDate // tx.date.startsWith(datePrefix) works for day/month/year

  const spendingMap = useMemo(() => {
    const map = {}
    transactions.forEach(tx => {
      if (tx.hidden) return
      if (tx.amount < 0 && tx.date.startsWith(datePrefix)) {
        const group = GROUP_MAP[tx.category] ?? tx.category
        map[group] = (map[group] ?? 0) + Math.abs(tx.amountTWD ?? tx.amount)
      }
    })
    return map
  }, [transactions, datePrefix])

  const monthCategories = useMemo(() => {
    if (viewMode === 'year') {
      // Aggregate all monthly budgets for the year
      const map = {}
      budgetCategories
        .filter(c => c.month.startsWith(viewDate))
        .forEach(c => {
          if (!map[c.name]) map[c.name] = { ...c, limit: 0 }
          map[c.name].limit += c.limit
        })
      return Object.values(map)
    }
    const month = viewMode === 'day' ? viewDate.slice(0, 7) : viewDate
    return budgetCategories.filter(c => c.month === month)
  }, [budgetCategories, viewMode, viewDate])

  const totalBudget = monthCategories.reduce((s, c) => s + c.limit, 0)
  const totalSpent = Object.values(spendingMap).reduce((s, v) => s + v, 0)
  // Income shown for reference only — not factored into budget/remaining math
  const totalIncome = useMemo(() => {
    return transactions
      .filter(tx => !tx.hidden && tx.date.startsWith(datePrefix) && tx.amount > 0 && INCOME_CATEGORY_SET.has(tx.category))
      .reduce((s, tx) => s + Math.abs(tx.amountTWD ?? tx.amount), 0)
  }, [transactions, datePrefix])
  const overCount = monthCategories.filter(c => (spendingMap[c.name] ?? 0) > c.limit).length
  const filteredTxCount = transactions.filter(tx => tx.date.startsWith(datePrefix)).length

  // Days in the relevant month (used for daily budget calculations)
  const daysInMonth = useMemo(() => {
    const monthStr = viewMode === 'day' ? viewDate.slice(0, 7) : viewMode === 'month' ? viewDate : null
    if (!monthStr) return null
    const [y, m] = monthStr.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  }, [viewMode, viewDate])

  // Daily budget — shown in both day and month views
  const dailyBudget = useMemo(() => {
    if (!daysInMonth || totalBudget === 0) return null
    const monthBudget = viewMode === 'day'
      ? budgetCategories.filter(c => c.month === viewDate.slice(0, 7)).reduce((s, c) => s + c.limit, 0)
      : totalBudget
    return monthBudget > 0 ? monthBudget / daysInMonth : null
  }, [viewMode, viewDate, totalBudget, budgetCategories, daysInMonth])

  // Effective budget for stat cards: daily in day view, monthly otherwise
  const effectiveBudget = viewMode === 'day' ? (dailyBudget ?? 0) : totalBudget
  const effectiveOverCount = monthCategories.filter(c => {
    const limit = viewMode === 'day' && daysInMonth ? c.limit / daysInMonth : c.limit
    return (spendingMap[c.name] ?? 0) > limit
  }).length

  const dayViewSpent = useMemo(() => {
    // In day view: spending for viewDate; in month view: spending for today
    const targetDate = viewMode === 'day' ? viewDate : today
    if (viewMode === 'year') return 0
    return transactions
      .filter(tx => !tx.hidden && tx.amount < 0 && tx.date === targetDate)
      .reduce((s, tx) => s + Math.abs(tx.amountTWD ?? tx.amount), 0)
  }, [transactions, viewMode, viewDate, today])

  const budgetedCatNames = new Set(monthCategories.map(c => c.name))
  const unbudgetedSpend = Object.entries(spendingMap)
    .filter(([name]) => !budgetedCatNames.has(name))
    .reduce((s, [, v]) => s + v, 0)

  const pieData = [
    ...monthCategories
      .map(c => ({ name: c.name, value: spendingMap[c.name] ?? 0, fill: c.color }))
      .filter(d => d.value > 0),
    ...(unbudgetedSpend > 0 ? [{ name: 'Unbudgeted', value: unbudgetedSpend, fill: '#71717a' }] : []),
  ]

  const barData = monthCategories.map(c => ({
    name: c.name.length > 9 ? c.name.slice(0, 9) + '…' : c.name,
    Budget: viewMode === 'day' && daysInMonth ? c.limit / daysInMonth : c.limit,
    Spent: spendingMap[c.name] ?? 0,
    color: c.color,
  }))

  const yearBarData = useMemo(() => {
    if (viewMode !== 'year') return []
    return MONTH_NAMES.map((label, i) => {
      const monthPrefix = `${viewDate}-${String(i + 1).padStart(2, '0')}`
      const spent = transactions
        .filter(tx => !tx.hidden && tx.amount < 0 && tx.date.startsWith(monthPrefix))
        .reduce((s, tx) => s + Math.abs(tx.amountTWD ?? tx.amount), 0)
      const budget = budgetCategories
        .filter(c => c.month === monthPrefix)
        .reduce((s, c) => s + c.limit, 0)
      return { name: label, Spent: spent, Budget: budget }
    })
  }, [transactions, budgetCategories, viewMode, viewDate])

  // Year-specific insights
  const yearMonthsWithData = viewMode === 'year' ? yearBarData.filter(m => m.Spent > 0).length : 0
  const yearMonthlyAvg = yearMonthsWithData > 0 ? totalSpent / yearMonthsWithData : 0
  const yearMonthsElapsed = viewMode === 'year'
    ? (viewDate === thisYear ? new Date().getMonth() + 1 : 12)
    : 0
  const yearProjected = viewMode === 'year' && yearMonthsElapsed > 0
    ? (totalSpent / yearMonthsElapsed) * 12
    : 0

  // Annual budget = most recent month's budget × 12 (not sum of all months set up)
  const yearStandardMonthlyBudget = useMemo(() => {
    if (viewMode !== 'year') return 0
    for (let i = 12; i >= 1; i--) {
      const m = `${viewDate}-${String(i).padStart(2, '0')}`
      const cats = budgetCategories.filter(c => c.month === m)
      if (cats.length > 0) return cats.reduce((s, c) => s + c.limit, 0)
    }
    return 0
  }, [viewMode, viewDate, budgetCategories])
  const yearAnnualBudget = yearStandardMonthlyBudget * 12

  // Budget recommendations based on most recent month's spending vs current limits
  const budgetRecommendations = useMemo(() => {
    if (viewMode !== 'year' || yearMonthsElapsed === 0) return []
    // Find reference month (most recently set up)
    let refMonth = ''
    for (let i = 12; i >= 1; i--) {
      const m = `${viewDate}-${String(i).padStart(2, '0')}`
      if (budgetCategories.some(c => c.month === m)) { refMonth = m; break }
    }
    if (!refMonth) return []
    const refCats = budgetCategories.filter(c => c.month === refMonth)
    const currentMonthNum = viewDate === thisYear ? new Date().getMonth() + 1 : 12

    return refCats.map(cat => {
      // Find the most recent month that has spending for this category
      let monthlySpend = 0
      let basisMonth = ''
      for (let i = currentMonthNum; i >= 1; i--) {
        const monthPrefix = `${viewDate}-${String(i).padStart(2, '0')}`
        const spent = transactions
          .filter(tx => !tx.hidden && tx.amount < 0 && tx.date.startsWith(monthPrefix) && (GROUP_MAP[tx.category] ?? tx.category) === cat.name)
          .reduce((s, tx) => s + Math.abs(tx.amountTWD ?? tx.amount), 0)
        if (spent > 0) { monthlySpend = spent; basisMonth = monthPrefix; break }
      }
      const ratio = cat.limit > 0 && monthlySpend > 0 ? monthlySpend / cat.limit : 0
      const suggested = ratio > 1.1
        ? Math.ceil(monthlySpend * 1.15 / 1000) * 1000
        : ratio < 0.7 && monthlySpend > 0
          ? Math.ceil(monthlySpend * 1.2 / 1000) * 1000
          : null
      if (suggested === null) return null
      return { cat, monthlySpend, basisMonth, ratio, suggested, type: ratio > 1 ? 'increase' : 'decrease' }
    }).filter(Boolean)
  }, [viewMode, viewDate, budgetCategories, transactions, yearMonthsElapsed, thisYear])

  function applyRecommendations() {
    const [y, m] = thisMonth.split('-').map(Number)
    const d = new Date(y, m)
    const nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    budgetRecommendations.forEach(({ cat, suggested }) => {
      const existing = budgetCategories.find(c => c.name === cat.name && c.month === nextMonth)
      if (existing) updateBudgetCategory(existing.id, { ...existing, limit: suggested })
      else addBudgetCategory({ name: cat.name, limit: suggested, color: cat.color, month: nextMonth })
    })
    // Also update current month if it has these categories
    budgetRecommendations.forEach(({ cat, suggested }) => {
      const existing = budgetCategories.find(c => c.name === cat.name && c.month === thisMonth)
      if (existing) updateBudgetCategory(existing.id, { ...existing, limit: suggested })
    })
    setRecommendationsApplied(true)
  }

  // ── Modal helpers ───────────────────────────────────────────────────────────
  const activeMonth = viewMode === 'day' ? viewDate.slice(0, 7) : viewMode === 'year' ? viewDate + '-01' : viewDate

  function openAdd() {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, month: activeMonth })
    setModalOpen(true)
  }

  function openEdit(cat) {
    setEditTarget(cat.id)
    setForm({ name: cat.name, limit: String(cat.limit), color: cat.color, month: cat.month })
    setModalOpen(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const limit = parseFloat(form.limit)
    if (isNaN(limit)) return
    if (editTarget) {
      updateBudgetCategory(editTarget, { ...form, limit })
    } else {
      addBudgetCategory({ ...form, limit })
    }
    setModalOpen(false)
  }

  function setupDefaultBudget() {
    BUDGET_GROUPS.forEach(g => {
      addBudgetCategory({ name: g.name, limit: g.defaultLimit, color: g.color, month: activeMonth })
    })
  }

  const periodTxLabel = viewMode === 'day' ? 'transactions today'
    : viewMode === 'year' ? 'transactions this year'
    : 'transactions this month'

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Budget & Spending</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{periodLabel()}</p>
        </div>
        {showCopyBudget && (
          <Button size="sm" variant="secondary" onClick={copyLastMonthBudget}>
            <RefreshCw size={13} /> Copy last month's budget
          </Button>
        )}
      </div>

      {/* View switcher + navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex rounded-lg border border-surface-border overflow-hidden text-xs font-medium">
            {['day', 'month', 'year'].map(mode => (
              <button
                key={mode}
                onClick={() => switchMode(mode)}
                className={clsx(
                  'px-3 py-1.5 capitalize transition-colors',
                  viewMode === mode
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-elevated'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate(+1)}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={() => { setViewMode('month'); setViewDate(thisMonth) }}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Current month
        </button>
      </div>

      {/* Monthly Goals — checkable savings/investment reminders (only visible in month view) */}
      {viewMode === 'month' && (
        <div className="rounded-xl border border-surface-border overflow-hidden">
          {MONTHLY_GOALS.map((goal, i) => {
            // Goals with a real ledger behind them report progress; the rest rely on the checkbox.
            // Null until the ledger is fetched, so a slow read never renders a false "0 invested".
            const tracked = goal.tracksActuals && investments.ready && !investments.error
            // A ledger-backed goal also takes its budget from the ledger (portfolio/budget.csv),
            // the same file the portfolio dashboard shows — one number, no second copy to drift.
            const ledgerBudget = tracked && investments.budget != null
            const goalAmount = ledgerBudget ? investments.budget : (settings?.[goal.settingsKey] ?? goal.defaultAmount)
            const isEditing = editingGoalId === goal.id
            const actual = tracked ? (investments.months[viewDate] ?? 0) : null
            const acctSplit = tracked
              ? Object.entries(investments.accounts?.[viewDate] ?? {}).sort((a, b) => b[1] - a[1])
              : []
            const met = actual !== null && actual >= goalAmount
            const checked = met || !!goalChecks[viewDate]?.[goal.id]
            const shortfall = actual === null ? 0 : Math.max(0, goalAmount - actual)
            const rawPct = actual === null || goalAmount <= 0 ? 0 : (actual / goalAmount) * 100
            const pct = Math.min(100, rawPct)
            return (
              <div
                key={goal.id}
                className={clsx(
                  'flex items-center justify-between px-4 py-3 transition-colors',
                  i > 0 && 'border-t border-surface-border',
                  checked ? 'bg-emerald-500/10' : 'bg-amber-500/5',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {actual !== null ? (
                    // Derived from the lot ledger — not something to tick by hand
                    <span
                      title="Tracked automatically from your portfolio"
                      className={clsx(
                        'shrink-0 w-6 h-6 rounded-md flex items-center justify-center border-2',
                        met ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-600 text-zinc-600',
                      )}
                    >
                      {met ? <Check size={14} strokeWidth={3} /> : <TrendingUp size={12} />}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleGoalCheck(viewDate, goal.id)}
                      aria-label={checked ? 'Mark not saved' : 'Mark as saved'}
                      className={clsx(
                        'shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all border-2',
                        checked
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-500 hover:border-emerald-400 bg-transparent',
                      )}
                    >
                      {checked && <Check size={14} strokeWidth={3} />}
                    </button>
                  )}
                  <span className="text-lg leading-none">{goal.emoji}</span>
                  <div className="min-w-0">
                    <p className={clsx('text-sm font-medium', checked ? 'text-emerald-200' : 'text-zinc-200')}>
                      {goal.name}
                    </p>
                    {actual !== null ? (
                      <>
                        <p className="text-xs text-zinc-500">
                          <span className={met ? 'text-emerald-400' : 'text-zinc-300'}>{formatCurrency(actual)}</span>
                          <span className="text-zinc-600"> / {formatCurrency(goalAmount)}</span>
                          {/* one decimal, matching the portfolio card's 執行率 for the same month */}
                          <span className="text-zinc-400"> · {rawPct.toFixed(1)}%</span>
                          {met
                            ? <span className="text-emerald-400"> · Goal met ✓</span>
                            : <span className="text-amber-400"> · {formatCurrency(shortfall)} to go</span>}
                        </p>
                        {acctSplit.length > 0 && (
                          // every account counts — 台股, 複委託, 海外券商 — shown so the
                          // total is traceable, not a single opaque number
                          <p className="text-[11px] text-zinc-600 tabular-nums">
                            {acctSplit.map(([acct, twd], i) => (
                              <span key={acct}>
                                {i > 0 && ' · '}{acct} {formatCurrency(twd)}
                                {actual > 0 && <span className="text-zinc-700"> {((twd / actual) * 100).toFixed(1)}%</span>}
                              </span>
                            ))}
                          </p>
                        )}
                      </>
                    ) : goal.tracksActuals && investments.error ? (
                      <p className="text-xs text-amber-500/80" title={investments.error}>
                        Portfolio ledger unavailable — tick manually for now
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        {checked ? `Saved for ${periodLabel()} ✓` : `Monthly goal — reminder for ${periodLabel()}`}
                      </p>
                    )}
                    {actual !== null && (
                      <div className="mt-1.5 h-1 w-40 rounded-full bg-zinc-700/60 overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-[width] duration-500', met ? 'bg-emerald-500' : 'bg-amber-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-500">NT$</span>
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        step="1000"
                        value={goalDraft}
                        onChange={e => setGoalDraft(e.target.value)}
                        onBlur={() => {
                          const val = parseFloat(goalDraft)
                          if (!isNaN(val) && val >= 0) updateSettings({ [goal.settingsKey]: val })
                          setEditingGoalId(null)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setEditingGoalId(null)
                        }}
                        className="w-24 rounded border border-surface-border bg-surface-elevated px-2 py-1 text-sm text-white text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  ) : ledgerBudget ? (
                    // Not editable here on purpose: the figure lives in portfolio/budget.csv
                    // and is shared with the portfolio dashboard. Editing it in two places
                    // would let the two dashboards disagree about the same month.
                    <span
                      className="text-sm font-semibold tabular-nums text-white cursor-help"
                      title="Set in portfolio/budget.csv (monthly_twd) — shared with the portfolio dashboard"
                    >
                      {formatCurrency(goalAmount)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setGoalDraft(String(goalAmount)); setEditingGoalId(goal.id) }}
                      className="text-sm font-semibold tabular-nums text-white hover:text-indigo-300 transition-colors flex items-center gap-1 group"
                      title="Click to edit"
                    >
                      {formatCurrency(goalAmount)}
                      <Pencil size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {viewMode === 'year' ? (
          <>
            <StatCard
              label="Spent This Year"
              value={formatCurrency(totalSpent)}
              sub={yearProjected > 0 ? `Projected: ${formatCurrency(yearProjected)}` : `${filteredTxCount} transactions`}
              subColor={yearAnnualBudget > 0 && yearProjected > yearAnnualBudget ? 'text-red-400' : 'text-zinc-500'}
            />
            <StatCard
              label="Monthly Average"
              value={yearMonthlyAvg > 0 ? formatCurrency(yearMonthlyAvg) : '—'}
              sub={yearMonthsWithData > 0 ? `Across ${yearMonthsWithData} month${yearMonthsWithData > 1 ? 's' : ''} with data` : 'No spending yet'}
            />
            <StatCard
              label="Annual Budget"
              value={yearAnnualBudget > 0 ? formatCurrency(yearAnnualBudget) : '—'}
              sub={yearAnnualBudget > 0
                ? (yearProjected > yearAnnualBudget
                    ? `On track to exceed by ${formatCurrency(yearProjected - yearAnnualBudget)}`
                    : `On track to save ${formatCurrency(yearAnnualBudget - yearProjected)}`)
                : `${formatCurrency(yearStandardMonthlyBudget > 0 ? 0 : 0)} Set a monthly budget to track`}
              subColor={yearAnnualBudget > 0 && yearProjected > yearAnnualBudget ? 'text-red-400' : 'text-emerald-400'}
            />
            <StatCard
              label="Income (for reference)"
              value={formatCurrency(totalIncome)}
              sub="Not counted toward budget"
              subColor="text-zinc-500"
            />
          </>
        ) : (
          <>
            <StatCard
              label={viewMode === 'day' ? 'Daily Budget' : 'Total Budgeted'}
              value={formatCurrency(effectiveBudget)}
              sub={viewMode === 'day' ? `Monthly ÷ ${daysInMonth} days` : `${monthCategories.length} categories`}
            />
            <StatCard
              label="Total Spent"
              value={formatCurrency(totalSpent)}
              sub={effectiveBudget > 0 ? `${((totalSpent / effectiveBudget) * 100).toFixed(0)}% of budget` : `${filteredTxCount} ${periodTxLabel}`}
              subColor={effectiveBudget > 0 && totalSpent > effectiveBudget ? 'text-red-400' : 'text-emerald-400'}
            />
            <StatCard
              label="Remaining"
              value={effectiveBudget > 0 ? formatCurrency(Math.max(0, effectiveBudget - totalSpent)) : '—'}
              sub={effectiveBudget > 0 ? (effectiveOverCount > 0 ? `${effectiveOverCount} categories over` : 'On track') : 'No budget set yet'}
              subColor={effectiveBudget > 0 && effectiveOverCount > 0 ? 'text-amber-400' : 'text-emerald-400'}
            />
            <StatCard
              label="Income (for reference)"
              value={formatCurrency(totalIncome)}
              sub="Not counted toward budget"
              subColor="text-zinc-500"
            />
          </>
        )}
      </div>

      {/* Daily budget bar — day and month views */}
      {viewMode !== 'year' && dailyBudget !== null && (
        <Card className="!py-3">
          <div className="flex items-center divide-x divide-surface-border">
            <div className="flex-1 text-center px-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Daily Budget</p>
              <p className="text-base font-bold text-white">{formatCurrency(dailyBudget)}</p>
            </div>
            <div className="flex-1 text-center px-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
                {viewMode === 'day' ? 'Spent This Day' : 'Spent Today'}
              </p>
              <p className={`text-base font-bold ${dayViewSpent > dailyBudget ? 'text-red-400' : 'text-white'}`}>
                {formatCurrency(dayViewSpent)}
              </p>
            </div>
            <div className="flex-1 text-center px-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Daily Remaining</p>
              <p className={`text-base font-bold ${dayViewSpent >= dailyBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatCurrency(Math.max(0, dailyBudget - dayViewSpent))}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <SectionHeader
            title="Spending Breakdown"
            subtitle={`By category ${viewMode === 'year' ? 'this year' : viewMode === 'day' ? 'today' : 'this month'}`}
          />
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <ReTooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 min-w-0">
                {pieData.slice(0, 6).map(d => {
                  const pct = totalSpent > 0 ? ((d.value / totalSpent) * 100).toFixed(0) : 0
                  return (
                    <div key={d.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                        <span className="text-xs text-zinc-400 truncate">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {viewMode === 'year' && (
                          <span className="text-[10px] text-zinc-600 tabular-nums">{pct}%</span>
                        )}
                        <span className="text-xs text-zinc-300 font-medium tabular-nums">{formatCurrency(d.value)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-600 py-4 text-center">No spending data for this period</p>
          )}
        </Card>

        <Card>
          {viewMode === 'year' ? (
            <>
              <SectionHeader title="Monthly Spending" subtitle={`${viewDate} — budget vs. actual by month`} />
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={yearBarData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f50" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `NT$${(v / 1000).toFixed(0)}k`} />
                  <ReTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="Budget" fill="#334155" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Spent" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <SectionHeader title="Budget vs. Spent" subtitle="By category" />
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f50" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `NT$${(v / 1000).toFixed(0)}k`} />
                  <ReTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="Budget" fill="#334155" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Spent" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>
      </div>

      {/* Budget recommendations — year view only */}
      {viewMode === 'year' && budgetRecommendations.length > 0 && (
        <Card>
          <SectionHeader
            title="Budget Adjustment Recommendations"
            subtitle="Based on your spending patterns this year"
            action={
              recommendationsApplied
                ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={13} /> Applied</span>
                : <Button size="sm" onClick={applyRecommendations}>Apply All Adjustments</Button>
            }
          />
          <div className="space-y-3">
            {budgetRecommendations.map(({ cat, monthlySpend, basisMonth, ratio, suggested, type }) => (
              <div key={cat.id} className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface-elevated px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: cat.color + '20' }}>
                    <CategoryIcon name={cat.name} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{cat.name}</p>
                    <p className="text-xs text-zinc-500">
                      {basisMonth} spend: {formatCurrency(monthlySpend)} · Limit: {formatCurrency(cat.limit)} · {(ratio * 100).toFixed(0)}% of budget
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-right">
                  {type === 'increase'
                    ? <TrendingUp size={14} className="text-red-400" />
                    : <TrendingDown size={14} className="text-emerald-400" />
                  }
                  <div>
                    <p className={`text-sm font-semibold ${type === 'increase' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {formatCurrency(cat.limit)} → {formatCurrency(suggested)}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {type === 'increase' ? 'Increase' : 'Decrease'} by {formatCurrency(Math.abs(suggested - cat.limit))}/mo
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-zinc-600 pt-1">
              Adjustments will be applied to {(() => { const [y, m] = thisMonth.split('-').map(Number); const d = new Date(y, m); return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}` })()} and the current month.
            </p>
          </div>
        </Card>
      )}

      {/* Category cards */}
      <Card>
        <SectionHeader
          title="Categories"
          subtitle={`${monthCategories.length} categories for ${periodLabel()}`}
          action={viewMode !== 'year' && (
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} /> Add Category
            </Button>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {monthCategories.map(cat => {
            const spent = spendingMap[cat.name] ?? 0
            const catLimit = viewMode === 'day' && daysInMonth ? cat.limit / daysInMonth : cat.limit
            const pct = Math.min((spent / catLimit) * 100, 100)
            const over = spent > catLimit
            return (
              <div key={cat.id} className="rounded-lg border border-surface-border bg-surface-elevated p-3 group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: cat.color + '20' }}>
                      <CategoryIcon name={cat.name} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100 leading-tight">{cat.name}</p>
                      <p className="text-xs text-zinc-500 leading-tight">
                        {formatCurrency(spent)} / {formatCurrency(catLimit)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {over && <AlertTriangle size={13} className="text-amber-400" />}
                    <span className={`text-xs font-semibold ${over ? 'text-amber-400' : 'text-zinc-400'}`}>
                      {pct.toFixed(0)}%
                    </span>
                    {viewMode !== 'year' && (
                      <div className="hidden group-hover:flex gap-0.5 ml-1">
                        <button onClick={() => openEdit(cat)} className="p-1 rounded text-zinc-500 hover:text-zinc-200">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => deleteBudgetCategory(cat.id)} className="p-1 rounded text-zinc-500 hover:text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-surface-DEFAULT overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: over ? '#f59e0b' : cat.color }}
                  />
                </div>
                {over && (
                  <p className="text-xs text-amber-400 mt-1">{formatCurrency(spent - catLimit)} over budget</p>
                )}
              </div>
            )
          })}
          {monthCategories.length === 0 && viewMode !== 'year' && (
            <div className="col-span-2 py-6 text-center space-y-3">
              <p className="text-sm text-zinc-500">No budget groups set up yet.</p>
              <button
                type="button"
                onClick={setupDefaultBudget}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 text-sm font-medium hover:bg-indigo-500/25 transition-colors"
              >
                ✨ Use my budget plan (NT$54k / NT$18k / NT$18k)
              </button>
              <p className="text-xs text-zinc-600">Or click <strong className="text-zinc-400">Add Category</strong> above to customise.</p>
            </div>
          )}
          {monthCategories.length === 0 && viewMode === 'year' && (
            <div className="col-span-2 py-6 text-center">
              <p className="text-sm text-zinc-500">No budget data for {viewDate}.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Transactions */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionHeader
            title="Transactions"
            subtitle={`${filteredTxCount} ${periodTxLabel}`}
          />
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={txGroupFilter}
              onChange={e => { setTxGroupFilter(e.target.value); setTxCatFilter('All') }}
              className="rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Categories</option>
              {BUDGET_GROUPS.map(g => <option key={g.name} value={g.name}>{g.emoji} {g.name}</option>)}
            </select>
            <select
              value={txCatFilter}
              onChange={e => setTxCatFilter(e.target.value)}
              className="rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Subcategories</option>
              {(txGroupFilter === 'All' ? CATEGORIES : CATEGORIES.filter(c => c.group === txGroupFilter))
                .map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
        </div>
        {/* Spending summary by subcategory */}
        {filteredTxCount > 0 && txCatFilter === 'All' && (() => {
          const visibleTx = transactions
            .filter(tx => !tx.hidden && tx.date.startsWith(datePrefix) && tx.amount < 0)
            .filter(tx => txGroupFilter === 'All' || (GROUP_MAP[tx.category] ?? tx.category) === txGroupFilter)
          const catTotals = {}
          visibleTx.forEach(tx => {
            const cat = tx.category ?? 'Other'
            catTotals[cat] = (catTotals[cat] ?? 0) + Math.abs(tx.amountTWD ?? tx.amount)
          })
          const rows = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
          if (rows.length === 0) return null
          const grandTotal = rows.reduce((s, [, v]) => s + v, 0)
          return (
            <div className="mb-5 rounded-xl border border-indigo-500/20 bg-indigo-950/25 overflow-hidden">
              {/* Header — clickable to collapse */}
              <button
                type="button"
                onClick={() => setSummaryOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400">Spending Summary</span>
                  <span className="text-[10px] text-indigo-400/60 tabular-nums">{rows.length} categories</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold tabular-nums text-indigo-300">{formatCurrency(grandTotal)}</span>
                  <ChevronDown size={13} className={clsx("text-indigo-400/60 transition-transform duration-200", !summaryOpen && "-rotate-90")} />
                </div>
              </button>
              {/* Rows */}
              {summaryOpen && (
                <div className="border-t border-indigo-500/15">
                  {rows.map(([cat, total]) => {
                    const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
                    return (
                      <div
                        key={cat}
                        onClick={() => setTxCatFilter(cat)}
                        className="relative flex items-center justify-between px-3 py-2.5 border-b border-indigo-500/10 last:border-0 cursor-pointer overflow-hidden hover:brightness-125 transition-all"
                      >
                        {/* Progress bar fill */}
                        <div
                          className="absolute left-0 top-0 h-full bg-indigo-500/10 transition-[width] duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative z-10 flex items-center gap-1.5 text-xs text-zinc-300">
                          <CategoryIcon name={cat} />{cat}
                        </span>
                        <div className="relative z-10 flex items-center gap-2.5">
                          <span className="text-[10px] tabular-nums text-indigo-400/60">{pct.toFixed(0)}%</span>
                          <span className="text-xs font-semibold tabular-nums text-white w-24 text-right">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
        {/* Transaction History divider */}
        {filteredTxCount > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 shrink-0">Transaction History</p>
            <div className="h-px flex-1 bg-surface-border" />
          </div>
        )}
        {filteredTxCount === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-zinc-500">No transactions for this period.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {transactions
              .filter(tx => tx.date.startsWith(datePrefix))
              .filter(tx => txGroupFilter === 'All' || (GROUP_MAP[tx.category] ?? tx.category) === txGroupFilter)
              .filter(tx => txCatFilter === 'All' || tx.category === txCatFilter)
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(tx => (
                <div key={tx.id} className={clsx("flex items-center justify-between py-2 px-2 rounded-lg hover:bg-surface-elevated transition-colors group", tx.hidden && "opacity-50")}>
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon name={tx.category} />
                    <div>
                      <p className={clsx("text-sm leading-tight", tx.hidden ? "line-through text-zinc-500" : "text-zinc-200")}>{tx.description}</p>
                      <p className="text-xs text-zinc-600 leading-tight">{tx.date} · {tx.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={clsx("text-sm font-semibold tabular-nums", tx.hidden ? "line-through text-zinc-500" : "text-white")}>
                        {tx.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(tx.amountTWD ?? tx.amount))}
                      </p>
                      {tx.currency && tx.currency !== 'TWD' && (
                        <p className="text-[10px] text-zinc-600 tabular-nums">
                          {formatCurrency(Math.abs(tx.amount), tx.currency)} {tx.currency}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => updateTransaction(tx.id, { hidden: !tx.hidden })}
                        title={tx.hidden ? 'Include in totals' : 'Exclude from totals'}
                        className={clsx(
                          "p-1 rounded transition-colors",
                          tx.hidden
                            ? "text-zinc-400 hover:text-zinc-200"
                            : "text-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100"
                        )}
                      >
                        {tx.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        onClick={() => { setEditTx(tx); setTxForm({ date: tx.date, description: tx.description, amount: String(Math.abs(tx.amount)), category: tx.category }) }}
                        className="p-1 rounded text-zinc-600 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteTransaction(tx.id)}
                        className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Edit transaction modal */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Edit Transaction">
        <form onSubmit={e => {
          e.preventDefault()
          const raw = parseFloat(txForm.amount)
          if (isNaN(raw) || raw <= 0) return
          updateTransaction(editTx.id, {
            date: txForm.date,
            description: txForm.description,
            amount: editTx.amount < 0 ? -raw : raw,
            category: txForm.category,
            ...(editTx.currency && editTx.currency !== 'TWD' ? { amountTWD: editTx.amount < 0 ? -raw : raw } : {}),
          })
          setEditTx(null)
        }} className="space-y-4">
          <Input label="Date" type="date" value={txForm.date ?? ''} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} required />
          <Input label="Description" placeholder="e.g. PX Mart" value={txForm.description ?? ''} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} required />
          <Input label="Amount (NT$)" type="number" step="0.01" min="0.01" value={txForm.amount ?? ''} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} required />
          <Select label="Category" value={txForm.category ?? ''} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditTx(null)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Add/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Budget Group' : 'Add Budget Group'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Budget Group"
            value={form.name}
            onChange={e => {
              const g = BUDGET_GROUPS.find(g => g.name === e.target.value)
              setForm(f => ({ ...f, name: e.target.value, color: g?.color ?? f.color }))
            }}
          >
            {BUDGET_GROUPS.map(g => (
              <option key={g.name} value={g.name}>{g.emoji} {g.name}</option>
            ))}
          </Select>
          <Input
            label="Monthly limit (NT$)"
            type="number"
            step="1"
            min="0"
            placeholder="e.g. 54000"
            value={form.limit}
            onChange={e => setForm(f => ({ ...f, limit: e.target.value }))}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-9 h-9 rounded-lg border border-surface-border bg-surface-elevated cursor-pointer"
              />
              <span className="text-xs text-zinc-500">{form.color}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editTarget ? 'Save Changes' : 'Add Category'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
