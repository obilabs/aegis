/**
 * SSRF guard for server-side outbound fetches to operator-supplied URLs
 * (currently the AI-provider connection test — audit C2).
 *
 * The AI-provider "test" endpoint fetches `provider.api_url` from inside the
 * trust boundary with the stored API key attached, and returns the response
 * body to the caller. Without a target check, an operator could point a
 * provider at `http://169.254.169.254/…` (cloud instance metadata) or any
 * internal host and use the test as an SSRF/exfiltration channel.
 *
 * Policy:
 *   - Only http/https schemes.
 *   - Link-local / cloud-metadata (169.254.0.0/16, fe80::/10) and the
 *     unspecified address are blocked ALWAYS — no legitimate AI provider
 *     lives there, local or not.
 *   - Loopback and RFC1918/CGNAT/unique-local ranges are blocked UNLESS
 *     `allowPrivate` is set. Local providers (Ollama, `is_local`) pass
 *     `allowPrivate: true` because a LAN/loopback endpoint is exactly the
 *     point (e.g. a co-located Ollama on 127.0.0.1 or a LAN box on 172.x).
 *   - Hostnames are resolved via DNS and EVERY resolved address is checked,
 *     so an internal name can't smuggle past the literal-IP check.
 *
 * Not covered (deeper hardening, follow-up): DNS-rebinding between this check
 * and the actual fetch, and HTTP redirects to a blocked target. Pin the
 * resolved IP into the fetch (or disable redirects) to close those.
 */

import { lookup } from 'node:dns/promises'
import net from 'node:net'

/**
 * Returns a human-readable reason string if `ip` is in a blocked range, or
 * null if it is allowed under the given `allowPrivate` policy.
 */
export function blockedIpReason(ip: string, allowPrivate: boolean): string | null {
  const family = net.isIP(ip)

  if (family === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0) return 'unspecified'
    if (a === 169 && b === 254) return 'link-local/metadata' // always blocked
    if (a === 127) return allowPrivate ? null : 'loopback'
    if (!allowPrivate) {
      if (a === 10) return 'private-10/8'
      if (a === 172 && b >= 16 && b <= 31) return 'private-172.16/12'
      if (a === 192 && b === 168) return 'private-192.168/16'
      if (a === 100 && b >= 64 && b <= 127) return 'cgnat-100.64/10'
    }
    return null
  }

  if (family === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::' ) return 'unspecified'
    if (lower === '::1') return allowPrivate ? null : 'loopback'
    if (lower.startsWith('fe80')) return 'link-local' // always blocked
    // IPv4-mapped (::ffff:a.b.c.d) — re-check as IPv4.
    const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return blockedIpReason(mapped[1], allowPrivate)
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      return allowPrivate ? null : 'unique-local-fc00/7'
    }
    return null
  }

  // Not an IP literal — caller resolves hostnames before calling this.
  return null
}

/**
 * Throws with a descriptive message if `urlString` is not a safe outbound
 * fetch target under the given policy. Resolves hostnames and checks every
 * address. Callers should surface the message as a 400.
 */
export async function assertSafeFetchTarget(
  urlString: string,
  opts: { allowPrivate: boolean },
): Promise<void> {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new Error('Invalid provider URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme: ${url.protocol.replace(':', '')}`)
  }

  const host = url.hostname
  let addresses: string[]

  if (net.isIP(host)) {
    addresses = [host]
  } else {
    try {
      const resolved = await lookup(host, { all: true })
      addresses = resolved.map((r) => r.address)
    } catch {
      throw new Error(`Cannot resolve provider host: ${host}`)
    }
    if (addresses.length === 0) {
      throw new Error(`Cannot resolve provider host: ${host}`)
    }
  }

  for (const ip of addresses) {
    const reason = blockedIpReason(ip, opts.allowPrivate)
    if (reason) {
      throw new Error(`Blocked provider target (${reason}): ${host} -> ${ip}`)
    }
  }
}
