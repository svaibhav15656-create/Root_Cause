/* RootCause hero snake: black segmented 3D snake that coils in the hero's right column. */
(function () {
  if (!window.THREE) return;
  const canvas = document.getElementById('snake-canvas');
  const anchor = document.querySelector('.snake-art');
  if (!canvas || !anchor) return;

  // ===== CONFIG (edit these) =====
  const ROAM  = false;  // false = coil inside the right column, true = roam the whole screen
  const SPEED = 1.1;    // units per second
  const TURN  = 2.2;    // max turn rate (radians per second); higher = tighter coils
  const D     = 0.3;    // body size (thickness and length scale together)
  const PAIRS = 15;     // plate+ring pairs (length)
  const DUST  = true;   // sparkle dust around the snake
  // ===============================

  const T = THREE, V3 = T.Vector3;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new T.Scene();
  const CAMZ = 14, FOV = 40;
  const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMZ);

  // Studio reflections for the glossy look
  const env = new T.Scene();
  env.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x0a0b10, side: T.BackSide })));
  [[12,4,-8,10,6,0xffffff,6],[3,14,12,2,4,0xaac4ff,4],[14,2,0,-10,5,0xffffff,2],[6,6,0,6,-12,0xffffff,3]].forEach(a => {
    const m = new T.Mesh(new T.PlaneGeometry(a[0], a[1]), new T.MeshBasicMaterial({ color: new T.Color(a[5]).multiplyScalar(a[6]), side: T.DoubleSide }));
    m.position.set(a[2], a[3], a[4]); m.lookAt(0, 0, 0); env.add(m);
  });
  scene.environment = new T.PMREMGenerator(renderer).fromScene(env, 0.02).texture;
  scene.add(new T.AmbientLight(0x7c879f, 0.34));
  const key = new T.DirectionalLight(0xffffff, 1.05); key.position.set(-4, 6, 8); scene.add(key);
  const rim = new T.DirectionalLight(0xaebfff, 1.25); rim.position.set(5, 3, 5); scene.add(rim);
  const fill = new T.DirectionalLight(0xffffff, 0.52); fill.position.set(-5, -3, 4); scene.add(fill);

  // Scale texture for the grey rings
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#1c1d20'; g.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 16; r++) for (let q = 0; q < 16; q++) {
    const v = 40 + Math.random() * 60 | 0, x = q * 8 + (r % 2 ? 4 : 0), y = r * 8;
    g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 4) + ')';
    g.beginPath(); g.moveTo(x + 4, y + 1); g.lineTo(x + 7, y + 4); g.lineTo(x + 4, y + 7); g.lineTo(x + 1, y + 4); g.fill();
  }
  const tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(4, 1); tex.anisotropy = 4; tex.encoding = T.sRGBEncoding;
  const plateMat = new T.MeshPhysicalMaterial({ color: 0x040405, metalness: .2, roughness: .14, clearcoat: 1, clearcoatRoughness: .05, flatShading: true, envMapIntensity: 1.5 });
  const ringMat = new T.MeshStandardMaterial({ color: 0xbbbbbb, map: tex, bumpMap: tex, bumpScale: 2, roughness: .45, metalness: .6 });
  const headMat = new T.MeshPhysicalMaterial({ color: 0x030304, metalness: .3, roughness: .1, clearcoat: 1, flatShading: true, envMapIntensity: 1.6 });

  // Body: alternating glossy plates and textured rings, tapering to the tail
  const taper = t => 1 - 0.72 * Math.pow(t, 1.3);
  const units = []; let off = 0.6;
  for (let k = 0; k < PAIRS * 2; k++) {
    const plate = k % 2 === 0, s = taper(k / (PAIRS * 2));
    const r = D * s * (plate ? .8 : .72), len = D * s * (plate ? 2.2 : .95);
    const geo = plate ? new T.CylinderGeometry(r, r, len * 1.04, 8, 1) : new T.CylinderGeometry(r, r, len * 1.14, 18, 1);
    if (plate) geo.scale(1, 1, .9);
    const mesh = new T.Mesh(geo, plate ? plateMat : ringMat);
    scene.add(mesh); units.push({ mesh, d: off + len / 2 }); off += len;
  }
  const TOTAL = off + 0.5;
  const tail = new T.Mesh(new T.ConeGeometry(D * .16, .55, 6), plateMat); scene.add(tail);

  // Faceted head
  const head = new T.Group();
  const hg = new T.IcosahedronGeometry(1, 1); hg.scale(D * .85, D * 1.4, D * .6);
  const pos = hg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / (D * 1.4);
    if (y > 0) { const f = 1 - y * .45; pos.setX(i, pos.getX(i) * f); pos.setZ(i, pos.getZ(i) * f); }
  }
  hg.computeVertexNormals();
  head.add(new T.Mesh(hg, headMat));
  const jaw = new T.Mesh(new T.BoxGeometry(D * .65, D * .85, D * .16), headMat); jaw.position.set(0, -D * .1, -D * .5); head.add(jaw);
  const eyeMat = new T.MeshBasicMaterial({ color: 0xffffff });
  [-1, 1].forEach(s => { const e = new T.Mesh(new T.SphereGeometry(D * .055, 8, 8), eyeMat); e.position.set(s * D * .42, D * .62, D * .18); head.add(e); });
  scene.add(head);

  // Path the body follows
  const STEP = 0.04, hp = new V3(), dir = new V3(), path = [];
  function sample(d, out) {
    let acc = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], seg = a.distanceTo(b);
      if (acc + seg >= d) return out.lerpVectors(a, b, (d - acc) / seg);
      acc += seg;
    }
    return out.copy(path[path.length - 1]);
  }
  const P = new V3(), A = new V3(), B = new V3(), Tn = new V3(), X = new V3(), Z = new V3(0, 0, 1), U = new V3(), M = new T.Matrix4();
  function place(obj, d, flip) {
    sample(d, P); sample(Math.max(d - .12, 0), A); sample(d + .12, B);
    Tn.subVectors(A, B).normalize(); if (flip) Tn.negate();
    X.crossVectors(Tn, Z); if (X.lengthSq() < 1e-4) X.set(1, 0, 0); X.normalize();
    U.crossVectors(X, Tn);
    M.makeBasis(X, Tn, U); obj.quaternion.setFromRotationMatrix(M); obj.position.copy(P);
  }

  // Where the snake lives (world units), measured from the .snake-art column
  let cx = 0, cy = 0, rx = 3, ry = 3, started = false, lastCx = 0, lastCy = 0;
  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const hh = Math.tan(FOV / 2 * Math.PI / 180) * CAMZ, hw = hh * w / h;
    if (ROAM) { cx = cy = 0; rx = hw * .85; ry = hh * .8; }
    else {
      const r = anchor.getBoundingClientRect();
      cx = ((r.left + r.width / 2) / w * 2 - 1) * hw; cy = -((r.top + r.height / 2) / h * 2 - 1) * hh;
      rx = Math.max(r.width / w * hw * .8, 1.7); ry = Math.max(r.height / h * hh * .8, 1.7);
    }
    if (!started) {
      started = true;
      lastCx = cx; lastCy = cy;
      hp.set(cx, cy, 0); dir.set(1, 0, 0);
      for (let i = 0; i < TOTAL / STEP + 30; i++) path.push(new V3(cx - i * STEP, cy, 0));
    } else if (!ROAM) {
      const dx = cx - lastCx, dy = cy - lastCy;
      hp.x += dx; hp.y += dy;
      path.forEach(p => { p.x += dx; p.y += dy; });
      lastCx = cx; lastCy = cy;
    }
  }
  addEventListener('resize', layout);
  addEventListener('scroll', layout, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(layout).observe(anchor);
  layout();

  // Wandering
  const axis = new V3(0, 0, 1), tAxis = new V3(0, 0, 1), force = new V3();
  let tTimer = 0, rate = 0, tRate = 0;
  function steer(dt) {
    tTimer -= dt;
    if (tTimer <= 0) {
      tTimer = 1 + Math.random() * 2.5;
      tAxis.set((Math.random() - .5) * .8, (Math.random() - .5) * .8, (Math.random() - .5) * 2).normalize();
      tRate = (Math.random() * 2 - 1) * TURN;
    }
    axis.lerp(tAxis, Math.min(dt * 1.5, 1)).normalize();
    rate += (tRate - rate) * Math.min(dt * 1.5, 1);
    dir.applyAxisAngle(axis, rate * dt);
    force.set(0, 0, 0);
    [[hp.x - cx, rx, 'x'], [hp.y - cy, ry, 'y'], [hp.z, 1.8, 'z']].forEach(a => {
      const r = Math.abs(a[0]) / a[1]; if (r > .6) force[a[2]] = -Math.sign(a[0]) * (r - .6) * (a[2] === 'z' ? 1 : 2.2);
    });
    dir.addScaledVector(force, dt * 8);
    dir.z -= dir.z * dt * .6;
    dir.normalize();
  }

  // Sparkle dust drifting off the tail
  let dust, dp, dv;
  if (DUST) {
    const N = 140; dp = new Float32Array(N * 3); dv = new Float32Array(N * 3);
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3));
    dust = new T.Points(dg, new T.PointsMaterial({ color: 0xd5d7dd, size: .04, transparent: true, opacity: .7, depthWrite: false }));
    dust.frustumCulled = false; scene.add(dust);
  }
  const Q = new V3();
  function respawn(i) {
    sample(TOTAL * (.45 + Math.random() * .55), Q);
    dp[i*3] = Q.x + (Math.random() - .5) * .6; dp[i*3+1] = Q.y + (Math.random() - .5) * .6; dp[i*3+2] = Q.z + (Math.random() - .5) * .6;
    dv[i*3] = (Math.random() - .5) * .15; dv[i*3+1] = (Math.random() - .5) * .15; dv[i*3+2] = (Math.random() - .5) * .1;
  }

  const clock = new T.Clock(); let first = true, rendered = false;
  (function frame() {
    const dt = Math.min(clock.getDelta(), .05) * (reduce ? .25 : 1);
    steer(dt);
    hp.addScaledVector(dir, SPEED * dt);
    path[0].copy(hp);
    if (path[0].distanceTo(path[1]) > STEP) path.unshift(hp.clone());
    const max = Math.ceil(TOTAL / STEP) + 30; while (path.length > max) path.pop();
    place(head, .2); units.forEach(u => place(u.mesh, u.d)); place(tail, TOTAL - .2, true);
    if (dust) {
      const n = dp.length / 3;
      for (let i = 0; i < n; i++) {
        if (first || Math.random() < dt * .5) respawn(i);
        dp[i*3] += dv[i*3] * dt; dp[i*3+1] += dv[i*3+1] * dt; dp[i*3+2] += dv[i*3+2] * dt;
      }
      dust.geometry.attributes.position.needsUpdate = true; first = false;
    }
    renderer.render(scene, camera);
    if (!rendered) { document.documentElement.classList.add('has-3d'); rendered = true; }
    requestAnimationFrame(frame);
  })();
})();
