# Telemetry Consent — Split Liveness from Usage

## Summary

Split Aegis's single telemetry consent into two clearly-separated concepts and
make the first-boot experience honest about each:

1. **Anonymous liveness** (Tier 0: one-time install ping + the recurring
   "alive ping") — **default ON**, fully disclosed at first boot, one click to
   turn off, and killed entirely by `TELEMETRY_ENABLED=false`. Payload is the
   minimal, non-PII `{ instance_id, version }` (community) — a random,
   non-derived id and a version string, nothing else.
2. **Usage telemetry** (Tier 1 setup snapshot + Tier 2 usage heartbeat) —
   **opt-in**, unchanged.

Chosen direction (maintainer decision, 2026-08-24): the "split" option, over
"full opt-in" and "required explicit choice." This keeps the community
active-install count working while ensuring the only default-on wire is a
genuinely anonymous existence beacon.

## Problem Statement

The data-sovereignty pitch says "your data never leaves your infrastructure,"
but the current first-boot telemetry UX undercuts it in two ways:

- **Opt-out default.** The setup wizard's `telemetry_disabled` defaults to
  `false` (`app/portal/setup/wizard/page.tsx`), and an org with no
  `telemetry_settings` row resolves to `enabled ?? true`
  (`lib/telemetry-consent.ts:65`). Click "Launch Aegis" without touching the
  toggle → telemetry on.
- **Undisclosed recurring beacon (the real gap).** The wizard consent card
  labels Tier 0 as "Install Ping + License **(sent once)**," but
  `lib/alive-ping.ts` sends a **daily** liveness ping to `api.obilabs.dev` for
  community installs. A recurring beacon presented as "sent once" is the
  honesty problem, more than the default is.

At the same time, the alive ping exists for a good reason: community installs
carry no licence, so they never emit the ~20-min licence-validate heartbeat and
would age out of the control plane's `active_*_30d` window 30 days after
install. The alive ping is gated by the **same** `telemetry_settings.enabled`
switch — so naïvely flipping the default to OFF re-breaks the exact
active-install metric the alive ping was built to fix.

## Decision: the split model

Separate the two consents so each can have the right default:

| Concept | What fires | Default | Off switch |
|---|---|---|---|
| **Liveness** | Tier 0 install ping (once) + alive ping (daily). `{ instance_id, version }`. | **On, disclosed** | One-click in wizard/Settings; `TELEMETRY_ENABLED=false` (kills everything) |
| **Usage** | Tier 1 setup snapshot; Tier 2 usage heartbeat. Industry, ranges, module list. | **Off (opt-in)** | Already opt-in via `telemetry_tier` |

**Key realization: no schema change is needed.** The data model already encodes
the split:

- `telemetry_settings.enabled` already behaves as the master/liveness switch —
  `enabled=true, telemetry_tier=0` fires **liveness only** today.
- `organizations.telemetry_tier` (0/1/2) already gates usage detail; Tier 1/2
  only send when the operator opted in.
- `TELEMETRY_ENABLED=false` and `enabled=false` already suppress **every**
  sender, alive ping included.

So this change is about **disclosure, framing, and defaults legibility**, not
plumbing. That is the "minimal disclosed anonymous alive-ping" the brief asked
for.

## Technical Approach

### 1. Close the disclosure gap (the important part)
- `app/portal/setup/wizard/page.tsx`: rework the Telemetry & Privacy step so it
  presents **two** labeled choices instead of one "Disable all telemetry"
  opt-out:
  - **Anonymous liveness ping** — ON by default, one-click off. Copy states it
    is sent **once at install and then daily**, carries only
    `{ instance_id, version }`, and exists to count active installs. (This is
    the sentence that fixes the "sent once" misstatement.)
  - **Usage telemetry (optional)** — the existing Tier 1/2 toggles, OFF by
    default.
  - Keep the note that `TELEMETRY_ENABLED=false` (env) kills everything and
    beats the UI.
- `app/portal/settings/telemetry/page.tsx`: mirror the same two-part framing and
  name the recurring ping.

### 2. Honest README + privacy copy
- `README.md` "Telemetry & Privacy" section: replace the current
  "phones home … sending anonymized usage data" framing with the two-part model
  — anonymous liveness (default on, `{instance_id, version}`, one-click/env off)
  vs usage telemetry (opt-in). No overstatement of what is default-on.
- `app/privacy/page.tsx` (and the control-plane `/privacy` page it mirrors):
  document the alive-ping wire shape explicitly, since it is recurring.

### 3. Keep the guarantees that already hold
- `TELEMETRY_ENABLED=false` remains the master kill for **all** senders,
  liveness included (already true — `lib/telemetry-consent.ts` env check).
- Every consent change still writes an append-only `telemetry_consent_log` row
  via `setTelemetryEnabled()` (unchanged).
- Alive ping stays community-only + consent-gated + fail-open (unchanged).

### Explicitly NOT doing
- No new column, no migration. If review decides a separate `liveness_enabled`
  column is worth the clarity, that is a follow-up — the reuse above is
  behaviourally correct today.
- Not flipping liveness to default-off (that was the rejected "full opt-in"
  option — it re-breaks the active-install count).

## Success Criteria

Per the repo's verification rules — name the check that fails if this didn't
work:

1. A fresh community install that clicks "Launch Aegis" **without changing
   anything** still emits the alive ping (active-install count preserved).
   *Check:* a `telemetry_settings` row with `enabled=true` exists post-setup and
   `sendAlivePing()` produces a `telemetry_log` `alive_ping` row.
2. The wizard consent step **names the recurring daily ping** in its copy.
   *Check:* wizard renders the word "daily" (or "recurring") in the liveness
   card; a snapshot/DOM test asserts it.
3. Turning the liveness toggle off (or `TELEMETRY_ENABLED=false`) suppresses the
   alive ping. *Check:* `getEffectiveTelemetryState()` returns `off` and
   `sendTelemetry()` returns `suppressed-by-consent:*` with no `telemetry_log`
   row.
4. Usage tiers remain off unless explicitly enabled. *Check:* default
   `telemetry_tier=0`; no `setup_snapshot`/`usage_heartbeat` rows without opt-in.

## Out of Scope

- Full opt-in / removing the alive ping (rejected direction).
- Hardening the ≤3-instance licence check against patching (deprioritized).

## Files to Modify

- `app/portal/setup/wizard/page.tsx` — two-part consent step + recurring-ping disclosure
- `app/portal/settings/telemetry/page.tsx` — mirror framing, name the ping
- `README.md` — Telemetry & Privacy section rewrite
- `app/privacy/page.tsx` — document the alive-ping wire shape
- (No change required to `lib/telemetry.ts`, `lib/telemetry-consent.ts`,
  `lib/alive-ping.ts`, or `app/api/setup/complete/route.ts` for the minimal
  version — the plumbing already supports the split.)
