import { useState } from 'react'
import {
  PieChart, Upload, LayoutDashboard, TrendingUp,
  Menu, ChevronRight, LogOut,
} from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Financial Dashboard', short: 'Dashboard', icon: LayoutDashboard },
  { id: 'budget',    label: 'Budget',              short: 'Budget',    icon: PieChart },
  { id: 'import',    label: 'Log Expense',         short: 'Expense',   icon: Upload },
  { id: 'income',    label: 'Log Income',          short: 'Income',    icon: TrendingUp },
]

const SYNC_LABEL = {
  loading:  { text: 'Loading…',                         tone: 'text-zinc-500' },
  saving:   { text: 'Saving…',                          tone: 'text-zinc-500' },
  saved:    { text: 'Saved',                            tone: 'text-emerald-400/80' },
  migrated: { text: 'Imported this browser’s data',     tone: 'text-emerald-400/80' },
  conflict: { text: 'Updated on another device — redo your last change', tone: 'text-amber-400' },
  error:    { text: 'Not saved',                        tone: 'text-red-400' },
}

// Only shown in cloud mode; local mode has nothing to report.
function SyncStatus({ cloud, className }) {
  const s = cloud && SYNC_LABEL[cloud.status]
  if (!s) return null
  return <span className={clsx('text-[11px]', s.tone, className)} title={cloud.error ?? undefined}>{s.text}</span>
}

function Sidebar({ page, setPage, collapsed, setCollapsed, cloud, user, signOut }) {
  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col border-r border-surface-border bg-surface-card transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-56',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-surface-border">
        {!collapsed && (
          <span className="font-semibold text-sm text-white tracking-wide">
            FinanceOS
          </span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-surface-elevated transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={clsx(
              'flex items-center gap-3 w-full rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
              page === id
                ? 'bg-indigo-500/15 text-indigo-400'
                : 'text-zinc-400 hover:bg-surface-elevated hover:text-zinc-100',
            )}
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {user && !collapsed && (
        <div className="px-3 py-3 border-t border-surface-border space-y-1.5">
          <SyncStatus cloud={cloud} className="block" />
          <p className="text-[11px] text-zinc-600 truncate" title={user.email}>{user.email}</p>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
            <LogOut size={12} /> Sign out
          </button>
        </div>
      )}
    </aside>
  )
}

// Phone: slim top bar + bottom tab bar instead of the sidebar.
function MobileTopBar({ cloud, user, signOut }) {
  return (
    <header className="md:hidden flex items-center justify-between h-12 px-4 border-b border-surface-border bg-surface-card shrink-0">
      <span className="font-semibold text-sm text-white tracking-wide">FinanceOS</span>
      <div className="flex items-center gap-3">
        <SyncStatus cloud={cloud} />
        {user && (
          <button onClick={signOut} aria-label="Sign out" className="p-1.5 -mr-1.5 text-zinc-500 hover:text-zinc-200">
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  )
}

function MobileTabBar({ page, setPage }) {
  return (
    <nav className="md:hidden grid grid-cols-4 border-t border-surface-border bg-surface-card shrink-0 pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map(({ id, short, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setPage(id)}
          className={clsx(
            'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
            page === id ? 'text-indigo-400' : 'text-zinc-500',
          )}
        >
          <Icon size={18} />
          {short}
        </button>
      ))}
    </nav>
  )
}

export default function Layout({ page, setPage, children, cloud, user, signOut }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface">
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        cloud={cloud}
        user={user}
        signOut={signOut}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar cloud={cloud} user={user} signOut={signOut} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <MobileTabBar page={page} setPage={setPage} />
      </div>
    </div>
  )
}
