# E2E walk-through

A headless browser walk through a **fresh self-hosted install**, the way a new
operator meets Aegis: build the image from this checkout, start the compose
stack from `env.example`, read the setup token from the log, and use the product.

```bash
bash e2e/run.sh                   # build, start, test, tear down (about 10-15 min)
KEEP_STACK=1 bash e2e/run.sh      # leave the stack running afterwards
E2E_PORT=18500 bash e2e/run.sh    # use another host port (default 18480)
```

Needs Docker (with compose), Node 20+, `openssl` and `curl`. On a machine
without Playwright's Chromium, run `npx playwright install chromium` in `e2e/`
once (CI does this with `--with-deps`).

CI runs the same script: `.github/workflows/e2e.yml`, on pull requests that
touch the app, the image or this suite. Failed runs upload `e2e/artifacts`.

## Isolation

The stack is compose project `aegis-e2e` with `e2e/compose.e2e.yml` layered on
the unchanged `docker-compose.yml`:

- containers are named `aegis-e2e-*`, so it runs beside another Aegis install;
- data lives in named volumes, not `./data`, so a real install's data is never
  touched, and `docker compose -p aegis-e2e ... down -v` removes everything;
- nginx binds `127.0.0.1` only; outbound telemetry is off.

`run.sh` writes its generated secrets to `e2e/.env.e2e` (gitignored) and deletes
it on teardown.

## What the specs cover

Specs share one stack and run in file order (one worker). Later specs use
state saved by earlier ones in `e2e/artifacts/state.json`.

| Spec | Walk-through step |
|------|-------------------|
| `01-setup` | Setup token printed in the log; wrong token refused; first admin; setup wizard; `/portal/setup` closed afterwards |
| `02-users-and-roles` | Sign out / in; invite a technician and an end user via set-password links; admin role refused at creation; technician cannot grant themselves admin (UI and API) |
| `03-tickets` | End-user and technician tickets; hostile rich text (`<img onerror>`, `<script>`, `javascript:`) renders inert and is stored sanitized; assignment; In Progress -> Resolved -> Closed with timestamps and history; ~5 MB attachment upload + byte-identical download; internal notes hidden from requesters |
| `04-knowledge-base` | Publish a public article; read it signed out; "was this helpful?" feedback stored once |
| `05-companies-contacts-assets` | Create a company, a contact at it and an asset assigned to them; ticket for the contact; link the asset |
| `06-settings-and-sweep` | AI features off by default and not advertised; page sweep for crashes, 5xx and funding wording; placeholder text reported |
| `07-access-by-role` | API access per role: end user refused organization records, other people's tickets, staff actions and settings; technician works records but not settings; admin reaches both |
| `07b-navigation-by-role` | Navigation per role, and restricted pages (settings, staff sections) refusing when the URL is typed |
| `07-restart-persistence` | `down` (no `-v`) + `up`: rows, attachment bytes, sessions (persisted auth secret) survive; setup stays closed |

## Artifacts (`e2e/artifacts/`, gitignored)

- `screenshots/` - a full-page screenshot at each step and for every swept page
- `browser-issues.log` - console errors and 4xx/5xx seen per step
- `page-sweep.json` - per-page problems and placeholder-text notes
- `compose.log` - container logs at teardown
- `report/` - Playwright HTML report; `test-results/` - traces for failures

## Running specs against an already running stack

```bash
KEEP_STACK=1 bash e2e/run.sh      # once
cd e2e
AEGIS_E2E_URL=http://localhost:18480 npx playwright test tests/04-knowledge-base.spec.ts
```

Specs 01-02 need a fresh, empty stack; later specs need the state the earlier
ones saved.
