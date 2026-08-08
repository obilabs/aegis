import { z } from 'zod'
import { registry, ErrorSchema } from './registry'

const uuid = () => z.string().uuid()

// ---------------------------------------------------------------------------
// Portal: Ticket CRUD
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/portal/tickets',
  summary: 'List tickets (portal)',
  description: 'Returns tickets scoped by the authenticated user\'s permission level (own, team, or all).',
  tags: ['Portal — Tickets'],
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      search: z.string().optional(),
    }).openapi('PortalTicketListQuery'),
  },
  responses: {
    200: { description: 'Ticket list with counts by status' },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/portal/tickets',
  summary: 'Create ticket (portal)',
  description: 'Creates a ticket on behalf of the logged-in user.',
  tags: ['Portal — Tickets'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            subject: z.string(),
            description: z.string(),
            priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']).optional(),
            category_id: uuid().optional(),
            contact_id: uuid().optional(),
          }).openapi('PortalCreateTicket'),
        },
      },
    },
  },
  responses: {
    201: { description: 'Ticket created' },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/portal/tickets/{id}',
  summary: 'Get ticket detail',
  description: 'Returns full ticket details including history and replies.',
  tags: ['Portal — Tickets'],
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ id: uuid() }).openapi('PortalTicketIdParam'),
  },
  responses: {
    200: { description: 'Ticket details with history' },
    404: { description: 'Ticket not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/portal/tickets/{id}',
  summary: 'Update ticket',
  description: 'Update ticket fields (status, priority, assignment, etc.).',
  tags: ['Portal — Tickets'],
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ id: uuid() }).openapi('PortalTicketUpdateParam'),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            status_id: uuid().optional(),
            priority: z.string().optional(),
            assigned_to: uuid().nullable().optional(),
            category_id: uuid().nullable().optional(),
          }).openapi('PortalUpdateTicket'),
        },
      },
    },
  },
  responses: {
    200: { description: 'Updated ticket' },
    404: { description: 'Ticket not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// ---------------------------------------------------------------------------
// Portal: Knowledge Base
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/portal/kb',
  summary: 'List KB categories',
  description: 'Returns knowledge base categories with article counts.',
  tags: ['Portal — Knowledge Base'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'Category list with article counts' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/portal/kb/search',
  summary: 'Search KB articles',
  description: 'Full-text search across knowledge base articles.',
  tags: ['Portal — Knowledge Base'],
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      q: z.string().openapi({ description: 'Search query' }),
    }).openapi('KBSearchQuery'),
  },
  responses: {
    200: { description: 'Matching articles' },
  },
})

// ---------------------------------------------------------------------------
// Portal: Service Catalog
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/portal/catalog',
  summary: 'List catalog items',
  description: 'Returns active service catalog items grouped by category.',
  tags: ['Portal — Service Catalog'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'Catalog items with categories' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/portal/catalog/{slug}',
  summary: 'Get catalog item detail',
  description: 'Returns a single catalog item with its request form definition.',
  tags: ['Portal — Service Catalog'],
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ slug: z.string() }).openapi('CatalogSlugParam'),
  },
  responses: {
    200: { description: 'Catalog item with form definition' },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/portal/requests',
  summary: 'Submit a service request',
  description: 'Submits a new service request from a catalog item.',
  tags: ['Portal — Service Catalog'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            catalog_item_id: uuid(),
            form_data: z.record(z.string(), z.any()).openapi({ description: 'Answers to the catalog item form' }),
            justification: z.string().optional(),
          }).openapi('SubmitServiceRequest'),
        },
      },
    },
  },
  responses: {
    201: { description: 'Service request created' },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// ---------------------------------------------------------------------------
// Portal: Dashboard
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/portal/dashboard',
  summary: 'Dashboard summary',
  description: 'Returns aggregated dashboard data (ticket counts, SLA metrics, recent activity).',
  tags: ['Portal — Dashboard'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'Dashboard summary data' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/portal/dashboard/policy-progress',
  summary: 'Policy review progress',
  description: 'Returns the authenticated user\'s policy acknowledgment progress.',
  tags: ['Portal — Dashboard'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Policy progress',
      content: {
        'application/json': {
          schema: z.object({
            acknowledged: z.number().int(),
            total: z.number().int(),
            percentage: z.number(),
          }).openapi('PolicyProgress'),
        },
      },
    },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/portal/dashboard/training-progress',
  summary: 'Training completion progress',
  description: 'Returns assigned training articles with completion status for the authenticated user.',
  tags: ['Portal — Dashboard'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'Training progress with article-level detail' },
  },
})

// ---------------------------------------------------------------------------
// Portal: AI Chat
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/api/ai/chat',
  summary: 'AI chat (streaming)',
  description: 'Sends a message to the AI assistant. Returns a streaming response with context-aware answers based on KB articles and ticket history.',
  tags: ['AI'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({ description: 'User message' }),
            conversation_id: uuid().optional(),
          }).openapi('AIChatMessage'),
        },
      },
    },
  },
  responses: {
    200: { description: 'Streaming text/event-stream response' },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// ---------------------------------------------------------------------------
// Portal: Contacts & Companies
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/portal/contacts',
  summary: 'List contacts',
  description: 'Returns contacts with optional filtering by type, department, company.',
  tags: ['Portal — People'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'Contact list' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/portal/companies',
  summary: 'List companies',
  description: 'Returns companies/organizations.',
  tags: ['Portal — People'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'Company list' },
  },
})

// ---------------------------------------------------------------------------
// Portal: Queue & Triage
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/api/portal/queue',
  summary: 'Get triage queue',
  description: 'Returns scored tickets for the triage queue. Requires triage capability.',
  tags: ['Portal — Queue'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'Scored ticket list' },
    403: { description: 'Forbidden — missing triage capability' },
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/portal/queue/stats',
  summary: 'Queue statistics',
  description: 'Returns queue health metrics (unreviewed count, avg wait time, SLA breach count).',
  tags: ['Portal — Queue'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: 'Queue statistics' },
  },
})
