// Unit-delay switch-level simulation of CMOS transistor networks.
// Each transistor is an ideal switch: nFET conducts when its gate is 1, pFET when its gate is 0.
// One step: find the switch-connected groups of nodes; a group touching only VDD/1-drivers goes to 1, only VSS/0-drivers
// to 0, both to X (a fight); a group touching no driver keeps its stored charge (previous value).
// All nodes update together from the previous step's gate values, so a change ripples one transistor stage per step.

export function makeCircuit(cells) {
  // cells: [{ prefix, devices:[{t,g,a,b,x}], alias:{localNet: globalNet} }]
  const devs = [];
  const name = (c, n) => (n === 'VDD' || n === 'VSS') ? n : (c.alias[n] || c.prefix + '/' + n);
  for (const c of cells) for (const d of c.devices)
    devs.push({ t: d.t, g: name(c, d.g), a: name(c, d.a), b: name(c, d.b), cell: c.prefix, x: d.x, local: d });
  const nodes = new Set(['VDD', 'VSS']);
  for (const d of devs) { nodes.add(d.g); nodes.add(d.a); nodes.add(d.b); }
  return { devs, nodes: [...nodes] };
}

export const isOn = (d, v) => (d.t === 'n' ? v[d.g] === 1 : v[d.g] === 0);

export function step(circ, v, drivers) {
  // drivers: {node: 0|1} for primary inputs (VDD/VSS are added here)
  const drv = { ...drivers, VDD: 1, VSS: 0 };
  const parent = {};
  const find = n => { while (parent[n] !== n) { parent[n] = parent[parent[n]]; n = parent[n]; } return n; };
  for (const n of circ.nodes) parent[n] = n;
  const on = circ.devs.filter(d => isOn(d, v));
  // drivers (VDD, VSS, inputs) are ideal sources: they never merge the groups on either side of them
  for (const d of on) {
    if (d.a in drv || d.b in drv) continue;
    const ra = find(d.a), rb = find(d.b); if (ra !== rb) parent[ra] = rb;
  }
  const has = {};
  const mark = (n, val) => { const r = find(n); (has[r] ||= { 0: false, 1: false })[val] = true; };
  for (const d of on) {
    if (d.a in drv && !(d.b in drv)) mark(d.b, drv[d.a]);
    if (d.b in drv && !(d.a in drv)) mark(d.a, drv[d.b]);
  }
  const nv = {};
  for (const n of circ.nodes) {
    if (n in drv) { nv[n] = drv[n]; continue; }
    const h = has[find(n)];
    nv[n] = !h ? v[n] : (h[1] && h[0]) ? 'X' : h[1] ? 1 : 0;
  }
  return nv;
}

// Run to a stable state; returns every intermediate state (state[0] = start) and, per step, the transistors that carried
// current (on, and connecting a node that changed in that step) with the direction of conventional current.
export function settle(circ, v0, drivers, maxSteps = 40) {
  const states = [{ ...v0, ...drivers }], flows = [];
  let v = states[0];
  for (let i = 0; i < maxSteps; i++) {
    const nv = step(circ, v, drivers);
    const changed = circ.nodes.filter(n => nv[n] !== v[n]);
    if (!changed.length) break;
    const ch = new Set(changed), f = [];
    for (const d of circ.devs) {
      if (!isOn(d, v)) continue;
      // current flows into a node that rises and out of a node that falls
      if (ch.has(d.b) && nv[d.b] === 1 || ch.has(d.a) && nv[d.a] === 0) f.push({ d, dir: +1 });      // a -> b
      else if (ch.has(d.a) && nv[d.a] === 1 || ch.has(d.b) && nv[d.b] === 0) f.push({ d, dir: -1 }); // b -> a
    }
    flows.push(f); states.push(nv); v = nv;
  }
  return { states, flows };
}
