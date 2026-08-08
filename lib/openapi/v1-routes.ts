import { z } from 'zod'
import { registry, ErrorSchema, PaginationMeta } from './registry'

const uuid = () => z.string().uuid()
const datetime = () => z.string().datetime()
const email = () => z.string().email()

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

const TicketSchema = z.object({
  id: uuid(),
  ticket_number: z.number().int(),
  prefix: z.string(),
  subject: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']),
  source: z.string(),
  status: z.string().nullable(),
  base_status: z.string().nullable(),
  category: z.string().nullable(),
  requester_name: z.string().nullable(),
  requester_email: z.string().nullable(),
  assignee_name: z.string().nullable(),
  assignee_email: z.string().nullable(),
  created_at: datetime(),
  updated_at: datetime(),
  resolved_at: datetime().nullable(),
}).openapi('Ticket')

const CreateTicketSchema = z.object({
  subject: z.string().openapi({ description: 'Ticket subject line' }),
  description: z.string().openapi({ description: 'Ticket body / description' }),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'critical']).optional().openapi({ description: 'Defaults to medium' }),
  category: z.string().optional().openapi({ description: 'Category name (matched case-insensitively)' }),
  requester_email: email().optional().openapi({ description: 'Requester email (looks up existing contact)' }),
  source: z.string().optional().openapi({ description: 'Source identifier, defaults to "api"' }),
}).openapi('CreateTicket')

const TicketCreatedSchema = z.object({
  data: z.object({
    id: uuid(),
    ticket_number: z.number().int(),
    prefix: z.string(),
    reference: z.string().openapi({ description: 'Full reference, e.g. INC-42' }),
    created_at: datetime(),
  }),
}).openapi('TicketCreated')

registry.registerPath({
  method: 'get',
  path: '/api/v1/tickets',
  summary: 'List tickets',
  description: 'Returns a paginated list of tickets for the organization.',
  tags: ['Tickets'],
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  request: {
    query: z.object({
      page: z.string().optional().openapi({ description: 'Page number (default 1)' }),
      per_page: z.string().optional().openapi({ description: 'Items per page (default 50, max 100)' }),
      status: z.string().optional().openapi({ description: 'Filter by base_status (open, pending, closed)' }),
      priority: z.string().optional().openapi({ description: 'Filter by priority' }),
      updated_since: z.string().optional().openapi({ description: 'ISO 8601 timestamp filter' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated ticket list',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(TicketSchema), meta: PaginationMeta }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/v1/tickets',
  summary: 'Create a ticket',
  description: 'Creates a new ticket. Subject and description are required.',
  tags: ['Tickets'],
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateTicketSchema } } },
  },
  responses: {
    201: {
      description: 'Ticket created',
      content: { 'application/json': { schema: TicketCreatedSchema } },
    },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

const ContactSchema = z.object({
  id: uuid(),
  first_name: z.string(),
  last_name: z.string(),
  email: email().nullable(),
  phone: z.string().nullable(),
  contact_type: z.string(),
  job_title: z.string().nullable(),
  department: z.string().nullable(),
  company_name: z.string().nullable(),
  is_active: z.boolean(),
  created_at: datetime(),
  updated_at: datetime(),
}).openapi('Contact')

registry.registerPath({
  method: 'get',
  path: '/api/v1/contacts',
  summary: 'List contacts',
  description: 'Returns a paginated list of contacts for the organization.',
  tags: ['Contacts'],
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  request: {
    query: z.object({
      page: z.string().optional(),
      per_page: z.string().optional(),
      type: z.string().optional().openapi({ description: 'Filter by contact_type (user, employee, customer, vendor)' }),
      search: z.string().optional().openapi({ description: 'Search by name or email' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated contact list',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(ContactSchema), meta: PaginationMeta }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

const AssetSchema = z.object({
  id: uuid(),
  name: z.string(),
  asset_tag: z.string().nullable(),
  serial_number: z.string().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  status: z.string(),
  primary_ip: z.string().nullable(),
  os: z.string().nullable(),
  warranty_expire: z.string().nullable(),
  type: z.string().nullable(),
  assigned_to: z.string().nullable(),
  assigned_email: z.string().nullable(),
  location: z.string().nullable(),
  created_at: datetime(),
  updated_at: datetime(),
}).openapi('Asset')

registry.registerPath({
  method: 'get',
  path: '/api/v1/assets',
  summary: 'List assets',
  description: 'Returns a paginated list of assets for the organization.',
  tags: ['Assets'],
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  request: {
    query: z.object({
      page: z.string().optional(),
      per_page: z.string().optional(),
      status: z.string().optional().openapi({ description: 'Filter by asset status (active, inactive, retired, etc.)' }),
      type: z.string().optional().openapi({ description: 'Filter by asset type name' }),
    }),
  },
  responses: {
    200: {
      description: 'Paginated asset list',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(AssetSchema), meta: PaginationMeta }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
