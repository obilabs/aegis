# 📋 The Aegis Specification

> **Version:** 1.0.0-draft  
> **Status:** Draft  
> **Purpose:** Define the standard data model, API, and formats for Aegis-compatible systems.

---

## Overview

The Aegis Specification defines:

1. **Data Model** - Core entities and their relationships
2. **API Specification** - REST endpoints and formats
3. **Export Format** - Portable data interchange format
4. **Plugin Interface** - How to extend Aegis

Any system implementing this specification can call itself "Aegis-compatible."

---

## 1. Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AEGIS DATA MODEL                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Organization (tenant)                                                     │
│   └── The root entity. All other entities belong to an organization.       │
│                                                                             │
│   Contact (person)                                                          │
│   └── Anyone who interacts with the system                                 │
│       Types: employee, customer, vendor, partner                           │
│                                                                             │
│   Asset (thing)                                                             │
│   └── Physical or virtual items being managed                              │
│       Types: hardware, software, license, service                          │
│                                                                             │
│   Ticket (request)                                                          │
│   └── A request for help or action                                         │
│       Types: incident, service_request, problem, change                    │
│                                                                             │
│   Article (knowledge)                                                       │
│   └── Documentation and how-to guides                                      │
│       Visibility: public, internal, private                                │
│                                                                             │
│   Credential (secret)                                                       │
│   └── Passwords, API keys, certificates                                    │
│       Always encrypted at rest                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Contact ◄──────────────► Asset                                           │
│      │                        │                                            │
│      │  assigned_to           │  related_to                                │
│      │                        │                                            │
│      ▼                        ▼                                            │
│   Ticket ◄──────────────► Article                                          │
│      │                        │                                            │
│      │  uses                  │  documents                                 │
│      │                        │                                            │
│      └────────► Credential ◄──┘                                            │
│                                                                             │
│   Everything links to everything (when relevant)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entity Schemas

#### Organization

```typescript
interface Organization {
  id: UUID;
  name: string;
  slug: string;                    // URL-friendly identifier
  settings: OrganizationSettings;
  created_at: ISO8601DateTime;
  updated_at: ISO8601DateTime;
}

interface OrganizationSettings {
  timezone: string;                // e.g., "America/New_York"
  date_format: string;             // e.g., "YYYY-MM-DD"
  default_language: string;        // e.g., "en"
}
```

#### Contact

```typescript
interface Contact {
  id: UUID;
  organization_id: UUID;
  
  // Identity
  email: string;                   // Primary identifier
  name: string;
  phone?: string;
  
  // Classification
  contact_type: 'employee' | 'customer' | 'vendor' | 'partner';
  
  // Organization (for employees)
  job_title?: string;
  department?: string;
  manager_id?: UUID;               // Reports to
  
  // Company (for external contacts)
  company_id?: UUID;
  
  // Status
  is_active: boolean;
  
  // Metadata
  custom_fields?: Record<string, any>;
  tags?: string[];
  
  created_at: ISO8601DateTime;
  updated_at: ISO8601DateTime;
}
```

#### Asset

```typescript
interface Asset {
  id: UUID;
  organization_id: UUID;
  
  // Identity
  name: string;
  asset_tag?: string;              // e.g., "LPT-NYC-0042"
  serial_number?: string;
  
  // Classification
  asset_type: 'hardware' | 'software' | 'license' | 'service';
  category?: string;               // e.g., "Laptop", "Server"
  
  // Assignment
  assigned_to_id?: UUID;           // Contact ID
  location?: string;
  
  // Status
  status: 'active' | 'inactive' | 'retired' | 'lost' | 'in_repair';
  
  // Details
  manufacturer?: string;
  model?: string;
  purchase_date?: ISO8601Date;
  warranty_expiry?: ISO8601Date;
  
  // Metadata
  custom_fields?: Record<string, any>;
  tags?: string[];
  
  created_at: ISO8601DateTime;
  updated_at: ISO8601DateTime;
}
```

#### Ticket

```typescript
interface Ticket {
  id: UUID;
  organization_id: UUID;
  
  // Identity
  ticket_number: string;           // Human-readable, e.g., "TKT-00042"
  
  // Content
  subject: string;
  description: string;             // Supports markdown
  
  // Classification
  ticket_type: 'incident' | 'service_request' | 'problem' | 'change';
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  
  // Status
  status: string;                  // Custom statuses allowed
  status_category: 'open' | 'pending' | 'closed';  // For SLA
  
  // People
  requester_id: UUID;              // Contact who submitted
  assignee_id?: UUID;              // Contact assigned to resolve
  
  // Dates
  created_at: ISO8601DateTime;
  updated_at: ISO8601DateTime;
  resolved_at?: ISO8601DateTime;
  closed_at?: ISO8601DateTime;
  
  // Metadata
  custom_fields?: Record<string, any>;
  tags?: string[];
}

interface TicketReply {
  id: UUID;
  ticket_id: UUID;
  author_id: UUID;                 // Contact ID
  content: string;                 // Supports markdown
  is_internal: boolean;            // Hidden from requester?
  created_at: ISO8601DateTime;
}
```

#### Article

```typescript
interface Article {
  id: UUID;
  organization_id: UUID;
  
  // Identity
  title: string;
  slug: string;                    // URL-friendly
  
  // Content
  content: string;                 // Markdown or HTML
  summary?: string;
  
  // Classification
  category_id?: UUID;
  visibility: 'public' | 'internal' | 'private';
  
  // Status
  status: 'draft' | 'published' | 'archived';
  
  // Authorship
  author_id: UUID;
  
  // Dates
  published_at?: ISO8601DateTime;
  created_at: ISO8601DateTime;
  updated_at: ISO8601DateTime;
  
  // Metadata
  tags?: string[];
}
```

