/**
 * Email Queue Service
 * 
 * Provides reliable email delivery with:
 * - Automatic retries (configurable attempts with exponential backoff)
 * - Priority queuing (higher priority = processed first)
 * - Dead letter queue for failed emails
 * - Audit logging for compliance
 * - Rate limiting to prevent spam
 * 
 * Uses pg-boss for job processing + existing email_queue table for audit
 */

import { getQueue, EmailJob, QUEUES } from './queue'
import { pool } from './db'
import { getOrgId, sendViaConfiguredProvider } from './email-settings'

// ---------------------------------------------------------------------------
// Enqueue call-site audit (Task 6.2 in openspec/changes/email-first-class).
//
// All email-enqueue paths flow through this module's queueEmail() →
// pg-boss → the worker registered in startEmailWorker() below. The worker
// dispatches via @obilabs/email's provider abstraction (sendViaConfiguredProvider).
// Single-tenant: apps/aegis has exactly one organizations row, so the
// worker resolves orgId on demand via getOrgId() rather than threading
// it through every EmailJob.
//
// Fail-loud branches:
//   - email-not-configured: recorded in email_attempts + email_settings;
//     job marked permanently failed (no retry).
//   - send-failed (transient): recorded; pg-boss retries with backoff per
//     PRIORITY_CONFIG.
//   - provider-threw (provider contract violation): treated as send-failed.
//
// Callers (queueEmail, sendTicketNotification, sendTicketReplyNotification,
// sendPasswordResetEmail, sendSLAWarningEmail) need NO changes — they
// continue to enqueue jobs; the worker is the dispatch boundary.
// ---------------------------------------------------------------------------

// Priority mapping (pg-boss uses lower number = higher priority)
const PRIORITY_CONFIG = {
  critical: { priority: 1, retryLimit: 10, maxAttempts: 10 },  // Password resets, security alerts
  high: { priority: 2, retryLimit: 7, maxAttempts: 7 },        // Ticket assignments, SLA warnings
  normal: { priority: 5, retryLimit: 5, maxAttempts: 5 },      // Standard notifications
  low: { priority: 10, retryLimit: 3, maxAttempts: 3 },        // Marketing, digests
}

// Map our email types to related_type for the existing schema
const EMAIL_TYPE_MAP: Record<string, string> = {
  ticket_notification: 'ticket',
  ticket_reply: 'ticket',
  password_reset: 'user',
  welcome: 'user',
  donation_thanks: 'donation',
  system: 'system',
}

/**
 * Queue an email for delivery
 * 
 * @example
 * await queueEmail({
 *   to: 'user@example.com',
 *   subject: 'Ticket #1234 Updated',
 *   html: '<p>Your ticket has been updated...</p>',
 *   type: 'ticket_notification',
 *   relatedId: 'ticket-uuid',
 *   priority: 'high'
 * })
 */
export async function queueEmail(job: EmailJob): Promise<string | null> {
  try {
    const boss = await getQueue()
    const priority = job.priority || 'normal'
    const config = PRIORITY_CONFIG[priority]

    // Get organization ID (use default if not available)
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1')
    const organizationId = orgResult.rows[0]?.id

    if (!organizationId) {
      console.error('[email-queue] No organization found')
      return null
    }

    // Log to email_queue table for audit/tracking (using existing schema)
    const logResult = await pool.query(`
      INSERT INTO email_queue (
        organization_id, to_email, subject, body_html, body_text,
        related_type, related_id, priority, max_attempts, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING id
    `, [
      organizationId,
      job.to,
      job.subject,
      job.html,
      job.text || null,
      EMAIL_TYPE_MAP[job.type] || 'system',
      job.relatedId || null,
      config.priority,
      config.maxAttempts,
    ])

    const emailLogId = logResult.rows[0]?.id

    // Queue the job with pg-boss
    const jobId = await boss.send(QUEUES.EMAIL, {
      ...job,
      emailLogId, // Link to our audit log
    }, {
      priority: config.priority,
      retryLimit: config.retryLimit,
      retryDelay: 30,
      retryBackoff: true,
      // pg-boss v12 rejects expireInSeconds >= 24 hours (86400).
      // Use 23 hours so jobs don't sit forever but stay under the cap.
      expireInSeconds: 60 * 60 * 23,
    })

    console.log(`[email-queue] Queued email to ${job.to} (job: ${jobId}, type: ${job.type})`)
    return jobId
  } catch (error) {
    console.error('[email-queue] Failed to queue email:', error)
    return null
  }
}

