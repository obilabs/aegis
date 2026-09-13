# Aegis - Development Workflow

## Documentation-First Approach

**For each new feature, follow this order:**

```
1. docs/features/<feature>.md    ← Write user guide FIRST
2. mcp/tools/<feature>.ts        ← Build MCP tools SECOND
3. app/api/v1/<feature>/         ← Build REST API THIRD
4. app/(portal)/<feature>/       ← Build UI LAST
```

This ensures:
- Clear requirements before coding
- AI-testable interfaces via MCP
- Users can validate docs before UI exists
- Consistent implementation across features

---

## Step 1: Feature Documentation

Create `docs/features/<feature>.md` with:

```markdown
# Feature Name

## Overview
What this feature does and why.

## User Stories
- As a [role], I want to [action] so that [benefit]

## Screens / Views
- List view: shows X with columns Y, Z
- Detail view: shows full record
- Create/Edit form: fields A, B, C

## API Endpoints
- GET /api/v1/feature - List all
- POST /api/v1/feature - Create
- GET /api/v1/feature/:id - Get one
- PATCH /api/v1/feature/:id - Update
- DELETE /api/v1/feature/:id - Delete

## MCP Tools
- feature.list - List with filters
- feature.get - Get by ID
- feature.create - Create new
- feature.search - Full-text search

## Database Tables
Reference to init.sql sections

## Business Rules
- Validation rules
- Permission requirements
- Workflow states
```

---

## Step 2: MCP Tools

Create `mcp/tools/<feature>.ts`:

```typescript
import { z } from 'zod'

export const featureTools = {
  'feature.list': {
    description: 'List features with optional filters',
    parameters: z.object({
      status: z.enum(['active', 'archived']).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }),
    execute: async (params) => {
      // Implementation
    }
  },

  'feature.create': {
    description: 'Create a new feature',
    parameters: z.object({
      name: z.string(),
      // ...
    }),
    execute: async (params) => {
      // Implementation
    }
  }
}
```

---

## Step 3: REST API

Create `app/api/v1/<feature>/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // List implementation
}

export async function POST(request: NextRequest) {
  // Create implementation
}
```

---

## Step 4: UI

Create pages in `app/(portal)/<feature>/`:

```
app/(portal)/feature/
├── page.tsx           # List view
├── [id]/page.tsx      # Detail view
├── new/page.tsx       # Create form
└── [id]/edit/page.tsx # Edit form
```

---

## Feature Checklist Template

```markdown
## Feature: [Name]

### Documentation
- [ ] docs/features/<name>.md created
- [ ] User stories defined
- [ ] API endpoints documented
- [ ] MCP tools documented
- [ ] Database tables referenced

### MCP
- [ ] mcp/tools/<name>.ts created
- [ ] All tools tested via MCP client
- [ ] Error handling complete

### API
- [ ] GET /api/v1/<name> (list)
- [ ] POST /api/v1/<name> (create)
- [ ] GET /api/v1/<name>/:id (get)
- [ ] PATCH /api/v1/<name>/:id (update)
- [ ] DELETE /api/v1/<name>/:id (delete)
- [ ] OpenAPI spec updated

### UI
- [ ] List page
- [ ] Detail page
- [ ] Create form
- [ ] Edit form
- [ ] Delete confirmation
- [ ] Loading states
- [ ] Error states
```

---

## Current Feature Status

| Feature | Docs | MCP | API | UI |
|---------|------|-----|-----|-----|
| Auth | ✅ | ⬜ | ⬜ | ⬜ |
| Tickets | ⬜ | ⬜ | ⬜ | ⬜ |
| Contacts | ⬜ | ⬜ | ⬜ | ⬜ |
| Assets | ⬜ | ⬜ | ⬜ | ⬜ |
| Documents | ⬜ | ⬜ | ⬜ | ⬜ |
| Credentials | ⬜ | ⬜ | ⬜ | ⬜ |
| Knowledge Base | ⬜ | ⬜ | ⬜ | ⬜ |
| AI Chat | ⬜ | ⬜ | ⬜ | ⬜ |

---

## Why This Order?

1. **Docs first** = Think before coding
2. **MCP second** = AI can test before UI exists
3. **API third** = Backend validates business logic
4. **UI last** = Frontend consumes stable API

This prevents:
- Building wrong features
- Inconsistent API designs
- Missing edge cases
- Untestable code
