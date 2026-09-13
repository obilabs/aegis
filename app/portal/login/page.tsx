'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, emailOtp } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // unified-auth-bootstrap D4: show a create-account link only when the server
  // will actually accept a signup — first-run (open) or an admin-opened domain
  // (domain-gated). Hidden when closed (invite/admin-only).
  const [signupState, setSignupState] = useState<'open' | 'closed' | 'domain-gated' | null>(null)

  useEffect(() => {
    fetch('/api/auth/signup-status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setSignupState(d?.state ?? 'closed'))
      .catch(() => setSignupState('closed'))
  }, [])

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    // setLoading(false) MUST live in finally — without it, a Better Auth
    // rate-limit response (429) that doesn't populate result.error
    // leaves the button stuck on "Signing in..." indefinitely. Caught
    // via Playwright (2026-06-23). Same pattern in handleSendCode +
    // handleVerifyCode below.
    try {
      const result = await signIn.email({ email, password })
      if (result.error) {
        setError(result.error.message || 'Login failed')
        return
      }
      router.push('/portal/dashboard')
      router.refresh()
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
      if (result.error) {
        setError(result.error.message || 'Failed to send code')
        return
      }
      setCodeSent(true)
    } catch {
      setError('Failed to send code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn.emailOtp({ email, otp })
      if (result.error) {
        setError(result.error.message || 'Invalid code')
        return
      }
      router.push('/portal/dashboard')
      router.refresh()
    } catch {
      setError('Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setLoading(true)
    try {
      await emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
      setOtp('')
    } catch {
      setError('Failed to resend code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-white">Aegis</span>
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold text-slate-100">
          Portal Login
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Sign in to your help desk
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 shadow-xl rounded-lg sm:px-10 border border-slate-800">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-800 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setTab('password'); setError(''); setCodeSent(false); setOtp('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'password'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setTab('code'); setError('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'code'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Email Code
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Password Tab */}
          {tab === 'password' && (
            <form className="space-y-5" onSubmit={handlePasswordLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 sm:text-sm"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 sm:text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}

          {/* Email Code Tab */}
          {tab === 'code' && !codeSent && (
            <form className="space-y-5" onSubmit={handleSendCode}>
              <div>
                <label htmlFor="code-email" className="block text-sm font-medium text-slate-300">
                  Email address
                </label>
                <input
                  id="code-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 sm:text-sm"
                  placeholder="admin@example.com"
                />
              </div>
              <p className="text-xs text-slate-500">
                We&apos;ll send a 6-digit verification code to your email.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          )}

          {tab === 'code' && codeSent && (
            <form className="space-y-5" onSubmit={handleVerifyCode}>
              <div className="text-center mb-2">
                <p className="text-sm text-slate-300">
                  Code sent to <span className="font-medium text-white">{email}</span>
                </p>
              </div>

              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-300">
                  Verification Code
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 block w-full px-3 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-center text-2xl font-mono tracking-[0.5em] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-brand-400 hover:text-brand-300 disabled:opacity-50"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={() => { setCodeSent(false); setOtp(''); setError('') }}
                  className="text-slate-400 hover:text-slate-300"
                >
                  Change email
                </button>
              </div>
            </form>
          )}
        </div>

        {(signupState === 'open' || signupState === 'domain-gated') && (
          <p className="mt-6 text-center text-sm text-slate-400">
            {signupState === 'open' ? (
              <>
                First time here?{' '}
                <Link href="/portal/setup" className="text-brand-400 hover:text-brand-300 transition-colors">
                  Set up this workspace
                </Link>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <Link href="/portal/register" className="text-brand-400 hover:text-brand-300 transition-colors">
                  Create one
                </Link>
              </>
            )}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="text-brand-400 hover:text-brand-300 transition-colors">
            Back to homepage
          </Link>
        </p>
      </div>
    </div>
  )
}
