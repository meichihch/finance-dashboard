const CURRENCY_CONFIG = {
  TWD: { locale: 'en-US', currency: 'TWD', decimals: 0 },
  USD: { locale: 'en-US', currency: 'USD', decimals: 2 },
  EUR: { locale: 'de-DE', currency: 'EUR', decimals: 2 },
  JPY: { locale: 'ja-JP', currency: 'JPY', decimals: 0 },
  GBP: { locale: 'en-GB', currency: 'GBP', decimals: 2 },
}

// Supports both:
//   formatCurrency(amount)              → NT$54,000  (TWD)
//   formatCurrency(amount, 'USD')       → $32.50
//   formatCurrency(amount, true)        → legacy compact mode (TWD)
export function formatCurrency(amount, currencyOrCompact = 'TWD', compact = false) {
  let currency = 'TWD'
  let isCompact = compact
  if (typeof currencyOrCompact === 'boolean') {
    isCompact = currencyOrCompact
  } else if (typeof currencyOrCompact === 'string') {
    currency = currencyOrCompact
  }
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.TWD
  if (isCompact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency: cfg.currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.currency,
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  }).format(amount)
}

export function formatPercent(value, decimals = 1) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMonthYear(dateStr) {
  const [year, month] = dateStr.split('-')
  return new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

export function getChangeColor(value) {
  if (value > 0) return 'text-emerald-400'
  if (value < 0) return 'text-red-400'
  return 'text-zinc-400'
}

export function getChangeColorBg(value) {
  if (value > 0) return 'bg-emerald-500/10 text-emerald-400'
  if (value < 0) return 'bg-red-500/10 text-red-400'
  return 'bg-zinc-500/10 text-zinc-400'
}
