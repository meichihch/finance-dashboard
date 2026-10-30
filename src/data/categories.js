// ── Subcategories ──────────────────────────────────────────────────────────────
// group must match a BUDGET_GROUPS name for spending to roll up correctly
export const CATEGORIES = [
  // Essential Needs
  { name: 'Food & Dining',    emoji: '🍔', group: 'Essential Needs' },
  { name: 'Groceries',        emoji: '🛒', group: 'Essential Needs' },
  { name: 'Transportation',   emoji: '🚗', group: 'Essential Needs' },
  { name: 'Rent',             emoji: '🏘️', group: 'Essential Needs' },
  { name: 'Household',        emoji: '🏠', group: 'Essential Needs' },
  { name: 'Electricity',      emoji: '⚡', group: 'Essential Needs' },
  { name: 'Water',            emoji: '💧', group: 'Essential Needs' },
  { name: 'Gas',              emoji: '🔥', group: 'Essential Needs' },
  { name: 'Internet & Phone', emoji: '📶', group: 'Essential Needs' },
  { name: 'Mobile',           emoji: '📱', group: 'Essential Needs' },
  { name: 'Credit Card',      emoji: '💳', group: 'Essential Needs' },
  { name: 'Insurance',        emoji: '🛡️', group: 'Essential Needs' },
  { name: 'Medical',          emoji: '🏥', group: 'Essential Needs' },
  // Wants & Lifestyle
  { name: 'Apparel',           emoji: '👗', group: 'Wants & Lifestyle' },
  { name: 'Skincare',          emoji: '✨', group: 'Wants & Lifestyle' },
  { name: 'Beauty & Grooming', emoji: '💄', group: 'Wants & Lifestyle' },
  { name: 'Entertainment',     emoji: '🎬', group: 'Wants & Lifestyle' },
  { name: 'Hobbies',           emoji: '🎮', group: 'Wants & Lifestyle' },
  { name: 'Travel',            emoji: '✈️', group: 'Wants & Lifestyle' },
  { name: 'Donation',          emoji: '🤝', group: 'Wants & Lifestyle' },
  // Health & Future
  { name: 'Supplements',      emoji: '💊', group: 'Health & Future' },
  { name: 'Education',        emoji: '📚', group: 'Health & Future' },
  { name: 'Future',           emoji: '🔮', group: 'Health & Future' },
  { name: 'Physical Therapy', emoji: '🧘', group: 'Health & Future' },
  { name: 'Gym',              emoji: '🏋️', group: 'Health & Future' },
  { name: 'Dental',           emoji: '🦷', group: 'Health & Future' },
  { name: 'Healthcare',       emoji: '🩺', group: 'Health & Future' },
  { name: 'Work Investment',  emoji: '💻', group: 'Health & Future' },
  // Income
  { name: 'Salary',            emoji: '💼', group: 'Income' },
  { name: 'Cash',              emoji: '💵', group: 'Income' },
  { name: 'Bonus',             emoji: '🎁', group: 'Income' },
  { name: 'Investment Return', emoji: '💹', group: 'Income' },
  { name: 'Side Hustle',       emoji: '🪙', group: 'Income' },
  { name: 'Refund',            emoji: '💸', group: 'Income' },
  { name: 'Other Income',      emoji: '🎯', group: 'Income' },
  // Other
  { name: 'Other',            emoji: '📦', group: 'Other' },
]

// Income subcategory names — used to identify income transactions
export const INCOME_CATEGORIES = [
  'Salary', 'Cash', 'Bonus', 'Investment Return', 'Side Hustle', 'Refund', 'Other Income',
]
export const INCOME_CATEGORY_SET = new Set(INCOME_CATEGORIES)

// ── Budget groups (top-level buckets for the Budget page) ─────────────────────
export const BUDGET_GROUPS = [
  { name: 'Essential Needs',   emoji: '🏡', color: '#6366f1', defaultLimit: 54000 },
  { name: 'Wants & Lifestyle', emoji: '🎯', color: '#f59e0b', defaultLimit: 18000 },
  { name: 'Health & Future',   emoji: '🌱', color: '#10b981', defaultLimit: 18000 },
]

// Income group — separate from BUDGET_GROUPS since income isn't budgeted/limited
export const INCOME_GROUP = { name: 'Income', emoji: '💰', color: '#22c55e' }

export const CATEGORY_NAMES   = CATEGORIES.map(c => c.name)
export const EMOJI_MAP        = Object.fromEntries(CATEGORIES.map(c => [c.name, c.emoji]))
// Maps subcategory → budget group name (for spending roll-up)
export const GROUP_MAP        = Object.fromEntries(CATEGORIES.map(c => [c.name, c.group]))
// Maps budget group name → emoji
export const GROUP_EMOJI_MAP  = Object.fromEntries(BUDGET_GROUPS.map(g => [g.name, g.emoji]))
