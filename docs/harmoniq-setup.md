# Harmoniq: setup still needed

Nothing is deployed. These are the steps between this repo and a real preview link.

## Test deployment on Vercel (no domain)
Cameron wants to see the test through Vercel first, with no domain. `vercel.json` sets the security headers and `PUBLIC_PREVIEW=1` (so the site is `noindex`). Vercel's default protection keeps preview links behind a Vercel login. The form handler also runs on Vercel (`api/contact.js`) and says "not set up yet" until the variables below are added in the Vercel project.

## Cloudflare Pages (not set up yet, only needed when a real domain is chosen)
1. Create a Cloudflare account (or log in) and add a Pages project named `client-harmoniq`, connected to this repository.
2. Build command `npm run build`, output directory `dist`. Set `PUBLIC_PREVIEW=1` on preview builds so the site is `noindex`.
3. Update `url` in `src/data/client.json` to the real address. It is `https://client-harmoniq.pages.dev` as a stand-in.

## Installer request form (written, untested)
The form posts to `functions/api/contact.js`. Set these as environment variables in the Cloudflare project (never in the repo):

| Variable | Value |
|---|---|
| `CONTACT_TO` | `cameron.r.garner@gmail.com` (Cameron said this can change later) |
| `CONTACT_FROM` | a verified sender on Harmoniq's domain (needs a domain first) |
| `RESEND_API_KEY` | from a Resend account |
| `TURNSTILE_SECRET` | optional until the Turnstile widget is added to the page (the CSP in `public/_headers` must then allow `challenges.cloudflare.com`) |

Until these exist the form answers "not set up yet". Do a real test submission and confirm it arrives before anyone sees the link.

## Before launch
- Legal name and filing status, then the attorney's review of the Privacy Policy and Accessibility Statement.
- Logo vector files (SVG) from Cameron; the homeowner's permission for the installed photos is confirmed by Cameron (2026-10-24).
- A public contact address (the pages say requests go through the form).
- Cameron's answers in docs/copy-to-confirm.md.
- Real-device check of the 3D on a phone and a tablet. The tests ran with software rendering.
