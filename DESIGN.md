# DESIGN.md: Harmoniq

Status: first preview, waiting for Cameron's approval of the direction (he has not seen it yet).

## Brand
Harmoniq, "Where architecture and harmony meet." An acoustic frame for frame-style TVs. Pre-launch: no address, phone, email, reviews or social accounts are published. Logo bought by Cameron (gold mark and wordmark on ink); see ASSETS.md. Voice in three words: calm, precise, premium. Copy is short, states only what Cameron has confirmed, and never names another brand.

## Palette and type
| Token | Value | Use | Contrast |
|---|---|---|---|
| Ink | #171C22 | page background (from the logo) | text #EFEAE0 on ink 13.4:1 |
| Ink 2 / 3 | #1E252D / #28313B | layer view, form, inputs | muted #B9B4A9 on ink 8.1:1 |
| Gold | #D6BD94 | lines, prices, focus, buttons on dark (from the logo) | on ink 9.6:1; never behind small text |
| Stone | #E7E3DA | the builder section (from the fireplace stone) | ink text 12.6:1 |
| Walnut | #7A5A43 | accent on stone only (from the fireplace wall) | 4.8:1 on stone |

Type: **Marcellus** for headlines (a flared roman that echoes the logo's tagline) and **Jost** for body, navigation and the wordmark (geometric, close to the logo's wide sans). Both SIL Open Font License 1.1, self-hosted through the `@fontsource` packages (v5.3.0). No third-party font requests.

## Subject inventory (only Harmoniq has these)
1. Eight speakers, four in each side rail, hidden behind the face.
2. 100 percent linen face, in four named colors: Onyx, Basalt, Alabaster, Sandstone.
3. HDF frame with a finish in the same four names (any linen with any finish).
4. A fine gold inner trim around the screen.
5. A frame that replaces the soundbar for frame-style TVs.
6. Four sizes (65, 75, 85, 98 inch) with public "starting at" prices.
7. Sold and installed through installers; no checkout.
8. Real photos on a walnut-and-stone fireplace wall (hero, and the idea section).

## Signature interactive moments
1. **Layer view** ("Take it apart"): scroll pulls the frame into eight layers, front to back. Pick a layer (in the picture or the list) to dim the rest and read what it does. This is the only place the speakers are shown. Text alternative: the numbered list below the figure, which carries every description (visible without JavaScript), and a caption naming the layers.
2. **Builder**: 3D frame that sways slowly, can be dragged or turned with the arrow keys, and changes size, linen and finish live. It sits on a plain light wall with a soft shadow; there is no room scene (Cameron, Oct 24: keep the build on a generic white wall). Text alternative: the price and a written summary of the build.

## 3D plan
- Procedural three.js model built in `src/scripts/frame3d.js`: linen ring with a generated weave texture, finish ring, gold trim, HDF ring, eight drivers, damping layer, crossover board with wires, brackets. It is an illustration of the structure, not a CAD model. When Cameron has a CAD or 3D file, convert it with `npm run model:optimize` and load it as described in docs/3d-pipeline.md.
- Tiers: high (desktop), medium (tablet or narrower window), low (phones and weak devices: no environment lighting, no shadows, a 512 px weave texture). The viewer measures frame rate and steps down a tier if it is slow; below 15 fps on the lowest tier it falls back to the still image. Data saver, 2G and no WebGL show the still image.
- Phones: `data-phone3d="low"` on both figures (Cameron: exempt or limit on mobile). Set it to `off` to turn phone 3D off entirely.
- Reduced motion: 3D stays, but nothing moves by itself (no sway, no scroll-driven separation). The person can still drag, use the arrow keys, or use the slider.
- Stills: 16 renders of the real scene on the plain wall (`public/img/build/<linen>-<finish>.webp`, one per pair) for the builder; one render (`anatomy-poster-*.webp`) for the layer view.

## Motion plan
- Page load: hero photo settles from 106 to 100 percent over 3 s; hero text rises 18 px. Transform only, so text is never hidden. Reduced motion: none.
- Scroll: headings and photos fade up once (GSAP, fails open). Smooth scrolling (Lenis) only with a mouse.
- Layer view: scroll sets the separation (slider mirrors it). Using the slider takes over for 2.5 s.
- Builder: size change eases the frame's scale; colors change at once.

## Layout and components
- No cards, no icon rows, no numbered step markers. Hairline gold rules, generous space, near-square corners.
- Hero: real photo on the right two thirds, fading into ink; headline, one-line pitch and the starting price on the left. On phones the photo is on top and the text below.
- Sections: the idea (one statement and two photos), layer view (ink-2), builder (stone, the only light section so the cloth and finish colors read true), sizes and prices, installer request, footer.
- Header: mark and wordmark, Inside, Build, Sizes and an Installer button; phones keep Build and Installer.
- Not done on purpose: a store, a cart, reviews, testimonials, awards, installer map, a phone number.
