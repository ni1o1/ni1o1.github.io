'use strict';

let N = 0;
let CORE_N = 0;
let CORE_OFFSET = 0;
let entriesPerEdge = 6;
let heightField = null;
let flyable = null;
let maxHeightWeight = 1;
let padM = 0;
let uavSepM = 0;
let gateRank = new Map();

const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
const SAFETY_M = 4;
const CELL = 10;
const BOUNDARY_SNAP_M = 60;
const WEIGHT_CENTER = 65;
const WEIGHT_SIGMA = 22;
const MAX_PACK_CANDIDATES = 1200;

const idx = (i, j) => j * N + i;
const heightWeight = alt => Math.exp(-((alt - WEIGHT_CENTER) ** 2) / (2 * WEIGHT_SIGMA ** 2));
const isCoreCell = (i, j) => i >= CORE_OFFSET && i < CORE_OFFSET + CORE_N && j >= CORE_OFFSET && j < CORE_OFFSET + CORE_N;

class MinHeap {
  constructor() { this.n = []; this.p = []; }
  get size() { return this.n.length; }
  push(node, prio) {
    this.n.push(node); this.p.push(prio);
    let c = this.n.length - 1;
    while (c > 0) {
      const parent = (c - 1) >> 1;
      if (this.p[parent] <= this.p[c]) break;
      this.swap(parent, c); c = parent;
    }
  }
  pop() {
    const node = this.n[0], prio = this.p[0];
    const last = this.n.length - 1;
    this.n[0] = this.n[last]; this.p[0] = this.p[last];
    this.n.pop(); this.p.pop();
    let c = 0;
    while (true) {
      const l = c * 2 + 1, r = l + 1;
      let s = c;
      if (l < this.n.length && this.p[l] < this.p[s]) s = l;
      if (r < this.n.length && this.p[r] < this.p[s]) s = r;
      if (s === c) break;
      this.swap(c, s); c = s;
    }
    return { node, prio };
  }
  swap(a, b) {
    [this.n[a], this.n[b]] = [this.n[b], this.n[a]];
    [this.p[a], this.p[b]] = [this.p[b], this.p[a]];
  }
}

function computeFlyable(alt) {
  flyable = new Uint8Array(N * N);
  let count = 0;
  let coreCount = 0;
  const pad = Number.isFinite(padM) ? padM : SAFETY_M;
  for (let k = 0; k < N * N; k++) {
    flyable[k] = heightField[k] + pad <= alt ? 1 : 0;
    count += flyable[k];
    const i = k % N, j = (k / N) | 0;
    if (isCoreCell(i, j)) coreCount += flyable[k];
  }
  return {
    all: count / (N * N),
    core: coreCount / (CORE_N * CORE_N),
  };
}

function snapInward(edge, a) {
  const depth = Math.max(1, Math.round(BOUNDARY_SNAP_M / CELL));
  for (let d = 0; d < depth; d++) {
    let i = 0, j = 0;
    if (edge === 'top') { i = a; j = d; }
    else if (edge === 'bottom') { i = a; j = N - 1 - d; }
    else if (edge === 'left') { i = d; j = a; }
    else { i = N - 1 - d; j = a; }
    const k = idx(i, j);
    if (flyable[k]) return k;
  }
  return null;
}

function collectEdgeGates(edge) {
  const unique = [];
  const seen = new Set();
  const runs = [];
  let run = [];
  for (let a = 0; a < N; a++) {
    const k = snapInward(edge, a);
    if (k == null) {
      if (run.length) { runs.push(run); run = []; }
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    const g = { k, a };
    unique.push(g);
    run.push(g);
  }
  if (run.length) runs.push(run);
  return { unique, runs };
}

// Nested picks: first one doorway per opening (longest first), then fill the
// largest remaining gaps. The n-set is always a prefix of the (n+1)-set, so
// adding entries cannot drop a previously chosen gate.
function nestedGateOrder(unique, runs) {
  const order = [];
  const have = new Set();
  const add = g => {
    if (!g || have.has(g.k)) return;
    have.add(g.k);
    order.push(g);
  };
  const byLen = runs.map(r => r).sort((a, b) => b.length - a.length || a[0].a - b[0].a);
  for (const r of byLen) add(r[(r.length / 2) | 0]);
  while (order.length < unique.length) {
    let best = null;
    let bestScore = -1;
    for (const g of unique) {
      if (have.has(g.k)) continue;
      let minD = Infinity;
      for (const p of order) {
        const d = Math.abs(g.a - p.a);
        if (d < minD) minD = d;
      }
      if (minD > bestScore || (minD === bestScore && g.a < (best ? best.a : Infinity))) {
        bestScore = minD;
        best = g;
      }
    }
    if (!best) break;
    add(best);
  }
  return order;
}

function boundaryAnchors(alt) {
  const anchors = [];
  const pick = (edge) => {
    const { unique, runs } = collectEdgeGates(edge);
    if (!unique.length) return;
    const order = nestedGateOrder(unique, runs);
    const want = Math.min(entriesPerEdge, order.length);
    for (let i = 0; i < order.length; i++) {
      const key = `${alt}:${order[i].k}`;
      const prev = gateRank.get(key);
      if (prev == null || i < prev) gateRank.set(key, i);
    }
    for (let i = 0; i < want; i++) anchors.push(order[i].k);
  };
  pick('top');
  pick('bottom');
  pick('left');
  pick('right');
  return anchors;
}

function dijkstra(src) {
  const size = N * N;
  const dist = new Float64Array(size);
  const prev = new Int32Array(size);
  dist.fill(Infinity);
  prev.fill(-1);
  const heap = new MinHeap();
  dist[src] = 0;
  heap.push(src, 0);
  while (heap.size) {
    const { node: u, prio: du } = heap.pop();
    if (du > dist[u]) continue;
    const ui = u % N, uj = (u / N) | 0;
    for (const [di, dj, w] of NB) {
      const ni = ui + di, nj = uj + dj;
      if (ni < 0 || ni >= N || nj < 0 || nj >= N) continue;
      const v = idx(ni, nj);
      if (!flyable[v]) continue;
      if (di && dj && (!flyable[idx(ni, uj)] || !flyable[idx(ui, nj)])) continue;
      const nd = du + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        heap.push(v, nd);
      }
    }
  }
  return { dist, prev };
}

