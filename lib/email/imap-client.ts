/**
 * IMAP client wrapper around `imapflow` (D26).
 *
 *   - Polled, not IDLE (60s default; deferred to v1.x)
 *   - Tracks `last_uid_seen` + `last_uidvalidity` per mailbox in our DB
 *   - UIDVALIDITY change → fall back to date-based SEARCH SINCE
 *   - Default post-process: `passive` (don't touch the inbox)
 *   - First-poll guard: backfill window 0-90 days; default 0 = "start from now"
 *
 * The client is stateless — each poll opens a connection, fetches new mail,
 * applies the post-process action per message, and closes. Concurrency is
 * one in-flight job per mailbox (enforced by the pg-boss queue).
 */

import { ImapFlow, type FetchMessageObject } from 'imapflow'

export type PostProcessMode = 'passive' | 'mark_seen' | 'move_processed' | 'delete_processed'

export interface MailboxConnection {
  host: string
  port: number
  useTls: boolean
  username: string
  password: string
  folder: string
}

export interface PollState {
  /** Last UID we successfully ingested. NULL on first poll for this mailbox. */
  lastUidSeen: number | null
  /** Server's UIDVALIDITY when we last polled. NULL on first poll. */
  lastUidValidity: number | null
  /** First-poll-guard window. 0 = "no backfill, start from now". */
  backfillDaysOnActivation: number
}

export interface FetchedMessage {
  uid: number
  uidValidity: number
  /** Raw RFC 822 message, ready for `parseEmail`. */
  source: Buffer
  /** UNIX timestamp ms of when the server received it. */
  internalDate: Date | null
}

export interface PollResult {
  /** New UIDVALIDITY observed; persist to last_uidvalidity. */
  uidValidity: number
  /** Highest UID we've now seen; persist to last_uid_seen. */
  highestUidSeen: number
  /** Messages fetched, oldest first. */
  messages: FetchedMessage[]
  /** True if UIDVALIDITY rolled and we used the date-fallback SEARCH SINCE path. */
  uidvalidityChanged: boolean
}

export interface PostProcessOptions {
  mode: PostProcessMode
  /** Folder to move into when mode='move_processed'. Default: 'Aegis-Processed'. */
  processedFolder?: string
}

/**
 * Connect to the IMAP server, open the configured folder, run the
 * appropriate fetch strategy, and disconnect. Returns nothing if there's
 * no new mail. Throws on connection / auth / parse failures — the caller
 * (poller) catches and writes the failure mode to inbound_mailboxes.last_poll_status.
 */
