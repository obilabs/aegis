import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import { registry } from './registry'

// Side-effect imports: register all routes into the registry
import './v1-routes'
import './portal-routes'

export function getOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions)

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Aegis ITSM API',
      version: '1.0.0',
      description:
        'REST API for Aegis — a self-hosted IT Service Management platform. ' +
        'External integrations use the `/api/v1/*` endpoints with API key auth. ' +
        'The portal API (`/api/portal/*`) is session-authenticated and powers the web UI.',
      contact: {
        name: 'ObiLabs',
        url: 'https://obilabs.dev',
      },
      license: {
        name: 'AGPL-3.0',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
      },
    },
    servers: [{ url: '/', description: 'Current instance' }],
    tags: [
      { name: 'Tickets', description: 'External ticket API (v1)' },
      { name: 'Contacts', description: 'External contacts API (v1)' },
      { name: 'Assets', description: 'External assets API (v1)' },
      { name: 'Portal — Tickets', description: 'Ticket management (portal)' },
      { name: 'Portal — Knowledge Base', description: 'KB articles and search' },
      { name: 'Portal — Service Catalog', description: 'Service catalog and requests' },
      { name: 'Portal — Dashboard', description: 'Dashboard widgets and metrics' },
      { name: 'Portal — People', description: 'Contacts and companies' },
      { name: 'Portal — Queue', description: 'Triage queue and scoring' },
      { name: 'AI', description: 'AI chat and suggestions' },
    ],
  })
}
