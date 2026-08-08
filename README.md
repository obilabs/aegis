# Aegis Client

**Self-hosted IT Service Management for organizations that own their data.**

A [ObiLabs](https://obilabs.dev) project.

---

## Telemetry & Privacy

Aegis phones home to the ObiLabs control plane (default
`https://api.obilabs.dev`) on first boot and periodically thereafter,
sending anonymized usage data and validating the license. The master
kill-switch is `TELEMETRY_ENABLED`:

```env
# Disable ALL outbound telemetry, including license re-validation pings.
# The license keeps working locally; it just isn't re-checked until the
# variable is removed and the container restarted.
TELEMETRY_ENABLED=false
```

The env var beats any in-app setting. In-app control lives at
**Settings → Telemetry & Privacy** (admin-only). The full payload format
is documented at the control plane's `/privacy` page; every consent
state change is recorded in the `telemetry_consent_log` table (append-
only). This is consent-first by design per
[PRINCIPLES.md](../../PRINCIPLES.md) #2.

---

## Quick Start

```bash
git clone https://github.com/obilabs/aegis.git
cd aegis

# Configure your environment
cp env.example .env
# Edit .env — at minimum set BETTER_AUTH_SECRET and admin credentials

# Start everything
docker compose up -d
```

Open **http://localhost:8080** and sign in with the credentials from your `.env` file.

Default: `admin@aegis.local` / `ChangeMe123!`

That's it. The entrypoint handles database schema, migrations, and admin seeding automatically.

---

## What This Does

Aegis Client is a single-tenant ITSM platform. One instance per organization, all data stays on your infrastructure.

| Module | Description |
|--------|-------------|
| **Tickets** | Incidents, requests, tasks, SLA tracking, custom statuses |
| **Assets** | Hardware/software inventory, models, lifecycle tracking |
| **Contacts** | People, companies, locations, org charts |
| **Knowledge Base** | Articles with categories, search, feedback, public/internal visibility |
| **Credentials** | AES-256 encrypted password vault |
| **AI Assistant** | Multi-provider (Gemini, OpenAI, Ollama) with KB-aware responses |
| **Operations** | Onboarding/offboarding workflows, checklists, delegation |
| **Services** | Service catalog, vendors, recurring service tracking |

### Feature Status

| Feature | Status | Category | Notes |
|---------|--------|----------|-------|
| Ticket Management | Stable | Core | Incidents, requests, tasks, custom statuses |
| Contact Management | Stable | Core | People, companies, departments, job titles |
| Authentication | Stable | Core | Email/password, Google SSO, 2FA |
| Knowledge Base | Stable | Standard | Articles, categories, search, feedback, policies, training |
| Asset Management | Stable | Standard | Hardware/software inventory, lifecycle tracking |
| Credential Vault | Stable | Standard | AES-256 encrypted password storage |
| Company Management | Stable | Standard | Companies, locations, org hierarchy |
| Dashboard | Stable | Standard | Ops dashboard + My Hub with role-aware switching |
| Email Integration | Beta | Standard | Ticket creation from email, notifications |
| API Access | Stable | Standard | REST API for integrations |
| SLA Management | Beta | Advanced | Response/resolution targets, pause/resume |
| Custom Statuses | Beta | Advanced | Map custom names to open/pending/closed |
| Vendor Management | Beta | Advanced | Vendors, contracts, support contacts |
| Service Catalog | Beta | Advanced | Services, costs, access request workflows |
| Onboarding/Offboarding | Beta | Advanced | Structured employee lifecycle workflows |
| Policies & Procedures | Beta | Advanced | Policy articles with acknowledgment tracking |
| AI Support Chat | Beta | Advanced | Multi-provider (Gemini, OpenAI, Ollama) |
| AI Suggestions | Beta | Advanced | Smart ticket/KB suggestions |
| Smart Queue | Beta | Advanced | Priority-scored ticket queue |
| AI Triage | Alpha | Enterprise | AI categorization and routing |
| Workspaces | Alpha | Enterprise | Multi-department helpdesks |
| Teams & Routing | Alpha | Enterprise | Team-based assignment |
| Approval Workflows | Alpha | Enterprise | Multi-level change approvals |
| Provider Access | Beta | Enterprise | MSP access with granular permissions |
| Webhooks | Coming Soon | Advanced | External event delivery |
| SSO (SAML/OIDC) | Coming Soon | Enterprise | Enterprise single sign-on |

---

## Architecture

```
          Internet
             |
        +---------+
        |  nginx   |  :8080 (only exposed port)
        +----+----+
             |
        +----+----+
        | Next.js  |  :3000 (internal)
        +--+---+--+
           |   |
     +-----++ +------+
     |Postgres| |Redis |
     | :5432  | |:6379 |
     +--------+ +-----+
     (internal)  (internal)
```

Only nginx is exposed to the host. PostgreSQL, Redis, and the application are all internal.

---

## Configuration

Copy `env.example` to `.env` and configure before first run.

### Required

| Variable | Description | Default |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | Session encryption key. Generate: `openssl rand -base64 32` | (insecure default) |
| `POSTGRES_PASSWORD` | Database password | `aegis` |

### Admin Account

Two modes for creating the first admin:

**Mode 1 — Interactive (recommended for individual operators):** leave
`ADMIN_PASSWORD` blank. On first browser visit, you'll land at
`/portal/setup` to create the admin in the UI (email + password fields),
then walk through the org wizard (including the non-bypassable telemetry
consent step, see [PRINCIPLES.md](../../PRINCIPLES.md) #2). No admin
secret ever lives in `.env`.

**Mode 2 — Headless (for CI/CD / scripted deploys):** set `ADMIN_PASSWORD`
before first launch. Aegis seeds the admin from these env vars on first
boot. Sign-in works immediately; the first browser visit lands directly
in the org wizard.

In either mode, the telemetry consent step fires during the wizard — pre-
seeding the admin does NOT bypass it.

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_EMAIL` | Admin login email (used only if `ADMIN_PASSWORD` is set) | `admin@aegis.local` |
| `ADMIN_PASSWORD` | If set → seed admin headlessly; if blank → operator creates at `/portal/setup` | *(blank)* |
| `ADMIN_NAME` | Display name | `Aegis Administrator` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Host port for web access | `8080` |
| `BETTER_AUTH_URL` | Public URL (set if not localhost) | `http://localhost:8080` |
| `NEXT_PUBLIC_APP_URL` | Same as BETTER_AUTH_URL | `http://localhost:8080` |
| `GEMINI_API_KEY` | Google AI API key (for AI assistant) | -- |
| `SMTP_HOST` | SMTP server for email notifications | -- |
| `SMTP_PORT` | SMTP port | `587` |
| `EMAIL_FROM` | From address for emails | `noreply@aegis.local` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Support email shown on login page | -- |
| `NEXT_PUBLIC_SUPPORT_TEAM` | Support team name shown on login page | `IT Support` |
| `ALLOW_REGISTRATION` | Allow public signup (`true`/`false`) | `false` |

### Generating Secrets

```bash
# Auth secret (required for production)
openssl rand -base64 32

# Database password
openssl rand -hex 16
```

---

## Startup Behavior

On every container start, the entrypoint automatically:

1. Waits for PostgreSQL to be ready
2. Applies base schema (`init.sql` -- all `IF NOT EXISTS`, safe to re-run)
3. Runs all migrations in order (all idempotent)
4. Seeds the admin account if no users exist (skips if users already exist)
5. Starts the Next.js server

No manual migration or seed commands needed.

---

## Operations

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f web

# Rebuild after update
docker compose up -d --build

# Full reset (deletes all data)
docker compose down -v
docker compose up -d --build
```

### Updating

```bash
git pull
docker compose up -d --build
```

Migrations run automatically on startup. No manual steps needed.

### Backups

```bash
# Backup database
docker exec aegis_db pg_dump -U aegis aegis > backup.sql

# Restore
docker exec -i aegis_db psql -U aegis aegis < backup.sql
```

---

## Security Notes

- Registration is **disabled by default** after the first user exists
- All API routes require authentication
- All database queries are scoped by `organization_id`
- Credentials are AES-256 encrypted at rest
- Only nginx is exposed to the network; all other services are internal
- Change `BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD` before production use
- Enable 2FA for admin accounts (Settings > Security)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | Better Auth (email/password, Google SSO, 2FA) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| AI | Gemini, OpenAI, Ollama (configurable) |
| UI | Tailwind CSS, Heroicons, Lucide |
| Reverse Proxy | nginx |

---

## Development

For contributors working on the source code:

```bash
# Prerequisites: Node.js 20+, pnpm 9+, PostgreSQL, Redis

pnpm install
cp env.example .env.local
# Edit .env.local with local database credentials

pnpm dev
# Open http://localhost:3000
```

### Project Structure

```
app/
  api/                      API routes
    portal/                 Authenticated portal APIs
    settings/               Settings APIs
    kb/                     Knowledge base (public + portal)
    ai/                     AI chat and processing
    auth/[...all]/          Better Auth handler
  portal/                   Authenticated pages
    dashboard/
    tickets/
    contacts/
    assets/
    kb/
    chat/
    settings/
  (public pages)            Login, KB, marketing

lib/
  db.ts                     Database pool (pool, query, queryOne)
  auth.ts                   Better Auth configuration
  features.ts               Feature flag system
  ai-chat-security.ts       AI access control
  email-queue.ts            pg-boss email queue

database/
  init.sql                  Full schema (fresh installs)
  migrations/               Incremental migrations (001-050)
```

### Database

50 migrations covering: organizations, tickets, contacts, assets, credentials, knowledge base, AI chat, services, RBAC, workflows, feature flags, and more. `init.sql` contains the complete schema (145 tables) for fresh installs.

---

## Comparison

| Feature | Aegis | ITFlow | Freshservice |
|---------|-------|--------|--------------|
| Self-Hosted | Yes | Yes | No |
| Data Sovereignty | Yes | Yes | No |
| Open Source | Yes | Yes | No |
| Per-User Fees | No | No | Yes ($19-119/mo) |
| AI Integration | Multi-provider | Basic | Freddy AI |
| MCP Server | Yes | No | No |

---

## License

**AGPL-3.0** -- Free and open source. The network-use clause ensures that anyone running a modified version as a service must share their changes.

See [LICENSE](LICENSE) for full terms.

---

Built by [ObiLabs](https://obilabs.dev)
