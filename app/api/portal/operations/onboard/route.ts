import { pool } from '@/lib/db'
import { getAuthContext } from '@/lib/org'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session, userId, orgId } = ctx
    const body = await request.json()

    const { job_title_id, person, removed_entitlements, additional_notes } = body

    // Validate required fields
    if (!job_title_id) {
      return NextResponse.json({ error: 'job_title_id is required' }, { status: 400 })
    }
    if (!person?.first_name?.trim()) {
      return NextResponse.json({ error: 'person.first_name is required' }, { status: 400 })
    }
    if (!person?.last_name?.trim()) {
      return NextResponse.json({ error: 'person.last_name is required' }, { status: 400 })
    }
    if (!person?.email?.trim()) {
      return NextResponse.json({ error: 'person.email is required' }, { status: 400 })
    }
    if (!person?.start_date) {
      return NextResponse.json({ error: 'person.start_date is required' }, { status: 400 })
    }

    // Verify job title exists and is active
    const jobTitleResult = await pool.query(`
      SELECT id, name, department FROM job_titles
      WHERE id = $1 AND organization_id = $2 AND is_active = true
    `, [job_title_id, orgId])

    if (jobTitleResult.rows.length === 0) {
      return NextResponse.json({ error: 'Job title not found or inactive' }, { status: 404 })
    }

    const jobTitle = jobTitleResult.rows[0]

    // Get entitlements for the job title
    const entitlementsResult = await pool.query(`
      SELECT * FROM job_title_entitlements
      WHERE job_title_id = $1 AND organization_id = $2
      ORDER BY sort_order ASC
    `, [job_title_id, orgId])

    // Filter out removed entitlements (in JavaScript)
    const removedSet = new Set(removed_entitlements || [])
    const entitlements = entitlementsResult.rows.filter(
      (e: any) => !removedSet.has(e.id)
    )

    // Find or create contact
    const existingContact = await pool.query(
      'SELECT id FROM contacts WHERE organization_id = $1 AND email = $2',
      [orgId, person.email.trim()]
    )

    let contactId: string
    if (existingContact.rows.length > 0) {
      contactId = existingContact.rows[0].id
    } else {
      const newContact = await pool.query(`
        INSERT INTO contacts (organization_id, first_name, last_name, email, title, department, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id
      `, [
        orgId,
        person.first_name.trim(),
        person.last_name.trim(),
        person.email.trim(),
        jobTitle.name,
        jobTitle.department,
      ])
      contactId = newContact.rows[0].id
    }

    // Get default ticket status
    const statusResult = await pool.query(
      'SELECT id FROM ticket_statuses WHERE organization_id = $1 AND is_default = true LIMIT 1',
      [orgId]
    )
    const statusId = statusResult.rows[0]?.id || null

    // Build ticket subject and description
    const subject = `Onboarding: ${person.first_name.trim()} ${person.last_name.trim()} - ${jobTitle.name}`
    const description = `Onboarding request for ${person.first_name.trim()} ${person.last_name.trim()} (${jobTitle.name}, ${jobTitle.department || 'No Department'}). Start date: ${person.start_date}.${additional_notes ? '\n\nNotes: ' + additional_notes : ''}`

    // Create the onboarding ticket
    const ticketResult = await pool.query(`
      INSERT INTO tickets (
        organization_id, subject, description, priority, type,
        status_id, contact_id, source, assigned_to, created_by
      ) VALUES ($1, $2, $3, 'medium', 'request', $4, $5, 'portal', $6, $6)
      RETURNING id, ticket_number, prefix
    `, [
      orgId,
      subject,
      description,
      statusId,
      contactId,
      userId,
    ])

    const ticket = ticketResult.rows[0]

    // Create ticket_tasks from each entitlement
    for (let i = 0; i < entitlements.length; i++) {
      const ent = entitlements[i]

      // Resolve assigned_to based on default_assignee_type
      let assignedTo: string | null = null
      switch (ent.default_assignee_type) {
        case 'it_admin':
          assignedTo = null
          break
        case 'manager':
          assignedTo = person.manager_id || null
          break
        case 'buddy':
          assignedTo = person.buddy_id || null
          break
        case 'app_owner':
        case 'hardware_approver':
        case 'hr':
          assignedTo = ent.default_assignee_id || null
          break
        default:
          assignedTo = ent.default_assignee_id || null
          break
      }

      await pool.query(`
        INSERT INTO ticket_tasks (
          ticket_id, organization_id, title, description,
          service_category, is_required, assigned_to, sort_order, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        ticket.id,
        orgId,
        ent.task_title || ent.resource_name,
        ent.task_description || null,
        ent.service_category || null,
        ent.is_required !== false,
        assignedTo,
        i,
        userId,
      ])
    }

    // Create the onboarding_request record
    const onboardingResult = await pool.query(`
      INSERT INTO onboarding_requests (
        organization_id, contact_id, job_title_id, job_title_name,
        department, start_date, manager_id, buddy_id, initiated_by,
        location_id, ticket_id, status, total_tasks, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'in_progress', $12, $13)
      RETURNING id
    `, [
      orgId,
      contactId,
      job_title_id,
      jobTitle.name,
      jobTitle.department || null,
      person.start_date,
      person.manager_id || null,
      person.buddy_id || null,
      userId,
      person.location_id || null,
      ticket.id,
      entitlements.length,
      additional_notes || null,
    ])

    return NextResponse.json({
      onboarding_request_id: onboardingResult.rows[0].id,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      prefix: ticket.prefix,
      tasks_created: entitlements.length,
      person_name: `${person.first_name.trim()} ${person.last_name.trim()}`,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating onboarding request:', error)
    return NextResponse.json({ error: 'Failed to create onboarding request' }, { status: 500 })
  }
}
