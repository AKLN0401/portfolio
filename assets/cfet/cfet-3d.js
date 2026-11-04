// Interactive 3D view of MATRIX-A5 CFET standard cells, including the GAA nanosheets.
// Geometry: assets/cfet/cells.js, from the PDK cell GDS.
// All x/y come from the GDS; all z come from the PDK's StarRC ITF and QRC ICT; sheet count, thickness and
// gap come from the PDK's BSIM-CMG card. True scale in all three axes (nm).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CELLS } from './cells.js';

const root = document.getElementById('cfet3d');
if (root) init(root);

function init(root) {
  const stage = root.querySelector('.c3d-stage');
  const tags = root.querySelector('.c3d-tags');
  const $ = s => root.querySelector(s);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
  catch (e) { root.classList.add('c3d-nogl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x0d1016);
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-300, -500, 900); scene.add(sun);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 20000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.addEventListener('change', () => clipRange());
  let dirty = true;                                   // render only when something changed
  const kick = () => { dirty = true; };

  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);
  const group = new THREE.Group(); scene.add(group);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0d1016, transparent: true, opacity: 0.55, clippingPlanes: [clip] });
  let meshes = [], cell = null, center = new THREE.Vector3();

  const GROUPS = ['Backside', 'Tier 1 · pFET', 'Tier 2 · nFET', 'Device vias', 'Front metal'];
  const on = Object.fromEntries(GROUPS.map(g => [g, true]));
  let gateOpacity = 0.35;

  function mat(l) {
    const isGate = / gate$/.test(l.name);
    const isSheet = /nanosheet/.test(l.name);
    return new THREE.MeshStandardMaterial({
      color: l.color, metalness: isSheet ? 0.05 : 0.35, roughness: isSheet ? 0.45 : 0.55,
      transparent: isGate, opacity: isGate ? gateOpacity : 1, depthWrite: !isGate,
      side: THREE.DoubleSide, clippingPlanes: [clip],
    });
  }

  function build(key) {
    group.clear(); meshes = [];
    cell = CELLS[key];
    const [px0, py0, px1, py1] = cell.pr_nm;
    center.set((px0 + px1) / 2, (py0 + py1) / 2, 160);
    for (const l of cell.layers) {
      const m = mat(l);
      // one mesh and one edge set per layer (instead of one per rectangle): far fewer draw calls
      const geos = [];
      for (let i = 0; i < l.rects.length; i += 4) {
        const [x0, y0, x1, y1] = l.rects.slice(i, i + 4);
        const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, l.z1 - l.z0);
        g.translate((x0 + x1) / 2, (y0 + y1) / 2, (l.z0 + l.z1) / 2);
        geos.push(g);
      }
      for (const p of l.polys) {
        const s = new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ExtrudeGeometry(s, { depth: l.z1 - l.z0, bevelEnabled: false });
        g.translate(0, 0, l.z0); geos.push(g);
      }
      if (!geos.length) continue;
      const mesh = new THREE.Mesh(merge(geos, ['position', 'normal']), m);
      mesh.userData = { layer: l };
      mesh.renderOrder = / gate$/.test(l.name) ? 2 : 1;
      group.add(mesh); meshes.push(mesh);
      if (!/ gate$/.test(l.name)) {
        const e = new THREE.LineSegments(merge(geos.map(g => new THREE.EdgesGeometry(g)), ['position']), edgeMat);
        e.userData = { layer: l }; group.add(e); meshes.push(e);
      }
      geos.forEach(g => g.dispose());
    }
    // cell outline (prBoundary) on the BPR bottom face
    const ob = new THREE.BufferGeometry().setFromPoints([[px0, py0], [px1, py0], [px1, py1], [px0, py1], [px0, py0]]
      .map(([x, y]) => new THREE.Vector3(x, y, 0)));
    const outline = new THREE.Line(ob, new THREE.LineDashedMaterial({ color: 0x9aa3b5, dashSize: 4, gapSize: 3 }));
    outline.computeLineDistances(); group.add(outline);
    applyVis(); setSection(); info(); placeTags();
  }

  // concatenate geometries (non-indexed) into one
  function merge(list, attrs) {
    list = list.map(g => g.index ? g.toNonIndexed() : g);
    const out = new THREE.BufferGeometry();
    for (const a of attrs) {
      const n = list.reduce((k, g) => k + g.attributes[a].array.length, 0);
      const arr = new Float32Array(n); let o = 0;
      for (const g of list) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; }
      out.setAttribute(a, new THREE.BufferAttribute(arr, 3));
    }
    out.computeBoundingSphere();
    return out;
  }

  function applyVis() {
    for (const m of meshes) m.visible = on[m.userData.layer.group];
    kick();
  }

  // ---- section plane
  const secAxis = $('#c3d-axis'), secPos = $('#c3d-cut');
  function setSection() {
    const [px0, py0, px1, py1] = cell.pr_nm;
    const f = +secPos.value / 1000;
    if (secAxis.value === 'none') { clip.set(new THREE.Vector3(0, 1, 0), 1e6); }
    else if (secAxis.value === 'y') { const y = py0 + f * (py1 - py0); clip.set(new THREE.Vector3(0, 1, 0), -y); $('#c3d-cut-out').textContent = `y = ${y.toFixed(1)} nm`; }
    else { const x = px0 + f * (px1 - px0); clip.set(new THREE.Vector3(1, 0, 0), -x); $('#c3d-cut-out').textContent = `x = ${x.toFixed(1)} nm`; }
    if (secAxis.value === 'none') $('#c3d-cut-out').textContent = 'off';
    secPos.disabled = secAxis.value === 'none';
    kick();
  }

  function info() {
    const s = cell.sheets;
    const act = cell.layers.find(l => l.name === 'nFET S/D');
    const gate = cell.layers.find(l => l.name === 'nFET gate');
    const wns = act ? Math.min(...chunks(act.rects).map(r => r[3] - r[1])) : NaN;
    const lg = gate ? Math.min(...chunks(gate.rects).map(r => r[2] - r[0])) : NaN;
    const [px0, py0, px1, py1] = cell.pr_nm;
    $('#c3d-info').innerHTML =
      `<b>${cell.cell}</b><br>${px1 - px0} &times; ${py1 - py0} nm cell &middot; ` +
      `${s.count} sheets per device, ${s.thickness_nm} nm thick, ${s.gap_nm} nm apart &middot; ` +
      `sheet width ${wns} nm, gate length ${lg} nm`;
  }
  const chunks = a => { const r = []; for (let i = 0; i < a.length; i += 4) r.push(a.slice(i, i + 4)); return r; };

  // ---- labels
  const TAGS = [
    { t: 'nFET · tier 2 (top)', z: 264, g: 'Tier 2 · nFET' },
    { t: 'pFET · tier 1 (bottom)', z: 146, g: 'Tier 1 · pFET' },
    { t: 'BPR · VDD / VSS', z: 21, g: 'Backside' },
    { t: 'M0', z: 336, g: 'Front metal' },
  ];
  const tagEls = TAGS.map(d => { const e = document.createElement('span'); e.className = 'c3d-tag'; e.textContent = d.t; tags.appendChild(e); return e; });
  let tagsOn = true;
  function placeTags() {
    if (!cell) return;
    const [px0, py0] = cell.pr_nm;
    const r = size;
    TAGS.forEach((d, i) => {
      const v = new THREE.Vector3(px0 - 30, py0, d.z).project(camera);
      const e = tagEls[i];
      e.style.display = tagsOn && on[d.g] && v.z < 1 ? '' : 'none';
      e.style.transform = `translate(${(v.x * 0.5 + 0.5) * r.width}px, ${(-v.y * 0.5 + 0.5) * r.height}px) translate(-100%, -50%)`;
    });
  }

  // ---- views
  function view(kind) {
    const [px0, py0, px1, py1] = cell.pr_nm;
    const zTop = Math.max(...cell.layers.map(l => l.z1));
    center.z = zTop / 2;
    const c = center.clone();
    // fit the cell's bounding sphere in the narrower of the two fields of view
    const r = 0.5 * Math.hypot(px1 - px0 + 45, py1 - py0, zTop);
    const half = Math.min(THREE.MathUtils.degToRad(camera.fov) / 2, Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect));
    const d = r / Math.sin(half) * 1.08;
    const dir = kind === 'iso' ? new THREE.Vector3(-0.5, -0.75, 0.43)
              : kind === 'section' ? new THREE.Vector3(0, -1, 0.001) : new THREE.Vector3(0, -0.001, 1);
    camera.position.copy(c).addScaledVector(dir.normalize(), d);
    controls.target.copy(c); zoom = null; fitD = d; clipRange(); controls.update(); kick();
  }

  // ---- zoom: eased, log-scale, toward the point under the cursor (replaces OrbitControls' fixed 5% steps)
  let zoom = null, fitD = 1000;
  const MIN_D = 12;                                   // nm from the target: close enough to see single sheets
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function clipRange() {
    const d = camera.position.distanceTo(controls.target);
    camera.near = Math.max(0.05, d / 200); camera.far = d * 40 + 5000; camera.updateProjectionMatrix();
  }
  function pointUnder(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const cut = secAxis.value !== 'none';
    const solid = m => m.isMesh && m.visible && !(/ gate$/.test(m.userData.layer.name) && gateOpacity < 0.5);   // look through see-through gates
    const hit = ray.intersectObjects(meshes.filter(solid), false)
      .find(h => !cut || clip.distanceToPoint(h.point) >= 0);
    if (hit) return hit.point;
    // nothing under the cursor: use the plane through the target, facing the camera
    const n = camera.getWorldDirection(new THREE.Vector3());
    return ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, controls.target), new THREE.Vector3());
  }
  function onWheel(e) {
    e.preventDefault(); e.stopPropagation();          // keep OrbitControls' stepped dolly out of it
    const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    const k = Math.exp(THREE.MathUtils.clamp(dy, -150, 150) * 0.0024);
    const cur = zoom || { d: camera.position.distanceTo(controls.target), t: controls.target.clone() };
    const d1 = THREE.MathUtils.clamp(cur.d * k, MIN_D, fitD * 4);
    const p = pointUnder(e), t1 = cur.t.clone();
    if (p) t1.lerp(p, 1 - d1 / cur.d);                // the point under the cursor stays put
    if (k < 1 && cur.d * k < MIN_D) {                 // at the closest distance: keep flying forward toward the cursor
      t1.addScaledVector(ray.ray.direction, MIN_D * (1 - k));
    }
    zoom = { d: d1, t: t1 }; kick();
  }
  stage.addEventListener('wheel', onWheel, { passive: false, capture: true });
  renderer.domElement.addEventListener('pointerdown', () => { zoom = null; });
  function stepZoom(dt) {
    if (!zoom) return;
    const f = 1 - Math.exp(-dt * 14);
    const off = camera.position.clone().sub(controls.target);
    const d0 = off.length();
    const d = Math.exp(Math.log(d0) + (Math.log(zoom.d) - Math.log(d0)) * f);
    controls.target.lerp(zoom.t, f);
    camera.position.copy(controls.target).addScaledVector(off.normalize(), d);
    if (Math.abs(Math.log(d / zoom.d)) < 1e-3 && controls.target.distanceTo(zoom.t) < d * 1e-4) zoom = null;
    clipRange(); dirty = true;
  }

  const size = { width: 1, height: 1 };
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    size.width = w; size.height = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); kick();
  }
  new ResizeObserver(resize).observe(stage);

  // ---- UI
  const sel = $('#c3d-cell');
  for (const [k, c] of Object.entries(CELLS)) { const o = document.createElement('option'); o.value = k; o.textContent = c.label; sel.appendChild(o); }
  sel.value = 'nand2_x1';
  sel.onchange = () => { build(sel.value); view('iso'); };
  const grpBox = $('#c3d-groups');
  for (const g of GROUPS) {
    const l = document.createElement('label');
    l.innerHTML = `<input type="checkbox" checked> ${g}`;
    l.querySelector('input').onchange = e => { on[g] = e.target.checked; applyVis(); };
    grpBox.appendChild(l);
  }
  $('#c3d-gate').oninput = e => {
    gateOpacity = +e.target.value / 100; $('#c3d-gate-out').textContent = `${e.target.value}%`;
    for (const m of meshes) if (/ gate$/.test(m.userData.layer.name)) m.material.opacity = gateOpacity;
    kick();
  };
  secAxis.onchange = () => { setSection(); if (secAxis.value === 'y') view('section'); };
  secPos.oninput = setSection;
  root.querySelectorAll('[data-view]').forEach(b => b.onclick = () => view(b.dataset.view));
  $('#c3d-tags-btn').onclick = e => { tagsOn = !tagsOn; e.target.setAttribute('aria-pressed', tagsOn); kick(); };

  resize(); build(sel.value); view("iso");
  // render on demand, and not at all while the viewer is off screen or the tab is hidden
  let onScreen = true, last = performance.now();
  const lastPos = new THREE.Vector3(), lastQ = new THREE.Quaternion();
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) kick(); }).observe(stage);
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!onScreen || document.hidden) return;
    stepZoom(dt);
    controls.update();
    // redraw only for visible camera motion: OrbitControls' own threshold is absolute and, in nm units,
    // keeps reporting sub-pixel damping for hundreds of frames
    const d = camera.position.distanceTo(controls.target), tol = 3e-4;      // ~1/3 pixel at 30 deg fov
    if (camera.position.distanceToSquared(lastPos) > (d * tol) ** 2 || 8 * (1 - Math.abs(lastQ.dot(camera.quaternion))) > tol * tol) dirty = true;
    if (!dirty) return;
    dirty = false; lastPos.copy(camera.position); lastQ.copy(camera.quaternion);
    renderer.render(scene, camera); placeTags();
  });
}
