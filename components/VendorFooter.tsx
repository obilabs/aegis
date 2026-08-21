'use client'

/**
 * VendorFooter — small outbound link strip in the portal layout.
 *
 * Self-hosted Aegis links out to the project's canonical web surface
 * (apps/web) for things that don't belong in a self-hosted ITSM
 * portal: sponsor / support / docs. Standard OSS pattern (Plausible,
 * Mattermost, Penpot all do this).
 *
 * Configurable via NEXT_PUBLIC_VENDOR_URL. Default points at the
 * ObiLabs vendor surface. Set to empty string to hide the footer
 * entirely — air-gapped installs opt out without code changes.
 *
 * NEXT_PUBLIC_ prefix is required because Next.js bakes those into
 * the client bundle at build time; the URL is read in React, not on
 * the server.
 *
 * Hidden on standalone pages (login / setup / two-factor) — those
 * bypass the main portal chrome anyway.
 *
 * THE SUPPORT ASK IS NOT ALWAYS SHOWN (added 2026-08-21).
 *
 * It used to render for every signed-in user on every portal page, gated only on
 * NEXT_PUBLIC_VENDOR_URL — so people who had ALREADY DONATED were still being
 * asked, forever, which is the worst possible audience for an ask. And an end
 * user filing a ticket cannot authorise a donation, so for them it was pure
 * noise at the moment they needed help.
 *
 * /api/portal/support-ask decides. This component only renders the answer,
 * because the licence plan is server-side state and the role check needs the
 * database. "Get help →" is unconditional — that is a service, not an ask.
 */

import { useEffect, useState } from 'react'

const RAW_VENDOR_URL = process.env.NEXT_PUBLIC_VENDOR_URL ?? 'https://api.obilabs.dev'

/** localStorage key holding the ISO date the ask was last shown. */
const LAST_SHOWN_KEY = 'support-ask-last-shown'

export function VendorFooter() {
  const vendorUrl = RAW_VENDOR_URL.trim().replace(/\/$/, '')
  const [ask, setAsk] = useState<{ message: string } | null>(null)

  useEffect(() => {
    if (!vendorUrl) return
    let cancelled = false

    // Frequency cap lives client-side, deliberately.
    //
    // The server decides WHETHER this install should ever be asked; the browser
    // decides whether THIS PERSON has seen it recently. Storing a per-admin
    // timestamp server-side would mean a new table for a cosmetic concern, and
    // the failure mode of losing it (localStorage cleared) is simply that the
    // ask reappears once — which is acceptable, unlike the reverse.
    ;(async () => {
      try {
        const res = await fetch('/api/portal/support-ask')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !data?.show) return

        const last = window.localStorage.getItem(LAST_SHOWN_KEY)
        if (last) {
          const days = (Date.now() - new Date(last).getTime()) / 86_400_000
          if (days < (data.cooldownDays ?? 90)) return
        }
        window.localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString())
        setAsk({ message: data.message })
      } catch {
        // Never let an ask break a page.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [vendorUrl])

  if (!vendorUrl) return null

  return (
    <footer className="px-4 py-2 text-xs text-slate-500 border-t border-slate-800 flex items-center justify-end gap-4">
      {ask && (
        <a
          href={`${vendorUrl}/donate`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-300 transition-colors"
          title={ask.message}
        >
          {ask.message} →
        </a>
      )}
      <a
        href={`${vendorUrl}/support`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-slate-300 transition-colors"
      >
        Get help →
      </a>
    </footer>
  )
}
