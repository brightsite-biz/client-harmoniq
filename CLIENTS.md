# Client sites

One repository per client. Never put two clients in one repository.

## Naming

Repository: client-SHORTNAME (lowercase, hyphens), for example client-acme-electric.
Cloudflare Pages project: same name as the repository.
Local folder: BrightSite/clients/client-SHORTNAME

## Why one repository each

Separate access, separate preview links, and a client can be handed their own code without exposing anyone else.

## New client checklist

1. Click Use this template, then Create a new repository. Owner brightsite-biz, name client-SHORTNAME, Private.
2. Clone it into BrightSite/clients/.
3. Fill in docs/intake.md with the client's answers.
4. Write DESIGN.md for the client's brand.
5. Run the brightsite-builder skill. Stop for approval at the design direction and again at the preview.
6. Run `npm install`, then `npm run qa` until it is clean. In `src/data/client.json` set `"template": false`, and remove `QA_ALLOW_TEMPLATE` from `.github/workflows/qa.yml`.
7. Connect the repository to a new Cloudflare Pages project. Build command: `npm run build`. Output directory: `dist`. Set `PUBLIC_PREVIEW=1` on preview builds.
8. Send the preview link. Production goes live only after the client approves.
9. The client owns their domain and Search Console property. Add BrightSite as a user.

## Never

- Commit API keys, passwords or tokens.
- Invent reviews, ratings, testimonials or certifications.
- Deploy to production without client approval.
