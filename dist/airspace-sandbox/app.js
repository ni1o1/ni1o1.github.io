/* global THREE, CITY_BLOCKS */
'use strict';

const CORE_DOMAIN = 500;
const HALO_M = 150;
const DOMAIN = CORE_DOMAIN + HALO_M * 2;
const CELL = 10;
const N = Math.round(DOMAIN / CELL);
const VIEW_DOMAIN = 950;
const HEIGHT_GUIDE_DOMAIN = 650;
const HALF = DOMAIN / 2;
const CORE_HALF = CORE_DOMAIN / 2;
const VIEW_HALF = VIEW_DOMAIN / 2;
const ROUTE_COLOR = '#1677ff';
const SAFETY_M = 4;
const BOUNDARY_SNAP_M = 60;
const FLYABLE_VISUAL_BASE_M = 5;
const FLYABLE_VISUAL_BUFFER_M = 5;
const FLYABLE_VISUAL_CLEARANCE_M = 5; // 屋顶以上垂直安全间距:超过即可飞
const FLYABLE_VISUAL_BAND_M = 5;      // 高度分层步长(梯田粒度)
const FLYABLE_RANGE_HALF = 325;       // 可飞体计算范围 = 从中心 650m(±325),纳入 halo 环建筑
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
let routesVisible = false;
let noiseEnabled = true;
let demEnabled = false;
let buildingsVisible = true;
let shadowsEnabled = true;
let shadowBlurPct = 215;
let heightScaleVisible = true;
let haloBuildingsVisible = false;
let heightGuidesVisible = false;
let flyableVolumeVisible = false;
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
renderer.shadowMap.enabled = shadowsEnabled;
renderer.shadowMap.type = THREE.VSMShadowMap;
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
const CAMERA_DISTANCE = camera.position.distanceTo(ORBIT_TARGET);
let cameraAzimuthDeg = -46;
let cameraPitchDeg = 35;
let suppressCameraControlSync = false;
controls.addEventListener('change', syncCameraAnglesFromView);

scene.add(new THREE.HemisphereLight('#ffffff', '#d7dde2', 0.72));
const sun = new THREE.DirectionalLight('#ffffff', 1.15);
sun.position.set(-360, 520, 280);
sun.target.position.copy(ORBIT_TARGET);
sun.castShadow = shadowsEnabled;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -560;
sun.shadow.camera.right = 560;
sun.shadow.camera.top = 560;
sun.shadow.camera.bottom = -560;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 1600;
sun.shadow.bias = -0.00018;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 6;
if ('blurSamples' in sun.shadow) sun.shadow.blurSamples = 14;
scene.add(sun);
scene.add(sun.target);
let buildingColor = '#c2c2c2';
let sunAzimuthDeg = 350;
let sunPitchDeg = 75;

let terrainMesh = null;
let shadowGroundMesh = null;
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
const heightGuideGroup = new THREE.Group();
const flyableVolumeGroup = new THREE.Group();
const probeGroup = new THREE.Group();
scene.add(buildingGroup, routeGroup, anchorGroup, noiseGroup, heightScaleGroup, heightGuideGroup, flyableVolumeGroup, probeGroup);

const buildingMat = new THREE.MeshStandardMaterial({ color: buildingColor, roughness: 0.72, metalness: 0.0, vertexColors: true, side: THREE.DoubleSide });
const edgeMat = new THREE.LineBasicMaterial({ color: '#67717d', transparent: true, opacity: 0.92, depthWrite: false });
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
const heightGuideMat = new THREE.MeshBasicMaterial({
  color: ROUTE_COLOR,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});
