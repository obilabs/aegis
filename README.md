# Aegis

**IT service management that produces compliance evidence as a byproduct of daily work.**

Aegis is a self-hosted, single-organization help desk and IT operations portal:
tickets, assets, contacts, knowledge base, policies and a credential vault. The
records your team creates while doing ordinary support work — who changed what
and when, how long a ticket took against its SLA, who acknowledged which policy,
who completed which training article — are kept as an audit trail you can show
an auditor, instead of being reconstructed later.

Aegis does not make an organization compliant on its own. It aims to make the
evidence part less painful.

A [ObiLabs](https://obilabs.dev) project. AGPL-3.0, no paid tiers.

---

## Telemetry & Privacy

Aegis separates two very different things and defaults them differently:

- **Anonymous liveness ping** — *on by default, one click to turn off.* Sent
  once at install and then daily, it carries only a random instance ID and the
  version — `{ instance_id, version }` — with no PII and no usage data. It
  exists so active installs can be counted: community installs carry no licence,
  so without it a running install would silently drop out of the count 30 days
  after setup. It is disclosed in the first-boot wizard, not buried.
- **Usage telemetry** — *off by default, opt-in.* A one-time setup snapshot
  (industry, team-size, feature list) and a daily usage heartbeat (ranges only:
  ticket-volume band, user-count band, modules enabled). You pick the level in
  the wizard or in Settings.

No organization name, domain, email, IP, or ticket content ever leaves your
box. The master kill-switch turns off **everything**, liveness included:

```env
# Disable ALL outbound telemetry, including the daily liveness ping and
# license re-validation. The license keeps working locally; it just isn't
# re-checked until the variable is removed and the container restarted.
TELEMETRY_ENABLED=false
```

The env var beats any in-app setting. In-app control lives at
**Settings → Telemetry** (admin-only). Every consent state change is recorded
in the `telemetry_consent_log` table (append-only). Consent-first by design.

---

## Quick Start

```bash
git clone https://github.com/obilabs/aegis.git
cd aegis

cp env.example .env
# Set the three required values in .env (or edit the file by hand):
sed -i.bak \
  -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" \
  -e "s/^S3_ACCESS_KEY=.*/S3_ACCESS_KEY=$(openssl rand -hex 8)/" \
  -e "s/^S3_SECRET_KEY=.*/S3_SECRET_KEY=$(openssl rand -hex 24)/" \
  .env && rm .env.bak

docker compose up -d --build        # first build takes several minutes

# One-time setup token, needed to claim the instance:
docker compose logs aegis | grep 'setup token'
```

Open **http://localhost:8080**. The first visit takes you to `/portal/setup`:
enter the setup token, create the administrator account, then complete the
short setup wizard. There are no default credentials.

`docker compose up` refuses to start if a required value is missing. Auth and
encryption secrets are generated on first boot and stored in `./data/secrets`
(back that directory up with the rest of `./data`).

**Not on localhost:8080?** Aegis only accepts sign-ins from the address in
`BETTER_AUTH_URL`. If you change `PORT` or serve Aegis under a hostname, set
both `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the exact URL people type
(for example `https://help.example.com`) and rebuild with
`docker compose up -d --build`. `NEXT_PUBLIC_APP_URL` is compiled into the app
image, so changing it without a rebuild has no effect.

**Network exposure.** nginx listens on all interfaces by default
(`BIND_HOST=0.0.0.0`). If Aegis sits behind your own reverse proxy or TLS
terminator on the same host, set `BIND_HOST=127.0.0.1` in `.env`.

---

## What This Does

One instance per organization; all data stays on your infrastructure.

| Module | Description |
|--------|-------------|
| **Tickets** | Incidents, requests, changes, problems; custom statuses; SLA clock with pause/resume; status history; file attachments |
| **Assets** | Hardware/software inventory linked to people, companies and tickets |
| **Contacts** | People, companies, locations, departments |
| **Knowledge Base** | Articles with categories, search, public/internal visibility |
| **Policies & training** | Policy articles with acknowledgment tracking; training articles with completion records |
| **Credentials** | AES-256-GCM encrypted password vault |
| **Audit log** | Append-only record of sensitive actions (cannot be disabled) |
| **Operations** | Onboarding/offboarding workflows and checklists |
| **Services** | Service catalog and service requests |

AI features are optional and **off by default**. They do nothing until an
administrator enables them and configures a provider key (Gemini, OpenAI, or a
local Ollama). Everything above works without them. Some setup-wizard presets
suggest turning AI features on; you can leave them off.

### Feature Status

Everything below ships in **this repository** under AGPL-3.0. There are no paid
tiers, no license keys that unlock features, and nothing held back as
"enterprise" — **Status** is a maturity signal (Stable → Beta → Alpha → Coming
Soon), not an availability gate.

Not built yet, and not shown in the product: outbound webhooks and SAML/OIDC
single sign-on (Google sign-in is available).

| Feature | Status | Notes |
|---------|--------|-------|
| Ticket Management | Stable | Incidents, requests, tasks, custom statuses, file attachments |
| Contact Management | Stable | People, companies, departments, job titles |
| Authentication | Stable | Email/password, Google sign-in, 2FA |
| Knowledge Base | Stable | Articles, categories, search, policies, training |
| Asset Management | Beta | Hardware/software inventory: add and view assets, assign to a person or company, link to tickets. Editing an asset in the UI is not built yet |
| Credential Vault | Stable | Encrypted password storage |
| Company Management | Stable | Companies and locations (org chart not built yet) |
| Audit Log | Stable | Append-only trail of sensitive actions |
| Dashboard | Stable | Ops dashboard + My Hub with role-aware switching |
| API Access | Stable | REST API (`/api/v1`) with scoped keys |
| Email Integration | Beta | Ticket creation from email, notifications |
| SLA Management | Beta | Response/resolution targets, pause/resume |
| Custom Statuses | Beta | Map custom names to open/pending/closed |
| Vendor Management | Beta | Vendors, contracts, support contacts |
| Service Catalog | Beta | Catalog items and service requests with approvals |
| Onboarding/Offboarding | Beta | Structured employee lifecycle workflows |
| Policies & Procedures | Beta | Policy articles with acknowledgment tracking |
| Provider Access | Beta | Grant scoped, audited, revocable access to an external MSP/partner. This is the organization's side — it controls who sees its data. |
| Smart Queue | Beta | Priority-scored ticket queue |
| AI Chat / Suggestions | Beta | Optional, off by default; needs your own provider key |
| AI Triage | Alpha | Optional, off by default |
| Workspaces | Alpha | Multi-department help desks |
| Teams & Routing | Alpha | Team-based assignment |
| Approval Workflows | Alpha | Multi-level change approvals |

---

## Architecture

```
          Internet
             |
        +---------+
        |  nginx  |  :8080 (only exposed port)
        +----+----+
             |
        +----+----+
        | Next.js |  :3000 (internal)
        +--+--+--++
           |  |  |
   +-------+  |  +--------+
   |          |           |
+--+-----+ +--+---+ +-----+--+
|Postgres| |Redis | | MinIO  |
| :5432  | |:6379 | | :9000  |
+--------+ +------+ +--------+
         (all internal)
```

Only nginx is exposed to the host. PostgreSQL, Redis, MinIO and the application
are internal to the compose network.

---

## Configuration

Copy `env.example` to `.env` and configure before first run. `env.example` is
the full, commented reference; the tables below cover the common settings.

### Required

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Database password. Generate: `openssl rand -hex 16` |
| `S3_ACCESS_KEY` | MinIO root user, also used by the app. Generate: `openssl rand -hex 8` |
| `S3_SECRET_KEY` | MinIO root password. Generate: `openssl rand -hex 24` |

There are no defaults for these. **Upgrading an install that relied on the old
defaults** (`aegis` for Postgres, `minioadmin` / `minioadmin123` for MinIO): set
those values explicitly in `.env` so the existing data stays reachable, then
rotate them.

`BETTER_AUTH_SECRET`, `AEGIS_SECRETS_KEY` and `CREDENTIAL_ENCRYPTION_KEY` are
optional: leave them blank and strong values are generated and persisted to
`./data/secrets` on first boot. Set them explicitly to pin or rotate.

### Admin Account

Two modes for creating the first admin:

**Mode 1 — Interactive (recommended):** leave `ADMIN_PASSWORD` blank. On first
browser visit you land at `/portal/setup` to create the admin in the UI, then
walk through the setup wizard (including the telemetry consent step). No admin
secret lives in `.env`.

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

### First-run setup token

Until setup is complete, claiming a fresh instance requires a one-time **setup
token**, so that nobody else who reaches the page first can take it over. On
startup Aegis prints it to the log and saves it to `./data/secrets/setup-token`:

```bash
docker compose logs aegis | grep 'setup token'
```

Enter it on `/portal/setup` (and in the wizard if asked). It is deleted when
setup completes. To choose it yourself — for example in a scripted deploy — set
`AEGIS_SETUP_TOKEN` before first launch.

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Host port for web access (change the two URLs below with it) | `8080` |
| `BIND_HOST` | Interface nginx binds to; `127.0.0.1` behind a local reverse proxy | `0.0.0.0` |
| `CONTAINER_PREFIX` | Container name prefix; change it (and `PORT`) to run a second stack on one host | `aegis` |
| `BETTER_AUTH_URL` | Public URL users type; sign-ins from any other origin are refused | `http://localhost:8080` |
| `NEXT_PUBLIC_APP_URL` | Same as `BETTER_AUTH_URL`; baked in at build time, so rebuild after changing it | `http://localhost:8080` |
| `TELEMETRY_ENABLED` | `false` disables all outbound telemetry (see above) | *(unset)* |
| `GEMINI_API_KEY` | Google AI API key (only if you enable AI features) | -- |
| `SMTP_HOST` | SMTP server for email notifications | -- |
| `SMTP_PORT` | SMTP port | `587` |
| `EMAIL_FROM` | From address for emails | `noreply@aegis.local` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Support email shown on login page | -- |
| `NEXT_PUBLIC_SUPPORT_TEAM` | Support team name shown on login page | `IT Support` |
| `ALLOW_REGISTRATION` | Allow public signup (`true`/`false`) | `false` |
| `AEGIS_VERSION` | App image tag. `local` builds from source; to run a pre-built image pin an immutable tag (a release or `sha-<commit>`), never `latest` | `local` |

---

## Startup Behavior

On every container start, the entrypoint:

1. Waits for PostgreSQL to be ready
2. On a fresh database, applies the full schema from `database/init.sql`
3. Applies any migrations in `database/migrations/` not yet recorded in
   `schema_migrations` (boot stops if one fails)
4. Seeds the admin account only if `ADMIN_PASSWORD` is set and no users exist
5. Starts the Next.js server

No manual migration or seed commands are needed.

---

## Operations

```bash
# Start (building the app image from this checkout)
docker compose up -d --build

# Stop (data in ./data is kept)
docker compose down

# View app logs
docker compose logs -f aegis

# Update
git pull
docker compose up -d --build
```

**Full reset.** Aegis uses bind mounts under `./data`, so `docker compose down -v`
does **not** delete data. To wipe everything, including generated secrets:

```bash
docker compose down
rm -rf ./data      # irreversible
docker compose up -d --build
```

### Backups

Back up the database **and** `./data/secrets` (it holds the keys that decrypt
stored credentials and email settings).

```bash
# Backup database (run from the directory with docker-compose.yml)
docker compose exec -T db pg_dump -U aegis aegis > backup.sql

# Restore into a fresh install (stop the app first so nothing writes meanwhile)
docker compose stop aegis
docker compose exec -T db psql -U aegis aegis < backup.sql
docker compose start aegis
```

Uploaded files live in MinIO under `./data/minio`; include that directory in
file-level backups.

---

## Security Notes

- No default credentials: the administrator is created at `/portal/setup` (or seeded from `ADMIN_PASSWORD`)
- Self-registration is closed once the first user exists, unless an admin allows specific email domains
- Credentials are encrypted at rest (AES-256-GCM)
- Only nginx is exposed to the network; all other services are internal
- Enable 2FA for admin accounts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | Better Auth (email/password, Google sign-in, 2FA) |
| Database | PostgreSQL 16 (pgvector) |
| Jobs | pg-boss |
| Object storage | MinIO (S3-compatible) |
| UI | Tailwind CSS, Heroicons, Lucide |
| Reverse Proxy | nginx |

---

## Development

For contributors working on the source code:

```bash
# Prerequisites: Node.js 20+, pnpm 10, Docker

docker compose -f docker-compose.dev.yml up -d   # Postgres (+ nginx) for local dev
pnpm install
cp env.example .env.local
# In .env.local: DATABASE_URL=postgresql://aegis:aegis-dev@localhost:5433/aegis

pnpm dev
# Open http://localhost:3000

pnpm test                 # unit tests
pnpm exec tsc --noEmit    # type check
bash e2e/run.sh           # browser walk-through of a fresh install (Docker; see e2e/README.md)
```

**Demo data:** TODO — there is no maintained demo dataset yet.

### Project Structure

```
app/
  api/                      API routes
    portal/                 Authenticated portal APIs
    settings/               Settings APIs
    kb/                     Knowledge base (public + portal)
    v1/                     Versioned external API
    auth/[...all]/          Better Auth handler
  portal/                   Authenticated pages
  (public pages)            Login, public KB

lib/
  db.ts                     Database pool (pool, query, queryOne)
  auth.ts                   Better Auth configuration
  permissions.ts            Role capabilities and ticket access
  features.ts               Feature flag registry
  article-render.ts         The HTML sanitizer used for all rich text

database/
  init.sql                  Full schema for fresh installs
  migrations/               Incremental migrations, applied on startup
```

---

## Comparison

| | Aegis | ITFlow | Freshservice |
|---|-------|--------|--------------|
| Self-hosted | Yes | Yes | No |
| Open source | Yes (AGPL-3.0) | Yes | No |
| Per-user fees | No | No | Yes |

---

## Contributing

Contributions are welcome. First-time contributors agree to the
[Contributor License Agreement](CLA.md) with a one-line pull request — see
[CONTRIBUTING.md](CONTRIBUTING.md) for that, plus branch/commit conventions, the
CI gates, and the PR checklist. A CLA check runs on every pull request. You keep
the copyright to your work; the CLA is a licence grant, not an assignment.

---

## License

**AGPL-3.0** — free and open source. The network-use clause means anyone running
a modified version as a service must share their changes.

See [LICENSE](LICENSE) for full terms.

---

Built with AI-assisted development (Claude Code), under human direction and review.

Built by [ObiLabs](https://obilabs.dev)
