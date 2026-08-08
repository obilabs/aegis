import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { getOrgId } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId()
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'active'

    // Map status filter to database statuses
    let statusValues: string[]
    switch (status) {
      case 'active':
        statusValues = ['pending', 'in_progress']
        break
      case 'completed':
        statusValues = ['completed']
        break
      case 'all':
        statusValues = ['pending', 'in_progress', 'completed', 'cancelled']
        break
      default:
        statusValues = ['pending', 'in_progress']
    }

    // Query onboarding requests with contacts, managers, and buddies
    const requestsResult = await pool.query(`
      SELECT
        obreq.id,
        obreq.ticket_id,
        obreq.job_title_name,
        obreq.department,
        obreq.start_date,
        obreq.status,
        obreq.total_tasks,
        obreq.completed_tasks,
        obreq.notes,
        obreq.created_at,
        CONCAT(c.first_name, ' ', c.last_name) as person_name,
        c.email as person_email,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        CONCAT(b.first_name, ' ', b.last_name) as buddy_name
      FROM onboarding_requests obreq
      LEFT JOIN contacts c ON obreq.contact_id = c.id
      LEFT JOIN users m ON obreq.manager_id = m.id
      LEFT JOIN users b ON obreq.buddy_id = b.id
      WHERE obreq.organization_id = $1
        AND obreq.status = ANY($2)
      ORDER BY obreq.start_date ASC, obreq.created_at ASC
    `, [orgId, statusValues])

    // If no onboarding requests found, return empty matrix
    if (requestsResult.rows.length === 0) {
      return NextResponse.json({
        people: [],
        service_categories: [],
        matrix: {},
      })
    }

    // Get all ticket_ids from the onboarding requests
    const ticketIds = requestsResult.rows
      .map((r: any) => r.ticket_id)
      .filter(Boolean)

    // Query ticket tasks for all related tickets
    const tasksResult = await pool.query(`
      SELECT
        tt.id as task_id,
        tt.ticket_id,
        tt.title,
        tt.service_category,
        tt.is_completed,
        tt.is_required,
        tt.assigned_to,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name
      FROM ticket_tasks tt
      LEFT JOIN users u ON tt.assigned_to = u.id
      WHERE tt.ticket_id = ANY($1)
        AND tt.organization_id = $2
        AND tt.service_category IS NOT NULL
      ORDER BY tt.sort_order ASC, tt.created_at ASC
    `, [ticketIds, orgId])

    // Build people array
    const people = requestsResult.rows.map((row: any) => ({
      id: row.id,
      ticket_id: row.ticket_id,
      person_name: row.person_name,
      person_email: row.person_email,
      job_title_name: row.job_title_name,
      department: row.department,
      start_date: row.start_date,
      manager_name: row.manager_name,
      buddy_name: row.buddy_name,
      status: row.status,
      progress: {
        completed: row.completed_tasks || 0,
        total: row.total_tasks || 0,
      },
    }))

    // Build service_categories array with counts
    const categoryMap = new Map<string, { total: number; completed: number }>()
    for (const task of tasksResult.rows) {
      const cat = task.service_category
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { total: 0, completed: 0 })
      }
      const entry = categoryMap.get(cat)!
      entry.total++
      if (task.is_completed) {
        entry.completed++
      }
    }

    const service_categories = Array.from(categoryMap.entries()).map(([key, counts]) => ({
      key,
      label: toTitleCase(key),
      total: counts.total,
      completed: counts.completed,
    }))

    // Build matrix: keyed by ticket_id, then by service_category
    const matrix: Record<string, Record<string, any>> = {}
    for (const task of tasksResult.rows) {
      const tid = task.ticket_id
      if (!matrix[tid]) {
        matrix[tid] = {}
      }
      matrix[tid][task.service_category] = {
        task_id: task.task_id,
        title: task.title,
        is_completed: task.is_completed,
        is_required: task.is_required,
        assigned_to_name: task.assigned_to_name,
      }
    }

    return NextResponse.json({
      people,
      service_categories,
      matrix,
    })
  } catch (error) {
    console.error('Error fetching operations board:', error)
    return NextResponse.json({ error: 'Failed to fetch operations board' }, { status: 500 })
  }
}
