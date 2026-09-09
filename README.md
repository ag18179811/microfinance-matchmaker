# Microfinance Matchmaker

Microfinance Matchmaker is a static GitHub Pages platform for small business owners who need a clearer path to grants, microloans, city programs, CDFIs, and nonprofit coaching.

The product is intentionally readiness-first: it does not just rank funding options. It also explains why each match appears, flags likely eligibility cautions, estimates readiness, and generates a downloadable packet of documents and next steps.

## Site Pages

- `index.html` - interactive funding match and readiness packet tool
- `solutions.html` - services for business owners
- `partners.html` - CDFI, city, chamber, and nonprofit partner offering
- `research.html` - market case and source trail
- `about.html` - mission and trust principles

## Features

- Guided intake survey with location, revenue, funding need, time in business, credit profile, owner profile, and eligibility screen
- Ranked local and national resource matching
- Transparent scoring reasons and cautions for each recommendation
- Funding readiness estimate and likely preparation timeline
- Document checklist and next-step plan
- Downloadable text readiness packet
- Startup-style Solutions, Partners, Research, and About pages
- SEO basics: sitemap, robots file, manifest, and GitHub Pages workflow

## Run locally

Open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Publish on GitHub Pages

This repository includes a GitHub Actions workflow in `.github/workflows/pages.yml`. After pushing the repo to GitHub, go to repository **Settings -> Pages** and choose **GitHub Actions** as the source if GitHub does not select it automatically.

The live site URL will normally be:

```text
https://ag18179811.github.io/microfinance-matchmaker/
```

## Production Notes

The resource data in this prototype is illustrative. Production use should connect to verified program feeds, CDFI partner records, city program calendars, and maintained eligibility rules. Microfinance Matchmaker is not a lender and does not guarantee approval.

---

## Full-Stack MVP App (`/server` + `/client`)

Alongside the static GitHub Pages site above, this repo also contains a working full-stack MVP:

- **`/server`** — Node/Express API on Supabase Postgres. Deterministic, rules-based lender matching and readiness scoring (`services/matching-engine.js`, no LLM), a Groq free-text extraction step (`services/groq-extract.js`) that seeds structured fields from the opening description, an adaptive interview, and a set of AI layers that only ever generate explanatory or narrative text — never eligibility decisions.
- **`/client`** — Vite + React app: a no-account preview, a "describe your business" box, the adaptive chat interview, and a results page with the full application-prep layer.

### How intake works

1. The user describes their business in one free-text box (`POST /api/interview/start`).
2. Groq (JSON mode, temperature 0) extracts only what's explicitly or unambiguously stated — business name, industry (matched against a fixed list), city/state, time in business, revenue, requested amount, purpose, and the description's language. Every field is re-validated server-side (industry must match the fixed enum, state is normalized against a real US-states table, dollar/month figures are coerced or dropped) so a bad or missing value always becomes `null` rather than a guess.
3. The adaptive interview then fills the rest through conversation, asking only what's genuinely useful for *this* business, and the completed profile flows into `POST /api/applications` → `POST /api/match/:id`.
4. If `GROQ_API_KEY` isn't set, extraction returns everything as `null` and the deterministic fallback interview (`services/interview-fallback.js`) walks a fixed question list — the app degrades gracefully rather than fabricating data.

### Setup

```bash
npm run install:all          # installs server + client dependencies
cp .env.example .env         # then fill in GROQ_API_KEY (optional — app works without it)
```

`.env` lives at the repo root and is read by the server. `GROQ_API_KEY` is optional: without it, the readiness score and lender matches still work exactly the same, just with a placeholder coaching message instead of Groq-generated text.

### Run

```bash
npm run dev                  # runs server (port 3001) and client (port 5173) together
```

Or run them separately:

```bash
npm run server:dev           # http://localhost:3001
npm run client:dev           # http://localhost:5173 (proxies /api to the server)
```

