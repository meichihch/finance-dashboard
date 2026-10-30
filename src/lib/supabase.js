import { createClient } from '@supabase/supabase-js'

// Cloud mode turns on only when both values are set (in .env.local for the Mac,
// baked into the build for the hosted site). Without them the app keeps its
// original browser-only storage, so nothing breaks before the project exists.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export const cloudEnabled = supabase !== null
