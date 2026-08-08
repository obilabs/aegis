import { describe, expect, it } from 'vitest'
import { blockedIpReason, assertSafeFetchTarget } from './ssrf-guard'

describe('blockedIpReason', () => {
  it('always blocks cloud-metadata / link-local, even when private is allowed', () => {
    expect(blockedIpReason('169.254.169.254', false)).toBe('link-local/metadata')
    expect(blockedIpReason('169.254.169.254', true)).toBe('link-local/metadata')
    expect(blockedIpReason('169.254.1.1', true)).toBe('link-local/metadata')
    expect(blockedIpReason('fe80::1', true)).toBe('link-local')
  })

  it('blocks loopback and private ranges only when private is NOT allowed', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.5', '192.168.1.1', '100.64.0.1']) {
      expect(blockedIpReason(ip, false)).not.toBeNull()
      expect(blockedIpReason(ip, true)).toBeNull()
    }
    expect(blockedIpReason('::1', false)).toBe('loopback')
    expect(blockedIpReason('::1', true)).toBeNull()
    expect(blockedIpReason('fd00::1', false)).toBe('unique-local-fc00/7')
    expect(blockedIpReason('fd00::1', true)).toBeNull()
  })

  it('blocks the unspecified address always', () => {
    expect(blockedIpReason('0.0.0.0', true)).toBe('unspecified')
    expect(blockedIpReason('::', true)).toBe('unspecified')
  })

  it('allows public addresses under either policy', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '203.0.113.10', '2606:4700:4700::1111']) {
      expect(blockedIpReason(ip, false)).toBeNull()
      expect(blockedIpReason(ip, true)).toBeNull()
    }
  })

  it('re-checks IPv4-mapped IPv6 addresses as IPv4', () => {
    expect(blockedIpReason('::ffff:169.254.169.254', true)).toBe('link-local/metadata')
    expect(blockedIpReason('::ffff:10.0.0.1', false)).toBe('private-10/8')
    expect(blockedIpReason('::ffff:8.8.8.8', false)).toBeNull()
  })
})

describe('assertSafeFetchTarget (IP-literal hosts, no DNS)', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(assertSafeFetchTarget('file:///etc/passwd', { allowPrivate: true })).rejects.toThrow(
      /Blocked URL scheme/,
    )
    await expect(assertSafeFetchTarget('gopher://1.2.3.4', { allowPrivate: true })).rejects.toThrow(
      /Blocked URL scheme/,
    )
  })

  it('rejects the cloud-metadata endpoint even for a local provider', async () => {
    await expect(
      assertSafeFetchTarget('http://169.254.169.254/latest/meta-data/', { allowPrivate: true }),
    ).rejects.toThrow(/link-local\/metadata/)
  })

  it('rejects a private IP for a non-local provider but allows it for a local one', async () => {
    await expect(
      assertSafeFetchTarget('http://172.25.10.11:11434/api/tags', { allowPrivate: false }),
    ).rejects.toThrow(/private-172\.16\/12/)
    await expect(
      assertSafeFetchTarget('http://172.25.10.11:11434/api/tags', { allowPrivate: true }),
    ).resolves.toBeUndefined()
  })

  it('allows a public IP target', async () => {
    await expect(
      assertSafeFetchTarget('https://8.8.8.8/v1/models', { allowPrivate: false }),
    ).resolves.toBeUndefined()
  })

  it('rejects a malformed URL', async () => {
    await expect(assertSafeFetchTarget('not a url', { allowPrivate: true })).rejects.toThrow(
      /Invalid provider URL/,
    )
  })
})
