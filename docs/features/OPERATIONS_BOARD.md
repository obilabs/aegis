# Operations Board: Onboarding & Offboarding

## Overview

The Operations Board provides a matrix view of employee lifecycle tasks grouped by service/action type across multiple people. Unlike traditional ITSM tools that handle onboarding per-person (one ticket per employee), this board lets IT staff batch-complete the same action across many employees — e.g., "Create Google Workspace accounts for all 5 new hires at once."

**This is a genuine product gap.** No major ITSM tool (ServiceNow, Freshservice, Jira, ConnectWise, Autotask, HaloPSA) offers a native batch-by-action-type view. They all handle onboarding as individual tickets or request bundles per employee.

---

## Core Concept: The Matrix View

```
                    Google       Microsoft 365    Okta SSO      Laptop         Welcome
                    Workspace    License          Provisioning  Assignment     Email
Employee A (Sales)  [x]          [x]              [ ]           [ ]            [x]
Employee B (Eng)    [x]          [ ]              [ ]           [x]            [x]
Employee C (Eng)    [ ]          [ ]              [ ]           [x]            [ ]
                    ─────────    ─────────        ─────         ──────         ──────
                    [Complete    [Complete         ...           ...            ...
                     Column]      Column]
```

- **Rows** = People being onboarded/offboarded
- **Columns** = Services/actions grouped by `service_category`
- **Cells** = Individual ticket_tasks (linked to an onboarding ticket per person)
- **Column batch-complete** = Mark the same service_category task as done across all people in one click

This reuses the existing `ticket_tasks.service_category` field from migration 047.

---

## How It Works

### 1. Job Title Entitlements (Setup)

Before onboarding, admins define what each job title gets:

