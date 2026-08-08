/**
 * GET /api/settings/email/egress-ip
 *
 * Detects this install's outbound (egress) IP by asking ipify.org's
 * plaintext endpoint to echo back the public IP it sees. Used by the
 * email settings page when the operator chooses the Gmail Relay
 * "IP whitelist" mode — they need the exact IP to paste into the
 * Google Workspace admin allowlist.
 *
 * Cached at the response layer for 5 minutes via Cache-Control to
 * avoid hammering ipify on every page render. The egress IP for a
 * Docker host doesn't change minute-to-minute; if it does, the
 * operator can refetch by reloading.
 *
 * No telemetry consent gate here — the operator EXPLICITLY clicked
 * the IP whitelist mode to ask for this. Showing them their own
 * public IP isn't outbound telemetry; the only outbound call is the
 * ipify request, which the operator is the one asking for.
 */

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/org'

const IPIFY_URL = 'https://api.ipify.org'
const FETCH_TIMEOUT_MS = 5_000

export async function GET(request: Request) {
  const ctx = await getAuthContext(request as never)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let ip: string
    try {
      const res = await fetch(IPIFY_URL, { signal: controller.signal })
      if (!res.ok) {
        return NextResponse.json(
          { error: `Detector returned HTTP ${res.status}` },
          { status: 502 },
        )
      }
      ip = (await res.text()).trim()
    } finally {
      clearTimeout(timer)
    }

    if (!/^[\d.]+$/.test(ip) && !ip.includes(':')) {
      return NextResponse.json(
        { error: `Detector returned an unparseable response: ${ip.slice(0, 40)}` },
        { status: 502 },
      )
    }

    return NextResponse.json(
      { ip, detected_at: new Date().toISOString(), source: 'ipify' },
      {
        headers: {
          // 5 minutes — the egress IP for a Docker host is stable on
          // that timescale. Operators reload if they need a fresh read.
          'Cache-Control': 'private, max-age=300',
        },
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    return NextResponse.json(
      { error: `Failed to detect egress IP: ${message}` },
      { status: 502 },
    )
  }
}
