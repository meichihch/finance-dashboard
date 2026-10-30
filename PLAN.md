# Plan: Day / Month / Year View for Budget Page

## What changes
Only `BudgetPage.jsx` needs to be modified.

---

## 1. New local state
```
viewMode  : 'day' | 'month' | 'year'   (default 'month')
viewDate  : string                       (default settings.currentMonth)
  - day   → 'YYYY-MM-DD'
  - month → 'YYYY-MM'
  - year  → 'YYYY'
```

## 2. View-switcher + navigator UI (below page title)
```
[←]   [Day]  [Month]  [Year]   [→]
           "March 2026"
```
- Three pill buttons to switch mode
- Prev/next arrows navigate within the current mode
- Label shows the current period in human-readable form

## 3. datePrefix (replaces currentMonth everywhere)
All transaction filtering uses `tx.date.startsWith(datePrefix)`.
- Day   → full `YYYY-MM-DD`
- Month → `YYYY-MM`
- Year  → `YYYY`

## 4. Per-mode data logic

### Budget categories (`monthCategories`)
- Day   → use the month that contains the day (`viewDate.slice(0,7)`)
- Month → exact match `c.month === viewDate` (current behaviour)
- Year  → all categories whose month starts with `viewDate` (aggregate)

### Total budget
- Day   → daily share = monthly limit ÷ days-in-month
- Month → sum of limits (current behaviour)
- Year  → sum of all category limits for that year

### Charts
- Day/Month → existing pie + "Budget vs Spent" bar (no change)
- Year      → existing pie + replace bar chart with **Monthly Spending Trend**
              (12 bars Jan–Dec showing total spent per month)

### Stats subtitles
- "X transactions today / this month / this year"

### Transaction list
- Filter `tx.date.startsWith(datePrefix)` (one-line change)
- Limit raised to 50 for year view

## 5. Navigation helpers
```
navigate(+1/-1):
  day   → add/subtract 1 day
  month → add/subtract 1 month
  year  → add/subtract 1 year

switchMode(newMode):
  month→day   : set viewDate to first day of current month
  month→year  : strip to YYYY
  day→month   : strip to YYYY-MM
  year→month  : set to YYYY-01
  day→year    : strip to YYYY
  year→day    : set to YYYY-01-01
```

## 6. No other files need changing
Store, App.jsx, ImportPage, categories, formatters — all untouched.
