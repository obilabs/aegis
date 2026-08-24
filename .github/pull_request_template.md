<!-- Squash-merged: keep the PR title as `type(scope): description`
     (type ∈ feat, fix, refactor, docs, test, chore). -->

## What & why

<!-- What does this change and why. Link the issue if there is one. -->

## Checklist

- [ ] I have read and agree to the [CLA](../blob/main/CLA.md) — I'm listed in
      `.github/cla-signers.yml`, or I'm an ObiLabs employee/contractor
      (`organization:`). First contribution? See [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md).
- [ ] CI is green (type check, unit tests, UI primitive ratchet, Settings links)
- [ ] New user-facing feature includes a KB seed article + `CONTENT_VERSION` bump
- [ ] No multi-tenant / billing patterns; uses `organization` terminology and the
      `components/ui/*` primitives
- [ ] Sensitive actions are written to the audit trail
