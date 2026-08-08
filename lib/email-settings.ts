/**
 * Email settings — load/decrypt provider config + record send attempts.
 *
 * Spec: openspec/changes/email-first-class/design.md (D3, D4)
 *
 * This module is the single chokepoint between `email_settings` (storage)
 * and `@obilabs/email` (provider abstraction). The queue worker, the
 * Settings → Email UI, and the test-send endpoint all go through here.
 *
 * Single-tenant: apps/aegis has exactly one organization per install
 * (root CLAUDE.md: "One organization per installation"). The helper
 * resolves org id on demand and caches it for the lifetime of the
 * process; first-boot races are not a concern because the worker only
 * starts after the queue is up.
 */

import {
  decryptConfig,
  encryptConfig,
  getProvider,
  loadEnvelopeKeys,
  type EnvelopeKeys,
  type EmailProvider,
  type ProviderId,
  type SendEmailInput,
  type SendEmailResult,
} from '@obilabs/email'
import { pool, queryOne } from './db'

export interface EmailSettings {
  organization_id: string
  provider: ProviderId
  /** Decrypted provider config; shape depends on provider. */
  config: unknown
  from_address: string
  from_name: string | null
  reply_to: string | null
  last_test_at: Date | null
  last_test_status: 'success' | 'failed' | null
  last_test_error_message: string | null
  last_send_at: Date | null
  last_send_status: 'success' | 'failed' | null
  last_send_error_message: string | null
}

/** Outbound surface: send + record one attempt. */
export interface AttemptInput {
  organizationId: string
  provider: ProviderId
  toAddress: string
  subject: string
  status: 'success' | 'failed'
  errorCode?: string
  errorMessage?: string
  providerMessageId?: string
  queueJobId?: string
}

let cachedOrgId: string | null = null
let cachedKeys: EnvelopeKeys | null = null

/**
 * Fast check: is email configured (provider chosen AND credentials saved)?
 * Used by user-facing flows (password reset, signup verification) to
 * fail-loud per design D7 before queueing an email that would only error
 * out at the worker.
 *
 * Returns false on any of:
 *   - no email_settings row
 *   - config_envelope is NULL (provider chosen but never configured)
 *   - AEGIS_SECRETS_KEY missing (decrypt would fail)
 *
 * Never throws — boolean answer only.
 */
export async function isEmailConfigured(orgId?: string): Promise<boolean> {
  try {
    const id = orgId ?? (await getOrgId())
    if (!id) return false
    const row = await queryOne<{ config_envelope: string | null }>(
      `SELECT config_envelope FROM email_settings WHERE organization_id = $1`,
      [id],
    )
    return row?.config_envelope != null
  } catch {
    return false
  }
}

/**
 * Resolve the single organization id. Cached for the process lifetime;
 * apps/aegis's single-tenant model means this never changes after first
 * boot.
 */
export async function getOrgId(): Promise<string | null> {
  if (cachedOrgId) return cachedOrgId
  const row = await queryOne<{ id: string }>('SELECT id FROM organizations LIMIT 1')
  cachedOrgId = row?.id ?? null
  return cachedOrgId
}

function getKeys(): EnvelopeKeys {
  if (!cachedKeys) cachedKeys = loadEnvelopeKeys()
  return cachedKeys
}

/**
 * Load + decrypt email settings for an org. Returns null when no row
 * exists OR the row has no encrypted config (provider chosen but never
 * configured). Callers MUST handle null as "email not configured" —
 * never silently succeed.
 */
export async function getEmailSettings(orgId: string): Promise<EmailSettings | null> {
  const row = await queryOne<{
    organization_id: string
    provider: ProviderId
    config_envelope: string | null
    from_address: string
    from_name: string | null
    reply_to: string | null
    last_test_at: Date | null
    last_test_status: 'success' | 'failed' | null
    last_test_error_message: string | null
    last_send_at: Date | null
    last_send_status: 'success' | 'failed' | null
    last_send_error_message: string | null
  }>(
    `SELECT organization_id, provider, config_envelope, from_address, from_name, reply_to,
            last_test_at, last_test_status, last_test_error_message,
            last_send_at, last_send_status, last_send_error_message
       FROM email_settings
      WHERE organization_id = $1`,
    [orgId],
  )
  if (!row) return null
  if (!row.config_envelope) return null

  let config: unknown
  try {
    config = decryptConfig(row.config_envelope, getKeys())
  } catch (err) {
    console.error('[email-settings] decrypt failed for org', orgId, err)
    return null
  }
  return {
    organization_id: row.organization_id,
    provider: row.provider,
    config,
    from_address: row.from_address,
    from_name: row.from_name,
    reply_to: row.reply_to,
    last_test_at: row.last_test_at,
    last_test_status: row.last_test_status,
    last_test_error_message: row.last_test_error_message,
    last_send_at: row.last_send_at,
    last_send_status: row.last_send_status,
    last_send_error_message: row.last_send_error_message,
  }
}

/**
 * Update the provider config + identity fields. Validates the config
 * against the provider's Zod schema before encrypting. Throws if
 * validation fails or if the provider id is unknown.
 */
