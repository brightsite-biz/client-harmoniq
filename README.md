# site-template

BrightSite starter. Every client site is created from this template as `client-<name>`. See `CLIENTS.md` for the new-client checklist.

Astro static site with an adaptive 3D signature figure, scroll motion, built-in QA tests, and Cloudflare Pages headers.

## Start a client site
1. Create a private repo `client-SHORTNAME` from this template.
2. Edit `src/data/client.json` (set `"template": false` when real content is in) and fill in `DESIGN.md`.
3. `npm install`, then `npm run dev`.

## Check it
```
npm run build
npm run qa:install   # once
npm run qa           # builds, serves, and tests at 390, 768 and 1440 px; screenshots in qa-screenshots/
QA_URL=https://your-preview.pages.dev npm run qa   # test a deployed preview
```
Real client repos must not set `QA_ALLOW_TEMPLATE`. With `"template": true` the placeholder check fails on purpose.

## Deploy (Cloudflare Pages)
Build command `npm run build`, output directory `dist`. Set `PUBLIC_PREVIEW=1` on preview builds so they are `noindex`. Contact form variables (set in Cloudflare, never in the repo): `TURNSTILE_SECRET`, `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`.

## 3D
See `docs/3d-pipeline.md`.
