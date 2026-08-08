'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth-client'

/**
 * Self-service registration (unified-auth-bootstrap D3).
 *
 * Only reachable/usable when an admin has opened signup to specific email
 * domains (Settings → Domains → "Allow self-registration"). The server-side
 * gate (hooks.before in lib/auth.ts) is the enforcement point; this page reads
 * GET /api/auth/signup-status only to tailor the UI:
 *   - domain-gated: show the form + the permitted domains
 *   - closed:       explain that registration is invite/admin-only
 *   - open:         first-run — point at the owner-setup wizard instead
 */
type SignupStatus = { state: 'open' | 'closed' | 'domain-gated'; allowedDomains?: string[] }

export default function RegisterPage() {
  const router = useRouter()
  const [status, setStatus] = useState<SignupStatus | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/signup-status')
      .then(r => (r.ok ? r.json() : null))
      .then((d: SignupStatus | null) => setStatus(d ?? { state: 'closed' }))
      .catch(() => setStatus({ state: 'closed' }))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await signUp.email({ email, password, name: name || email })
      if (res.error) throw new Error(res.error.message || 'Registration failed')
      router.push('/portal')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="mt-2 text-sm text-slate-400">Register to access the portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 shadow-xl rounded-lg sm:px-10 border border-slate-800">
          {status === null && (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
            </div>
          )}

          {status?.state === 'closed' && (
            <div className="text-sm text-slate-300">
              <p className="font-medium text-slate-100">Registration is closed.</p>
              <p className="mt-2 text-slate-400">
                New accounts on this workspace are created by an administrator or
                by invitation. Ask your admin for an invite link.
              </p>
              <Link href="/portal/login" className="mt-4 inline-block text-brand-400 hover:text-brand-300">
                ← Back to sign in
              </Link>
            </div>
          )}

          {status?.state === 'open' && (
            <div className="text-sm text-slate-300">
              <p className="font-medium text-slate-100">This workspace isn&apos;t set up yet.</p>
              <p className="mt-2 text-slate-400">
                The first account becomes the owner. Continue to first-time setup.
              </p>
              <Link href="/portal/setup" className="mt-4 inline-block text-brand-400 hover:text-brand-300">
                Go to setup →
              </Link>
            </div>
          )}

          {status?.state === 'domain-gated' && (
            <form onSubmit={submit} className="space-y-5">
              {status.allowedDomains && status.allowedDomains.length > 0 && (
                <div className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded p-3 leading-relaxed">
                  Registration is open to these email domains:{' '}
                  <span className="text-slate-200">
                    {status.allowedDomains.map(d => `@${d}`).join(', ')}
                  </span>
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300">Name</label>
                <input
                  id="name" type="text" autoComplete="name" value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 sm:text-sm"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email address</label>
                <input
                  id="email" type="email" autoComplete="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password</label>
                <input
                  id="password" type="password" autoComplete="new-password" required minLength={8} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 sm:text-sm"
                  placeholder="Min 8 characters"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={busy}
                className="w-full px-4 py-2.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {busy ? '…' : 'Create account'}
              </button>

              <div className="text-center">
                <Link href="/portal/login" className="text-xs text-slate-500 hover:text-slate-300">
                  Already have an account? Sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
