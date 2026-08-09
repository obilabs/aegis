import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pool } from '@/lib/db'
import { seedSystemArticles } from '@/lib/seed-articles'
import { seedFeatureRegistry } from '@/lib/seed-feature-registry'
import { seedPolicyArticles } from '@/lib/seed-policies'
import { seedTrainingArticles } from '@/lib/seed-training'
import { seedProcedureArticles } from '@/lib/seed-procedures'
import { getPresetsForProfile } from '@/lib/features'
import { generateInstanceId, sendInstallPing, sendSetupSnapshot, setTelemetryTier } from '@/lib/telemetry'
import { setTelemetryEnabled } from '@/lib/telemetry-consent'

/**
 * Complete the setup wizard — creates organization + default data.
 *
 * Called by /portal/setup/wizard after admin account already exists.
 * Requires an authenticated session (the admin user).
 * Only works when no organization exists yet.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow if no organization exists yet
    const orgCheck = await pool.query('SELECT COUNT(*) as count FROM organizations')
    if (parseInt(orgCheck.rows[0].count, 10) > 0) {
      return NextResponse.json(
        { error: 'Organization already exists' },
        { status: 409 }
      )
    }

    const body = await request.json()
    const { company_name, industry, team_size, primary_use_case, features, telemetry_tier, telemetry_disabled } = body
    const telemetryEnabled = telemetry_disabled !== true

    const orgName = company_name?.trim() || 'My Organization'
    const instanceId = generateInstanceId()
    const tier = typeof telemetry_tier === 'number' ? Math.min(Math.max(telemetry_tier, 0), 2) : 0

    // Compute preset feature defaults, then merge with admin overrides from the wizard
    const { defaults: presetDefaults } = getPresetsForProfile(industry, team_size, primary_use_case)
    const mergedFeatures = { ...presetDefaults, ...(features || {}) }

    // Create organization with instance_id and telemetry tier.
    // license_key stays NULL — community installs have no key and fail safe
    // to community mode. A key is only ever issued by the control plane
    // (the old self-minted AEGIS-* key had no server-side landing; deleted).
    const orgResult = await pool.query(
      `INSERT INTO organizations (name, instance_id, telemetry_tier, settings)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        orgName,
        instanceId,
        tier,
        JSON.stringify({
          industry: industry || 'other',
          team_size: team_size || '1-5',
          primary_use_case: primary_use_case || 'all',
          features: mergedFeatures,
        }),
      ]
    )
    const orgId = orgResult.rows[0].id

    // Create ITSM user entry linked to the organization.
    //
    // Better Auth's user.id is a random text string (e.g.,
    // "8qGN3G08DKkZVku3yukZ1UcsSnPWd1FK"), NOT a UUID. The app's
    // `users.id` is `uuid DEFAULT gen_random_uuid()`. The two live in
    // separate tables (Better Auth `"user"`, app `users`) and are
    // bridged everywhere else in the codebase by matching on
    // `email` — see `lib/audit.ts` for the canonical resolver.
    //
    // Prior versions of this route tried to force
    // `INSERT INTO users (id, …) VALUES ($1::uuid, …)` with the Better
    // Auth id, which raises `invalid input syntax for type uuid`. The
    // fix is to let `users.id` auto-generate and keep the email link.
    await pool.query(
      `INSERT INTO users (organization_id, email, first_name, last_name, status, email_verified)
       VALUES ($1, $2, $3, $4, 'active', true)
       ON CONFLICT (organization_id, email) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         status = 'active',
         email_verified = true`,
      [
        orgId,
        session.user.email,
        session.user.name?.split(' ')[0] || 'Admin',
        session.user.name?.split(' ').slice(1).join(' ') || '',
      ]
    )

    // Initialize ticket statuses from templates (migration 025)
    // This copies all 15 status templates (New, Open, In Progress, Escalated,
    // Pending User, Pending Vendor, Pending Internal, Pending Approval,
    // Scheduled, Blocked, On Order, On Hold, Resolved, Closed, Cancelled)
    await pool.query('SELECT initialize_ticket_statuses($1)', [orgId])

    // Create default roles with structured permissions
    const defaultRoles = [
      {
        name: 'System Admin',
        description: 'Full system access with all capabilities',
        permissions: { capabilities: ['triage', 'bulk_actions', 'reports', 'settings', 'user_management', 'credentials'], ticket_access: 'all', admin_access: true },
      },
      {
        name: 'Helpdesk Admin',
        description: 'Manage tickets, triage, and run reports',
        permissions: { capabilities: ['triage', 'bulk_actions', 'reports'], ticket_access: 'all', admin_access: false },
      },
      {
        name: 'Technician',
        description: 'Handle tickets and manage assets',
        permissions: { capabilities: ['credentials'], ticket_access: 'team', admin_access: false },
      },
      {
        name: 'HR',
        description: 'HR staff with access to own tickets',
        permissions: { capabilities: [], ticket_access: 'own', admin_access: false },
      },
      {
        name: 'Manager',
        description: 'Team management with reporting access',
        permissions: { capabilities: ['reports'], ticket_access: 'team', admin_access: false },
      },
      {
        name: 'End User',
        description: 'Basic access to own tickets and knowledge base',
        permissions: { capabilities: [], ticket_access: 'own', admin_access: false },
      },
    ]

    let systemAdminRoleId: string | null = null
    for (const role of defaultRoles) {
      const roleResult = await pool.query(
        `INSERT INTO user_roles (organization_id, name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (organization_id, name) DO UPDATE SET permissions = $4
         RETURNING id`,
        [orgId, role.name, role.description, JSON.stringify(role.permissions)]
      )
      if (role.name === 'System Admin') {
        systemAdminRoleId = roleResult.rows[0].id
      }
    }

    // Assign admin user to System Admin role
    if (systemAdminRoleId) {
      await pool.query(
        `UPDATE users SET role_id = $1
         WHERE organization_id = $2 AND email = $3`,
        [systemAdminRoleId, orgId, session.user.email]
      )
    }

    // Seed default status transitions (which status changes are allowed)
    // Uses status names to look up IDs since they were just created by initialize_ticket_statuses()
    const transitions = [
      // From New: can go to Open, In Progress, Cancelled
      ['New', 'Open'], ['New', 'In Progress'], ['New', 'Cancelled'],
      // From Open: can go to most statuses
      ['Open', 'In Progress'], ['Open', 'Pending User'], ['Open', 'Pending Vendor'],
      ['Open', 'Pending Internal'], ['Open', 'Pending Approval'], ['Open', 'Scheduled'],
      ['Open', 'Blocked'], ['Open', 'On Order'], ['Open', 'On Hold'],
      ['Open', 'Escalated'], ['Open', 'Resolved'], ['Open', 'Cancelled'],
      // From In Progress: can go to pending, resolved, escalated
      ['In Progress', 'Open'], ['In Progress', 'Pending User'], ['In Progress', 'Pending Vendor'],
      ['In Progress', 'Pending Internal'], ['In Progress', 'Pending Approval'],
      ['In Progress', 'Escalated'], ['In Progress', 'Blocked'], ['In Progress', 'On Order'],
      ['In Progress', 'On Hold'], ['In Progress', 'Resolved'],
      // From Escalated: can go back to open states or resolve
      ['Escalated', 'Open'], ['Escalated', 'In Progress'], ['Escalated', 'Pending User'],
      ['Escalated', 'Pending Vendor'], ['Escalated', 'Resolved'],
      // From Pending states: can go back to open or resolve
      ['Pending User', 'Open'], ['Pending User', 'In Progress'], ['Pending User', 'Resolved'],
      ['Pending Vendor', 'Open'], ['Pending Vendor', 'In Progress'], ['Pending Vendor', 'Resolved'],
      ['Pending Internal', 'Open'], ['Pending Internal', 'In Progress'], ['Pending Internal', 'Resolved'],
      ['Pending Approval', 'Open'], ['Pending Approval', 'In Progress'], ['Pending Approval', 'Cancelled'],
      ['Scheduled', 'Open'], ['Scheduled', 'In Progress'], ['Scheduled', 'Cancelled'],
      ['Blocked', 'Open'], ['Blocked', 'In Progress'], ['Blocked', 'Cancelled'],
      ['On Order', 'Open'], ['On Order', 'In Progress'], ['On Order', 'Resolved'],
      ['On Hold', 'Open'], ['On Hold', 'In Progress'], ['On Hold', 'Cancelled'],
      // From Resolved: can reopen or close
      ['Resolved', 'Open'], ['Resolved', 'Closed'],
      // From Closed: can reopen
      ['Closed', 'Open'],
    ]

    // Batch lookup all status IDs for this org
    const statusLookup = await pool.query(
      `SELECT id, name FROM ticket_statuses WHERE organization_id = $1`,
      [orgId]
    )
    const statusMap = new Map<string, string>()
    for (const row of statusLookup.rows) {
      statusMap.set(row.name, row.id)
    }

    for (const [fromName, toName] of transitions) {
      const fromId = statusMap.get(fromName)
      const toId = statusMap.get(toName)
      if (fromId && toId) {
        await pool.query(
          `INSERT INTO ticket_status_transitions (organization_id, from_status_id, to_status_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (organization_id, from_status_id, to_status_id) DO NOTHING`,
          [orgId, fromId, toId]
        )
      }
    }

    // Create default ticket types with SLA targets and description templates
    await pool.query(
      `INSERT INTO ticket_types (organization_id, name, description, icon, color, default_priority, requires_approval, requires_resolution, sla_response_minutes, sla_resolution_minutes, display_order, description_template)
       VALUES
         ($1, 'Incident', 'Unplanned interruption or degradation of service', 'alert-triangle', '#EF4444', 'medium', false, true, 60, 480, 1,
          E'**What happened?**\n[Describe the issue you''re experiencing]\n\n**When did it start?**\n[Date/time when the issue began]\n\n**What have you tried?**\n[Steps you''ve already taken to fix it]'),
         ($1, 'Service Request', 'Formal request for something to be provided', 'shopping-cart', '#3B82F6', 'medium', false, true, 120, 1440, 2, NULL),
         ($1, 'Problem', 'Root cause of one or more incidents', 'search', '#8B5CF6', 'high', false, true, 240, 10080, 3,
          E'**Symptoms observed:**\n[Describe what is happening]\n\n**Affected services/systems:**\n[List affected systems]\n\n**Timeline of events:**\n[When did each symptom appear?]\n\n**Suspected root cause:**\n[Your best guess at what is causing this]'),
         ($1, 'Change Request', 'Request to modify IT infrastructure or services', 'git-branch', '#F59E0B', 'medium', true, true, 480, 40320, 4,
          E'**What is being changed?**\n[Describe the change]\n\n**Why is this change needed?**\n[Business justification]\n\n**What systems are affected?**\n[List systems and services impacted]\n\n**Implementation plan:**\n[Steps to implement the change]\n\n**Rollback plan:**\n[Steps to revert if something goes wrong]')
       ON CONFLICT (organization_id, name) DO NOTHING`,
      [orgId]
    )

    // Create default ticket categories with description templates
    const defaultCategories: { name: string; description: string; icon: string; display_order: number; description_template: string | null; subject_prefix: string | null }[] = [
      { name: 'General', description: 'General support requests', icon: 'chat-bubble-left', display_order: 0, description_template: null, subject_prefix: null },
      { name: 'Hardware', description: 'Hardware issues and requests', icon: 'computer-desktop', display_order: 1, subject_prefix: 'Hardware: ',
        description_template: '**What hardware is affected?**\n[Device name, model, asset tag if known]\n\n**What\'s happening?**\n[Describe the issue]\n\n**When did it start?**\n[Date/time]\n\n**Have you tried anything?**\n[Steps taken so far]' },
      { name: 'Software', description: 'Software issues and requests', icon: 'window', display_order: 2, subject_prefix: 'Software: ',
        description_template: '**What application/software?**\n[Name and version]\n\n**What\'s happening?**\n[Error message or unexpected behavior]\n\n**Steps to reproduce:**\n[1. 2. 3.]\n\n**When did it start?**\n[Date/time]' },
      { name: 'Network', description: 'Network and connectivity', icon: 'globe-alt', display_order: 3, subject_prefix: 'Network: ',
        description_template: '**Location/office:**\n[Where are you?]\n\n**How many users affected?**\n[Just you, or others too?]\n\n**Error messages:**\n[Any error text]\n\n**Connectivity test:**\n[Can you reach other sites? Is Wi-Fi connected?]' },
      { name: 'Account', description: 'Account and access requests', icon: 'user', display_order: 4, subject_prefix: 'Access: ',
        description_template: '**Username or email:**\n[Your login identifier]\n\n**System/application:**\n[What are you trying to access?]\n\n**Error message:**\n[Exact error text]\n\n**Last successful login:**\n[When did it last work?]' },
      { name: 'Email', description: 'Email and communication issues', icon: 'envelope', display_order: 5, subject_prefix: 'Email: ',
        description_template: '**What email account/system?**\n[Email address or distribution list]\n\n**What\'s happening?**\n[Describe the issue]\n\n**Error messages:**\n[Any error text or bounce messages]\n\n**When did it start?**\n[Date/time]' },
      { name: 'Security', description: 'Security incidents and concerns', icon: 'shield-check', display_order: 6, subject_prefix: 'Security: ',
        description_template: '**What happened?**\n[Describe the security concern]\n\n**When did you notice it?**\n[Date/time]\n\n**What systems/data may be affected?**\n[List any affected resources]\n\n**Have you taken any action?**\n[e.g., changed password, disconnected device]' },
      { name: 'Other', description: 'Other issues not covered by existing categories', icon: 'ellipsis-horizontal', display_order: 99, description_template: null, subject_prefix: null },
    ]

    for (const category of defaultCategories) {
      // Migration 075 added subcategories: the unique constraint moved from
      // (organization_id, name) to (organization_id, parent_id, name) plus a
      // partial unique index on (organization_id, name) WHERE parent_id IS NULL.
      // Setup seeds root categories only, so the partial-index syntax matches.
      await pool.query(
        `INSERT INTO ticket_categories (organization_id, name, description, icon, display_order, description_template, subject_prefix)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (organization_id, name) WHERE parent_id IS NULL DO NOTHING`,
        [orgId, category.name, category.description, category.icon, category.display_order, category.description_template, category.subject_prefix]
      )
    }

    // Seed service catalog categories
    const catalogCategories = [
      { name: 'Access & Applications', description: 'Application access, role changes, permissions', icon: 'key', display_order: 1 },
      { name: 'Hardware', description: 'Laptops, monitors, peripherals, equipment', icon: 'computer-desktop', display_order: 2 },
      { name: 'Software', description: 'Software licenses, installations, upgrades', icon: 'window', display_order: 3 },
      { name: 'Account Management', description: 'New accounts, offboarding, transfers', icon: 'user-plus', display_order: 4 },
      { name: 'General', description: 'Other service requests', icon: 'ellipsis-horizontal', display_order: 5 },
    ]

    const catalogCategoryIds = new Map<string, string>()
    for (const cat of catalogCategories) {
      const catResult = await pool.query(
        `INSERT INTO catalog_categories (organization_id, name, description, icon, display_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, name, parent_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [orgId, cat.name, cat.description, cat.icon, cat.display_order]
      )
      if (catResult.rows[0]) {
        catalogCategoryIds.set(cat.name, catResult.rows[0].id)
      }
    }

    // Seed starter catalog items (5 default items)
    const catalogItems = [
      {
        name: 'Application Access',
        slug: 'application-access',
        short_description: 'Request access to a SaaS app or internal tool',
        description: 'Submit a request for access to an application. Select the app, choose your access level, and provide a business justification. Your manager will be notified for approval.',
        category_id: catalogCategoryIds.get('Access & Applications'),
        item_type: 'service_request',
        icon: 'key',
        requires_approval: true,
        estimated_fulfillment_days: 1,
        auto_category: 'Account',
        request_form: JSON.stringify([
          { name: 'application_id', type: 'select', label: 'Application', source: 'applications', required: true },
          { name: 'access_level', type: 'select', label: 'Access Level', source: 'application.access_levels', required: true },
          { name: 'justification', type: 'textarea', label: 'Why do you need this access?', required: true },
          { name: 'start_date', type: 'date', label: 'When do you need it by?', required: false },
        ]),
      },
      {
        name: 'New User Account',
        slug: 'new-user-account',
        short_description: 'Set up accounts for a new employee',
        description: 'Request account creation for a new team member. Includes email, Active Directory, and standard application access based on their role.',
        category_id: catalogCategoryIds.get('Account Management'),
        item_type: 'service_request',
        icon: 'user-plus',
        requires_approval: false,
        estimated_fulfillment_days: 2,
        auto_category: 'Account',
        request_form: JSON.stringify([
          { name: 'employee_name', type: 'text', label: 'Employee Full Name', required: true },
          { name: 'employee_email', type: 'text', label: 'Personal Email', required: true },
          { name: 'job_title', type: 'text', label: 'Job Title', required: true },
          { name: 'department', type: 'text', label: 'Department', required: true },
          { name: 'start_date', type: 'date', label: 'Start Date', required: true },
          { name: 'manager_name', type: 'text', label: 'Reporting Manager', required: true },
        ]),
      },
      {
        name: 'Hardware Request',
        slug: 'hardware-request',
        short_description: 'Request a laptop, monitor, or other equipment',
        description: 'Submit a request for hardware equipment. Select the type of device, provide justification, and your manager will review for approval.',
        category_id: catalogCategoryIds.get('Hardware'),
        item_type: 'service_request',
        icon: 'computer-desktop',
        requires_approval: true,
        estimated_fulfillment_days: 5,
        auto_category: 'Hardware',
        request_form: JSON.stringify([
          { name: 'device_type', type: 'select', label: 'Device Type', options: ['Laptop', 'Desktop', 'Monitor', 'Mobile Phone', 'Tablet', 'Headset', 'Keyboard/Mouse', 'Other'], required: true },
          { name: 'specification', type: 'select', label: 'Specification Level', options: ['Standard', 'Professional', 'Executive'], required: true },
          { name: 'justification', type: 'textarea', label: 'Why do you need this?', required: true },
          { name: 'replacing_existing', type: 'checkbox', label: 'Replacing an existing device?', required: false },
          { name: 'needed_by', type: 'date', label: 'Needed by', required: false },
        ]),
      },
      {
        name: 'Software Installation',
        slug: 'software-installation',
        short_description: 'Request a software license or installation',
        description: 'Request installation of software on your device or a new software license. Provide the software name and business justification.',
        category_id: catalogCategoryIds.get('Software'),
        item_type: 'service_request',
        icon: 'window',
        requires_approval: true,
        estimated_fulfillment_days: 2,
        auto_category: 'Software',
        request_form: JSON.stringify([
          { name: 'software_name', type: 'text', label: 'Software Name', required: true },
          { name: 'version', type: 'text', label: 'Version (if specific)', required: false },
          { name: 'device_name', type: 'text', label: 'Install on which device?', required: true },
          { name: 'justification', type: 'textarea', label: 'Business justification', required: true },
        ]),
      },
      {
        name: 'Offboarding',
        slug: 'offboarding',
        short_description: 'Process employee departure and account removal',
        description: 'Initiate the offboarding process for a departing employee. This triggers account deactivation, equipment retrieval, and access revocation.',
        category_id: catalogCategoryIds.get('Account Management'),
        item_type: 'service_request',
        icon: 'user-minus',
        requires_approval: false,
        estimated_fulfillment_days: 3,
        auto_category: 'Account',
        request_form: JSON.stringify([
          { name: 'employee_name', type: 'text', label: 'Employee Name', required: true },
          { name: 'last_day', type: 'date', label: 'Last Working Day', required: true },
          { name: 'transfer_to', type: 'text', label: 'Transfer files/access to', required: false },
          { name: 'equipment_notes', type: 'textarea', label: 'Equipment to collect', required: false },
          { name: 'special_instructions', type: 'textarea', label: 'Special instructions', required: false },
        ]),
      },
    ]

    for (const item of catalogItems) {
      await pool.query(
        `INSERT INTO catalog_items (organization_id, name, slug, short_description, description, category_id, item_type, icon, requires_approval, estimated_fulfillment_days, auto_category, request_form)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT DO NOTHING`,
        [orgId, item.name, item.slug, item.short_description, item.description, item.category_id || null, item.item_type, item.icon, item.requires_approval, item.estimated_fulfillment_days, item.auto_category, item.request_form]
      )
    }

    // Seed feature_registry from lib/features.ts. This is the FK target
    // for organization_feature_flags — without it, every /api/features/
    // enable call silently fails on FK constraint even though the API
    // returns success (latent bug caught during Phase 4a AI Chat enable
    // on 2026-07-05). Idempotent; safe to re-run.
    try {
      const result = await seedFeatureRegistry()
      console.log(`[Setup] feature_registry: ${result.inserted} inserted, ${result.updated} updated`)
    } catch (err) {
      console.error('[Setup] Failed to seed feature_registry:', err)
    }

    // Seed system KB articles (admin guide)
    // Non-blocking: article seeding failure should not prevent setup completion
    try {
      await seedSystemArticles(orgId)
    } catch (err) {
      console.error('[Setup] Failed to seed system articles:', err)
    }

    // Seed policy articles (Policies & Procedures category)
    try {
      await seedPolicyArticles(orgId)
    } catch (err) {
      console.error('[Setup] Failed to seed policy articles:', err)
    }

    // Seed training articles (Training category with assessments)
    try {
      await seedTrainingArticles(orgId)
    } catch (err) {
      console.error('[Setup] Failed to seed training articles:', err)
    }

    // Seed procedure articles (paired with policies, seeded as drafts)
    try {
      await seedProcedureArticles(orgId)
    } catch (err) {
      console.error('[Setup] Failed to seed procedure articles:', err)
    }

    // Seed default AI settings
    await pool.query(
      `INSERT INTO ai_settings (organization_id, response_mode, auto_draft_threshold, session_retention_days)
       VALUES ($1, 'balanced', 3, 90)
       ON CONFLICT (organization_id) DO NOTHING`,
      [orgId]
    )

    // Seed default AI data access policies (Phase 0.2.2)
    // Defines what each context level can access via AI chat
    const existingPolicies = await pool.query(
      'SELECT COUNT(*) as count FROM ai_data_access_policies WHERE organization_id = $1',
      [orgId]
    )
    if (parseInt(existingPolicies.rows[0].count, 10) === 0) {
      const defaultPolicies = [
        // End users: own tickets only, public KB only
        { context_level: 'end_user', resource_type: 'tickets', can_read: true, can_search: true, scope_restrictions: { own_only: true }, redacted_fields: ['internal_notes'] },
        { context_level: 'end_user', resource_type: 'kb_articles', can_read: true, can_search: true, scope_restrictions: { visibility: ['public'] }, redacted_fields: [] },
        // Technicians: all tickets, public + internal KB
        { context_level: 'technician', resource_type: 'tickets', can_read: true, can_search: true, scope_restrictions: {}, redacted_fields: [] },
        { context_level: 'technician', resource_type: 'kb_articles', can_read: true, can_search: true, scope_restrictions: { visibility: ['public', 'internal'] }, redacted_fields: [] },
        // Admins: full access to tickets and all KB articles
        { context_level: 'admin', resource_type: 'tickets', can_read: true, can_search: true, scope_restrictions: {}, redacted_fields: [] },
        { context_level: 'admin', resource_type: 'kb_articles', can_read: true, can_search: true, scope_restrictions: { visibility: ['public', 'internal', 'private'] }, redacted_fields: [] },
      ]

      for (const policy of defaultPolicies) {
        await pool.query(
          `INSERT INTO ai_data_access_policies (organization_id, context_level, resource_type, can_read, can_search, scope_restrictions, redacted_fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (organization_id, context_level, resource_type) DO NOTHING`,
          [orgId, policy.context_level, policy.resource_type, policy.can_read, policy.can_search, JSON.stringify(policy.scope_restrictions), policy.redacted_fields]
        )
      }
    }

    // Seed default retention policies (manual_only for all entity types)
    const entityTypes = ['contacts', 'tickets', 'assets', 'credentials', 'kb_articles', 'documents']
    for (const entityType of entityTypes) {
      await pool.query(
        `INSERT INTO data_retention_policies (organization_id, entity_type, retention_mode, retention_days)
         VALUES ($1, $2, 'manual_only', 365)
         ON CONFLICT (organization_id, entity_type) DO NOTHING`,
        [orgId, entityType]
      )
    }

    // Capture consent decision from the wizard. Writes
    // telemetry_settings.enabled + appends a telemetry_consent_log row
    // marked source='setup_wizard' (action='acknowledged' or 'disabled'
    // depending on choice). Append-only per PRINCIPLES.md #6.
    // telemetry_consent_log.user_id references the APP users.id (UUID) — NOT
    // the Better Auth session.user.id (a non-UUID string), which previously
    // threw `invalid input syntax for type uuid` and silently dropped consent.
    const appUserRes = await pool.query(
      'SELECT id FROM users WHERE organization_id = $1 AND email = $2 LIMIT 1',
      [orgId, session.user.email],
    )
    const consentUserId = appUserRes.rows[0]?.id ?? null

    await setTelemetryEnabled(
      orgId,
      telemetryEnabled,
      consentUserId,
      'setup_wizard',
      telemetryEnabled
        ? 'Operator acknowledged telemetry at setup wizard.'
        : 'Operator disabled telemetry at setup wizard.',
    ).catch(err => console.error('[Telemetry consent] persist failed:', err))

    // Send telemetry only if the operator consented. sendInstallPing /
    // sendSetupSnapshot also check the consent gate via sendTelemetry
    // (defense-in-depth), but skipping the call here avoids the
    // telemetry_log row that would record a suppressed-by-consent send.
    if (telemetryEnabled) {
      // Tier 0 install ping
      sendInstallPing(orgId).catch(err => console.error('[Telemetry] Install ping failed:', err))

      // Tier 1 setup snapshot if user opted in
      if (tier >= 1) {
        sendSetupSnapshot(orgId, { industry, team_size, primary_use_case, features })
          .catch(err => console.error('[Telemetry] Setup snapshot failed:', err))
      }
    }

    return NextResponse.json({
      success: true,
      organizationId: orgId,
    })
  } catch (error) {
    console.error('Setup complete error:', error)
    return NextResponse.json(
      { error: 'Failed to complete setup' },
      { status: 500 }
    )
  }
}
