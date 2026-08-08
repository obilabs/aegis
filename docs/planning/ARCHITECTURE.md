# Aegis Architecture

## Overview

Aegis is an ITSM (IT Service Management) platform suite following the Aegis model:
- **Data Sovereignty:** Client owns and controls their data
- **Self-Hosted:** Deploy on client infrastructure
- **Vendor Access:** Controlled API access via MTP portal

---

## Product Suite

```
┌─────────────────────────────────────────────────────────────────┐
│                         AEGIS SUITE                              │
├─────────────────┬──────────────────┬────────────────────────────┤
│  aegis   │   aegis-mtp      │      aegis-web             │
│  (Single Org)   │   (Multi-Tenant) │      (Marketing)           │
├─────────────────┼──────────────────┼────────────────────────────┤
│ • Self-hosted   │ • SaaS platform  │ • Marketing site           │
│ • One org       │ • MSP portal     │ • Documentation            │
│ • Full ITSM     │ • Vendor access  │ • Waitlist                 │
│ • MCP server    │ • API gateway    │ • Credits/Donations        │
│ • Client owns   │ • Billing        │                            │
│   all data      │ • Multi-client   │                            │
└─────────────────┴──────────────────┴────────────────────────────┘
```

---

## aegis (Single Organization ITSM)

### Purpose
Self-hosted ITSM for a single organization. The organization owns and controls all their data.

### Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL 16
- **Auth:** better-auth
- **Styling:** Tailwind CSS
- **Deployment:** Docker Compose

### Module Structure
```
aegis/
├── docs/                    # User documentation (WRITE FIRST)
│   ├── getting-started.md
│   ├── tickets.md
│   ├── assets.md
│   └── ...
├── mcp/                     # MCP server (BUILD SECOND)
│   ├── server.ts
│   ├── tools/
│   │   ├── tickets.ts
│   │   ├── assets.ts
│   │   └── ...
│   └── package.json
├── app/                     # Next.js app (BUILD THIRD)
│   ├── (auth)/
│   ├── (portal)/
│   │   ├── dashboard/
│   │   ├── tickets/
│   │   ├── assets/
│   │   ├── docs/
│   │   ├── credentials/
│   │   └── settings/
│   └── api/
├── lib/
├── components/
├── database/
│   └── migrations/
└── docker-compose.yml
```

### Core Modules

| Module | Description | Priority |
|--------|-------------|----------|
| Auth | Login, RBAC, sessions | P0 |
| Setup | Organization wizard | P0 |
| Dashboard | Overview, metrics | P0 |
| Tickets | Full ticketing system | P0 |
| Contacts | Contact management | P0 |
| Assets | Asset inventory | P1 |
| Documents | KB & documentation | P1 |
| Credentials | Password vault | P1 |
| Network | Network documentation | P2 |
| Services | Recurring services | P2 |
| Billing | Invoices, quotes | P3 |
| Projects | Project management | P3 |

### Database Schema (PostgreSQL)

```sql
-- Core
organizations (id, name, domain, settings, created_at)
users (id, email, password_hash, name, role, created_at)
user_roles (id, name, permissions)

-- Contacts (External people/customers)
contacts (id, org_id, name, email, phone, title, is_primary, created_at)
contact_groups (id, org_id, name)
contact_group_members (contact_id, group_id)

-- Tickets
tickets (id, org_id, number, subject, description, status, priority,
         contact_id, assigned_to, created_by, created_at, resolved_at)
ticket_statuses (id, org_id, name, color, order, is_default, is_closed)
ticket_replies (id, ticket_id, user_id, content, is_internal, created_at)
ticket_attachments (id, ticket_id, filename, path, size, created_at)

-- Assets
assets (id, org_id, name, type, make, model, serial, status,
        contact_id, location_id, created_at)
asset_types (id, org_id, name, icon)
asset_interfaces (id, asset_id, name, type, ip, mac, created_at)

-- Documentation
documents (id, org_id, title, content, folder_id, created_by, created_at)
folders (id, org_id, name, parent_id)

-- Credentials
credentials (id, org_id, name, username, password_encrypted, url,
             created_by, created_at)
credential_access (credential_id, user_id, access_level)

-- Network
networks (id, org_id, name, cidr, gateway, vlan, created_at)
domains (id, org_id, name, registrar, expires_at, created_at)
dns_records (id, domain_id, type, name, value, ttl)

-- Services
services (id, org_id, name, description, contact_id, status, created_at)
service_assets (service_id, asset_id)

-- Audit
audit_log (id, org_id, user_id, action, entity_type, entity_id,
           details, ip_address, created_at)
```

### MCP Server Design

