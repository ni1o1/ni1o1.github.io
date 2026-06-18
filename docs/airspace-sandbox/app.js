/* global THREE, CITY_BLOCKS */
'use strict';

const CORE_DOMAIN = 500;
const HALO_M = 150;
const DOMAIN = CORE_DOMAIN + HALO_M * 2;
const CELL = 10;
const N = Math.round(DOMAIN / CELL);
const VIEW_DOMAIN = 950;
const HALF = DOMAIN / 2;
const CORE_HALF = CORE_DOMAIN / 2;
const VIEW_HALF = VIEW_DOMAIN / 2;
const ROUTE_COLOR = '#1677ff';
const SAFETY_M = 4;
const ALT_MIN = 25;
const ALT_MAX = 120;
const WEIGHT_CENTER = 65;
const WEIGHT_SIGMA = 22;
const NOISE_GRID = 64;
const NOISE_MAX_PATHS_PER_ALT = 72;
const NOISE_MAX_SEGMENTS = 5200;

const gx = i => (i + 0.5) * CELL - HALF;
const gz = j => (iToZ(j));
const iToZ = j => (j + 0.5) * CELL - HALF;
const idx = (i, j) => j * N + i;
const $ = id => document.getElementById(id);
const heightWeight = alt => Math.exp(-((alt - WEIGHT_CENTER) ** 2) / (2 * WEIGHT_SIGMA ** 2));
const inCore = (x, z) => Math.abs(x) <= CORE_HALF && Math.abs(z) <= CORE_HALF;

let buildings = [];
let nextId = 1;
let currentPreset = '';
let currentBlock = null;
const HEIGHT_GAP = 10;
let altitudes = buildAltitudes(HEIGHT_GAP);
let maxHeightWeight = Math.max(...altitudes.map(heightWeight));
let entriesPerEdge = 6;
let routeOpacityScale = 1;
let routesVisible = true;
let noiseEnabled = true;
let heightField = new Float32Array(N * N);
let flyable = new Uint8Array(N * N);
let routeSummaries = [];
let totalRoutes = 0;
let noiseGroundMesh = null;
let noiseOverlays = [];

function buildAltitudes(gap) {
  const out = [];
  for (let h = ALT_MIN; h <= ALT_MAX; h += gap) out.push(h);
  if (out[out.length - 1] !== ALT_MAX) out.push(ALT_MAX);
  return out;
}

function updateAltitudeState() {
  altitudes = buildAltitudes(HEIGHT_GAP);
  maxHeightWeight = Math.max(...altitudes.map(heightWeight));
  buildMapTiles();
}

const BLOCKS = (window.CITY_BLOCKS && window.CITY_BLOCKS.blocks && window.CITY_BLOCKS.blocks.length)
  ? window.CITY_BLOCKS.blocks
  : fallbackBlocks();

function fallbackBlocks() {
  return [{
    id: 'concept-canyon',
    name: 'Concept · canyon',
    terrain: { slopeX: 0.01, slopeZ: 0.02, ridge: 8, roughness: 1 },
    buildings: [
      { polygon: [[-180,-80],[-70,-80],[-70,-35],[-180,-35]], height: 80 },
      { polygon: [[70,-80],[180,-80],[180,-35],[70,-35]], height: 80 },
      { polygon: [[-180,35],[-70,35],[-70,80],[-180,80]], height: 80 },
      { polygon: [[70,35],[180,35],[180,80],[70,80]], height: 80 },
      { polygon: [[-35,-170],[35,-170],[35,-95],[-35,-95]], height: 120 },
      { polygon: [[-35,95],[35,95],[35,170],[-35,170]], height: 120 },
    ],
  }];
}

function terrainHeight(x, z) {
  const t = currentBlock?.terrain || {};
  const sx = t.slopeX || 0;
  const sz = t.slopeZ || 0;
  const ridge = t.ridge || 0;
  const rough = t.roughness || 0;
  const hill = ridge * Math.exp(-((x + 110) ** 2 + (z - 70) ** 2) / (2 * 150 ** 2));
  return sx * x + sz * z + hill + rough * Math.sin((x + z) * 0.025) * Math.cos(z * 0.016);
}

const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f7f8f7');

const camera = new THREE.PerspectiveCamera(34, stage.clientWidth / stage.clientHeight, 1, 6000);
camera.position.set(980, 670, 980);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 130;
controls.maxDistance = 3000;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(80, 18, 0);