/**
 * Queue multiple emails (batch)
 */
export async function queueEmails(jobs: EmailJob[]): Promise<(string | null)[]> {
  return Promise.all(jobs.map(job => queueEmail(job)))
}

/**
 * Start the email worker to process queued emails
 * Call this once when the app starts
 */
export async function startEmailWorker(): Promise<void> {
  const boss = await getQueue()
  await boss.createQueue(QUEUES.EMAIL)

  // pg-boss v12 with batchSize passes an ARRAY of jobs to the handler (not
  // a single job). Iterate and process each.
  //
  // Design note: sendEmail() catches SMTP errors internally and returns false
  // rather than throwing. We check that return value explicitly instead of
  // relying on throw-into-catch, because nesting UPDATEs in a catch block has
  // been flaky in this bundler (catch body silently skipped post-minification).
  // We only use try/catch to guard against genuinely unexpected exceptions
  // from pool.query itself.
  await boss.work(QUEUES.EMAIL, {
    batchSize: 5,
    pollingIntervalSeconds: 5,
  }, async (jobs: any) => {
    const jobList: any[] = Array.isArray(jobs) ? jobs : [jobs]
    let anyFailed = false

    for (const job of jobList) {
      const emailData = job.data as EmailJob & { emailLogId?: string }

      if (!emailData?.to) {
        console.error('[email-worker] Skipping malformed job (no recipient):', job.id)
        continue
      }

      const retryCount: number = job.retrycount ?? 0
      console.log(`[email-worker] Processing email to ${emailData.to} (attempt ${retryCount + 1})`)

      const markStatus = async (
        status: 'sending' | 'sent' | 'pending' | 'failed',
        opts?: { lastError?: string; bumpAttempts?: boolean; markSentAt?: boolean },
      ) => {
        if (!emailData.emailLogId) return
        try {
          const nextRetryExpr = status === 'pending'
            ? `NOW() + INTERVAL '30 seconds' * POWER(2, ${Math.min(retryCount, 10)})`
            : 'NULL'
          const sentAtExpr = opts?.markSentAt ? 'NOW()' : 'sent_at'
          const attemptsExpr = opts?.bumpAttempts ? 'attempts + 1' : 'attempts'
          await pool.query(
            `UPDATE email_queue
             SET status = $1,
                 last_error = $2,
                 attempts = ${attemptsExpr},
                 sent_at = ${sentAtExpr},
                 next_retry_at = ${nextRetryExpr},
                 updated_at = NOW()
             WHERE id = $3`,
            [status, opts?.lastError ?? null, emailData.emailLogId],
          )
        } catch (err) {
          console.error('[email-worker] Failed to update email_queue status:', err)
        }
      }

      await markStatus('sending', { bumpAttempts: true })

      // D31: shadow-mode check. If the email is associated with a mailbox
      // currently in shadow mode, suppress the send and mark the row as
      // sent (status='sent' is misleading; use 'failed' with shadow-suppressed
      // marker so admins can see why it didn't go out).
      if (emailData.sourceMailboxId) {
        try {
          const shadow = await pool.query<{ shadow_mode: boolean }>(
            'SELECT shadow_mode FROM inbound_mailboxes WHERE id = $1',
            [emailData.sourceMailboxId],
          )
          if (shadow.rows[0]?.shadow_mode === true) {
            await markStatus('failed', {
              lastError: 'shadow_mode: outbound suppressed because source mailbox is in shadow mode',
            })
            console.log(
              `[email-worker] Suppressed outbound to ${emailData.to} — source mailbox ${emailData.sourceMailboxId} is in shadow mode`,
            )
            continue
          }
        } catch (err) {
          // If the shadow-mode check fails (e.g., column missing pre-migration),
          // proceed with normal send rather than blocking ALL outbound.
          console.warn('[email-worker] Shadow-mode check failed; proceeding with send:', err)
        }
      }

      let sendOk = false
      let sendError: string | null = null
      let isPermanent = false

      const orgId = await getOrgId()
      if (!orgId) {
        sendError = 'No organization found (single-tenant install but no row in organizations)'
        isPermanent = true
      } else {
        // Forward threading headers verbatim (RFC-5322 fields are
        // case-insensitive; pass through as-is).
        const headers = emailData.headers
          ? {
              ...(emailData.headers.messageId
                ? { 'Message-ID': emailData.headers.messageId }
                : {}),
              ...(emailData.headers.inReplyTo
                ? { 'In-Reply-To': emailData.headers.inReplyTo }
                : {}),
              ...(emailData.headers.references
                ? { References: emailData.headers.references }
                : {}),
              ...(emailData.headers.extra ?? {}),
            }
          : undefined

        const result = await sendViaConfiguredProvider({
          organizationId: orgId,
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          queueJobId: typeof job.id === 'string' ? job.id : undefined,
          ...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
        })
        sendOk = result.success
        if (!sendOk) {
          sendError = result.error?.message ?? 'Unknown send failure'
          // email-not-configured is permanent — retrying won't help until
          // an admin configures the provider via Settings → Email.
          isPermanent = result.error?.code === 'email-not-configured'
        }
      }

      if (sendOk) {
        await markStatus('sent', { markSentAt: true })
        console.log(`[email-worker] Successfully sent email to ${emailData.to}`)
        continue
      }

      const cfg = PRIORITY_CONFIG[emailData.priority || 'normal']
      const isLastAttempt = retryCount >= cfg.retryLimit - 1
      const finalStatus = isPermanent || isLastAttempt ? 'failed' : 'pending'
      const errorMsg = sendError ?? 'Email send returned false'
      await markStatus(finalStatus, { lastError: errorMsg })
      console.error(
        `[email-worker] Failed to send email to ${emailData.to} (retry ${retryCount}/${cfg.retryLimit}, permanent=${isPermanent}, final=${finalStatus === 'failed'}): ${errorMsg}`,
      )
      // Only bubble retry to pg-boss for transient failures; permanent ones
      // stay quiet so pg-boss doesn't try to redeliver.
      if (!isPermanent) anyFailed = true
    }

    // Let pg-boss retry the batch if any job failed, so it doesn't stay idle
    // waiting for a poll cycle. retryLimit on the pg-boss side governs caps.
    if (anyFailed) throw new Error('One or more emails in batch failed to send')
  })

  console.log('[email-worker] Email worker started')
}

