import { useState, useEffect } from 'react'
import { supabase, cloudEnabled } from '../lib/supabase'

// Signed-in Supabase user. In local mode there is no account, so it's "ready"
// straight away with no user.
export function useAuth() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!cloudEnabled)

  useEffect(() => {
    if (!cloudEnabled) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return {
    ready,
    user: session?.user ?? null,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }
}
