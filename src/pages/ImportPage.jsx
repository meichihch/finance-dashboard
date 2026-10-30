import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { Plus, Check, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { Card, Button, Input, Select } from '../components/ui'
import { CATEGORIES, EMOJI_MAP } from '../data/categories'
import { formatCurrency } from '../utils/formatters'

const CATEGORY_GROUPS = [...new Set(CATEGORIES.map(c => c.group))]

function CategoryPicker({ value, onChange }) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-zinc-400">Category</label>
      {CATEGORY_GROUPS.map(group => (
        <div key={group}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1.5">{group}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.filter(c => c.group === group).map(cat => (
              <button
                key={cat.name}
                type="button"
                onClick={() => onChange(cat.name)}
                className={clsx(
                  'flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition-colors',
                  value === cat.name
                    ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                    : 'bg-surface-elevated border border-transparent text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                )}
              >
                <span className="text-lg leading-none">{cat.emoji}</span>
                <span className="text-[10px] leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const SUPPORTED_CURRENCIES = [
  { code: 'TWD', label: 'NT$ — TWD' },
  { code: 'USD', label: '$  — USD' },
  { code: 'EUR', label: '€  — EUR' },
  { code: 'JPY', label: '¥  — JPY' },
  { code: 'GBP', label: '£  — GBP' },
]
const FALLBACK_RATES = { TWD: 1, USD: 32.5, EUR: 35.5, JPY: 0.22, GBP: 41.5 }

// ── Manual Entry Tab ──────────────────────────────────────────────────────────
function ManualEntryTab({ settings, addTransaction, transactions }) {
  return <ExpenseForm settings={settings} onSave={addTransaction} transactions={transactions} />
}

// ── Expense Form ───────────────────────────────────────────────────────────────
function ExpenseForm({ settings, onSave, transactions = [] }) {
  const [form, setForm] = useState({
    date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })(),
    description: '',
    amount: '',
    currency: 'TWD',
    exchangeRate: '1',
    category: 'Food & Dining',
  })
  const [saved, setSaved] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  function handleDescriptionChange(e) {
    const val = e.target.value
    setForm(f => ({ ...f, description: val }))
    if (val.length < 1) { setSuggestions([]); setShowSuggestions(false); return }
    const lower = val.toLowerCase()
    // Build frequency map
    const freq = {}
    transactions.forEach(tx => { const k = tx.description.toLowerCase(); freq[k] = (freq[k] ?? 0) + 1 })
    // Unique descriptions matching the query
    const seen = new Set()
    const matches = transactions
      .map(tx => tx.description)
      .filter(d => { const k = d.toLowerCase(); if (seen.has(k) || !k.includes(lower)) return false; seen.add(k); return true })
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(lower) ? 0 : 1
        const bStarts = b.toLowerCase().startsWith(lower) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        return (freq[b.toLowerCase()] ?? 0) - (freq[a.toLowerCase()] ?? 0)
      })
      .slice(0, 5)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  function selectSuggestion(desc) {
    // Also auto-fill the most common category used for this description
    const catFreq = {}
    transactions.filter(tx => tx.description === desc).forEach(tx => {
      catFreq[tx.category] = (catFreq[tx.category] ?? 0) + 1
    })
    const bestCat = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0]
    setForm(f => ({ ...f, description: desc, ...(bestCat ? { category: bestCat } : {}) }))
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleCurrencyChange(code) {
    const rate = settings?.exchangeRates?.[code] ?? FALLBACK_RATES[code] ?? 1
    setForm(f => ({ ...f, currency: code, exchangeRate: code === 'TWD' ? '1' : String(rate) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const raw = parseFloat(form.amount)
    if (isNaN(raw) || raw <= 0) return
    const rate = parseFloat(form.exchangeRate) || 1
    const rawTWD = form.currency === 'TWD' ? raw : raw * rate
    onSave({
      date: form.date,
      description: form.description,
      amount: -raw,
      category: form.category,
      currency: form.currency,
      ...(form.currency !== 'TWD' && { exchangeRate: rate, amountTWD: -rawTWD }),
    })
    setForm(f => ({ ...f, description: '', amount: '' }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const twdEquiv = form.currency !== 'TWD' && parseFloat(form.amount) > 0
    ? Math.round(parseFloat(form.amount) * (parseFloat(form.exchangeRate) || 1))
    : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Date"
        type="date"
        value={form.date}
        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
        required
      />

      <div className="space-y-1.5 relative">
        <label className="block text-xs font-medium text-zinc-400">What did you spend on?</label>
        <input
          className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g. PX Mart, Clinic, MRT, Netflix"
          value={form.description}
          onChange={handleDescriptionChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          required
        />
        {showSuggestions && (
          <div className="absolute z-10 w-full rounded-lg border border-surface-border bg-surface-card shadow-xl overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => selectSuggestion(s)}
                className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-surface-elevated transition-colors border-b border-surface-border last:border-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Amount + Currency row */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Amount (${form.currency})`}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            required
          />
          <Select
            label="Currency"
            value={form.currency}
            onChange={e => handleCurrencyChange(e.target.value)}
          >
            {SUPPORTED_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </Select>
        </div>

        {/* Exchange rate + TWD preview (only for non-TWD) */}
        {form.currency !== 'TWD' && (
          <div className="flex items-center gap-3">
            <div className="w-40 shrink-0">
              <Input
                label="Rate to NT$"
                type="number"
                step="0.001"
                min="0"
                placeholder="32.5"
                value={form.exchangeRate}
                onChange={e => setForm(f => ({ ...f, exchangeRate: e.target.value }))}
              />
            </div>
            {twdEquiv !== null && (
              <p className="text-xs text-zinc-400 mt-4">
                ≈ <span className="font-semibold text-zinc-200">NT${twdEquiv.toLocaleString()}</span> TWD
              </p>
            )}
          </div>
        )}
      </div>

      <CategoryPicker
        value={form.category}
        onChange={cat => setForm(f => ({ ...f, category: cat }))}
      />

      <Button type="submit" className="w-full justify-center mt-2">
        {saved
          ? <><Check size={14} /> Expense saved!</>
          : <><Plus size={14} /> Add Expense</>}
      </Button>
    </form>
  )
}

// ── Recurring Tab ─────────────────────────────────────────────────────────────
const EMPTY_REC = { name: '', amount: '', category: 'Food & Dining', billingDay: '' }

function RecurringTab({ recurringExpenses, addRecurring, updateRecurring, deleteRecurring, transactions }) {
  const [form, setForm] = useState(EMPTY_REC)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const total = recurringExpenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  // Which items are already logged this month
  const loggedThisMonth = useMemo(() => {
    const logged = {}
    recurringExpenses.forEach(item => {
      const already = transactions.some(tx =>
        tx.description === item.name &&
        tx.category === item.category &&
        tx.date.startsWith(thisMonth)
      )
      if (already) logged[item.id] = true
    })
    return logged
  }, [recurringExpenses, transactions, thisMonth])


  function openAdd() {
    setForm(EMPTY_REC)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(item) {
    setForm({ name: item.name, amount: String(item.amount), category: item.category, billingDay: item.billingDay ?? '' })
    setEditId(item.id)
    setShowForm(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.name || isNaN(amount) || amount <= 0) return
    const payload = { name: form.name, amount, category: form.category, billingDay: form.billingDay ? parseInt(form.billingDay) : null }
    if (editId) updateRecurring(editId, payload)
    else addRecurring(payload)
    setShowForm(false)
    setForm(EMPTY_REC)
    setEditId(null)
  }

  function cancel() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_REC)
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      {recurringExpenses.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-surface-elevated border border-surface-border px-4 py-3">
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <RefreshCw size={14} className="text-indigo-400" />
            <span>{recurringExpenses.length} recurring item{recurringExpenses.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Monthly total</p>
            <p className="text-sm font-semibold text-white">{formatCurrency(total)}</p>
          </div>
        </div>
      )}

      {/* List */}
      {recurringExpenses.length > 0 && !showForm && (
        <div className="rounded-lg border border-surface-border overflow-hidden">
          {recurringExpenses.map((item, i) => (
            <div key={item.id} className={clsx('flex items-center justify-between px-4 py-3 group hover:bg-surface-elevated transition-colors', i > 0 && 'border-t border-surface-border')}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl leading-none">{EMOJI_MAP[item.category] ?? '📦'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-500">
                    {item.category}{item.billingDay ? ` · Bills on the ${item.billingDay}${['th','st','nd','rd'][[11,12,13].includes(item.billingDay%100)?0:item.billingDay%10 < 4 ? item.billingDay%10 : 0] ?? 'th'}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-sm font-semibold tabular-nums text-white">{formatCurrency(item.amount)}<span className="text-xs font-normal text-zinc-500">/mo</span></p>
                {/* Log status */}
                {loggedThisMonth[item.id]
                  ? <span className="flex items-center gap-1 text-xs text-zinc-500"><Check size={12} /> This month</span>
                  : item.billingDay
                    ? <span className="text-xs text-zinc-600">Bills on {item.billingDay}th</span>
                    : null
                }
                <div className="hidden group-hover:flex items-center gap-1">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => deleteRecurring(item.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {recurringExpenses.length === 0 && !showForm && (
        <div className="py-10 text-center">
          <RefreshCw size={28} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-sm text-zinc-500">No recurring expenses yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Add rent, subscriptions, utilities, and other fixed monthly costs.</p>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
          <p className="text-sm font-medium text-indigo-300">{editId ? 'Edit recurring expense' : 'New recurring expense'}</p>
          <Input
            label="Name"
            placeholder="e.g. Rent, Netflix, iCloud+"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (NT$)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              required
            />
            <Input
              label="Billing day (optional)"
              type="number"
              min="1"
              max="31"
              placeholder="e.g. 1, 15, 28"
              value={form.billingDay}
              onChange={e => setForm(f => ({ ...f, billingDay: e.target.value }))}
            />
          </div>
          <CategoryPicker value={form.category} onChange={cat => setForm(f => ({ ...f, category: cat }))} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1 justify-center">
              <Check size={14} /> {editId ? 'Save changes' : 'Add'}
            </Button>
            <button type="button" onClick={cancel} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-surface-border hover:bg-surface-elevated transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <Button onClick={openAdd} className="w-full justify-center">
          <Plus size={14} /> Add Recurring Expense
        </Button>
      )}
    </div>
  )
}

// ── Main ImportPage ────────────────────────────────────────────────────────────
export default function ImportPage({ settings, addTransaction, transactions = [], recurringExpenses = [], addRecurring, updateRecurring, deleteRecurring }) {
  const [tab, setTab] = useState('log')

  const TABS = [
    { id: 'log',       label: 'Log Expense' },
    { id: 'recurring', label: 'Recurring' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Expenses</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Log spending and manage recurring bills</p>
      </div>

      <Card>
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-surface-border pb-4">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === id
                  ? 'bg-indigo-500/15 text-indigo-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-elevated',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'log' && (
          <ManualEntryTab
            settings={settings}
            addTransaction={addTransaction}
            transactions={transactions}
          />
        )}
        {tab === 'recurring' && (
          <RecurringTab
            recurringExpenses={recurringExpenses}
            addRecurring={addRecurring}
            updateRecurring={updateRecurring}
            deleteRecurring={deleteRecurring}
            transactions={transactions}
          />
        )}
      </Card>
    </div>
  )
}
