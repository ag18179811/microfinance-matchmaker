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
