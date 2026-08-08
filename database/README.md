# Aegis ITSM - Database Schema

## Quick Start

```bash
# Initialize database (first run only)
psql -U postgres -d aegis -f init.sql
```

## Schema Overview

| Metric | Value |
|--------|-------|
| Total Tables | 145 |
| Total Lines | 6,399 |
| File Size | 224KB |

## Sections

| # | Section | Description |
|---|---------|-------------|
| 1 | Core | Organizations, users, roles, settings, audit log |
| 2 | Tickets | Tickets, comments, attachments, history |
| 3 | Contacts | Contacts, locations, contact types |
| 4 | Assets | Assets, software, hardware tracking |
| 5 | Documents | Document management, folders, versions |
| 6 | Credentials | Secure credential storage (encrypted) |
| 7 | Network | Networks, subnets, IP addresses, racks |
| 8 | Services | Services, vendors, SLAs |
| 9 | AI Settings | AI providers, models, presets |
| 10 | Alerts & Incidents | Alert rules, correlation, incidents |
| 11 | User Assignments | Asset assignments, offboarding workflows |
| 12 | Service Catalog | Request items, approvals, fulfillment |
| 13 | User Groups | Groups, delegation, manager permissions |
| 14 | Ticket Workflows | Status mapping, types, approval rules |
| 15 | Accessory Analytics | Model tracking, loss patterns, return rates |
| 16 | Knowledge Base | KB articles, MCP tools, search |
| 17 | AI Support Chat | User/admin chat, ticket creation, handoff |
| 18 | DNS Monitoring | DNS change detection, alerts requiring tickets |
| 19 | SSL Certificates | Certificate tracking, expiry alerts |
| 20 | Notifications | In-app notifications, email queue |
| 21 | Recurring Tickets | Scheduled tickets, maintenance schedules |
| 22 | Projects | Project management, tasks, milestones |

## Key Design Decisions

### Single-Tenant Architecture
- One organization per installation
- Organization owns all their data
- No multi-tenant features (that's Aegis MTP)

### Contact Types
```sql
contact_type: 'employee' | 'customer' | 'vendor' | 'partner'
```
- **Employees**: Internal IT support
- **Customers**: External product support (no billing in Aegis)
- **Vendors**: Third-party providers
- **Partners**: Business partners

### Ticket Sources
```sql
source: 'web' | 'email' | 'phone' | 'chat' | 'api' | 'recurring' | 'alert'
```

### Status Mapping
All ticket statuses map to three core states for workflow rules:
```sql
mapped_state: 'open' | 'pending' | 'closed'
```

### DNS Alerts
DNS change alerts **require ticket linkage** before resolution:
```sql
-- Cannot resolve without a ticket
SELECT resolve_dns_alert(alert_id, ticket_id, user_id);
```

## Files

```
database/
├── README.md           # This file
├── init.sql            # Complete schema (run once)
└── migrations/         # Individual migrations (reference)
    ├── 001_core.sql
    ├── 002_tickets.sql
    ├── ...
    └── 022_projects.sql
```

## Usage

### First Installation
```bash
createdb aegis
psql -U postgres -d aegis -f database/init.sql
```

### Development
For development, you can run individual migrations:
```bash
psql -U postgres -d aegis -f database/migrations/001_core.sql
# etc...
```

## Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

## Entity Relationships

```
Organization
├── Users (IT staff)
├── Contacts (employees, customers, vendors)
│   └── Tickets
│       ├── Comments
│       ├── Attachments
│       └── Time Entries
├── Assets
│   ├── Hardware
│   ├── Software
│   └── Accessories
├── Documents
├── Services
├── Knowledge Base
├── Projects
│   ├── Milestones
│   └── Tasks
└── Settings
    ├── AI Providers
    ├── SMTP Config
    └── Notifications
```
