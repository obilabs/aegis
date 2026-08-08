'use client'

import { createAuthClient } from 'better-auth/react'
import { twoFactorClient, emailOTPClient } from 'better-auth/client/plugins'

// Use window.location.origin in the browser so requests always go back
// to the page's origin (allows aliases without per-deploy config). SSR
// falls back to NEXT_PUBLIC_APP_URL baked at build time.
const baseURL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = '/portal/two-factor'
      },
    }),
    emailOTPClient(),
  ],
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  twoFactor,
  emailOtp,
} = authClient

// Helper function for Google Workspace sign-in
export async function signInWithGoogle(callbackURL?: string) {
  return signIn.social({
    provider: 'google',
    callbackURL: callbackURL || '/portal/dashboard',
  })
}
