# Aegis Research Document

## ITFlow Analysis

**Repository:** https://github.com/itflow-org/itflow
**Version Analyzed:** Latest (Dec 2024)
**Tech Stack:** PHP, MySQL/MariaDB, Bootstrap, jQuery

---

## Database Schema Summary

**Total Tables:** 129
**Database:** MariaDB/MySQL with InnoDB engine

### Entity Categories

| Category | Tables | Description |
|----------|--------|-------------|
| Core | 8 | Companies, users, roles, settings, modules, logs |
| Clients | 6 | Clients, contacts, locations, tags |
| Tickets | 11 | Tickets, replies, attachments, statuses, templates |
| Assets | 10 | Assets, interfaces, history, software, credentials |
| Documentation | 5 | Documents, folders, files, templates, versions |
| Billing | 12 | Invoices, payments, quotes, products, taxes |
| Projects | 4 | Projects, tasks, templates |
| Network | 5 | Networks, domains, DNS records, certificates |
| Services | 8 | Services, contracts, SLAs, vendors |
| Calendar | 3 | Calendars, events, attendees |
| AI | 2 | AI providers, AI models |
| Misc | 55 | Junction tables, history, custom fields, etc. |

---

## Core Entities

### Company (Self - MSP/IT Provider)
```sql
companies (
  company_id, company_name, company_address, company_city,
  company_state, company_zip, company_country, company_phone,
  company_email, company_website, company_logo, company_locale,
  company_currency, company_tax_id
)
```

### Users (Technicians/Agents)
```sql
users (
  user_id, user_name, user_email, user_password, user_auth_method,
  user_type, user_status, user_token, user_avatar, user_role_id
)
```
- Supports local auth + SSO (Microsoft)
- Role-based permissions via user_roles, user_role_permissions

### Clients (Customers)
```sql
clients (
  client_id, client_lead, client_name, client_type, client_website,
  client_referral, client_rate, client_currency_code, client_net_terms,
  client_tax_id_number, client_abbreviation, client_notes
)
```

### Contacts (Client Employees)
```sql
contacts (
  contact_id, contact_name, contact_title, contact_email,
  contact_phone, contact_mobile, contact_photo, contact_pin,
  contact_primary, contact_important, contact_billing, contact_technical,
  contact_location_id, contact_client_id
)
```
- Contacts can have client portal access
- Linked to locations, can submit tickets

---

## Ticket System

### Tickets
```sql
tickets (
  ticket_id, ticket_prefix, ticket_number, ticket_source,
  ticket_category, ticket_subject, ticket_details, ticket_priority,
  ticket_status, ticket_billable, ticket_schedule, ticket_onsite,
  ticket_vendor_ticket_number, ticket_feedback, ticket_url_key,
  ticket_due_at, ticket_resolved_at, ticket_first_response_at,
  ticket_created_by, ticket_assigned_to, ticket_closed_by,
  ticket_vendor_id, ticket_client_id, ticket_contact_id,
  ticket_location_id, ticket_asset_id, ticket_quote_id,
  ticket_invoice_id, ticket_project_id
)
```

### Ticket Features
- **Sources:** Email, Client Portal, In-App, Project Template
- **Priorities:** Low, Medium, High, Critical
- **Custom Statuses:** Configurable workflow states
- **Replies:** ticket_replies with internal/public flag
- **Attachments:** ticket_attachments for files
- **Watchers:** ticket_watchers for notifications
- **History:** ticket_history for audit trail
- **SLA:** Via contract_templates (response/resolution times)
- **Recurring:** recurring_tickets for scheduled tickets
- **Templates:** ticket_templates for quick ticket creation

---

## Asset Management

### Assets
```sql
assets (
  asset_id, asset_type, asset_name, asset_description,
  asset_make, asset_model, asset_serial, asset_os, asset_uri,
  asset_status, asset_purchase_date, asset_warranty_expire,
  asset_install_date, asset_photo, asset_physical_location,
  asset_notes, asset_important, asset_vendor_id, asset_location_id,
  asset_contact_id, asset_client_id
)
```

### Asset Features
- **Interfaces:** Network interfaces with IP, MAC, ports
- **Interface Links:** Physical/logical connections between interfaces
- **Credentials:** Linked passwords/credentials
- **Documents:** Linked documentation
- **History:** Change tracking
- **Custom Fields:** Extensible attributes
- **Software:** Software inventory linked to assets

### Software
```sql
software (
  software_id, software_name, software_version, software_type,
  software_license_type, software_vendor, software_notes
)
```
- Software keys with license management
- Assignment to assets and contacts

---

## Documentation System

### Documents
```sql
documents (
  document_id, document_name, document_description,
  document_content, document_content_raw, document_important,
  document_client_visible, document_folder_id, document_created_by,
  document_client_id
)
```
- Full-text search on document_content_raw
- Version history via document_versions
- Folder organization
- Client visibility control

### Folders
```sql
folders (
  folder_id, folder_name, folder_parent, folder_client_id
)
```

### Files
```sql
files (
  file_id, file_reference_id, file_reference_type, file_name,
  file_ext, file_mime_type
)
```
- Polymorphic: linked to assets, documents, vendors, etc.

---

## Credentials/Passwords

```sql
credentials (
  credential_id, credential_name, credential_description,
  credential_username, credential_password, credential_otp_secret,
  credential_uri, credential_important, credential_client_id
)
```
- AES-256 encrypted storage
- OTP/2FA secret storage
- Linked to: assets, contacts, software, services, vendors

---

## Network Documentation

### Domains
```sql
domains (
  domain_id, domain_name, domain_description, domain_registrar,
  domain_webhost, domain_expire, domain_mail, domain_client_id
)
```
- DNS records via `records` table
- History tracking

### Certificates
```sql
certificates (
  certificate_id, certificate_name, certificate_domain,
  certificate_issued_by, certificate_expire, certificate_public_key,
  certificate_client_id
)
```

### Networks
```sql
networks (
  network_id, network_name, network, network_gateway,
  network_dhcp_range, network_dns, network_vlan, network_client_id
)
```

---

## Billing System

### Invoices
```sql
invoices (
  invoice_id, invoice_prefix, invoice_number, invoice_scope,
  invoice_status, invoice_date, invoice_due, invoice_discount_amount,
  invoice_credit_amount, invoice_amount, invoice_currency_code,
  invoice_url_key, invoice_category_id, invoice_client_id
)
```

### Invoice Items
```sql
invoice_items (
  item_id, item_name, item_description, item_quantity,
  item_price, item_subtotal, item_tax, item_total, item_invoice_id
)
```

