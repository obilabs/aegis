# Tasks — Telemetry Consent Split

## Disclosure (the important part) — DONE (copy-only, no plumbing change)
- [x] Wizard `app/portal/setup/wizard/page.tsx`: Tier-0 card relabeled
      **Anonymous liveness ping**, "(once at install, then daily)", shows both
      install and daily shapes; added a **Usage telemetry — optional** subheading
      before the Tier 1/2 toggles; master-toggle sub-label now names the liveness ping.
- [x] Wizard: states the ping is sent **once at install and then daily**, carries
      `{ instance_id, version }` on the daily ping, and exists to count active
      installs. ("sent once" wording removed.)
- [x] Settings `app/portal/settings/telemetry/page.tsx`: Tier-0 label →
      "Liveness (install + daily ping)"; added the daily `{ instance_id, version }`
      shape; master kill-switch copy + privacy-note bullet now name the liveness ping.

## Honest copy — DONE
- [x] `README.md` Telemetry & Privacy section: rewritten to the two-part model
      (anonymous liveness default-on with one-click/env off; usage opt-in).
- [x] `app/privacy/page.tsx`: liveness wire shape (install once + daily recurring)
      documented; usage shape corrected to the real Tier-2 shape; self-hosted
      controls reconciled to the split; stale date + wrong audit path fixed.

## Verify (name the check that fails) — FOLLOW-UP (tests not yet added)
- [ ] Test: post-setup with defaults → `telemetry_settings.enabled=true` and an
      `alive_ping` row is produced (active-install count preserved).
- [ ] Test/snapshot: wizard liveness card contains "daily"/"recurring".
- [ ] Test: liveness off (toggle or `TELEMETRY_ENABLED=false`) →
      `sendTelemetry()` returns `suppressed-by-consent:*`, no `telemetry_log` row.
- [ ] Test: default `telemetry_tier=0` → no `setup_snapshot`/`usage_heartbeat`.

> Note: this landed as a **copy/disclosure-only** change — no edits to
> `lib/telemetry*.ts`, `lib/alive-ping.ts`, or `setup/complete`, so telemetry
> behaviour is unchanged and the guardrails below already hold. The verify tests
> are worth adding to lock the disclosure wording + default in place.

## Guardrails (should already hold — assert, don't assume)
- [ ] `TELEMETRY_ENABLED=false` still suppresses ALL senders incl. alive ping.
- [ ] Every consent change still appends a `telemetry_consent_log` row.
- [ ] Alive ping stays community-only + fail-open.