scene.add(new THREE.HemisphereLight('#ffffff', '#d7dde2', 0.72));
const sun = new THREE.DirectionalLight('#ffffff', 1.15);
sun.position.set(-360, 520, 280);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -560;
sun.shadow.camera.right = 560;
sun.shadow.camera.top = 560;
sun.shadow.camera.bottom = -560;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 1250;
scene.add(sun);

let terrainMesh = null;
const grid = new THREE.GridHelper(VIEW_DOMAIN, Math.round(VIEW_DOMAIN / CELL), '#aeb7c2', '#d7dce2');
grid.material.transparent = true;
grid.material.opacity = 0;
grid.position.y = 0.08;
grid.visible = false;

const border = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-HALF, 0.2, -HALF), new THREE.Vector3(HALF, 0.2, -HALF),
    new THREE.Vector3(HALF, 0.2, HALF), new THREE.Vector3(-HALF, 0.2, HALF),
  ]),
  new THREE.LineBasicMaterial({ color: '#20242a' })
);
border.visible = false;

const buildingGroup = new THREE.Group();
const routeGroup = new THREE.Group();
const anchorGroup = new THREE.Group();
const noiseGroup = new THREE.Group();
const heightScaleGroup = new THREE.Group();
scene.add(buildingGroup, routeGroup, anchorGroup, noiseGroup, heightScaleGroup);

const buildingMat = new THREE.MeshStandardMaterial({ color: '#f8f8f5', roughness: 0.72, metalness: 0.0, vertexColors: true, side: THREE.DoubleSide });
const edgeMat = new THREE.LineBasicMaterial({ color: '#67717d', transparent: true, opacity: 0.92 });
const scaleMat = new THREE.LineBasicMaterial({ color: '#242a31', transparent: true, opacity: 0.78 });
const capMat = new THREE.LineBasicMaterial({ color: ROUTE_COLOR, transparent: true, opacity: 0.34 });
const noiseMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.58,
  depthWrite: false,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -8,
  side: THREE.DoubleSide,
});

function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function centroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    const hit = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-9) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function buildingTouchesCore(b) {
  const worldPoly = b.localPoly.map(p => [p[0] + b.x, p[1] + b.z]);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of worldPoly) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]);
    if (inCore(p[0], p[1])) return true;
  }
  if (maxX < -CORE_HALF || minX > CORE_HALF || maxZ < -CORE_HALF || minZ > CORE_HALF) return false;
  const corners = [
    [-CORE_HALF, -CORE_HALF],
    [CORE_HALF, -CORE_HALF],
    [CORE_HALF, CORE_HALF],
    [-CORE_HALF, CORE_HALF],
  ];
  return corners.some(p => pointInPoly(p[0], p[1], worldPoly));
}

function makePrismGeometry(localPoly, height) {
  let contour = localPoly.map(p => new THREE.Vector2(p[0], p[1]));
  if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse();
  const shape = new THREE.Shape(contour);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1,
  });
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, x, z, y);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  applyFacadeShading(geom);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

function applyFacadeShading(geom) {
  const normals = geom.getAttribute('normal');
  const colors = [];
  const light = new THREE.Vector3(-0.55, 0.72, 0.42).normalize();
  for (let i = 0; i < normals.count; i++) {
    const n = new THREE.Vector3(normals.getX(i), normals.getY(i), normals.getZ(i)).normalize();
    const top = Math.max(0, n.y);
    const side = Math.max(0, n.dot(light));
    const shade = 0.74 + 0.18 * side + 0.10 * top;
    colors.push(shade, shade, shade);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function colorRamp(v) {
  const stops = [
    [0.00, [247, 248, 247]],
    [0.18, [223, 235, 244]],
    [0.38, [159, 199, 219]],
    [0.62, [246, 196, 106]],
    [0.82, [222, 112, 72]],
    [1.00, [170, 42, 46]],
  ];
  const t = Math.max(0, Math.min(1, v));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const u = (t - t0) / (t1 - t0 || 1);
      return [
        (c0[0] + (c1[0] - c0[0]) * u) / 255,
        (c0[1] + (c1[1] - c0[1]) * u) / 255,
        (c0[2] + (c1[2] - c0[2]) * u) / 255,
      ];
    }
  }
  return stops[stops.length - 1][1].map(c => c / 255);
}

