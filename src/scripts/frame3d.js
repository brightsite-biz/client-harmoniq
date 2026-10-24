// Procedural Harmoniq frame, built from simple three.js geometry (no model file needed).
// The same model serves both views:
//   - builder: the closed frame (linen face + frame finish + gold trim + TV glass). No speakers are built into
//     the visible surfaces, and the inner parts are hidden behind the linen and finish.
//   - anatomy: the same parts pulled apart front to back (the ONLY place the drivers are shown).
// Units: TV opening is 1.6 wide by 0.9 tall. Depth is z, toward the camera.
//
// Honest-scale note: this is an illustration of the product's structure, not a CAD model. Replace it with the
// real model when one exists (see docs/3d-pipeline.md).

export const FRAME_PARTS = ['linen', 'trim', 'moulding', 'drivers', 'hdf', 'damping', 'crossover', 'brackets'];

const TV_W = 1.6, TV_H = 0.9, BORDER = 0.22;
const OW = TV_W + BORDER * 2, OH = TV_H + BORDER * 2;

// How far each part travels along z when fully exploded (positive is toward the viewer).
const EXPLODE = { linen: 0.95, trim: 1.2, moulding: 0.38, drivers: 0.0, hdf: -0.36, damping: -0.62, crossover: -0.86, brackets: -1.12 };

// Frame size shown in the viewer (relative display scale, so the bigger frames read as bigger without clipping).
const SIZE_SCALE = { 65: 0.84, 75: 0.91, 85: 0.97, 98: 1.04 };

function rectPath(THREE, w, h, hole) {
  const p = hole ? new THREE.Path() : new THREE.Shape();
  const x = w / 2, y = h / 2;
  if (hole) { p.moveTo(-x, -y); p.lineTo(-x, y); p.lineTo(x, y); p.lineTo(x, -y); p.lineTo(-x, -y); }
  else { p.moveTo(-x, -y); p.lineTo(x, -y); p.lineTo(x, y); p.lineTo(-x, y); p.lineTo(-x, -y); }
  return p;
}

