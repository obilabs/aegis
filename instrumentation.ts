/**
 * Next.js Instrumentation — runs once on server startup.
 *
 * Registers background workers (pg-boss jobs) for:
 * - Telemetry heartbeat (daily)
 * - Embedding generation (on demand)
 * - New → Open age-out sweep (every 15 min)
 * - Triage scoring + SLA checks (event-driven + cron)
 * - Retention purge (daily at 2 AM UTC)
 * - KB gap aggregation (hourly)
 * - AI session cleanup (daily at 3 AM UTC)
 */
export async function register() {
  // Only run on the server (not during build or edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { registerTelemetryJob, registerEmbeddingWorker, registerSweepJobs } = await import('./lib/queue')
      const { registerTriageWorker } = await import('./lib/triage-worker')
      const { startEmailWorker } = await import('./lib/email-queue')
      const { registerRetentionPurgeJob } = await import('./lib/retention-purge')
      const { registerKbGapWorker, registerSessionCleanupWorker } = await import('./lib/kb-gap-worker')
      const { startLicenseHeartbeat } = await import('./lib/license-heartbeat')

      await registerTelemetryJob()
      await registerEmbeddingWorker()
      await registerSweepJobs()
      await registerTriageWorker()
      await startEmailWorker()
      await registerRetentionPurgeJob()
      await registerKbGapWorker()
      await registerSessionCleanupWorker()
      startLicenseHeartbeat()

      // Cascade revocation boot recovery: sweep any queued cascades
      // whose commit_after has passed and commit each. Handles the
      // case where a scheduled setTimeout was killed by a process
      // restart mid-window.
      try {
        const { recoverPendingCascades } = await import('./lib/cascade-revoke')
        const result = await recoverPendingCascades()
        if (result.swept > 0) {
          console.log(
            `[cascade-recovery] Boot sweep: ${result.swept} queued, ` +
            `${result.committed} committed, ${result.failed} failed`,
          )
        }
      } catch (err) {
        console.error('[cascade-recovery] Boot sweep failed:', err)
      }

      console.log('[instrumentation] All workers registered')
    } catch (error) {
      // Worker registration failure should not prevent the app from starting
      console.error('[instrumentation] Failed to register workers:', error)
    }
  }
}
