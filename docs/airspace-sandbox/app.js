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
const NOISE_GRID = 36;
const NOISE_MAX_PATHS_PER_ALT = 24;
const NOISE_MAX_SEGMENTS = 1200;
const DEM_VISUAL_SCALE = 0.3;
const TERRAIN_LINE_STEP = 50;

const gx = i => (i + 0.5) * CELL - HALF;
const gz = j => (iToZ(j));
const iToZ = j => (j + 0.5) * CELL - HALF;
const idx = (i, j) => j * N + i;
const $ = id => document.getElementById(id);
const heightWeight = alt => Math.exp(-((alt - WEIGHT_CENTER) ** 2) / (2 * WEIGHT_SIGMA ** 2));
const inCore = (x, z) => Math.abs(x) <= CORE_HALF && Math.abs(z) <= CORE_HALF;
const clamp01 = v => Math.max(0, Math.min(1, v));
const sigmoid = v => 1 / (1 + Math.exp(-v));
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const CORE_N = Math.round(CORE_DOMAIN / CELL);
const CORE_OFFSET = Math.round((N - CORE_N) / 2);
const isCoreCell = (i, j) => i >= CORE_OFFSET && i < CORE_OFFSET + CORE_N && j >= CORE_OFFSET && j < CORE_OFFSET + CORE_N;
const PANEL_GAP = 18;

let buildings = [];
let obstacleBuildings = [];
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
let demEnabled = false;
let heightScaleVisible = true;
let haloBuildingsVisible = true;
let externalityChannel = 'noise';
let heightField = new Float32Array(N * N);
let flyable = new Uint8Array(N * N);
let routeSummaries = [];
let totalRoutes = 0;
let noiseGroundMesh = null;
let noiseOverlays = [];
let terrainReliefLines = null;
let externalityTimer = null;
let externalityVersion = 0;
let routeWorker = null;
let routeDrawChain = Promise.resolve();
let activeComputeDone = null;

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
  const dem = currentBlock?.dem;
  if (demEnabled && dem?.values?.length && dem.grid > 1 && dem.extent > 0) {
    const half = dem.extent / 2;
    const u = (x + half) / dem.extent * (dem.grid - 1);
    const v = (z + half) / dem.extent * (dem.grid - 1);
    if (u >= 0 && v >= 0 && u <= dem.grid - 1 && v <= dem.grid - 1) {
      const i0 = Math.floor(u);
      const j0 = Math.floor(v);
      const i1 = Math.min(dem.grid - 1, i0 + 1);
      const j1 = Math.min(dem.grid - 1, j0 + 1);
      const fu = u - i0;
      const fv = v - j0;
      const a = dem.values[j0 * dem.grid + i0];
      const b = dem.values[j0 * dem.grid + i1];
      const c = dem.values[j1 * dem.grid + i0];
      const d = dem.values[j1 * dem.grid + i1];
      return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
    }
  }
  const t = currentBlock?.terrain || {};
  const sx = t.slopeX || 0;
  const sz = t.slopeZ || 0;
  const ridge = t.ridge || 0;
  const rough = t.roughness || 0;
  const hill = ridge * Math.exp(-((x + 110) ** 2 + (z - 70) ** 2) / (2 * 150 ** 2));
  return sx * x + sz * z + hill + rough * Math.sin((x + z) * 0.025) * Math.cos(z * 0.016);
}

function terrainVisualHeight(x, z) {
  const h = terrainHeight(x, z);
  return demEnabled ? h * DEM_VISUAL_SCALE : h;
}

const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = false;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');

const camera = new THREE.PerspectiveCamera(34, stage.clientWidth / stage.clientHeight, 1, 6000);
camera.position.set(980, 670, 980);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 130;
controls.maxDistance = 3000;
controls.maxPolarAngle = Math.PI * 0.49;
const ORBIT_TARGET = new THREE.Vector3(0, 35, 0);
controls.target.copy(ORBIT_TARGET);

scene.add(new THREE.HemisphereLight('#ffffff', '#d7dde2', 0.72));
const sun = new THREE.DirectionalLight('#ffffff', 1.15);
sun.position.set(-360, 520, 280);
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
const haloBuildingMat = new THREE.MeshStandardMaterial({
  color: '#d7dde3',
  roughness: 0.82,
  metalness: 0,
  vertexColors: true,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.24,
  depthWrite: false,
});
const haloEdgeMat = new THREE.LineBasicMaterial({ color: '#96a1ad', transparent: true, opacity: 0.22, depthWrite: false });
const scaleMat = new THREE.LineBasicMaterial({ color: '#242a31', transparent: true, opacity: 0.78 });
const terrainLineMat = new THREE.LineBasicMaterial({ color: '#7d8791', transparent: true, opacity: 0.32 });
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

