#!/usr/bin/env node
// Uploads the portfolio's monthly investment totals to Supabase so the hosted
// site (phone) shows the same Stock Investment figures as the Mac.
//
//   npm run push-investments
//
// Uses the same calculation as the local /api/investments, and signs in as you
// (FINANCE_EMAIL / FINANCE_PASSWORD in .env.local), so Row Level Security
// applies as usual — no admin key on disk.

import { createClient } from '@supabase/supabase-js'
import { buildPayload } from '../vite-plugins/investments-api.js'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, FINANCE_EMAIL: email, FINANCE_PASSWORD: password } = process.env
const missing = Object.entries({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, FINANCE_EMAIL: email, FINANCE_PASSWORD: password })
  .filter(([, v]) => !v).map(([k]) => k)
if (missing.length) {
  console.error(`push-investments: missing ${missing.join(', ')} in .env.local`)
  process.exit(1)
}

const payload = buildPayload()
const supabase = createClient(url, key, { auth: { persistSession: false } })

const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
if (signInError) { console.error('push-investments: sign-in failed —', signInError.message); process.exit(1) }
const userId = auth.user.id

const rows = Object.entries(payload.months).map(([month, amount]) => ({
  user_id: userId, month, amount_twd: amount, accounts: payload.accounts[month] ?? {},
}))

const upserted = await supabase.from('investment_months').upsert(rows, { onConflict: 'user_id,month' })
if (upserted.error) { console.error('push-investments:', upserted.error.message); process.exit(1) }

// Drop months that no longer exist in the ledger (e.g. a lot was deleted)
const keep = rows.map(r => r.month)
const pruned = keep.length
  ? await supabase.from('investment_months').delete().eq('user_id', userId).not('month', 'in', `(${keep.map(m => `"${m}"`).join(',')})`)
  : await supabase.from('investment_months').delete().eq('user_id', userId)
if (pruned.error) { console.error('push-investments:', pruned.error.message); process.exit(1) }

const meta = await supabase.from('investment_meta').upsert({
  user_id: userId, budget_twd: payload.budget, fx_twd: payload.fx.twdPerUsd,
  fx_as_of: payload.fx.asOf, synced_at: new Date().toISOString(),
})
if (meta.error) { console.error('push-investments:', meta.error.message); process.exit(1) }

const total = rows.reduce((s, r) => s + r.amount_twd, 0)
console.log(`push-investments: ${rows.length} months, NT$${total.toLocaleString()} total, budget NT$${payload.budget?.toLocaleString() ?? '—'}`)
await supabase.auth.signOut()
