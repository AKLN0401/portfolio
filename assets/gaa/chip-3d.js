// Multi-scale 3D view of ibex_npu_top on MATRIX-A5 CFET: whole chip -> cell band -> rows -> cell -> one nanosheet transistor.
// Floorplan, backside power stripes, pins: chip.js (from pnr/ibex_npu_top_pnr.tcl via scripts/floorplan.py + chip3d.py).
// Cell-band and macro surfaces: the routed DEF rendered by scripts/def2png.py (real routing, M0-M5 drawn flat).
// Cells: cells.js (PDK cell GDS via scripts/gds3d.py), placed on a legal even row as a scale example.
// All z from the PDK ITF/ICT; true scale on every axis. Units: nm.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHIP } from './chip.js';
import { CELLS } from '../cfet/cells.js';

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
  const box = (x0, y0, x1, y1, z0, z1, mat) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return new THREE.Mesh(g, mat);
  };
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6, ...o });
  const loader = new THREE.TextureLoader();
  const tex = url => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  // ---------------- chip level
  const chip = new THREE.Group(); scene.add(chip);
  const zBase = Z.BSM3[0] - 40;
  chip.add(box(dx0, dy0, dx1, dy1, zBase - 60, zBase, std(0x1b1f29)));               // backside carrier (visual base)
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(dx1 - dx0, dy1 - dy0, 1)),
    new THREE.LineBasicMaterial({ color: 0x9aa3b5 }));
  edge.position.set((dx0 + dx1) / 2, (dy0 + dy1) / 2, Z.M9[1] + 5); chip.add(edge);

  // backside power stripes: exact rectangles from add_stripes
  const sCol = { BSM1: 0x3a3060, BSM2: 0x302754, BSM3: 0x5a48a8 };
  const backside = new THREE.Group(); chip.add(backside);
  for (const s of CHIP.stripes) {
    const [x0, y0, x1, y1] = s.rect;
    backside.add(box(x0, y0, x1, y1, Z[s.layer][0], Z[s.layer][1], std(sCol[s.layer], { metalness: 0.6, roughness: 0.4 })));
  }

  // macros: blocks FEOL..M9 (signals M0-M9 per the macro scripts), routing render on top
  const macroTex = { u_acc: 'tex_npu_acc.webp', u_sram0: 'tex_lram_256x32.webp', u_sram1: 'tex_lram_256x32.webp' };
  for (const m of CHIP.macros) {
    const [x0, y0, x1, y1] = m.rect;
    const side = std(0x2f6e3a);
    const top = new THREE.MeshStandardMaterial({ map: tex('../assets/gaa/' + macroTex[m.inst]), roughness: 0.8, metalness: 0 });
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, Z.M9[1] - Z.GATE[0]);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (Z.GATE[0] + Z.M9[1]) / 2);
    chip.add(new THREE.Mesh(g, [side, side, side, side, top, side]));
  }

  // cell band: real routing render as the band surface, just above M3 (internal nets use M0-M3)
  const [bx0, by0, bx1, by1] = CHIP.band;
  const bandTex = { routing: tex('../assets/gaa/band_routing.webp'), placement: tex('../assets/gaa/band_placement.webp') };
  const bandMat = new THREE.MeshBasicMaterial({ map: bandTex.routing, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const bandPlane = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0, by1 - by0), bandMat);
  bandPlane.position.set((bx0 + bx1) / 2, (by0 + by1) / 2, Z.M3[1] + 6); chip.add(bandPlane);

  // pins: M5, top edge
  const pinMat = std(0xf2f2f2, { emissive: 0x666666 });
  const pinGeo = new THREE.BoxGeometry(42, 400, Z.M5[1] - Z.M5[0]);
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, CHIP.pins.length);
  const mtx = new THREE.Matrix4();
  CHIP.pins.forEach(([x, y], i) => { mtx.makeTranslation(x, y - 200, (Z.M5[0] + Z.M5[1]) / 2); pins.setMatrixAt(i, mtx); });
  chip.add(pins);

  // ---------------- row level: BPR rails on every band row boundary (followpins), exact pitch
  const [sw, sh] = CHIP.site;
  const railGeo = new THREE.BoxGeometry(bx1 - bx0, 24, Z.BPR[1] - Z.BPR[0]);
  const rails = new THREE.InstancedMesh(railGeo, std(0xa58cff, { metalness: 0.3, roughness: 0.6 }), CHIP.rows + 1);
  for (let i = 0; i <= CHIP.rows; i++) { mtx.makeTranslation((bx0 + bx1) / 2, by0 + i * sh, (Z.BPR[0] + Z.BPR[1]) / 2); rails.setMatrixAt(i, mtx); }
  scene.add(rails);
  // occupied (even) rows: faint site strips so the alternate-row pattern is visible
  const rowGeo = new THREE.PlaneGeometry(bx1 - bx0, sh);
  const rowMat = new THREE.MeshBasicMaterial({ color: 0x2c3446, transparent: true, opacity: 0.55 });
  const rowsOcc = new THREE.InstancedMesh(rowGeo, rowMat, Math.ceil(CHIP.rows / 2));
  for (let i = 0; i < CHIP.rows; i += 2) { mtx.makeTranslation((bx0 + bx1) / 2, by0 + (i + 0.5) * sh, Z.BPR[0] - 3); rowsOcc.setMatrixAt(i / 2, mtx); }
  scene.add(rowsOcc);

  // ---------------- cell level: library cells with nanosheets, at a legal site on an even row
  const cellGroup = new THREE.Group(); scene.add(cellGroup);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0d1016, transparent: true, opacity: 0.5 });
  const gateMats = [];
  for (const ex of CHIP.examples) {
    const c = CELLS[ex.cell];
    for (const l of c.layers) {
      const isGate = / gate$/.test(l.name), isSheet = /nanosheet/.test(l.name);
      const m = std(l.color, { metalness: isSheet ? 0.05 : 0.35, roughness: isSheet ? 0.45 : 0.55,
        transparent: isGate, opacity: isGate ? 0.3 : 1, depthWrite: !isGate });
      if (isGate) gateMats.push(m);
      for (let i = 0; i < l.rects.length; i += 4) {
        const [x0, y0, x1, y1] = l.rects.slice(i, i + 4);
        const mesh = box(ex.x + x0, ex.y + y0, ex.x + x1, ex.y + y1, l.z0, l.z1, m);
        cellGroup.add(mesh);
        if (!isGate) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat); cellGroup.add(e); }
      }
    }
  }
  const nand = CHIP.examples.find(e => e.cell === 'nand2_x1') || CHIP.examples[0];
  const nandC = CELLS[nand.cell];
  const nGate = nandC.layers.find(l => l.name === 'nFET gate').rects.slice(0, 4);
  const act = nandC.layers.find(l => l.name === 'nFET S/D').rects;
  const actY = (act[1] + act[3]) / 2;

  // ---------------- levels
  const midZ = (Z.BSM3[0] + Z.M9[1]) / 2;
  const L = {
    chip: { t: new THREE.Vector3((dx0 + dx1) / 2, (dy0 + dy1) / 2, midZ), d: 190000, dir: [0.0, -0.62, 1] },
    band: { t: new THREE.Vector3((bx0 + bx1) / 2, (by0 + by1) / 2, Z.M3[1]), d: 70000, dir: [-0.25, -0.7, 1] },
    rows: { t: new THREE.Vector3(nand.x + 60, nand.y + 36, 200), d: 2600, dir: [-0.5, -0.8, 0.7] },
    cell: { t: new THREE.Vector3(nand.x + 60, nand.y + 36, 190), d: 700, dir: [-0.55, -0.85, 0.5] },
    fet: { t: new THREE.Vector3(nand.x + (nGate[0] + nGate[2]) / 2, nand.y + actY, (Z.ACT2[0] + Z.ACT2[1]) / 2), d: 150, dir: [-0.35, -1, 0.3] },
  };
  let anim = null;
  function fly(key, ms = 1700) {
    const v = L[key];
    const endPos = v.t.clone().addScaledVector(new THREE.Vector3(...v.dir).normalize(), v.d);
    anim = { t0: performance.now(), ms, p0: camera.position.clone(), q0: controls.target.clone(), p1: endPos, q1: v.t.clone(),
      d0: camera.position.distanceTo(controls.target), d1: v.d };
    root.querySelectorAll('[data-lv]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lv === key));
  }
  function step(now) {
    if (!anim) return;
    let u = Math.min(1, (now - anim.t0) / anim.ms); u = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const tgt = anim.q0.clone().lerp(anim.q1, u);
    // interpolate distance on a log scale so a 1000x zoom feels even
    const d = Math.exp(Math.log(anim.d0) + (Math.log(anim.d1) - Math.log(anim.d0)) * u);
    const dir0 = anim.p0.clone().sub(anim.q0).normalize(), dir1 = anim.p1.clone().sub(anim.q1).normalize();
    const dir = dir0.lerp(dir1, u).normalize();
    camera.position.copy(tgt).addScaledVector(dir, d); controls.target.copy(tgt);
    if (u >= 1) anim = null;
  }

  // ---------------- level of detail by camera distance
  const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + ' µm' : n.toFixed(0) + ' nm';
  function lod() {
    const d = camera.position.distanceTo(controls.target);
    // band surface fades out between 9 and 3 µm so the rows and cells underneath appear
    const a = THREE.MathUtils.clamp((d - 3000) / 6000, 0, 1);
    bandMat.opacity = a; bandPlane.visible = a > 0.01;
    rails.visible = d < 20000; rowsOcc.visible = d < 20000;
    cellGroup.visible = d < 12000;
    pins.visible = d < 60000;
    const w = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    $('#k3d-scale').textContent = `field of view ≈ ${fmt(w)} wide`;
    const lvl = d > 100000 ? 'chip' : d > 9000 ? 'band' : d > 1200 ? 'rows' : d > 300 ? 'cell' : 'fet';
    $('#k3d-level').textContent = { chip: 'Whole chip: floorplan, macros, routed cell band (DEF render), pins',
      band: 'Cell band: CPU, lockstep shadow and npu_dma, real routing from the DEF',
      rows: 'Rows: BPR rails on every row edge; cells on every second row only',
      cell: 'Library cells on a legal row: INV, NAND2, DFF (scale example)',
      fet: 'One transistor: 3 nanosheets, gate all around, nFET on top of pFET' }[lvl];
    // tags
    tags.forEach(t => {
      const show = t.when(d) && tagsOn;
      if (!show) { t.el.style.display = 'none'; return; }
      const v = t.p.clone().project(camera);
      if (v.z > 1) { t.el.style.display = 'none'; return; }
      const r = renderer.domElement.getBoundingClientRect();
      t.el.style.display = '';
      t.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-50%, -50%)`;
    });
  }

  // ---------------- labels
  const tags = [];
  const tag = (txt, p, when, cls = '') => { const el = document.createElement('span'); el.className = 'k3d-tag ' + cls; el.textContent = txt;
    tagLayer.appendChild(el); tags.push({ el, p, when }); };
  for (const m of CHIP.macros) {
    const [x0, y0, x1, y1] = m.rect;
    tag(m.inst + (m.inst === 'u_acc' ? ' · 8×8 INT8 array' : ' · 1 KB SRAM'), new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, Z.M9[1]), d => d > 25000);
  }
  for (const r of CHIP.regions) {
    const [x0, y0, x1, y1] = r.rect;
    tag(r.type === 'fence' ? 'lockstep shadow core (fence)' : 'Ibex core (region)', new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, Z.M3[1]), d => d > 25000 && d < 400000);
  }
  tag(`${CHIP.pins.length} pins · ${CHIP.pin_layer}`, new THREE.Vector3((CHIP.pins[0][0] + CHIP.pins.at(-1)[0]) / 2, dy1 + 3000, Z.M5[1]), d => d > 25000);
  tag('example cells ▾', new THREE.Vector3(nand.x + 60, nand.y + 400, Z.M3[1]), d => d < 30000 && d > 2500, 'hl');
  tag('BPR rail · VDD/VSS', new THREE.Vector3(nand.x - 400, nand.y, Z.BPR[1]), d => d < 4000 && d > 400);
  tag('nFET · tier 2', new THREE.Vector3(nand.x - 40, nand.y + actY, (Z.ACT2[0] + Z.ACT2[1]) / 2), d => d <= 1500);
  tag('pFET · tier 1', new THREE.Vector3(nand.x - 40, nand.y + actY, (Z.ACT[0] + Z.ACT[1]) / 2), d => d <= 1500);
  tag('nanosheets', new THREE.Vector3(nand.x + (nGate[0] + nGate[2]) / 2, nand.y + actY - 30, Z.ACT2[1] + 12), d => d <= 320, 'hl');
  let tagsOn = true;

  // ---------------- UI
  root.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => fly(b.dataset.lv));
  $('#k3d-band').onchange = e => { bandMat.map = bandTex[e.target.value]; bandMat.needsUpdate = true; };
  $('#k3d-back').onchange = e => { backside.visible = e.target.checked; };
  $('#k3d-gate').oninput = e => { gateMats.forEach(m => { m.opacity = +e.target.value / 100; }); $('#k3d-gate-out').textContent = e.target.value + '%'; };
  $('#k3d-tags-btn').onclick = e => { tagsOn = !tagsOn; e.target.setAttribute('aria-pressed', tagsOn); };

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();
  const c0 = L.chip; camera.position.copy(c0.t).addScaledVector(new THREE.Vector3(...c0.dir).normalize(), c0.d * (camera.aspect < 1 ? 1.7 : 1));
  controls.target.copy(c0.t);
  renderer.setAnimationLoop(now => {
    step(now); controls.update();
    const d = camera.position.distanceTo(controls.target);
    camera.near = Math.max(0.05, d / 2000); camera.far = d * 40 + 400000; camera.updateProjectionMatrix();
    lod(); renderer.render(scene, camera);
  });
}