```sql
-- NEW MIGRATION NEEDED
CREATE TABLE IF NOT EXISTS job_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS job_title_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_title_id UUID NOT NULL REFERENCES job_titles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    -- What they get
    entitlement_type VARCHAR(50) NOT NULL,  -- saas_service, hardware, access, software, accessory
    resource_id UUID,                        -- ID in saas_services, asset_types, etc.
    resource_name VARCHAR(255) NOT NULL,     -- Cached display name
    -- Approval
    requires_approval BOOLEAN DEFAULT false,
    approval_workflow_id UUID REFERENCES approval_workflows(id),
    -- Task metadata (used when generating onboarding tasks)
    service_category VARCHAR(100),           -- e.g., "google_workspace", "microsoft_365"
    default_assignee_type VARCHAR(50) DEFAULT 'it_admin', -- it_admin, manager, buddy, app_owner, hardware_approver
    default_assignee_id UUID REFERENCES users(id),
    task_title VARCHAR(255),                 -- Override title (default: resource_name)
    task_description TEXT,
    is_required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Example entitlements for "Software Engineer":**
| Type | Resource | Category | Assignee | Required |
|------|----------|----------|----------|----------|
| saas_service | Google Workspace | google_workspace | IT Admin | Yes |
| saas_service | GitHub Enterprise | github | IT Admin | Yes |
| saas_service | Slack | slack | IT Admin | Yes |
| hardware | Laptop (Engineering) | laptop_assignment | Hardware Approver | Yes |
| access | VPN Access | vpn | IT Admin | Yes |
| software | VS Code License | development_tools | IT Admin | No |

### 2. Onboarding Flow

**Step 1: HR initiates onboarding**
- HR selects job title from predefined list
- System auto-populates entitlements (hardware, software, access, services)
- HR can **remove** items that aren't needed for this specific hire
- HR fills in: name, start date, manager, location, buddy (optional)

**Step 2: System generates tickets + tasks**
- Creates one **onboarding ticket** per person (parent container)
- Creates **ticket_tasks** from entitlements, each with:
  - `service_category` from entitlement (enables matrix grouping)
  - `assigned_to` resolved from `default_assignee_type`:
    - `it_admin` → assigned to IT team
    - `manager` → assigned to the new hire's manager
    - `buddy` → assigned to the designated buddy
    - `app_owner` → assigned to the `saas_services.account_owner`
    - `hardware_approver` → from approval workflow
  - `is_required` from entitlement
- Non-helpdesk assignees (managers, buddies) see tasks in their My Tasks widget

**Step 3: Approval workflows fire (if configured)**
- Hardware items go through hardware approval workflow
- Software licenses go through app owner approval
- Manager approves overall onboarding
- Uses existing `approval_workflows` + `approval_workflow_steps` schema
- Delegation handles approver absence (existing `delegation_transfers` schema)

**Step 4: Operations Board shows the matrix**
- IT staff opens Operations Board
- Sees all pending onboardings in matrix form
- Can batch-complete by column (service category)

### 3. Offboarding Flow

Mirror of onboarding but in reverse:
- Uses existing `offboarding_tasks` + `offboarding_task_items` schema
- Job title entitlements define what needs to be revoked
- Matrix shows: revoke access, collect hardware, transfer data, close accounts
- Column batch-complete for mass deprovisioning (e.g., revoke Google Workspace for all departing employees)

---

## API Design

### Operations Board API

```
GET /api/portal/operations/board?type=onboarding&status=active
```

Returns the matrix data:
```json
{
  "people": [
    {
      "id": "ticket-id-1",
      "name": "Alice Smith",
      "job_title": "Software Engineer",
      "start_date": "2026-02-15",
      "manager": "Bob Jones",
      "status": "in_progress",
      "progress": { "completed": 3, "total": 8 }
    }
  ],
  "service_categories": [
    { "key": "google_workspace", "label": "Google Workspace", "total": 5, "completed": 3 },
    { "key": "laptop_assignment", "label": "Laptop Assignment", "total": 5, "completed": 1 }
  ],
  "matrix": {
    "ticket-id-1": {
      "google_workspace": { "task_id": "...", "status": "completed", "assigned_to": "..." },
      "laptop_assignment": { "task_id": "...", "status": "pending", "assigned_to": "..." }
    }
  }
}
```

### Batch Complete API

```
POST /api/portal/operations/batch-complete
{
  "service_category": "google_workspace",
  "task_ids": ["task-1", "task-2", "task-3"]
}
```

### Job Title Entitlements API

```
GET  /api/portal/settings/job-titles                    — list job titles
POST /api/portal/settings/job-titles                    — create job title
GET  /api/portal/settings/job-titles/:id/entitlements   — list entitlements
POST /api/portal/settings/job-titles/:id/entitlements   — add entitlement
DELETE /api/portal/settings/job-titles/:id/entitlements/:eid — remove
```

### Initiate Onboarding API

```
POST /api/portal/operations/onboard
{
  "job_title_id": "...",
  "person": {
    "first_name": "Alice",
    "last_name": "Smith",
    "email": "alice@company.com",
    "start_date": "2026-02-15",
    "manager_id": "...",
    "location_id": "...",
    "buddy_id": null
  },
  "removed_entitlements": ["entitlement-id-5"],  // HR removed these
  "additional_notes": "Needs dual monitor setup"
}
```

Response: Creates contact, ticket, tasks, triggers approvals.

---

## UI Pages

### `/portal/operations` — Operations Board

The main matrix view. Tabs for:
- **Onboarding** (active onboardings in progress)
- **Offboarding** (active offboardings in progress)
- **Completed** (history)

Features:
- Filter by date range, department, status
- Click person row to expand → shows full task list for that person
- Click column header → batch-complete panel (select which people to complete for)
- Color coding: green (done), amber (in progress), red (overdue), gray (not started)
- Progress bar per person (row) and per service (column)

### `/portal/operations/onboard` — New Onboarding

Wizard flow:
1. Select job title → shows pre-approved entitlements
2. Fill person details (name, email, start date, manager, location, buddy)
3. Review/modify entitlements (remove items, add notes)
4. Confirm → system creates everything

### `/portal/settings/job-titles` — Job Title Management

- CRUD for job titles
- Each job title has an entitlements editor:
  - Add from saas_services, asset_types, catalog_items
  - Configure: approval required?, assignee type, required?
  - Drag to reorder

### `/portal/settings/approval-workflows` — Approval Workflow Management

Already has schema support. UI needed for:
- Create/edit workflows (sequential, parallel, any-one)
- Define steps with approver type (user, role, manager, department head, app owner)
- Set timeout + escalation rules

---

## Schema Already Available

These tables already exist in `init.sql` and can be used directly:

| Table | Purpose | Notes |
|-------|---------|-------|
| `saas_services` | SaaS apps tracked | Has `account_owner`, `auto_provision` |
| `user_assignments` | Resource tracking per user | Asset, accessory, license, SaaS |
| `offboarding_tasks` | Offboarding container | Status, dates, task counts |
| `offboarding_task_items` | Individual offboarding tasks | Has `assigned_to`, `resource_type` |
| `offboarding_templates` | Template task sets | JSONB tasks array |
| `approval_workflows` | Multi-step approval | Sequential, parallel, any-one |
| `approval_workflow_steps` | Approval steps | Approver type, timeout, escalation |
| `service_requests` | Request tracking | Full lifecycle with approvals |
| `request_approvals` | Individual approvals | Delegation support |
| `delegation_rules` | Who can do what | Request-for, approve-for, etc. |
| `delegation_transfers` | Out-of-office delegation | Time-bounded with notification |
| `catalog_items` | Service catalog | Hardware, software, access, bundles |
| `accessories` | Non-serialized items | Quantity tracking, return required |
| `ticket_tasks` | Tasks on tickets | `service_category`, `assigned_to`, `is_required` (migration 047) |
| `checklist_templates` | Reusable checklists | Auto-apply by category (migration 047) |

## New Schema Needed

| Table | Purpose |
|-------|---------|
| `job_titles` | Predefined job titles with department |
| `job_title_entitlements` | What each job title gets (SaaS, hardware, access) |

---

## Task Assignment Model

Tasks are assignable to **anyone**, not just IT staff:

| Assignee Type | Who | Example Tasks |
|---------------|-----|---------------|
| `it_admin` | IT team member | Provision accounts, assign hardware |
| `manager` | New hire's manager | Set first-day meeting, introduce to team |
| `buddy` | Assigned buddy/mentor | Office tour, lunch on day 1 |
| `app_owner` | SaaS service owner | Grant access, configure permissions |
| `hardware_approver` | Hardware budget approver | Approve laptop purchase |
| `hr` | HR team member | Send offer letter, collect documents |

Non-IT assignees see tasks in their **My Tasks** widget (top-bar dropdown) and can complete them there.

---

## Approval Flow

Each entitlement can optionally require approval:

```
Entitlement configured → Onboarding initiated
  → approval_workflow triggers
    → Step 1: Manager approves (auto if pre-approved for job title)
    → Step 2: App owner approves (for software/SaaS)
    → Step 3: Hardware approver approves (for hardware)
  → All approved → Task becomes actionable
  → Rejected → Task marked as "not applicable" with reason

If approver is away:
  → delegation_transfers checked
  → Delegated approver notified
  → Original approver cc'd on decision
```

---

## Future Enhancements (Not in Initial Build)

1. **SCIM/API provisioning** — Auto-provision Google Workspace, Okta, etc. via API
2. **Calendar integration** — Auto-create first-day meetings
3. **Recurring onboarding reports** — Weekly summary of onboarding health
4. **Pre-approved auto-requests** — If new hire requests something in their entitlements, auto-approve
5. **Onboarding satisfaction survey** — Auto-send after 30 days
6. **Org chart view** — See onboarding status in org hierarchy
