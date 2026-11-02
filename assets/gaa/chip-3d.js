// Multi-scale 3D model of ibex_npu_top on MATRIX-A5 CFET, geometry only (no images):
// whole chip -> standard-cell band -> rows and buried power rails -> cells -> one nanosheet transistor.
// Floorplan, backside BSM1-3 stripes, pins, rows: chip.js (pnr/ibex_npu_top_pnr.tcl via scripts/floorplan.py + chip3d.py).
// Cells: cells.js (PDK cell GDS via scripts/gds3d.py, transistors checked against the PDK CDL).
// Clock demo: switch-level simulation (switchsim.js) of the cells' own transistor netlists.
// All z from the PDK ITF/ICT; true scale on every axis. Units: nm.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHIP } from './chip.js';
import { CELLS } from '../cfet/cells.js';
import { makeCircuit, settle } from './switchsim.js';

const root = document.getElementById('chip3d');
if (root) init(root);

function init(root) {
  const stage = root.querySelector('.k3d-stage');
  const tagLayer = root.querySelector('.k3d-tags');
  const $ = s => root.querySelector(s);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true }); }
  catch (e) { root.classList.add('k3d-nogl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0d1016);
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(-0.4, -0.6, 1); scene.add(sun);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1e7);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.zoomToCursor = true;
  controls.minDistance = 40; controls.maxDistance = 600000; controls.zoomSpeed = 1.4;

  const Z = CHIP.z;
  const [dx0, dy0, dx1, dy1] = CHIP.die;
  const geoBox = (x0, y0, x1, y1, z0, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };
  const box = (x0, y0, x1, y1, z0, z1, mat) => new THREE.Mesh(geoBox(x0, y0, x1, y1, z0, z1), mat);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6, ...o });
  const outline = (mesh, color = 0x9aa3b5, opacity = 1) => { mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }))); return mesh; };

  // ================= chip level (all from the floorplan script)
  const chip = new THREE.Group(); scene.add(chip);
  chip.add(outline(box(dx0, dy0, dx1, dy1, Z.BSM3[0] - 100, Z.BSM3[0] - 40, std(0x1b1f29))));

  const sCol = { BSM1: 0x3a3060, BSM2: 0x302754, BSM3: 0x5a48a8 };
  const backside = new THREE.Group(); chip.add(backside);
  for (const s of CHIP.stripes) { const [x0, y0, x1, y1] = s.rect; backside.add(box(x0, y0, x1, y1, Z[s.layer][0], Z[s.layer][1], std(sCol[s.layer], { metalness: 0.6, roughness: 0.4 }))); }

  // hard macros: FEOL..M9 blocks (the macros route signals on M0-M9)
  for (const m of CHIP.macros) {
    const [x0, y0, x1, y1] = m.rect;
    chip.add(outline(box(x0, y0, x1, y1, Z.GATE[0], Z.M9[1], std(m.inst === 'u_acc' ? 0x2f7a46 : 0x3d6b4c, { roughness: 0.75 })), 0xc8f0d0));
  }
  // standard-cell band: main region, channel, shadow fence (same colours as the floorplan drawing)
  const [bx0, by0, bx1, by1] = CHIP.band;
  const regs = [...CHIP.regions].sort((p, q) => p.rect[0] - q.rect[0]);
  const regionMeshes = [];
  for (const [r, col] of [[regs[0].rect, 0xd97706], [[regs[0].rect[2], by0, regs[1].rect[0], by1], 0xc2185b], [regs[1].rect, 0x2e8b57]]) {
    const mesh = outline(box(r[0], r[1], r[2], r[3], Z.GATE[0], Z.M3[1], std(col, { transparent: true, opacity: 0.55, roughness: 0.8 })), col, 0.9);
    regionMeshes.push(mesh); chip.add(mesh);
  }
  // pins (M5, top edge); clk_i highlighted
  const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(42, 400, Z.M5[1] - Z.M5[0]), std(0xe6e8ee, { emissive: 0x333333 }), CHIP.pins.length);
  const mtx = new THREE.Matrix4();
  CHIP.pins.forEach(([x, y], i) => { mtx.makeTranslation(x, y - 200, (Z.M5[0] + Z.M5[1]) / 2); pins.setMatrixAt(i, mtx); });
  chip.add(pins);
  const clkPinX = (dx0 + dx1) / 2;  // clk_i is placed on the die centre line by the script
  const clkPinMat = std(0xffcc55, { emissive: 0x000000 });
  chip.add(box(clkPinX - 150, dy1 - 900, clkPinX + 150, dy1, Z.M5[0], Z.M5[1] + 300, clkPinMat));

  // ================= row level: BPR followpin rails on every row edge; cells only on even rows
  const [, sh] = CHIP.site;
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(bx1 - bx0, 24, Z.BPR[1] - Z.BPR[0]), std(0xa58cff, { metalness: 0.3 }), CHIP.rows + 1);
  for (let i = 0; i <= CHIP.rows; i++) { mtx.makeTranslation((bx0 + bx1) / 2, by0 + i * sh, (Z.BPR[0] + Z.BPR[1]) / 2); rails.setMatrixAt(i, mtx); }
  scene.add(rails);
  const rowsOcc = new THREE.InstancedMesh(new THREE.PlaneGeometry(bx1 - bx0, sh), new THREE.MeshBasicMaterial({ color: 0x2c3446, transparent: true, opacity: 0.55 }), Math.ceil(CHIP.rows / 2));
  for (let i = 0; i < CHIP.rows; i += 2) { mtx.makeTranslation((bx0 + bx1) / 2, by0 + (i + 0.5) * sh, Z.BPR[0] - 3); rowsOcc.setMatrixAt(i / 2, mtx); }
  scene.add(rowsOcc);

  // ================= cell level: INV, NAND2, DFF with per-shape nets
  const ALIAS = { nand2_x1: { A: 'a', B: 'b', Y: 'nab' }, inv_x1: { A: 'nab', Y: 'p' }, dff_x1: { D: 'p', CK: 'clk', Q: 'q' } };
  const gname = (key, n) => (n === 'VDD' || n === 'VSS') ? n : (ALIAS[key][n] || key + '/' + n);
  const cellGroup = new THREE.Group(); scene.add(cellGroup);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0d1016, transparent: true, opacity: 0.5 });
  const live = [];
  const ex = {}; for (const e of CHIP.examples) ex[e.cell] = e;
  for (const e of CHIP.examples) {
    for (const l of CELLS[e.cell].layers) {
      const isGate = / gate$/.test(l.name), isSheet = /nanosheet/.test(l.name);
      for (let i = 0, k = 0; i < l.rects.length; i += 4, k++) {
        const [x0, y0, x1, y1] = l.rects.slice(i, i + 4);
        const m = std(l.color, { metalness: isSheet ? 0.05 : 0.35, roughness: isSheet ? 0.45 : 0.55, transparent: isGate, opacity: isGate ? 0.3 : 1, depthWrite: !isGate });
        const mesh = box(e.x + x0, e.y + y0, e.x + x1, e.y + y1, l.z0, l.z1, m);
        cellGroup.add(mesh);
        if (!isGate) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat));
        const net = l.nets && l.nets[k];
        if (net) live.push({ mesh, kind: isGate ? 'gate' : isSheet ? 'sheet' : 'sd', t: l.name[0], node: gname(e.cell, net), base: new THREE.Color(l.color) });
      }
    }
  }
  const zSheets = t => CELLS.nand2_x1.layers.filter(l => l.name.startsWith(t === 'n' ? 'nFET nanosheet' : 'pFET nanosheet')).map(l => (l.z0 + l.z1) / 2);
  const actY = t => { const r = CELLS.nand2_x1.layers.find(l => l.name === (t === 'n' ? 'nFET S/D' : 'pFET S/D')).rects; return (r[1] + r[3]) / 2; };

  // ================= simulation
  const circ = makeCircuit(CHIP.examples.map(e => ({ prefix: e.cell, devices: CELLS[e.cell].devices, alias: ALIAS[e.cell] })));
  let v = Object.fromEntries(circ.nodes.map(n => [n, 'X']));
  const inp = { a: 1, b: 1, clk: 0 };
  for (const c of [0, 1, 0]) { inp.clk = c; v = settle(circ, v, { ...inp }).states.at(-1); }   // warm-up: every node known
  const HI = new THREE.Color('#ff5a36'), LO = new THREE.Color('#3d7bff'), XC = new THREE.Color('#8a8f99');
  const SHEET_ON = new THREE.Color('#fff1b8'), SHEET_OFF = new THREE.Color('#3a3f4a'), GLOW = new THREE.Color('#ffb020'), BLACK = new THREE.Color(0);
  const valCol = x => x === 1 ? HI : x === 0 ? LO : XC;
  const bit = x => `<b class="${x === 1 ? 'h' : x === 0 ? 'l' : ''}">${x}</b>`;
  function paint(s) {
    for (const L of live) {
      const m = L.mesh.material, val = s[L.node];
      if (L.kind === 'gate') { m.color.copy(valCol(val)); m.emissive.copy(valCol(val)).multiplyScalar(0.25); }
      else if (L.kind === 'sd') m.color.copy(L.base).lerp(valCol(val), 0.75);
      else { const on = L.t === 'n' ? val === 1 : val === 0; m.color.copy(on ? SHEET_ON : SHEET_OFF); m.emissive.copy(on ? GLOW : BLACK); m.emissiveIntensity = on ? 0.9 : 0; }
    }
    clkPinMat.emissive.set(s.clk === 1 ? 0xffaa00 : 0x000000);
    $('#k3d-state').innerHTML = `CK ${bit(s.clk)} &middot; a ${bit(s.a)} &middot; b ${bit(s.b)} &middot; D = a&middot;b ${bit(s.p)} &middot; Q ${bit(s.q)}`;
  }
  // current: particles through the three sheets of each transistor that charges or discharges a node in this stage
  const parts = new THREE.InstancedMesh(new THREE.SphereGeometry(1.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5ff3ff }), 900);
  parts.count = 0; parts.frustumCulled = false; scene.add(parts);
  let flowsNow = [], flowT0 = 0, playing = false;
  let FRAME = 520;     // ms per transistor stage
  const queue = [];
  const hist = [];
  const pushHist = s => { hist.push({ clk: s.clk, a: s.a, b: s.b, p: s.p, q: s.q }); if (hist.length > 64) hist.shift(); drawWave(); };
  function drive(newInp) {
    Object.assign(inp, newInp);
    const r = settle(circ, v, { ...inp });
    for (let i = 1; i < r.states.length; i++) queue.push({ state: r.states[i], flows: r.flows[i - 1] });
    queue.push({ state: r.states.at(-1), flows: [] });
    v = r.states.at(-1);
  }
  function pump(now) {
    if (playing && now - flowT0 < FRAME) return;
    const f = queue.shift();
    if (!f) { playing = false; flowsNow = []; return; }
    playing = true; flowT0 = now; flowsNow = f.flows; paint(f.state); pushHist(f.state);
  }
  function drawParticles(now) {
    let n = 0;
    const u = Math.min(1, (now - flowT0) / FRAME);
    for (const { d, dir } of flowsNow) {
      const e = ex[d.cell], y = e.y + actY(d.t), xs = e.x + d.x - 19.5 * dir, xe = e.x + d.x + 19.5 * dir;
      for (const z of zSheets(d.t)) for (let j = 0; j < 4; j++) {
        const s = (u + j / 4) % 1;
        mtx.makeTranslation(xs + (xe - xs) * s, y + (j - 1.5) * 2.5, z + (j % 2 ? 4.2 : -4.2));   // on the top and bottom surfaces of each 6 nm sheet
        if (n < 900) parts.setMatrixAt(n++, mtx);
      }
    }
    parts.count = n; parts.instanceMatrix.needsUpdate = true;
  }

  // ================= waveform (SVG)
  const wave = $('#k3d-wave');
  function drawWave() {
    const rows = [['CK', 'clk'], ['a', 'a'], ['b', 'b'], ['D = a·b', 'p'], ['Q', 'q']];
    const W = 600, rh = 26, lx = 70, dx = (W - lx - 10) / 64;
    let s = `<svg viewBox="0 0 ${W} ${rows.length * rh + 14}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Waveform of CK, a, b, D and Q">`;
    rows.forEach(([lab, k], r) => {
      const y1 = r * rh + 6, y0 = y1 + 16;
      s += `<text x="0" y="${y0 - 3}" font-size="12" fill="#5e5d59" font-family="IBM Plex Mono, monospace">${lab}</text>`;
      let d = '';
      hist.forEach((h, i) => { const x = lx + i * dx, val = h[k], y = val === 1 ? y1 : val === 0 ? y0 : (y0 + y1) / 2; d += (i ? `L${x},${y}` : `M${x},${y}`) + `L${x + dx},${y}`; });
      s += `<path d="${d}" fill="none" stroke="${k === 'clk' ? '#d97706' : '#17191c'}" stroke-width="1.6"/>`;
    });
    s += `<text x="${W - 10}" y="${rows.length * rh + 12}" font-size="10" text-anchor="end" fill="#8a8f99">one step = one transistor stage (slowed down)</text></svg>`;
    wave.innerHTML = s;
  }
  paint(v); pushHist(v);

  // ================= levels
  const nand = ex.nand2_x1, dff = ex.dff_x1;
  const ckInv = CELLS.dff_x1.devices.find(d => d.t === 'n' && d.g === 'CK');
  const midZ = (Z.BSM3[0] + Z.M9[1]) / 2;
  const L = {
    chip: { t: new THREE.Vector3((dx0 + dx1) / 2, (dy0 + dy1) / 2, midZ), d: 190000, dir: [0.0, -0.62, 1] },
    band: { t: new THREE.Vector3((bx0 + bx1) / 2, (by0 + by1) / 2, Z.M3[1]), d: 70000, dir: [-0.25, -0.7, 1] },
    rows: { t: new THREE.Vector3(nand.x + 250, nand.y + 36, 200), d: 2600, dir: [-0.5, -0.8, 0.7] },
    cell: { t: new THREE.Vector3(nand.x + 250, nand.y + 36, 190), d: 900, dir: [-0.5, -0.85, 0.5] },
    fet: { t: new THREE.Vector3(dff.x + ckInv.x, dff.y + actY('n'), (Z.ACT2[0] + Z.ACT2[1]) / 2), d: 130, dir: [-0.22, -1, 0.18] },
  };
  let anim = null;
  function fly(key, ms = 1700) {
    const lv = L[key];
    anim = { t0: performance.now(), ms, p0: camera.position.clone(), q0: controls.target.clone(),
      p1: lv.t.clone().addScaledVector(new THREE.Vector3(...lv.dir).normalize(), lv.d), q1: lv.t.clone(),
      d0: camera.position.distanceTo(controls.target), d1: lv.d };
    root.querySelectorAll('[data-lv]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lv === key));
  }
  function stepFly(now) {
    if (!anim) return;
    let u = Math.min(1, (now - anim.t0) / anim.ms); u = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const tgt = anim.q0.clone().lerp(anim.q1, u);
    const d = Math.exp(Math.log(anim.d0) + (Math.log(anim.d1) - Math.log(anim.d0)) * u);
    const dir = anim.p0.clone().sub(anim.q0).normalize().lerp(anim.p1.clone().sub(anim.q1).normalize(), u).normalize();
    camera.position.copy(tgt).addScaledVector(dir, d); controls.target.copy(tgt);
    if (u >= 1) anim = null;
  }

  // ================= labels
  const tags = [];
  const tag = (txt, p, when, cls = '') => { const el = document.createElement('span'); el.className = 'k3d-tag ' + cls; el.textContent = txt; tagLayer.appendChild(el); tags.push({ el, p, when }); };
  for (const m of CHIP.macros) { const [x0, y0, x1, y1] = m.rect; tag(m.inst + (m.inst === 'u_acc' ? ' · 8×8 INT8 array' : ' · 1 KB SRAM'), new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, Z.M9[1]), d => d > 25000); }
  for (const r of CHIP.regions) { const [x0, y0, x1, y1] = r.rect; tag(r.type === 'fence' ? 'lockstep shadow core' : 'Ibex core', new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, Z.M3[1]), d => d > 25000); }
  tag('clk_i', new THREE.Vector3(clkPinX, dy1 + 2500, Z.M5[1]), d => d > 25000 && d < 400000, 'hl');
  tag('cells ▾', new THREE.Vector3(nand.x + 250, nand.y + 500, Z.M3[1]), d => d < 30000 && d > 2500, 'hl');
  tag('BPR rail · VDD/VSS', new THREE.Vector3(nand.x - 400, nand.y, Z.BPR[1]), d => d < 4000 && d > 400);
  tag('INV', new THREE.Vector3(ex.inv_x1.x + 40, ex.inv_x1.y + 36, Z.M0[1] + 70), d => d < 2500 && d > 300);
  tag('NAND2', new THREE.Vector3(nand.x + 60, nand.y + 36, Z.M0[1] + 70), d => d < 2500 && d > 300);
  tag('DFF', new THREE.Vector3(dff.x + 270, dff.y + 36, Z.M1[1] + 70), d => d < 2500 && d > 300);
  tag('nFET · tier 2', new THREE.Vector3(nand.x - 40, nand.y + actY('n'), (Z.ACT2[0] + Z.ACT2[1]) / 2), d => d <= 1500 && d > 300);
  tag('pFET · tier 1', new THREE.Vector3(nand.x - 40, nand.y + actY('p'), (Z.ACT[0] + Z.ACT[1]) / 2), d => d <= 1500 && d > 300);
  tag('clock inverter nFET · gate = CK', new THREE.Vector3(dff.x + ckInv.x, dff.y + actY('n') - 10, Z.ACT2[1] + 8), d => d <= 320, 'hl');
  let tagsOn = true;

  // ================= level of detail
  const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + ' µm' : n.toFixed(0) + ' nm';
  function lod() {
    const d = camera.position.distanceTo(controls.target);
    const a = THREE.MathUtils.clamp((d - 3000) / 6000, 0, 1);     // band regions fade out between 9 and 3 µm
    for (const m of regionMeshes) { m.material.opacity = 0.55 * a; m.visible = a > 0.01; }
    rails.visible = rowsOcc.visible = d < 20000;
    cellGroup.visible = parts.visible = d < 12000;
    pins.visible = d < 60000;
    const w = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    $('#k3d-scale').textContent = `field of view ≈ ${fmt(w)} wide`;
    const lvl = d > 100000 ? 'chip' : d > 9000 ? 'band' : d > 1200 ? 'rows' : d > 300 ? 'cell' : 'fet';
    $('#k3d-level').textContent = { chip: 'Whole chip: 3 hard macros, CPU cell band, 232 pins, backside power',
      band: 'Cell band: Ibex core region, channel, lockstep shadow fence',
      rows: 'Rows: buried power rail on every row edge; cells on every second row only',
      cell: 'NAND2 + INV = one AND (a·b); the DFF stores it on the rising clock edge',
      fet: 'One transistor: 3 nanosheets, gate all around; nFET on top of pFET' }[lvl];
    const r = renderer.domElement.getBoundingClientRect();
    for (const t of tags) {
      if (!(tagsOn && t.when(d))) { t.el.style.display = 'none'; continue; }
      const p = t.p.clone().project(camera);
      if (p.z > 1) { t.el.style.display = 'none'; continue; }
      t.el.style.display = '';
      t.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * r.width}px, ${(-p.y * 0.5 + 0.5) * r.height}px) translate(-50%, -50%)`;
    }
  }

  // ================= UI
  root.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => fly(b.dataset.lv));
  $('#k3d-back').onchange = e => { backside.visible = e.target.checked; };
  $('#k3d-gate').oninput = e => { live.filter(L => L.kind === 'gate').forEach(L => { L.mesh.material.opacity = +e.target.value / 100; }); $('#k3d-gate-out').textContent = e.target.value + '%'; };
  $('#k3d-tags-btn').onclick = e => { tagsOn = !tagsOn; e.target.setAttribute('aria-pressed', tagsOn); };
  const near = () => camera.position.distanceTo(controls.target) < 2500;
  function pulse() { if (!near() && !anim) fly('cell'); drive({ clk: 1 }); drive({ clk: 0 }); }
  function setIn(k, val) { drive({ [k]: val }); const b = $('#k3d-' + k); b.setAttribute('aria-pressed', val === 1); b.textContent = `${k} = ${val}`; }
  $('#k3d-pulse').onclick = pulse;
  $('#k3d-a').onclick = () => setIn('a', inp.a ? 0 : 1);
  $('#k3d-b').onclick = () => setIn('b', inp.b ? 0 : 1);
  let auto = null, pat = 0;
  const PAT = [[1, 1], [0, 1], [1, 0], [0, 0]];
  $('#k3d-auto').onclick = e => {
    if (auto) { clearInterval(auto); auto = null; e.target.setAttribute('aria-pressed', false); return; }
    e.target.setAttribute('aria-pressed', true); if (!near()) fly('cell');
    const tick = () => { if (queue.length > 2) return; const [na, nb] = PAT[pat++ % 4]; if (na !== inp.a) setIn('a', na); if (nb !== inp.b) setIn('b', nb); pulse(); };
    tick(); auto = setInterval(tick, 900);
  };
  ['a', 'b'].forEach(k => { const b = $('#k3d-' + k); b.setAttribute('aria-pressed', inp[k] === 1); b.textContent = `${k} = ${inp[k]}`; });

  function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(stage); resize();
  const c0 = L.chip; camera.position.copy(c0.t).addScaledVector(new THREE.Vector3(...c0.dir).normalize(), c0.d * (camera.aspect < 1 ? 1.7 : 1));
  controls.target.copy(c0.t);
  renderer.setAnimationLoop(now => {
    stepFly(now); pump(now); drawParticles(now); controls.update();
    const d = camera.position.distanceTo(controls.target);
    camera.near = Math.max(0.05, d / 2000); camera.far = d * 40 + 400000; camera.updateProjectionMatrix();
    lod(); renderer.render(scene, camera);
  });
  window.__chip3d = { fly, pulse, setIn, drive, pending: () => queue.length, particles: () => parts.count, frame: ms => { FRAME = ms; }, state: () => ({ ...v }) };   // used by automated checks
}