function edgeOf(k) {
  const i = k % N, j = (k / N) | 0;
  const depth = Math.max(1, Math.round(BOUNDARY_SNAP_M / CELL));
  if (j <= depth) return 'top';
  if (j >= N - 1 - depth) return 'bottom';
  if (i <= depth) return 'left';
  if (i >= N - 1 - depth) return 'right';
  return 'inner';
}

function allowedPair(a, b) {
  const ea = edgeOf(a), eb = edgeOf(b);
  return (ea === 'top' && eb === 'bottom') || (ea === 'bottom' && eb === 'top') ||
    (ea === 'left' && eb === 'right') || (ea === 'right' && eb === 'left');
}

function familyOf(cells) {
  const ea = edgeOf(cells[0]), eb = edgeOf(cells[cells.length - 1]);
  if ((ea === 'left' || ea === 'right') && (eb === 'left' || eb === 'right')) return 'EW';
  return 'NS';
}

function samplePathMeters(cells, alt) {
  const step = Math.max(1, Math.floor(cells.length / 28));
  const pts = [];
  for (let i = 0; i < cells.length; i += step) {
    const k = cells[i];
    pts.push((k % N) * CELL, alt, ((k / N) | 0) * CELL);
  }
  const last = cells[cells.length - 1];
  pts.push((last % N) * CELL, alt, ((last / N) | 0) * CELL);
  return pts;
}

function pathOverlapTooLong(aPts, bPts, sepM) {
  const sep2 = sepM * sepM;
  let aMinX = Infinity, aMaxX = -Infinity, aMinY = Infinity, aMaxY = -Infinity, aMinZ = Infinity, aMaxZ = -Infinity;
  for (let i = 0; i < aPts.length; i += 3) {
    const x = aPts[i], y = aPts[i + 1], z = aPts[i + 2];
    if (x < aMinX) aMinX = x; if (x > aMaxX) aMaxX = x;
    if (y < aMinY) aMinY = y; if (y > aMaxY) aMaxY = y;
    if (z < aMinZ) aMinZ = z; if (z > aMaxZ) aMaxZ = z;
  }
  let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity, bMinZ = Infinity, bMaxZ = -Infinity;
  for (let i = 0; i < bPts.length; i += 3) {
    const x = bPts[i], y = bPts[i + 1], z = bPts[i + 2];
    if (x < bMinX) bMinX = x; if (x > bMaxX) bMaxX = x;
    if (y < bMinY) bMinY = y; if (y > bMaxY) bMaxY = y;
    if (z < bMinZ) bMinZ = z; if (z > bMaxZ) bMaxZ = z;
  }
  if (aMaxX < bMinX - sepM || bMaxX < aMinX - sepM ||
      aMaxY < bMinY - sepM || bMaxY < aMinY - sepM ||
      aMaxZ < bMinZ - sepM || bMaxZ < aMinZ - sepM) return false;
  const closeFrac = (pts, other) => {
    let close = 0;
    const n = pts.length / 3;
    for (let i = 0; i < pts.length; i += 3) {
      let near = false;
      for (let j = 0; j < other.length; j += 3) {
        const dx = pts[i] - other[j];
        const dy = pts[i + 1] - other[j + 1];
        const dz = pts[i + 2] - other[j + 2];
        if (dx * dx + dy * dy + dz * dz < sep2) { near = true; break; }
      }
      if (near) close++;
    }
    return close / Math.max(1, n);
  };
  // Crossing at one junction is allowed. Parallel/stacked corridors (same XY, different height) are not.
  return closeFrac(aPts, bPts) > 0.22 || closeFrac(bPts, aPts) > 0.22;
}

