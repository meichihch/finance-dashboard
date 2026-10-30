// ── Monthly savings/investment goals shown as checkable reminders on the Budget page ──
// settingsKey holds the editable amount in settings; defaultAmount is only a placeholder
// until the first edit (the real figures live in your saved settings, not in the code).
export const MONTHLY_GOALS = [
  { id: 'pension',   name: 'Voluntary Pension Contribution', emoji: '🏦', settingsKey: 'pensionGoal',   defaultAmount: 10000 },
  { id: 'emergency', name: 'Emergency Savings',              emoji: '🛟', settingsKey: 'emergencyGoal', defaultAmount: 10000 },
  // tracksActuals: compare against money actually invested, read live from the
  // portfolio lot ledger via /api/investments, instead of a manual checkbox.
  // Its budget also comes from that API (portfolio/budget.csv); defaultAmount is
  // only the fallback when the ledger is unreachable.
  { id: 'stocks',    name: 'Stock Investment',                emoji: '📈', settingsKey: 'stockGoal',     defaultAmount: 20000, tracksActuals: true },
]
