'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth-client'
import {
  ShieldCheckIcon,
  TicketIcon,
  ComputerDesktopIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)

  useEffect(() => {
    // Check if setup is needed (no users or no organization)
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        if (data.setupRequired) {
          router.replace('/portal/setup')
        } else {
          // wizardRequired or fully set up — show login form
          // After login, middleware will route to wizard or dashboard
          setCheckingSetup(false)
        }
      })
      .catch(() => {
        setCheckingSetup(false)
      })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || 'Invalid email or password')
        setLoading(false)
        return
      }

      const params = new URLSearchParams(window.location.search)
      const callbackUrl = params.get('callbackUrl') || '/portal/dashboard'
      window.location.href = callbackUrl
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-800 to-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Logo & Tagline */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <ShieldCheckIcon className="h-10 w-10 text-brand-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Aegis</h1>
              <p className="text-brand-400 text-sm">IT Service Management</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Your IT Support Portal
          </h2>
          <p className="text-slate-400 text-lg">
            Submit tickets, track requests, and get help from your IT team.
          </p>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TicketIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Submit & Track Tickets</h3>
              <p className="text-slate-400 text-sm">Report issues and request services with real-time status updates</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <ComputerDesktopIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Request Equipment</h3>
              <p className="text-slate-400 text-sm">Browse available hardware and submit requests for new equipment</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-brand-500/10 rounded-lg">
              <BookOpenIcon className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Knowledge Base</h3>
              <p className="text-slate-400 text-sm">Find answers to common questions and how-to guides</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI-Powered Support</h3>
              <p className="text-slate-400 text-sm">Get instant help from our AI assistant for quick resolutions</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-sm text-slate-500">
          <p>© 2026 <a href="https://obilabs.dev" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">ObiLabs</a> • Aegis ITSM</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
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
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-slate-400 mt-2">Sign in to access your IT portal</p>
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

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 bg-slate-900 border-slate-700 rounded text-brand-500 focus:ring-brand-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-400">Remember me</span>
                </label>
                <Link
                  href="/portal/forgot-password"
                  className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

          </div>

          {/* Help Text */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Need help?{' '}
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}
                className="text-brand-400 hover:text-brand-300 transition-colors"
              >
                Contact {process.env.NEXT_PUBLIC_SUPPORT_TEAM || 'IT Support'}
              </a>
            ) : (
              <>Contact your IT administrator</>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
