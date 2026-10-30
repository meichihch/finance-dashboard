import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect } from 'react'

export function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx('rounded-xl border border-surface-border bg-surface-card p-5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }) {
  const base = 'inline-flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }
  const variants = {
    primary: 'bg-indigo-500 text-white hover:bg-indigo-400',
    secondary: 'bg-surface-elevated text-zinc-200 hover:bg-zinc-700 border border-surface-border',
    ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-surface-elevated',
    danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
  }
  return (
    <button className={clsx(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  )
}

export function Badge({ value, prefix = '' }) {
  const color = value > 0
    ? 'bg-emerald-500/10 text-emerald-400'
    : value < 0
      ? 'bg-red-500/10 text-red-400'
      : 'bg-zinc-500/10 text-zinc-400'
  const sign = value > 0 ? '+' : ''
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      {prefix}{sign}{value.toFixed(1)}%
    </span>
  )
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative w-full rounded-2xl border border-surface-border bg-surface-card p-6 shadow-2xl', maxWidth)}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-surface-elevated transition-colors">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Input({ label, error, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-zinc-400">{label}</label>}
      <input
        className={clsx(
          'w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600',
          'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500',
          error && 'border-red-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

export function Select({ label, children, className, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-zinc-400">{label}</label>}
      <select
        className={clsx(
          'w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-zinc-100',
          'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export function StatCard({ label, value, sub, subColor }) {
  return (
    <Card>
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className={clsx('text-xs mt-1', subColor ?? 'text-zinc-500')}>{sub}</p>}
    </Card>
  )
}