#### Credential

```typescript
interface Credential {
  id: UUID;
  organization_id: UUID;
  
  // Identity
  name: string;                    // e.g., "Production Database"
  
  // Classification
  credential_type: 'password' | 'api_key' | 'certificate' | 'ssh_key' | 'other';
  
  // Content (encrypted at rest)
  username?: string;
  password?: string;               // Encrypted
  url?: string;
  notes?: string;
  
  // Access control
  visibility: 'private' | 'team' | 'organization';
  
  // Rotation
  last_rotated_at?: ISO8601DateTime;
  rotation_interval_days?: number;
  expires_at?: ISO8601DateTime;
  
  // Metadata
  tags?: string[];
  
  created_at: ISO8601DateTime;
  updated_at: ISO8601DateTime;
}
```

---

## 2. API Specification

### Base URL

```
https://{instance}/api/v1
```

### Authentication

```
Authorization: Bearer {api_key}
```

### Response Format

All responses follow this structure:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": { ... }
  }
}
```

### Endpoints

#### Tickets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tickets` | List tickets |
| POST | `/tickets` | Create ticket |
| GET | `/tickets/:id` | Get ticket |
| PATCH | `/tickets/:id` | Update ticket |
| DELETE | `/tickets/:id` | Delete ticket |
| GET | `/tickets/:id/replies` | List replies |
| POST | `/tickets/:id/replies` | Add reply |

#### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contacts` | List contacts |
| POST | `/contacts` | Create contact |
| GET | `/contacts/:id` | Get contact |
| PATCH | `/contacts/:id` | Update contact |
| DELETE | `/contacts/:id` | Delete contact |

#### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/assets` | List assets |
| POST | `/assets` | Create asset |
| GET | `/assets/:id` | Get asset |
| PATCH | `/assets/:id` | Update asset |
| DELETE | `/assets/:id` | Delete asset |

#### Articles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/articles` | List articles |
| POST | `/articles` | Create article |
| GET | `/articles/:id` | Get article |
| PATCH | `/articles/:id` | Update article |
| DELETE | `/articles/:id` | Delete article |

#### Credentials

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/credentials` | List credentials (metadata only) |
| POST | `/credentials` | Create credential |
| GET | `/credentials/:id` | Get credential (metadata only) |
| POST | `/credentials/:id/reveal` | Reveal credential value |
| PATCH | `/credentials/:id` | Update credential |
| DELETE | `/credentials/:id` | Delete credential |

### Query Parameters

All list endpoints support:

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (default: 20, max: 100) |
| `sort` | string | Sort field (prefix with `-` for descending) |
| `search` | string | Full-text search |
| `filter[field]` | string | Filter by field value |

Example:
```
GET /api/v1/tickets?page=2&per_page=50&sort=-created_at&filter[status]=open
```

---

## 3. Export Format

### Aegis Export Package

A complete export is a ZIP file containing:

```
aegis-export-2026-02-05/
├── manifest.json           # Export metadata
├── organization.json       # Organization settings
├── contacts.json           # All contacts
├── assets.json             # All assets
├── tickets.json            # All tickets
├── articles.json           # All articles
├── credentials.json        # Credentials (encrypted)
└── attachments/            # File attachments
    ├── ticket-123/
    │   └── screenshot.png
    └── article-456/
        └── diagram.pdf
```

### Manifest

```json
{
  "aegis_version": "1.0.0",
  "export_version": "1.0",
  "exported_at": "2026-02-05T12:00:00Z",
  "organization_id": "uuid",
  "organization_name": "Acme Corp",
  "entity_counts": {
    "contacts": 150,
    "assets": 500,
    "tickets": 2000,
    "articles": 100,
    "credentials": 50
  }
}
```

---

## 4. Plugin Interface

### Plugin Structure

```typescript
interface AegisPlugin {
  // Metadata
  name: string;
  version: string;
  description: string;
  author: string;
  
  // Lifecycle
  onInstall(): Promise<void>;
  onUninstall(): Promise<void>;
  onEnable(): Promise<void>;
  onDisable(): Promise<void>;
  
  // Extensions
  routes?: PluginRoute[];          // Additional API routes
  hooks?: PluginHook[];            // Event hooks
  settings?: PluginSetting[];      // Configuration options
  migrations?: PluginMigration[];  // Database migrations
}

interface PluginRoute {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  handler: (req: Request) => Promise<Response>;
}

interface PluginHook {
  event: string;                   // e.g., 'ticket.created'
  handler: (data: any) => Promise<void>;
}
```

### Available Hooks

| Event | Trigger | Data |
|-------|---------|------|
| `ticket.created` | New ticket | Ticket object |
| `ticket.updated` | Ticket modified | Ticket object + changes |
| `ticket.closed` | Ticket closed | Ticket object |
| `contact.created` | New contact | Contact object |
| `asset.created` | New asset | Asset object |
| `article.published` | Article published | Article object |

---

## Compliance

### Required for "Aegis-Compatible"

To claim Aegis compatibility, a system MUST:

1. ✅ Implement all core entities (Contact, Asset, Ticket, Article, Credential)
2. ✅ Support the Aegis Export Format
3. ✅ Implement the core API endpoints
4. ✅ Use the standard response format

### Optional Extensions

Systems MAY implement:

- Additional entity types
- Additional API endpoints
- Custom fields on entities
- Plugins

---

## Versioning

The specification follows semantic versioning:

- **Major** (1.x.x → 2.x.x): Breaking changes to data model or API
- **Minor** (1.0.x → 1.1.x): New features, backward compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes, clarifications

---

*Aegis Specification v1.0.0-draft*  
*Last Updated: February 2026*