### Quotes
```sql
quotes (
  quote_id, quote_prefix, quote_number, quote_scope,
  quote_status, quote_date, quote_expire, quote_amount,
  quote_currency_code, quote_url_key, quote_client_id
)
```

### Payments
```sql
payments (
  payment_id, payment_date, payment_amount, payment_currency_code,
  payment_method, payment_reference, payment_invoice_id, payment_client_id
)
```

### Recurring Invoices
```sql
recurring_invoices (
  recurring_invoice_id, recurring_invoice_frequency,
  recurring_invoice_last_sent, recurring_invoice_next_date,
  recurring_invoice_status, recurring_invoice_client_id
)
```

---

## Projects & Tasks

### Projects
```sql
projects (
  project_id, project_name, project_description, project_status,
  project_due_date, project_budget, project_client_id
)
```

### Tasks
```sql
tasks (
  task_id, task_name, task_description, task_status,
  task_priority, task_due_date, task_time, task_billable,
  task_project_id, task_assigned_to
)
```

---

## Services & Contracts

### Services (Recurring Services)
```sql
services (
  service_id, service_name, service_description, service_type,
  service_frequency, service_price, service_next_date,
  service_status, service_client_id
)
```

### Contracts
```sql
contracts (
  contract_id, contract_type, contract_name, contract_description,
  contract_start_date, contract_end_date, contract_rate_standard,
  contract_rate_after_hours, contract_client_id
)
```
- SLA times for ticket priorities
- Rate cards for billing

---

## Client Portal Features

The client portal (`/client/`) allows contacts to:
- View/create tickets
- View invoices and quotes
- Make payments
- View documents (if client_visible)
- View assets
- Manage their profile

---

## API System

```sql
api_keys (
  api_key_id, api_key_name, api_key_secret, api_key_decrypt_hash,
  api_key_expire, api_key_client_id
)
```
- REST API for external integrations
- Client-specific API keys

---

## AI Integration

```sql
ai_providers (
  ai_provider_id, ai_provider_name, ai_provider_api_url, ai_provider_api_key
)

ai_models (
  ai_model_id, ai_model_name, ai_model_prompt, ai_model_use_case,
  ai_model_ai_provider_id
)
```
- Configurable AI providers (OpenAI, etc.)
- Custom prompts for different use cases

---

## Feature Matrix: ITFlow vs Aegis

| Feature | ITFlow | Aegis | Aegis-MTP |
|---------|--------|--------------|-----------|
| Clients | Yes | Yes (internal org) | Yes (multi-tenant) |
| Contacts | Yes | Yes | Yes |
| Tickets | Yes | Yes | Yes + Vendor API |
| Assets | Yes | Yes | Yes |
| Documentation | Yes | Yes | Yes + KB API |
| Credentials | Yes | Yes (encrypted) | Yes + Vault API |
| Invoicing | Yes | Optional | Yes (billing to clients) |
| Quotes | Yes | Optional | Yes |
| Projects | Yes | Yes | Yes |
| Contracts/SLA | Yes | Yes | Yes |
| Network Docs | Yes | Yes | Yes |
| Client Portal | Yes (built-in) | Yes (web) | Yes (tenant portals) |
| API | Basic REST | Full REST + MCP | Full REST + MCP |
| AI | Basic | Gemini (support) | Gemini (support) |
| Multi-tenant | No (single company) | No | Yes (core feature) |
| Vendor Access | No | No | Yes (API access) |

---

## Technology Translation: ITFlow to Aegis

| ITFlow | Aegis |
|--------|-------|
| PHP | TypeScript (Next.js) |
| MySQL/MariaDB | PostgreSQL |
| jQuery | React |
| Bootstrap | Tailwind CSS |
| Session Auth | better-auth (JWT) |
| N/A | MCP Server |
| N/A | OpenAPI spec |

---

## Priority Features for Aegis MVP

### Phase 1: Core
1. Authentication & RBAC
2. Organization/Company setup
3. Clients management
4. Contacts management
5. Locations

### Phase 2: Tickets
1. Ticket CRUD
2. Ticket statuses (workflow)
3. Ticket replies
4. Ticket assignments
5. Email notifications

### Phase 3: Assets
1. Asset inventory
2. Asset types/categories
3. Asset-ticket linking
4. Basic network interfaces

### Phase 4: Documentation
1. Documents with rich text
2. Folders
3. Client visibility
4. Search

### Phase 5: Credentials
1. Encrypted password storage
2. Credential linking
3. Access control

### Phase 6: Advanced Features
1. Recurring tickets
2. Projects & tasks
3. Advanced reporting

---

## Key Design Decisions for Aegis

1. **Data Sovereignty:** Client keeps all data on their infrastructure
2. **Vendor API Access:** MTP provides controlled API access to client data
3. **MCP-First:** Build MCP server before UI for AI-native access
4. **Documentation-First:** Write user guides before building features
5. **Modern Stack:** TypeScript, React, PostgreSQL, Docker
6. **Single-Tenant Client:** aegis for one org (like Aegis)
7. **Multi-Tenant MTP:** aegis-mtp for MSPs managing multiple clients

---

---

## Freshservice Competitive Analysis

