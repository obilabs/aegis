/**
 * Email Settings — read + update
 *
 * GET  /api/settings/email  — current config (masked)
 * PUT  /api/settings/email  — update provider + config + identity
 *
 * Admin only. Credentials are NEVER returned in the GET response — only
 * a `configFields` mask indicating which fields are set.
 *
 * Spec: openspec/changes/email-first-class/specs/email-delivery/spec.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getProvider, PROVIDER_IDS, type ProviderId } from '@obilabs/email'
import { queryOne } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { getEmailSettings, saveEmailSettings } from '@/lib/email-settings'

// ---------------------------------------------------------------------------
// GET — masked current config
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { session, orgId } = ctx
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Direct row read so we can return the un-decrypted state shape too
    // (e.g., when no config_envelope is set, getEmailSettings returns null).
    const row = await queryOne<{
      provider: ProviderId
      config_envelope: string | null
      from_address: string
      from_name: string | null
      reply_to: string | null
      last_test_at: Date | null
      last_test_status: string | null
      last_test_error_message: string | null
      last_send_at: Date | null
      last_send_status: string | null
      last_send_error_message: string | null
    }>(
      `SELECT provider, config_envelope, from_address, from_name, reply_to,
              last_test_at, last_test_status, last_test_error_message,
              last_send_at, last_send_status, last_send_error_message
         FROM email_settings
        WHERE organization_id = $1`,
      [orgId],
    )

    if (!row) {
      return NextResponse.json({
        provider: 'gmail-relay' as ProviderId,
        configured: false,
        from_address: '',
        from_name: null,
        reply_to: null,
        last_test_at: null,
        last_test_status: null,
        last_test_error_message: null,
        last_send_at: null,
        last_send_status: null,
        last_send_error_message: null,
      })
    }

    // Mask: never return decrypted credential values. The UI uses
    // configFields to render "<set> / <unset>" affordances on each field
    // and lets the admin enter a new value if they want to rotate.
    let configFields: Record<string, 'set' | 'unset'> = {}
    if (row.config_envelope) {
      try {
        const settings = await getEmailSettings(orgId)
        if (settings && settings.config && typeof settings.config === 'object') {
          configFields = Object.fromEntries(
            Object.entries(settings.config as Record<string, unknown>).map(([k, v]) => [
              k,
              v == null || v === '' ? 'unset' : 'set',
            ]),
          )
        }
      } catch {
        // Decrypt failed (key rotated without re-encrypt, or tampering).
        // Surface as unconfigured so the admin re-enters credentials.
      }
    }

    return NextResponse.json({
      provider: row.provider,
      configured: row.config_envelope !== null,
      configFields,
      from_address: row.from_address,
      from_name: row.from_name,
      reply_to: row.reply_to,
      last_test_at: row.last_test_at,
      last_test_status: row.last_test_status,
      last_test_error_message: row.last_test_error_message,
      last_send_at: row.last_send_at,
      last_send_status: row.last_send_status,
      last_send_error_message: row.last_send_error_message,
    })
  } catch (error) {
    console.error('Failed to load email settings:', error)
    return NextResponse.json({ error: 'Failed to load email settings' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT — update config (encrypts credentials + validates per provider schema)
// ---------------------------------------------------------------------------

const putBodySchema = z.object({
  provider: z.enum(PROVIDER_IDS as readonly [ProviderId, ...ProviderId[]]),
  config: z.unknown(),
  from_address: z.string().email(),
  from_name: z.string().max(255).optional().nullable(),
  reply_to: z.string().email().optional().nullable(),
})

export async function PUT(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { session, orgId } = ctx
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = putBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    // Validate the provider-specific config too. saveEmailSettings does
    // this internally via the provider's schema.parse, but we want a
    // structured error response if it fails — so we check here too.
    const provider = getProvider(parsed.data.provider)
    const cfgResult = provider.configSchema.safeParse(parsed.data.config)
    if (!cfgResult.success) {
      return NextResponse.json(
        {
          error: `Invalid config for provider ${parsed.data.provider}`,
          details: cfgResult.error.flatten(),
        },
        { status: 400 },
      )
    }

    await saveEmailSettings({
      orgId,
      provider: parsed.data.provider,
      config: cfgResult.data,
      fromAddress: parsed.data.from_address,
      fromName: parsed.data.from_name ?? null,
      replyTo: parsed.data.reply_to ?? null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save email settings:', error)
    return NextResponse.json({ error: 'Failed to save email settings' }, { status: 500 })
  }
}
