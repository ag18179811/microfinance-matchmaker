# Microfinance Matchmaker

Microfinance Matchmaker helps a small business owner who needs capital (a grant, a microloan, a city program, a CDFI) get from "where do I even start" to a real, submitted application. It is readiness-first: it does not just rank options. It explains why each match appears, flags the eligibility cautions, scores how ready the owner is, and then sits with them through the preparation the rest of the internet leaves out.

The product is the **full-stack app** in [`/server`](server/) and [`/client`](client/), described below. The static HTML files at the repo root (`index.html`, `solutions.html`, `partners.html`, `research.html`, `about.html`) are an earlier design-only prototype kept for reference: they share the name and the mission but none of the code, and are not deployed.

---

## The app (`/server` + `/client`)

- **`/server`**: Node/Express API on Supabase Postgres. A per-applicant live program search (`services/openai-lender-search.js`) is the only source of programs; there is no preset catalog. Deterministic, rules-based fit and readiness scoring on top (`services/matching-engine.js`, no LLM), a Groq free-text extraction step (`services/groq-extract.js`) that seeds structured fields from the opening description, an adaptive interview, and a set of AI layers that only ever generate explanatory or narrative text, never eligibility decisions.
- **`/client`**: Vite + React app: a no-account preview, a "describe your business" box, the adaptive chat interview, and a results page with the full application-prep layer.

### How intake works

1. The user describes their business in one free-text box (`POST /api/interview/start`).
2. Groq (JSON mode, temperature 0) extracts only what's explicitly or unambiguously stated: business name, industry (matched against a fixed list), city/state, time in business, revenue, requested amount, purpose, and the description's language. Every field is re-validated server-side (industry must match the fixed enum, state is normalized against a real US-states table, dollar/month figures are coerced or dropped) so a bad or missing value always becomes `null` rather than a guess.
3. The adaptive interview then fills the rest through conversation, asking only what's genuinely useful for *this* business, and the completed profile flows into `POST /api/applications` → `POST /api/match/:id`, which runs the per-applicant program search and scores what it finds.
4. If `GROQ_API_KEY` isn't set, extraction returns everything as `null` and the deterministic fallback interview (`services/interview-fallback.js`) walks a fixed question list; the app degrades gracefully rather than fabricating data.

### Setup