function ring(THREE, ow, oh, iw, ih, depth, bevel = 0) {
  const s = rectPath(THREE, ow - bevel * 2, oh - bevel * 2, false);
  s.holes.push(rectPath(THREE, iw + bevel * 2, ih + bevel * 2, true));
  const g = new THREE.ExtrudeGeometry(s, bevel
    ? { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 }
    : { depth, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Linen weave, drawn once on a canvas. Grayscale, so the material colour tints it.
function linenTexture(THREE, size, renderer) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const period = size / 64;           // 64 threads across the tile
  const rowNoise = new Float32Array(size), colNoise = new Float32Array(size);
  // Slubs: slow random variation along each thread, which is what makes linen look like linen.
  let a = 0.5, b = 0.5;
  for (let i = 0; i < size; i++) {
    a += (Math.random() - 0.5) * 0.12; b += (Math.random() - 0.5) * 0.12;
    a = Math.min(1, Math.max(0, a)); b = Math.min(1, Math.max(0, b));
    rowNoise[i] = a; colNoise[i] = b;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / period), cy = Math.floor(y / period);
      const over = (cx + cy) & 1;                             // plain weave: over, under
      const fx = (x % period) / period, fy = (y % period) / period;
      const thread = over ? Math.sin(Math.PI * fy) : Math.sin(Math.PI * fx);
      const slub = over ? rowNoise[y] : colNoise[x];
      let v = 0.62 + 0.3 * thread + 0.12 * (slub - 0.5);
      v += (Math.random() - 0.5) * 0.05;
      v = Math.min(1, Math.max(0, v));
      const k = (y * size + x) * 4, g = Math.round(v * 255);
      img.data[k] = img.data[k + 1] = img.data[k + 2] = g; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

export function buildFrame(THREE, renderer, cfg) {
  const root = new THREE.Group();          // gets rotated and scaled
  const frame = new THREE.Group();
  root.add(frame);

  const parts = {};
  const mats = [];                          // every material we may dim or highlight
  const track = (m, part) => { m.userData.part = part; mats.push(m); return m; };
  const make = (name) => { const g = new THREE.Group(); g.name = name; g.userData.part = name; frame.add(g); parts[name] = g; return g; };
  const mesh = (g, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.userData.part = g.name;
    m.castShadow = !!cfg.shadows; g.add(m); return m;
  };

  // ---- Materials ---------------------------------------------------------------------------
  const tex = linenTexture(THREE, cfg.tex, renderer);
  const Linen = cfg.sheen ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const linenMat = track(new Linen({ color: 0x777777, map: tex, bumpMap: tex, bumpScale: 1.4, roughness: 0.96, metalness: 0,
    ...(cfg.sheen ? { sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffffff) } : {}) }), 'linen');
  const finishMat = track(new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.42, metalness: 0.0 }), 'moulding');
  const goldMat = track(new THREE.MeshStandardMaterial({ color: 0xd6bd94, roughness: 0.28, metalness: cfg.env ? 1 : 0.55, emissive: 0x2a2012, emissiveIntensity: cfg.env ? 0 : 0.5 }), 'trim');
  const hdfMat = track(new THREE.MeshStandardMaterial({ color: 0x8c6b4c, roughness: 0.85, metalness: 0 }), 'hdf');
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.85 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.8, metalness: 0 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.35, metalness: 0.9 });
  const foamMat = track(new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 1, metalness: 0 }), 'damping');
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x23302b, roughness: 0.6, metalness: 0.1 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xd6bd94, roughness: 0.4, metalness: 1 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7 });
  const steelMat = track(new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.9 }), 'brackets');
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.14, metalness: 0, clearcoat: cfg.sheen ? 1 : 0, clearcoatRoughness: 0.12 });
  [darkMetal, coneMat, rubberMat, capMat].forEach((m) => track(m, 'drivers'));
  [boardMat, padMat, wireMat].forEach((m) => track(m, 'crossover'));

  // ---- Linen face ----------------------------------------------------------------------------
  const linen = make('linen');
  const linenInnerW = TV_W + 0.05, linenInnerH = TV_H + 0.05;
  mesh(linen, ring(THREE, OW - 0.12, OH - 0.12, linenInnerW, linenInnerH, 0.012, 0.01), linenMat, 0, 0, 0.056);

  // ---- Gold inner trim -----------------------------------------------------------------------
  const trim = make('trim');
  mesh(trim, ring(THREE, TV_W + 0.052, TV_H + 0.052, TV_W + 0.012, TV_H + 0.012, 0.03), goldMat, 0, 0, 0.056);

  // ---- Outer frame finish --------------------------------------------------------------------
  const moulding = make('moulding');
  mesh(moulding, ring(THREE, OW, OH, OW - 0.15, OH - 0.15, 0.14, 0.006), finishMat, 0, 0, 0);

  // ---- HDF structure -------------------------------------------------------------------------
  const hdf = make('hdf');
  mesh(hdf, ring(THREE, OW - 0.13, OH - 0.13, TV_W + 0.02, TV_H + 0.02, 0.05), hdfMat, 0, 0, -0.045);

  // ---- Drivers: 4 per side rail, 8 in all. Shown only when pulled apart. ---------------------
  const drivers = make('drivers');
  const railX = (TV_W / 2 + 0.05 + (OW / 2 - 0.07)) / 2;
  const driverY = [-0.5, -0.2, 0.2, 0.5];
  const radial = cfg.radial;
  const coneGeo = new THREE.LatheGeometry([[0.0, -0.022], [0.018, -0.022], [0.052, 0.004], [0.06, 0.004]].map(([x, y]) => new THREE.Vector2(x, y)), radial * 2);
  coneGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(0.066, 0.009, 8, radial * 3);
  const capGeo = new THREE.SphereGeometry(0.024, radial * 2, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  capGeo.rotateX(Math.PI / 2);
  const basketGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.03, radial * 3, 1, true);
  basketGeo.rotateX(Math.PI / 2);
  const driverPos = [];
  for (const side of [-1, 1]) for (const y of driverY) {
    const g = new THREE.Group(); g.position.set(side * railX, y, 0); g.scale.setScalar(0.86);
    for (const [geo, mat, z] of [[coneGeo, coneMat, 0.0], [rimGeo, rubberMat, 0.006], [capGeo, capMat, -0.006], [basketGeo, darkMetal, -0.012]]) {
      const m = new THREE.Mesh(geo, mat); m.position.z = z; m.userData.part = 'drivers'; m.castShadow = false; g.add(m);
    }
    drivers.add(g); driverPos.push([side * railX, y]);
  }

  // ---- Damping layer ---------------------------------------------------------------------------
  const damping = make('damping');
  mesh(damping, ring(THREE, OW - 0.14, OH - 0.14, TV_W + 0.06, TV_H + 0.06, 0.035), foamMat, 0, 0, -0.092);

  // ---- Crossover and wiring bay -------------------------------------------------------------------
  const crossover = make('crossover');
  const bz = -0.125;
  mesh(crossover, new THREE.BoxGeometry(0.5, 0.1, 0.012), boardMat, 0, OH / 2 - 0.115, bz);
  for (let i = 0; i < 9; i++) mesh(crossover, new THREE.BoxGeometry(0.03, 0.018, 0.006), padMat, -0.2 + i * 0.05, OH / 2 - 0.115 + (i % 2 ? 0.02 : -0.02), bz + 0.008);
  const wireR = cfg.radial > 6 ? 0.0035 : 0.0045;
  driverPos.forEach(([x, y], i) => {
    const sx = (i < 4 ? -1 : 1) * (0.06 + (i % 4) * 0.045);
    const start = new THREE.Vector3(sx, OH / 2 - 0.115, bz);
    const mid = new THREE.Vector3(x * 0.8, (OH / 2 - 0.115 + y) / 2, bz - 0.01 - (i % 4) * 0.004);
    const end = new THREE.Vector3(x, y, bz + 0.005);
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    mesh(crossover, new THREE.TubeGeometry(curve, 10, wireR, 4, false), wireMat);
  });

  // ---- Mounting brackets --------------------------------------------------------------------------
  const brackets = make('brackets');
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx * 0.62, y = sy * (OH / 2 - 0.11);
    mesh(brackets, new THREE.BoxGeometry(0.16, 0.05, 0.012), steelMat, x, y, -0.15);
    mesh(brackets, new THREE.BoxGeometry(0.05, 0.05, 0.05), steelMat, x, y, -0.172);
  }

  // ---- The TV (not part of Harmoniq): dark glass, kept in place ------------------------------------
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(TV_W + 0.08, TV_H + 0.08), glassMat);
  tv.position.z = 0.012; tv.name = 'tv'; tv.userData.part = null;
  root.add(tv);
  const tvBody = new THREE.Mesh(new THREE.BoxGeometry(TV_W + 0.08, TV_H + 0.08, 0.04), new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.6 }));
  tvBody.position.z = -0.012; root.add(tvBody);

  // ---- Wall shadow catcher (only where shadows are on) -----------------------------------------------
  let wall = null;
  if (cfg.shadows) {
    wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.ShadowMaterial({ opacity: 0.28 }));
    wall.position.z = -0.35; wall.receiveShadow = true; root.add(wall);
  }

  // ---- Controls -------------------------------------------------------------------------------------------
  const state = { explode: 0, size: 65, scale: SIZE_SCALE[65], selected: null };
  const targetScale = { v: SIZE_SCALE[65] };

  const api = {
    root, parts, tv, wall,
    setCloth(hex) {
      linenMat.color.set(hex);
      if (linenMat.sheenColor) { linenMat.sheenColor.copy(linenMat.color).lerp(new THREE.Color(0xffffff), 0.3); linenMat.sheen = 0.55; }
    },
    setFinish(hex) { finishMat.color.set(hex); },
    setSize(inches) { state.size = inches; targetScale.v = SIZE_SCALE[inches] || SIZE_SCALE[65]; },
    setExplode(t) {
      state.explode = t;
      for (const [name, g] of Object.entries(parts)) g.position.z = EXPLODE[name] * t;
      // Hide the front-layer parts from the TV's ghost so the layers read clearly when pulled apart.
      tvBody.visible = t < 0.04; tv.visible = t < 0.04;
    },
    select(name) {
      state.selected = name;
      for (const m of mats) {
        const on = !name || m.userData.part === name;
        m.transparent = !!name && !on;
        m.opacity = !name || on ? 1 : 0.14;
        m.depthWrite = !name || on;
        if (m.emissive && m.userData.part !== 'trim') {
          m.emissive.set(name && on ? 0x3a2c14 : 0x000000);
          m.emissiveIntensity = name && on ? 1 : 0;
        }
        m.needsUpdate = true;
      }
      // Bring the chosen part forward a little so it is easy to read, and enlarge the small drivers.
      drivers.children.forEach((g) => g.scale.setScalar(name === 'drivers' ? 1.45 : 0.86));
    },
    update(dt) {
      state.scale += (targetScale.v - state.scale) * Math.min(1, dt * 6);
      root.scale.setScalar(state.scale);
    },
    pickables() { return Object.values(parts).filter((g) => g.visible); },
    dispose() {
      root.traverse((o) => { o.geometry?.dispose?.(); });
      mats.forEach((m) => m.dispose?.());
      tex.dispose();
    },
    sizeScale: SIZE_SCALE,
  };
  api.setExplode(0);
  return api;
}