function makeOutlineGeometry(localPoly, height) {
  const pts = [];
  const add = (a, b) => {
    pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  };
  for (let i = 0; i < localPoly.length; i++) {
    const p = localPoly[i];
    const q = localPoly[(i + 1) % localPoly.length];
    add([p[0], height, p[1]], [q[0], height, q[1]]);
    add([p[0], 0, p[1]], [p[0], height, p[1]]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geom;
}

function makeBuilding(raw) {
  const absPoly = raw.polygon.map(p => [p[0], p[1]]);
  const c = centroid(absPoly);
  const localPoly = absPoly.map(p => [p[0] - c[0], p[1] - c[1]]);
  const b = {
    id: nextId++,
    x: c[0],
    z: c[1],
    localPoly,
    h: Math.max(3, Math.min(220, raw.height || 12)),
    minH: Math.max(0, Math.min(210, raw.minHeight || 0)),
  };
  if (b.h <= b.minH + 1) b.h = b.minH + 4;
  b.group = new THREE.Group();
  b.group.position.set(b.x, terrainHeight(b.x, b.z) + b.minH + (b.minH > 0 ? 0.08 : 0), b.z);
  b.box = new THREE.Mesh(makePrismGeometry(b.localPoly, b.h - b.minH), buildingMat);
  b.box.castShadow = true;
  b.box.receiveShadow = false;
  b.box.userData = { type: 'building', id: b.id };
  b.edges = new THREE.LineSegments(makeOutlineGeometry(b.localPoly, b.h - b.minH), edgeMat);
  b.group.add(b.box, b.edges);
  buildingGroup.add(b.group);
  return b;
}

function rebuildBuildingGeometry(b) {
  b.box.geometry.dispose();
  b.edges.geometry.dispose();
  b.box.geometry = makePrismGeometry(b.localPoly, Math.max(1, b.h - b.minH));
  b.edges.geometry = makeOutlineGeometry(b.localPoly, Math.max(1, b.h - b.minH));
}

function syncBuilding(b) {
  b.group.position.set(b.x, terrainHeight(b.x, b.z) + b.minH + (b.minH > 0 ? 0.08 : 0), b.z);
}

function buildTerrain() {
  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
  }
  const seg = 40;
  const positions = [];
  const indices = [];
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const x = -VIEW_HALF + VIEW_DOMAIN * i / seg;
      const z = -VIEW_HALF + VIEW_DOMAIN * j / seg;
      positions.push(x, terrainHeight(x, z), z);
    }
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      indices.push(a, a + 1, a + seg + 2, a, a + seg + 2, a + seg + 1);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  terrainMesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({ color: '#eef0ed', roughness: 0.94, metalness: 0 })
  );
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
  grid.position.y = Math.max(0.12, terrainHeight(0, 0) + 0.12);
  buildHeightScale();
}

function makeLine(points, material) {
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    material
  );
}

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '600 22px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillStyle = '#242a31';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 4, 20);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.88 }));
  sprite.scale.set(34, 10.6, 1);
  return sprite;
}

function buildHeightScale() {
  heightScaleGroup.clear();
  const x = HALF + 34;
  const z = -HALF - 18;
  const base = terrainHeight(HALF, -HALF);
  const tickLen = 14;
  const pts = [
    new THREE.Vector3(x, base, z),
    new THREE.Vector3(x, base + ALT_MAX, z),
  ];
  for (let h = 0; h <= ALT_MAX; h += 20) {
    pts.push(new THREE.Vector3(x, base + h, z), new THREE.Vector3(x + tickLen, base + h, z));
    const lab = makeLabel(`${h}m`);
    lab.position.set(x + tickLen + 18, base + h, z);
    heightScaleGroup.add(lab);
  }
  heightScaleGroup.add(makeLine(pts, scaleMat));
  heightScaleGroup.add(makeLine([
    new THREE.Vector3(-HALF, base + ALT_MAX, z),
    new THREE.Vector3(HALF, base + ALT_MAX, z),
    new THREE.Vector3(x, base + ALT_MAX, -HALF),
    new THREE.Vector3(x, base + ALT_MAX, HALF),
  ], capMat));
}

function loadPreset(name) {
  currentPreset = name;
  currentBlock = BLOCKS.find(b => b.name === name) || BLOCKS[0];
  clearNoiseLayer();
  buildingGroup.clear();
  buildings = [];
  nextId = 1;
  buildTerrain();
  currentBlock.buildings.forEach(raw => buildings.push(makeBuilding(raw)));
  document.querySelectorAll('#presets button').forEach(el => el.classList.toggle('active', el.dataset.name === name));
  scheduleCompute();
}

