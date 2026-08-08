/**
 * KB Gap Aggregation Worker & Session Cleanup Worker
 *
 * Scheduled pg-boss jobs:
 * 1. kb.gap.aggregate — Processes AI chat messages flagged as KB gaps.
 *    Aggregates similar questions into topics, tracks occurrence frequency,
 *    and auto-creates draft KB articles when a threshold is reached.
 *    Runs hourly via pg-boss cron scheduling.
 *
 * 2. ai.session.cleanup — Archives (soft-deletes) expired AI chat sessions.
 *    Runs daily. Respects per-org session_retention_days from ai_settings.
 */

import { getQueue } from '@/lib/queue'
import { pool, query, queryOne } from '@/lib/db'

const QUEUE_NAME = 'kb.gap.aggregate'
const SESSION_CLEANUP_QUEUE = 'ai.session.cleanup'

// Phrases that indicate the AI labeled a topic for us
const TOPIC_LABEL_PROMPT = `You are a topic classifier for an IT support knowledge base. Given the user question below, return a short topic label (3-5 words) that describes what knowledge base article would answer this question. Return ONLY the topic label, nothing else. No quotes, no explanation.

User question: `

/**
 * Register the KB gap aggregation cron job with pg-boss.
 * Runs every hour.
 */
export async function registerKbGapWorker(): Promise<void> {
  const queue = await getQueue()

  // pg-boss v12: queue must exist before schedule()
  await queue.createQueue(QUEUE_NAME)

  // Schedule hourly
  await queue.schedule(QUEUE_NAME, '0 * * * *', {}, {
    retryLimit: 2,
    retryDelay: 300,
  })

  await queue.work(QUEUE_NAME, { batchSize: 1 }, async () => {
    await processKbGaps()
  })

  console.log('[pg-boss] KB gap aggregation worker registered (hourly)')
}

/**
 * Main processing function — finds unprocessed KB gap messages
 * and aggregates them into kb_gaps rows.
 */
async function processKbGaps(): Promise<void> {
  // Get all organizations that have AI settings
  const orgs = await query<{ organization_id: string; auto_draft_threshold: number }>(
    `SELECT organization_id, auto_draft_threshold FROM ai_settings WHERE auto_draft_threshold > 0`
  )

  for (const org of orgs) {
    try {
      await processOrgGaps(org.organization_id, org.auto_draft_threshold)
    } catch (error) {
      console.error(`[KB Gap] Error processing org ${org.organization_id}:`, error)
    }
  }
}

/**
 * Process KB gaps for a single organization.
 */
