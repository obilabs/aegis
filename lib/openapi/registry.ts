import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// Extend Zod with OpenAPI metadata support
extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

export const ErrorSchema = z.object({
  error: z.string(),
}).openapi('Error')

export const PaginationMeta = z.object({
  page: z.number().int(),
  per_page: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
}).openapi('PaginationMeta')

// Register the API key security scheme
registry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'x-api-key',
  description: 'API key issued from Settings > API Keys',
})

registry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'Session token from Better Auth',
})