function rasterize() {
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) heightField[idx(i, j)] = terrainHeight(gx(i), iToZ(j)) + 1;
  }
  for (const b of buildings) {
    const worldPoly = b.localPoly.map(p => [p[0] + b.x, p[1] + b.z]);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of worldPoly) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]);
    }
    const i0 = Math.max(0, Math.floor((minX - SAFETY_M + HALF) / CELL));
    const i1 = Math.min(N - 1, Math.floor((maxX + SAFETY_M + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((minZ - SAFETY_M + HALF) / CELL));
    const j1 = Math.min(N - 1, Math.floor((maxZ + SAFETY_M + HALF) / CELL));
    const top = terrainHeight(b.x, b.z) + b.h;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = gx(i), z = iToZ(j);
        if (pointInPoly(x, z, worldPoly) || nearPoly(x, z, worldPoly, SAFETY_M)) {
          const k = idx(i, j);
          if (top > heightField[k]) heightField[k] = top;
        }
      }
    }
  }
}

function nearPoly(x, z, poly, dist) {
  const d2 = dist * dist;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (pointSegDist2(x, z, a[0], a[1], b[0], b[1]) <= d2) return true;
  }
  return false;
}

function pointSegDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  const x = ax + t * dx, z = az + t * dz;
  return (px - x) ** 2 + (pz - z) ** 2;
}

function computeFlyable(alt) {
  let count = 0;
  for (let k = 0; k < N * N; k++) {
    flyable[k] = heightField[k] + SAFETY_M < alt ? 1 : 0;
    count += flyable[k];
  }
  return count / (N * N);
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

const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];

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
  if (anchors.length < 2) return { alt, flyPct, anchors, paths, weight, flyable: new Uint8Array(flyable) };
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
  return { alt, flyPct, anchors, paths, weight, flyable: new Uint8Array(flyable) };
}

function makeRouteTube(cells, alt, opacity) {
  const points = cells.map(k => new THREE.Vector3(gx(k % N), alt + 2.4, iToZ((k / N) | 0)));
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.12);
  const geom = new THREE.TubeGeometry(curve, Math.max(8, points.length * 2), 1.25, 7, false);
  const mat = new THREE.MeshBasicMaterial({
    color: ROUTE_COLOR,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 10;
  return mesh;
}

const anchorGeom = new THREE.SphereGeometry(2.7, 9, 9);
function drawAnchors(anchors, alt, opacity) {
  const mat = new THREE.MeshBasicMaterial({ color: ROUTE_COLOR, transparent: true, opacity, depthWrite: false });
  anchors.forEach(k => {
    const m = new THREE.Mesh(anchorGeom, mat);
    m.position.set(gx(k % N), alt + 2.5, iToZ((k / N) | 0));
    anchorGroup.add(m);
  });
}

function recompute() {
  rasterize();
  routeGroup.clear();
  anchorGroup.clear();
  totalRoutes = 0;
  routeSummaries = [];

  altitudes.forEach(alt => {
    const result = routePathsForAltitude(alt);
    const routeOpacity = Math.min(0.22, (0.010 + 0.070 * result.weight) * routeOpacityScale);
    const anchorOpacity = Math.min(0.5, (0.045 + 0.16 * result.weight) * routeOpacityScale);
    drawAnchors(result.anchors, alt, anchorOpacity);
    result.paths.forEach(cells => {
      const tube = makeRouteTube(cells, alt, routeOpacity);
      if (tube) routeGroup.add(tube);
    });
    totalRoutes += result.paths.length;
    routeSummaries.push(result);
  });

  updateMetrics();
  drawMiniMap();
  if (noiseEnabled) buildNoiseLayer();
  applyRouteVisibility();
}

function updateMetrics() {
  const legend = $('altLegend');
  legend.innerHTML = '';
  routeSummaries.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'alt';
    const pct = Math.round(s.flyPct * 100);
    row.innerHTML = `<span class="sw" style="background:${ROUTE_COLOR};opacity:${Math.min(1, (0.18 + 0.75 * s.weight) * routeOpacityScale).toFixed(2)}"></span><span>${s.alt} m</span><span style="margin-left:auto">W ${(s.weight).toFixed(2)} · ${s.paths.length} 条 · ${pct}%</span>`;
    legend.appendChild(row);
  });
}

