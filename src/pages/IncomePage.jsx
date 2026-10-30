import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { Plus, Check, Pencil, Trash2, RefreshCw, TrendingUp, ChevronDown, Eye, EyeOff, History } from 'lucide-react'
import { Card, Button, Input, Select, Modal } from '../components/ui'
import { CATEGORIES, EMOJI_MAP, INCOME_CATEGORIES } from '../data/categories'
import { formatCurrency } from '../utils/formatters'

const INCOME_CATS = CATEGORIES.filter(c => c.group === 'Income')

function IncomeCategoryPicker({ value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-zinc-400">Income source</label>
      <div className="grid grid-cols-4 gap-1.5">
        {INCOME_CATS.map(cat => (
          <button
            key={cat.name}
            type="button"
            onClick={() => onChange(cat.name)}
            className={clsx(
              'flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition-colors',
              value === cat.name
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'bg-surface-elevated border border-transparent text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
            )}
          >
            <span className="text-lg leading-none">{cat.emoji}</span>
            <span className="text-[10px] leading-tight">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Log Income Form ───────────────────────────────────────────────────────────
function IncomeForm({ onSave, transactions = [] }) {
  const [form, setForm] = useState({
    date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })(),
    description: '',
    amount: '',
    category: 'Salary',
  })
  const [saved, setSaved] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  function handleDescriptionChange(e) {
    const val = e.target.value
    setForm(f => ({ ...f, description: val }))
    if (val.length < 1) { setSuggestions([]); setShowSuggestions(false); return }
    const lower = val.toLowerCase()
    const freq = {}
    transactions
      .filter(tx => tx.amount > 0 && INCOME_CATEGORIES.includes(tx.category))
      .forEach(tx => { const k = tx.description.toLowerCase(); freq[k] = (freq[k] ?? 0) + 1 })
    const seen = new Set()
    const matches = transactions
      .filter(tx => tx.amount > 0)
      .map(tx => tx.description)
      .filter(d => d && d.toLowerCase().includes(lower) && !seen.has(d.toLowerCase()) && seen.add(d.toLowerCase()))
      .sort((a, b) => (freq[b.toLowerCase()] ?? 0) - (freq[a.toLowerCase()] ?? 0))
      .slice(0, 5)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  function selectSuggestion(desc) {
    const match = transactions.find(tx => tx.description === desc && tx.amount > 0)
    const bestCat = match?.category
    setForm(f => ({ ...f, description: desc, ...(bestCat ? { category: bestCat } : {}) }))
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const raw = parseFloat(form.amount)
    if (isNaN(raw) || raw <= 0) return
    onSave({
      date: form.date,
      description: form.description,
      amount: raw,            // positive — income
      category: form.category,
    })
    setForm(f => ({ ...f, description: '', amount: '' }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
        <label className="block text-xs font-medium text-zinc-400">Source</label>
        <input
          className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          placeholder="e.g. Acme Inc payroll, side project, gift from Mom"
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

      <IncomeCategoryPicker value={form.category} onChange={cat => setForm(f => ({ ...f, category: cat }))} />

      <Button type="submit" className="w-full justify-center mt-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30">
        {saved
          ? <><Check size={14} /> Income saved!</>
          : <><Plus size={14} /> Add Income</>}
      </Button>
    </form>
  )
}

// ── Recurring Income Tab ──────────────────────────────────────────────────────
const EMPTY_REC = { name: '', amount: '', category: 'Salary', payDay: '' }

function RecurringIncomeTab({ recurringIncomes, addRecurringIncome, updateRecurringIncome, deleteRecurringIncome, transactions }) {
  const [form, setForm] = useState(EMPTY_REC)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const total = recurringIncomes.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  const loggedThisMonth = useMemo(() => {
    const logged = {}
    recurringIncomes.forEach(item => {
      const already = transactions.some(tx =>
        tx.description === item.name &&
        tx.category === item.category &&
        tx.date.startsWith(thisMonth)
      )
      if (already) logged[item.id] = true
    })
    return logged
  }, [recurringIncomes, transactions, thisMonth])

  function openAdd() {
    setForm(EMPTY_REC)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(item) {
    setForm({ name: item.name, amount: String(item.amount), category: item.category, payDay: item.payDay ?? '' })
    setEditId(item.id)
    setShowForm(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.name || isNaN(amount) || amount <= 0) return
    const payload = { name: form.name, amount, category: form.category, payDay: form.payDay ? parseInt(form.payDay) : null }
    if (editId) updateRecurringIncome(editId, payload)
    else addRecurringIncome(payload)
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
      {recurringIncomes.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
          <div className="flex items-center gap-2 text-emerald-300 text-sm">
            <RefreshCw size={14} />
            <span>{recurringIncomes.length} recurring income{recurringIncomes.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-300/60">Monthly total</p>
            <p className="text-sm font-semibold text-white">{formatCurrency(total)}</p>
          </div>
        </div>
      )}

      {/* List */}
      {recurringIncomes.length > 0 && !showForm && (
        <div className="rounded-lg border border-surface-border overflow-hidden">
          {recurringIncomes.map((item, i) => (
            <div key={item.id} className={clsx('flex items-center justify-between px-4 py-3 group hover:bg-surface-elevated transition-colors', i > 0 && 'border-t border-surface-border')}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl leading-none">{EMOJI_MAP[item.category] ?? '💰'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-500">
                    {item.category}{item.payDay ? ` · Pays on the ${item.payDay}${['th', 'st', 'nd', 'rd'][[11, 12, 13].includes(item.payDay % 100) ? 0 : item.payDay % 10 < 4 ? item.payDay % 10 : 0] ?? 'th'}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-sm font-semibold tabular-nums text-white">+{formatCurrency(item.amount)}<span className="text-xs font-normal text-zinc-500">/mo</span></p>
                {loggedThisMonth[item.id]
                  ? <span className="flex items-center gap-1 text-xs text-emerald-400/80"><Check size={12} /> This month</span>
                  : item.payDay
                    ? <span className="text-xs text-zinc-600">Pays on {item.payDay}th</span>
                    : null
                }
                <div className="hidden group-hover:flex items-center gap-1">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => deleteRecurringIncome(item.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {recurringIncomes.length === 0 && !showForm && (
        <div className="py-10 text-center">
          <RefreshCw size={28} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-sm text-zinc-500">No recurring income yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Add salary, freelance retainers, or other regular income.</p>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-300">{editId ? 'Edit recurring income' : 'New recurring income'}</p>
          <Input
            label="Name"
            placeholder="e.g. Acme Inc Payroll, Freelance Retainer"
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
              label="Pay day (optional)"
              type="number"
              min="1"
              max="31"
              placeholder="e.g. 5, 15, 25"
              value={form.payDay}
              onChange={e => setForm(f => ({ ...f, payDay: e.target.value }))}
            />
          </div>
          <IncomeCategoryPicker value={form.category} onChange={cat => setForm(f => ({ ...f, category: cat }))} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1 justify-center bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30">
              <Check size={14} /> {editId ? 'Save changes' : 'Add'}
            </Button>
            <button type="button" onClick={cancel} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-surface-border hover:bg-surface-elevated transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <Button onClick={openAdd} className="w-full justify-center bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30">
          <Plus size={14} /> Add Recurring Income
        </Button>
      )}
    </div>
  )
}

// ── History Tab ────────────────────────────────────────────────────────────────
function HistoryTab({ transactions, updateTransaction, deleteTransaction }) {
  const [catFilter, setCatFilter] = useState('All')
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [editTx, setEditTx] = useState(null)
  const [txForm, setTxForm] = useState({})

  const incomeTx = useMemo(
    () => transactions.filter(tx => tx.amount > 0 && INCOME_CATEGORIES.includes(tx.category)),
    [transactions]
  )

  const catTotals = useMemo(() => {
    const map = {}
    incomeTx.filter(tx => !tx.hidden).forEach(tx => {
      map[tx.category] = (map[tx.category] ?? 0) + (tx.amountTWD ?? tx.amount)
    })
    return map
  }, [incomeTx])

  const summaryRows = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
  const grandTotal = summaryRows.reduce((s, [, v]) => s + v, 0)

  const visibleTx = incomeTx
    .filter(tx => catFilter === 'All' || tx.category === catFilter)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (incomeTx.length === 0) {
    return (
      <div className="py-10 text-center">
        <History size={28} className="mx-auto mb-3 text-zinc-700" />
        <p className="text-sm text-zinc-500">No income logged yet.</p>
        <p className="text-xs text-zinc-600 mt-1">Entries you log or that auto-log from recurring income will show up here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">{incomeTx.length} income entr{incomeTx.length !== 1 ? 'ies' : 'y'}</p>
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          className="rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="All">All Sources</option>
          {INCOME_CATS.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
        </select>
      </div>

      {/* Summary by source */}
      {catFilter === 'All' && summaryRows.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/25 overflow-hidden">
          <button
            type="button"
            onClick={() => setSummaryOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-emerald-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Income Summary</span>
              <span className="text-[10px] text-emerald-400/60 tabular-nums">{summaryRows.length} sources</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold tabular-nums text-emerald-300">{formatCurrency(grandTotal)}</span>
              <ChevronDown size={13} className={clsx("text-emerald-400/60 transition-transform duration-200", !summaryOpen && "-rotate-90")} />
            </div>
          </button>
          {summaryOpen && (
            <div className="border-t border-emerald-500/15">
              {summaryRows.map(([cat, total]) => {
                const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
                return (
                  <div
                    key={cat}
                    onClick={() => setCatFilter(cat)}
                    className="relative flex items-center justify-between px-3 py-2.5 border-b border-emerald-500/10 last:border-0 cursor-pointer overflow-hidden hover:brightness-125 transition-all"
                  >
                    <div className="absolute left-0 top-0 h-full bg-emerald-500/10 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    <span className="relative z-10 flex items-center gap-1.5 text-xs text-zinc-300">
                      <span>{EMOJI_MAP[cat] ?? '💰'}</span>{cat}
                    </span>
                    <div className="relative z-10 flex items-center gap-2.5">
                      <span className="text-[10px] tabular-nums text-emerald-400/60">{pct.toFixed(0)}%</span>
                      <span className="text-xs font-semibold tabular-nums text-white w-24 text-right">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-1">
        {visibleTx.map(tx => (
          <div key={tx.id} className={clsx('flex items-center justify-between py-2 px-2 rounded-lg hover:bg-surface-elevated transition-colors group', tx.hidden && 'opacity-50')}>
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">{EMOJI_MAP[tx.category] ?? '💰'}</span>
              <div>
                <p className={clsx('text-sm leading-tight', tx.hidden ? 'line-through text-zinc-500' : 'text-zinc-200')}>{tx.description}</p>
                <p className="text-xs text-zinc-600 leading-tight">{tx.date} · {tx.category}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className={clsx('text-sm font-semibold tabular-nums', tx.hidden ? 'line-through text-zinc-500' : 'text-white')}>
                +{formatCurrency(tx.amountTWD ?? tx.amount)}
              </p>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => updateTransaction(tx.id, { hidden: !tx.hidden })}
                  title={tx.hidden ? 'Include in totals' : 'Exclude from totals'}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    tx.hidden ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100'
                  )}
                >
                  {tx.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  onClick={() => { setEditTx(tx); setTxForm({ date: tx.date, description: tx.description, amount: String(tx.amount), category: tx.category }) }}
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

      {/* Edit modal */}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Edit Income">
        <form onSubmit={e => {
          e.preventDefault()
          const raw = parseFloat(txForm.amount)
          if (isNaN(raw) || raw <= 0) return
          updateTransaction(editTx.id, {
            date: txForm.date,
            description: txForm.description,
            amount: raw,
            category: txForm.category,
          })
          setEditTx(null)
        }} className="space-y-4">
          <Input label="Date" type="date" value={txForm.date ?? ''} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} required />
          <Input label="Source" placeholder="e.g. Acme Inc payroll" value={txForm.description ?? ''} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} required />
          <Input label="Amount (NT$)" type="number" step="0.01" min="0.01" value={txForm.amount ?? ''} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} required />
          <Select label="Category" value={txForm.category ?? ''} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}>
            {INCOME_CATS.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditTx(null)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Main IncomePage ───────────────────────────────────────────────────────────
export default function IncomePage({ settings, addTransaction, transactions = [], recurringIncomes = [], addRecurringIncome, updateRecurringIncome, deleteRecurringIncome, updateTransaction, deleteTransaction }) {
  const [tab, setTab] = useState('log')

  const TABS = [
    { id: 'log',       label: 'Log Income' },
    { id: 'recurring', label: 'Recurring' },
    { id: 'history',   label: 'History' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp size={20} className="text-emerald-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Income</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Log income and manage recurring sources</p>
        </div>
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
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-elevated',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'log' && (
          <IncomeForm onSave={addTransaction} transactions={transactions} />
        )}
        {tab === 'recurring' && (
          <RecurringIncomeTab
            recurringIncomes={recurringIncomes}
            addRecurringIncome={addRecurringIncome}
            updateRecurringIncome={updateRecurringIncome}
            deleteRecurringIncome={deleteRecurringIncome}
            transactions={transactions}
          />
        )}
        {tab === 'history' && (
          <HistoryTab
            transactions={transactions}
            updateTransaction={updateTransaction}
            deleteTransaction={deleteTransaction}
          />
        )}
      </Card>
    </div>
  )
}
