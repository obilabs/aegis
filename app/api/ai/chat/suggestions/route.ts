import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'

/**
 * GET /api/ai/chat/suggestions
 * Returns contextual chat suggestions derived from real data:
 * 1. User's recent ticket subjects (personalized)
 * 2. Most-viewed KB articles (org-wide popular topics)
 * 3. Common ticket categories (org-wide patterns)
 * Falls back to generic IT suggestions only for new installs with no data.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, orgId } = ctx
  const suggestions: string[] = []

  try {
    // 1. User's recent ticket subjects (up to 2)
    const recentTickets = await pool.query(
      `SELECT t.subject FROM tickets t
       WHERE t.organization_id = $1
         AND t.created_by = $2
       ORDER BY t.created_at DESC
       LIMIT 2`,
      [orgId, userId]
    )
    for (const row of recentTickets.rows) {
      if (row.subject && suggestions.length < 4) {
        // Trim long subjects and frame as a question
        const subject = (row.subject as string).slice(0, 80)
        suggestions.push(`Help with: ${subject}`)
      }
    }

    // 2. Popular KB articles (most viewed, up to 2)
    // AUTHZ (audit 2026-07-26): restrict to what ANY authenticated caller may
    // see — public + authenticated. Never surface titles of 'internal'
    // (staff-only) or 'private' (targeted) articles here; this endpoint is not
    // role-resolved, and the AI must not leak internal article names as hints.
    const popularArticles = await pool.query(
      `SELECT a.title FROM kb_articles a
       WHERE a.organization_id = $1
         AND a.status = 'published'
         AND a.is_deleted = false
         AND a.view_count > 0
         AND a.visibility IN ('public', 'authenticated')
       ORDER BY a.view_count DESC
       LIMIT 3`,
      [orgId]
    )
    for (const row of popularArticles.rows) {
      if (row.title && suggestions.length < 4) {
        suggestions.push(row.title as string)
      }
    }

    // 3. Common ticket type names as prompts (fill remaining slots)
    if (suggestions.length < 4) {
      const ticketTypes = await pool.query(
        `SELECT tt.name, COUNT(t.id) as cnt
         FROM tickets t
         JOIN ticket_types tt ON t.type_id = tt.id
         WHERE t.organization_id = $1
         GROUP BY tt.name
         ORDER BY cnt DESC
         LIMIT 3`,
        [orgId]
      )
      for (const row of ticketTypes.rows) {
        if (suggestions.length < 4) {
          suggestions.push(`I need help with a ${(row.name as string).toLowerCase()}`)
        }
      }
    }

    // 4. Fallback for new installs with no data
    if (suggestions.length === 0) {
      suggestions.push(
        'How do I reset my password?',
        'I need help with a technical issue',
        'What software is available?',
        'How do I submit a request?'
      )
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 4) })
  } catch (error) {
    console.error('Failed to load chat suggestions:', error)
    // Fallback on error — never show empty suggestions
    return NextResponse.json({
      suggestions: [
        'How do I reset my password?',
        'I need help with a technical issue',
        'What software is available?',
        'How do I submit a request?',
      ],
    })
  }
}
