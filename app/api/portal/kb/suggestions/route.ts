import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId()

  try {
    // Frequently asked questions with no KB match
    // These are user messages from AI chat sessions where no KB articles were found
    const unansweredResult = await pool.query(`
      SELECT
        m.content as question,
        COUNT(*) as frequency,
        MAX(m.created_at) as last_asked
      FROM ai_chat_messages m
      JOIN ai_chat_sessions s ON m.session_id = s.id
      WHERE m.role = 'user'
        AND s.organization_id = $1
        AND NOT EXISTS (
          -- no assistant reply in the session cited a KB article
          SELECT 1 FROM ai_chat_messages am
          WHERE am.session_id = s.id
            AND am.role = 'assistant'
            AND COALESCE(array_length(am.kb_articles_referenced, 1), 0) > 0
        )
      GROUP BY m.content
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC, MAX(m.created_at) DESC
      LIMIT 20
    `, [orgId])

    // Ticket categories with low KB coverage
    // Shows categories that have lots of tickets but few published articles
    const underservedResult = await pool.query(`
      SELECT
        tc.name as category,
        tc.id as category_id,
        COUNT(DISTINCT t.id) as ticket_count,
        COALESCE(ka.article_count, 0) as article_count
      FROM tickets t
      JOIN ticket_categories tc ON t.category_id = tc.id
      WHERE t.organization_id = $1
        AND t.created_at > NOW() - INTERVAL '90 days'
      GROUP BY tc.id, tc.name
      HAVING COALESCE(
        (SELECT COUNT(*) FROM kb_articles a
         JOIN kb_categories kc ON a.category_id = kc.id
         WHERE LOWER(kc.name) = LOWER(tc.name)
           AND a.organization_id = $1
           AND a.status = 'published'),
        0
      ) < 3
      ORDER BY COUNT(DISTINCT t.id) DESC
      LIMIT 10
    `, [orgId])

    // Compute article_count inline since the HAVING subquery already checks it
    const underservedCategories = await Promise.all(
      underservedResult.rows.map(async (row: any) => {
        const countResult = await pool.query(`
          SELECT COUNT(*) as count FROM kb_articles a
          JOIN kb_categories kc ON a.category_id = kc.id
          WHERE LOWER(kc.name) = LOWER($1)
            AND a.organization_id = $2
            AND a.status = 'published'
        `, [row.category, orgId])
        return {
          ...row,
          article_count: parseInt(countResult.rows[0]?.count || '0', 10),
        }
      })
    )

    // Recent common ticket subjects (potential article topics)
    const commonTopicsResult = await pool.query(`
      SELECT
        t.subject,
        COUNT(*) as frequency,
        tc.name as category,
        MAX(t.created_at) as last_created
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      WHERE t.organization_id = $1
        AND t.created_at > NOW() - INTERVAL '30 days'
      GROUP BY t.subject, tc.name
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 15
    `, [orgId])

    return NextResponse.json({
      unansweredQuestions: unansweredResult.rows,
      underservedCategories,
      commonTopics: commonTopicsResult.rows,
    })
  } catch (error) {
    console.error('KB suggestions failed:', error)
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
  }
}