function drawMiniMap() {
  const grid = $('mapsGrid');
  if (!grid.children.length) buildMapTiles();
  routeSummaries.forEach((s, si) => {
    const canvas = $(`mapCanvas-${si}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
  const img = ctx.createImageData(N, N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = idx(i, j);
      const p = ((N - 1 - j) * N + i) * 4;
      if (s.flyable[k]) {
        img.data[p] = 245; img.data[p + 1] = 247; img.data[p + 2] = 246; img.data[p + 3] = 255;
      } else {
        img.data[p] = 42; img.data[p + 1] = 47; img.data[p + 2] = 54; img.data[p + 3] = 255;
      }
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = N;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, W, H);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ROUTE_COLOR;
  ctx.globalAlpha = Math.min(0.95, (0.10 + 0.52 * s.weight) * routeOpacityScale);
  for (const path of s.paths) {
    ctx.beginPath();
    path.forEach((k, pi) => {
      const x = (k % N + 0.5) / N * W;
      const y = H - (((k / N) | 0) + 0.5) / N * H;
      if (pi === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
    const cap = $(`mapCap-${si}`);
    if (cap) cap.textContent = `${s.paths.length} 条 · ${Math.round(s.flyPct * 100)}%`;
  });
}

function cellToVec(k, alt) {
  return new THREE.Vector3(gx(k % N), alt + 2.4, iToZ((k / N) | 0));
}

function collectNoiseSegments() {
  const segments = [];
  for (const s of routeSummaries) {
    if (!s.paths.length) continue;
    const stride = Math.max(1, Math.ceil(s.paths.length / NOISE_MAX_PATHS_PER_ALT));
    for (let pi = 0; pi < s.paths.length; pi += stride) {
      const path = s.paths[pi];
      const cellStep = Math.max(1, Math.floor(path.length / 24));
      for (let ci = 0; ci < path.length - 1; ci += cellStep) {
        const a = cellToVec(path[ci], s.alt);
        const b = cellToVec(path[Math.min(path.length - 1, ci + cellStep)], s.alt);
        segments.push({ a, b, amp: s.weight * stride * cellStep });
        if (segments.length >= NOISE_MAX_SEGMENTS) return segments;
      }
    }
  }
  return segments;
}

function pointSegmentDistanceSq3(px, py, pz, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby + (pz - a.z) * abz) / l2));
  const x = a.x + abx * t, y = a.y + aby * t, z = a.z + abz * t;
  return (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2;
}

function noiseAt(px, py, pz, segments) {
  let v = 0;
  for (const s of segments) {
    const d2 = pointSegmentDistanceSq3(px, py, pz, s.a, s.b);
    v += s.amp / (420 + d2);
  }
  return v;
}

function normalizeNoise(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 1;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1] || 1;
  return Math.max(1e-6, p95);
}

function clearNoiseLayer() {
  if (noiseGroundMesh) {
    noiseGroup.remove(noiseGroundMesh);
    noiseGroundMesh.geometry.dispose();
    noiseGroundMesh.material.dispose();
    noiseGroundMesh = null;
  }
  for (const item of noiseOverlays) {
    item.parent.remove(item.mesh);
    item.mesh.geometry.dispose();
    item.mesh.material.dispose();
  }
  noiseOverlays = [];
}

function buildNoiseLayer() {
  clearNoiseLayer();
  const segments = collectNoiseSegments();
  if (!segments.length) return;

  const groundPositions = [];
  const groundIndices = [];
  const groundValues = [];
  for (let j = 0; j <= NOISE_GRID; j++) {
    for (let i = 0; i <= NOISE_GRID; i++) {
      const x = -CORE_HALF + CORE_DOMAIN * i / NOISE_GRID;
      const z = -CORE_HALF + CORE_DOMAIN * j / NOISE_GRID;
      const y = terrainHeight(x, z) + 0.42;
      groundPositions.push(x, y, z);
      groundValues.push(noiseAt(x, y, z, segments));
    }
  }
  for (let j = 0; j < NOISE_GRID; j++) {
    for (let i = 0; i < NOISE_GRID; i++) {
      const a = j * (NOISE_GRID + 1) + i;
      groundIndices.push(a, a + 1, a + NOISE_GRID + 2, a, a + NOISE_GRID + 2, a + NOISE_GRID + 1);
    }
  }

  const probeValues = groundValues.slice();
  const overlayGeoms = [];
  for (const b of buildings) {
    if (!buildingTouchesCore(b)) continue;
    const geom = b.box.geometry.clone();
    geom.computeVertexNormals();
    const pos = geom.getAttribute('position');
    for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 24))) {
      probeValues.push(noiseAt(pos.getX(i) + b.group.position.x, pos.getY(i) + b.group.position.y, pos.getZ(i) + b.group.position.z, segments));
    }
    overlayGeoms.push({ b, geom });
  }

  const norm = normalizeNoise(probeValues);
  const groundColors = [];
  for (const v of groundValues) {
    const c = colorRamp(Math.log1p(v / norm * 3.2) / Math.log1p(3.2));
    groundColors.push(c[0], c[1], c[2]);
  }
  const groundGeom = new THREE.BufferGeometry();
  groundGeom.setAttribute('position', new THREE.Float32BufferAttribute(groundPositions, 3));
  groundGeom.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
  groundGeom.setIndex(groundIndices);
  groundGeom.computeVertexNormals();
  noiseGroundMesh = new THREE.Mesh(groundGeom, noiseMat.clone());
  noiseGroundMesh.renderOrder = 4;
  noiseGroup.add(noiseGroundMesh);

  for (const { b, geom } of overlayGeoms) {
    const pos = geom.getAttribute('position');
    const normal = geom.getAttribute('normal');
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + b.group.position.x;
      const wy = pos.getY(i) + b.group.position.y;
      const wz = pos.getZ(i) + b.group.position.z;
      const value = noiseAt(wx, wy, wz, segments);
      const rawHot = Math.log1p(value / norm * 3.2) / Math.log1p(3.2);
      const hot = 0.10 + 0.90 * rawHot;
      const c = colorRamp(hot);
      colors.push(c[0], c[1], c[2]);
      pos.setXYZ(
        i,
        pos.getX(i) + normal.getX(i) * 0.45,
        pos.getY(i) + normal.getY(i) * 0.45,
        pos.getZ(i) + normal.getZ(i) * 0.45
      );
    }
    pos.needsUpdate = true;
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geom, noiseMat.clone());
    mesh.renderOrder = 5;
    b.group.add(mesh);
    noiseOverlays.push({ parent: b.group, mesh });
  }
}

function buildMapTiles() {
  const grid = $('mapsGrid');
  grid.innerHTML = '';
  altitudes.forEach((alt, i) => {
    const tile = document.createElement('div');
    tile.className = 'mapTile';
    tile.innerHTML = `<div class="mapCap"><b>${alt} m</b><span id="mapCap-${i}">-</span></div><canvas id="mapCanvas-${i}" width="192" height="192"></canvas>`;
    grid.appendChild(tile);
  });
}

function applyRouteVisibility() {
  routeGroup.visible = routesVisible;
  anchorGroup.visible = routesVisible;
}

let needsCompute = false;
let busyTimer = null;
function scheduleCompute() {
  needsCompute = true;
  $('busy').classList.add('on');
  clearTimeout(busyTimer);
}

function flushCompute() {
  if (!needsCompute) return;
  needsCompute = false;
  recompute();
  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => $('busy').classList.remove('on'), 160);
}

BLOCKS.forEach(block => {
  const btn = document.createElement('button');
  btn.textContent = block.name.replace(' · ', '\n');
  btn.style.whiteSpace = 'pre-line';
  btn.dataset.name = block.name;
  btn.onclick = () => loadPreset(block.name);
  $('presets').appendChild(btn);
});

$('density').addEventListener('input', e => {
  entriesPerEdge = +e.target.value;
  $('densityV').textContent = entriesPerEdge;
  scheduleCompute();
});

$('routeOpacity').addEventListener('input', e => {
  routeOpacityScale = +e.target.value / 100;
  $('opacityV').textContent = e.target.value;
  scheduleCompute();
});

$('routeToggle').addEventListener('change', e => {
  routesVisible = e.target.checked;
  applyRouteVisibility();
});

$('noiseToggle').addEventListener('change', e => {
  noiseEnabled = e.target.checked;
  if (noiseEnabled) {
    $('busy').classList.add('on');
    setTimeout(() => {
      buildNoiseLayer();
      $('busy').classList.remove('on');
    }, 20);
  } else {
    clearNoiseLayer();
  }
});

function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

function animate(t) {
  requestAnimationFrame(animate);
  flushCompute();
  controls.update();
  renderer.render(scene, camera);
}

buildMapTiles();
currentPreset = BLOCKS[0].name;
loadPreset(currentPreset);
recompute();
animate(0);
