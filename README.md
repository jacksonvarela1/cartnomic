# CartNomic app

Know what your cart is worth. CartNomic answers one question: is another stop worth the savings for
the groceries you actually want?

A University of Arkansas SEVI 39303 class prototype. React 19 + TypeScript + Vite, no backend, no
accounts, no API keys. Everything runs in the browser and saves to that browser only.

Built from a specification packet that is kept outside this repository, because it contains classroom
material and interview responses that are not ours to publish.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints, normally http://localhost:5173.

Other commands:

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

```bash
npm run preview
```

`npm run preview` serves the production build on http://localhost:4173. That is the version to use
for a class demo, because it does not depend on the dev server staying healthy.

Requires Node 20.19+ or 22.12+. Verified on Node 24.16.0 with npm 11.13.0.

## What is in here

| Path | What it holds |
|---|---|
| `src/domain/` | Pure logic with no React: money, units, price eligibility, the comparison engine, CPI math, diet rules, CSV import and export |
| `src/state/store.tsx` | Guest state, local persistence, derived comparison |
| `src/routes/` | Basket, Compare, Preferences, Trends, Plan, Sources |
| `src/components/` | Shell, logo, shared UI |
| `src/data/` | Copies of the packet's public data and the fictional fixture |
| `src/tests/` | 59 Vitest cases, named after the numbered acceptance checks in the project specification |

The engine never imports React, so every rule can be tested without a browser.

## The 70 second demo path

1. Open the app. It lands on **Basket** with the fictional 12 item sample basket already loaded and
   a visible demo notice. Say out loud that the store prices are fictional and the inflation data is real.
2. Point at one locked row, for example the Diet Coke line. Exact product locked means no substitution.
3. Click **Compare my basket**. Read the decision: stay at one store, because net cash savings of
   $3.30 is below the $10.00 minimum. Sample Store B shows a **known item subtotal**, not a total,
   because one item has no price.
4. Change **Minimum net savings** to `2.00`. The recommendation flips live to "The extra stop meets
   your threshold" and the split plan becomes Recommended. No price changed. Only the shopper's rule did.
5. Open **How we calculated this** for the equations and the full item by item table.
6. Go to **Trends**. Show the real food at home index through August 2026, the gap at October 2025
   that is left as a gap, and the category chart at +2.2% for food at home.
7. Go to **Plan**. Show the store by store checklist that survives a refresh.

## Free deployment

The build is a static folder with relative asset paths and hash routing, so any static host works and
no server side rewrite rule is needed.

```bash
npm run build
```

This repository already deploys itself: `.github/workflows/deploy.yml` runs typecheck, tests and the
build on every push to `main`, then publishes `dist` to GitHub Pages. Other free options:

- Netlify Drop: drag the `dist` folder onto https://app.netlify.com/drop
- Netlify or Vercel from the repo: build command `npm run build`, publish directory `dist`
- Cloudflare Pages: connect the repo, build command `npm run build`, output directory `dist`

Every one of these has a free tier. No API key, database or paid resource is involved, so there is
nothing to configure and nothing to leak.

## Data honesty rules that are enforced in code, not just in copy

- A missing price is `null`. It is never treated as zero, and a store missing an item can never win.
- The baseline is the cheapest **complete** one store plan, named on screen. Not the priciest store.
- Fixtures use an explicit comparison clock, so they do not silently expire with the wall clock.
- CPI months that are missing in the source stay missing. October 2025 renders as a gap.
- The latest CPI period comes from the last value present in the data, not from today's date.
- Diet verdicts are `match`, `does_not_match` or `unknown`, always with a rule version and evidence.
  Unknown never becomes a green check, and milk yogurt is never dairy free.
- Money is integer cents with a documented half up rounding rule.
- Demo prices and your own imported observations are separate modes that never merge.

## What this app does not do

No payments, no retailer scraping, no live price feeds, no receipt scanning, no routing service, no
authentication, no runtime language model, no Supabase connection. The comparison, the diet rules and
the charts are all deterministic local computation.