async function processOrgGaps(orgId: string, autoDraftThreshold: number): Promise<void> {
  // Fetch unprocessed KB gap messages (assistant messages flagged as gaps)
  const gapMessages = await query<{
    id: string
    session_id: string
    content: string
    metadata: Record<string, any> | null
    created_at: string
  }>(
    `SELECT m.id, m.session_id, m.content, m.metadata, m.created_at
     FROM ai_chat_messages m
     JOIN ai_chat_sessions s ON m.session_id = s.id
     WHERE s.organization_id = $1
       AND m.kb_gap = true
       AND m.kb_gap_processed = false
       AND m.role = 'assistant'
     ORDER BY m.created_at ASC
     LIMIT 50`,
    [orgId]
  )

  if (gapMessages.length === 0) return

  // Get AI provider for topic labeling
  const provider = await getAIProvider(orgId)

  for (const msg of gapMessages) {
    try {
      // Get the user's question (previous message in session by created_at)
      const userMessage = await queryOne<{ content: string }>(
        `SELECT content FROM ai_chat_messages
         WHERE session_id = $1 AND role = 'user' AND created_at < $2
         ORDER BY created_at DESC LIMIT 1`,
        [msg.session_id, msg.created_at]
      )

      if (!userMessage?.content) {
        // Mark as processed even if no user message found
        await query(
          'UPDATE ai_chat_messages SET kb_gap_processed = true WHERE id = $1',
          [msg.id]
        )
        continue
      }

      const userQuestion = userMessage.content.trim()

      // Get topic label from AI (or fallback to truncated question)
      let topicLabel: string
      if (provider) {
        topicLabel = await getTopicLabel(userQuestion, provider)
      } else {
        // Fallback: use first 50 chars of question as topic
        topicLabel = userQuestion.slice(0, 50).replace(/[?!.]+$/, '').trim()
      }

      if (!topicLabel || topicLabel.length < 2) {
        topicLabel = userQuestion.slice(0, 50).replace(/[?!.]+$/, '').trim()
      }

      // Normalize topic: lowercase, trim, remove trailing punctuation
      topicLabel = topicLabel.replace(/^["']|["']$/g, '').trim()
      if (topicLabel.length > 200) {
        topicLabel = topicLabel.slice(0, 197) + '...'
      }

      // Check for existing gap with fuzzy match
      const existingGap = await queryOne<{
        id: string
        occurrence_count: number
        sample_questions: string[]
        search_queries: string[]
        status: string
        draft_article_id: string | null
      }>(
        `SELECT id, occurrence_count, sample_questions, search_queries, status, draft_article_id
         FROM kb_gaps
         WHERE organization_id = $1
           AND status IN ('open', 'draft_created')
           AND (
             LOWER(topic) = LOWER($2)
             OR topic ILIKE '%' || $2 || '%'
             OR $2 ILIKE '%' || topic || '%'
           )
         ORDER BY occurrence_count DESC
         LIMIT 1`,
        [orgId, topicLabel]
      )

      const searchQueries = msg.metadata?.search_queries || [userQuestion]

      if (existingGap) {
        // Update existing gap: increment count, append sample question (max 5)
        const updatedSamples = existingGap.sample_questions || []
        if (updatedSamples.length < 5 && !updatedSamples.includes(userQuestion)) {
          updatedSamples.push(userQuestion)
        }

        const updatedSearchQueries = existingGap.search_queries || []
        for (const sq of searchQueries) {
          if (updatedSearchQueries.length < 10 && !updatedSearchQueries.includes(sq)) {
            updatedSearchQueries.push(sq)
          }
        }

        await query(
          `UPDATE kb_gaps
           SET occurrence_count = occurrence_count + 1,
               sample_questions = $1,
               search_queries = $2,
               last_seen_at = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [updatedSamples, updatedSearchQueries, existingGap.id]
        )

        // Check if we should auto-create a draft article
        const newCount = existingGap.occurrence_count + 1
        if (
          newCount >= autoDraftThreshold &&
          !existingGap.draft_article_id &&
          existingGap.status === 'open'
        ) {
          await createDraftArticle(orgId, existingGap.id, topicLabel, updatedSamples)
        }
      } else {
        // Create new gap
        const newGap = await queryOne<{ id: string; occurrence_count: number }>(
          `INSERT INTO kb_gaps (organization_id, topic, search_queries, sample_questions, occurrence_count, first_seen_at, last_seen_at)
           VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
           RETURNING id, occurrence_count`,
          [orgId, topicLabel, searchQueries, [userQuestion]]
        )

        // Check if threshold is 1 (auto-draft on first occurrence)
        if (newGap && autoDraftThreshold <= 1) {
          await createDraftArticle(orgId, newGap.id, topicLabel, [userQuestion])
        }
      }

      // Mark message as processed
      await query(
        'UPDATE ai_chat_messages SET kb_gap_processed = true WHERE id = $1',
        [msg.id]
      )
    } catch (error) {
      console.error(`[KB Gap] Failed to process message ${msg.id}:`, error)
      // Mark as processed to avoid infinite retry on bad messages
      await query(
        'UPDATE ai_chat_messages SET kb_gap_processed = true WHERE id = $1',
        [msg.id]
      ).catch(() => {})
    }
  }
}

/**
 * Create a draft KB article from a gap topic.
 */
async function createDraftArticle(
  orgId: string,
  gapId: string,
  topic: string,
  sampleQuestions: string[]
): Promise<void> {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    + '-' + Date.now().toString(36)

  const questionsMarkdown = sampleQuestions
    .map(q => `- ${q}`)
    .join('\n')

  const body = `# ${topic}

> This article was auto-generated by Aegis KB Gap Detection. Users have asked about this topic ${sampleQuestions.length} time(s) without finding a matching article.

## Sample Questions

${questionsMarkdown}

## Suggested Content

*Replace this section with the actual answer. Use the sample questions above to understand what users are looking for.*

---

**Status:** Draft - Needs review and content before publishing.
`

  const article = await queryOne<{ id: string }>(
    `INSERT INTO kb_articles (organization_id, title, slug, content, content_plain, status, visibility, source)
     VALUES ($1, $2, $3, $4, $5, 'draft', 'internal', 'ai_gap')
     RETURNING id`,
    [orgId, topic, slug, body, body]
  )

  if (article) {
    await query(
      `UPDATE kb_gaps
       SET draft_article_id = $1, status = 'draft_created', updated_at = NOW()
       WHERE id = $2`,
      [article.id, gapId]
    )
    console.log(`[KB Gap] Auto-created draft article for topic: "${topic}" (gap: ${gapId})`)
  }
}

// ============================================================================
// AI Provider helpers for topic labeling
// ============================================================================

interface AIProviderInfo {
  api_url: string
  api_key_encrypted: string | null
  provider_type: string
  model_name: string
  is_local: boolean
}

async function getAIProvider(orgId: string): Promise<AIProviderInfo | null> {
  const provider = await queryOne<{
    api_url: string
    api_key_encrypted: string | null
    provider_type: string
    is_local: boolean
    id: string
  }>(
    `SELECT id, api_url, api_key_encrypted, provider_type, is_local
     FROM ai_providers
     WHERE organization_id = $1 AND is_active = true
     ORDER BY is_default DESC, created_at DESC
     LIMIT 1`,
    [orgId]
  )

  if (!provider) return null

  const model = await queryOne<{ model_name: string }>(
    `SELECT model_name FROM ai_models
     WHERE provider_id = $1 AND is_active = true
     ORDER BY is_default DESC LIMIT 1`,
    [provider.id]
  )

  return {
    api_url: provider.api_url,
    api_key_encrypted: provider.api_key_encrypted,
    provider_type: provider.provider_type,
    model_name: model?.model_name || (provider.is_local ? 'llama3.2' : 'gpt-3.5-turbo'),
    is_local: provider.is_local,
  }
}

/**
 * Use AI to generate a short topic label from a user question.
 */
async function getTopicLabel(question: string, provider: AIProviderInfo): Promise<string> {
  try {
    const prompt = TOPIC_LABEL_PROMPT + question.slice(0, 500)

    switch (provider.provider_type) {
      case 'ollama': {
        const res = await fetch(`${provider.api_url}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: provider.model_name,
            messages: [
              { role: 'system', content: 'You are a topic classifier. Return only a 3-5 word topic label.' },
              { role: 'user', content: prompt },
            ],
            stream: false,
            options: { temperature: 0.1 },
          }),
        })
        if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
        const data = await res.json()
        return (data.message?.content || '').trim()
      }

      case 'google': {
        const key = provider.api_key_encrypted || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
        if (!key) throw new Error('No Gemini API key')
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: 'You are a topic classifier. Return only a 3-5 word topic label.' }] },
              generationConfig: { temperature: 0.1, maxOutputTokens: 50 },
            }),
          }
        )
        if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
        const data = await res.json()
        return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
      }

      default: {
        // OpenAI-compatible
        const res = await fetch(`${provider.api_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.api_key_encrypted || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model_name,
            messages: [
              { role: 'system', content: 'You are a topic classifier. Return only a 3-5 word topic label.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 50,
          }),
        })
        if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
        const data = await res.json()
        return (data.choices?.[0]?.message?.content || '').trim()
      }
    }
  } catch (error) {
    console.error('[KB Gap] Topic labeling failed:', error)
    // Return empty — caller will use fallback
    return ''
  }
}

// ============================================================================
// Session Cleanup Worker (Phase 7.1)
// ============================================================================

/**
 * Register the AI session cleanup cron job with pg-boss.
 * Runs daily at 3 AM UTC.
 *
 * For each organization, reads session_retention_days from ai_settings
 * and archives (soft-deletes) sessions older than that threshold.
 */
export async function registerSessionCleanupWorker(): Promise<void> {
  const queue = await getQueue()

  await queue.createQueue(SESSION_CLEANUP_QUEUE)

  // Schedule daily at 3 AM UTC
  await queue.schedule(SESSION_CLEANUP_QUEUE, '0 3 * * *', {}, {
    retryLimit: 2,
    retryDelay: 600,
  })

  await queue.work(SESSION_CLEANUP_QUEUE, { batchSize: 1 }, async () => {
    await cleanupExpiredSessions()
  })

  console.log('[pg-boss] AI session cleanup worker registered (daily at 3 AM UTC)')
}

/**
 * Archive expired AI chat sessions for all organizations.
 * "Archive" = set status to 'archived' (soft approach, no hard delete).
 */
async function cleanupExpiredSessions(): Promise<void> {
  // Get all organizations with AI settings and their retention config
  const orgs = await query<{ organization_id: string; session_retention_days: number }>(
    'SELECT organization_id, session_retention_days FROM ai_settings WHERE session_retention_days > 0'
  )

  let totalArchived = 0

  for (const org of orgs) {
    try {
      const result = await pool.query(
        `UPDATE ai_chat_sessions
         SET status = 'archived', updated_at = NOW()
         WHERE organization_id = $1
           AND status = 'active'
           AND updated_at < NOW() - ($2 || ' days')::INTERVAL
         RETURNING id`,
        [org.organization_id, org.session_retention_days.toString()]
      )

      const archivedCount = result.rowCount || 0
      if (archivedCount > 0) {
        totalArchived += archivedCount
        console.log(`[Session Cleanup] Archived ${archivedCount} sessions for org ${org.organization_id} (retention: ${org.session_retention_days} days)`)
      }
    } catch (error) {
      console.error(`[Session Cleanup] Error processing org ${org.organization_id}:`, error)
    }
  }

  if (totalArchived > 0) {
    console.log(`[Session Cleanup] Total archived: ${totalArchived} sessions`)
  }
}
