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

const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
const SAFETY_M = 4;
const CELL = 10;
const BOUNDARY_SNAP_M = 60;
const WEIGHT_CENTER = 65;
const WEIGHT_SIGMA = 22;
const MAX_RETURN_PATHS_PER_ALT = 40;

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

// 先找出边上所有未被挡住的开口，再把 N 个入口均匀铺到这些开口上。
// 不要在整条边上均匀取样再往里吸附：那样会把多个被楼挡住的槽位挤进同一个口。
function boundaryAnchors() {
  const anchors = [];
  const pick = (edge) => {
    const runs = [];
    let run = [];
    for (let a = 0; a < N; a++) {
      const k = snapInward(edge, a);
      if (k != null) run.push(k);
      else if (run.length) { runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
    if (!runs.length) return;
    const total = runs.reduce((s, r) => s + r.length, 0);
    const want = Math.min(entriesPerEdge, total);
    const seen = new Set();
    for (let t = 0; t < want; t++) {
      let pos = (t + 0.5) / want * total;
      let acc = 0;
      for (const r of runs) {
        if (acc + r.length > pos) {
          const k = r[Math.min(r.length - 1, Math.floor(pos - acc))];
          if (!seen.has(k)) { seen.add(k); anchors.push(k); }
          break;
        }
        acc += r.length;
      }
    }
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

function orderCandidates(results) {
  const ranked = results.slice().sort((a, b) =>
    Math.abs(a.alt - WEIGHT_CENTER) - Math.abs(b.alt - WEIGHT_CENTER) || a.alt - b.alt);
  const out = [];
  for (const r of ranked) {
    const ew = [];
    const ns = [];
    for (const cells of r.paths) {
      (familyOf(cells) === 'EW' ? ew : ns).push(cells);
    }
    const byEnds = (a, b) => a[0] - b[0] || a[a.length - 1] - b[b.length - 1] || a.length - b.length;
    ew.sort(byEnds);
    ns.sort(byEnds);
    const mixed = [];
    for (let i = 0; i < Math.max(ew.length, ns.length); i++) {
      if (ew[i]) mixed.push(ew[i]);
      if (ns[i]) mixed.push(ns[i]);
    }
    r.orderedPaths = mixed.slice(0, MAX_RETURN_PATHS_PER_ALT);
    for (const cells of r.orderedPaths) out.push({ alt: r.alt, cells });
  }
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
  const anchors = boundaryAnchors();
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