The server connects to Supabase Postgres via `DATABASE_URL`. On boot it runs the idempotent migrations in `server/db/migrate.js` and seeds the eight verified lenders (`server/db/seed-lenders.js`) if the table is empty. For a brand-new Supabase project, run `server/db/schema.sql` once in the SQL editor first (it creates the `auth.users` trigger, which needs privileges the pooled connection doesn't have). To re-seed lenders manually:

```bash
npm run seed
```

### Test the matching engine and extraction logic

The rules-based matching engine and the extraction coercion/validation logic are both unit-tested without needing a live API key (the Groq call is mocked in tests):

```bash
npm test
```

### What makes it different

Most tools are a lender lookup — match you, hand off. This one sits with the owner *after* the match and carries their specific, real story through to the person who will actually read it, as a conversation, never a form.

**Before the match**
- **Adaptive interview** — a real underwriting-style conversation (two-step reason-then-structure pipeline: `openai-interview-reason.js` does the thinking, with live web search; `groq-interview.js` structures it). A visible progress bar (`services/interview-progress.js`) estimates how far the interview is from matches. Half-finished interviews resume from history.
- **No-account preview** — `POST /api/preview` gives a deterministic readiness estimate from four numbers, no sign-in, no persistence.
- **Language** — the opening description's language is detected and threaded into every AI prompt (`services/language.js`); a Spanish description yields a Spanish interview, coaching, funding story, and reviewer.

**At the match**
- **Deterministic engine** — `services/matching-engine.js` (no LLM) scores readiness on five factors and matches against verified lenders + live-discovered programs. **Grants** are a first-class `funding_type` (Amber Grant, Comcast RISE, plus discovered ones): never disqualified for an amount outside the award range, scored and prepared for differently.
- **Help mode** — the application is classified (`services/help-mode.js`) as *organizer* / *demystifier* / *rebuilder* / *strategist* from deterministic signals, tuning the tone of every AI surface and a banner on the results page.
- **"Your next step"** — one synthesized directive from the score, help mode, and tracker (deadline pressure → stale application → practice the top match → finish and submit).
- **Improvement plan** — `services/improvement-plan.js` returns prioritized levers, each with a *real* projected impact (the scoring engine re-run with that one change applied).
- **What-if simulator** — `POST /api/match/:id/simulate` re-runs readiness + matching on hypothetical numbers without persisting.
- **Funding plan** — `services/funding-plan.js`: when no single program covers the ask, a capital stack (which programs, how much each, greedy allocation within stated ranges), grants flagged speculative, the gap named, and an order to pursue them.

**After the match**
- **Living Business Case** (`services/business-case.js`) — a first-person funding narrative drafted from the interview in the owner's voice, refined only by talking to it. Every extrapolation is a correctable assumption; it never invents a number. Refining it can sync the profile and re-run the score (`POST /api/match/:id/recompute`).
- **Cash-flow projection** (`services/cashflow-projection.js`) — a 12-month scaffold seeded from revenue, pattern, and an estimated loan payment; editable grid, warns when ending cash goes negative.
- **Business plan** (`services/business-plan.js`) — the eight standard sections drafted from the funding story + interview + projection, edited by conversation; gaps become `[Add: ...]` prompts, never fabricated market data.
- **Document vault** — upload what lenders ask for once (private Supabase Storage); `services/document-kinds.js` matches each verified checklist so lender prep shows "you have 2 of 7 document types this needs".
- **Underwriter simulation** (`services/underwriter-sim.js`) — per matched program, a review conversation held as *that program's* reviewer (Kiva story reviewer / CDFI cash-flow analyst / SBA-intermediary counselor / grants program officer), grounded in the file's specific cautions. Ends with prepared answers and a now/soon/later timing call.
- **Verified application profiles** (`services/lender-application-profiles.js`) — dated, cited data on how each verified program actually intakes applications (six distinct models). Discovered lenders are marked `verified: false` — never a fabricated checklist.
- **Application pack** (`services/application-pack.js`) — assembles the Business Case + prepared answers into the exact blocks a program's process consumes.
- **Application tracker** — a status board per program (`/api/tracker`), auto-tracking a program once its pack is built, with passive stale-row nudges.
- **Advisor bridge** — routes complex cases to the free human advisors (SBDC, SCORE, the lender's own coaching) with a print/PDF of the report to bring.

### API

Every route requires a `Bearer` access token (`middleware/auth.js`) and is scoped to the calling user — except `POST /api/preview`, the one public endpoint.

- `POST /api/preview` — no-account deterministic readiness estimate
- `POST /api/interview/start` · `POST /api/interview/:id/reply` · `GET /api/interview/:id/resume` · `POST /api/interview/:id/attachments`
- `POST /api/applications` · `GET /api/applications/:id`
- `POST /api/match/:id` · `GET /api/match/:id` · `POST /api/match/:id/simulate` · `POST /api/match/:id/recompute` · `GET /api/match/:id/improvement-plan` · `GET /api/match/:id/funding-plan`
- `GET|POST /api/business-case/:id` · `.../message` · `.../regenerate` · `.../sync-check` · `GET|PUT .../projection` · `GET|POST .../plan`
- `GET /api/underwriter/:id/lenders` · `POST /api/underwriter/:id/:lenderKey/start` · `.../message` · `.../pack`
- `GET|POST /api/tracker/:id` · `DELETE /api/tracker/:id/:lenderKey`
- `GET|POST /api/documents/:id` · `GET .../:docId/url` · `DELETE .../:docId`
- `GET /api/conversations` · `GET /api/conversations/:id`

### Notes for production

- The seeded lender data in `server/db/seed-lenders.js` is **eight real, individually verified programs** (each checked against the org's own site, dates noted). Expanding it should pull from the [CDFI Fund Awards Database](https://www.cdfifund.gov/awards/state-awards) with the same per-entry verification — never bulk-generate entries from a model's knowledge.
- Auth is Google sign-in via Supabase; the datastore is Supabase Postgres. App tables added after launch are created idempotently on boot by `server/db/migrate.js` (with transient-error retries), so a deploy needs no manual SQL-editor step; `server/db/schema.sql` stays the canonical definition for a fresh project.
- No payments. External calls: Groq (interview structuring, coaching, business case, underwriter, improvement-plan polish, pack) and OpenAI (interview web-search reasoning, live lender/grant discovery). Everything degrades gracefully when a key is missing.

### Deploying for a public demo (Render + Vercel)

GitHub Pages can only serve static files — it can't run the Express backend, so it isn't part of this path. The backend goes on Render, the frontend on Vercel.

**1. Backend → Render**

1. In the [Render dashboard](https://dashboard.render.com), click **New +** → **Blueprint**.
2. Connect this GitHub repo and pick `main`. Render reads `render.yaml` at the repo root automatically and configures the service.
3. Set the environment variables Render prompts for (from `render.yaml`): `GROQ_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` (Supabase Postgres connection string), `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS` (your Vercel URL + `http://localhost:5173`). They're stored only in Render's dashboard, never in the repo. Migrations run automatically on boot.
4. Deploy. Once live, copy the service URL Render gives you (something like `https://microfinance-matchmaker-api.onrender.com`) — you'll need it for the frontend step.
5. Sanity-check it: `curl https://<your-render-url>/api/health` should return `{"ok":true}`.

Data lives in Supabase Postgres, so it persists across Render restarts. The free Render plan still cold-starts after inactivity, so the first request after a while is slow.

**2. Frontend → Vercel**

1. In the [Vercel dashboard](https://vercel.com/new), import this same GitHub repo.
2. Set **Root Directory** to `client` (Vercel auto-detects the Vite framework preset from there — no other config needed).
3. Add an environment variable: `VITE_API_BASE_URL` = the Render URL from step 1 (no trailing slash).
4. Deploy. Vercel gives you a public `https://*.vercel.app` URL — that's your shareable demo link.
