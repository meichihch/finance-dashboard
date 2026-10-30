export const mockData = {
  accounts: [],
  transactions: [],
  budgetCategories: [],
  holdings: [],
  portfolioSnapshots: [],
  netWorthHistory: [],
  settings: {
    anthropicApiKey: '',
    currency: 'TWD',
    currentMonth: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })(),
    exchangeRates: {
      USD: 32.5,
      EUR: 35.5,
      JPY: 0.22,
      GBP: 41.5,
    },
  },
}
