// Adaptive signature figure.
// Goals: great on desktop, lighter on tablets and phones, safe everywhere.
//  - three.js is loaded with a dynamic import, only after the page is idle and the figure is near the viewport.
//  - Tier is chosen from device signals, then lowered at runtime if the frame rate is poor.
//  - Falls back to the still poster for: reduced motion, data saver, no WebGL, lost context, very slow devices.
//  - The figure never carries information that is not also in the text caption.

export const TIERS = {
  high:   { dpr: 2,   segments: 420, radial: 12, particles: 1800, pulses: 7, antialias: true,  fpsFloor: 40 },
  medium: { dpr: 1.5, segments: 240, radial: 8,  particles: 800,  pulses: 5, antialias: true,  fpsFloor: 32 },
  low:    { dpr: 1,   segments: 120, radial: 6,  particles: 280,  pulses: 3, antialias: false, fpsFloor: 24 },
};
const ORDER = ['high', 'medium', 'low'];

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** Returns 'off' | 'low' | 'medium' | 'high'. mobile3d is "off" or "low" (per-site choice for phones). */
export function pickTier({ mobile3d = 'low' } = {}) {
  // Testing aid: ?tier=high|medium|low|off forces a tier (still falls back if WebGL is missing).
  const forced = new URLSearchParams(location.search).get('tier');
  if (['high', 'medium', 'low', 'off'].includes(forced)) return forced !== 'off' && !webglAvailable() ? 'off' : forced;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
  const conn = navigator.connection || {};
  if (conn.saveData || ['slow-2g', '2g'].includes(conn.effectiveType)) return 'off';
  if (!webglAvailable()) return 'off';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const phone = coarse && Math.min(innerWidth, innerHeight) < 600;
  if (phone) return mobile3d === 'off' ? 'off' : 'low';
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (mem <= 4 || cores <= 4) return 'low';
  if (coarse || innerWidth < 1100) return 'medium';
  return 'high';
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export async function initSignature(root) {
  const setState = (s) => { root.dataset.state = s; };
  const stage = root.querySelector('.stage') || root;
  const canvas = root.querySelector('canvas');
  const pauseBtn = root.querySelector('.pause');
  let tier = pickTier({ mobile3d: root.dataset.mobile3d });
  if (tier === 'off') return setState('static');

  let THREE;
  try { THREE = await import('three'); } catch { return setState('static'); }

  const cfg = () => TIERS[tier];
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: cfg().antialias, alpha: true, powerPreference: 'high-performance' });
  } catch { return setState('static'); }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.PointLight(0xffb347, 40, 30);
  key.position.set(3, 4, 5);
  scene.add(key);

  // A procedural cable path. Replace with the client's own subject (see DESIGN.md).
  const pts = [[-6, -1.2, 0], [-3, 1.4, 1.2], [0, -0.6, -0.8], [3, 1.6, 0.6], [6, -0.4, 0]]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);

  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff6b3d, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.6 });
  let tube = new THREE.Mesh(new THREE.TubeGeometry(curve, cfg().segments, 0.07, cfg().radial, false), tubeMat);
  scene.add(tube);

  const pulseGeo = new THREE.SphereGeometry(0.085, 12, 12);
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0 });
  const pulses = Array.from({ length: TIERS.high.pulses }, (_, i) => {
    const m = new THREE.Mesh(pulseGeo, pulseMat);
    m.userData.offset = i / TIERS.high.pulses;
    scene.add(m);
    return m;
  });

  const maxParticles = TIERS.high.particles;
  const pos = new Float32Array(maxParticles * 3);
  for (let i = 0; i < maxParticles; i++) {
    const p = curve.getPointAt(Math.random());
    pos[i * 3] = p.x + (Math.random() - 0.5) * 3;
    pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 3;
    pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 3;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // Optional real model (see docs/3d-pipeline.md). Skipped unless data attributes are set.
  const modelUrl = (tier === 'high' || tier === 'medium') ? root.dataset.modelDesktop : root.dataset.modelMobile;
  if (modelUrl) {
    try { scene.add(await loadModel(modelUrl)); } catch { /* keep the procedural scene */ }
  }

  function applyTier() {
    const c = cfg();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, c.dpr));
    points.geometry.setDrawRange(0, c.particles);
    pulses.forEach((m, i) => { m.visible = i < c.pulses; });
    const g = new THREE.TubeGeometry(curve, c.segments, 0.07, c.radial, false);
    tube.geometry.dispose();
    tube.geometry = g;
    resize();
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let pointerX = 0, pointerY = 0;
  const onPointer = (e) => {
    const r = stage.getBoundingClientRect();
    pointerX = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    pointerY = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
  };
  stage.addEventListener('pointermove', onPointer, { passive: true });

  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  applyTier();

  // Run only while visible, on-screen and not paused.
  let visible = true, userPaused = false, raf = 0, last = 0, frames = 0, acc = 0, settled = false;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '100px' });
  io.observe(stage);
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);

  function progress() {
    const r = stage.getBoundingClientRect();
    return clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? now - last : 16;
    last = now;

    // Measure ~90 frames after a short warm-up and step down if the device struggles.
    if (!settled) {
      frames++;
      if (frames > 20) acc += dt;
      if (frames === 110) {
        const fps = 1000 / (acc / 90);
        settled = true;
        if (fps < cfg().fpsFloor) stepDown(fps);
      }
    }

    const t = now / 1000;
    const p = progress();
    camera.position.set(-2 + p * 4 + pointerX * 0.6, 0.6 - pointerY * 0.4 + Math.sin(t * 0.3) * 0.15, 8 - p * 1.5);
    camera.lookAt(p * 2 - 1, 0, 0);
    pulses.forEach((m) => {
      if (!m.visible) return;
      m.position.copy(curve.getPointAt((t * 0.08 + m.userData.offset) % 1));
    });
    points.rotation.y = t * 0.02;
    renderer.render(scene, camera);
  }

  function stepDown(fps) {
    const i = ORDER.indexOf(tier);
    if (i < ORDER.length - 1) {
      tier = ORDER[i + 1];
      applyTier();
      frames = 0; acc = 0; settled = false;
    } else if (fps < 15) {
      destroy();
      setState('static');
    }
  }

  function sync() {
    const run = visible && !userPaused && !document.hidden;
    if (run && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function destroy() {
    cancelAnimationFrame(raf); raf = 0;
    io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    stage.removeEventListener('pointermove', onPointer);
    scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => m.dispose?.()); });
    renderer.dispose();
    renderer.forceContextLoss?.();
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); destroy(); setState('static'); });

  pauseBtn.hidden = false;
  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseBtn.textContent = userPaused ? 'Play' : 'Pause';
    setState(userPaused ? 'paused' : 'running');
    sync();
  });

  setState('running');
  root.dataset.tier = tier;
  sync();
}

async function loadModel(url) {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}
