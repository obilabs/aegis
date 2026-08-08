'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, authClient } from '@/lib/auth-client'

/**
 * Personal account settings (distinct from org/admin config at /portal/settings).
 * Reached from the user-menu dropdown. Everything here is about YOUR account —
 * identity, password, 2FA, personal API keys — never organization configuration.
 */
export default function AccountPage() {
  const { data: session } = useSession()
  const user = session?.user

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwBusy(true)
    setPwMsg(null)
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (res.error) throw new Error(res.error.message || 'Could not change password')
      setPwMsg({ ok: true, text: 'Password updated. Other sessions were signed out.' })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change password' })
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">My Account</h1>
        <p className="text-sm text-slate-400 mt-1">
          Your personal settings. Organization configuration lives under Settings in the sidebar.
        </p>
      </div>

      {/* Identity */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Profile</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Name</dt>
            <dd className="text-slate-200">{user?.name || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-200">{user?.email || '—'}</dd>
          </div>
        </dl>
      </section>

      {/* Password */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Change password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label htmlFor="cur" className="block text-xs font-medium text-slate-400 mb-1">Current password</label>
            <input
              id="cur" type="password" autoComplete="current-password" required value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="new" className="block text-xs font-medium text-slate-400 mb-1">New password</label>
            <input
              id="new" type="password" autoComplete="new-password" required minLength={8} value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 sm:text-sm"
              placeholder="Min 8 characters"
            />
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{pwMsg.text}</p>
          )}
          <button
            type="submit" disabled={pwBusy}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {pwBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      {/* Security + keys */}
      <section className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/portal/two-factor"
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-brand-500/50 transition-colors"
        >
          <h3 className="text-sm font-medium text-white">Two-factor authentication</h3>
          <p className="text-xs text-slate-400 mt-1">Add a second factor to protect your account.</p>
        </Link>
        <Link
          href="/portal/account/api-keys"
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-brand-500/50 transition-colors"
        >
          <h3 className="text-sm font-medium text-white">API keys</h3>
          <p className="text-xs text-slate-400 mt-1">Personal keys for integrations and API access.</p>
        </Link>
      </section>
    </div>
  )
}