const groundBoundaryMat = new THREE.MeshBasicMaterial({
  color: '#7d8791',
  transparent: true,
  opacity: 0.88,
  depthWrite: false,
});
const flyableVolumeMat = new THREE.MeshBasicMaterial({
  color: '#9fd3ff',
  transparent: true,
  opacity: 0.28,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const flyableOutlineMat = new THREE.LineBasicMaterial({
  color: '#2f8fd7',
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
});
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
  const light = sun.position.clone().normalize();
  for (let i = 0; i < normals.count; i++) {
    const n = new THREE.Vector3(normals.getX(i), normals.getY(i), normals.getZ(i)).normalize();
    const top = Math.max(0, n.y);
    const side = Math.max(0, n.dot(light));
    const shade = 0.74 + 0.18 * side + 0.10 * top;
    colors.push(shade, shade, shade);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function updateSunDirection() {
  const az = THREE.MathUtils.degToRad(sunAzimuthDeg);
  const pitch = THREE.MathUtils.degToRad(sunPitchDeg);
  const distance = 620;
  const horizontal = distance * Math.cos(pitch);
  sun.position.set(
    ORBIT_TARGET.x + Math.sin(az) * horizontal,
    ORBIT_TARGET.y + Math.sin(pitch) * distance,
    ORBIT_TARGET.z + Math.cos(az) * horizontal
  );
  sun.target.position.copy(ORBIT_TARGET);
  sun.target.updateMatrixWorld();
  sun.shadow.needsUpdate = true;
}

function updateBuildingAppearance() {
  buildingMat.color.set(buildingColor);
  for (const b of buildings) {
    if (!b.box || b.isHalo) continue;
    applyFacadeShading(b.box.geometry);
  }
}

function applyShadowMode() {
  renderer.shadowMap.enabled = shadowsEnabled;
  renderer.shadowMap.needsUpdate = true;
  sun.castShadow = shadowsEnabled;
  const softness = shadowBlurPct / 100;
  sun.shadow.radius = 1 + softness * 10;
  if ('blurSamples' in sun.shadow) sun.shadow.blurSamples = Math.round(4 + softness * 18);
  sun.shadow.needsUpdate = true;
  if (terrainMesh) terrainMesh.receiveShadow = shadowsEnabled;
  if (shadowGroundMesh) {
    shadowGroundMesh.visible = shadowsEnabled;
    shadowGroundMesh.receiveShadow = shadowsEnabled;
    shadowGroundMesh.material.opacity = 0.34 - softness * 0.16;
    shadowGroundMesh.material.needsUpdate = true;
  }
  for (const b of buildings) {
    if (!b.box) continue;
    b.box.castShadow = shadowsEnabled;
    b.box.receiveShadow = shadowsEnabled;
  }
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
  const baseY = 0.16;
  const topY = height + 0.02;
  const add = (a, b) => {
    pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  };
  for (let i = 0; i < localPoly.length; i++) {
    const p = localPoly[i];
    const q = localPoly[(i + 1) % localPoly.length];
    add([p[0], baseY, p[1]], [q[0], baseY, q[1]]);
    add([p[0], topY, p[1]], [q[0], topY, q[1]]);
    add([p[0], baseY, p[1]], [p[0], topY, p[1]]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geom;
}

function makeFootprintLineGeometry(localPoly, y) {
  const pts = [];
  for (let i = 0; i < localPoly.length; i++) {
    const p = localPoly[i];
    const q = localPoly[(i + 1) % localPoly.length];
    pts.push(p[0], y, p[1], q[0], y, q[1]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geom;
}

function makeBuilding(raw, addToScene = true) {
  const absPoly = raw.polygon.map(p => [p[0], p[1]]);
  const c = centroid(absPoly);
  const localPoly = absPoly.map(p => [p[0] - c[0], p[1] - c[1]]);
  const auxiliaryByRole = raw.role === 'halo' || raw.tags?.role === 'halo';
  const b = {
    id: nextId++,
    x: c[0],
    z: c[1],
    localPoly,
    h: Math.max(3, Math.min(220, raw.height || 12)),
    minH: Math.max(0, Math.min(210, raw.minHeight || 0)),
    isPart: Boolean(raw.isPart),
    isHalo: auxiliaryByRole,
  };
  if (b.h <= b.minH + 1) b.h = b.minH + 4;
  if (!addToScene) return b;
  b.group = new THREE.Group();
  b.group.position.set(b.x, terrainVisualHeight(b.x, b.z) + b.minH + (b.minH > 0 ? 0.08 : 0), b.z);
  b.box = new THREE.Mesh(makePrismGeometry(b.localPoly, b.h - b.minH), b.isHalo ? haloBuildingMat : buildingMat);
  b.box.castShadow = shadowsEnabled;
  b.box.receiveShadow = shadowsEnabled;
  b.box.userData = { type: 'building', id: b.id };
  b.edges = new THREE.LineSegments(makeOutlineGeometry(b.localPoly, b.h - b.minH), b.isHalo ? haloEdgeMat : edgeMat);
  b.edges.renderOrder = 2;
  if (b.minH > 0 || b.isPart) {
    b.roofSeam = new THREE.LineSegments(makeFootprintLineGeometry(b.localPoly, 0.34), b.isHalo ? haloEdgeMat : edgeMat);
    b.roofSeam.renderOrder = 3;
  }
  if (b.isHalo) b.group.renderOrder = 1;
  b.group.add(b.box, b.edges);
  if (b.roofSeam) b.group.add(b.roofSeam);
  buildingGroup.add(b.group);
  return b;
}

function rebuildBuildingGeometry(b) {
  b.box.geometry.dispose();
  b.edges.geometry.dispose();
  if (b.roofSeam) b.roofSeam.geometry.dispose();
  b.box.geometry = makePrismGeometry(b.localPoly, Math.max(1, b.h - b.minH));
  b.edges.geometry = makeOutlineGeometry(b.localPoly, Math.max(1, b.h - b.minH));
  if (b.roofSeam) b.roofSeam.geometry = makeFootprintLineGeometry(b.localPoly, 0.34);
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
  if (shadowGroundMesh) {
    scene.remove(shadowGroundMesh);
    shadowGroundMesh.geometry.dispose();
    shadowGroundMesh.material.dispose();
    shadowGroundMesh = null;
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
  terrainMesh.receiveShadow = shadowsEnabled;
  scene.add(terrainMesh);
  buildShadowGround();
  buildTerrainReliefLines();
  grid.position.y = Math.max(0.12, terrainVisualHeight(0, 0) + 0.12);
  buildHeightScale();
}

function buildShadowGround() {
  const geom = new THREE.PlaneGeometry(VIEW_DOMAIN, VIEW_DOMAIN, 1, 1);
  const mat = new THREE.ShadowMaterial({
    color: '#000000',
    opacity: 0.24,
    transparent: true,
    depthWrite: false,
  });
  shadowGroundMesh = new THREE.Mesh(geom, mat);
  shadowGroundMesh.rotation.x = -Math.PI / 2;
  shadowGroundMesh.position.set(0, Math.max(0.06, terrainVisualHeight(0, 0) + 0.06), 0);
  shadowGroundMesh.receiveShadow = shadowsEnabled;
  shadowGroundMesh.visible = shadowsEnabled;
  shadowGroundMesh.renderOrder = 1;
  scene.add(shadowGroundMesh);
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

function addGuideTube(a, b, radius, material, group = heightGuideGroup) {
  const start = a instanceof THREE.Vector3 ? a : new THREE.Vector3(a[0], a[1], a[2]);
  const end = b instanceof THREE.Vector3 ? b : new THREE.Vector3(b[0], b[1], b[2]);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len <= 1e-6) return;
  const geom = new THREE.CylinderGeometry(radius, radius, len, 10, 1, false);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.renderOrder = 7;
  group.add(mesh);
}

function addGuideJoint(point, radius, material, group = heightGuideGroup) {
  const geom = new THREE.SphereGeometry(radius, 10, 6);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.copy(point);
  mesh.renderOrder = 7;
  group.add(mesh);
}

function addGuidePolyline(points, radius, material, dashed = false) {
  const dashSize = 18;
  const gapSize = 8;
  if (!dashed) {
    for (const p of points) addGuideJoint(p, radius, material);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!dashed) {
      addGuideTube(a, b, radius, material);
      continue;
    }
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len <= 1e-6) continue;
    dir.normalize();
    for (let t = 0; t < len; t += dashSize + gapSize) {
      const s = a.clone().addScaledVector(dir, t);
      const e = a.clone().addScaledVector(dir, Math.min(len, t + dashSize));
      addGuideTube(s, e, radius, material);
      addGuideJoint(s, radius, material);
      addGuideJoint(e, radius, material);
    }
  }
}

function buildHeightGuides() {
  heightGuideGroup.clear();
  const guideHalf = HEIGHT_GUIDE_DOMAIN / 2;
  const groundY = Math.max(0.22, terrainVisualHeight(0, 0) + 0.22);
  const groundPts = [
    new THREE.Vector3(-guideHalf, groundY, -guideHalf),
    new THREE.Vector3(guideHalf, groundY, -guideHalf),
    new THREE.Vector3(guideHalf, groundY, guideHalf),
    new THREE.Vector3(-guideHalf, groundY, guideHalf),
    new THREE.Vector3(-guideHalf, groundY, -guideHalf),
  ];
  addGuidePolyline(groundPts, 0.75, groundBoundaryMat, false);
  for (const alt of [60, 120]) {
    const pts = [
      new THREE.Vector3(-guideHalf, alt, -guideHalf),
      new THREE.Vector3(guideHalf, alt, -guideHalf),
      new THREE.Vector3(guideHalf, alt, guideHalf),
      new THREE.Vector3(-guideHalf, alt, guideHalf),
      new THREE.Vector3(-guideHalf, alt, -guideHalf),
    ];
    addGuidePolyline(pts, 0.65, heightGuideMat, true);
  }
  heightGuideGroup.visible = heightGuidesVisible;
}

function loadPreset(name) {
  currentPreset = name;
  currentBlock = BLOCKS.find(b => b.name === name) || BLOCKS[0];
  clearNoiseLayer();
  clearFlyableVolume();
  buildingGroup.clear();
  buildings = [];
  obstacleBuildings = [];
  nextId = 1;
  buildTerrain();
  buildHeightGuides();
  obstacleBuildings = currentBlock.buildings.map(raw => makeBuilding(raw, false));
  currentBlock.buildings.forEach(raw => buildings.push(makeBuilding(raw, true)));
  if (typeof clearProbeFacade === 'function') clearProbeFacade();  // 换街区→立面缓存失效
  applyAuxiliaryBuildingVisibility();
  rebuildFlyableVolume();
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
  const depth = Math.max(1, Math.round(BOUNDARY_SNAP_M / CELL));
  const snap = (edge, a) => {
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
  };
  const pick = (edge, n) => {
    const gates = [];
    for (let a = 0; a < n; a++) {
      const k = snap(edge, a);
      if (k !== null) gates.push(k);
    }
    if (!gates.length) return;
    const want = Math.min(entriesPerEdge, gates.length);
    for (let t = 0; t < want; t++) anchors.push(gates[Math.floor((t + 0.5) / want * gates.length)]);
  };
  pick('top', N);
  pick('bottom', N);
  pick('left', N);
  pick('right', N);
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

// 体素格 k → 世界中心 [x,z]
function cellCenterXZ(k) {
  return [gx(k % N), iToZ((k / N) | 0)];
}

// 视线检查:世界坐标 a→b,用栅格步进(Amanatides–Woo)遍历线段穿过的**每一个格**,
// 要求全部可飞。逐格遍历(非采样)→ 不会从两采样点之间漏掉被擦过的建筑格。
function segmentClear(ax, az, bx, bz, flyable) {
  const x0 = (ax + HALF) / CELL, y0 = (az + HALF) / CELL;
  const x1 = (bx + HALF) / CELL, y1 = (bz + HALF) / CELL;
  let i = Math.floor(x0), j = Math.floor(y0);
  const iEnd = Math.floor(x1), jEnd = Math.floor(y1);
  const dx = x1 - x0, dy = y1 - y0;
  const stepi = dx > 0 ? 1 : -1, stepj = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? (i + 1 - x0) : (x0 - i)) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? (j + 1 - y0) : (y0 - j)) * tDeltaY : Infinity;
  const blocked = (ci, cj) => ci < 0 || ci >= N || cj < 0 || cj >= N || !flyable[idx(ci, cj)];
  if (blocked(i, j)) return false;
  let guard = 0;
  while ((i !== iEnd || j !== jEnd) && guard++ < 4 * N) {
    if (tMaxX < tMaxY) { tMaxX += tDeltaX; i += stepi; }
    else { tMaxY += tDeltaY; j += stepj; }
    if (blocked(i, j)) return false;
  }
  return true;
}

// 串拉(string-pulling):贪心连接视线可达的最远点,把体素锯齿压成几段直线(保证不穿障碍)。
function stringPull(pts, flyable) {
  if (pts.length <= 2) return pts.slice();
  const out = [pts[0]];
  let anchor = 0;
  while (anchor < pts.length - 1) {
    let next = anchor + 1;
    for (let j = pts.length - 1; j > anchor + 1; j--) {
      if (segmentClear(pts[anchor][0], pts[anchor][1], pts[j][0], pts[j][1], flyable)) { next = j; break; }
    }
    out.push(pts[next]);
    anchor = next;
  }
  return out;
}

// 带避障守卫的拐角圆角:每个拐角只在"切出来的两段都视线可达"时才切,否则保留尖角。
// 圆角后的整条折线每一段都经 segmentClear 校验,绝不会切进建筑。
function roundCorners(pts, flyable, iters = 2) {
  let cur = pts;
  for (let it = 0; it < iters; it++) {
    if (cur.length <= 2) break;
    const next = [cur[0]];
    for (let i = 1; i < cur.length - 1; i++) {
      const a = cur[i - 1], b = cur[i], c = cur[i + 1];
      const q = [b[0] + (a[0] - b[0]) * 0.25, b[1] + (a[1] - b[1]) * 0.25];
      const r = [b[0] + (c[0] - b[0]) * 0.25, b[1] + (c[1] - b[1]) * 0.25];
      const prev = next[next.length - 1];
      if (segmentClear(prev[0], prev[1], q[0], q[1], flyable) &&
          segmentClear(q[0], q[1], r[0], r[1], flyable)) {
        next.push(q, r);
      } else {
        next.push(b); // 切角会蹭楼 → 保留原拐角(那段本就安全)
      }
    }
    const end = cur[cur.length - 1];
    const tail = next[next.length - 1];
    if (!segmentClear(tail[0], tail[1], end[0], end[1], flyable)) {
      next[next.length - 1] = cur[cur.length - 2]; // 末段蹭楼 → 退回原倒数第二点
    }
    next.push(end);
    cur = next;
  }
  return cur;
}

// 体素路径 → 平滑世界折线:先串拉去锯齿(几段安全直线),再守卫式圆角。
function smoothRoutePath(cells, flyable) {
  if (cells.length < 2) return cells.map(cellCenterXZ);
  return roundCorners(stringPull(cells.map(cellCenterXZ), flyable), flyable, 2);
}

function makeRouteBandMesh(paths, alt, opacity, flyable) {
  const positions = [];
  const indices = [];
  const halfWidth = 1.35;
  for (const cells of paths) {
    const poly = flyable ? smoothRoutePath(cells, flyable) : cells.map(cellCenterXZ);
    for (let p = 0; p < poly.length - 1; p++) {
      const ax = poly[p][0], az = poly[p][1];
      const bx = poly[p + 1][0], bz = poly[p + 1][1];
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

function clearFlyableVolume() {
  for (const child of flyableVolumeGroup.children) {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
  }
  flyableVolumeGroup.clear();
}

function signedLoopAreaWorld(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function ensureWinding(loop, wantCCW) {
  const isCCW = signedLoopAreaWorld(loop) > 0;
  return isCCW === wantCCW ? loop : loop.slice().reverse();
}

// 在高度 y 处把"外环+孔"三角化成一张水平盖(材质 DoubleSide,faceUp 仅决定缠绕)。
function emitCap(outer, holes, y, faceUp, positions, indices) {
  const o = ensureWinding(outer, true);
  const hs = holes.map(h => ensureWinding(h, false));
  const tris = THREE.ShapeUtils.triangulateShape(
    o.map(p => new THREE.Vector2(p[0], p[1])),
    hs.map(h => h.map(p => new THREE.Vector2(p[0], p[1]))),
  );
  const ids = [];
  for (const loop of [o, ...hs]) {
    for (const p of loop) { ids.push(positions.length / 3); positions.push(p[0], y, p[1]); }
  }
  for (const tri of tris) {
    if (faceUp) indices.push(ids[tri[0]], ids[tri[1]], ids[tri[2]]);
    else indices.push(ids[tri[2]], ids[tri[1]], ids[tri[0]]);
  }
}

// 把若干闭合环(外环+孔)的侧墙从 y0 拉到 y1(仅出面,不画轮廓——
// 相邻高度带的墙共面相接,填充本就连成一片;轮廓只画真实轮廓边,避免"分层"假象)。
function emitWalls(loops, y0, y1, positions, indices) {
  for (const loop of loops) {
    if (loop.length < 2) continue;
    const top = [];
    const bottom = [];
    for (const p of loop) {
      top.push(positions.length / 3); positions.push(p[0], y1, p[1]);
      bottom.push(positions.length / 3); positions.push(p[0], y0, p[1]);
    }
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      indices.push(bottom[i], bottom[j], top[j], bottom[i], top[j], top[i]);
    }
  }
}

// 在高度 y 画一圈水平轮廓线(地板/天花板/屋顶盖的边缘)。
function emitRingOutline(loops, y, outlinePositions) {
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      outlinePositions.push(loop[i][0], y, loop[i][1], loop[j][0], y, loop[j][1]);
    }
  }
}

// ---- 可飞体块:Clipper 精确平面布尔(buffer + 并 + 减)+ 垂直拉伸 ----
const CLIP_SCALE = 100; // Clipper 用整数坐标:米 ×100 → 厘米精度

// Clipper 整数路径 → 世界坐标环 [[x,z],...]
function clipPathToWorld(path) {
  return path.map(pt => [pt.X / CLIP_SCALE, pt.Y / CLIP_SCALE]);
}

// 从 Clipper PolyTree 收集 {外环, 孔[]} 列表:非孔节点=实体,其直接子=孔,
// 孔内的子节点(天井里的实心岛)递归再成实体。
function collectClipperSolids(node, out) {
  for (const child of node.Childs()) {
    const outer = clipPathToWorld(child.Contour());
    const holes = child.Childs().map(h => clipPathToWorld(h.Contour()));
    if (outer.length >= 3) out.push({ outer, holes: holes.filter(h => h.length >= 3) });
    for (const h of child.Childs()) collectClipperSolids(h, out); // 岛屿
  }
}

// 可飞体的外裁剪方形 = 从中心 ±FLYABLE_RANGE_HALF(650m,纳入 halo 环),不再只裁到 core(500m)。
function squareClipPath(S) {
  const R = FLYABLE_RANGE_HALF;
  return [[
    { X: -R * S, Y: -R * S }, { X: R * S, Y: -R * S },
    { X: R * S, Y: R * S }, { X: -R * S, Y: R * S },
  ]];
}

// 给定一组建筑 → 它们 footprint 外扩 FLYABLE_VISUAL_BUFFER_M 的并集(Clipper 整数 Paths)。
function bufferedObstaclePaths(buildings, S) {
  const paths = buildings
    .map(b => b.localPoly.map(p => ({ X: Math.round((p[0] + b.x) * S), Y: Math.round((p[1] + b.z) * S) })))
    .filter(path => path.length >= 3);
  if (!paths.length) return null;
  const co = new ClipperLib.ClipperOffset(2, 0.25 * S);
  co.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, FLYABLE_VISUAL_BUFFER_M * S);
  return out.length ? out : null;
}

// PolyTree 的所有环(int),供后续布尔(梯田 ledge)复用。
function polyTreePaths(tree) {
  const out = [];
  (function walk(node) {
    for (const ch of node.Childs()) { out.push(ch.Contour()); walk(ch); }
  })(tree);
  return out;
}

// core 方形 ⊖ buffered 障碍 = 该高度的可飞面;返回 {solids:世界环嵌套, paths:int环}。
function flyableRegion(buffered, S) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(squareClipPath(S), ClipperLib.PolyType.ptSubject, true);
  if (buffered && buffered.length) c.AddPaths(buffered, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctDifference, tree,
    ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const solids = [];
  collectClipperSolids(tree, solids);
  return { solids, paths: polyTreePaths(tree) };
}

// subjPaths ⊖ clipPaths → 世界环嵌套(算上层比下层新开出的"屋顶盖")。
function differenceSolids(subjPaths, clipPaths, S) {
  if (!subjPaths || !subjPaths.length) return [];
  const c = new ClipperLib.Clipper();
  c.AddPaths(subjPaths, ClipperLib.PolyType.ptSubject, true);
  if (clipPaths && clipPaths.length) c.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctDifference, tree,
    ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const solids = [];
  collectClipperSolids(tree, solids);
  return solids;
}

// 可飞体块(高度相关 / 梯田):从 yBase(=5m)往上的整块,逐栋楼只挖到「屋顶 + 5m 间距」。
// 实现:把每栋楼的"封顶高度"= ceil(屋顶+CLEARANCE) 作高度断点,逐高度带只减去仍在挡的楼
// (Clipper buffer+difference),侧墙逐带挤出;每带交界处补一张"已开出区域"的水平盖(屋顶面),
// 最底封地板、最高封天花板 → 得到一个在每栋楼上方阶梯式打开的可飞体。
function addBufferedVolume(yBase, yMax, positions, indices, outlinePositions) {
  if (typeof ClipperLib === 'undefined' || !obstacleBuildings.length) return false;
  const S = CLIP_SCALE;
  const STEP = FLYABLE_VISUAL_BAND_M;

  // 每栋楼:从 yBase 一直挡到 屋顶+CLEARANCE(向上取整到 STEP,保证间距≥5m);clamp 到 [yBase,yMax]
  const obstacles = obstacleBuildings.map(b => {
    const top = Math.max(yBase, Math.min(yMax, Math.ceil((b.h + FLYABLE_VISUAL_CLEARANCE_M) / STEP) * STEP));
    return { b, top };
  }).filter(o => o.top > yBase + 1e-6);

  // 没有障碍(或都比 yBase 还矮):整块方形从 yBase 到 yMax
  if (!obstacles.length) {
    const { solids } = flyableRegion(null, S);
    for (const s of solids) {
      const rings = [s.outer, ...s.holes];
      emitWalls(rings, yBase, yMax, positions, indices);
      emitCap(s.outer, s.holes, yBase, false, positions, indices);
      emitCap(s.outer, s.holes, yMax, true, positions, indices);
      emitRingOutline(rings, yBase, outlinePositions);
      emitRingOutline(rings, yMax, outlinePositions);
    }
    return true;
  }

  // 高度断点 = yBase, yMax, 各楼封顶高度
  const cuts = [...new Set([yBase, yMax, ...obstacles.map(o => o.top)])]
    .filter(y => y >= yBase && y <= yMax).sort((a, b) => a - b);

  let built = false;
  let prevPaths = null; // 下层可飞面(int),用于交界处算屋顶盖
  for (let i = 0; i < cuts.length - 1; i++) {
    const yA = cuts[i], yB = cuts[i + 1];
    if (yB - yA < 1e-6) continue;
    const blockers = obstacles.filter(o => o.top > yA + 1e-6).map(o => o.b);
    const buffered = blockers.length ? bufferedObstaclePaths(blockers, S) : null;
    const { solids, paths } = flyableRegion(buffered, S);

    // 侧墙:逐带挤面但不画轮廓(相邻带共面,填充连成一片)
    for (const s of solids) emitWalls([s.outer, ...s.holes], yA, yB, positions, indices);

    if (i === 0) {
      // 地板 + 地板边缘轮廓(含各楼在基面的 footprint)
      for (const s of solids) {
        emitCap(s.outer, s.holes, yA, false, positions, indices);
        emitRingOutline([s.outer, ...s.holes], yA, outlinePositions);
      }
    } else {
      // 这层比下层新开出的区域 = 某些楼的屋顶盖:封盖 + 屋顶边缘(只画水平边)
      for (const s of differenceSolids(paths, prevPaths, S)) {
        const rings = [s.outer, ...s.holes];
        emitCap(s.outer, s.holes, yA, true, positions, indices);
        emitRingOutline(rings, yA, outlinePositions);
      }
    }

    if (i === cuts.length - 2) {
      // 天花板 + 边缘(只画水平边)
      for (const s of solids) {
        const rings = [s.outer, ...s.holes];
        emitCap(s.outer, s.holes, yB, true, positions, indices);
        emitRingOutline(rings, yB, outlinePositions);
      }
    }
    prevPaths = paths;
    built = true;
  }
  return built;
}

function rebuildFlyableVolume() {
  clearFlyableVolume();
  flyableVolumeGroup.visible = flyableVolumeVisible;
  if (!flyableVolumeVisible || !obstacleBuildings.length) return;
  const positions = [];
  const indices = [];
  const outlinePositions = [];
  const ok = addBufferedVolume(FLYABLE_VISUAL_BASE_M, ALT_MAX, positions, indices, outlinePositions);
  if (!ok) return;
  if (!positions.length || !indices.length) return;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  const mat = flyableVolumeMat.clone();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 2;
  flyableVolumeGroup.add(mesh);
  if (outlinePositions.length) {
    const outlineGeom = new THREE.BufferGeometry();
    outlineGeom.setAttribute('position', new THREE.Float32BufferAttribute(outlinePositions, 3));
    const outline = new THREE.LineSegments(outlineGeom, flyableOutlineMat.clone());
    outline.renderOrder = 3;
    flyableVolumeGroup.add(outline);
  }
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
  const routeOpacity = Math.min(0.55, (0.010 + 0.070 * result.weight) * routeOpacityScale);
  const anchorOpacity = Math.min(0.85, (0.045 + 0.16 * result.weight) * routeOpacityScale);
  drawAnchors(result.anchors, result.alt, anchorOpacity);
  const routeMesh = makeRouteBandMesh(result.paths, result.alt, routeOpacity, result.flyable);
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
  clearFlyableVolume();
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
          rebuildFlyableVolume();
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

function noiseAt(px, py, pz, segments, channel = externalityChannel) {
  let v = 0;
  for (const s of segments) {
    const d2 = pointSegmentDistanceSq3(px, py, pz, s.a, s.b);
    const dxz2 = pointSegDist2(px, pz, s.a.x, s.a.z, s.b.x, s.b.z);
    const alt = s.alt || (s.a.y + s.b.y) * 0.5;
    if (channel === 'risk') {
      // ★坠落物只能往下砸:受体必须在无人机【下方】,且用"落到该受体高度"的下落距离 fall
      const fall = alt - py;                    // 到该受体高度的下落距离(不是到地面)
      if (fall <= 1) continue;                  // 同高/更高 → 砸不到,零风险(切走整面墙顶以上)
      const mx = (s.a.x + s.b.x) * 0.5;
      const mz = (s.a.z + s.b.z) * 0.5;
      const forward = 14 + fall * 0.34;         // 前甩 = 下落到该高度时已前移的量(随 fall)
      const sx = mx + s.dirX * forward;
      const sz = mz + s.dirZ * forward;
      const rx = px - sx;
      const rz = pz - sz;
      const along = rx * s.dirX + rz * s.dirZ;
      const cross = rx * -s.dirZ + rz * s.dirX;
      const sigmaLong = 30 + fall * 0.45;       // 弥散随【下落距离】增长:越靠近无人机越窄越集中
      const sigmaCross = 20 + fall * 0.25;
      const sigmaVertical = 24 + fall * 0.30;
      // ★归一化 2D 落区 PDF(∫=1):峰值 ∝ 1/(2π σ²) → 弥散随 fall 变宽则单点风险被稀释
      const ballistic = Math.exp(-0.5 * ((along / sigmaLong) ** 2 + (cross / sigmaCross) ** 2))
        / (2 * Math.PI * sigmaLong * sigmaCross);
      const verticalDrop = Math.exp(-0.5 * (dxz2 / (sigmaVertical * sigmaVertical)))
        / (2 * Math.PI * sigmaVertical * sigmaVertical);
      const footprint = 0.62 * ballistic + 0.38 * verticalDrop;
      // ★撞击动能 → 致命率(落得越远动能越大、终速封顶;Dalamagkidis sigmoid)
      const vz = Math.min(45, Math.sqrt(2 * 9.81 * fall)); // 落到该高度的落速,终速 ~45 m/s 封顶
      const eImpact = 0.5 * 9.5 * (18 * 18 + vz * vz);     // ½m(v_h²+v_z²),美团四代 9.5kg/18m/s
      const pFatal = 1 / (1 + Math.pow(34000 / 34, Math.sqrt(34 / eImpact)));
      const surfaceCatch = py > terrainVisualHeight(px, pz) + 7 ? 0.78 : 1.08; // 首面截获代理
      v += s.amp * surfaceCatch * footprint * pFatal;
    } else if (channel === 'privacy') {
      if (py >= alt - 1) continue;
      const d = Math.sqrt(d2);
      const lowerHemisphere = clamp01((alt - py) / Math.max(1, d));
      const identify = sigmoid((150 - d) / 18);
      const nadirPreference = 0.55 + 0.45 * lowerHemisphere;
      const receiverBias = py > terrainVisualHeight(px, pz) + 7 ? 0.74 : 1.12;
      v += s.amp * identify * nadirPreference * receiverBias / (1 + d2 / 26000);
    } else if (channel === 'visual') {
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

// 只切换全局负担层(地面 + 挂在建筑上的立面 overlay)的可见性,不销毁不重算
function setNoiseLayerVisible(visible) {
  if (noiseGroundMesh) noiseGroundMesh.visible = visible;
  for (const item of noiseOverlays) item.mesh.visible = visible;
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
  if (probeMode) setNoiseLayerVisible(false);  // 探针开着时,后台重算出来的全局层保持隐藏
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
    if (!b.group) continue;
    b.group.visible = buildingsVisible && (!b.isHalo || haloBuildingsVisible);
  }
}

function applyTerrainMode() {
  clearNoiseLayer();
  buildTerrain();
  buildHeightGuides();
  buildings.forEach(syncBuilding);
  applyAuxiliaryBuildingVisibility();
  scheduleCompute();
}

function applyCameraAngles() {
  const az = THREE.MathUtils.degToRad(cameraAzimuthDeg);
  const pitch = THREE.MathUtils.degToRad(cameraPitchDeg);
  const horizontal = CAMERA_DISTANCE * Math.cos(pitch);
  suppressCameraControlSync = true;
  camera.position.set(
    ORBIT_TARGET.x + Math.sin(az) * horizontal,
    ORBIT_TARGET.y + Math.sin(pitch) * CAMERA_DISTANCE,
    ORBIT_TARGET.z + Math.cos(az) * horizontal
  );
  controls.target.copy(ORBIT_TARGET);
  controls.update();
  suppressCameraControlSync = false;
}

function syncCameraControls() {
  const azimuth = $('cameraAzimuth');
  const pitch = $('cameraPitch');
  if (!azimuth || !pitch) return;
  azimuth.value = cameraAzimuthDeg;
  pitch.value = cameraPitchDeg;
  $('azimuthV').textContent = cameraAzimuthDeg;
  $('pitchV').textContent = cameraPitchDeg;
}

function syncAppearanceControls() {
  const colorInput = $('buildingColor');
  const sunInput = $('sunAzimuth');
  const sunPitchInput = $('sunPitch');
  const shadowBlurInput = $('shadowBlur');
  if (colorInput) {
    colorInput.value = buildingColor;
    $('buildingColorV').textContent = buildingColor;
  }
  if (sunInput) {
    sunInput.value = sunAzimuthDeg;
    $('sunAzimuthV').textContent = sunAzimuthDeg;
  }
  if (sunPitchInput) {
    sunPitchInput.value = sunPitchDeg;
    $('sunPitchV').textContent = sunPitchDeg;
  }
  if (shadowBlurInput) {
    shadowBlurInput.value = shadowBlurPct;
    $('shadowBlurV').textContent = shadowBlurPct;
  }
}

function syncCameraAnglesFromView() {
  if (suppressCameraControlSync) return;
  const dx = camera.position.x - ORBIT_TARGET.x;
  const dy = camera.position.y - ORBIT_TARGET.y;
  const dz = camera.position.z - ORBIT_TARGET.z;
  let az = Math.round(THREE.MathUtils.radToDeg(Math.atan2(dx, dz)));
  if (az > 180) az -= 360;
  if (az < -180) az += 360;
  const pitch = Math.round(THREE.MathUtils.radToDeg(Math.atan2(dy, Math.hypot(dx, dz))));
  if (az === cameraAzimuthDeg && pitch === cameraPitchDeg) return;
  cameraAzimuthDeg = az;
  cameraPitchDeg = pitch;
  syncCameraControls();
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

function activatePanelTab(tab) {
  document.querySelectorAll('.tabBtn').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
  });
  document.querySelectorAll('.tabPanel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === tab);
  });
}

document.querySelectorAll('.tabBtn').forEach(btn => {
  btn.addEventListener('click', () => activatePanelTab(btn.dataset.tab));
});

activatePanelTab(document.querySelector('.tabBtn.active')?.dataset.tab || 'view');

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

$('cameraAzimuth').addEventListener('input', e => {
  cameraAzimuthDeg = +e.target.value;
  $('azimuthV').textContent = cameraAzimuthDeg;
  applyCameraAngles();
});

$('cameraPitch').addEventListener('input', e => {
  cameraPitchDeg = +e.target.value;
  $('pitchV').textContent = cameraPitchDeg;
  applyCameraAngles();
});

$('buildingColor').addEventListener('input', e => {
  buildingColor = e.target.value;
  $('buildingColorV').textContent = buildingColor;
  updateBuildingAppearance();
});

$('sunAzimuth').addEventListener('input', e => {
  sunAzimuthDeg = +e.target.value;
  $('sunAzimuthV').textContent = sunAzimuthDeg;
  updateSunDirection();
  updateBuildingAppearance();
});

$('sunPitch').addEventListener('input', e => {
  sunPitchDeg = +e.target.value;
  $('sunPitchV').textContent = sunPitchDeg;
  updateSunDirection();
  updateBuildingAppearance();
});

$('shadowBlur').addEventListener('input', e => {
  shadowBlurPct = +e.target.value;
  $('shadowBlurV').textContent = shadowBlurPct;
  applyShadowMode();
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
    if (probeMode) rebuildProbe();
  });
});

$('demToggle').addEventListener('change', e => {
  demEnabled = e.target.checked;
  applyTerrainMode();
});

$('buildingToggle').addEventListener('change', e => {
  buildingsVisible = e.target.checked;
  applyAuxiliaryBuildingVisibility();
});

$('shadowToggle').addEventListener('change', e => {
  shadowsEnabled = e.target.checked;
  applyShadowMode();
});

$('heightScaleToggle').addEventListener('change', e => {
  heightScaleVisible = e.target.checked;
  heightScaleGroup.visible = heightScaleVisible;
});

$('haloToggle').addEventListener('change', e => {
  haloBuildingsVisible = e.target.checked;
  applyAuxiliaryBuildingVisibility();
});

$('heightGuideToggle').addEventListener('change', e => {
  heightGuidesVisible = e.target.checked;
  heightGuideGroup.visible = heightGuidesVisible;
});

$('flyableVolumeToggle').addEventListener('change', e => {
  flyableVolumeVisible = e.target.checked;
  rebuildFlyableVolume();
});

// ===== 空中探针:在空中点一个无人机,直接看它在地面投出的单源风险分布 =====
let probeMode = false;
let probePos = null;            // {x, z} 地面投影位置
let probeAlt = 60;
let probeHeadingDeg = 0;
const probeRaycaster = new THREE.Raycaster();
const probeGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0
const probeFacadeGroup = new THREE.Group();
scene.add(probeFacadeGroup);
let probeFacade = null;   // 立面缓存:[{mesh, world:Float32Array, count}](几何只克隆一次,拖动只改颜色)

function clearProbeFacade() {
  for (const c of probeFacadeGroup.children) { c.geometry?.dispose(); c.material?.dispose(); }
  probeFacadeGroup.clear();
  probeFacade = null;
}

// 懒构建当前街区核心建筑的立面采样网格(克隆几何 + 预存世界坐标),供探针逐点着色复用
function ensureProbeFacade() {
  if (probeFacade && probeFacade.length) return;  // 已建好则复用;空(建筑还没就绪)则重试
  clearProbeFacade();
  probeFacade = [];
  for (const b of buildings) {
    if (b.isHalo || !b.box || !buildingTouchesCore(b)) continue;
    const geom = b.box.geometry.clone();
    geom.computeVertexNormals();
    const pos = geom.getAttribute('position');
    const normal = geom.getAttribute('normal');
    const count = pos.count;
    const world = new Float32Array(count * 3);
    const bx = b.group.position.x, by = b.group.position.y, bz = b.group.position.z;
    for (let i = 0; i < count; i++) {
      const lx = pos.getX(i) + normal.getX(i) * 0.6;
      const ly = pos.getY(i) + normal.getY(i) * 0.6;
      const lz = pos.getZ(i) + normal.getZ(i) * 0.6;
      pos.setXYZ(i, lx, ly, lz);
      world[i * 3] = lx + bx; world[i * 3 + 1] = ly + by; world[i * 3 + 2] = lz + bz;
    }
    pos.needsUpdate = true;
    geom.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, // 消与墙面 z-fighting
    }));
    mesh.position.set(bx, by, bz);
    mesh.renderOrder = 6;
    probeFacadeGroup.add(mesh);
    probeFacade.push({ mesh, world, count });
  }
}

function clearProbe() {
  probeGroup.traverse(o => {
    o.geometry?.dispose();
    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
    else o.material?.dispose();
  });
  probeGroup.clear();
}

// 四旋翼无人机图标:机身(锥台机身 + 顶盖罩 + 机头指向) + 4 根 X 臂 + 电机 + 半透明旋翼盘 + 起落架
function makeDroneIcon(headingRad) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color: '#30343a' });
  const darkMat = new THREE.MeshBasicMaterial({ color: '#202327' });
  const trimMat = new THREE.MeshBasicMaterial({ color: '#1677ff' });
  const bladeMat = new THREE.MeshBasicMaterial({ color: '#aab3bd', transparent: true, opacity: 0.5, side: THREE.DoubleSide });

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 2.2, 14), bodyMat);
  g.add(hub);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), trimMat);
  dome.position.y = 1.0; g.add(dome);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.6, 10), trimMat); // 机头(指向航向)
  nose.rotation.z = -Math.PI / 2; nose.position.set(4.4, -0.2, 0); g.add(nose);

  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const ex = sx * 6.2, ez = sz * 6.2;
    const len = Math.hypot(ex, ez);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.7, 0.7), darkMat);
    arm.position.set(ex / 2, 0, ez / 2);
    arm.rotation.y = -Math.atan2(ez, ex);
    g.add(arm);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 12), bodyMat);
    motor.position.set(ex, 0.7, ez); g.add(motor);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.7, 28), bladeMat);
    disc.rotation.x = -Math.PI / 2; disc.position.set(ex, 1.55, ez); g.add(disc);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 6), darkMat);
    leg.position.set(ex * 0.5, -2.0, ez * 0.5); g.add(leg);
  }
  for (const sz of [1, -1]) {            // 起落架横杆
    const skid = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.5, 0.5), darkMat);
    skid.position.set(0, -3.4, sz * 3.4); g.add(skid);
  }
  g.rotation.y = -headingRad;            // 机头对齐航向
  return g;
}