**Source:** [Freshservice Features](https://www.freshworks.com/freshservice/features/)

Freshservice is a leading cloud-based ITSM solution with 18,000+ organizations. Understanding their feature set helps position Aegis competitively.

### Freshservice Core ITIL Features

| Feature | Freshservice | ITFlow | Aegis Target |
|---------|-------------|--------|--------------|
| Incident Management | Full ITIL | Basic Tickets | Full ITIL |
| Problem Management | Yes (AI insights) | No | Yes (Phase 2) |
| Change Management | Yes (risk scoring) | No | Yes (Phase 2) |
| Release Management | Yes | No | Yes (Phase 3) |
| CMDB | Full with discovery | Basic assets | Full (Phase 2) |
| Service Catalog | E-commerce style | No | Yes (Phase 2) |
| Workflow Automation | No-code builder | Basic | Yes (Phase 2) |
| AI Assistant | Freddy AI | Basic AI | Aegis AI (Phase 1) |
| SLA Management | Full | Basic via contracts | Full (Phase 1) |
| Analytics | Advanced | Basic | Full (Phase 2) |

### Enterprise Features to Add

1. **Problem Management**
   - Link related incidents to problems
   - Root cause analysis
   - Known error database
   - Timeline visualization

2. **Change Management**
   - Change requests with approval workflow
   - Risk scoring (low/medium/high)
   - Change calendar
   - Change advisory board (CAB)

3. **CMDB Enhancements**
   - Service mapping (visual)
   - Dependency relationships
   - Impact analysis
   - Auto-discovery (via agent)

4. **Service Catalog**
   - Self-service request portal
   - Request templates
   - Approval workflows
   - SLA per service item

5. **Workflow Automation**
   - Visual workflow builder
   - Triggers (time, event, condition)
   - Actions (assign, notify, update, webhook)
   - Integrations

### Aegis AI Agent Design

Inspired by Freshservice's Freddy AI and ITFlow's AI integration:

```typescript
// AI Agent Preset Prompts
const AI_PRESETS = {
  'ticket-triage': {
    name: 'Ticket Triage',
    prompt: `You are an IT support triage agent. Analyze incoming tickets and:
    1. Categorize by type (incident, request, problem)
    2. Suggest priority based on impact/urgency
    3. Recommend assignment based on skills
    4. Identify if this matches a known issue`
  },

  'knowledge-search': {
    name: 'Knowledge Search',
    prompt: `You are a knowledge base assistant. Help users find:
    1. Relevant documentation
    2. Similar past tickets with solutions
    3. Known issues and workarounds
    Format responses clearly with links to source docs.`
  },

  'asset-advisor': {
    name: 'Asset Advisor',
    prompt: `You are an IT asset management advisor. Help with:
    1. Asset lifecycle recommendations
    2. Warranty expiration alerts
    3. Software license compliance
    4. Hardware refresh planning`
  },

  'change-risk': {
    name: 'Change Risk Analyzer',
    prompt: `You are a change management advisor. Analyze change requests:
    1. Identify potential risks
    2. Suggest testing requirements
    3. Recommend rollback procedures
    4. Flag scheduling conflicts`
  },

  'incident-resolver': {
    name: 'Incident Resolution',
    prompt: `You are an incident resolution assistant. For each incident:
    1. Analyze symptoms and error messages
    2. Search knowledge base for solutions
    3. Suggest troubleshooting steps
    4. Recommend escalation if needed`
  }
}
```

### API Versioning Strategy

Following Freshservice's approach:

```
/api/v1/tickets        # Initial release
/api/v2/tickets        # Enhanced with new fields
/api/v1/incidents      # ITIL naming (alias for tickets)
/api/v2/problems       # New in v2
/api/v2/changes        # New in v2
/api/v2/cmdb/assets    # CMDB namespace
/api/v2/catalog/items  # Service catalog
```

**Deprecation Policy:**
- v1 supported for 12 months after v2 release
- Clear migration guide provided
- Deprecation warnings in responses

### Pricing Positioning

| Tier | Freshservice | Aegis (Self-Hosted) |
|------|-------------|---------------------|
| Starter | $19/agent/mo | Free (open source) |
| Growth | $49/agent/mo | Free |
| Pro | $95/agent/mo | Free |
| Enterprise | $119/agent/mo | Free |
| Managed | N/A | aegis-mtp pricing TBD |

**Aegis Value Proposition:**
- Zero per-agent fees
- Data sovereignty (self-hosted)
- Full source code access
- No vendor lock-in
- MCP-native for AI integration

---

## Competitive Landscape Analysis

### Platform Comparison Matrix

| Platform | Type | Pricing | Self-Hosted | Key Strength | Key Weakness |
|----------|------|---------|-------------|--------------|--------------|
| **Zendesk** | Helpdesk | $55-115/agent | No | UX, Integrations | Not ITIL-focused |
| **ServiceNow** | Enterprise ITSM | $$$$ | No | Full ITIL, CMDB | Complex, Expensive |
| **Freshservice** | Cloud ITSM | $19-119/agent | No | AI, Easy setup | Per-agent fees |
| **Halo ITSM** | MSP ITSM | $49/agent | Yes | All features included | Less known |
| **ConnectWise PSA** | MSP PSA | Custom | Cloud only | Integrations | Slow, Complex |
| **Autotask PSA** | MSP PSA | Custom | Cloud only | Robust ticketing | UI Issues |
| **Syncro** | RMM+PSA | $129/user | Cloud only | All-in-one | Not as deep |
| **ITGlue** | Documentation | $29-42/user | No | Integrations | Expensive, Downtime |
| **Hudu** | Documentation | $27+/user | Yes | Self-hosted | Less integrations |
| **ITFlow** | Open Source | Free | Yes | Free, Simple | Basic features |
| **Aegis** | Open Source | Free | Yes | MCP, AI-native | New entrant |

---

## Zendesk API Analysis

**Source:** [Zendesk Developer Docs](https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/)

### Ticket API Design Patterns (to adopt)

```
GET    /api/v2/tickets              # List (paginated, max 100)
POST   /api/v2/tickets              # Create single
POST   /api/v2/tickets/create_many  # Bulk create (100 max)
GET    /api/v2/tickets/{id}         # Get single
PUT    /api/v2/tickets/{id}         # Update
DELETE /api/v2/tickets/{id}         # Delete
GET    /api/v2/tickets/show_many    # Get multiple by IDs
PUT    /api/v2/tickets/update_many  # Bulk update
GET    /api/v2/tickets/count        # Get count
PUT    /api/v2/tickets/{id}/merge   # Merge tickets
GET    /api/v2/tickets/{id}/related # Related tickets
```

### Key Zendesk Patterns to Adopt

1. **Idempotency Keys** - `Idempotency-Key` header for safe retries
2. **Optimistic Locking** - 409 Conflict on race conditions
3. **Rate Limiting Headers** - `Zendesk-RateLimit-*` in responses
4. **Dual APIs** - Tickets (agent view) vs Requests (end-user view)
5. **Sideloading** - `include` parameter for related data

### Zendesk Ticket Object Properties

| Property | Type | Notes |
|----------|------|-------|
| id | integer | Auto-assigned |
| subject | string | Required |
| description | string | Read-only (first comment) |
| status | enum | new, open, pending, hold, solved, closed |
| priority | enum | urgent, high, normal, low |
| type | enum | problem, incident, question, task |
| requester_id | integer | User requesting support |
| assignee_id | integer | Assigned agent |
| group_id | integer | Assigned team |
| tags | array | Applied tags |
| custom_fields | array | Custom field values |
| due_at | datetime | For tasks |
| external_id | string | External system reference |

---

## ServiceNow API Analysis

**Source:** [ServiceNow Developer Docs](https://docs.servicenow.com/)

### Table API Pattern

```
GET    /api/now/table/{table}       # List records
POST   /api/now/table/{table}       # Create record
GET    /api/now/table/{table}/{id}  # Get record
PUT    /api/now/table/{table}/{id}  # Update record
DELETE /api/now/table/{table}/{id}  # Delete record
```

### Key Tables

| Table | Purpose |
|-------|---------|
| incident | Incidents |
| problem | Problems |
| change_request | Change requests |
| sc_request | Service requests |
| cmdb_ci | Configuration items |
| task | Parent of all work items |

### Query Parameters

- `sysparm_query` - Filter: `number=INC0012345`
- `sysparm_fields` - Select fields: `number,priority`
- `sysparm_limit` - Pagination limit
- `sysparm_offset` - Pagination offset
- `sysparm_display_value` - Return labels vs values

### ITIL Task Hierarchy

```
task (parent)
├── incident
├── problem
├── change_request
├── sc_request
├── sc_task
└── sn_hr_core_case
```

---

## ConnectWise/Autotask API Analysis

**Sources:**
- [ConnectWise Manage API](https://developer.connectwise.com/)
- [Autotask REST API](https://psa.datto.com/help/DeveloperHelp/Content/APIs/REST/General_Topics/Intro_REST_API.htm)

### ConnectWise Key Patterns

- API Version: Always use `v4_6_release`
- Authentication: API member with public/private key pair
- Permissions: Granular per-table (Add, Edit, Inquire, Delete)

### Autotask Key Patterns

- REST API with JSON
- Contact impersonation for ticket creation
- Rich Text field limitations (HTML stripped on update)
- API-only categories for automation

### Common PSA Integration Endpoints

| Function | ConnectWise | Autotask |
|----------|-------------|----------|
| Tickets | /service/tickets | /Tickets |
| Companies | /company/companies | /Companies |
| Contacts | /company/contacts | /Contacts |
| Products | /procurement/catalog | /Products |
| Time Entries | /time/entries | /TimeEntries |

---

## ITGlue/Hudu Documentation Analysis

**Sources:**
- [ITGlue API](https://api.itglue.com/developer/)
- [Hudu](https://www.hudu.com/)

### ITGlue API (Enterprise only)

```
GET    /organizations                # List organizations
GET    /organizations/{id}           # Get organization
GET    /configurations               # List assets/CIs
GET    /flexible_assets              # Custom asset types
GET    /passwords                    # Credentials (encrypted)
POST   /documents                    # Create document
```

### Documentation Pain Points from MSP Community

| Issue | ITGlue | Hudu | Aegis Solution |
|-------|--------|------|----------------|
| **Downtime** | Frequent complaints | Rare (self-hosted) | Self-hosted reliability |
| **Pricing** | $29-42/user | $27+/user | Free |
| **API Access** | Enterprise only | All plans | All plans |
| **Feature Requests** | Slow response | Better response | Community-driven |
| **Self-Hosted** | No | Yes | Yes |
| **Data Sovereignty** | No | Yes | Yes |

### MSP Community Preferences (Reddit/Forums)

- 60%+ prefer Hudu over ITGlue when switching
- Main ITGlue complaints: downtime, slow feature releases, pricing
- Main Hudu complaints: fewer integrations, customer portal less developed
- ITFlow mentioned as free alternative for basic needs

---

## MSP PSA Pain Points (Community Research)

**Sources:** Reddit r/msp, MSP forums, review sites

### Top Complaints

| Rank | Issue | Affected Platforms | Aegis Solution |
|------|-------|-------------------|----------------|
| 1 | **Slowness** | ConnectWise, Autotask | Modern stack, fast API |
| 2 | **Complex Setup** | ConnectWise | Simple Docker deploy |
| 3 | **Per-Agent Pricing** | All commercial | Free, no limits |
| 4 | **Tool Fragmentation** | Most MSPs use 10+ tools | Unified platform |
| 5 | **Billing Leakage** | Tickets not tied to billing | Integrated time/billing |
| 6 | **UI/UX Issues** | Autotask, ConnectWise | Modern React UI |
| 7 | **Integration Pain** | Multi-vendor stacks | MCP + REST API |
| 8 | **Long Implementations** | Legacy PSAs | Minutes, not months |

### Direct Quotes from MSP Community

> "ConnectWise Manage is the slowest software I have ever regularly used."

> "It takes more time to create and add time to a ticket than it does to actually work the ticket."

> "We've invested over a thousand man-hours just trying to get the system functional."

> "Legacy PSAs arrive with long implementations, consultant dependence, and a 'we can do anything if you configure it' posture."

> "72% of MSPs say their existing tools don't fully support their operations."

---

## RMM Integration Patterns (for future aegis-rmm)

**Sources:**
- [SuperOps PSA-RMM Integration](https://superops.com/psa-rmm-integration)
- [Kaseya RMM-PSA Guide](https://www.kaseya.com/resource/psa-rmm-buyers-guide/)

### Core Integration Patterns

1. **Alert-to-Ticket Conversion**
   - RMM detects issue → Creates PSA ticket automatically
   - No manual intervention required
   - Configurable per monitor type

2. **Real-Time Data Sync**
   - Asset data synced between RMM and PSA
   - Technician sees current info without switching tools
   - Bidirectional sync where possible

3. **Device Mapping**
   - RMM devices mapped to PSA configuration items
   - Custom fields synchronized
   - Product/category alignment

4. **Remote Control Integration**
   - Click in ticket → Launch remote session
   - Session logged to ticket automatically
   - Time tracking integrated

### RMM-PSA API Contract (aegis-rmm → aegis)

```typescript
// Alert to Ticket
POST /api/v1/tickets
{
  "source": "rmm",
  "source_id": "alert-12345",
  "asset_id": "uuid",
  "subject": "CPU High on SERVER01",
  "description": "CPU usage exceeded 90% for 15 minutes",
  "priority": "high",
  "auto_close_on_clear": true
}

// Asset Sync
PUT /api/v1/assets/{id}
{
  "rmm_agent_id": "agent-uuid",
  "last_seen": "2024-12-31T12:00:00Z",
  "os_version": "Windows 11 23H2",
  "installed_software": [...],
  "network_interfaces": [...]
}

// Session Logging
POST /api/v1/tickets/{id}/time-entries
{
  "source": "rmm-remote",
  "session_id": "session-uuid",
  "duration_minutes": 15,
  "notes": "Remote session via aegis-rmm"
}
```

### Future aegis-rmm Features

| Feature | Priority | Notes |
|---------|----------|-------|
| Agent deployment | P0 | Windows, Mac, Linux |
| System monitoring | P0 | CPU, RAM, Disk |
| Alert management | P0 | Thresholds, notifications |
| Remote control | P1 | Built-in or integrate |
| Patch management | P1 | Windows Update, third-party |
| Script execution | P1 | PowerShell, Bash |
| Software deployment | P2 | MSI, EXE, scripts |

---

## Aegis Product Suite Architecture

### Full Product Suite

```
┌─────────────────────────────────────────────────────────────────┐
│                      AEGIS PRODUCT SUITE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ aegis│  │  aegis-rmm  │  │  aegis-mdm  │              │
│  │    (ITSM)   │  │   (RMM)     │  │   (MDM)     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │     aegis-mtp         │                          │
│              │  (Multi-Tenant Portal)│                          │
│              └───────────────────────┘                          │
│                          │                                       │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │     aegis-web         │                          │
│              │  (Marketing/Docs)     │                          │
│              └───────────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Separate RMM and MDM?

| Aspect | aegis-rmm | aegis-mdm |
|--------|-----------|-----------|
| **Target** | Desktops, servers | Mobile devices |
| **Agent** | Custom agent (Go/Rust) | Apple DEP, Android Enterprise |
| **Deployment** | MSI/PKG/DEB installer | MDM enrollment |
| **Remote** | RDP, SSH, VNC | Limited (screen sharing) |
| **Patching** | Full control | App Store/Play Store |
| **Scripting** | PowerShell, Bash, Python | None (sandboxed) |
| **Protocols** | MQTT, gRPC, REST | APNS, FCM, SCEP |

### Integration with aegis

```
                    aegis (ITSM)
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ Tickets  │   │  Assets  │   │  Users   │
     └────┬─────┘   └────┬─────┘   └────┬─────┘
          │              │              │
          │              │              │
    ┌─────┴──────────────┴──────────────┴─────┐
    │           INTEGRATION API                │
    │  POST /api/v1/alerts (alert → ticket)   │
    │  PUT  /api/v1/assets (sync device info) │
    │  POST /api/v1/remote-sessions (logging) │
    └─────┬──────────────┬──────────────┬─────┘
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │aegis-rmm │   │aegis-mdm │   │ 3rd Party│
    │  Agent   │   │ Profiles │   │ (N-able) │
    └──────────┘   └──────────┘   └──────────┘
```

### aegis-rmm Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         aegis-rmm                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    RMM Server                            │    │
│  │  • Agent registration & heartbeat                       │    │
│  │  • Command queue (scripts, patches)                     │    │
│  │  • Alert processing                                     │    │
│  │  • Remote session broker                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    RMM Agent                             │    │
│  │  • System metrics (CPU, RAM, Disk, Network)             │    │
│  │  • Event log forwarding                                 │    │
│  │  • Script execution                                     │    │
│  │  • Patch scanning & installation                        │    │
│  │  • Remote control (RDP relay)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Platforms: Windows, macOS, Linux                               │
│  Agent: Go or Rust (lightweight, cross-platform)                │
│  Protocol: MQTT for real-time, REST for commands                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### aegis-mdm Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         aegis-mdm                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    MDM Server                            │    │
│  │  • Apple DEP/ABM integration                            │    │
│  │  • Android Enterprise (Work Profile)                    │    │
│  │  • SCEP certificate authority                           │    │
│  │  • Configuration profiles                               │    │
│  │  • App deployment (VPP, Play Store)                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    ▼                   ▼                        │
│  ┌───────────────────────┐ ┌───────────────────────┐           │
│  │     Apple Devices     │ │   Android Devices     │           │
│  │  • MDM profile        │ │  • Work profile       │           │
│  │  • Supervised mode    │ │  • Device admin       │           │
│  │  • VPP apps           │ │  • Managed Play       │           │
│  │  • APNS               │ │  • FCM                │           │
│  └───────────────────────┘ └───────────────────────┘           │
│                                                                  │
│  Protocols: APNS, FCM, SCEP, MDM protocol                       │
│  Enrollment: DEP, QR code, manual                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Organizational Hierarchy & Delegation

### User Groups & Reporting Structure

Like Aegis, we need organizational hierarchy for:
1. Managers can request items for direct reports
2. HR can initiate offboarding for employees
3. Department heads can approve requests
4. IT admins have full access

```sql
-- User groups (like Aegis)
CREATE TABLE user_groups (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    group_type VARCHAR(50),  -- department, team, role, custom
    parent_id UUID REFERENCES user_groups(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group membership
CREATE TABLE user_group_members (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES user_groups(id),
    user_id UUID REFERENCES users(id),
    contact_id UUID REFERENCES contacts(id),
    role VARCHAR(50) DEFAULT 'member',  -- member, manager, admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reporting structure (manager → direct reports)
ALTER TABLE users ADD COLUMN manager_id UUID REFERENCES users(id);
ALTER TABLE contacts ADD COLUMN manager_id UUID REFERENCES contacts(id);

-- Delegation permissions
CREATE TABLE delegation_rules (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,

    -- Who can delegate
    delegator_type VARCHAR(20),  -- user, group, role
    delegator_id UUID,

    -- What they can do
    action VARCHAR(50),  -- request_for, approve_for, view_assets, initiate_offboarding

    -- For whom
    target_scope VARCHAR(50),  -- direct_reports, department, all
    target_group_id UUID REFERENCES user_groups(id),

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Request Delegation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST DELEGATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WHO CAN REQUEST                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Self (any user for themselves)                       │   │
│  │  • Manager (for their direct reports)                   │   │
│  │  • HR (for any employee)                                │   │
│  │  • Department Admin (for department members)            │   │
│  │  • IT Admin (for anyone)                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  APPROVAL CHAIN                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Low-cost items (< $100)                                │   │
│  │    → Manager approval                                   │   │
│  │                                                          │   │
│  │  High-cost items (> $100)                               │   │
│  │    → Manager → Department Head                          │   │
│  │                                                          │   │
│  │  Special access (VPN, admin rights)                     │   │
│  │    → Manager → IT Security                              │   │
│  │                                                          │   │
│  │  Software licenses                                       │   │
│  │    → Manager → Software Asset Manager                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Catalog Visibility Rules

```sql
-- Catalog item visibility
CREATE TABLE catalog_item_visibility (
    id UUID PRIMARY KEY,
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id),

    -- Who can see/request
    visibility_type VARCHAR(20),  -- all, groups, roles
    group_id UUID REFERENCES user_groups(id),
    role_name VARCHAR(50),

    -- Who can request for others
    can_request_for_others BOOLEAN DEFAULT false,
    request_for_scope VARCHAR(50),  -- direct_reports, department, any

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Example: New Hire Equipment Request

```
HR initiates "New Hire Equipment" request
    │
    ▼
┌─────────────────────────────────────────────┐
│  REQUEST FORM                               │
│  • Employee: John Smith (new hire)          │
│  • Department: Marketing                    │
│  • Start Date: 2024-02-01                   │
│  • Equipment Package: Standard Marketing    │
│    □ MacBook Pro 14"                        │
│    □ Dell 27" Monitor                       │
│    □ USB-C Hub                              │
│    □ Laptop Stand                           │
│    □ Microsoft 365 E3                       │
│    □ Adobe Creative Cloud                   │
│    □ Slack                                  │
└─────────────────────────────────────────────┘
    │
    ▼
APPROVAL: Marketing Manager (for department budget)
    │
    ▼
APPROVAL: IT (for equipment availability)
    │
    ▼
FULFILLMENT: IT assigns assets to John Smith
    │
    ▼
USER PROFILE: All items tracked under John
```

---

## Feature Priority Matrix (Based on Research)

### Tier 1: Must Have (MVP)

| Feature | Why Critical | Competitor Gap |
|---------|--------------|----------------|
| Fast ticketing | #1 PSA complaint | ConnectWise/Autotask slow |
| Simple deployment | Legacy PSAs take months | Docker in minutes |
| No per-agent fees | Major cost driver | All commercial PSAs |
| Modern UI | Autotask UI criticized | Clean React interface |
| Self-hosted | Data sovereignty | Zendesk, Freshservice, etc. |
| Full API | ITGlue locks to Enterprise | All plans |
| MCP server | AI-native access | No competitor has this |

### Tier 2: Differentiators

| Feature | Why Important | Competitor Status |
|---------|---------------|-------------------|
| AI triage | Reduce L1 workload | Freddy AI, basic in others |
| Documentation + PSA | Avoid tool fragmentation | Usually separate |
| RMM API hooks | Future aegis-rmm | Most require same vendor |
| Problem management | ITIL compliance | Missing in ITFlow |
| Change management | Enterprise requirement | Missing in ITFlow |
| Workflow automation | Reduce manual work | Complex in legacy PSAs |

### Tier 3: Nice to Have

| Feature | Notes |
|---------|-------|
| Service catalog | E-commerce style requests |
| CMDB auto-discovery | Via RMM agent |
| Release management | For larger orgs |
| Advanced analytics | Dashboards, reports |
| Mobile app | iOS/Android |

---

## Aegis API Design (v1)

Based on research, adopt these patterns:

### Endpoint Structure

```
# Core Resources
/api/v1/tickets
/api/v1/contacts
/api/v1/clients
/api/v1/assets
/api/v1/documents
/api/v1/credentials

# ITIL Resources (aliases + new)
/api/v1/incidents          # Alias for tickets with type=incident
/api/v1/problems           # Problem management
/api/v1/changes            # Change management

# Nested Resources
/api/v1/tickets/{id}/replies
/api/v1/tickets/{id}/attachments
/api/v1/tickets/{id}/time-entries
/api/v1/assets/{id}/interfaces
/api/v1/documents/{id}/versions

# Bulk Operations
/api/v1/tickets/bulk       # POST: create many, PUT: update many
/api/v1/tickets/count      # GET: statistics
```

### Request/Response Standards

```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 150,
    "total_pages": 3
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Subject is required",
    "details": [...]
  }
}

// Headers
X-Request-Id: uuid           # For tracing
X-RateLimit-Limit: 1000      # Requests per hour
X-RateLimit-Remaining: 950
Idempotency-Key: uuid        # For safe retries
```

---

## Freshservice API v2 Analysis

**Sources:**
- [Freshservice API](https://api.freshservice.com/)
- [Asset Management V2 APIs](https://support.freshservice.com/support/discussions/topics/322755)

### Key Endpoints

```
# Tickets & Service Requests
GET    /api/v2/tickets                    # List tickets
GET    /api/v2/tickets?type=Service+Request  # Filter by type
POST   /api/v2/tickets                    # Create ticket
GET    /api/v2/tickets/{id}               # Get ticket
PUT    /api/v2/tickets/{id}               # Update ticket

# Requesters (End Users)
GET    /api/v2/requesters                 # List requesters
POST   /api/v2/requesters                 # Create requester
GET    /api/v2/requesters/{id}            # Get requester
PUT    /api/v2/requesters/{id}            # Update requester
DELETE /api/v2/requesters/{id}/forget     # GDPR forget
PUT    /api/v2/requesters/{id}/convert_to_agent

# Assets
GET    /api/v2/assets                     # List assets
POST   /api/v2/assets                     # Create asset
GET    /api/v2/assets/{id}                # Get asset
PUT    /api/v2/assets/{id}                # Update asset
GET    /api/v2/assets/{id}/contracts      # Asset contracts

# Asset Types, Products, Locations, Vendors
GET    /api/v2/asset_types
GET    /api/v2/products
GET    /api/v2/locations
GET    /api/v2/vendors

# Service Catalog
GET    /api/v2/service_catalog/items      # Catalog items
POST   /api/v2/service_catalog/items/{id}/place_request
```

### Freshservice Offboarding Features

- Auto-detects devices and software assigned to employee
- Creates "reclaim assets" ticket automatically
- Full list of items to return with due dates
- Integrates with AD, M365, Google Workspace for deprovisioning
- Audit trail for compliance

---

## Alert Management & Correlation Design

**Sources:**
- [Event Correlation Guide](https://www.inoc.com/event-correlation)
- [Squadcast Deduplication](https://support.squadcast.com/services/alert-deduplication-rules/alert-deduplication-rules)
- [BigPanda Correlation](https://docs.bigpanda.io/en/alert-correlation-logic)

### The Problem

Without proper correlation:
- Single incident generates multiple tickets across teams
- 60-80% of raw alerts are noise
- Alert fatigue leads to missed critical issues
- "Alert storms" overwhelm technicians

### Solution: Alerts → Incidents → Tickets

```
┌─────────────────────────────────────────────────────────────────┐
│                        ALERT PIPELINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   RMM Agent    Monitoring    External      Manual               │
│      │            │            │            │                    │
│      ▼            ▼            ▼            ▼                    │
│   ┌─────────────────────────────────────────────┐               │
│   │              ALERTS TABLE                    │               │
│   │  (Raw events, may have duplicates)          │               │
│   └─────────────────────────────────────────────┘               │
│                        │                                         │
│                        ▼                                         │
│   ┌─────────────────────────────────────────────┐               │
│   │         CORRELATION ENGINE                   │               │
│   │  • Deduplication (same source+type+asset)   │               │
│   │  • Clustering (related alerts → 1 incident) │               │
│   │  • Time windowing (alerts within 5 min)     │               │
│   │  • Tag-based grouping                       │               │
│   └─────────────────────────────────────────────┘               │
│                        │                                         │
│                        ▼                                         │
│   ┌─────────────────────────────────────────────┐               │
│   │              INCIDENTS TABLE                 │               │
│   │  (Correlated, actionable incidents)         │               │
│   └─────────────────────────────────────────────┘               │
│                        │                                         │
│                        ▼ (auto or manual)                        │
│   ┌─────────────────────────────────────────────┐               │
│   │              TICKETS TABLE                   │               │
│   │  (Work items for technicians)               │               │
│   └─────────────────────────────────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Correlation Rules

```typescript
interface CorrelationRule {
  id: string
  name: string

  // Matching criteria
  match: {
    source?: string      // rmm, monitoring, external
    alert_type?: string  // cpu_high, disk_full, etc.
    asset_id?: string    // Same asset
    client_id?: string   // Same client
  }

  // Grouping
  time_window_minutes: number  // 5-60 minutes
  max_alerts_per_incident: number  // Default 100

  // Actions
  actions: {
    create_ticket: boolean
    ticket_priority: string
    auto_close_on_clear: boolean
    notification_channels: string[]
  }
}
```

### Database Schema Addition

```sql
-- Alerts (raw events from any source)
CREATE TABLE alerts (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,

    -- Source identification
    source VARCHAR(50) NOT NULL,  -- rmm, monitoring, email, api
    source_alert_id VARCHAR(255), -- External ID for dedup

    -- Classification
    alert_type VARCHAR(100),      -- cpu_high, disk_full, service_down
    severity VARCHAR(20),         -- critical, warning, info

    -- Context
    asset_id UUID REFERENCES assets(id),
    client_id UUID REFERENCES clients(id),

    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    raw_data JSONB,               -- Original alert payload

    -- Correlation
    incident_id UUID REFERENCES incidents(id),
    correlation_key VARCHAR(255), -- For matching: source:type:asset

    -- Status
    status VARCHAR(20) DEFAULT 'new', -- new, correlated, suppressed

    -- Timestamps
    fired_at TIMESTAMP WITH TIME ZONE NOT NULL,
    cleared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Incidents (correlated alerts)
CREATE TABLE incidents (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,

    -- Identification
    incident_number SERIAL,

    -- Classification
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'open',

    -- Context
    asset_id UUID REFERENCES assets(id),
    client_id UUID REFERENCES clients(id),

    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Correlation stats
    alert_count INT DEFAULT 1,
    first_alert_at TIMESTAMP WITH TIME ZONE,
    last_alert_at TIMESTAMP WITH TIME ZONE,

    -- Ticket link (when escalated)
    ticket_id UUID REFERENCES tickets(id),
    auto_created_ticket BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Correlation rules
CREATE TABLE correlation_rules (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Matching
    match_criteria JSONB NOT NULL,
    time_window_minutes INT DEFAULT 15,
    max_alerts INT DEFAULT 100,

    -- Actions
    auto_create_ticket BOOLEAN DEFAULT false,
    ticket_priority VARCHAR(20),
    auto_close_on_clear BOOLEAN DEFAULT true,

    is_active BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,  -- Higher = evaluated first

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## User-Centric Asset & Resource Tracking

### The Offboarding Problem

When an employee leaves, IT needs to:
1. Know ALL assets assigned (laptops, monitors, keyboards, chargers)
2. Know ALL software licenses to revoke
3. Know ALL credentials/access to disable
4. Know ALL SaaS services to deprovision
5. Track returns (including **quantities** for non-serialized items)

### Solution: User Resource Registry

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER RESOURCE REGISTRY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER PROFILE                                                    │
│  ├── Assets (serialized)                                        │
│  │   ├── Laptop (SN: ABC123) - Assigned 2024-01-15             │
│  │   ├── Monitor (SN: XYZ789) - Assigned 2024-01-15            │
│  │   └── Phone (SN: DEF456) - Assigned 2024-03-01              │
│  │                                                               │
│  ├── Accessories (quantity-tracked)                             │
│  │   ├── Laptop Charger - Qty: 2 (1 home, 1 office)            │
│  │   ├── USB-C Hub - Qty: 1                                     │
│  │   └── Webcam - Qty: 1                                        │
│  │                                                               │
│  ├── Software Licenses                                          │
│  │   ├── Microsoft 365 E3 - License #12345                     │
│  │   ├── Adobe Creative Cloud - License #67890                 │
│  │   └── Zoom Pro - User seat                                   │
│  │                                                               │
│  ├── SaaS Services                                              │
│  │   ├── Slack - workspace member                               │
│  │   ├── GitHub - org member                                    │
│  │   └── Salesforce - user account                              │
│  │                                                               │
│  ├── Credentials/Access                                         │
│  │   ├── VPN Access - Active                                    │
│  │   ├── Server Room Badge - #1234                              │
│  │   └── Shared Drive Access - Marketing                        │
│  │                                                               │
│  └── Access Groups                                              │
│      ├── AD Groups: Marketing, All-Staff                        │
│      └── Google Groups: marketing@, all@                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema for Resource Tracking

```sql
-- User assignments (unified view of all resources)
CREATE TABLE user_assignments (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),        -- Internal user
    contact_id UUID REFERENCES contacts(id),  -- External contact

    -- What is assigned
    resource_type VARCHAR(50) NOT NULL,  -- asset, accessory, license, saas, credential, access_group
    resource_id UUID NOT NULL,           -- FK to respective table

    -- For quantity-tracked items (accessories, consumables)
    quantity INT DEFAULT 1,

    -- Assignment details
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    notes TEXT,

    -- Return tracking
    expected_return_date DATE,
    returned_at TIMESTAMP WITH TIME ZONE,
    returned_quantity INT,
    return_condition VARCHAR(50),  -- good, damaged, lost
    return_notes TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'active',  -- active, pending_return, returned, lost

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Accessories (non-serialized, quantity-tracked)
CREATE TABLE accessories (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,

    -- Identification
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    category VARCHAR(100),  -- charger, cable, adapter, peripheral

    -- Inventory
    total_quantity INT DEFAULT 0,
    available_quantity INT DEFAULT 0,
    min_quantity_alert INT DEFAULT 5,

    -- Pricing
    unit_cost DECIMAL(10,2),

    -- Tracking
    requires_return BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SaaS services tracked
CREATE TABLE saas_services (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    vendor VARCHAR(255),
    url VARCHAR(500),

    -- License info
    license_type VARCHAR(50),  -- per_user, per_seat, unlimited
    total_licenses INT,
    used_licenses INT DEFAULT 0,

    -- Cost
    cost_per_license DECIMAL(10,2),
    billing_frequency VARCHAR(20),  -- monthly, yearly
    renewal_date DATE,

    -- Provisioning
    auto_provision BOOLEAN DEFAULT false,
    provision_method VARCHAR(50),  -- manual, scim, api, sso

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offboarding tasks (auto-generated checklist)
CREATE TABLE offboarding_tasks (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,

    -- The departing user
    user_id UUID REFERENCES users(id),
    contact_id UUID REFERENCES contacts(id),

    -- Offboarding request
    ticket_id UUID REFERENCES tickets(id),
    departure_date DATE,

    -- Task details
    task_type VARCHAR(50) NOT NULL,  -- return_asset, revoke_license, disable_access
    resource_type VARCHAR(50),
    resource_id UUID,
    resource_name VARCHAR(255),

    -- For quantity returns
    quantity_to_return INT DEFAULT 1,
    quantity_returned INT DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users(id),
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Service Catalog & Request Management

### Requestable Items

```sql
-- Service catalog items (requestable)
CREATE TABLE catalog_items (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,

    -- Display
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category_id UUID REFERENCES catalog_categories(id),

    -- Type
    item_type VARCHAR(50) NOT NULL,  -- asset, accessory, software, access, service

    -- Linked resource (for assets/accessories)
    asset_type_id UUID REFERENCES asset_types(id),
    accessory_id UUID REFERENCES accessories(id),
    software_id UUID REFERENCES software(id),

    -- Request settings
    is_requestable BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT true,
    approval_workflow_id UUID,

    -- SLA
    expected_fulfillment_days INT DEFAULT 3,

    -- Cost (for chargeback)
    cost DECIMAL(10,2),
    show_cost_to_requester BOOLEAN DEFAULT false,

    -- Availability
    max_per_user INT,  -- NULL = unlimited
    in_stock BOOLEAN DEFAULT true,

    -- Form customization
    request_form_fields JSONB DEFAULT '[]',

    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Catalog categories
CREATE TABLE catalog_categories (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    parent_id UUID REFERENCES catalog_categories(id),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service requests (from catalog)
CREATE TABLE service_requests (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,

    -- Request info
    request_number SERIAL,
    catalog_item_id UUID REFERENCES catalog_items(id),

    -- Requester
    requester_id UUID,  -- user or contact
    requester_type VARCHAR(20),  -- user, contact
    requested_for_id UUID,  -- If requesting for someone else

    -- Quantity (for accessories)
    quantity INT DEFAULT 1,

    -- Request details
    justification TEXT,
    custom_fields JSONB DEFAULT '{}',

    -- Approval
    approval_status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- Fulfillment
    fulfillment_status VARCHAR(20) DEFAULT 'pending',
    fulfilled_by UUID REFERENCES users(id),
    fulfilled_at TIMESTAMP WITH TIME ZONE,

    -- Linked ticket (for tracking)
    ticket_id UUID REFERENCES tickets(id),

    -- Assignment (when fulfilled)
    assignment_id UUID REFERENCES user_assignments(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Serialized vs Quantity-Based Asset Tracking

### The Problem

- **Serialized items** (laptops, phones): Track individually by SN
- **Quantity items** (chargers, cables): Track by count
- On offboarding: "Return 2 chargers" not "Return charger SN: X"

### Solution: Dual Tracking Model

```sql
-- Assets table already handles serialized
-- For each asset: serial_number, individual tracking

-- Accessories table handles quantity-based
-- Total in stock, assigned quantities per user

-- User assignments tracks both:
-- For assets: resource_type='asset', quantity=1
-- For accessories: resource_type='accessory', quantity=2
```

### Return Workflow

```
OFFBOARDING INITIATED
        │
        ▼
┌─────────────────────────────────────────────┐
│  GENERATE RETURN CHECKLIST                   │
│  Query user_assignments where status='active'│
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  SERIALIZED ITEMS                           │
│  □ MacBook Pro (SN: C02X123456)             │
│  □ iPhone 14 (SN: DNPXYZ789)                │
│  □ Dell Monitor (SN: CN-0ABC123)            │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  QUANTITY ITEMS                             │
│  □ USB-C Charger (Qty: 2)                   │
│  □ Lightning Cable (Qty: 1)                 │
│  □ USB Hub (Qty: 1)                         │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  ACCESS TO REVOKE                           │
│  □ Microsoft 365 License                    │
│  □ Slack Workspace                          │
│  □ GitHub Organization                      │
│  □ VPN Access                               │
│  □ AD Groups: Marketing, All-Staff          │
└─────────────────────────────────────────────┘
        │
        ▼
  TRACK RETURNS (partial allowed)
        │
        ▼
  COMPLETE WHEN ALL RETURNED/REVOKED
```

---

## aegis ↔ aegis-mtp API Contract

### MTP Registration Flow

```
1. Client installs aegis
2. Client generates API key in settings
3. Client registers with MTP portal
4. MTP stores: client_url, api_key_hash, permissions
5. Vendor requests access via MTP
6. Client approves vendor in aegis
7. Vendor can now call client API through MTP gateway
```

### MTP Gateway Endpoints

```
# Vendor → MTP → Client routing
POST /api/mtp/v1/clients/{client_id}/tickets
GET  /api/mtp/v1/clients/{client_id}/assets
GET  /api/mtp/v1/clients/{client_id}/documents/search

# MTP Management
POST /api/mtp/v1/vendors/register
POST /api/mtp/v1/vendors/api-keys
GET  /api/mtp/v1/vendors/usage
POST /api/mtp/v1/clients/connect
```

### Permission Scopes

```typescript
const SCOPES = {
  'tickets:read': 'View tickets',
  'tickets:write': 'Create/update tickets',
  'assets:read': 'View asset inventory',
  'assets:write': 'Update assets',
  'documents:read': 'View documentation',
  'credentials:list': 'List credential names only',
  'credentials:read': 'View credential details (sensitive)',
}
```

---

## Next Steps

1. ✅ Initialize aegis from Aegis-web template
2. ✅ Create database migrations
3. Build MCP server scaffolding
4. Implement Phase 1: Core (auth, tickets, contacts)
5. Create OpenAPI spec for v1 API
6. Implement Phase 2: Enterprise (problems, changes, CMDB)
7. Build workflow automation engine
8. Plan aegis-rmm architecture
9. Launch aegis-mtp for managed hosting
