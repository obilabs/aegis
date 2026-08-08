import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal/categories/[id]/template
 *
 * Returns the description_template and subject_prefix for a category.
 * Used by the ticket creation form to load category-specific templates.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const category = await queryOne<{
      description_template: string | null
      subject_prefix: string | null
    }>(
      `SELECT description_template, subject_prefix
       FROM ticket_categories
       WHERE id = $1`,
      [id]
    )

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({
      description_template: category.description_template,
      subject_prefix: category.subject_prefix,
    })
  } catch (error) {
    console.error('Error fetching category template:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}
