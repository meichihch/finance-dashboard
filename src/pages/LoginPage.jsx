import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button, Input } from '../components/ui'

// Sign-in only: the single account is created in the Supabase dashboard and
// public sign-up is switched off there, so there is no "create account" here.
export default function LoginPage({ signIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-surface-border bg-surface-card p-6">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-indigo-400" />
          <h1 className="text-lg font-semibold text-white">FinanceOS</h1>
        </div>
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button type="submit" className="w-full justify-center" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
