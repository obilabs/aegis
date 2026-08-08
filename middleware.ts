import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication
const protectedRoutes = [
  '/portal/dashboard',
  '/portal/tickets',
  '/portal/assets',
  '/portal/contacts',
  '/portal/companies',
  '/portal/credentials',
  '/portal/services',
  '/portal/vendors',
  '/portal/access',
  '/portal/request',
  '/portal/people',
  '/portal/policies',
  '/portal/hr',
  '/portal/activity',
  '/portal/providers',
  '/portal/settings',
  '/portal/kb', // KB requires auth by default
  '/portal/documents',
  '/portal/reports',
  '/portal/operations',
]

// Routes that are always public (no auth required)
const publicRoutes = [
  '/portal/setup',
  '/portal/login',
  '/portal/register', // self-service signup (gated server-side by signup-status)
  '/portal/forgot-password',
  '/portal/reset-password',
  // Public KB articles can be accessed via /portal/kb/public/[slug]
  // But the main /portal/kb requires auth
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip setup check for API routes and static files
  const skipSetupCheck = pathname.startsWith('/api/') || 
                         pathname.startsWith('/_next/') ||
                         pathname.includes('.')

  // Check setup status for portal routes (but not API routes)
  if (pathname.startsWith('/portal') && !skipSetupCheck) {
    try {
      const setupRes = await fetch(new URL('/api/setup/status', request.url), {
        headers: { 'Accept': 'application/json' },
      })

      // Only process if we got a valid JSON response
      if (setupRes.ok && setupRes.headers.get('content-type')?.includes('application/json')) {
        const setupData = await setupRes.json()

        // If no users exist and not on setup page, redirect to create admin
        if (setupData.setupRequired && pathname !== '/portal/setup') {
          return NextResponse.redirect(new URL('/portal/setup', request.url))
        }

        // If users exist but no organization, ensure user is logged in then show wizard
        if (setupData.wizardRequired) {
          const sessionCookie =
            request.cookies.get('__Secure-better-auth.session_token')?.value ||
            request.cookies.get('better-auth.session_token')?.value

          if (!sessionCookie) {
            // No session — redirect to login with callback to wizard
            const loginUrl = new URL('/', request.url)
            loginUrl.searchParams.set('callbackUrl', '/portal/setup/wizard')
            return NextResponse.redirect(loginUrl)
          }

          // Has session — force to wizard if not already there
          if (!pathname.startsWith('/portal/setup/wizard')) {
            return NextResponse.redirect(new URL('/portal/setup/wizard', request.url))
          }
          // On wizard with valid session — let through
          return NextResponse.next()
        }

        // If fully set up and on any setup page, redirect to dashboard
        if (!setupData.setupRequired && !setupData.wizardRequired && pathname.startsWith('/portal/setup')) {
          return NextResponse.redirect(new URL('/portal/dashboard', request.url))
        }
      }
    } catch (error) {
      // If API fails, continue normally - don't block the request
      // This can happen during dev server startup
    }
  }

  // Check if route is explicitly public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check if route requires protection
  const isProtectedPortalRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedPortalRoute) {
    // Check for better-auth session cookie
    const sessionCookie =
      request.cookies.get('__Secure-better-auth.session_token')?.value ||
      request.cookies.get('better-auth.session_token')?.value

    if (!sessionCookie) {
      // Store the original URL to redirect back after login
      const loginUrl = new URL('/', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  // If visiting root or login page while having session cookie, redirect to dashboard
  if (pathname === '/' || pathname === '/portal/login') {
    const sessionCookie =
      request.cookies.get('__Secure-better-auth.session_token')?.value ||
      request.cookies.get('better-auth.session_token')?.value
    if (sessionCookie) {
      return NextResponse.redirect(new URL('/portal/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  // Note: /kb/* routes are PUBLIC (no auth required)
  // They are not in this matcher, so they bypass middleware
  matcher: ['/', '/portal/:path*'],
}