function rebuildProbe() {
  clearProbe();
  probeGroup.visible = probeMode;
  probeFacadeGroup.visible = false;
  if (!probeMode || !probePos) return;
  const ch = externalityChannel;
  const x = probePos.x, z = probePos.z, alt = probeAlt;
  const hr = probeHeadingDeg * Math.PI / 180;
  const hx = Math.cos(hr), hz = Math.sin(hr);
  // 单源 = 一小段沿航向的航段,amp=1(单位流量)
  const seg = {
    a: new THREE.Vector3(x - hx * 10, alt, z - hz * 10),
    b: new THREE.Vector3(x + hx * 10, alt, z + hz * 10),
    amp: 1, dirX: hx, dirZ: hz, alt,
  };
  const segs = [seg];

  // 局部地面网格(以探针为中心),逐点用同一通道核求值
  const W = 260, G = 70;
  const positions = [], values = [];
  for (let j = 0; j <= G; j++) {
    for (let i = 0; i <= G; i++) {
      const cx = x - W + (2 * W) * i / G;
      const cz = z - W + (2 * W) * j / G;
      const cy = terrainVisualHeight(cx, cz) + 0.5;
      positions.push(cx, cy, cz);
      values.push(noiseAt(cx, cy, cz, segs, ch));
    }
  }
  // 立面采样(复用缓存的世界坐标),和地面共用同一峰值刻度
  ensureProbeFacade();
  for (const f of probeFacade) {
    f.vals = new Float32Array(f.count);
    for (let i = 0; i < f.count; i++) {
      f.vals[i] = noiseAt(f.world[i * 3], f.world[i * 3 + 1], f.world[i * 3 + 2], segs, ch);
    }
  }
  // 99 分位做色标:既不被源正下方的单点尖峰拉爆(max 太钝),又比 95 分位少饱和(团内仍有梯度)
  let peak = 1e-12;
  const allVals = values.slice();
  for (const v of values) if (v > peak) peak = v;
  for (const f of probeFacade) for (let i = 0; i < f.count; i++) { const v = f.vals[i]; if (v > peak) peak = v; allVals.push(v); }
  allVals.sort((a, b) => a - b);
  const norm = Math.max(1e-9, allVals[Math.floor(allVals.length * 0.99)] || peak);
  const colors = [];
  for (const v of values) {
    const t = Math.min(1, Math.log1p(v / norm * 3.2) / Math.log1p(3.2));
    const c = colorRamp(t, 'coolwarm');
    colors.push(c[0], c[1], c[2]);
  }
  const indices = [];
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const p = j * (G + 1) + i;
      indices.push(p, p + 1, p + G + 2, p, p + G + 2, p + G + 1);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false,
  }));
  mesh.renderOrder = 6;
  probeGroup.add(mesh);

  // 立面着色(和地面同一刻度 norm,带轻微底色 floor 便于看清墙面)
  for (const f of probeFacade) {
    const col = f.mesh.geometry.getAttribute('color');
    for (let i = 0; i < f.count; i++) {
      const t = Math.log1p(f.vals[i] / norm * 3.2) / Math.log1p(3.2);
      const c = colorRamp(0.06 + 0.94 * Math.min(1, t), 'coolwarm');
      col.setXYZ(i, c[0], c[1], c[2]);
    }
    col.needsUpdate = true;
  }
  probeFacadeGroup.visible = true;

  // 无人机图标 + 落地竖线 + 航向箭头 + 弹道前甩落点
  const drone = makeDroneIcon(hr);
  drone.position.set(x, alt, z);
  probeGroup.add(drone);
  probeGroup.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, alt, z), new THREE.Vector3(x, terrainVisualHeight(x, z), z)]),
    new THREE.LineBasicMaterial({ color: '#d94841', transparent: true, opacity: 0.5 })));
  probeGroup.add(new THREE.ArrowHelper(new THREE.Vector3(hx, 0, hz), new THREE.Vector3(x, alt, z), 34, '#1677ff', 10, 6));
  const fwd = 14 + alt * 0.34;   // 仅用于读数显示(前甩落点距离)

  const ro = $('probeReadout');
  if (ro) {
    const sl = (30 + alt * 0.45).toFixed(0), scc = (20 + alt * 0.25).toFixed(0);
    const extra = ch === 'risk'
      ? `前甩落点 <b>${fwd.toFixed(0)} m</b> · 落区 σ∥×σ⊥ <b>${sl}×${scc} m</b><br>`
      : '';
    ro.innerHTML = `通道 <b>${(CHANNELS[ch] || CHANNELS.noise).label}</b> · 高度 <b>${alt} m</b><br>${extra}峰值(相对) <b>${peak.toExponential(2)}</b> · 拖高度看变化`;
  }
}

