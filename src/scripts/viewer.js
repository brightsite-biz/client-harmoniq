// Adaptive 3D viewer for the Harmoniq frame. Used by the builder and the anatomy view.
// Goals: great on desktop, lighter on tablets and phones, safe everywhere.
//  - three.js loads by dynamic import, only after the page is idle and the figure is near the viewport.
//  - The tier is chosen from device signals, then lowered at run time if the frame rate is poor.
//  - Falls back to the still image for: data saver, no WebGL, a lost context, very slow devices.
//  - Reduced motion keeps the 3D but turns off every automatic movement (no sway, no scroll-driven motion);
//    the person can still drag, use the arrow keys, or use the slider.
//  - Nothing here is the only way to learn something: the text next to each figure carries the same information.

import { buildFrame } from './frame3d.js';

export const TIERS = {
  high:   { dpr: 2,   tex: 1024, radial: 12, shadows: true,  env: true,  sheen: true,  antialias: true,  fpsFloor: 40 },
  medium: { dpr: 1.5, tex: 1024, radial: 8,  shadows: true,  env: true,  sheen: false, antialias: true,  fpsFloor: 32 },
  low:    { dpr: 1.25, tex: 512, radial: 6,  shadows: false, env: false, sheen: false, antialias: true,  fpsFloor: 24 },
};
const ORDER = ['high', 'medium', 'low'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** Returns 'off' | 'low' | 'medium' | 'high'. `phone3d` is "off" or "low" (the per-site choice for phones). */
export function pickTier({ phone3d = 'low' } = {}) {
  // Testing aid: ?tier=high|medium|low|off forces a tier (still falls back if WebGL is missing).
  const forced = new URLSearchParams(location.search).get('tier');
  if (['high', 'medium', 'low', 'off'].includes(forced)) return forced !== 'off' && !webglAvailable() ? 'off' : forced;
  const conn = navigator.connection || {};
  if (conn.saveData || ['slow-2g', '2g'].includes(conn.effectiveType)) return 'off';
  if (!webglAvailable()) return 'off';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const phone = coarse && Math.min(innerWidth, innerHeight) < 600;
  if (phone) return phone3d === 'off' ? 'off' : 'low';
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (mem <= 4 || cores <= 4) return 'low';
  if (coarse || innerWidth < 1100) return 'medium';
  return 'high';
}

/**
 * Mounts a viewer into `root` (a figure with .stage, canvas, optional .pause). Returns a controller whose
 * methods can be called before three.js has loaded; the latest wishes are applied once it is ready.
 *   mode "builder": slow sway, closed frame.   mode "anatomy": parts pull apart, parts can be picked.
 */
export function mountViewer(root, { mode = 'builder', onPick, onState } = {}) {
  const want = { cloth: '#2a2d31', finish: '#1b1d20', size: 65, explode: 0, selected: null, yaw: 0, pitch: 0 };
  let inst = null;
  const ctl = {
    ready: false,
    set(patch) { Object.assign(want, patch); inst?.apply(); },
    nudge(dyaw, dpitch = 0) { want.yaw += dyaw; want.pitch = clamp(want.pitch + dpitch, -0.45, 0.45); },
    destroy() { inst?.destroy(); },
  };

  const setState = (s) => {
    root.dataset.state = s;
    // The picture only becomes a focusable, labelled control while the 3D view is actually running.
    const st = root.querySelector('.stage');
    if (st) {
      if (s === 'running' || s === 'paused') { st.tabIndex = 0; st.setAttribute('role', 'group'); if (st.dataset.label) st.setAttribute('aria-label', st.dataset.label); }
      else { st.removeAttribute('tabindex'); st.removeAttribute('role'); st.removeAttribute('aria-label'); }
    }
    onState?.(s);
  };
  const still = new URLSearchParams(location.search).has('still');
  const calm = prefersReducedMotion() || still;
  root.dataset.calm = calm ? 'true' : 'false';

  startWhenNear(root, async () => {
    const stage = root.querySelector('.stage') || root;
    const canvas = root.querySelector('canvas');
    const pauseBtn = root.querySelector('.pause');
    let tier = pickTier({ phone3d: root.dataset.phone3d });
    if (tier === 'off') return setState('static');

    let THREE, RoomEnvironment;
    try {
      THREE = await import('three');
      if (TIERS[tier].env) RoomEnvironment = (await import('three/examples/jsm/environments/RoomEnvironment.js')).RoomEnvironment;
    } catch { return setState('static'); }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: TIERS[tier].antialias, alpha: true, powerPreference: 'high-performance' });
    } catch { return setState('static'); }
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 50);
    const lights = new THREE.Group(); scene.add(lights);
    let model = null, pmrem = null, envTex = null;

    function buildLights() {
      lights.clear();
      const c = TIERS[tier];
      if (c.env && RoomEnvironment) {
        pmrem = pmrem || new THREE.PMREMGenerator(renderer);
        envTex = envTex || pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;
        scene.environmentIntensity = 0.62;
        lights.add(new THREE.HemisphereLight(0xffffff, 0x888888, 0.15));
      } else {
        scene.environment = null;
        lights.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 2.1));
      }
      const key = new THREE.DirectionalLight(0xfff0dc, c.env ? 2.2 : 2.6);
      key.position.set(-2.6, 3.2, 4.2);
      if (c.shadows) {
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        const s = key.shadow.camera; s.left = -3.2; s.right = 3.2; s.top = 3.2; s.bottom = -3.2; s.near = 1; s.far = 14;
        key.shadow.bias = -0.0004; key.shadow.radius = 5;
      }
      lights.add(key);
      const rim = new THREE.DirectionalLight(0xd6bd94, 0.9);
      rim.position.set(3.5, 1.2, -2.5);
      lights.add(rim);
      renderer.shadowMap.enabled = !!c.shadows;
      renderer.shadowMap.type = THREE.PCFShadowMap;
    }

    function rebuild() {
      if (model) { scene.remove(model.root); model.dispose(); }
      model = buildFrame(THREE, renderer, TIERS[tier]);
      if (model.wall) model.wall.visible = mode === 'builder';
      // The builder shows the closed frame only: the inside parts are not even in the scene, so no angle can reveal them.
      if (mode === 'builder') for (const n of ['drivers', 'damping', 'crossover', 'brackets']) if (model.parts[n]) model.parts[n].visible = false;
      scene.add(model.root);
      buildLights();
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr));
      resize();
      apply();
    }

    const sm = { explode: 0, yaw: 0, pitch: 0 };       // smoothed values
    function apply() {
      if (!model) return;
      model.setCloth(want.cloth); model.setFinish(want.finish); model.setSize(want.size);
      if (still) sm.explode = want.explode;
      model.select(want.selected);
    }

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    // ---- Interaction: drag to turn, arrow keys, click to pick (anatomy) ------------------------------
    let dragging = false, moved = 0, lastX = 0, lastY = 0;
    stage.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
      stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        ctl.nudge(dx * 0.006, dy * 0.0035);
      } else if (mode === 'anatomy' && e.pointerType === 'mouse') {
        stage.style.cursor = pick(e) ? 'pointer' : 'grab';
      }
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      if (mode === 'anatomy' && moved < 6) { const p = pick(e); if (p) onPick?.(p); }
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', () => { dragging = false; });
    stage.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
      if (k) { e.preventDefault(); ctl.nudge(k[0], k[1]); }
    });

    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(e) {
      if (!model) return null;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObject(model.root, true).filter((h) => h.object.userData.part);
      return hits.length ? hits[0].object.userData.part : null;
    }

    // ---- Run only while visible, on screen and not paused ---------------------------------------------
    let visible = true, userPaused = false, swayT = 0, raf = 0, last = 0, frames = 0, acc = 0, settled = false, drawn = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '100px' });
    io.observe(stage);
    const onVis = () => sync();
    document.addEventListener('visibilitychange', onVis);

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dtms = last ? now - last : 16; last = now;
      const dt = Math.min(0.05, dtms / 1000);

      if (!settled && !still) {
        frames++;
        if (frames > 20) acc += dtms;
        if (frames === 110) {
          const fps = 1000 / (acc / 90);
          settled = true;
          if (fps < TIERS[tier].fpsFloor) stepDown(fps);
        }
      }

      const ease = still ? 1 : Math.min(1, dt * 7);
      sm.explode += (want.explode - sm.explode) * ease;
      sm.yaw += (want.yaw - sm.yaw) * ease;
      sm.pitch += (want.pitch - sm.pitch) * ease;
      model.setExplode(sm.explode);
      model.update(dt);

      // Orientation. Builder: slow sway. Anatomy: turn to three-quarter view as the layers come apart.
      if (!calm && !userPaused) swayT += dt;
      const sway = calm ? 0 : Math.sin(swayT * 0.42) * 0.5;
      const yaw = mode === 'anatomy' ? lerp(-0.08, -0.46, sm.explode) + sm.yaw : clamp((calm ? -0.22 : sway) + sm.yaw, -0.95, 0.95);
      const pitch = mode === 'anatomy' ? lerp(0.02, 0.13, sm.explode) + sm.pitch : 0.04 + sm.pitch;
      model.root.rotation.set(pitch, yaw, 0);

      // Fit the frame to the stage for any shape (wide desktop, tall phone).
      const aspect = camera.aspect, fov = camera.fov * Math.PI / 180;
      const span = mode === 'anatomy' ? (aspect < 1 ? 2.35 : 2.75) : (aspect < 1 ? 1.95 : 2.4);             // world width we want in view
      const dist = Math.max(span / (2 * Math.tan(fov / 2) * Math.min(aspect, 1.9)), 3.4);
      camera.position.set(mode === 'anatomy' ? lerp(0, 0.2, sm.explode) : 0, 0.05, dist);
      camera.lookAt(0, 0, mode === 'anatomy' ? lerp(0, -0.05, sm.explode) : 0);

      renderer.render(scene, camera);
      if (++drawn === 3) { root.dataset.ready = '1'; ctl.ready = true; }
    }

    function stepDown(fps) {
      const i = ORDER.indexOf(tier);
      if (i < ORDER.length - 1) {
        tier = ORDER[i + 1];
        root.dataset.tier = tier;
        envTex = null;
        rebuild();
        frames = 0; acc = 0; settled = false;
      } else if (fps < 15) {
        destroy();
        setState('static');
      }
    }

    function sync() {
      const run = visible && !document.hidden;
      if (run && !raf) { last = 0; raf = requestAnimationFrame(frame); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function destroy() {
      cancelAnimationFrame(raf); raf = 0;
      io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      model?.dispose();
      envTex?.dispose?.(); pmrem?.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
    }
    ctl.destroy = destroy;

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); destroy(); setState('static'); });

    if (pauseBtn && !calm) {
      pauseBtn.hidden = false;
      pauseBtn.addEventListener('click', () => {
        userPaused = !userPaused;
        pauseBtn.setAttribute('aria-pressed', String(userPaused));
        pauseBtn.textContent = userPaused ? 'Resume rotation' : 'Pause rotation';
        setState(userPaused ? 'paused' : 'running');
      });
    }

    inst = { apply, destroy };
    rebuild();
    root.dataset.tier = tier;
    setState('running');
    sync();
  });

  return ctl;
}

/** Calls `start` once, when the element is near the viewport and the page is idle. */
export function startWhenNear(el, start, margin = '300px') {
  let started = false;
  const go = () => {
    if (started) return; started = true;
    const run = () => start();
    'requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 2500 }) : setTimeout(run, 400);
  };
  const arm = () => {
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: margin });
    io.observe(el);
  };
  document.readyState === 'complete' ? arm() : addEventListener('load', arm, { once: true });
}
