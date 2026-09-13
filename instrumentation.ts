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
    // Alive ping: recurring community-liveness beacon. Started FIRST and in its own
    // try/catch — deliberately BEFORE the pg-boss worker registrations below. Community
    // installs (the ones this beacon exists to count) are exactly where pg-boss can fail
    // to register on a fresh/ drifted install, and a pg-boss failure in the main try block
    // would skip everything after it. The liveness beacon must never depend on that. It is
    // setInterval-based and strictly fail-open. See lib/alive-ping.ts.
    try {
      const { startAlivePing } = await import('./lib/alive-ping')
      startAlivePing()
    } catch (err) {
      console.error('[instrumentation] Failed to start alive ping:', err)
    }

    // First-run setup token: while no organization exists, generate (or load)
    // the one-time token and print it to the log so the operator can claim the
    // instance. See lib/first-run-token.ts.
    try {
      const { isSetupOpen } = await import('./lib/first-run-guard')
      if (await isSetupOpen()) {
        const { ensureSetupToken } = await import('./lib/first-run-token')
        ensureSetupToken()
      }
    } catch (err) {
      console.error('[instrumentation] Setup token check failed:', err)
    }

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
