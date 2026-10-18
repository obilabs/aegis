/**
 * Email Settings — test send
 *
 * POST /api/settings/email/test — send a test email to the calling
 *                                  admin's session email
 *
 * Admin only. Rate-limited 5/hour/user to prevent abuse.
 *
 * Spec: openspec/changes/email-first-class/specs/email-delivery/spec.md
 * (Requirement: "Test-send produces verifiable outcome")
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/access'
import { getAuthContext } from '@/lib/org'
import { pool } from '@/lib/db'
import {
  getEmailSettings,
  recordEmailAttempt,
  recordTestAttempt,
} from '@/lib/email-settings'
import { getProvider, type EmailProvider, type SendEmailInput } from '@obilabs/email'

// In-memory rate limiter — 5 requests per user per rolling hour.
// Acceptable for v1: rate limit is per process, and apps/aegis runs as
// a single Next.js process. If we ever go multi-instance, swap for Redis.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX = 5
const recentAttempts = new Map<string, number[]>()

function consumeRateLimit(userId: string): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const attempts = (recentAttempts.get(userId) ?? []).filter(
    t => now - t < RATE_LIMIT_WINDOW_MS,
  )
  if (attempts.length >= RATE_LIMIT_MAX) {
    const oldest = attempts[0]
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000),
    }
  }
  attempts.push(now)
  recentAttempts.set(userId, attempts)
  return { ok: true, retryAfterSeconds: 0 }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { session, orgId } = ctx
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const rate = consumeRateLimit(session.user.id)
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'rate-limited', retry_after_seconds: rate.retryAfterSeconds },
        { status: 429 },
      )
    }

    const settings = await getEmailSettings(orgId)
    if (!settings) {
      await recordTestAttempt({
        organizationId: orgId,
        status: 'failed',
        errorMessage: 'Email is not configured. Save a provider config before testing.',
      })
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'email-not-configured',
            message: 'Email is not configured. Save a provider config before testing.',
          },
        },
        { status: 400 },
      )
    }

    const provider = getProvider(settings.provider) as EmailProvider<unknown>
    const recipient = session.user.email
    const input: SendEmailInput = {
      to: recipient,
      subject: 'Aegis email test',
      text: `This is a test email sent from ${settings.from_address} via ${settings.provider}.\n\nIf you received this, your Aegis install can send email. You can close this tab.`,
      html: `<p>This is a test email sent from <code>${settings.from_address}</code> via <strong>${settings.provider}</strong>.</p><p>If you received this, your Aegis install can send email. You can close this tab.</p>`,
      from: { address: settings.from_address, name: settings.from_name ?? undefined },
      replyTo: settings.reply_to ?? undefined,
    }

    const result = await provider.sendEmail(input, settings.config)

    // Audit row for the send attempt itself (separate from last_test_*).
    await recordEmailAttempt({
      organizationId: orgId,
      provider: settings.provider,
      toAddress: recipient,
      subject: input.subject,
      status: result.success ? 'success' : 'failed',
      errorCode: result.error?.code,
      errorMessage: result.error?.message,
      providerMessageId: result.providerMessageId,
    })

    // Stamp last_test_* (separate from last_send_*) so the UI can show
    // both "last production send" and "last test" independently.
    await recordTestAttempt({
      organizationId: orgId,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error?.message,
    })
    // Override last_send_* — test sends shouldn't pollute production status.
    // recordEmailAttempt above updated last_send_*; reset it here.
    if (settings.last_send_at) {
      await pool.query(
        `UPDATE email_settings
            SET last_send_at = $2,
                last_send_status = $3,
                last_send_error_message = $4
          WHERE organization_id = $1`,
        [
          orgId,
          settings.last_send_at,
          settings.last_send_status,
          settings.last_send_error_message,
        ],
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Email test-send failed:', error)
    return NextResponse.json({ error: 'Test send failed unexpectedly' }, { status: 500 })
  }
}
