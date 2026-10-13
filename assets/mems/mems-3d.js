// Interactive 3D model of the printed Lorentz-force MEMS switch (EUROSENSORS 2026, paper 4.4.3).
// Geometry is approximated from the paper's Fig. 1 and Fig. 3; vertical dimensions are exaggerated.
// Behaviour uses the paper's numbers: closure at 110 um (about 120 mA), electrostatic release at 28 V.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const root = document.getElementById('mems3d');
if (root) init(root);

function init(root) {
  const stage = root.querySelector('.m3d-stage');
  const labelLayer = root.querySelector('.m3d-labels');
  const $ = id => document.getElementById(id);
  const ui = {
    I: $('m3d-I'), V: $('m3d-V'), Iout: $('m3d-I-out'), Vout: $('m3d-V-out'),
    d: $('m3d-d'), state: $('m3d-state'), vc: $('m3d-vc'), mode: $('m3d-mode'), step: $('m3d-step'),
    run: $('m3d-run'), reset: $('m3d-reset'), labels: $('m3d-labels-btn'), view: $('m3d-view'),
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    root.classList.add('m3d-nogl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.appendChild(renderer.domElement);

  // ---------- dimensions (mm); vertical exaggerated ----------
  const EX = 20;                      // vertical exaggeration
  const UM = 0.001 * EX;              // 1 um vertically, in scene units
  const TAG = 15 * UM;                // printed silver, 15 um
  const TPI = 25 * UM;                // polyimide, 25 um
  const GAP = 110 * UM;               // travel to contact, 110 um
  const CPAD = 0.02;                  // contact layer under the shuttle
  const W = 0.18;                     // spring line width (drawn wider than 100 um for visibility)
  const SH = { x: 2.6, z: 1.1 };      // shuttle half-size
  const WIN = { x: 10.5, z: 8.5 };    // released window half-size
  const FR = { x: 13, z: 11 };        // frame half-size
  const PAD = { x: 11.4, z: 9.4, s: 1.6 };

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(8, 20, 12);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
  const HOME = { pos: new THREE.Vector3(21, 17, 30), target: new THREE.Vector3(0, -2.6, 0) };
  camera.position.copy(HOME.pos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.minDistance = 4;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.62;

  const mat = {
    silver: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.32 }),
    pi: new THREE.MeshStandardMaterial({ color: 0xd98a2b, metalness: 0, roughness: 0.55 }),
    piBottom: new THREE.MeshStandardMaterial({ color: 0xe2a24a, metalness: 0, roughness: 0.6, transparent: true, opacity: 0.72 }),
    contact: new THREE.MeshStandardMaterial({ color: 0x8f949c, metalness: 0.8, roughness: 0.4 }),
    pad: new THREE.MeshStandardMaterial({ color: 0xe6e8eb, metalness: 0.85, roughness: 0.3 }),
    electrode: new THREE.MeshStandardMaterial({ color: 0xb59a7a, metalness: 0.7, roughness: 0.45, transparent: true, opacity: 0.6 }),
    north: new THREE.MeshStandardMaterial({ color: 0xd23b33, roughness: 0.5 }),
    south: new THREE.MeshStandardMaterial({ color: 0x2c63c8, roughness: 0.5 }),
    current: new THREE.MeshBasicMaterial({ color: 0xffb020 }),
  };

  const box = (sx, sy, sz, m, x, y, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    b.position.set(x, y + sy / 2, z);
    scene.add(b);
    return b;
  };

  // ---------- top layer: polyimide frame with released window ----------
  const shape = new THREE.Shape();
  shape.moveTo(-FR.x, -FR.z); shape.lineTo(FR.x, -FR.z); shape.lineTo(FR.x, FR.z); shape.lineTo(-FR.x, FR.z); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-WIN.x, -WIN.z); hole.lineTo(-WIN.x, WIN.z); hole.lineTo(WIN.x, WIN.z); hole.lineTo(WIN.x, -WIN.z); hole.closePath();
  shape.holes.push(hole);
  const frameGeo = new THREE.ExtrudeGeometry(shape, { depth: TPI, bevelEnabled: false });
  frameGeo.rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(frameGeo, mat.pi));

  // anchor pads P1..P4 (P1 back-left, P2 back-right, P3 front-right, P4 front-left)
  const corners = { P1: [-1, -1], P2: [1, -1], P3: [1, 1], P4: [-1, 1] };
  for (const [sx, sz] of Object.values(corners)) box(PAD.s, TAG, PAD.s, mat.silver, sx * PAD.x, TPI, sz * PAD.z);

  // ---------- suspension springs: silver on a polyimide carrier, deformable ----------
  const smooth = s => s * s * (3 - 2 * s);
  function springPath(sx, sz) {
    const A = new THREE.Vector2(sx * PAD.x, sz * PAD.z);
    const B = new THREE.Vector2(sx * 4.8, sz * 3.2);
    const C = new THREE.Vector2(sx * SH.x, sz * SH.z);
    const BC = C.clone().sub(B), n = new THREE.Vector2(-BC.y, BC.x).normalize();
    const P = (t, o) => B.clone().addScaledVector(BC, t).addScaledVector(n, o);
    return [A, B, P(0.25, 0.75), P(0.5, -0.75), P(0.75, 0.75), C];
  }
  // dense samples with s = 0 at the window edge (anchored) and 1 at the shuttle
  function sample(pts, step = 0.08) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = a.distanceTo(b), n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n));
    }
    out.push(pts[pts.length - 1].clone());
    let acc = 0, L0 = null;
    const len = out.map((p, i) => (acc += i ? p.distanceTo(out[i - 1]) : 0));
    for (let i = 0; i < out.length; i++) {
      if (Math.abs(out[i].x) <= WIN.x && Math.abs(out[i].y) <= WIN.z) { L0 = len[i]; break; }
    }
    const total = len[len.length - 1];
    return out.map((p, i) => ({ x: p.x, z: p.y, s: Math.max(0, (len[i] - L0) / (total - L0)) }));
  }
  function ribbon(samples, y0, h, m) {
    const n = samples.length, pos = new Float32Array(n * 4 * 3), idx = [];
    const off = samples.map((p, i) => {
      const a = samples[Math.max(0, i - 1)], b = samples[Math.min(n - 1, i + 1)];
      const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
      return [(-tz / l) * W / 2, (tx / l) * W / 2];
    });
    for (let i = 0; i < n - 1; i++) {
      const q = (k, c) => (i + k) * 4 + c;  // c: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right
      const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
      quad(q(0, 0), q(1, 0), q(1, 1), q(0, 1));   // top
      quad(q(0, 3), q(1, 3), q(1, 2), q(0, 2));   // bottom
      quad(q(0, 2), q(1, 2), q(1, 0), q(0, 0));   // left
      quad(q(0, 1), q(1, 1), q(1, 3), q(0, 3));   // right
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, m);
    scene.add(mesh);
    const update = dv => {
      for (let i = 0; i < n; i++) {
        const p = samples[i], [ox, oz] = off[i], y = y0 - dv * smooth(p.s);
        const v = [[p.x + ox, y + h, p.z + oz], [p.x - ox, y + h, p.z - oz], [p.x + ox, y, p.z + oz], [p.x - ox, y, p.z - oz]];
        for (let c = 0; c < 4; c++) pos.set(v[c], (i * 4 + c) * 3);
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    };
    return update;
  }
  const springs = {};
  const ribbonUpdates = [];
  for (const [name, [sx, sz]] of Object.entries(corners)) {
    const sm = sample(springPath(sx, sz));
    springs[name] = sm;
    ribbonUpdates.push(ribbon(sm, 0, TPI, mat.pi), ribbon(sm, TPI, TAG, mat.silver));
  }

  // ---------- movable shuttle ----------
  const shuttle = new THREE.Group();
  const addTo = (g, sx, sy, sz, m, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.y = y + sy / 2; g.add(b); };
  addTo(shuttle, SH.x * 2, TPI, SH.z * 2, mat.pi, 0);
  addTo(shuttle, SH.x * 2, TAG, SH.z * 2, mat.silver, TPI);
  addTo(shuttle, 3.8, CPAD, 1.2, mat.contact, -CPAD);
  scene.add(shuttle);

  // ---------- bottom substrate: contact pads, polyimide, bottom electrode ----------
  const padTop = -GAP - CPAD;
  for (const sx of [-1, 1]) {
    box(1.5, TAG, 1.0, mat.pad, sx * 1.25, padTop - TAG, 0);
    box(FR.x - 2.0, TAG, 0.5, mat.pad, sx * (2.0 + (FR.x - 2.0) / 2), padTop - TAG, 0);
  }
  const subTop = padTop - TAG;
  box(FR.x * 2, TPI, FR.z * 2, mat.piBottom, 0, subTop - TPI, 0);
  const elTop = subTop - TPI;
  box(FR.x * 2 - 2, TAG, FR.z * 2 - 2, mat.electrode, 0, elTop - TAG, 0);

  // ---------- permanent magnet (schematic) ----------
  const magTop = elTop - TAG - 1.4, MH = 2.4;
  box(6, MH, 6, mat.north, -3, magTop - MH, 0);
  box(6, MH, 6, mat.south, 3, magTop - MH, 0);

  // ---------- current path P4 -> shuttle -> P2, force and field arrows ----------
  const yTop = TPI + TAG + 0.04;
  const path = [
    ...springs.P4.map(p => ({ ...p, k: 'spring' })),
    { x: SH.x, z: -SH.z, s: 1, k: 'shuttle' },
    ...springs.P2.slice().reverse().map(p => ({ ...p, k: 'spring' })),
  ];
  let accL = 0;
  path.forEach((p, i) => { accL += i ? Math.hypot(p.x - path[i - 1].x, p.z - path[i - 1].z) : 0; p.L = accL; });
  const pathLen = accL;
  const particles = [];
  const pGeo = new THREE.SphereGeometry(0.11, 10, 8);
  for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(pGeo, mat.current); scene.add(m); particles.push(m); }
  function pointAt(u, dv) {
    let lo = 0, hi = path.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path[mid].L < u) lo = mid; else hi = mid; }
    const a = path[lo], b = path[hi], t = (u - a.L) / ((b.L - a.L) || 1);
    const dy = p => (p.k === 'shuttle' ? dv : dv * smooth(p.s));
    return [a.x + (b.x - a.x) * t, yTop - (dy(a) + (dy(b) - dy(a)) * t), a.z + (b.z - a.z) * t];
  }

  const arrowL = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, 0xe07a10, 0.35, 0.22);
  const arrowE = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, 0x2c63c8, 0.35, 0.22);
  const arrowB = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-4.5, magTop + 0.35, 3.4), 9, 0x17191c, 0.5, 0.3);
  scene.add(arrowL, arrowE, arrowB);

  // ---------- labels ----------
  const labels = [];
  const label = (text, fn, cls = '') => {
    const el = document.createElement('span');
    el.className = 'm3d-label ' + cls;
    el.innerHTML = text;
    labelLayer.appendChild(el);
    labels.push({ el, fn });
    return el;
  };
  for (const [name, [sx, sz]] of Object.entries(corners)) label(name, () => [sx * PAD.x, TPI + TAG + 0.5, sz * PAD.z], 'tag');
  label('Movable shuttle', () => [0, TPI + TAG + 0.6 - dVis, -SH.z]);
  label('Suspension spring', () => { const p = springs.P1[Math.floor(springs.P1.length * 0.45)]; return [p.x, TPI + TAG + 0.4 - dVis * smooth(p.s), p.z]; });
  label('Polyimide frame', () => [-WIN.x - 1.2, TPI + 0.3, 0]);
  label('Contact pads', () => [-8, padTop + 0.2, 0.8]);
  label('Bottom electrode', () => [FR.x - 1, elTop - 0.2, FR.z - 1]);
  label('N', () => [-3, magTop - MH / 2, 3.2], 'tag mag');
  label('S', () => [3, magTop - MH / 2, 3.2], 'tag mag');
  label('Magnet, B ≈ 0.15&nbsp;T at the switch', () => [0, magTop - MH - 0.4, 3]);
  label('B', () => [4.8, magTop + 0.35, 3.4], 'tag');
  const lblL = label('F<sub>Lorentz</sub>', () => [-1.4, yTop + 0.25 - dVis + lenL, 0], 'force l');
  const lblE = label('F<sub>es</sub>', () => [1.4, yTop + 0.25 - dVis + lenE, 0], 'force e');
  let labelsOn = true;

  // ---------- behaviour ----------
  let I = 0, V = 0, closed = false, dUm = 0, dVis = 0, lenL = 0, lenE = 0, releaseMsgUntil = 0;
  const target = () => (closed ? 110 : Math.min(110, (I * 110) / 120));
  function evaluate() {
    const was = closed;
    if (I >= 120) closed = true;
    else if (closed && V < 28) closed = false;
    if (was && !closed && I < 120) releaseMsgUntil = performance.now() + 2500;
  }
  function setI(v, fromUser) { I = Math.round(v); ui.I.value = I; ui.Iout.textContent = I + ' mA'; evaluate(); if (fromUser) stopSeq(); }
  function setV(v, fromUser) { V = Math.round(v); ui.V.value = V; ui.Vout.textContent = V + ' V'; evaluate(); if (fromUser) stopSeq(); }
  ui.I.addEventListener('input', () => setI(+ui.I.value, true));
  ui.V.addEventListener('input', () => setV(+ui.V.value, true));

  function readout(now) {
    const touching = dUm >= 109.5;
    ui.d.textContent = dUm.toFixed(0) + ' µm';
    ui.state.textContent = touching ? 'Closed' : 'Open';
    ui.state.dataset.on = touching ? '1' : '0';
    ui.vc.textContent = touching ? '0 V' : '5 V';
    let m;
    if (now < releaseMsgUntil && !closed) m = 'Released: the hold-down voltage fell below 28 V.';
    else if (closed && !touching) m = 'Closing: the Lorentz force is pulling the shuttle onto the contact pads.';
    else if (closed && I >= 120 && V >= 28) m = 'Closed and held: the drive current can now be turned off.';
    else if (closed && I >= 120) m = 'Closed by the Lorentz force; the drive current is holding it.';
    else if (closed) m = I > 0 ? `Held closed by the electrostatic force, drive current down to ${I} mA.` : 'Held closed by the electrostatic force alone, with no drive current.';
    else if (I > 0) m = `Open: the Lorentz force deflects the shuttle ${dUm.toFixed(0)} of 110 µm.`;
    else m = 'Open, at rest.';
    if (ui.mode.textContent !== m) ui.mode.textContent = m;
  }

  // ---------- guided sequence ----------
  let seq = 0;
  function stopSeq() { seq++; ui.step.textContent = ''; ui.run.setAttribute('aria-pressed', 'false'); }
  const tween = (set, from, to, ms, token) => new Promise(res => {
    const t0 = performance.now();
    const tick = now => {
      if (token !== seq) return res(false);
      const t = Math.min(1, (now - t0) / ms);
      set(from + (to - from) * t);
      if (t < 1) requestAnimationFrame(tick); else res(true);
    };
    requestAnimationFrame(tick);
  });
  const wait = (ms, token) => new Promise(res => setTimeout(() => res(token === seq), ms));
  async function runSeq() {
    stopSeq();
    const token = seq;
    ui.run.setAttribute('aria-pressed', 'true');
    setI(0); setV(0); closed = false;
    const steps = [
      ['1 / 4  Drive 120 mA through P2–P4: the Lorentz force pulls the shuttle down.', () => tween(setI, 0, 120, 1600, token)],
      ['2 / 4  Apply 80 V to the bottom electrode.', () => tween(setV, 0, 80, 1000, token)],
      ['3 / 4  Turn the drive current off: the switch stays closed.', () => tween(setI, 120, 0, 1300, token)],
      ['4 / 4  Sweep the hold-down voltage down: it releases at 28 V.', () => tween(setV, 80, 0, 5200, token)],
    ];
    for (const [text, fn] of steps) {
      if (token !== seq) return;
      ui.step.textContent = text;
      if (!(await fn()) || !(await wait(900, token))) return;
    }
    if (token === seq) { ui.step.textContent = ''; ui.run.setAttribute('aria-pressed', 'false'); }
  }
  ui.run.addEventListener('click', () => (ui.run.getAttribute('aria-pressed') === 'true' ? stopSeq() : runSeq()));
  ui.reset.addEventListener('click', () => { stopSeq(); setI(0); setV(0); closed = false; });
  ui.labels.addEventListener('click', () => {
    labelsOn = !labelsOn;
    ui.labels.setAttribute('aria-pressed', String(labelsOn));
    labelLayer.hidden = !labelsOn;
  });
  ui.view.addEventListener('click', () => { camera.position.copy(HOME.pos); controls.target.copy(HOME.target); });

  // ---------- render loop ----------
  const v3 = new THREE.Vector3();
  let w = 0, h = 0, last = performance.now(), phase = 0, visible = false;
  function resize() {
    const r = stage.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the horizontal field of view on narrow screens (phones), within limits
    camera.fov = Math.min(56, Math.max(35, (2 * Math.atan(0.63 / camera.aspect) * 180) / Math.PI));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  function frame(now) {
    if (!visible) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    dUm += (target() - dUm) * (1 - Math.exp(-dt / 0.12));
    if (Math.abs(target() - dUm) < 0.05) dUm = target();
    dVis = dUm * UM;

    ribbonUpdates.forEach(u => u(dVis));
    shuttle.position.y = -dVis;

    const on = I > 0;
    phase = (phase + dt * (0.15 + I / 300)) % 1;
    particles.forEach((p, i) => {
      p.visible = on;
      if (on) { const u = (((i / particles.length) + phase) % 1) * pathLen; p.position.set(...pointAt(u, dVis)); }
    });
    lenL = 0.5 + 2.2 * (I / 200);
    arrowL.visible = on; lblL.hidden = !on;
    arrowL.position.set(-1.4, yTop + 0.25 - dVis + lenL, 0); arrowL.setLength(lenL, 0.35, 0.22);
    lenE = 0.5 + 1.6 * (V / 80);
    arrowE.visible = V > 0; lblE.hidden = !(V > 0);
    arrowE.position.set(1.4, yTop + 0.25 - dVis + lenE, 0); arrowE.setLength(lenE, 0.35, 0.22);

    controls.update();
    renderer.render(scene, camera);

    if (labelsOn) {
      for (const { el, fn } of labels) {
        if (el.hidden && (el === lblL || el === lblE)) continue;
        v3.set(...fn()).project(camera);
        const show = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
        el.style.visibility = show ? 'visible' : 'hidden';
        if (show) el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * h}px) translate(-50%, -50%)`;
      }
    }
    readout(now);
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting;
    if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(root);

  setI(0); setV(0);
  if (w < 560) ui.labels.click();   // phones: start without labels, toggle with the Labels button
  root.classList.add('m3d-ready');
}