```bash
npm run install:all          # installs server + client dependencies
cp .env.example .env         # then fill in GROQ_API_KEY (optional, app works without it)
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

The server connects to Supabase Postgres via `DATABASE_URL`. On boot it runs the idempotent migrations in `server/db/migrate.js`. There is **no lender seeding**: the app has no preset catalog; every program a business matches with comes from a per-application live web search (`services/openai-lender-search.js`). For a brand-new Supabase project, run `server/db/schema.sql` once in the SQL editor first (it creates the `auth.users` trigger, which needs privileges the pooled connection doesn't have).

### Test the matching engine and extraction logic

The rules-based matching engine and the extraction coercion/validation logic are both unit-tested without needing a live API key (the Groq call is mocked in tests):

```bash
npm test
```

### What makes it different

Most tools are a lookup against a preset list: match you, hand off. This one has no preset list: it searches for programs against each owner's specific situation, then sits with them *after* the match and carries their real story through to the person who will actually read it, as a conversation, never a form.

**Before the match**
- **Adaptive interview**: a real underwriting-style conversation (two-step reason-then-structure pipeline: `openai-interview-reason.js` does the thinking, with live web search; `groq-interview.js` structures it). A visible progress bar (`services/interview-progress.js`) estimates how far the interview is from matches. Half-finished interviews resume from history.
- **No-account preview**: `POST /api/preview` gives a deterministic readiness estimate from four numbers, no sign-in, no persistence.
- **Language**: the opening description's language is detected and threaded into every AI prompt (`services/language.js`); a Spanish description yields a Spanish interview, coaching, funding story, and reviewer.

**At the match**
- **No preset catalog: every program is found live per applicant.** `services/openai-lender-search.js` runs a web search on every match/recompute, built from the owner's *whole* profile: city and county, industry, use of funds, business stage, and (only where the owner qualifies) their stated ownership background. A woman-owned bakery in Cleveland and a man-owned one in the same city get different results. Cached per application for a day (by a profile fingerprint) so a slider move or an unchanged re-match doesn't re-bill; a real profile change re-searches. Two-step (grounded search → schema extraction), and any program without a real cited URL is dropped.
- **Deterministic scoring on top**: once programs are found, `services/matching-engine.js` (no LLM) scores readiness on five factors and scores each program's fit (geography, industry, amount, tenure) with explainable reasons and cautions. **Grants** are a first-class `funding_type`: never disqualified for an amount outside the award range, scored and prepared for differently.
- **Help mode**: the application is classified (`services/help-mode.js`) as *organizer* / *demystifier* / *rebuilder* / *strategist* from deterministic signals, tuning the tone of every AI surface and a banner on the results page.
- **"Your next step"**: one synthesized directive from the score, help mode, and tracker (deadline pressure → stale application → practice the top match → finish and submit).
- **Improvement plan**: `services/improvement-plan.js` returns prioritized levers, each with a *real* projected impact (the scoring engine re-run with that one change applied).
- **What-if simulator**: `POST /api/match/:id/simulate` re-runs readiness + matching on hypothetical numbers without persisting.
- **Funding plan**: `services/funding-plan.js`: when no single program covers the ask, a capital stack (which programs, how much each, greedy allocation within stated ranges), grants flagged speculative, the gap named, and an order to pursue them.

**After the match**
- **Living Business Case** (`services/business-case.js`): a first-person funding narrative in the owner's voice, refined only by talking to it. Every extrapolation is a correctable assumption; it never invents a number. Opt-in: the first draft is one billed Groq call, so `GET` returns `{ exists: false }` until the owner clicks "Draft my funding story" (`POST .../draft`). Refining it can sync the profile and re-run the score (`POST /api/match/:id/recompute`).
- **Cash-flow projection** (`services/cashflow-projection.js`): a 12-month scaffold seeded from revenue, pattern, and an estimated loan payment; editable grid, warns when ending cash goes negative.
- **Business plan** (`services/business-plan.js`): the eight standard sections drafted from the funding story + interview + projection, edited by conversation; gaps become `[Add: ...]` prompts, never fabricated market data.
- **Document vault**: upload what lenders ask for once (private Supabase Storage); `services/document-kinds.js` matches each verified checklist so lender prep shows "you have 2 of 7 document types this needs".
- **Underwriter simulation** (`services/underwriter-sim.js`): per matched program, a review conversation held as *that program's* reviewer (Kiva story reviewer / CDFI cash-flow analyst / SBA-intermediary counselor / grants program officer), grounded in the file's specific cautions. Ends with prepared answers and a now/soon/later timing call.
- **Verified application profiles** (`services/lender-application-profiles.js`): dated, cited data on how each verified program actually intakes applications (six distinct models: online CDFI term loan, character-based crowdfunding, SBA-intermediary, group lending, referral network, grant panel). Discovered lenders are marked `verified: false`, never a fabricated checklist.
- **Shareable report** (`routes/share.js`): the owner mints a revocable link; anyone with it sees a read-only report (score, coaching summary, readiness breakdown, funding story, funding plan, matched programs with apply links), never the interview transcript, the documents, or any way to edit. For an advisor, a co-signer, or a business partner.
- **Application pack** (`services/application-pack.js`): assembles the Business Case + prepared answers into the exact blocks a program's process consumes.
- **Application tracker**: a status board per program (`/api/tracker`), auto-tracking a program once its pack is built, with passive stale-row nudges.
- **Advisor bridge**: routes complex cases to the free human advisors (SBDC, SCORE, the lender's own coaching) with a print/PDF of the report to bring.

### API

Every route requires a `Bearer` access token (`middleware/auth.js`) and is scoped to the calling user, except `POST /api/preview`, `GET /api/shared/:token`, and `GET /api/unsubscribe`, the public endpoints.

- `POST /api/preview`: no-account deterministic readiness estimate
- `POST /api/interview/start` · `POST /api/interview/:id/reply` · `GET /api/interview/:id/resume` · `POST /api/interview/:id/attachments`
- `POST /api/applications` · `GET /api/applications/:id`
- `POST /api/match/:id` · `GET /api/match/:id` · `POST /api/match/:id/simulate` · `POST /api/match/:id/recompute` · `GET /api/match/:id/improvement-plan` · `GET /api/match/:id/funding-plan`
- `GET|POST /api/business-case/:id` · `POST .../draft` · `.../message` · `.../regenerate` · `.../sync-check` · `GET|PUT .../projection` · `GET|POST .../plan`
- `GET /api/underwriter/:id/lenders` · `POST /api/underwriter/:id/:lenderKey/start` · `.../message` · `.../pack`
- `GET|POST /api/tracker/:id` · `DELETE /api/tracker/:id/:lenderKey`
- `GET|POST /api/documents/:id` · `GET .../:docId/url` · `DELETE .../:docId`
- `POST|GET|DELETE /api/applications/:id/share` (owner) · `GET /api/shared/:token` (public, read-only)
- `GET|PUT /api/me/prefs` · `POST /api/cron/reminders` (`x-cron-secret`)
- `GET /api/conversations` · `GET /api/conversations/:id`

### Notes for production

- **No preset list of programs, anywhere.** Every loan and grant a business sees is found by the per-application live search. The one hand-curated dataset that remains is `services/lender-application-profiles.js`: *not* a catalog to match against, but the verified "how does this program actually take an application" breakdown (Kiva's 15-day private fundraising, an SBA intermediary's training requirement, etc.) that enriches a discovered result when it's one of a handful of well-known programs. Everything else discovered gets a model guess marked `verified: false`.
- Auth is Google sign-in via Supabase; the datastore is Supabase Postgres. App tables added after launch are created idempotently on boot by `server/db/migrate.js` (with transient-error retries), so a deploy needs no manual SQL-editor step; `server/db/schema.sql` stays the canonical definition for a fresh project.
- No payments. External calls: Groq (interview structuring, coaching, business case, underwriter, improvement-plan polish, pack), OpenAI (interview web-search reasoning, per-application loan/grant discovery), and Resend (deadline-reminder emails). Everything degrades gracefully when a key is missing.
- Cost note: the per-application program discovery is a billed OpenAI web-search on every match/recompute (cached a day per profile). It's the deliberate cost of matching each person's specific case rather than shipping a shared list. The Results page's other billed calls are gated: the funding-story draft is opt-in, the two narrated plans are cached, and the underwriter sim / pack / what-if sim are user-initiated.

### Deploying (Render + Vercel)

The backend goes on Render, the frontend on Vercel.

**1. Backend → Render**

1. In the [Render dashboard](https://dashboard.render.com), click **New +** → **Blueprint**.
2. Connect this GitHub repo and pick `main`. Render reads `render.yaml` at the repo root automatically and configures the service.
3. Set the environment variables Render prompts for (from `render.yaml`): `GROQ_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` (Supabase Postgres connection string), `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS` (your Vercel URL + `http://localhost:5173`). They're stored only in Render's dashboard, never in the repo. Migrations run automatically on boot.
4. Deploy. Once live, copy the service URL Render gives you (something like `https://microfinance-matchmaker-api.onrender.com`); you'll need it for the frontend step.
5. Sanity-check it: `curl https://<your-render-url>/api/health` should return `{"ok":true}`.

Data lives in Supabase Postgres, so it persists across Render restarts. The free Render plan still cold-starts after inactivity, so the first request after a while is slow.

**2. Frontend → Vercel**

1. In the [Vercel dashboard](https://vercel.com/new), import this same GitHub repo.
2. Set **Root Directory** to `client` (Vercel auto-detects the Vite framework preset from there). `client/vercel.json` adds the SPA rewrite so a deep link like `/shared/:token` serves `index.html`.
3. Add an environment variable: `VITE_API_BASE_URL` = the Render URL from step 1 (no trailing slash), plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Vercel gives you a public `https://*.vercel.app` URL.

Set `APP_URL` on the Render service to your Vercel URL: it's the "open the app" link in reminder emails. For reminder emails to actually send, also set `RESEND_API_KEY` + `FROM_EMAIL` (a verified Resend sender). `CRON_SECRET` is generated by the blueprint and shared with the cron service automatically; the unsubscribe link uses Render's own `RENDER_EXTERNAL_URL`, so it needs no config.