export async function pollMailbox(
  conn: MailboxConnection,
  state: PollState,
): Promise<PollResult> {
  const client = new ImapFlow({
    host: conn.host,
    port: conn.port,
    secure: conn.useTls,
    auth: { user: conn.username, pass: conn.password },
    logger: false, // imapflow logs verbosely by default; quiet in production
    emitLogs: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(conn.folder)
    try {
      const mailbox = client.mailbox
      if (!mailbox || typeof mailbox === 'boolean') {
        throw new Error(`mailbox state unavailable for folder=${conn.folder}`)
      }
      const uidValidity = Number(mailbox.uidValidity)
      const messages: FetchedMessage[] = []
      let uidvalidityChanged = false

      // ----- Decide which fetch strategy to use ------------------------------
      // Three cases:
      //   A. First poll for this mailbox (lastUidValidity null)
      //      - backfill_days = 0 → start from now: fetch nothing, set last_uid_seen
      //        to the current highest UID
      //      - backfill_days > 0 → SEARCH SINCE today-N
      //   B. Normal incremental poll (uidvalidity matches)
      //      - fetch UID > last_uid_seen
      //   C. UIDVALIDITY changed (rare; folder renumbered server-side)
      //      - SEARCH SINCE last_poll_at - 1 day; flag uidvalidityChanged

      if (state.lastUidValidity === null) {
        // Case A — first poll
        if (state.backfillDaysOnActivation > 0) {
          const since = new Date(Date.now() - state.backfillDaysOnActivation * 86400_000)
          const uids = await client.search({ since }, { uid: true })
          if (uids && uids.length > 0) {
            for await (const msg of client.fetch(uids, sourceFetchSpec(), { uid: true })) {
              messages.push(toFetchedMessage(msg, uidValidity))
            }
          }
        }
        // else: backfill = 0 — return empty messages; caller persists the
        // current highest UID so we don't ingest existing mail.
      } else if (Number(state.lastUidValidity) === uidValidity) {
        // Case B — incremental
        const lastSeen = state.lastUidSeen ?? 0
        const range = `${lastSeen + 1}:*`
        // imapflow's range fetch with UID > lastSeen — short circuit if there's nothing.
        // The `*` resolves server-side to the current max; if lastSeen+1 > max,
        // imapflow returns no messages.
        try {
          for await (const msg of client.fetch(range, sourceFetchSpec(), { uid: true })) {
            // Defensive: skip anything <= lastSeen (server can echo lastSeen
            // in some edge cases when range is empty)
            if (Number(msg.uid) <= lastSeen) continue
            messages.push(toFetchedMessage(msg, uidValidity))
          }
        } catch (err) {
          // Some servers reject `N:*` when N > max+1. Treat as "no new mail".
          const message = err instanceof Error ? err.message : String(err)
          if (!/no message|invalid uid/i.test(message)) throw err
        }
      } else {
        // Case C — UIDVALIDITY change
        uidvalidityChanged = true
        const since = new Date(Date.now() - 86400_000) // 24h fallback window
        const uids = await client.search({ since }, { uid: true })
        if (uids && uids.length > 0) {
          for await (const msg of client.fetch(uids, sourceFetchSpec(), { uid: true })) {
            messages.push(toFetchedMessage(msg, uidValidity))
          }
        }
      }

      // Sort oldest-first so the poller processes in arrival order.
      messages.sort((a, b) => a.uid - b.uid)

      const highestUidSeen = messages.length > 0
        ? messages[messages.length - 1].uid
        : (state.lastUidValidity === null
            ? Number(mailbox.uidNext ? mailbox.uidNext - 1 : 0)
            : state.lastUidSeen ?? 0)

      return {
        uidValidity,
        highestUidSeen,
        messages,
        uidvalidityChanged,
      }
    } finally {
      lock.release()
    }
  } finally {
    try {
      await client.logout()
    } catch {
      // Best-effort close; ignore any logout-time errors.
    }
  }
}

/**
 * Apply the configured post-process action to a single ingested message.
 * Called by the poller AFTER the message has been successfully persisted
 * (parsed, threaded, ticket created/appended, log row written). Failures
 * here MUST NOT roll back the ingest — log and continue.
 */
export async function applyPostProcess(
  conn: MailboxConnection,
  uid: number,
  opts: PostProcessOptions,
): Promise<void> {
  if (opts.mode === 'passive') return // most common — no server-side change

  const client = new ImapFlow({
    host: conn.host,
    port: conn.port,
    secure: conn.useTls,
    auth: { user: conn.username, pass: conn.password },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    const lock = await client.getMailboxLock(conn.folder)
    try {
      switch (opts.mode) {
        case 'mark_seen':
          await client.messageFlagsAdd(`${uid}:${uid}`, ['\\Seen'], { uid: true })
          break
        case 'move_processed': {
          const target = opts.processedFolder || 'Aegis-Processed'
          await ensureFolderExists(client, target)
          await client.messageMove(`${uid}:${uid}`, target, { uid: true })
          break
        }
        case 'delete_processed':
          await client.messageFlagsAdd(`${uid}:${uid}`, ['\\Deleted'], { uid: true })
          break
      }
    } finally {
      lock.release()
    }
  } finally {
    try {
      await client.logout()
    } catch {
      // ignore
    }
  }
}

async function ensureFolderExists(client: ImapFlow, folder: string): Promise<void> {
  // imapflow doesn't have a `mailboxExists` — probe via status(), which
  // throws if the folder doesn't exist. On NO/BAD response, attempt create.
  try {
    await client.status(folder, { messages: true })
    return
  } catch {
    // fall through to create
  }
  try {
    await client.mailboxCreate(folder)
  } catch {
    // ALREADYEXISTS or race — best-effort.
  }
}

function sourceFetchSpec() {
  return {
    uid: true,
    source: true,
    internalDate: true,
  }
}

function toFetchedMessage(msg: FetchMessageObject, uidValidity: number): FetchedMessage {
  const source = msg.source as Buffer | string | undefined
  if (source === undefined) {
    throw new Error(`fetched message uid=${msg.uid} returned no source`)
  }
  let internalDate: Date | null = null
  if (msg.internalDate instanceof Date) {
    internalDate = msg.internalDate
  } else if (typeof msg.internalDate === 'string') {
    const d = new Date(msg.internalDate)
    if (!Number.isNaN(d.getTime())) internalDate = d
  }

  return {
    uid: Number(msg.uid),
    uidValidity,
    source: Buffer.isBuffer(source) ? source : Buffer.from(source),
    internalDate,
  }
}

/**
 * Test connection without persisting state. Used by the admin UI's
 * "test connection" button. Returns `{ ok: true, folderExists: bool }` or
 * throws with a specific error mode for the UI to surface.
 */
export async function testMailboxConnection(
  conn: MailboxConnection,
): Promise<{ ok: true; folderExists: boolean }> {
  const client = new ImapFlow({
    host: conn.host,
    port: conn.port,
    secure: conn.useTls,
    auth: { user: conn.username, pass: conn.password },
    logger: false,
    emitLogs: false,
  })

  try {
    await client.connect()
    let folderExists = false
    try {
      await client.status(conn.folder, { messages: true })
      folderExists = true
    } catch {
      // status throws on missing folder → folderExists stays false
    }
    return { ok: true, folderExists }
  } finally {
    try {
      await client.logout()
    } catch {
      // ignore
    }
  }
}
