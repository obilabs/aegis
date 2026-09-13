# Aegis Project Plan

## For AI Agents Working on Aegis

This document provides the execution plan for building Aegis. Each agent should follow the documentation-first approach.

---

## Golden Rule: Documentation → MCP → API → UI

For EVERY module, follow this order:

```
1. docs/<module>.md       ← Write user guide FIRST
2. mcp/tools/<module>.ts  ← Build MCP server SECOND
3. app/api/<module>/      ← Build REST API THIRD
4. app/(portal)/<module>/ ← Build UI LAST
```

This ensures:
- Clear requirements before coding
- AI-testable interfaces via MCP
- Users can validate docs before UI exists
- Parallel work is possible

---

## Phase 1: Foundation

### Task 1.1: Initialize aegis
**Agent:** Foundation Agent
**Input:** Aegis-web as template
**Output:** aegis with basic structure

```bash
# Clone from Aegis-web
cp -r Aegis-web aegis
# Update branding, remove Aegis-specific code
# Keep: auth system, docker setup, database patterns
# Remove: Google Workspace, instances
```

**Deliverables:**
- [ ] aegis folder structure
- [ ] Updated package.json (name: aegis)
- [ ] Basic README.md
- [ ] Docker Compose setup

### Task 1.2: Database Schema
**Agent:** Database Agent
**Input:** RESEARCH.md entity definitions
**Output:** PostgreSQL migrations

**Deliverables:**
- [ ] database/migrations/001_core.sql (organizations, users, roles)
- [ ] database/migrations/002_contacts.sql
- [ ] database/migrations/003_tickets.sql
- [ ] database/migrations/004_assets.sql
- [ ] database/migrations/005_documents.sql
- [ ] database/migrations/006_credentials.sql

---

## Phase 2: Core Modules (Parallel)

### Task 2.1: Tickets Module
**Agent:** Tickets Agent
**Priority:** P0 (Critical)

**Step 1: Documentation**
```markdown
# docs/tickets.md

## Overview
Tickets are the core of Aegis...

## Creating a Ticket
1. Navigate to Tickets
2. Click "New Ticket"
3. Fill in subject, description, priority
4. Assign to user (optional)
5. Click Create

## Ticket Statuses
- Open: New tickets
- In Progress: Being worked on
- Waiting: Waiting for customer
- Resolved: Issue fixed
- Closed: Ticket completed

## API Endpoints
POST /api/v1/tickets - Create ticket
GET /api/v1/tickets - List tickets
GET /api/v1/tickets/:id - Get ticket
PATCH /api/v1/tickets/:id - Update ticket
POST /api/v1/tickets/:id/replies - Add reply
...
```

**Step 2: MCP Server**
```typescript
// mcp/tools/tickets.ts
export const ticketTools = {
  'tickets.list': {
    description: 'List tickets with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        assigned_to: { type: 'string' },
        limit: { type: 'number', default: 50 }
      }
    },
    handler: async (params) => { /* implementation */ }
  },
  // ... more tools
}
```

**Step 3: API Routes**
```
app/api/v1/tickets/route.ts         - GET (list), POST (create)
app/api/v1/tickets/[id]/route.ts    - GET, PATCH, DELETE
app/api/v1/tickets/[id]/replies/route.ts - GET, POST
```

**Step 4: UI Pages**
```
app/(portal)/tickets/page.tsx       - List view
app/(portal)/tickets/new/page.tsx   - Create form
app/(portal)/tickets/[id]/page.tsx  - Detail view
```

**Deliverables:**
- [ ] docs/tickets.md
- [ ] mcp/tools/tickets.ts
- [ ] API routes (5 endpoints)
- [ ] UI pages (3 pages)
- [ ] Ticket statuses management

---

### Task 2.2: Contacts Module
**Agent:** Contacts Agent
**Priority:** P0 (Critical)

**Deliverables:**
- [ ] docs/contacts.md
- [ ] mcp/tools/contacts.ts
- [ ] API routes
- [ ] UI pages
- [ ] Contact groups

---

### Task 2.3: Assets Module
**Agent:** Assets Agent
**Priority:** P1

**Deliverables:**
- [ ] docs/assets.md
- [ ] mcp/tools/assets.ts
- [ ] API routes
- [ ] UI pages
- [ ] Asset types/categories
- [ ] Network interfaces

---

### Task 2.4: Documents Module
**Agent:** Documents Agent
**Priority:** P1

