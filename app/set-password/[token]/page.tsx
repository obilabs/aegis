'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

/**
 * Public set-password page (spec: admin-password-onboarding). A user redeems a
 * one-time invite/reset link and sets their OWN password. Auth is the token in
 * the URL — no session required. Outside /portal so the middleware doesn't gate
 * it.
 */
export default function SetPasswordPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params?.token as string

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not set your password.')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/portal/login'), 1800)
    } catch {
      setError('Could not set your password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-slate-100 mb-1">Set your password</h1>
        <p className="text-sm text-slate-400 mb-6">
          Choose a password only you will know. An administrator never sees or sets it.
        </p>

        {done ? (
          <div className="rounded-lg border border-green-800 bg-green-950/40 p-4 text-sm text-green-300">
            Password set. Redirecting you to sign in&hellip;
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm text-slate-300 mb-1">New password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-brand-500 focus:outline-none"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Confirm password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-brand-500 focus:outline-none"
                minLength={8}
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {submitting ? 'Setting password…' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
