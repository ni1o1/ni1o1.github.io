'use strict';

let N = 0;
let CORE_N = 0;
let CORE_OFFSET = 0;
let entriesPerEdge = 6;
let heightField = null;
let flyable = null;
let maxHeightWeight = 1;

const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
const SAFETY_M = 4;
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
  for (let k = 0; k < N * N; k++) {
    flyable[k] = heightField[k] + SAFETY_M < alt ? 1 : 0;
    count += flyable[k];
    const i = k % N, j = (k / N) | 0;
    if (isCoreCell(i, j)) coreCount += flyable[k];
  }
  return {
    all: count / (N * N),
    core: coreCount / (CORE_N * CORE_N),
  };
}

function boundaryAnchors() {
  const anchors = [];
  const pick = cells => {
    const ok = cells.filter(k => flyable[k]);
    if (!ok.length) return;
    const want = Math.min(entriesPerEdge, ok.length);
    for (let t = 0; t < want; t++) anchors.push(ok[Math.floor((t + 0.5) / want * ok.length)]);
  };
  const top = [], bottom = [], left = [], right = [];
  for (let i = 0; i < N; i++) {
    top.push(idx(i, 0)); bottom.push(idx(i, N - 1));
  }
  for (let j = 0; j < N; j++) {
    left.push(idx(0, j)); right.push(idx(N - 1, j));
  }
  [top, bottom, left, right].forEach(pick);
  return [...new Set(anchors)];
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
  if (j === 0) return 'top';
  if (j === N - 1) return 'bottom';
  if (i === 0) return 'left';
  if (i === N - 1) return 'right';
  return 'inner';
}

function allowedPair(a, b) {
  const ea = edgeOf(a), eb = edgeOf(b);
  return (ea === 'top' && eb === 'bottom') || (ea === 'bottom' && eb === 'top') ||
    (ea === 'left' && eb === 'right') || (ea === 'right' && eb === 'left');
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
  const pathCount = paths.length;
  let sampledPaths = paths;
  if (paths.length > MAX_RETURN_PATHS_PER_ALT) {
    const stride = paths.length / MAX_RETURN_PATHS_PER_ALT;
    sampledPaths = [];
    for (let i = 0; i < MAX_RETURN_PATHS_PER_ALT; i++) {
      sampledPaths.push(paths[Math.floor((i + 0.5) * stride)]);
    }
  }
  return { alt, flyPct, anchors, paths: sampledPaths, pathCount, weight, flyable: flyableOut };
}

self.onmessage = event => {
  const data = event.data;
  if (data.type !== 'compute') return;
  N = data.N;
  CORE_N = data.CORE_N;
  CORE_OFFSET = data.CORE_OFFSET;
  entriesPerEdge = data.entriesPerEdge;
  maxHeightWeight = data.maxHeightWeight || 1;
  heightField = new Float32Array(data.heightFieldBuffer);

  for (const alt of data.altitudes) {
    const result = routePathsForAltitude(alt);
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