function rankOf(alt, k) {
  const v = gateRank.get(`${alt}:${k}`);
  return v == null ? 99 : v;
}

function pathGeneration(alt, cells) {
  return Math.max(rankOf(alt, cells[0]), rankOf(alt, cells[cells.length - 1]));
}

function orderCandidates(results) {
  const out = [];
  for (const r of results) {
    for (const cells of r.paths) {
      out.push({
        alt: r.alt,
        cells,
        gen: pathGeneration(r.alt, cells),
        fam: familyOf(cells),
      });
    }
  }
  // Coarse (few-entry) pairs first, then denser ones; within a generation,
  // prefer the cruise band. Prefix-stable as entriesPerEdge grows.
  out.sort((a, b) =>
    a.gen - b.gen ||
    Math.abs(a.alt - WEIGHT_CENTER) - Math.abs(b.alt - WEIGHT_CENTER) ||
    a.alt - b.alt ||
    (a.fam === 'EW' && b.fam !== 'EW' ? -1 : a.fam !== 'EW' && b.fam === 'EW' ? 1 : 0) ||
    a.cells.length - b.cells.length);
  if (out.length > MAX_PACK_CANDIDATES) out.length = MAX_PACK_CANDIDATES;
  return out;
}

function thinAll3D(results, sepM) {
  const ordered = orderCandidates(results);
  const samples = ordered.map(p => samplePathMeters(p.cells, p.alt));
  const keepMask = new Array(ordered.length).fill(false);
  const keptIdx = [];
  for (let i = 0; i < ordered.length; i++) {
    let close = false;
    if (sepM > 0) {
      for (const j of keptIdx) {
        if (pathOverlapTooLong(samples[i], samples[j], sepM)) { close = true; break; }
      }
    }
    if (close) continue;
    keepMask[i] = true;
    keptIdx.push(i);
  }
  const byAlt = new Map();
  for (let i = 0; i < ordered.length; i++) {
    if (!keepMask[i]) continue;
    const alt = ordered[i].alt;
    if (!byAlt.has(alt)) byAlt.set(alt, []);
    byAlt.get(alt).push(ordered[i].cells);
  }
  for (const r of results) r.paths = byAlt.get(r.alt) || [];
}

function routePathsForAltitude(alt) {
  const flyPct = computeFlyable(alt);
  const anchors = boundaryAnchors(alt);
  const paths = [];
  const weight = heightWeight(alt) / maxHeightWeight;
  const flyableOut = new Uint8Array(flyable);
  if (anchors.length >= 2) {
    const solved = anchors.map(a => ({ a, ...dijkstra(a) }));
    for (let p = 0; p < anchors.length; p++) {
      const { dist, prev } = solved[p];
      for (let q = p + 1; q < anchors.length; q++) {
        const target = anchors[q];
        if (!allowedPair(anchors[p], target) || dist[target] === Infinity) continue;
        const cells = [];
        let cur = target, guard = 0;
        while (cur !== -1 && guard++ < N * N) {
          cells.push(cur);
          if (cur === anchors[p]) break;
          cur = prev[cur];
        }
        if (cells[cells.length - 1] !== anchors[p]) continue;
        cells.reverse();
        paths.push(cells);
      }
    }
  }
  return { alt, flyPct, anchors, paths, pathCount: paths.length, weight, flyable: flyableOut };
}

self.onmessage = event => {
  const data = event.data;
  if (data.type !== 'compute') return;
  N = data.N;
  CORE_N = data.CORE_N;
  CORE_OFFSET = data.CORE_OFFSET;
  entriesPerEdge = data.entriesPerEdge;
  maxHeightWeight = data.maxHeightWeight || 1;
  padM = Number.isFinite(data.padM) ? data.padM : SAFETY_M;
  uavSepM = Number.isFinite(data.uavSepM) ? data.uavSepM : 0;
  heightField = new Float32Array(data.heightFieldBuffer);
  gateRank = new Map();

  const results = [];
  for (const alt of data.altitudes) results.push(routePathsForAltitude(alt));
  thinAll3D(results, uavSepM);

  for (const result of results) {
    result.pathCount = result.paths.length;
    self.postMessage({
      type: 'altResult',
      version: data.version,
      result: {
        alt: result.alt,
        flyPct: result.flyPct,
        anchors: result.anchors,
        paths: result.paths,
        pathCount: result.pathCount,
        weight: result.weight,
        flyable: result.flyable.buffer,
      },
    }, [result.flyable.buffer]);
  }
  self.postMessage({ type: 'done', version: data.version });
};
