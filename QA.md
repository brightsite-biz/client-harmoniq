# QA.md

Record every check. Never record a pass for something that was not run.

Preview under test: local build of commit-in-progress, served with `astro preview` (not yet deployed).

| Check | Tool | Pass rule | Result | Date |
|---|---|---|---|---|
| Test suite at 390, 768, 1440 px (title, one h1, alt text, heading order, axe serious/critical, sideways scroll, script errors, reduced motion, no-JS, no-WebGL, 3D start and pause, builder price, summary and matching still, layer picking, content rules) | `npm run qa` (Playwright 1.63, axe-core, SwiftShader WebGL) | all pass | 96 passed, 0 skipped, after the review fixes | 2026-10-24 |
| Only the four public starting prices appear; no banned wording (wood species, "solid wood", "acoustically hardened", TV brands, margin, dealer price) | `tests/qa.spec.ts` content rules | pass | pass | 2026-10-24 |
| Speakers appear only in the layer view | `tests/qa.spec.ts` (images) plus a manual look at every section | pass | pass for images and the 3D model, which hides the drivers behind the linen until pulled apart. | 2026-10-24 |
| Lighthouse mobile (simulated throttling, local server) | Lighthouse 12 CLI | a11y 100, performance 90+, best practices 95+, SEO 95+ | performance 97, accessibility 100, best practices 100, SEO 100. FCP 1.6 s, LCP 2.3 s, TBT 40 ms, CLS 0.013, 215 KiB before the 3D loads. Local server, so not a CDN measurement. | 2026-10-24 |
| A11y MCP `audit_webpage` | a11y MCP | zero violations | **not run** (preview is not public yet, so the tool on Cameron's computer cannot reach it) | |
| Lighthouse MCP (accessibility, performance, SEO, security audit) | Lighthouse MCP | targets above | **not run** (same reason). The CLI run above is a stand-in, not the MCP. | |
| `/seo technical` and `/seo schema` | claude-seo | no critical findings | **not run** (needs a public URL) | |
| Keyboard-only pass, 200 percent zoom, 320 px window, text-over-photo contrast, screen reader | manual | per builder skill | **not done** | |
| 3D on a real phone and tablet (frame rate, heat, load time) | manual | smooth, no jank | **not done**; tests ran with software rendering | |
| Real form submission arrives | manual | message received | **not run** (Cloudflare and Resend not set up) | |
| Header scan (Mozilla Observatory) | online scanner | A or better | **not run** (needs a public URL) | |
| Independent review by a fresh agent | separate agent, browser at 320 to 1440 px | no unresolved findings | Found 6 problems. Fixed: inside parts could show when the builder frame was turned side-on (inside parts are now removed from the builder scene and the turn is limited); layer list hidden behind the pinned picture at 200% zoom and on small phones (picture now pinned only on tall screens); hero text contrast between 1000 and 1440 px (dark panel under the text); size chips said "from" (now "starting at"); fallback picture was a tab stop with 3D wording (only focusable while 3D runs); unsupported "manual checks" claim removed. Also: TV size no longer forced to 65, form fields length-limited, whitespace names rejected. Not fixed: draft notes stay on Privacy and Accessibility on purpose (template text until an attorney reviews it). Not tested by the reviewer: Lighthouse, screen reader, real touch hardware, real form submission, true browser zoom, forced colors. | 2026-10-24 |
