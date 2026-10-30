import { useState, useEffect } from 'react'
import { supabase, cloudEnabled } from '../lib/supabase'

// Month -> TWD actually invested. `ready` stays false until the read settles so
// the UI can avoid flashing a bogus "0 invested" before the real numbers land.
//
// Local mode reads the portfolio ledger live on the Mac (/api/investments).
// Cloud mode reads what update.command last uploaded to Supabase, since the
// hosted site can't see the Mac's files. `budget` is portfolio/budget.csv's
// monthly figure either way, so the goal amount can't drift from the portfolio.
const EMPTY = { months: {}, accounts: {}, budget: null, fx: null }

async function fromApi() {
  const r = await fetch('/api/investments')
  const body = await r.json()
  if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`)
  return { months: body.months ?? {}, accounts: body.accounts ?? {}, budget: body.budget ?? null, fx: body.fx ?? null }
}

async function fromCloud() {
  const [months, meta] = await Promise.all([
    supabase.from('investment_months').select('month, amount_twd, accounts'),
    supabase.from('investment_meta').select('budget_twd, fx_twd, fx_as_of, synced_at').maybeSingle(),
  ])
  if (months.error) throw new Error(months.error.message)
  if (meta.error) throw new Error(meta.error.message)
  // Nothing uploaded yet: report it as unavailable rather than "NT$0 invested"
  if (!meta.data) throw new Error('No investment data synced from the Mac yet')
  return {
    months: Object.fromEntries(months.data.map(r => [r.month, Number(r.amount_twd)])),
    accounts: Object.fromEntries(months.data.map(r => [r.month, r.accounts ?? {}])),
    budget: meta.data.budget_twd != null ? Number(meta.data.budget_twd) : null,
    fx: { twdPerUsd: Number(meta.data.fx_twd), asOf: meta.data.fx_as_of, syncedAt: meta.data.synced_at },
  }
}

export function useInvestmentActuals() {
  const [state, setState] = useState({ ...EMPTY, ready: false, error: null })

  useEffect(() => {
    let cancelled = false
    ;(cloudEnabled ? fromCloud() : fromApi())
      .then(data => { if (!cancelled) setState({ ...data, ready: true, error: null }) })
      .catch(err => { if (!cancelled) setState({ ...EMPTY, ready: true, error: String(err.message ?? err) }) })
    return () => { cancelled = true }
  }, [])

  return state
}
