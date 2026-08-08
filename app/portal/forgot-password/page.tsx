'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { emailOtp } from '@/lib/auth-client'
import { ShieldCheckIcon, ArrowLeftIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await emailOtp.sendVerificationOtp({
        email,
        type: 'forget-password',
      })

      if (result.error) {
        setError(result.error.message || 'Failed to send reset code. Please try again.')
        setLoading(false)
        return
      }

      // Navigate to reset page with email pre-filled
      router.push(`/portal/reset-password?email=${encodeURIComponent(email)}`)
    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2 bg-brand-500/20 rounded-xl">
            <ShieldCheckIcon className="h-8 w-8 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Aegis</h1>
            <p className="text-brand-400 text-xs">IT Service Management</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-brand-500/10 rounded-full flex items-center justify-center mb-4">
              <EnvelopeIcon className="h-6 w-6 text-brand-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Reset your password</h2>
            <p className="text-slate-400 mt-2">
              Enter your email and we&apos;ll send you a verification code
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
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
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                placeholder="you@company.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Sending code...
                </>
              ) : (
                'Send reset code'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