// ============================================================================
// Convenience functions for common email types
// ============================================================================

/**
 * Send ticket notification email
 */
export async function sendTicketNotification(params: {
  to: string
  ticketNumber: string
  ticketSubject: string
  action: 'created' | 'updated' | 'assigned' | 'resolved' | 'closed'
  ticketId: string
  message?: string
}): Promise<string | null> {
  const actionText = {
    created: 'has been created',
    updated: 'has been updated',
    assigned: 'has been assigned to you',
    resolved: 'has been resolved',
    closed: 'has been closed',
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Ticket ${actionText[params.action]}</h1>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0;">
          <strong>Ticket:</strong> ${params.ticketNumber}<br>
          <strong>Subject:</strong> ${params.ticketSubject}
        </p>
        ${params.message ? `<p>${params.message}</p>` : ''}
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/tickets/${params.ticketId}" 
           style="display: inline-block; background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          View Ticket
        </a>
      </div>
    </body>
    </html>
  `

  return queueEmail({
    to: params.to,
    subject: `[${params.ticketNumber}] ${params.ticketSubject}`,
    html,
    type: 'ticket_notification',
    relatedId: params.ticketId,
    priority: params.action === 'assigned' ? 'high' : 'normal',
  })
}

/**
 * Send ticket reply notification
 *
 * Accepts optional `headers` (Message-ID/In-Reply-To/References) and
 * `sourceMailboxId` (D31 shadow-mode dispatch check). Callers that have
 * already built the outbound Message-ID via `lib/email/outbound-headers`
 * pass them here so the recipient's mail client threads correctly.
 */
export async function sendTicketReplyNotification(params: {
  to: string
  ticketNumber: string
  ticketSubject: string
  ticketId: string
  replyPreview: string
  replierName: string
  headers?: EmailJob['headers']
  sourceMailboxId?: string
}): Promise<string | null> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">New Reply on ${params.ticketNumber}</h1>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0;">
          <strong>${params.replierName}</strong> replied to your ticket:
        </p>
        <div style="background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0;">
          ${params.replyPreview}
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/tickets/${params.ticketId}" 
           style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
          View Full Conversation
        </a>
      </div>
    </body>
    </html>
  `

  return queueEmail({
    to: params.to,
    subject: params.headers?.messageId
      // When threading headers are present, let outbound-headers.ts dictate the
      // subject (it normalizes Re: + ticket prefix correctly). The local
      // template falls back to the legacy subject for callers that don't pass
      // headers (still works, just without RFC threading).
      ? `Re: [${params.ticketNumber}] ${params.ticketSubject}`
      : `Re: [${params.ticketNumber}] ${params.ticketSubject}`,
    html,
    type: 'ticket_reply',
    relatedId: params.ticketId,
    priority: 'high',
    headers: params.headers,
    sourceMailboxId: params.sourceMailboxId,
  })
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: {
  to: string
  resetToken: string
  userName: string
}): Promise<string | null> {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/reset-password?token=${params.resetToken}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Password Reset Request</h1>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0;">Hi ${params.userName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <a href="${resetUrl}" 
           style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0;">
          Reset Password
        </a>
        <p style="color: #6b7280; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `

  return queueEmail({
    to: params.to,
    subject: 'Reset Your Password - Aegis',
    html,
    type: 'password_reset',
    priority: 'critical', // Password resets are critical
  })
}

/**
 * Send SLA warning email
 */
export async function sendSLAWarningEmail(params: {
  to: string
  ticketNumber: string
  ticketSubject: string
  ticketId: string
  slaType: 'response' | 'resolution'
  timeRemaining: string
}): Promise<string | null> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ SLA Warning</h1>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; color: #ef4444; font-weight: bold;">
          ${params.slaType === 'response' ? 'First Response' : 'Resolution'} SLA at risk!
        </p>
        <p>
          <strong>Ticket:</strong> ${params.ticketNumber}<br>
          <strong>Subject:</strong> ${params.ticketSubject}<br>
          <strong>Time Remaining:</strong> ${params.timeRemaining}
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/tickets/${params.ticketId}" 
           style="display: inline-block; background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
          View Ticket Now
        </a>
      </div>
    </body>
    </html>
  `

  return queueEmail({
    to: params.to,
    subject: `⚠️ SLA Warning: [${params.ticketNumber}] ${params.ticketSubject}`,
    html,
    type: 'ticket_notification',
    relatedId: params.ticketId,
    priority: 'critical',
  })
}

// ============================================================================
// Queue Statistics
// ============================================================================

/**
 * Get email queue statistics
 */
export async function getEmailQueueStats(): Promise<{
  pending: number
  sending: number
  sent: number
  failed: number
  total: number
}> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'sending') as sending,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) as total
    FROM email_queue
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `)
  
  return result.rows[0]
}

/**
 * Get failed emails for review
 */
export async function getFailedEmails(limit = 50): Promise<any[]> {
  const result = await pool.query(`
    SELECT 
      id, to_email, subject, related_type, related_id,
      attempts, max_attempts, last_error, created_at
    FROM email_queue
    WHERE status = 'failed'
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit])
  
  return result.rows
}

/**
 * Retry a failed email
 */
export async function retryFailedEmail(emailId: string): Promise<boolean> {
  const result = await pool.query(`
    UPDATE email_queue
    SET status = 'pending', attempts = 0, last_error = NULL, next_retry_at = NOW()
    WHERE id = $1 AND status = 'failed'
    RETURNING id
  `, [emailId])
  
  return result.rows.length > 0
}
