# Aegis - AI Agent Instructions

**Single-tenant ITSM platform.** One organization per installation.

> **This repo was split out of the monorepo in 2026-08.** There is no parent
> `CLAUDE.md` above it. The universal security rules, terminology table and
> `PRINCIPLES.md` live in the **obilabs-platform** repo
> (`D:/personal-projects/obilabs/obilabs-platform`), as do
> `docs/compliance/legal-review-todo.md` and the openspec archive. Every "see
> root CLAUDE.md" pointer below means that repo.

## What Aegis IS

- Internal IT support for employees
- External product support for customers (NO billing)
- Self-hosted ITSM with data sovereignty
- Knowledge base with AI search
- Asset and inventory management
- Credential vault (AES-256 encrypted)
- Time tracking for reporting (export to external billing)

## What Aegis is NOT

- Billing/invoicing platform (that's aegis-mtp)
- Multi-tenant platform (that's aegis-mtp)
- RMM agent (that's aegis-rmm)
- MDM solution (that's aegis-mdm)

**If you see multi-tenant patterns, remove them.**

## Docker Testing

Two build paths, and the **tag tells you which one produced an image**. See
`obilabs-platform/CLAUDE.md` for the full rationale.

**Inner loop — build from source.** Fastest, costs nothing, and does not depend
on GitHub Actions being available (on 2026-08-21 it was not: the account hit its
billing limit and every build across all repos failed for four hours).

```bash
V=local-$(git rev-parse --short HEAD)
AEGIS_VERSION=$V docker compose build aegis
AEGIS_VERSION=$V docker compose up -d
docker compose logs -f aegis
```

The `local-` prefix is deliberate: an untagged local build takes the compose
default `0.1.0` and silently shadows the CI image of that name in your daemon,
so you test one artifact and ship another. Never `docker push` a `local-*` tag.

**Testing a CI build — pin `sha-<commit>`, never `latest`.**

```bash
AEGIS_VERSION=sha-<commit> docker compose pull && docker compose up -d
```

`AEGIS_VERSION` defaults to `0.1.0`, and **that default is a trap.** Since the
immutable-tag policy landed here, `main` publishes only `edge` and `sha-*`;
`latest` and `0.1.0` both froze at commit `283b4a1` on 2026-08-17 and have not
moved since (verified 2026-08-21 against the GHCR API). There are no `v*` tags in
this repo, so nothing will ever move them again. Pulling either SUCCEEDS and
gives you stale code with nothing reporting a problem — Verification Rule 2 in
its purest form. Set the var explicitly, every time.

**Wiping:** `docker compose down -v` wipes **nothing** here — Aegis uses bind
mounts, so `rm -rf ./data` is the only true wipe. And `--rmi all` deletes your
local build along with everything else; omit it in the inner loop.

## Database

- **Fresh install:** `psql -f database/init.sql` — COMPLETE on its own
  (~281 tables, all migrations 088-097 folded in, consolidated 2026-08-17). It
  also pre-populates `schema_migrations`, so the entrypoint's migration loop
  correctly skips everything on a fresh database.

  Verified, not assumed: a database built from this file was diffed against one
  built from the old init.sql + all 10 migrations. Identical inventories — 303
  tables / 4342 columns / 1143 constraints / 937 indexes / 20 triggers — with
  the only textual differences being Postgres re-normalising `CHECK ... ANY
  (ARRAY[...])` (inline vs ALTER TABLE form; both enforce identically, tested)
  and pg_dump's random restrict-nonce line.

  **Regenerating it: always `--exclude-schema=pgboss`.** pg-boss creates its own
  schema at runtime and baking it in caused the drift fixed in 376907d — a
  naive `pg_dump` puts it straight back. Any DDL appended AFTER the dump must be
  schema-qualified (`public.x`), because pg_dump ends by resetting search_path
  to ''.
- **Migrations:** `database/migrations/` (incremental SQL files, applied by docker-entrypoint.sh)
- **Better Auth tables:** `npm run db:migrate` (auth tables only, via @better-auth/cli)

```typescript
import { pool, query, queryOne } from '@/lib/db';
```

## API Routes

Two API layers:

| Layer | Routes | Auth | Versioned |
|-------|--------|------|-----------|
| **Internal** (portal frontend) | `/api/portal/*`, `/api/admin/*`, `/api/settings/*`, `/api/kb/*`, `/api/ai/*`, `/api/features/*` | Session cookie | No |
| **External** (integrations) | `/api/v1/*` | API key or Bearer token | Yes |

Internal routes serve the Next.js frontend. External routes serve third-party integrations, RMM/MDM agents, and automation scripts.

## Feature Flags (Already Built)

System in `lib/features.ts`. Categories: core, standard, advanced, enterprise, experimental. Statuses: stable, beta, alpha, coming_soon, deprecated.

- DB tables: `feature_flags` + `organization_feature_flags` (per-org enable/disable
  state — there is no `feature_flag_overrides` table)
- API: `/api/features`, `/api/features/enable`, `/api/features/disable`
- Single-tenant: flags apply to the one organization in this install

## AI Chat Security (Already Built)

System in `lib/ai-chat-security.ts`. Enforces data access policies per context level.

| Context | Access Level |
|---------|-------------|
| `end_user` | Own tickets + public KB |
| `technician` | All tickets + assets |
| `admin` | Full system access |
| `provider` | Scoped by contract |

Chat types: `user_support`, `admin_support`, `general`

## People Model

**Contacts** are universal person records. **Users** are contacts with login capability (linked via `users.contact_id`).

| Contact Type | Required FKs | Can Login | Can Submit Tickets |
|---|---|---|---|
| `employee` | `department_id`, `job_title_id` | Yes (user account) | Yes |
| `customer` | `company_id` | Optional (portal) | Yes |
| `vendor` | `company_id` | Optional (portal) | No |
| `partner` | `company_id` | Optional (portal) | Optional |

**Companies** (renamed from `clients`) hold all organization types. API enum
(`app/api/portal/companies/route.ts`): `internal`, `client`, `customer`, `vendor`,
`partner`, `prospect` — no `lead`. The column itself is unconstrained varchar
defaulting to `client`, so the API enum IS the vocabulary. The `vendors` table was merged into `companies`.

Customers CAN submit tickets. No invoicing -- export time entries for external billing.

## MTP pairing model (unified into api_keys 2026-06-09)

External MSPs running Aegis MTP poll this client via `/api/v1/mtp/*`
with a bearer key issued from the unified `/portal/settings/api-keys` page
(key type "Aegis MTP pairing"). There is no `/portal/settings/integrations/mtp`.
Storage backend (after migration 092): `api_keys` table with
`key_type = 'aegis-mtp-pairing'`. Pre-migration this lived in
`mtp_pairings`; that table was dropped and snapshotted to
`mtp_pairings_legacy_backup` for forensic recovery.

Two security gates protect the key:

1. **Time-bounded pairing window.** Issuance opens a 15-min window
   (`api_keys.pairing_window_expires_at`). Outside the window,
   `/handshake` refuses with 401 even if the key is otherwise valid.
   An `extendPairingWindow()` helper exists in `lib/mtp-pairings.ts` but NO HTTP
   route exposes it — today an expired window means issuing a new key.
2. **Single-use binding.** The first successful `/handshake` atomically
   sets `paired_at` + `paired_from_ip` + `paired_user_agent`.
   Subsequent `/handshake` calls refuse with `kind: 'already_paired'`.

**Why both gates and not just one:** the window stops a key that's been
sitting in someone's inbox for a week from being used at all; the
single-use binding stops a key that's already in legitimate use from
being re-paired by an attacker who got it later. Together they bound the
attack surface to roughly "a key intercepted IN FLIGHT and paired before
the legitimate MTP did" — much narrower than the original "anyone with
the key, forever" model.

`/api/v1/mtp/tickets` does NOT gate on either. Once paired, the MTP
polls forever until the customer revokes — no churn for legitimate
ongoing operation.

**Extended poll response + JIT detail endpoint (added 2026-07-20,
`mtp-poller-extension-sla-triage`).** The list response
(`/api/v1/mtp/tickets`) is now an ADDITIVE superset: each recent ticket
also carries `sla_first_response_deadline`, `sla_resolution_deadline`,
`sla_status` (computed per request), `triage_score`, `body_preview`
(HTML-stripped, email/phone-redacted, 200 chars), `queue_id`,
`queue_name`, and `escalation_context`. All new fields are nullable —
`queue_*` and `escalation_context` stay null until
`msp-label-scoped-visibility` (Phase B) ships `ticket_queues` /
`ticket_queue_transitions`. Never rename or remove an existing field
here; legacy MTP installs must keep parsing (wire-compat is indefinite).

New endpoint `GET /api/v1/mtp/tickets/[id]` is the JIT single-ticket
detail view. It returns the list-shape fields PLUS `body` (full),
`thread` (comments + internal notes + status/assignment/queue events,
`?thread_limit` default 20 / cap 100, oldest-first), `related_assets`
(≤10, `{name, warranty_expire, is_important}`), and `available_actions`
(server-computed booleans). The minimal write path SHIPPED
2026-08-16, so `comment` / `status` / `assign` compute TRUE when the pairing key
holds `tickets:write`; `escalate` and `close` stay false until Phase B ships
queues and the close grant. Do not assume these are always false — pairing keys
can already write.. Two rules that differ from the list endpoint:
- It requires actor-assertion headers **even though it's a read** —
  `requireScope(req, 'tickets:read', { requireActorAssertion: true })`
  → 412 `missing-action-context` when absent. A full body/thread pull
  must be attributable to a specific MSP tech.
- Thread visibility is filtered server-side via
  `lib/mtp-thread-filter.ts#filterThreadForCaller` (D8: another MSP's
  internal notes are hidden by default). `lib/mtp-available-actions.ts#computeAvailableActions`
  computes the action set. Out-of-org / (Phase B) out-of-queue tickets
  return **404, not 403** — never leak existence.

**Wire format:** pairing keys use the standard `aegis_*` prefix —
same format as every other API key. The `key_type` column on
api_keys is what distinguishes a pairing key from a personal /
mtp-polling / delegated-write key. There is no separate prefix
namespace.

**For agents:** when modifying anything in `lib/mtp-pairings.ts`,
preserve the atomic-claim pattern in `completeHandshake()`. Two
concurrent handshakes (legit MTP + attacker who has the key) MUST end
with exactly one paired_at set, not two. The `WHERE paired_at IS NULL
AND pairing_window_expires_at > NOW()` predicate inside the UPDATE is
the race-prevention mechanism — don't refactor it into a SELECT-then-
UPDATE pattern. This survived the migration 092 storage move and
MUST continue to survive any future refactor.

**`paired_from_ip` is advisory, not authenticated.** It comes from
leftmost X-Forwarded-For (or X-Real-IP), which an upstream proxy can
forge. Surface it in audit views as "claimed source IP," don't use it
as an authorization input. The real auth check is the bearer token +
single-use binding.

**Don't reintroduce `mtp_pairings`** as a separate table. The
unification (api-keys-mtp-unification, 2026-06-09) merged it into
`api_keys`. Adding a parallel table reintroduces the two-surface
ergonomic mess we just fixed.

## Ticket Status Mapping

All statuses map to three core states: `open | pending | closed`. Workflow rules use `mapped_state`, not frontend status names. Organizations define custom statuses mapped to these three states.

Priorities: `low` (5d), `medium` (2d), `high` (1d), `urgent` (4h), `critical` (1h)

## Key Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | Better Auth config (email, Google SSO, 2FA, admin, bearer, email OTP) — API keys are CUSTOM, see `lib/api-keys.ts` / `lib/api-auth.ts` |
| `lib/permissions.ts` | RBAC permission checks (capabilities, ticket access levels) |
| `lib/sla.ts` | SLA clock computation (read-only, works with DB trigger) |
| `lib/db.ts` | Pool + query helpers (`pool`, `query`, `queryOne`) |
| `lib/features.ts` | Feature flag registry and evaluation |
| `lib/ai-chat-security.ts` | AI access control by context level |
| `lib/email-queue.ts` | Email queue (pg-boss); worker dispatches via `@obilabs/email` |
| `lib/email-settings.ts` | Email provider config (encrypted), `sendViaConfiguredProvider`, audit |
| `lib/support-prompt.ts` | AI support prompt templates |
| `lib/api-auth.ts` | External request validation (Bearer + session); returns `ApiAuthContext` with `keyType` + canonical `permissions: ApiScope[]` |
| `lib/require-scope.ts` | THE chokepoint for every `/api/v1/*` handler; enforces `hasScope()` AND delegated-write header validation |
| `lib/api-key-scopes.ts` | `userMaxScopes()`, `personalKeysForUser()`, `intersectScopes()`; `PERSONAL_KEY_QUOTA=5` |
| `lib/api-keys-migration.ts` | Legacy permission → canonical scope translation (kept as helper; primary path is migration 091) |
| `components/ui/Button.tsx` | THE button primitive. Variants: primary / secondary / danger / ghost. `whitespace-nowrap` + `flex-shrink-0` baked in — text can't wrap. |
| `components/ui/Modal.tsx` | THE modal primitive. Top-anchored scroll pattern baked in (no `items-center` escape hatch — that's the cut-off bug). Sub-components: `Modal.Header` / `Modal.Body` / `Modal.Footer`. |
| `components/ui/Badge.tsx` | THE badge primitive. Semantic tones: brand / blue / amber / red / slate / purple / emerald. |
| `components/VendorFooter.tsx` | Outbound link footer to apps/web (sponsor / support). Driven by `NEXT_PUBLIC_VENDOR_URL`. Hidden on standalone pages. |
| `middleware.ts` | Route protection and auth |

## Email — provider abstraction (added 2026-05-13)

Outbound email uses `@obilabs/email` (published npm package) — six pluggable
providers (gmail-relay default, gmail-smtp, resend, ses, sendgrid,
smtp). Config stored in `email_settings` (one row per org, AES-256-GCM
envelope encrypted via `AEGIS_SECRETS_KEY`). Worker in
`lib/email-queue.ts` dispatches every send through
`sendViaConfiguredProvider()` in `lib/email-settings.ts`. Every attempt
records to `email_attempts`.

- **Don't** add a new provider here. `@obilabs/email` is a PUBLISHED npm package
  (a dependency of this repo, not a workspace folder) — new providers go in its
  own repo. Vendoring a copy here would fork the provider abstraction.
- **Don't** read SMTP_* env vars (deprecated; 30-day grace, then removed)
- **Don't** call provider SDKs directly — always go through `getProvider().sendEmail()`
- **Do** fail-loud user-facing flows when `isEmailConfigured()` returns false (see `lib/auth.ts` forget-password handling for the pattern)

## UI primitives (added 2026-06-09)

apps/aegis has three canonical UI components in `components/ui/`:

- **`<Button>`** — `variant` (primary / secondary / danger / ghost),
  `size` (sm / md / lg), `leftIcon`, `rightIcon`, `isLoading`.
  Forbidden to roll your own `<button>` with
  `bg-brand-600 hover:bg-brand-700 ...` — use this. The component bakes
  in `whitespace-nowrap flex-shrink-0` so the wrap bug Mike hit on
  2026-06-05 can't recur.

- **`<Modal>`** — `open`, `onClose`, `size` (sm/md/lg/xl),
  `closeOnEscape`, `closeOnBackdrop`. Sub-components:
  `<Modal.Header>` / `<Modal.Body>` / `<Modal.Footer>` for consistent
  spacing. Forbidden to roll your own `fixed inset-0 bg-black/50 ...`
  wrapper — use this. The top-anchored scroll pattern is baked in
  (no `items-center` escape hatch); reviving the cut-off bug requires
  patching the primitive directly.

- **`<Badge>`** — `tone` (brand / blue / amber / red / slate / purple
  / emerald) + `leftIcon`. Replaces the ad-hoc TYPE_COLOR /
  CONTEXT_COLOR / PERMISSION_COLOR maps.

Usage:
```tsx
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'

<Button leftIcon={<PlusIcon />} onClick={open}>Create</Button>

<Modal open={isOpen} onClose={close} size="lg">
  <Modal.Header>...</Modal.Header>
  <Modal.Body>...</Modal.Body>
  <Modal.Footer>...</Modal.Footer>
</Modal>

<Badge tone="amber">Pending</Badge>
```

Migration status (2026-06-09): the api-keys admin + account pages
were migrated as the canonical reference. Remaining sites
(`settings/company-email`, `settings/domains`,
`settings/kb-contributors`, `settings/knowledge-base`,
`setup/wizard`, plus 11 modal sites and assorted badge sites) are
follow-up work. New code MUST use the primitives starting now.

## Portal navigation + vendor outbound links (added 2026-06-09)

apps/aegis is the self-hosted ITSM portal. Owner-facing surfaces
(licensing, donations, marketing pages) live in apps/web at the
vendor URL — NOT here. To link from apps/aegis to apps/web for
those concerns, use the `VendorFooter` component already wired into
`app/portal/layout.tsx`, driven by `NEXT_PUBLIC_VENDOR_URL` (default
`https://api.obilabs.dev`). Set the env var to an empty string to
hide the footer entirely on air-gapped installs.

- **Don't** add `/portal/billing` — billing is MTP scope, not
  apps/aegis. The pattern was deleted 2026-06-09.
- **Don't** add `/portal/instances` — instances belong on apps/web
  (owner's licensing surface). Deleted 2026-06-09.
- **Don't** add `/portal/donations` — donations belong on apps/web.
  Deleted 2026-06-09.
- **Don't** add `/portal/vendors` — vendors were merged into
  `companies` per the people model rework; the vendors entity no
  longer exists as a distinct route. Deleted 2026-06-09.
- **Don't** add a Settings landing tile whose `href` doesn't resolve
  to a real `page.tsx`. The CI gate
  `Verify Settings landing links resolve` in `.github/workflows/ci.yml`
  catches this — if you add a tile for a feature still in flight,
  the page MUST exist as at least a stub first. (The gate ran in
  `build-aegis.yml` before the repo split, i.e. only on push-to-main;
  it now runs per-PR, since a gate that fires after merge has already
  let the bug in.)
- **Do** use `VendorFooter` for any outbound link from apps/aegis
  to apps/web. Never hardcode `https://api.obilabs.dev` in a
  component — the env var is the source of truth.

## API keys — typed + scoped (added 2026-06-05)

Every `api_keys` row has a `key_type` discriminator:

| Type | Owner | Audit contract |
|------|-------|----------------|
| `personal` | `key_owner_user_id` (set) | Bearer key auths the user; scopes capped by `userMaxScopes()` at issuance |
| `mtp-polling` | org-owned (`key_owner_user_id IS NULL`) | Bearer key auths the firm; no actor context required. For non-Aegis polling tools (third-party MSP systems). |
| `delegated-write` | org-owned | Bearer auths the firm AND every write/delete REQUIRES `X-Aegis-Action-Ticket` + `X-Aegis-Acting-User-Email` per call |
| `aegis-mtp-pairing` | org-owned | Bespoke handshake + single-use binding contract — see "MTP pairing model" section above. Used by apps/mtp to pair with this client install. **When granted write/delete scopes (per pairing-keys-actor-assertion, 2026-06-10), each write/delete call requires `X-Aegis-Action-Ticket` + `X-Aegis-Acting-User-Email` headers — same contract as `delegated-write`.** Reads are header-free. |

Scope vocabulary is `@obilabs/api-scopes` (21 canonical scopes,
`resource:action` shape). UI strings like `ai_chat`/`ticket_read` are
**dead** — they only survive on legacy rows pre-migration 091, and
were translated into the canonical `scopes` column at boot. Never
reintroduce them.

**Don't:**
- Inline-check `permissions.includes(...)` in a v1 handler. Use
  `requireScope(req, 'tickets:read')` — `hasScope()` resolves the
  `admin:full` wildcard there and nowhere else.
- Add a write/delete scope to a `mtp-polling` key (recommended, not
  schema-enforced — the type is a contract with the integrator).
- Write to `api_keys.permissions` JSONB without also writing the
  canonical `api_keys.scopes text[]` — `lib/api-auth.ts` reads the
  array column; the JSONB column is kept in sync only for the legacy
  UI surface during the transition.

**Do:**
- Reach for `lib/api-key-scopes.ts` helpers for any user/scope-ceiling
  reasoning. `intersectScopes()` is the single place scope-capping
  logic lives.
- Surface dropped scopes in API responses so callers know which
  requested scopes were clipped.

## FK design — never orphan identity references (added 2026-07-03)

Per `PRINCIPLES.md` #8 (References never orphan): FOREIGN KEY columns
pointing at identity entities (`users`, `contacts`, `companies`,
`providers`) MUST use `ON DELETE RESTRICT` or `NO ACTION`, never
`ON DELETE SET NULL` and never `ON DELETE CASCADE`.

Rationale: deletion of an identity entity is a soft-delete
(`deleted_at` timestamp). The row survives; queries filter it out from
active-user lists; references remain intact so history reads as
"Created by John Smith (former user)" instead of NULL or "[deleted]".
Purge is an explicit admin action gated by reference transfer or
anonymization — see `docs/compliance/legal-review-todo.md` for the
jurisdictional context.

Examples of correct patterns already in the codebase:

- `tickets.created_by → users(id) ON DELETE RESTRICT` ✓
- `provider_audit_log.provider_id → providers(id) ON DELETE RESTRICT` ✓

**Don't:**

- Write a migration that adds `ON DELETE SET NULL` on a FK to `users`,
  `contacts`, `companies`, or `providers`.
- Write a migration that adds `ON DELETE CASCADE` to any FK pointing
  at an identity entity — deleting a user should never delete their
  historical tickets or KB contributions.
- Use `session.user.id` or similar in a Zod schema without also
  filtering out ghosts (`WHERE deleted_at IS NULL`) at the query
  layer.

**Do:**

- Add `deleted_at TIMESTAMPTZ NULL` to any new identity-shaped table.
- When adding a FK to an identity entity, use `ON DELETE RESTRICT`
  and let the admin resolve references at delete time.
- Include ghosts in JOIN-driven display queries so history renders
  the person's former display fields.

## Docker Compose — one file, no drift (added 2026-07-03)

`apps/aegis/docker-compose.yml` is the SAME file on prod as it is in
the repo. Every difference between environments lives in `.env` via
the documented knobs (`BIND_HOST`, `PORT`, `AEGIS_VERSION`,
`POSTGRES_PASSWORD`, secrets, etc.). Prod deploy = `scp docker-compose.yml`
followed by `docker compose down && docker compose up -d`.

**Why:** the compose drift caused a silent-fail bug on 2026-06-14
(AEGIS_SECRETS_KEY not forwarded → email save returned 500 without a
clear reason). Enforcing "prod = repo" means any env var we add to the
repo compose flows into prod automatically on the next pull, and there
is one file to reason about.

**Don't:**
- Edit `~/aegis/docker-compose.yml` on prod directly. Change the repo
  copy, PR the change, then redeploy.
- Add a service that only exists on prod (use compose profiles instead
  — see `docling` for the pattern).
- Hard-code a LAN IP or host-specific value in the compose file. Use
  `${BIND_HOST}` / other env knobs and set them per-host in `.env`.

**Do:**
- Add new operator-tunable values as `${VAR:-default}` in the compose
  file, then document in `env.example`.
- Use `./data/{postgres,redis,minio}` bind mounts (root CLAUDE.md
  rule) — never named volumes. `docker compose down` doesn't touch
  the data dirs; `rm -rf ./data` is the only true wipe.
- Use hyphenated container names (`aegis-nginx`, `aegis`,
  etc.) — matches the root CLAUDE.md `{project}-{service}` convention.

## Admin seeding (two-mode pattern, added 2026-06-14)

`ADMIN_PASSWORD` is the routing knob between two deploy flows:

- **Empty (default):** `scripts/seed-admin.mjs` exits without seeding.
  Operator lands at `/portal/setup` in the browser, creates the first
  admin inline. No admin secret in `.env`.
- **Set:** Admin is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD`/
  `ADMIN_NAME`. Sign-in works immediately; first browser visit jumps
  straight to the org wizard.

There is no `ChangeMe123!` fallback — leaving `ADMIN_PASSWORD` empty
means "I'll set it in the browser," not "seed me an insecure default."
The pre-2026-06-14 default was a security hazard and is gone.

**Don't:**
- Reintroduce a default password fallback. Empty MUST mean "skip seed."
- Wire ADMIN_PASSWORD into any other surface — it's purely a deploy-
  time bootstrap. Once the admin exists, the value is irrelevant.

**Do:**
- Surface both modes in `env.example` + `README.md` so operators
  understand the choice.
- Remember the telemetry consent step in the wizard is non-bypassable
  in either mode — pre-seeding does NOT skip it.

## Telemetry consent (added 2026-06-11)

Aegis phones home via two paths today:

- `lib/license-heartbeat.ts` (recurring `/api/instances/validate` to
  apps/web every 20 min — also doubles as heartbeat-audit appender)
- `lib/telemetry.ts` (`sendTelemetry()` — tier-based opt-in: Tier 0
  install ping, Tier 1 setup snapshot, Tier 2 usage heartbeat)

Both senders are gated by `lib/telemetry-consent.ts`:
`getEffectiveTelemetryState()` resolves `TELEMETRY_ENABLED=false` env >
`telemetry_settings.enabled` DB row > default-on. When the gate returns
off, NO payload is sent — including Tier 0 install pings that used to
fire unconditionally.

State changes write to `telemetry_consent_log` (append-only per
Principle 6). Migration 094 backfills existing organizations with a
`retroactive_pre_consent_release` source so the log is never silent
about pre-feature installs.

**Don't:**
- Add a new outbound telemetry path without calling
  `getEffectiveTelemetryState()` first. Both existing senders enforce
  this; new ones must too.
- Change the heartbeat / telemetry payload shape without paired updates
  to `apps/web/app/privacy/page.tsx` (operator must be able to audit
  the wire format).
- UPDATE or DELETE rows in `telemetry_consent_log` — append-only.

**Do:**
- Use `setTelemetryEnabled()` for any consent-state change so the log
  row is written atomically.
- Treat `TELEMETRY_ENABLED=false` as binding — it represents the
  operator who deployed the container, beats any in-app setting.
- Reference `PRINCIPLES.md` #2 in obilabs-platform (consent-first
  telemetry) when reviewing related changes.

## Cascade revocation (added 2026-07-05)

An MSP firm's `aegis-mtp-pairing` key can be revoked in one action, and
that cascade takes down every downstream credential the MSP holds:
child api_keys they issued to their techs, user accounts provisioned
for MSP staff, and every Better Auth session for those users. Ships
what NIST 800-53 PS-4 + SOC 2 CC7.2 + ISO 27001 A.16.1 have asked for
since 2014 and what no MSP platform offers as a primitive — see
`openspec/changes/archive/2026-07-05-msp-cascade-revocation/` (once
archived) and migration 093 for the schema surface.

**Model:**

- `api_keys.parent_key_id` — nullable FK. Child keys issued under an
  MSP tech point at the pairing.
- `users.user_origin` — enum: `msp_provisioned` (created by the MSP
  for their staff — cascade DISABLES), `customer_native` (default —
  cascade IGNORES), `customer_linked_to_msp` (customer employee who
  uses MSP SSO — cascade LEAVES USER RECORD, SSO surface dies).
- `users.msp_pairing_key_id` — set when the user is provisioned by /
  linked to an MSP pairing.
- `users.key_version` — bumped on cascade so JWT-bearer paths (future)
  reject pre-cascade tokens without waiting for TTL. Fixes NIST AC-12.
- `cascade_revocation_queue` — 60-second undo window; visible-banner
  pattern beats muscle-memory "are-you-sure?" modals (design D7).
- `audit_log.revoked_by_cascade_id` — child cascade rows link back to
  the parent event. One transaction, one traceable audit chain.

**Depth cap:** 1. A pairing key can have children; children cannot
have grandchildren. Enforced by `trg_api_keys_flat_cascade` trigger
(the design's belt-and-suspenders CHECK-subquery pattern doesn't work
in Postgres — see migration 093 rationale). The Okta transitive-lockout
pattern cannot recur.

**Guards:**

- Self-DoS: if the caller's own user record is `msp_provisioned` under
  the pairing being revoked, `/revoke-cascade` refuses with 409
  `self-dos-guard` and tells them to re-auth as a native admin first.
- Skip-undo: opt-in via `skip_undo: true` for mid-incident-response;
  requires typing REVOKE in the modal's second confirm.
- Boot recovery: `recoverPendingCascades()` in instrumentation.ts
  sweeps queued cascades whose `commit_after` has passed. Handles the
  case where the scheduled setTimeout died with the process.

**Don't:**

- Bypass the trigger by raw-SQL UPDATE of `parent_key_id` — the
  trigger catches it, but don't rely on that. Use the API surface.
- Cascade-disable `customer_linked_to_msp` users. They're customer
  employees who happen to use the MSP's SSO. Their SSO breaks; their
  account stays. Not a bug — design D3.
- Add deeper cascade levels (grandchildren) — the depth cap is
  enforced for a reason (design D2, referencing Okta post-mortems).
- Call `commitCascade({ queueId })` outside `lib/cascade-revoke.ts`.
  It's designed as one atomic transaction; splitting it defeats the
  audit-log-then-revoke invariant.
- Log audit events for cascade children via `logAudit()` (async
  fire-and-forget). Cascade log rows are INSERTed inside the same
  transaction as the row they describe, linked via
  `revoked_by_cascade_id`. Use raw `client.query()` inside
  `commitCascade()`.

**Do:**

- Use the "Provisioning MSP firm" dropdown on `/portal/settings/users`
  when inviting an MSP tech. That sets `user_origin='msp_provisioned'`
  + `msp_pairing_key_id` in one shot; cascade Just Works from there.
- Reach for `previewCascade()` before opening any confirmation UI —
  it's cheap and gives the exact scope the modal needs.
- Preserve the atomic-claim contract of `commitCascade()` — BEGIN,
  log parent, revoke parent, revoke+log each child key, disable+log
  each MSP user + bump key_version, kill sessions, mark queue
  committed, COMMIT. Any refactor MUST keep those steps in one
  transaction.

## Do NOT

- Add multi-tenant features
- Add billing/invoicing (MTP scope; route `/portal/billing` was deleted 2026-06-09)
- Add `/portal/instances` or `/portal/donations` (apps/web territory; routes were deleted 2026-06-09)
- Add `/portal/vendors` (vendors merged into companies per people model; route deleted 2026-06-09)
- Add a Settings landing tile whose href doesn't resolve to a real page.tsx (CI gate catches it)
- Hardcode the vendor URL — use `NEXT_PUBLIC_VENDOR_URL` via the `VendorFooter` component
- Roll your own `<button>` with the `bg-brand-600 hover:bg-brand-700` class string — use `<Button>` from `components/ui/Button.tsx`
- Roll your own `<div className="fixed inset-0 bg-black/50 ...">` modal wrapper — use `<Modal>` from `components/ui/Modal.tsx`
- Use `tenant` terminology
- Put external API routes outside `/api/v1/` (they must be versioned)
- Put internal portal routes under `/api/v1/` (they stay at `/api/portal/` etc.)
- Assume `lib/ai/` directory exists (it does not)
- Create dependencies to aegis-mtp or other apps

## KB seeding is part of every user-facing feature (added 2026-07-18)

Every user-facing feature (admin surface, portal UI, new
workflow) MUST ship with at least one KB seed article added
to `lib/seed-articles.ts`. Non-negotiable for launch: the
recursive-design promise (KB + AI chat = self-supporting
product) breaks if features ship without explanatory content.

**When to add a KB article:**
- New admin surface (queues, rules, MSP scope, etc.)
- New concept the customer's admin or end-user must understand
  (escalation semantics, public vs internal notes, actor
  assertion)
- Compliance / audit story worth documenting for the
  customer's auditor (cascade revocation, MSP scoping proof)

**Do NOT ship a spec whose "Do" tasks include user-facing UI
without a corresponding KB seed article task.** The pattern is
established: bump `CONTENT_VERSION` in `seed-articles.ts`;
existing installs pick up the new articles via the reseed
endpoint (`POST /api/admin/kb/reseed`). Fresh installs get them
on `/api/setup/complete`.

**Article style:**
- Concise (500-1500 words is right; 3000+ is a book)
- Explain WHY not just HOW
- Cross-reference other seeded articles by slug
- `is_system: true` for all seeded articles. (There is no
  `is_reply_template` column — reply templates are unbuilt.)

## Do

- Keep single-organization focus
- Use `organization` terminology
- Support both internal (employee) and external (customer) tickets
- Follow database schema in `init.sql` / migrations
- Use feature flags for experimental features
- Log all sensitive actions to audit trail
