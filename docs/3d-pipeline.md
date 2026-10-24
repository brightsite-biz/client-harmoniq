# 3D pipeline: one scene, three weights

The aim: rich on desktop, lighter on tablets, small and fast on phones, never broken.

## What the template does at run time
1. **Waits.** three.js is a separate download, fetched only after the page has loaded, the browser is idle, and the figure is near the screen.
2. **Chooses a tier** from device signals (`pickTier` in `src/scripts/scene.js`):
   - `high`: desktop with a fine pointer and a wide window. Full detail, pixel ratio up to 2.
   - `medium`: tablets and small laptops. Pixel ratio up to 1.5, fewer particles and segments.
   - `low`: phones and weak devices (4 GB memory or less, 4 cores or fewer). Pixel ratio 1, few particles, simple geometry, no antialiasing.
   - `off`: reduced motion, data saver, slow connection, no WebGL. Shows the still poster only.
3. **Checks itself.** After about 110 frames it measures the frame rate. If it is under the tier's floor it steps down a tier. If a `low` device is still under 15 fps it stops 3D and shows the poster.
4. **Pauses** when scrolled off screen, when the tab is hidden, or when the visitor presses Pause.
5. **Phones can opt out.** Set `mobile3d="off"` on `<Signature />` for a site where phones should never run 3D.

## Using a real 3D model (compressed per device)
Put the original in `models/source/` (not deployed). Then:

```
npm run model:optimize -- models/source/thing.glb
```

This writes two files to `public/models/`:
- `thing.desktop.glb`: de-duplicated, meshopt-compressed, textures resized to 2048 and converted to WebP.
- `thing.mobile.glb`: the same, with the mesh simplified to about 35% of its triangles and textures at 1024.

Then pass them to the component: `<Signature modelDesktop="/models/thing.desktop.glb" modelMobile="/models/thing.mobile.glb" />`. Tablets and desktops get the first, phones get the second. If a model fails to load, the procedural scene keeps running.

Targets (house guidelines, not standards): phone model under about 500 KB, desktop model under about 2 MB, three.js chunk loaded after first paint, mobile Lighthouse performance 90 or higher.

## Other ways to give phones the effect cheaply
- A short pre-rendered loop (WebM and MP4, under about 1 MB, muted, no autoplay sound, with a pause control) instead of live 3D.
- A scroll-driven image sequence.
- A Lottie animation under 100 KB.

## Licenses
Every model, texture and HDRI goes in `ASSETS.md` with its license. Do not use a model without one.