**Deliverables:**
- [ ] docs/documents.md
- [ ] mcp/tools/documents.ts
- [ ] API routes
- [ ] UI pages
- [ ] Folders
- [ ] Full-text search

---

## Phase 3: Extended Modules

### Task 3.1: Credentials Module
**Agent:** Credentials Agent
**Priority:** P1

**Security Requirements:**
- AES-256 encryption at rest
- Decryption requires user authentication
- Audit log for all access
- Role-based access control

**Deliverables:**
- [ ] docs/credentials.md
- [ ] mcp/tools/credentials.ts (list returns names only, get requires auth)
- [ ] lib/encryption.ts
- [ ] API routes
- [ ] UI pages

---

### Task 3.2: Network Module
**Agent:** Network Agent
**Priority:** P2

**Deliverables:**
- [ ] docs/network.md
- [ ] mcp/tools/network.ts
- [ ] Networks, domains, DNS records
- [ ] API routes
- [ ] UI pages

---

### Task 3.3: Services Module
**Agent:** Services Agent
**Priority:** P2

**Deliverables:**
- [ ] docs/services.md
- [ ] mcp/tools/services.ts
- [ ] API routes
- [ ] UI pages
- [ ] Service-asset linking

---

## Phase 4: MTP Platform

### Task 4.1: aegis-mtp Core
**Agent:** MTP Agent

**Deliverables:**
- [ ] aegis-mtp project structure
- [ ] Tenant management
- [ ] Vendor registration
- [ ] API key management

### Task 4.2: API Gateway
**Agent:** Gateway Agent

**Deliverables:**
- [ ] Request routing to tenant instances
- [ ] Authentication (API keys, OAuth)
- [ ] Rate limiting
- [ ] Usage tracking

---

## Phase 5: Web & Marketing

### Task 5.1: aegis-web
**Agent:** Web Agent

**Deliverables:**
- [ ] Clone from Aegis-web
- [ ] Update branding
- [ ] ITSM-focused marketing content
- [ ] Documentation pages
- [ ] Waitlist

---

## Testing Strategy

### MCP Testing
Each MCP tool should be testable via Claude:
```
User: List all open tickets
Claude: [Uses tickets.list tool with status='open']
Claude: Found 5 open tickets: ...
```

### API Testing
- OpenAPI spec for all endpoints
- Automated tests via Playwright/Jest
- Manual testing with curl/Postman

### UI Testing
- Playwright E2E tests
- Component tests with React Testing Library

---

## File Templates

### Documentation Template
```markdown
# Module Name

## Overview
Brief description of what this module does.

## Key Concepts
- Concept 1: Explanation
- Concept 2: Explanation

## Getting Started
Step-by-step guide for new users.

## Features

### Feature 1
How to use feature 1.

### Feature 2
How to use feature 2.

## API Reference

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/module | List items |
| POST | /api/v1/module | Create item |

### Request/Response Examples
```json
// Create request
{
  "name": "Example"
}

// Response
{
  "id": "123",
  "name": "Example",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Troubleshooting
Common issues and solutions.
```

### MCP Tool Template
```typescript
import { z } from 'zod'

export const moduleTools = {
  'module.list': {
    description: 'List items with optional filters',
    inputSchema: z.object({
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }),
    handler: async (params, context) => {
      // Implementation
      return { items: [], total: 0 }
    }
  },

  'module.get': {
    description: 'Get a single item by ID',
    inputSchema: z.object({
      id: z.string(),
    }),
    handler: async (params, context) => {
      // Implementation
      return { item: null }
    }
  },

  'module.create': {
    description: 'Create a new item',
    inputSchema: z.object({
      name: z.string(),
      // ... other fields
    }),
    handler: async (params, context) => {
      // Implementation
      return { item: null }
    }
  },
}
```

---

## Success Criteria

### aegis MVP
- [ ] User can create account and log in
- [ ] User can create, view, and manage tickets
- [ ] User can manage contacts
- [ ] User can track assets
- [ ] User can create and search documents
- [ ] User can store credentials securely
- [ ] MCP server exposes all core functionality
- [ ] Docker deployment works out of the box

### aegis-mtp MVP
- [ ] Vendors can register and get API keys
- [ ] Vendors can connect to client aegis instances
- [ ] API requests are properly routed and authenticated
- [ ] Usage is tracked and can be billed

### aegis-web MVP
- [ ] Marketing site is live
- [ ] Documentation is comprehensive
- [ ] Waitlist captures interested users
