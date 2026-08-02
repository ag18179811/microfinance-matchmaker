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

- **`/server`** — Node/Express API backed by SQLite. Deterministic, rules-based lender matching and readiness scoring (`services/matching-engine.js`, no LLM involved), a Groq-powered free-text extraction step (`services/groq-extract.js`) that turns a plain-English business description into structured fields, and a Groq-powered coaching layer (`services/groq-coach.js`) that only ever generates explanatory text — never eligibility decisions.
- **`/client`** — Minimal Vite + React app: a single "describe your business" box, a short dynamic follow-up form for whatever the description didn't cover, and a results page.

### How intake works

1. The user describes their business in one free-text box (`POST /api/intake/extract`).
2. Groq (JSON mode, temperature 0) extracts only what's explicitly or unambiguously stated — business name, industry (matched against a fixed list), city/state, time in business, revenue, requested amount, purpose. It's instructed to never guess a number, location, or industry it isn't confident about, and every field is re-validated server-side (industry must match the fixed enum, state is normalized against a real US-states table, dollar/month figures are coerced to numbers or dropped) so a bad or missing value always becomes `null` rather than a hallucinated guess.
3. The server deterministically diffs the extracted fields against the required set — the LLM never decides what's required — and returns only the genuinely missing fields.
4. The client renders a short form for just those fields (typically 0–3 questions if the description was reasonably complete), the user fills them in, and the combined data is submitted to the existing `POST /api/applications` → `POST /api/match/:id` pipeline unchanged.
5. If `GROQ_API_KEY` isn't set, extraction returns everything as `null` (no heuristic guessing) and the user is simply asked every question — the app degrades gracefully rather than fabricating data.

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

The SQLite database (`server/db/database.sqlite`) is created and auto-seeded with 18 placeholder CDFI/city-program lenders on first server start. To re-seed manually:

```bash
npm run seed
```

### Test the matching engine and extraction logic

The rules-based matching engine and the extraction coercion/validation logic are both unit-tested without needing a live API key (the Groq call is mocked in tests):

```bash
npm test
```

### API

- `POST /api/intake/extract` — `{ description, known? }` → extracts structured fields from free text, merges in any already-confirmed `known` answers, returns `{ fields, missingFields }`
- `POST /api/applications` — create a borrower application
- `GET /api/applications/:id` — fetch a stored application
- `POST /api/match/:applicationId` — run the matching engine + readiness scoring + Groq coaching, persist results, return the ranked match list
- `GET /api/match/:applicationId` — fetch previously computed match results

### Notes for production

- The seeded lender data in `server/db/seed-lenders.js` is **placeholder data** — replace it with real curated entries from the [CDFI Fund Awards Database](https://www.cdfifund.gov/programs-training/programs/cdfi-fund-awards) before launch.
- No auth, payments, or live external API integrations beyond Groq are implemented in this MVP pass.
- SQLite is the MVP datastore; swap for Postgres when moving beyond a single-instance deployment.
