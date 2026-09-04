# Contributing to Aegis

Thanks for wanting to improve Aegis. This guide covers the one legal step
(the CLA) and the practical conventions for getting a change merged.

Aegis is licensed under **AGPL-3.0** and is free to self-host, fork, and
modify. Everything in the repository is included — there are no paid tiers or
locked features.

---

## 1. Sign the CLA (first-time contributors)

Before your first code contribution can be merged, you (or your employer) must
agree to the **[Contributor License Agreement](CLA.md)**.

Why: AGPL is strong copyleft, so without a grant from each contributor ObiLabs
couldn't offer the same code under the commercial/source-available terms its
other products (the MSP portal) depend on. The CLA is a **licence, not an
assignment** — you keep the copyright to your work. It just also grants ObiLabs
the right to relicense contributions.

**Signing takes one pull request:**

1. Read [`CLA.md`](CLA.md).
2. Open a PR that adds your GitHub username to `individuals:` in
   [`.github/cla-signers.yml`](.github/cla-signers.yml).
3. Put this line in that PR's description:
   > I have read the Aegis Contributor License Agreement and I agree to it.

A maintainer merges it, and from then on the automated **CLA** check passes on
your code PRs. ObiLabs employees and contractors are listed under
`organization:` and don't sign separately.

The CLA check runs on every PR. A PR that only edits `.github/cla-signers.yml`
(your signing PR) and PRs authored only by bots are exempt.

---

## 2. Before you start

- **Scope.** Aegis is a **single-tenant ITSM** platform. It is *not* a
  multi-tenant/billing/RMM/MDM product — those live in other ObiLabs repos. If
  your idea adds multi-tenancy, invoicing, or endpoint agents, it's out of
  scope here (see [`CLAUDE.md`](CLAUDE.md) → "What Client is NOT").
- **Discuss big changes first.** For anything beyond a bug fix or small
  improvement, open an issue so we can agree on the approach before you build.

## 3. Development setup

See the [README](README.md#development) — `pnpm install`, copy `env.example`,
`pnpm dev`. Prerequisites: Node.js 20+, pnpm, PostgreSQL, Redis.

## 4. Branches and commits

- Branch names: `feature/<desc>`, `fix/<desc>`, `refactor/<desc>`,
  `chore/<desc>`, `docs/<desc>`.
- Commit messages: `type(scope): description` where `type` is one of
  `feat, fix, refactor, docs, test, chore`.
- We **squash-merge** PRs, so keep the PR title in that same format — it becomes
  the commit on `main`.

## 5. What the CI gate checks

Your PR must be green before merge. CI (`.github/workflows/ci.yml`) runs:

- **Type check** — `pnpm exec tsc --noEmit`
- **Unit tests** — `pnpm test`
- **UI primitive ratchet** — use `components/ui/{Button,Modal,Badge}` instead of
  rolling your own; the ratchet forbids new raw `<button>`/modal wrappers.
- **Settings landing links resolve** — every tile in the Settings landing must
  point at a real `page.tsx`.

And the **CLA** check (`.github/workflows/cla.yml`) described above.

## 6. PR checklist

- [ ] CLA signed (or you're in `organization:`)
- [ ] CI is green (type check, tests, UI ratchet, settings links)
- [ ] New user-facing feature? Add at least one KB seed article in
      `lib/seed-articles.ts` and bump `CONTENT_VERSION` (see `CLAUDE.md` →
      "KB seeding is part of every user-facing feature").
- [ ] No multi-tenant / billing patterns; `organization` terminology, never
      `tenant`
- [ ] Sensitive actions are logged to the audit trail

## 7. Reporting security issues

Please **do not** open a public issue for a vulnerability. Use GitHub's private
vulnerability reporting (the repository's **Security → Report a vulnerability**
tab) or contact a maintainer privately, so it can be fixed before disclosure.

---

By contributing, you agree that your contributions are licensed under AGPL-3.0
and are subject to the [CLA](CLA.md).
