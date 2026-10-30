import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react'
import clsx from 'clsx'
import { Card, SectionHeader } from '../components/ui'
import { formatCurrency, formatMonthYear } from '../utils/formatters'
import { EMOJI_MAP, GROUP_MAP, GROUP_EMOJI_MAP, INCOME_CATEGORY_SET } from '../data/categories'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-400 font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage({ transactions, budgetCategories, settings }) {
  const _now = new Date()
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const thisMonth = today.slice(0, 7)
  const thisYear = String(_now.getFullYear())

  const [viewMode, setViewMode] = useState('month')
  const [viewDate, setViewDate] = useState(thisMonth)

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

  const isCurrentPeriod =
    (viewMode === 'day' && viewDate === today) ||
    (viewMode === 'month' && viewDate === thisMonth) ||
    (viewMode === 'year' && viewDate === thisYear)

  // ── Period totals ───────────────────────────────────────────────────────────
  const datePrefix = viewDate

  const periodTotals = useMemo(() => {
    let income = 0
    let spent = 0
    const incomeBySource = {}
    const spendByCategory = {}
    transactions.forEach(tx => {
      if (tx.hidden) return
      if (!tx.date.startsWith(datePrefix)) return
      const amt = Math.abs(tx.amountTWD ?? tx.amount)
      if (tx.amount > 0 && INCOME_CATEGORY_SET.has(tx.category)) {
        income += amt
        incomeBySource[tx.category] = (incomeBySource[tx.category] ?? 0) + amt
      } else if (tx.amount < 0) {
        spent += amt
        const group = GROUP_MAP[tx.category] ?? tx.category
        spendByCategory[group] = (spendByCategory[group] ?? 0) + amt
      }
    })
    return { income, spent, incomeBySource, spendByCategory }
  }, [transactions, datePrefix])

  const net = periodTotals.income - periodTotals.spent
  const savingsRate = periodTotals.income > 0 ? (net / periodTotals.income) * 100 : null

  // ── 6-month cash flow trend ─────────────────────────────────────────────────
  const cashFlowTrend = useMemo(() => {
    const result = []
    // Anchor: viewMode determines anchor month
    const [anchorY, anchorM] = (() => {
      if (viewMode === 'day' || viewMode === 'month') {
        const monthStr = viewMode === 'day' ? viewDate.slice(0, 7) : viewDate
        const [y, m] = monthStr.split('-').map(Number)
        return [y, m]
      }
      // year view: anchor on December of that year
      return [Number(viewDate), 12]
    })()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anchorY, anchorM - 1 - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const monthPrefix = `${y}-${String(m).padStart(2, '0')}`
      let income = 0
      let spent = 0
      transactions.forEach(tx => {
        if (tx.hidden) return
        if (!tx.date.startsWith(monthPrefix)) return
        const amt = Math.abs(tx.amountTWD ?? tx.amount)
        if (tx.amount > 0 && INCOME_CATEGORY_SET.has(tx.category)) income += amt
        else if (tx.amount < 0) spent += amt
      })
      result.push({ name: `${MONTH_NAMES[m - 1]}${i >= 0 && y !== anchorY ? ` ${String(y).slice(-2)}` : ''}`, Income: income, Spent: spent })
    }
    return result
  }, [transactions, viewMode, viewDate])

  // ── Top lists ───────────────────────────────────────────────────────────────
  const topIncomeSources = Object.entries(periodTotals.incomeBySource).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topSpendCategories = Object.entries(periodTotals.spendByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Financial Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{periodLabel()}</p>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-card px-3 py-1.5">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-0.5">
            {['day', 'month', 'year'].map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={clsx(
                  'px-3 py-1 rounded text-xs font-medium transition-colors capitalize',
                  viewMode === m
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-elevated',
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate(+1)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={() => { setViewMode('month'); setViewDate(thisMonth) }}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isCurrentPeriod ? `Current ${viewMode}` : `Jump to today`}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Income</p>
            <TrendingUp size={14} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{formatCurrency(periodTotals.income)}</p>
          <p className="text-xs text-emerald-400/70 mt-1">{Object.keys(periodTotals.incomeBySource).length} source{Object.keys(periodTotals.incomeBySource).length !== 1 ? 's' : ''}</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Spent</p>
            <TrendingDown size={14} className="text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{formatCurrency(periodTotals.spent)}</p>
          <p className="text-xs text-zinc-500 mt-1">{Object.keys(periodTotals.spendByCategory).length} categor{Object.keys(periodTotals.spendByCategory).length !== 1 ? 'ies' : 'y'}</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Net Cash Flow</p>
            <Wallet size={14} className={net >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          </div>
          <p className={clsx('text-2xl font-bold tabular-nums', net >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
          </p>
          <p className="text-xs text-zinc-500 mt-1">{net >= 0 ? 'Saved this period' : 'Overspent this period'}</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Savings Rate</p>
            <PiggyBank size={14} className="text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {savingsRate === null ? '—' : `${savingsRate.toFixed(0)}%`}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {savingsRate === null ? 'No income logged' : savingsRate >= 20 ? 'Healthy' : savingsRate >= 0 ? 'Could improve' : 'Spending exceeds income'}
          </p>
        </Card>
      </div>

      {/* Cash flow trend chart */}
      <Card>
        <SectionHeader title="Cash Flow Trend" subtitle="Last 6 months — income vs spending" />
        <div className="mt-4" style={{ height: 280 }}>
          {cashFlowTrend.every(d => d.Income === 0 && d.Spent === 0) ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-zinc-600">No data yet — start logging income and expenses</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#3f3f50" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <ReTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="Income" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Spent" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Top lists row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Income Sources */}
        <Card>
          <SectionHeader title="Top Income Sources" subtitle={`This ${viewMode}`} />
          {topIncomeSources.length === 0 ? (
            <p className="text-sm text-zinc-600 py-6 text-center">No income logged this period</p>
          ) : (
            <div className="mt-3 space-y-1">
              {topIncomeSources.map(([cat, total]) => {
                const pct = periodTotals.income > 0 ? (total / periodTotals.income) * 100 : 0
                return (
                  <div key={cat} className="relative flex items-center justify-between px-2 py-2.5 rounded-lg overflow-hidden hover:bg-surface-elevated transition-colors">
                    <div className="absolute left-0 top-0 h-full bg-emerald-500/10 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    <span className="relative z-10 flex items-center gap-2 text-sm text-zinc-300">
                      <span>{EMOJI_MAP[cat] ?? '💰'}</span>{cat}
                    </span>
                    <div className="relative z-10 flex items-center gap-2.5">
                      <span className="text-[10px] tabular-nums text-emerald-400/60">{pct.toFixed(0)}%</span>
                      <span className="text-sm font-semibold tabular-nums text-white w-24 text-right">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Top Spending Categories */}
        <Card>
          <SectionHeader title="Top Spending Categories" subtitle={`This ${viewMode}`} />
          {topSpendCategories.length === 0 ? (
            <p className="text-sm text-zinc-600 py-6 text-center">No spending logged this period</p>
          ) : (
            <div className="mt-3 space-y-1">
              {topSpendCategories.map(([cat, total]) => {
                const pct = periodTotals.spent > 0 ? (total / periodTotals.spent) * 100 : 0
                return (
                  <div key={cat} className="relative flex items-center justify-between px-2 py-2.5 rounded-lg overflow-hidden hover:bg-surface-elevated transition-colors">
                    <div className="absolute left-0 top-0 h-full bg-rose-500/10 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    <span className="relative z-10 flex items-center gap-2 text-sm text-zinc-300">
                      <span>{GROUP_EMOJI_MAP[cat] ?? EMOJI_MAP[cat] ?? '📦'}</span>{cat}
                    </span>
                    <div className="relative z-10 flex items-center gap-2.5">
                      <span className="text-[10px] tabular-nums text-rose-400/60">{pct.toFixed(0)}%</span>
                      <span className="text-sm font-semibold tabular-nums text-white w-24 text-right">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