(function setupProbeUI() {
  const panel = document.createElement('div');
  panel.id = 'probePanel';
  panel.className = 'panel';
  panel.style.cssText = 'right:18px;bottom:18px;width:300px;padding:14px;z-index:6';
  panel.innerHTML =
    '<div class="row" style="margin-bottom:10px"><span class="lbl" style="margin:0">空中探针</span>' +
    '<button id="probeToggle" style="min-height:28px;padding:4px 14px">关</button></div>' +
    '<div class="row"><span class="k">高度</span><span class="v"><span id="probeAltV">60</span> m</span></div>' +
    '<input type="range" id="probeAlt" min="10" max="120" value="60" style="margin-bottom:8px">' +
    '<div class="row"><span class="k">航向</span><span class="v"><span id="probeHeadV">0</span>°</span></div>' +
    '<input type="range" id="probeHead" min="0" max="359" value="0">' +
    '<div id="probeReadout" class="sub" style="margin-top:10px">开启后点击地面放置无人机</div>';
  document.body.appendChild(panel);
  $('probeToggle').addEventListener('click', () => {
    probeMode = !probeMode;
    $('probeToggle').textContent = probeMode ? '开' : '关';
    $('probeToggle').classList.toggle('active', probeMode);
    if (probeMode) {
      setNoiseLayerVisible(false);     // 探针时只是隐藏全局负担层(不销毁),避免叠色
      rebuildProbe();
    } else {
      clearProbe();
      probeFacadeGroup.visible = false;
      setNoiseLayerVisible(true);      // 关探针 → 全局负担层秒回(无需重算)
    }
  });
  $('probeAlt').addEventListener('input', e => { probeAlt = +e.target.value; $('probeAltV').textContent = probeAlt; rebuildProbe(); });
  $('probeHead').addEventListener('input', e => { probeHeadingDeg = +e.target.value; $('probeHeadV').textContent = probeHeadingDeg; rebuildProbe(); });
})();

let probePointerDown = null;
renderer.domElement.addEventListener('pointerdown', e => { probePointerDown = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  const dn = probePointerDown; probePointerDown = null;
  if (!probeMode || !dn) return;
  if (Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > 6) return; // 拖拽=转视角,忽略
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1);
  probeRaycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (probeRaycaster.ray.intersectPlane(probeGroundPlane, hit)) {
    probePos = { x: hit.x, z: hit.z };
    rebuildProbe();
  }
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
syncCameraControls();
syncAppearanceControls();
updateSunDirection();
updateBuildingAppearance();
applyShadowMode();
applyCameraAngles();
currentPreset = BLOCKS[0].name;
loadPreset(currentPreset);
onResize();
animate(0);
