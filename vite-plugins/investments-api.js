// Serves GET /api/investments — NT$ actually invested per month, read fresh from the
// portfolio project's files on every request, so a browser refresh always reflects
// the current portfolio/lots.csv without a build or sync step.
//
// Shares its rules with portfolio/build.py (the "This month" card there). Keep the
// two in step — they must report the same number for the same month.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const PORTFOLIO = resolve(here, '../../portfolio')

// lots.csv `kind` on two axes — held vs paid. Only the "paid" axis matters here:
//   buy       real purchase                      → counts
//   contrib   purchase already inside a snapshot → counts (money did leave the budget)
//   drip      dividend reinvestment              → no cash left the budget
//   snapshot  broker aggregate baseline          → years of buying stamped with one date
const PAID = new Set(['buy', 'contrib'])

function readCsv(path, { required = true } = {}) {
  if (!existsSync(path)) {
    if (required) throw new Error(`missing ${path}`)
    return []
  }
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const cells = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))
  })
}

export function buildPayload() {
  const fxRows = readCsv(resolve(PORTFOLIO, 'fx.csv'))
  const twdRow = fxRows.find(r => r.currency === 'TWD')
  const twdNow = Number(twdRow?.per_usd)
  if (!Number.isFinite(twdNow)) throw new Error('no TWD rate in portfolio/fx.csv')

  // rate on each purchase date, cached by fetch_prices.py: (currency, date) -> per USD
  const lotFx = new Map()
  for (const r of readCsv(resolve(PORTFOLIO, 'lot_fx.csv'), { required: false })) {
    lotFx.set(`${r.currency}|${r.date}`, Number(r.per_usd))
  }

  const budgetRows = readCsv(resolve(PORTFOLIO, 'budget.csv'), { required: false })
  const monthlyTwd = Number(budgetRows.find(r => r.key === 'monthly_twd')?.value)

  const months = {}       // ym -> NT$
  const accounts = {}     // ym -> { account -> NT$ }
  const excluded = { snapshot: 0, drip: 0 }
  let approxLots = 0

  for (const lot of readCsv(resolve(PORTFOLIO, 'lots.csv'))) {
    const kind = (lot.kind || 'buy').toLowerCase()
    if (!PAID.has(kind)) { excluded[kind] = (excluded[kind] ?? 0) + 1; continue }
    const cost = Number(lot.cost_basis)
    if (!Number.isFinite(cost)) continue

    const cur = lot.currency || 'USD'
    let twd
    if (cur === 'TWD') {
      twd = cost
    } else {
      // cost in USD first (its own currency's rate that day), then NT$ at that
      // day's rate — today's rate only until fetch_prices.py has resolved the date
      const own = cur === 'USD' ? 1 : lotFx.get(`${cur}|${lot.open_date}`)
      const t = lotFx.get(`TWD|${lot.open_date}`)
      if (!own) continue
      if (!t) approxLots++
      twd = cost / own * (t ?? twdNow)
    }
    const ym = lot.open_date.slice(0, 7)
    months[ym] = (months[ym] ?? 0) + twd
    const acct = lot.account || '—'
    accounts[ym] ??= {}
    accounts[ym][acct] = (accounts[ym][acct] ?? 0) + twd
  }

  const round = obj => Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, Math.round(v)]),
  )
  return {
    months: round(months),
    accounts: Object.fromEntries(Object.entries(accounts).map(([ym, m]) => [ym, round(m)])),
    budget: Number.isFinite(monthlyTwd) ? monthlyTwd : null,
    fx: { twdPerUsd: twdNow, asOf: twdRow.as_of ?? null },
    source: 'portfolio/lots.csv',
    excluded,
    approxLots,
  }
}

function handler(req, res, next) {
  if (!req.url?.startsWith('/api/investments')) return next()
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store') // a refresh must never serve a stale ledger
  try {
    res.end(JSON.stringify(buildPayload()))
  } catch (err) {
    res.statusCode = 503
    res.end(JSON.stringify({ error: String(err.message ?? err), months: {}, accounts: {}, budget: null }))
  }
}

export function investmentsApi() {
  return {
    name: 'investments-api',
    configureServer(server) { server.middlewares.use(handler) },
    configurePreviewServer(server) { server.middlewares.use(handler) },
  }
}