```typescript
// aegis/mcp/server.ts
const tools = {
  // Tickets
  'tickets.list': { params: { status?, priority?, assignee? } },
  'tickets.get': { params: { id } },
  'tickets.create': { params: { subject, description, priority?, contact_id? } },
  'tickets.reply': { params: { ticket_id, content, is_internal? } },
  'tickets.assign': { params: { ticket_id, user_id } },
  'tickets.close': { params: { ticket_id, resolution? } },

  // Assets
  'assets.list': { params: { type?, status?, contact_id? } },
  'assets.get': { params: { id } },
  'assets.create': { params: { name, type, make?, model?, serial? } },
  'assets.update': { params: { id, ...fields } },

  // Documents
  'docs.search': { params: { query } },
  'docs.get': { params: { id } },
  'docs.create': { params: { title, content, folder_id? } },

  // Credentials
  'credentials.list': { params: { } }, // Returns names only
  'credentials.get': { params: { id } }, // Requires auth, returns decrypted

  // Contacts
  'contacts.list': { params: { search? } },
  'contacts.get': { params: { id } },
}
```

---

## aegis-mtp (Multi-Tenant Platform)

### Purpose
SaaS platform for MSPs/IT providers to manage multiple clients. Provides API gateway for vendor access to client Aegis instances.

### Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        aegis-mtp                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   Tenant A   │   │   Tenant B   │   │   Tenant C   │        │
│  │  (Client X)  │   │  (Client Y)  │   │  (Client Z)  │        │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘        │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                   API Gateway                        │       │
│  │  • Authentication (API keys, OAuth)                  │       │
│  │  • Rate limiting                                     │       │
│  │  • Request routing to tenant instances               │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                 Vendor Portal                        │       │
│  │  • Vendor registration                               │       │
│  │  • API key management                                │       │
│  │  • Usage analytics                                   │       │
│  │  • Billing                                           │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
   ┌───────────┐      ┌───────────┐      ┌───────────┐
   │ aegis-    │      │ aegis-    │      │ aegis-    │
   │ client A  │      │ client B  │      │ client C  │
   │ (on-prem) │      │ (cloud)   │      │ (on-prem) │
   └───────────┘      └───────────┘      └───────────┘
```

### Tenant Model
- Each tenant is a separate aegis instance
- MTP stores connection info, not actual data
- API requests are proxied to tenant instances

### Database Schema
```sql
-- Tenants (aegis instances)
tenants (id, name, instance_url, api_key_hash, status, created_at)

-- Vendors (MSPs using the API)
vendors (id, name, email, company, api_key_hash, status, created_at)

-- Vendor-Tenant Access
vendor_tenant_access (vendor_id, tenant_id, permissions, created_at)

-- API Usage
api_usage (id, vendor_id, tenant_id, endpoint, method, status, created_at)

-- Billing
subscriptions (id, vendor_id, plan, status, current_period_end)
```

---

## aegis-web (Marketing & Documentation)

### Purpose
Public-facing site for Aegis:
- Marketing pages
- Documentation
- Waitlist
- Credits/donations
- Support portal

### Based On
Clone of Aegis-web with Aegis branding and ITSM-focused content.

---

## Development Workflow

### Documentation-First Development

```
For each module:

1. WRITE DOCUMENTATION
   └── docs/<module>.md
       • What it does
       • How to use it
       • API endpoints
       • Examples

2. BUILD MCP SERVER
   └── mcp/tools/<module>.ts
       • Tool definitions
       • Input schemas
       • Implementation stubs

3. BUILD API
   └── app/api/<module>/
       • REST endpoints
       • OpenAPI spec

4. BUILD UI
   └── app/(portal)/<module>/
       • Page components
       • Forms
       • Lists
```

### Agent Distribution

```
Phase 1: Foundation (Sequential)
├── Agent 1: aegis auth & setup
└── Agent 2: aegis database schema

Phase 2: Core Modules (Parallel)
├── Agent 3: Tickets module (docs → MCP → API → UI)
├── Agent 4: Contacts module (docs → MCP → API → UI)
├── Agent 5: Assets module (docs → MCP → API → UI)
└── Agent 6: Documents module (docs → MCP → API → UI)

Phase 3: Extended Modules (Parallel)
├── Agent 7: Credentials module
├── Agent 8: Network module
└── Agent 9: Services module

Phase 4: MTP (Sequential)
├── Agent 10: aegis-mtp core
└── Agent 11: aegis-mtp API gateway

Phase 5: Web (Parallel)
└── Agent 12: aegis-web (clone from Aegis-web)
```

---

## Security Considerations

### aegis
- Encrypted credentials storage (AES-256)
- Role-based access control
- Audit logging
- Session management
- API rate limiting

### aegis-mtp
- Tenant isolation
- API key rotation
- Rate limiting per vendor
- Request signing
- Audit trails

---

## Deployment Options

### aegis
```yaml
# docker-compose.yml
services:
  web:
    image: aegis
    environment:
      - DATABASE_URL
      - ENCRYPTION_KEY
    ports:
      - "3000:3000"
  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### aegis-mtp
- Kubernetes recommended for multi-tenant
- Separate databases per tenant option
- CDN for static assets

---

## API Versioning

All APIs use versioned paths:
- `/api/v1/tickets`
- `/api/v1/assets`
- etc.

MCP server exposes same capabilities as REST API.

---

## Next Steps

1. Initialize aegis from Aegis-web template
2. Create documentation templates
3. Build MCP server scaffolding
4. Implement Phase 1 (auth & database)
5. Begin parallel module development