const CHANNELS = {
  noise: { label: '噪声', ground: 1, facade: 1, palette: 'coolwarm' },
  risk: { label: '坠落风险', ground: 1, facade: 1, palette: 'coolwarm' },
  privacy: { label: '隐私', ground: 1, facade: 1, palette: 'coolwarm' },
  visual: { label: '视觉烦扰', ground: 1, facade: 1, palette: 'coolwarm' },
};

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

function colorRamp(v, palette = 'heat') {
  const palettes = {
    coolwarm: [
      [0.00, [59, 76, 192]],
      [0.18, [104, 136, 238]],
      [0.36, [170, 198, 253]],
      [0.50, [242, 242, 242]],
      [0.64, [252, 190, 161]],
      [0.82, [219, 94, 75]],
      [1.00, [180, 4, 38]],
    ],
  };
  const stops = palettes[palette] || palettes.coolwarm;
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

function makeBuilding(raw, addToScene = true) {
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
    isPart: Boolean(raw.isPart),
    isHalo: raw.role === 'halo' || raw.tags?.role === 'halo',
  };
  if (b.h <= b.minH + 1) b.h = b.minH + 4;
  if (!addToScene) return b;
  b.group = new THREE.Group();
  b.group.position.set(b.x, terrainVisualHeight(b.x, b.z) + b.minH + (b.minH > 0 ? 0.08 : 0), b.z);
  b.box = new THREE.Mesh(makePrismGeometry(b.localPoly, b.h - b.minH), b.isHalo ? haloBuildingMat : buildingMat);
  b.box.castShadow = false;
  b.box.receiveShadow = false;
  b.box.userData = { type: 'building', id: b.id };
  b.edges = new THREE.LineSegments(makeOutlineGeometry(b.localPoly, b.h - b.minH), b.isHalo ? haloEdgeMat : edgeMat);
  if (b.isHalo) b.group.renderOrder = 1;
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
  b.group.position.set(b.x, terrainVisualHeight(b.x, b.z) + b.minH + (b.minH > 0 ? 0.08 : 0), b.z);
}

function buildTerrain() {
  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
  }
  if (terrainReliefLines) {
    scene.remove(terrainReliefLines);
    terrainReliefLines.geometry.dispose();
    terrainReliefLines = null;
  }
  const seg = 30;
  const positions = [];
  const indices = [];
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const x = -VIEW_HALF + VIEW_DOMAIN * i / seg;
      const z = -VIEW_HALF + VIEW_DOMAIN * j / seg;
      positions.push(x, terrainVisualHeight(x, z), z);
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
  terrainMesh.receiveShadow = false;
  scene.add(terrainMesh);
  buildTerrainReliefLines();
  grid.position.y = Math.max(0.12, terrainVisualHeight(0, 0) + 0.12);
  buildHeightScale();
}