export async function saveEmailSettings(opts: {
  orgId: string
  provider: ProviderId
  config: unknown
  fromAddress: string
  fromName?: string | null
  replyTo?: string | null
}): Promise<void> {
  const provider = getProvider(opts.provider)
  const validated = provider.configSchema.parse(opts.config)
  const envelope = encryptConfig(validated, getKeys())
  // UPSERT — the migration seeds default rows for orgs that exist at
  // migration time, but orgs created AFTER (via setup-wizard) won't
  // have a row until first save. Insert-on-missing keeps both paths
  // working without a separate setup-wizard hook.
  await pool.query(
    `INSERT INTO email_settings (
       organization_id, provider, config_envelope, from_address, from_name, reply_to
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (organization_id) DO UPDATE SET
       provider = EXCLUDED.provider,
       config_envelope = EXCLUDED.config_envelope,
       from_address = EXCLUDED.from_address,
       from_name = EXCLUDED.from_name,
       reply_to = EXCLUDED.reply_to,
       updated_at = NOW()`,
    [
      opts.orgId,
      opts.provider,
      envelope,
      opts.fromAddress,
      opts.fromName ?? null,
      opts.replyTo ?? null,
    ],
  )
}

/**
 * Send one email through the configured provider. Returns the provider's
 * SendEmailResult. ALWAYS records the attempt in email_attempts and
 * updates email_settings.last_send_*. Never throws.
 *
 * On "email not configured" the worker should treat the returned
 * `{success: false, error.code: 'email-not-configured'}` as a permanent
 * failure (don't retry forever).
 */
export async function sendViaConfiguredProvider(input: {
  organizationId: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  replyTo?: string
  /** RFC-5322 threading headers (Message-ID, In-Reply-To, References). */
  headers?: Record<string, string>
  queueJobId?: string
}): Promise<SendEmailResult> {
  const settings = await getEmailSettings(input.organizationId)
  if (!settings) {
    const result: SendEmailResult = {
      success: false,
      error: {
        code: 'email-not-configured',
        message: 'Email is not configured for this organization. Configure at Settings → Email.',
      },
    }
    await recordEmailAttempt({
      organizationId: input.organizationId,
      provider: 'gmail-relay' as ProviderId, // placeholder for the audit row
      toAddress: Array.isArray(input.to) ? input.to[0] : input.to,
      subject: input.subject,
      status: 'failed',
      errorCode: result.error!.code,
      errorMessage: result.error!.message,
      queueJobId: input.queueJobId,
    })
    return result
  }

  const provider = getProvider(settings.provider) as EmailProvider<unknown>
  const sendInput: SendEmailInput = {
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    from: { address: settings.from_address, name: settings.from_name ?? undefined },
    replyTo: input.replyTo ?? settings.reply_to ?? undefined,
    headers: input.headers,
  }

  let result: SendEmailResult
  try {
    result = await provider.sendEmail(sendInput, settings.config)
  } catch (err) {
    // Defensive — providers MUST NOT throw per the contract, but if one
    // does we still want to record + return a failure rather than crash
    // the worker.
    const e = err as Error
    result = {
      success: false,
      error: { code: 'provider-threw', message: e.message },
    }
  }

  await recordEmailAttempt({
    organizationId: input.organizationId,
    provider: settings.provider,
    toAddress: Array.isArray(input.to) ? input.to[0] : input.to,
    subject: input.subject,
    status: result.success ? 'success' : 'failed',
    errorCode: result.error?.code,
    errorMessage: result.error?.message,
    providerMessageId: result.providerMessageId,
    queueJobId: input.queueJobId,
  })

  return result
}

/**
 * Append one audit row + update last_send_* on email_settings.
 * Exported so the test-send endpoint can record its own attempts too
 * (with status='success' / 'failed' branching at the call site).
 */
export async function recordEmailAttempt(attempt: AttemptInput): Promise<void> {
  await pool.query(
    `INSERT INTO email_attempts (
       organization_id, provider, to_address, subject, status,
       error_code, error_message, provider_message_id, queue_job_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      attempt.organizationId,
      attempt.provider,
      attempt.toAddress,
      attempt.subject,
      attempt.status,
      attempt.errorCode ?? null,
      attempt.errorMessage ?? null,
      attempt.providerMessageId ?? null,
      attempt.queueJobId ?? null,
    ],
  )
  await pool.query(
    `UPDATE email_settings
        SET last_send_at = NOW(),
            last_send_status = $2,
            last_send_error_message = $3,
            updated_at = NOW()
      WHERE organization_id = $1`,
    [attempt.organizationId, attempt.status, attempt.errorMessage ?? null],
  )
}

/**
 * Update last_test_* on email_settings. Called by the test-send route
 * separate from the regular send path so a failing test doesn't
 * pollute last_send_status (which reflects production traffic).
 */
export async function recordTestAttempt(opts: {
  organizationId: string
  status: 'success' | 'failed'
  errorMessage?: string | null
}): Promise<void> {
  await pool.query(
    `UPDATE email_settings
        SET last_test_at = NOW(),
            last_test_status = $2,
            last_test_error_message = $3,
            updated_at = NOW()
      WHERE organization_id = $1`,
    [opts.organizationId, opts.status, opts.errorMessage ?? null],
  )
}
