# UI observations — running list

Things noticed while actually using the product, kept here so they are not lost
between sessions. **Append, do not rewrite.** Fixed items stay, struck through,
with the PR that closed them — the record of what was wrong is worth as much as
the fix.

Status: `OPEN` · `FIXED` · `NOT-A-BUG` (talked through and deliberately closed)

---

## Ticket detail page (`/portal/tickets/[id]`)

| # | Observation | Status |
|---|---|---|
| 1 | MSP replies render as "Unknown" — no firm, no technician | **FIXED** (#12) |
| 2 | Header pills are three different shapes; action buttons not aligned | **FIXED** (#13) |
| 3 | At 375px the action buttons sit 400px off-screen and the page does not scroll — Change Status / Edit unreachable on a phone | **FIXED** (#13) |
| 4 | Claiming a ticket does not appear in History | **FIXED** (#14) |
| 5 | Conversation-thread pills wrap to two lines, no border, narrower padding than the header | **FIXED** (#14) |
| 6 | **"Acme Admin" is not clickable.** Requester and assignee render as plain text, so you cannot open the person's record to check who they are without leaving the ticket. Most ITSMs link both. | **OPEN** |
| 7 | The Description block does not carry the requester's identity — you rely on the "Opened by" line above it. Possibly fine; noted rather than assumed. | **OPEN — needs a decision, not a fix** |
| 8 | Ticket creator assigning the ticket to themselves looked odd at first glance. Talked through: correct for a company admin, who may take it, hand it to another admin, or pass it to the MSP. | **NOT-A-BUG** |

---

## Cross-cutting

| # | Observation | Status |
|---|---|---|
| 9 | 19 raw `<button>` remain on the ticket page (was 22). Dropdown items and tabs still bypass the `<Button>` primitive. | **OPEN** — burn-down tracked by the CI ratchet |
| 10 | Three history tables (`ticket_field_changes`, `ticket_history`, `ticket_status_history`) and the UI reads one. Consolidating them is the durable fix. | **OPEN** |

---

## How things get onto this list

Anything noticed in normal use, including "not sure this is even a problem".
Item 8 is here precisely because it turned out not to be a bug — recording that
it was considered and dismissed stops it being re-raised as a mystery later.

---

## Responsive overflow — why there is no automated check yet

The 375px clipping bug (#3 above) is the kind of thing a check should catch. Two
approaches were tried on 2026-08-20:

**Static heuristic — REJECTED.** Flag flex rows with `justify-between` and no
`flex-wrap` or responsive direction change. Measured against `app/portal`:

```
flex + justify-between rows                         298
   ...with no wrap and no responsive direction      293
```

293 of 298 is not a signal, it is noise, and nearly all of them are fine — two
children with room to spare. Shipping it would violate Verification Rule 4: *a
permanently-failing check is worse than no check, because it trains everyone to
ignore the signal.* Whether a row overflows depends on rendered width, which is
not statically decidable.

**Browser measurement — WORKS, but needs infrastructure.** This found the bug:

```js
// paste in devtools with the page open at 375px
const vw = document.documentElement.clientWidth
const off = [...document.querySelectorAll('button,a,input,select')]
  .filter(e => e.offsetHeight > 0 && e.getBoundingClientRect().right > vw)
  .map(e => e.textContent.trim().slice(0, 24))
console.log({ viewport: vw, offscreen: off,
  pageScrollsHorizontally: document.documentElement.scrollWidth > vw })
```

An element whose right edge exceeds the viewport **while the page does not scroll
horizontally** is unreachable, not merely ugly. That is the assertion worth
automating.

**Why it is not in CI yet:** aegis has no Playwright and no `e2e/` directory.
Automating this needs Playwright plus a running stack, a seeded database and an
authenticated session in CI — a real investment and its own piece of work, not a
line in an existing job. Until then the snippet above is the repeatable manual
check; run it at 375px on any page you touch.

**Do not substitute a static approximation to close the gap.** It was tried, it
does not work, and a green check that cannot see the failure is exactly the
pattern this project keeps getting caught by.