function buildTerrainReliefLines() {
  if (!demEnabled) return;
  const pts = [];
  const min = -CORE_HALF - HALO_M;
  const max = CORE_HALF + HALO_M;
  const sampleStep = 25;
  const add = (a, b) => {
    pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  };
  for (let z = min; z <= max + 0.01; z += TERRAIN_LINE_STEP) {
    let prev = null;
    for (let x = min; x <= max + 0.01; x += sampleStep) {
      const p = [x, terrainVisualHeight(x, z) + 0.58, z];
      if (prev) add(prev, p);
      prev = p;
    }
  }
  for (let x = min; x <= max + 0.01; x += TERRAIN_LINE_STEP) {
    let prev = null;
    for (let z = min; z <= max + 0.01; z += sampleStep) {
      const p = [x, terrainVisualHeight(x, z) + 0.58, z];
      if (prev) add(prev, p);
      prev = p;
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  terrainReliefLines = new THREE.LineSegments(geom, terrainLineMat);
  terrainReliefLines.renderOrder = 3;
  scene.add(terrainReliefLines);
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
  const x = CORE_HALF + 18;
  const z = -CORE_HALF - 18;
  const base = terrainVisualHeight(CORE_HALF, -CORE_HALF);
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
  heightScaleGroup.visible = heightScaleVisible;
}

function loadPreset(name) {
  currentPreset = name;
  currentBlock = BLOCKS.find(b => b.name === name) || BLOCKS[0];
  clearNoiseLayer();
  buildingGroup.clear();
  buildings = [];
  obstacleBuildings = [];
  nextId = 1;
  buildTerrain();
  obstacleBuildings = currentBlock.buildings.map(raw => makeBuilding(raw, false));
  currentBlock.buildings.forEach(raw => buildings.push(makeBuilding(raw, true)));
  applyAuxiliaryBuildingVisibility();
  if ($('presets').value !== currentBlock.name) $('presets').value = currentBlock.name;
  scheduleCompute();
}

async function rasterize(version) {
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) heightField[idx(i, j)] = terrainHeight(gx(i), iToZ(j)) + 1;
    if (j % 8 === 7) {
      if (version !== computeVersion) return false;
      await nextFrame();
    }
  }
  for (let bi = 0; bi < obstacleBuildings.length; bi++) {
    const b = obstacleBuildings[bi];
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
    if (bi % 8 === 7) {
      if (version !== computeVersion) return false;
      await nextFrame();
    }
  }
  return version === computeVersion;
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

async function routePathsForAltitude(alt, version) {
  const flyPct = computeFlyable(alt);
  const anchors = boundaryAnchors();
  const paths = [];
  const weight = heightWeight(alt) / maxHeightWeight;
  if (anchors.length < 2) return { alt, flyPct, anchors, paths, weight, flyable: new Uint8Array(flyable) };
  const solved = [];
  for (let i = 0; i < anchors.length; i++) {
    if (version !== computeVersion) return null;
    solved.push({ a: anchors[i], ...dijkstra(anchors[i]) });
    if (i % 3 === 2) await nextFrame();
  }
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
    if (p % 8 === 7) await nextFrame();
  }
  return { alt, flyPct, anchors, paths, weight, flyable: new Uint8Array(flyable) };
}

