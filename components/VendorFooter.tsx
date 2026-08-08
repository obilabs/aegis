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
 */

const RAW_VENDOR_URL = process.env.NEXT_PUBLIC_VENDOR_URL ?? 'https://api.obilabs.dev'

export function VendorFooter() {
  const vendorUrl = RAW_VENDOR_URL.trim().replace(/\/$/, '')
  if (!vendorUrl) return null

  return (
    <footer className="px-4 py-2 text-xs text-slate-500 border-t border-slate-800 flex items-center justify-end gap-4">
      <a
        href={`${vendorUrl}/donate`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-slate-300 transition-colors"
      >
        Support the project →
      </a>
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