function makeRouteBandMesh(paths, alt, opacity) {
  const positions = [];
  const indices = [];
  const halfWidth = 1.35;
  for (const cells of paths) {
    for (let p = 0; p < cells.length - 1; p++) {
      const a = cells[p];
      const b = cells[p + 1];
      const ax = gx(a % N), az = iToZ((a / N) | 0);
      const bx = gx(b % N), bz = iToZ((b / N) | 0);
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      const ox = -dz / len * halfWidth;
      const oz = dx / len * halfWidth;
      const base = positions.length / 3;
      const y = alt + 2.4;
      positions.push(ax + ox, y, az + oz, ax - ox, y, az - oz, bx + ox, y, bz + oz, bx - ox, y, bz - oz);
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  if (!positions.length) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  const mat = new THREE.MeshBasicMaterial({
    color: ROUTE_COLOR,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 10;
  return mesh;
}

function disposeRouteLayer() {
  for (const child of routeGroup.children) {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach(mat => mat.dispose());
    } else {
      child.material?.dispose();
    }
  }
  routeGroup.clear();
  for (const child of anchorGroup.children) {
    if (Array.isArray(child.material)) {
      child.material.forEach(mat => mat.dispose());
    } else {
      child.material?.dispose();
    }
  }
  anchorGroup.clear();
}

function drawAnchors(anchors, alt, opacity) {
  const pts = [];
  anchors.forEach(k => pts.push(gx(k % N), alt + 2.5, iToZ((k / N) | 0)));
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.PointsMaterial({ color: ROUTE_COLOR, transparent: true, opacity, size: 4.8, sizeAttenuation: true, depthWrite: false });
  anchorGroup.add(new THREE.Points(geom, mat));
}

async function drawAltitudeResult(result, version) {
  if (version !== computeVersion) return;
  result.flyable = new Uint8Array(result.flyable);
  const routeOpacity = Math.min(0.22, (0.010 + 0.070 * result.weight) * routeOpacityScale);
  const anchorOpacity = Math.min(0.5, (0.045 + 0.16 * result.weight) * routeOpacityScale);
  drawAnchors(result.anchors, result.alt, anchorOpacity);
  const routeMesh = makeRouteBandMesh(result.paths, result.alt, routeOpacity);
  if (routeMesh) routeGroup.add(routeMesh);
  await nextFrame();
  if (version !== computeVersion) return;
  totalRoutes += result.pathCount || result.paths.length;
  routeSummaries.push(result);
  applyRouteVisibility();
}

function stopRouteWorker() {
  if (routeWorker) {
    routeWorker.terminate();
    routeWorker = null;
  }
  if (activeComputeDone) {
    activeComputeDone(false);
    activeComputeDone = null;
  }
}

async function recompute(version) {
  const rasterReady = await rasterize(version);
  if (!rasterReady || version !== computeVersion) return false;
  externalityVersion++;
  clearNoiseLayer();
  disposeRouteLayer();
  totalRoutes = 0;
  routeSummaries = [];
  routeDrawChain = Promise.resolve();

  return new Promise(resolve => {
    activeComputeDone = resolve;
    routeWorker = new Worker('route-worker.js');
    routeWorker.onmessage = event => {
      const { type, result, version: msgVersion } = event.data;
      if (msgVersion !== computeVersion || msgVersion !== version) return;
      if (type === 'altResult') {
        routeDrawChain = routeDrawChain.then(() => drawAltitudeResult(result, version));
      } else if (type === 'done') {
        routeDrawChain.then(() => {
          if (version !== computeVersion) return resolve(false);
          routeWorker?.terminate();
          routeWorker = null;
          activeComputeDone = null;
          routeSummaries.sort((a, b) => a.alt - b.alt);
          updateMetrics();
          drawMiniMap();
          if (noiseEnabled) scheduleExternalityLayer();
          resolve(true);
        });
      }
    };
    routeWorker.onerror = error => {
      console.error(error);
      routeWorker?.terminate();
      routeWorker = null;
      activeComputeDone = null;
      resolve(false);
    };
    const heightFieldBuffer = heightField.slice().buffer;
    routeWorker.postMessage({
      type: 'compute',
      version,
      N,
      CORE_N,
      CORE_OFFSET,
      entriesPerEdge,
      maxHeightWeight,
      altitudes: altitudes.slice(),
      heightFieldBuffer,
    }, [heightFieldBuffer]);
  });
}

function updateMetrics() {
  const legend = $('altLegend');
  legend.innerHTML = '';
  routeSummaries.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'alt';
    const pct = Math.round(s.flyPct.core * 100);
    row.innerHTML = `<span class="sw" style="background:${ROUTE_COLOR};opacity:${Math.min(1, (0.18 + 0.75 * s.weight) * routeOpacityScale).toFixed(2)}"></span><span>${s.alt} m</span><span style="margin-left:auto">W ${(s.weight).toFixed(2)} · ${s.pathCount || s.paths.length} 条 · ${pct}%</span>`;
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
  const img = ctx.createImageData(CORE_N, CORE_N);
  for (let cj = 0; cj < CORE_N; cj++) {
    for (let ci = 0; ci < CORE_N; ci++) {
      const i = ci + CORE_OFFSET;
      const j = cj + CORE_OFFSET;
      const k = idx(i, j);
      const p = ((CORE_N - 1 - cj) * CORE_N + ci) * 4;
      if (s.flyable[k]) {
        img.data[p] = 245; img.data[p + 1] = 247; img.data[p + 2] = 246; img.data[p + 3] = 255;
      } else {
        img.data[p] = 42; img.data[p + 1] = 47; img.data[p + 2] = 54; img.data[p + 3] = 255;
      }
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = CORE_N;
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
    let drawing = false;
    ctx.beginPath();
    for (const k of path) {
      const i = k % N;
      const j = (k / N) | 0;
      if (!isCoreCell(i, j)) {
        if (drawing) {
          ctx.stroke();
          ctx.beginPath();
          drawing = false;
        }
        continue;
      }
      const x = (i - CORE_OFFSET + 0.5) / CORE_N * W;
      const y = H - (j - CORE_OFFSET + 0.5) / CORE_N * H;
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (drawing) ctx.stroke();
  }
  ctx.globalAlpha = 1;
    const cap = $(`mapCap-${si}`);
    if (cap) cap.textContent = `${s.pathCount || s.paths.length} 条 · ${Math.round(s.flyPct.core * 100)}%`;
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
        const hx = b.x - a.x;
        const hz = b.z - a.z;
        const hLen = Math.hypot(hx, hz) || 1;
        segments.push({
          a,
          b,
          amp: s.weight * stride * cellStep,
          dirX: hx / hLen,
          dirZ: hz / hLen,
          alt: s.alt,
        });
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
    const dxz2 = pointSegDist2(px, pz, s.a.x, s.a.z, s.b.x, s.b.z);
    const alt = s.alt || (s.a.y + s.b.y) * 0.5;
    if (externalityChannel === 'risk') {
      const mx = (s.a.x + s.b.x) * 0.5;
      const mz = (s.a.z + s.b.z) * 0.5;
      const forward = 14 + alt * 0.34;
      const sx = mx + s.dirX * forward;
      const sz = mz + s.dirZ * forward;
      const rx = px - sx;
      const rz = pz - sz;
      const along = rx * s.dirX + rz * s.dirZ;
      const cross = rx * -s.dirZ + rz * s.dirX;
      const sigmaLong = 30 + alt * 0.45;
      const sigmaCross = 20 + alt * 0.25;
      const ballistic = Math.exp(-0.5 * ((along / sigmaLong) ** 2 + (cross / sigmaCross) ** 2));
      const sigmaVertical = 24 + alt * 0.30;
      const verticalDrop = Math.exp(-0.5 * (dxz2 / (sigmaVertical * sigmaVertical)));
      const surfaceCatch = py > terrainVisualHeight(px, pz) + 7 ? 0.78 : 1.08;
      v += s.amp * surfaceCatch * (0.62 * ballistic + 0.38 * verticalDrop);
    } else if (externalityChannel === 'privacy') {
      if (py >= alt - 1) continue;
      const d = Math.sqrt(d2);
      const lowerHemisphere = clamp01((alt - py) / Math.max(1, d));
      const identify = sigmoid((150 - d) / 18);
      const nadirPreference = 0.55 + 0.45 * lowerHemisphere;
      const receiverBias = py > terrainVisualHeight(px, pz) + 7 ? 0.74 : 1.12;
      v += s.amp * identify * nadirPreference * receiverBias / (1 + d2 / 26000);
    } else if (externalityChannel === 'visual') {
      const dh = Math.sqrt(dxz2) + 1;
      const dy = alt - py;
      const elevDeg = Math.atan2(dy, dh) * 180 / Math.PI;
      const highAnglePenalty = 1 / (1 + ((Math.max(0, elevDeg - 18) / 34) ** 2));
      const sameHeightBoost = 0.72 + 0.42 * Math.exp(-(dy * dy) / (2 * 26 * 26));
      const angularSize = sigmoid((115 - Math.sqrt(d2)) / 28);
      v += s.amp * highAnglePenalty * sameHeightBoost * angularSize / (155 + d2 * 0.82);
    } else {
      v += s.amp / (420 + d2);
    }
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
  clearTimeout(externalityTimer);
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

function scheduleExternalityLayer() {
  clearTimeout(externalityTimer);
  const version = ++externalityVersion;
  $('busy').classList.add('on');
  externalityTimer = setTimeout(async () => {
    await nextFrame();
    await buildNoiseLayer(version);
    if (version === externalityVersion && !computing) $('busy').classList.remove('on');
  }, 30);
}

async function buildNoiseLayer(version) {
  clearNoiseLayer();
  const segments = collectNoiseSegments();
  if (!segments.length) return;
  const channel = CHANNELS[externalityChannel] || CHANNELS.noise;

  const groundPositions = [];
  const groundIndices = [];
  const groundValues = [];
  for (let j = 0; j <= NOISE_GRID; j++) {
    for (let i = 0; i <= NOISE_GRID; i++) {
      const x = -CORE_HALF + CORE_DOMAIN * i / NOISE_GRID;
      const z = -CORE_HALF + CORE_DOMAIN * j / NOISE_GRID;
      const y = terrainVisualHeight(x, z) + 0.42;
      groundPositions.push(x, y, z);
      groundValues.push(channel.ground ? noiseAt(x, y, z, segments) * channel.ground : 0);
    }
    if (j % 5 === 4) {
      if (version !== externalityVersion) return;
      await nextFrame();
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
    if (b.isHalo) continue;
    if (!buildingTouchesCore(b)) continue;
    const geom = b.box.geometry.clone();
    geom.computeVertexNormals();
    const pos = geom.getAttribute('position');
    for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 24))) {
      probeValues.push(noiseAt(pos.getX(i) + b.group.position.x, pos.getY(i) + b.group.position.y, pos.getZ(i) + b.group.position.z, segments) * channel.facade);
    }
    overlayGeoms.push({ b, geom });
    if (overlayGeoms.length % 8 === 0) {
      if (version !== externalityVersion) return;
      await nextFrame();
    }
  }

  const norm = normalizeNoise(probeValues);
  const groundColors = [];
  for (let i = 0; i < groundValues.length; i++) {
    const v = groundValues[i];
    const c = colorRamp(Math.log1p(v / norm * 3.2) / Math.log1p(3.2), channel.palette);
    groundColors.push(c[0], c[1], c[2]);
    if (i % 500 === 499) {
      if (version !== externalityVersion) return;
      await nextFrame();
    }
  }
  if (version !== externalityVersion) return;
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
      const value = noiseAt(wx, wy, wz, segments) * channel.facade;
      const rawHot = Math.log1p(value / norm * 3.2) / Math.log1p(3.2);
      const hot = 0.10 + 0.90 * rawHot;
      const c = colorRamp(hot, channel.palette);
      colors.push(c[0], c[1], c[2]);
      pos.setXYZ(
        i,
        pos.getX(i) + normal.getX(i) * 0.45,
        pos.getY(i) + normal.getY(i) * 0.45,
        pos.getZ(i) + normal.getZ(i) * 0.45
      );
      if (i % 1200 === 1199) {
        if (version !== externalityVersion) return;
        await nextFrame();
      }
    }
    if (version !== externalityVersion) return;
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

function applyAuxiliaryBuildingVisibility() {
  for (const b of buildings) {
    if (b.isHalo && b.group) b.group.visible = haloBuildingsVisible;
  }
}

function applyTerrainMode() {
  clearNoiseLayer();
  buildTerrain();
  buildings.forEach(syncBuilding);
  applyAuxiliaryBuildingVisibility();
  scheduleCompute();
}

let needsCompute = false;
let computing = false;
let computeVersion = 0;
let busyTimer = null;
function scheduleCompute() {
  needsCompute = true;
  computeVersion++;
  stopRouteWorker();
  computing = false;
  $('busy').classList.add('on');
  clearTimeout(busyTimer);
}

function flushCompute() {
  if (!needsCompute || computing) return;
  needsCompute = false;
  computing = true;
  const version = computeVersion;
  recompute(version).finally(() => {
    if (version !== computeVersion) return;
    computing = false;
    if (needsCompute) return;
    clearTimeout(busyTimer);
    busyTimer = setTimeout(() => $('busy').classList.remove('on'), 160);
  });
}

BLOCKS.forEach(block => {
  const option = document.createElement('option');
  option.value = block.name;
  option.textContent = block.name;
  $('presets').appendChild(option);
});

$('presets').addEventListener('change', e => {
  loadPreset(e.target.value);
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
    scheduleExternalityLayer();
  } else {
    externalityVersion++;
    clearNoiseLayer();
  }
});

document.querySelectorAll('input[name="externalityChannel"]').forEach(input => {
  input.addEventListener('change', e => {
    if (!e.target.checked) return;
    externalityChannel = e.target.value;
    $('channelV').textContent = (CHANNELS[externalityChannel] || CHANNELS.noise).label;
    const sketch = $('kernelSketch');
    if (sketch) {
      sketch.dataset.channel = '';
      void sketch.offsetWidth;
      sketch.dataset.channel = externalityChannel;
    }
    if (noiseEnabled) {
      scheduleExternalityLayer();
    }
  });
});

$('demToggle').addEventListener('change', e => {
  demEnabled = e.target.checked;
  applyTerrainMode();
});

$('heightScaleToggle').addEventListener('change', e => {
  heightScaleVisible = e.target.checked;
  heightScaleGroup.visible = heightScaleVisible;
});

$('haloToggle').addEventListener('change', e => {
  haloBuildingsVisible = e.target.checked;
  applyAuxiliaryBuildingVisibility();
});

function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  applyCameraCompositionOffset(w);
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

function applyCameraCompositionOffset(width) {
  const panel = $('controlPanel');
  const panelRight = panel ? panel.getBoundingClientRect().right + PANEL_GAP : 0;
  const visualCenter = panelRight + Math.max(0, width - panelRight) / 2;
  const shiftPx = Math.max(0, visualCenter - width / 2);
  camera.projectionMatrix.elements[8] = -2 * shiftPx / width;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

function animate(t) {
  requestAnimationFrame(animate);
  flushCompute();
  controls.target.copy(ORBIT_TARGET);
  controls.update();
  controls.target.copy(ORBIT_TARGET);
  renderer.render(scene, camera);
}

buildMapTiles();
currentPreset = BLOCKS[0].name;
loadPreset(currentPreset);
onResize();
animate(0);
