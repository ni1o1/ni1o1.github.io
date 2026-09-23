/* global THREE, CITY_BLOCKS */
'use strict';

const CORE_DOMAIN = 500;
const HALO_M = 150;
const DOMAIN = CORE_DOMAIN + HALO_M * 2;
const CELL = 10;
const N = Math.round(DOMAIN / CELL);
const VIEW_DOMAIN = 950;
const HEIGHT_GUIDE_DOMAIN = DOMAIN;
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
const FLYABLE_RANGE_HALF = HALF;       // 可飞体 = 800 m 外框，含 150 m 缓冲圈
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
const routeOpacityBySource = { probe: 1.2, capacity: 0.2, gallery: 0.2 };
let routeOpacityScale = routeOpacityBySource.probe;
let routesVisible = true;
let noiseEnabled = false;
let demEnabled = false;
let buildingsVisible = true;
let shadowsEnabled = true;
let shadowBlurPct = 215;
let heightScaleVisible = true;
let haloBuildingsVisible = true;
let heightGuidesVisible = false;
let flyableVolumeVisible = true;
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
let routeSourcePreference = 'probe';
let routeSource = 'probe'; // 统一：800 m 外缘对穿 + 侧向/纵向净空 + 机间距
const PRECOMPUTED_FILES = { 'rep-oh-hongkong': 'data/precomputed/hk15-uavcap.json?v=geom1' };
const FLIGHT_FILES = { 'rep-oh-hongkong': 'data/precomputed/hk15-flights.json?v=geom1' };
const NOISE_V2_FILES = {
  'hk-54-29-noisev2': 'data/precomputed/hk54-noise-v2.json',
  'rep-oh-hongkong': 'data/precomputed/hk15-noise-v2.json?v=nv2-5',
};

// ---- 净空规则对照（原 policy-gallery 独立页面并入主沙盘）----
// 四个代表街区已经在主沙盘的 BLOCKS 里，建筑几何与 policy-gallery-blocks.json 相同，无需另一套装载链。
// 矩阵的六列 = 已在 SZU 上算过排班/容量的六组参数；参数三元组直接取自每格 JSON 的
// d_obs / building_metric / pedestrian_clearance_m，不在前端另立一份，避免与管线漂移。
// 文档里“法规→参数”的对照（香港/日本/英国等条款）只保留在 DOC/记录/53，界面一律不出现辖区名。
const GALLERY_FILE = 'data/precomputed/policy-gallery.json';
const GALLERY_RING_M = 8; // 人行环宽：管线常量（scripts/policy_sweep_run.py 的 pedestrian_ring_m），JSON 未导出
const GALLERY_PLACES = [
  { tag: 'LA815', sandboxId: 'rep-ch-losangeles', label: '洛杉矶' },
  { tag: 'TK161', sandboxId: 'rep-cm-tokyo', label: '东京' },
  { tag: 'HK15', sandboxId: 'rep-oh-hongkong', label: '香港' },
  { tag: 'SH127', sandboxId: 'rep-om-shanghai', label: '上海' },
];
const GALLERY_PACKAGES = ['eng_d5', 'hk_A1', 'hk_A2_cruise', 'jp_30', 'people_30', 'uk_a3_bldg50'];
const GALLERY_BLOCK_IDS = new Set(GALLERY_PLACES.map(p => p.sandboxId));
const GALLERY_KIND_LABEL = { ok: '可以对穿', corners_only: '仅转弯', empty_path: '缝在，路不通', blocked: '对边封死', loading: '—' };
const GALLERY_METRIC_LABEL = { euclidean_3d: '三维', horizontal: '水平' };
let galleryCells = null;       // Map<cellId, cell>；null = 未加载
let galleryLoading = null;     // 并发去重
let policyLatM = 5;
let policyVertM = 5;
let policyUavSepM = 20;
let policyComputeTimer = 0;
let galleryComputeTimer = 0;
const gallerySliceCache = new Map();
let galleryParams = { d: 5, metric: 'euclidean_3d', pedestrianM: 0 };
let galleryKeepVisible = false;
let flyableVolumeSpec = null;
let volumeWorker = null;
let volumeVersion = 0;
// Viridis 连续高度色带：低空→高空，感知上单调且对色觉差异更友好。
const ALTITUDE_CMAP = [
  [0.00, [68, 1, 84]],
  [0.25, [59, 82, 139]],
  [0.50, [33, 145, 140]],
  [0.75, [94, 201, 98]],
  [1.00, [253, 231, 37]],
];

function policyRuleText() {
  return `侧向 ${policyLatM} m · 纵向 ${policyVertM} m · 机间距 ${policyUavSepM} m`;
}

function policyVolumeSpec() {
  return {
    buildings: obstacleBuildings,
    yMax: ALT_MAX,
    releaseM: () => policyVertM,
    radiusM: () => Math.max(policyLatM, 0.5),
  };
}

function applyPolicyVolume() {
  flyableVolumeSpec = obstacleBuildings.length ? policyVolumeSpec() : null;
  scheduleVolumeRebuild();
}

function syncPolicyControls() {
  const lat = $('policyLat'), latV = $('policyLatV');
  const vert = $('policyVert'), vertV = $('policyVertV');
  const sep = $('policySep'), sepV = $('policySepV');
  if (lat) lat.value = String(policyLatM);
  if (latV) latV.textContent = String(policyLatM);
  if (vert) vert.value = String(policyVertM);
  if (vertV) vertV.textContent = String(policyVertM);
  if (sep) sep.value = String(policyUavSepM);
  if (sepV) sepV.textContent = String(policyUavSepM);
  const density = $('density');
  if (density) {
    density.value = entriesPerEdge;
    $('densityV').textContent = entriesPerEdge;
  }
  const chips = $('policyPresets');
  if (chips) {
    for (const b of chips.querySelectorAll('button[data-lat]')) {
      b.classList.toggle('on', +b.dataset.lat === policyLatM && +b.dataset.vert === policyVertM);
    }
  }
}

function setPolicyParams(patch, live = false) {
  const volumeChanged = patch.lat != null || patch.vert != null;
  if (patch.lat != null) policyLatM = +patch.lat;
  if (patch.vert != null) policyVertM = +patch.vert;
  if (patch.uavSep != null) policyUavSepM = +patch.uavSep;
  syncPolicyControls();
  syncRouteSourceUI();
  syncSceneLegend();
  clearTimeout(policyComputeTimer);
  if (live) {
    policyComputeTimer = setTimeout(() => {
      if (volumeChanged) applyPolicyVolume();
      scheduleCompute();
    }, 220);
    return;
  }
  if (volumeChanged) applyPolicyVolume();
  scheduleCompute();
}

function altitudeColorRgb(alt) {
  const t = Math.max(0, Math.min(1, (alt - ALT_MIN) / (ALT_MAX - ALT_MIN)));
  for (let i = 1; i < ALTITUDE_CMAP.length; i++) {
    if (t <= ALTITUDE_CMAP[i][0]) {
      const [t0, c0] = ALTITUDE_CMAP[i - 1];
      const [t1, c1] = ALTITUDE_CMAP[i];
      const u = (t - t0) / (t1 - t0 || 1);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * u));
    }
  }
  return ALTITUDE_CMAP[ALTITUDE_CMAP.length - 1][1].slice();
}

function altitudeColorHex(alt) {
  const [r, g, b] = altitudeColorRgb(alt);
  return (r << 16) | (g << 8) | b;
}

function altitudeColorCss(alt) {
  return '#' + altitudeColorHex(alt).toString(16).padStart(6, '0');
}
const MAX_DRONES = 700;
const CRUISE_MPS = 22;
const LIVE_HORIZON_S = 3600;
const NOISE_V2_TIERS = { iso: '各向同性', dir: '指向性', refl: '反射与绕射' };
const SURFACE_NAMES = ['ground', 'facade', 'roof', 'soffit'];
const OPPOSITE_OD = new Set(['E>W', 'W>E', 'N>S', 'S>N']);
const precomputedCache = {};
const flightCache = {};
let precomputed = null;
let capacityField = null;
let flightData = null;
let flightRoutes = null;
let droneMesh = null;
let droneAccentMesh = null;
let droneDummy = null;
let droneHide = null;
let droneColor = null;
let playbackPlaying = true;
let playbackRate = 5;
let playbackT = 0;
let liveCraft = [];
let lastAnimMs = null;
// PROTOTYPE (?variant=instant|wake|corridor, ?impact=live|total): live heat on ground+facades, or regional total.
let impactTimeMode = 'total';
let timelineHeatMesh = null;
let timelineHeatColors = null;
let timelineHeatPos = null;
let timelineWake = [];
let timelineLastSimT = null;
let timelineLastPaintT = -1;
let timelinePinned = false;
let liveFacadeGroup = null;
let liveFacades = null;
let aircraftVisible = true;
const PLAY_ODS = ['E>W', 'W>E', 'N>S', 'S>N'];
const OD_PRESETS = [
  { role: 'all', label: '全部', ods: null },
  { role: 'ew', label: '东西向', ods: ['E>W', 'W>E'] },
  { role: 'ns', label: '南北向', ods: ['N>S', 'S>N'] },
];
const TRAIL_STEPS = 10;
const TRAIL_U = 0.16;
let playOdSet = null;
let playAltSet = null;
let dronePickMap = [];
let flightBlockId = null;
let noiseV2Tier = 'refl';
let noiseV2 = null;
const noiseV2Cache = {};
let noiseV2Mesh = null;
let noiseSurrogate = null;
let presetLoadToken = 0;

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
BLOCKS.unshift({
  id: 'hk-54-29-noisev2',
  name: 'Hong Kong · 54_29 (noise v2)',
  center: [22.315793753923057, 114.18762047046113],
  size: 500,
  haloM: 150,
  noiseV2: true,
  source: 'SZU noise v2 GPU, realscene 54_29_auto, d_obs=5 m, facet L_Aeq.',
  terrain: { slopeX: 0, slopeZ: 0, ridge: 0, roughness: 0 },
  buildings: [],
});

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
  if (currentBlock?.noiseV2 && noiseV2?.height) {
    const sampled = sampleNoiseV2Grid(noiseV2.height.terrain, x, z);
    if (sampled !== null) return sampled;
  }
  const dataNorth = -z;
  const dem = currentBlock?.dem;
  if (demEnabled && dem?.values?.length && dem.grid > 1 && dem.extent > 0) {
    const half = dem.extent / 2;
    const u = (x + half) / dem.extent * (dem.grid - 1);
    const v = (dataNorth + half) / dem.extent * (dem.grid - 1);
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
  const hill = ridge * Math.exp(-((x + 110) ** 2 + (dataNorth - 70) ** 2) / (2 * 150 ** 2));
  return sx * x + sz * dataNorth + hill
    + rough * Math.sin((x + dataNorth) * 0.025) * Math.cos(dataNorth * 0.016);
}

function terrainVisualHeight(x, z) {
  const h = terrainHeight(x, z);
  if (currentBlock?.noiseV2 && noiseV2?.height) return h;
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
const bufferGroup = new THREE.Group();
const flyableVolumeGroup = new THREE.Group();
const galleryKeepGroup = new THREE.Group();
const probeGroup = new THREE.Group();
const noiseV2Group = new THREE.Group();
const droneGroup = new THREE.Group();
const focusRibbonGroup = new THREE.Group();
const trailGroup = new THREE.Group();
droneGroup.add(trailGroup);
scene.add(buildingGroup, routeGroup, anchorGroup, noiseGroup, noiseV2Group, heightScaleGroup, heightGuideGroup, bufferGroup, flyableVolumeGroup, galleryKeepGroup, probeGroup, droneGroup, focusRibbonGroup);

const buildingMat = new THREE.MeshStandardMaterial({ color: buildingColor, roughness: 0.72, metalness: 0.0, vertexColors: true, side: THREE.DoubleSide });
const edgeMat = new THREE.LineBasicMaterial({ color: '#67717d', transparent: true, opacity: 0.92, depthWrite: false });
const haloBuildingMat = new THREE.MeshStandardMaterial({
  color: '#d7dde3',
  roughness: 0.82,
  metalness: 0,
  vertexColors: true,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.42,
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
  color: '#17191c',
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
});
const bufferFrameMat = new THREE.MeshBasicMaterial({
  color: '#1677ff',
  transparent: true,
  opacity: 0.78,
  depthWrite: false,
});
const bufferFillMat = new THREE.MeshBasicMaterial({
  color: '#1677ff',
  transparent: true,
  opacity: 0.07,
  depthWrite: false,
  side: THREE.DoubleSide,
});
// 净空禁区层：所有切片共用一份材质，清理时只 dispose 几何，别 dispose 材质
const galleryKeepMat = new THREE.MeshBasicMaterial({
  color: '#d94841',
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
  side: THREE.DoubleSide,
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
const noiseV2Mat = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  transparent: false,
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
  if (noiseV2Mesh) {
    noiseV2Mesh.castShadow = shadowsEnabled;
    noiseV2Mesh.receiveShadow = shadowsEnabled;
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
  // JSON polygons are stored as [east, north] metres. In a Three.js top view,
  // screen-up corresponds to world -Z, so map north to -Z to keep the 2D
  // frontend orientation identical to the source JSON/map convention.
  const absPoly = raw.polygon.map(p => [p[0], -p[1]]);
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

function addGuidePolyline(points, radius, material, dashed = false, group = heightGuideGroup) {
  const dashSize = 18;
  const gapSize = 8;
  if (!dashed) {
    for (const p of points) addGuideJoint(p, radius, material, group);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!dashed) {
      addGuideTube(a, b, radius, material, group);
      continue;
    }
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len <= 1e-6) continue;
    dir.normalize();
    for (let t = 0; t < len; t += dashSize + gapSize) {
      const s = a.clone().addScaledVector(dir, t);
      const e = a.clone().addScaledVector(dir, Math.min(len, t + dashSize));
      addGuideTube(s, e, radius, material, group);
      addGuideJoint(s, radius, material, group);
      addGuideJoint(e, radius, material, group);
    }
  }
}

function squareLoop(half, y) {
  return [
    new THREE.Vector3(-half, y, -half),
    new THREE.Vector3(half, y, -half),
    new THREE.Vector3(half, y, half),
    new THREE.Vector3(-half, y, half),
    new THREE.Vector3(-half, y, -half),
  ];
}

function makeBufferRingGeometry(outerHalf, innerHalf, y) {
  const shape = new THREE.Shape();
  shape.moveTo(-outerHalf, -outerHalf);
  shape.lineTo(outerHalf, -outerHalf);
  shape.lineTo(outerHalf, outerHalf);
  shape.lineTo(-outerHalf, outerHalf);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-innerHalf, innerHalf);
  hole.lineTo(innerHalf, innerHalf);
  hole.lineTo(innerHalf, -innerHalf);
  hole.lineTo(-innerHalf, -innerHalf);
  hole.closePath();
  shape.holes.push(hole);
  const geom = new THREE.ShapeGeometry(shape);
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i), y, pos.getY(i));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function buildBufferRings() {
  while (bufferGroup.children.length) {
    const child = bufferGroup.children[0];
    child.geometry?.dispose();
    bufferGroup.remove(child);
  }
  const y = Math.max(0.28, terrainVisualHeight(0, 0) + 0.28);
  const fill = new THREE.Mesh(makeBufferRingGeometry(HALF, CORE_HALF, y), bufferFillMat);
  fill.renderOrder = 1;
  bufferGroup.add(fill);
  addGuidePolyline(squareLoop(CORE_HALF, y), 0.85, groundBoundaryMat, false, bufferGroup);
  addGuidePolyline(squareLoop(HALF, y), 0.70, bufferFrameMat, false, bufferGroup);
}

function buildHeightGuides() {
  heightGuideGroup.clear();
  const y60 = 60;
  const y120 = 120;
  addGuidePolyline(squareLoop(HALF, y60), 0.55, heightGuideMat, true);
  addGuidePolyline(squareLoop(HALF, y120), 0.55, heightGuideMat, true);
  addGuidePolyline(squareLoop(CORE_HALF, y60), 0.45, groundBoundaryMat, true);
  heightGuideGroup.visible = heightGuidesVisible;
}

async function loadPreset(name) {
  if (typeof exitListen === 'function') exitListen();
  const token = ++presetLoadToken;
  computeVersion++; externalityVersion++; volumeVersion++;
  stopRouteWorker(); stopVolumeWorker(); needsCompute = false; computing = false;
  routeSummaries = []; totalRoutes = 0;
  buildMapTiles(); $('altLegend').textContent = '正在准备当前街区…';
  currentPreset = name;
  currentBlock = BLOCKS.find(b => b.name === name) || BLOCKS[0];
  noiseV2 = null; precomputed = null; capacityField = null;
  noiseSurrogate = null;
  flightData = null; flightRoutes = null;
  playOdSet = null; playAltSet = null;
  $('sandboxSub').textContent = `${currentBlock.name} · 加载中`;
  $('routeSourceNote').textContent = '正在准备当前街区数据…';
  syncPlaybackUI(); syncSceneLegend();
  clearNoiseLayer();
  clearFlyableVolume();
  gallerySliceCache.clear();
  flyableVolumeSpec = null;
  disposeNoiseV2Mesh();
  buildingGroup.clear();
  buildings = [];
  obstacleBuildings = [];
  nextId = 1;
  if (NOISE_V2_FILES[currentBlock.id]) {
    const busy = $('busy');
    if (busy && currentBlock.noiseV2) {
      busy.classList.add('on');
      busy.textContent = '加载噪声 v2 面片...';
    }
    try {
      const loadedNoise = await ensureNoiseV2(currentBlock.id);
      if (token !== presetLoadToken) return;
      noiseV2 = loadedNoise;
    } catch (err) {
      console.warn(err);
      noiseV2 = null;
    }
    if (token !== presetLoadToken) return;
  } else {
    noiseV2 = null;
  }
  routeSource = 'probe';
  routeSourcePreference = 'probe';
  syncChannelUI();
  buildTerrain();
  buildBufferRings();
  buildHeightGuides();
  const rawBuildings = currentBlock.buildings || [];
  obstacleBuildings = rawBuildings.map(raw => makeBuilding(raw, false));
  rawBuildings.forEach(raw => buildings.push(makeBuilding(raw, true)));
  try {
    await loadNoiseSurrogate(currentBlock.id);
  } catch (err) {
    console.warn(err);
    noiseSurrogate = null;
  }
  if (token !== presetLoadToken) return;
  if (noiseV2) ensureNoiseV2Mesh();
  if (typeof clearProbeFacade === 'function') clearProbeFacade();  // 换街区→立面缓存失效
  if (typeof disposeLiveFacades === 'function') disposeLiveFacades();
  applyAuxiliaryBuildingVisibility();
  applyPolicyVolume();
  if ($('presets').value !== currentBlock.name) $('presets').value = currentBlock.name;
  syncRouteSourceUI();
  syncSceneLegend();
  scheduleCompute();
}

function inflateHeightFieldByPolicy() {
  const latM = policyLatM;
  const vertM = policyVertM;
  if (!(latM > 0 || vertM > 0)) return;
  const src = heightField.slice();
  const nPad = Math.max(0, Math.ceil(latM / CELL));
  const lat2 = latM * latM;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = idx(i, j);
      const ground = terrainHeight(gx(i), iToZ(j)) + 1;
      const h = src[k];
      if (h <= ground + 1.5) continue;
      const blockedUntil = h + vertM;
      if (blockedUntil > heightField[k]) heightField[k] = blockedUntil;
      if (nPad <= 0) continue;
      const i0 = Math.max(0, i - nPad);
      const i1 = Math.min(N - 1, i + nPad);
      const j0 = Math.max(0, j - nPad);
      const j1 = Math.min(N - 1, j + nPad);
      for (let jj = j0; jj <= j1; jj++) {
        for (let ii = i0; ii <= i1; ii++) {
          if (ii === i && jj === j) continue;
          const dx = (ii - i) * CELL;
          const dz = (jj - j) * CELL;
          if (dx * dx + dz * dz > lat2) continue;
          const kk = idx(ii, jj);
          if (blockedUntil > heightField[kk]) heightField[kk] = blockedUntil;
        }
      }
    }
  }
}

async function rasterize(version) {
  if (currentBlock?.noiseV2 && noiseV2?.height?.obstacle) {
    heightField.set(noiseV2.height.obstacle);
    inflateHeightFieldByPolicy();
    return version === computeVersion;
  }
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
    const i0 = Math.max(0, Math.floor((minX - policyLatM + HALF) / CELL));
    const i1 = Math.min(N - 1, Math.floor((maxX + policyLatM + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((minZ - policyLatM + HALF) / CELL));
    const j1 = Math.min(N - 1, Math.floor((maxZ + policyLatM + HALF) / CELL));
    const blockedUntil = terrainHeight(b.x, b.z) + b.h + policyVertM;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = gx(i), z = iToZ(j);
        if (pointInPoly(x, z, worldPoly) || (policyLatM > 0 && nearPoly(x, z, worldPoly, policyLatM))) {
          const k = idx(i, j);
          if (blockedUntil > heightField[k]) heightField[k] = blockedUntil;
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
    flyable[k] = heightField[k] <= alt ? 1 : 0;
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

function boundaryAnchors() {
  const anchors = [];
  const pick = (edge) => {
    const { unique, runs } = collectEdgeGates(edge);
    if (!unique.length) return;
    const order = nestedGateOrder(unique, runs);
    const want = Math.min(entriesPerEdge, order.length);
    for (let i = 0; i < want; i++) anchors.push(order[i].k);
  };
  pick('top');
  pick('bottom');
  pick('left');
  pick('right');
  return anchors;
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
  const depth = Math.max(1, Math.round(BOUNDARY_SNAP_M / CELL));
  if (j <= depth) return 'top';
  if (j >= N - 1 - depth) return 'bottom';
  if (i <= depth) return 'left';
  if (i >= N - 1 - depth) return 'right';
  return 'inner';
}

function allowedPair(a, b) {
  const ea = edgeOf(a), eb = edgeOf(b);
  // OPPOSITE edges only = pure pass-through transit (top<->bottom, left<->right).
  // Adjacent-edge (corner) pairs are short corner-clips that bundle at the corners
  // and produce edge/caustic artifacts; excluded so the transit field stays clean.
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

// Store unscaled opacity so sliders never compound values or rebuild geometry.
function bindRouteOpacity(object, baseOpacity, maxOpacity, smooth = false) {
  if (!object) return;
  object.material.userData.routeOpacity = { baseOpacity, maxOpacity, smooth };
  object.material.opacity = scaledRouteOpacity(object.material.userData.routeOpacity);
}

function scaledRouteOpacity({ baseOpacity, maxOpacity, smooth }) {
  // Focused routes start brighter; optical-density scaling stays responsive up to 400%.
  return smooth ? 1 - Math.pow(1 - baseOpacity, routeOpacityScale)
    : Math.min(maxOpacity, baseOpacity * routeOpacityScale);
}

function updateRouteOpacity() {
  for (const group of [routeGroup, anchorGroup, focusRibbonGroup, trailGroup]) {
    for (const object of group.children) {
      const settings = object.material?.userData.routeOpacity;
      if (settings) object.material.opacity = scaledRouteOpacity(settings);
    }
  }
}

function makeRouteBandMesh(paths, alt, opacity, flyable) {
  const positions = [];
  const indices = [];
  const halfWidth = 2.4;
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
    color: altitudeColorHex(alt),
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 10;
  return mesh;
}

function makeWorldRibbonMesh(polylines, opacity, color) {
  const positions = [];
  const indices = [];
  const halfWidth = 1.35;
  for (const poly of polylines) {
    for (let p = 0; p < poly.length - 1; p++) {
      const ax = poly[p][0], ay = poly[p][1], az = poly[p][2];
      const bx = poly[p + 1][0], by = poly[p + 1][1], bz = poly[p + 1][2];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.2) continue;
      const ox = -dz / len * halfWidth;
      const oz = dx / len * halfWidth;
      const base = positions.length / 3;
      positions.push(ax + ox, ay, az + oz, ax - ox, ay, az - oz, bx + ox, by, bz + oz, bx - ox, by, bz - oz);
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  if (!positions.length) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  const mat = new THREE.MeshBasicMaterial({
    color: color || ROUTE_COLOR,
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

  // 可飞体的外裁剪方形 = 800 m 缓冲圈外框（含 halo），不再只裁到 core(500 m)。
function squareClipPath(S) {
  const R = FLYABLE_RANGE_HALF;
  return [[
    { X: -R * S, Y: -R * S }, { X: R * S, Y: -R * S },
    { X: R * S, Y: R * S }, { X: -R * S, Y: R * S },
  ]];
}

// 给定一组建筑 → 它们 footprint 外扩给定半径的并集(Clipper 整数 Paths)。
// radii 可选：与 buildings 等长、每栋各自的外扩距离(米)；省略 = 全部 FLYABLE_VISUAL_BUFFER_M
//（此时只有一个半径桶，输出与旧实现逐字节相同）。joinType 可选，默认 jtMiter。
function bufferedObstaclePaths(buildings, S, radii, joinType) {
  const buckets = new Map();
  buildings.forEach((b, i) => {
    const r = radii ? radii[i] : FLYABLE_VISUAL_BUFFER_M;
    if (!(r >= 0.4)) return; // 外扩≈0 的楼不参与（三维量法在屋顶以上会收缩到 0）
    const key = Math.round(r);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(b);
  });
  const out = new ClipperLib.Paths();
  for (const [r, group] of buckets) {
    const paths = group
      .map(b => b.localPoly.map(p => ({ X: Math.round((p[0] + b.x) * S), Y: Math.round((p[1] + b.z) * S) })))
      .filter(path => path.length >= 3);
    if (!paths.length) continue;
    const co = new ClipperLib.ClipperOffset(2, 0.25 * S);
    co.AddPaths(paths, joinType || ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const part = new ClipperLib.Paths(); // Execute 会先 Clear(solution)，不能直接写进累积容器
    co.Execute(part, r * S);
    for (const p of part) out.push(p);
  }
  return out.length ? out : null;
}

// 整数路径 → 带孔实体环：自并一次拿到 PolyTree（各半径桶的结果可能重叠）。
function clipperPathsToSolids(paths) {
  if (!paths || !paths.length) return [];
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const solids = [];
  collectClipperSolids(tree, solids);
  return solids;
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
// opts 可选：buildings（默认 obstacleBuildings）/ releaseM(b)（该楼不再阻挡的高度增量，
// 默认 FLYABLE_VISUAL_CLEARANCE_M；返回 Infinity 表示全程阻挡）/ radiusM(b, yBand)（该带该楼的外扩半径，
// 默认 FLYABLE_VISUAL_BUFFER_M）。省略 opts 时行为与本函数旧实现逐字节相同。
function addBufferedVolume(yBase, yMax, positions, indices, outlinePositions, opts) {
  const obs = opts?.buildings || obstacleBuildings;
  if (typeof ClipperLib === 'undefined' || !obs.length) return false;
  const S = CLIP_SCALE;
  const STEP = FLYABLE_VISUAL_BAND_M;
  const releaseM = opts?.releaseM || (() => FLYABLE_VISUAL_CLEARANCE_M);
  const radiusM = opts?.radiusM || (() => FLYABLE_VISUAL_BUFFER_M);

  // 每栋楼:从 yBase 一直挡到 屋顶+释放间距(向上取整到 STEP,保证间距≥5m);clamp 到 [yBase,yMax]
  const obstacles = obs.map(b => {
    const top = Math.max(yBase, Math.min(yMax, Math.ceil((b.h + releaseM(b)) / STEP) * STEP));
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
    const buffered = blockers.length ? bufferedObstaclePaths(blockers, S, blockers.map(b => radiusM(b, yA))) : null;
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

function stopVolumeWorker() {
  if (volumeWorker) {
    volumeWorker.terminate();
    volumeWorker = null;
  }
}

function applyVolumeMesh(data) {
  clearFlyableVolume();
  flyableVolumeGroup.visible = flyableVolumeVisible;
  if (!flyableVolumeVisible) return;
  const positions = [];
  const indices = [];
  const outlinePositions = [];
  const yFloor = data.bands?.[0]?.yA ?? FLYABLE_VISUAL_BASE_M;
  const yTop = data.bands?.length ? data.bands[data.bands.length - 1].yB : ALT_MAX;
  for (const band of data.bands || []) {
    for (const s of band.solids || []) emitWalls([s.outer, ...s.holes], band.yA, band.yB, positions, indices);
  }
  for (const s of data.floor || []) {
    emitCap(s.outer, s.holes, yFloor, false, positions, indices);
    emitRingOutline([s.outer, ...s.holes], yFloor, outlinePositions);
  }
  for (const ledge of data.ledges || []) {
    for (const s of ledge.solids || []) {
      emitCap(s.outer, s.holes, ledge.y, true, positions, indices);
      emitRingOutline([s.outer, ...s.holes], ledge.y, outlinePositions);
    }
  }
  for (const s of data.ceiling || []) {
    emitCap(s.outer, s.holes, yTop, true, positions, indices);
    emitRingOutline([s.outer, ...s.holes], yTop, outlinePositions);
  }
  if (!positions.length || !indices.length) return;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  const mesh = new THREE.Mesh(geom, flyableVolumeMat.clone());
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

function scheduleVolumeRebuild() {
  const version = ++volumeVersion;
  stopVolumeWorker();
  flyableVolumeGroup.visible = flyableVolumeVisible;
  if (!flyableVolumeVisible || !obstacleBuildings.length) {
    clearFlyableVolume();
    return;
  }
  const spec = flyableVolumeSpec || policyVolumeSpec();
  const buildings = (spec.buildings || obstacleBuildings).map(b => ({
    x: b.x, z: b.z, h: b.h, localPoly: b.localPoly,
  }));
  volumeWorker = new Worker('volume-worker.js?v=ux-37');
  volumeWorker.onmessage = ev => {
    if (ev.data.version !== volumeVersion) return;
    if (ev.data.type === 'error') {
      console.warn('volume worker', ev.data.message);
      return;
    }
    applyVolumeMesh(ev.data);
  };
  volumeWorker.onerror = err => {
    console.warn(err);
    stopVolumeWorker();
  };
  volumeWorker.postMessage({
    type: 'compute',
    version,
    buildings,
    yBase: FLYABLE_VISUAL_BASE_M,
    yMax: Number.isFinite(spec.yMax) ? spec.yMax : ALT_MAX,
    bandM: FLYABLE_VISUAL_BAND_M,
    rangeHalf: FLYABLE_RANGE_HALF,
    clipScale: CLIP_SCALE,
    releaseM: spec.gallery ? undefined : (typeof spec.releaseM === 'function' ? spec.releaseM() : policyVertM),
    radiusM: spec.gallery ? undefined : (typeof spec.radiusM === 'function' ? spec.radiusM() : Math.max(policyLatM, 0.5)),
    gallery: spec.gallery || null,
  });
}

function rebuildFlyableVolume() {
  scheduleVolumeRebuild();
}

function drawAnchors(anchors, alt, baseOpacity) {
  const pts = [];
  anchors.forEach(k => pts.push(gx(k % N), alt + 2.5, iToZ((k / N) | 0)));
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.PointsMaterial({ color: altitudeColorHex(alt), transparent: true, opacity: 1, size: 4.8, sizeAttenuation: true, depthWrite: false });
  const points = new THREE.Points(geom, mat);
  bindRouteOpacity(points, baseOpacity, 0.85);
  points.userData.altitude = alt;
  anchorGroup.add(points);
}

function pathOd(cells) {
  if (!cells || cells.length < 2) return '';
  return `${edgeNameOfCell(cells[0])}>${edgeNameOfCell(cells[cells.length - 1])}`;
}

function pathInOdFilter(cells) {
  if (!playOdSet) return true;
  return playOdSet.has(pathOd(cells));
}

function visibleSummaryPaths(s) {
  return (s.paths || []).filter(pathInOdFilter);
}

async function drawAltitudeResult(result, version) {
  if (version !== computeVersion) return;
  result.flyable = new Uint8Array(result.flyable);
  const routeOpacity = 0.16 + 0.42 * result.weight;
  const anchorOpacity = 0.12 + 0.28 * result.weight;
  drawAnchors(result.anchors, result.alt, anchorOpacity);
  const routeMesh = makeRouteBandMesh(visibleSummaryPaths(result), result.alt, routeOpacity, result.flyable);
  if (routeMesh) { bindRouteOpacity(routeMesh, routeOpacity, 0.55); routeMesh.userData.altitude = result.alt; routeGroup.add(routeMesh); }
  await nextFrame();
  if (version !== computeVersion) return;
  totalRoutes += result.pathCount || result.paths.length;
  routeSummaries.push(result);
  applyRouteVisibility();
}

function rebuildRouteMeshes() {
  disposeRouteLayer();
  for (const s of routeSummaries) {
    const routeOpacity = 0.16 + 0.42 * s.weight;
    const anchorOpacity = 0.12 + 0.28 * s.weight;
    drawAnchors(s.anchors || [], s.alt, anchorOpacity);
    const routeMesh = makeRouteBandMesh(visibleSummaryPaths(s), s.alt, routeOpacity, s.flyable);
    if (routeMesh) {
      bindRouteOpacity(routeMesh, routeOpacity, 0.55);
      routeMesh.userData.altitude = s.alt;
      routeGroup.add(routeMesh);
    }
  }
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

function b64ToTyped(b64, Ctor) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Ctor(bytes.buffer);
}

function decodePrecomputed(raw) {
  const vs = raw.field.vs || 5;
  const ix = b64ToTyped(raw.field.ix, Int16Array);
  const iy = b64ToTyped(raw.field.iy, Int16Array);
  const iz = b64ToTyped(raw.field.iz, Int16Array);
  const v = {};
  for (const k of Object.keys(raw.field.v)) v[k] = b64ToTyped(raw.field.v[k], Float32Array);
  const pack = (a, b, c) => ((a + 512) << 20) + ((b + 512) << 10) + (c + 512);
  const map = new Map();
  for (let i = 0; i < raw.field.n; i++) {
    map.set(pack(ix[i], iy[i], iz[i]), {
      noise: v.noise[i],
      risk: v.risk[i],
      privacy: v.privacy[i],
      visual: v.visual[i],
    });
  }
  const ground = { n: raw.ground.n, extent: raw.ground.extent, v: {} };
  for (const k of Object.keys(raw.ground.v)) ground.v[k] = b64ToTyped(raw.ground.v[k], Float32Array);
  return { raw, vs, map, pack, ground };
}

function usingCapacity() {
  return routeSource === 'capacity' && capacityField && precomputed?.raw?.id === currentBlock?.id;
}

function usingPlayback() {
  return Boolean(flightData && flightRoutes && flightRoutes.length);
}

function edgeNameOfCell(k) {
  const i = k % N, j = (k / N) | 0;
  const depth = Math.max(1, Math.round(BOUNDARY_SNAP_M / CELL));
  if (j <= depth) return 'S';
  if (j >= N - 1 - depth) return 'N';
  if (i <= depth) return 'W';
  if (i >= N - 1 - depth) return 'E';
  return '?';
}

function pathSlotCount(lengthM) {
  return policyUavSepM > 0
    ? Math.max(1, Math.min(4, Math.floor(lengthM / Math.max(policyUavSepM, 80))))
    : (lengthM > 420 ? 3 : lengthM > 220 ? 2 : 1);
}

function liveThroughputPerHour(routes = flightRoutes) {
  let n = 0;
  for (const route of routes || []) {
    if (!routeInFilter(route)) continue;
    const dur = Math.max(1e-3, route.dur || (route.L || 1) / CRUISE_MPS);
    n += (route.nOnPath || 1) * (LIVE_HORIZON_S / dur);
  }
  return Math.round(n);
}

function fmtFlightsPerHour(n) {
  return Math.round(n).toLocaleString('zh-CN');
}

function syncAirThroughputHud(nAir) {
  const el = $('playHudAir');
  if (!el || !flightData) return;
  const air = nAir != null ? nAir : (flightData.n_flights || (flightData.flights || []).length);
  if (flightData.live) {
    el.textContent = `空中 ${air} 架 · 通行 ${fmtFlightsPerHour(liveThroughputPerHour())} 架次/时`;
    return;
  }
  const cap = precomputed?.raw?.source?.summary?.capacity_stable_hour;
  el.textContent = cap != null
    ? `空中 ${air} 架 · 通行 ${fmtFlightsPerHour(cap)} 架次/时`
    : `当前显示 ${air} 架`;
}

function buildLiveFlightsFromSummaries() {
  const routes = [];
  const flights = [];
  let throughput = 0;
  for (const s of routeSummaries) {
    const fly = s.flyable;
    for (const cells of (s.paths || [])) {
      if (!cells || cells.length < 2) continue;
      const xz = fly ? smoothRoutePath(cells, fly) : cells.map(cellCenterXZ);
      if (xz.length < 2) continue;
      const p = xz.map(([x, z]) => [x, -z, s.alt + 2.4]);
      const c = flightCumlen(p);
      const L = c[c.length - 1] || 1;
      const dur = Math.max(12, L / CRUISE_MPS);
      const nOnPath = pathSlotCount(L);
      const h = Math.round(s.alt);
      const od = `${edgeNameOfCell(cells[0])}>${edgeNameOfCell(cells[cells.length - 1])}`;
      routes.push({ p, c, L, h, col: altitudeColorHex(h), od, id: routes.length, live: true, dur, nOnPath });
      throughput += nOnPath * (LIVE_HORIZON_S / dur);
      for (let k = 0; k < nOnPath; k++) {
        flights.push([routes.length - 1, (k / nOnPath) * dur, dur]);
      }
    }
  }
  if (!routes.length) {
    flightData = null;
    flightRoutes = null;
    return;
  }
  flightRoutes = routes;
  flightData = {
    flights,
    t_eval_s: LIVE_HORIZON_S,
    n_flights: flights.length,
    live: true,
    throughput_per_hour: Math.round(throughput),
  };
}

function flightProgress(t0, t1) {
  if (flightData?.live) {
    const dur = Math.max(1e-3, t1);
    const u = playbackT / dur + t0 / dur;
    return ((u % 1) + 1) % 1;
  }
  const span = Math.max(1e-3, t1 - t0);
  if (playbackT < t0 || playbackT > t1) return null;
  return (playbackT - t0) / span;
}

function usingNoiseV2() {
  return Boolean(noiseV2 && currentBlock && NOISE_V2_FILES[currentBlock.id]);
}

function usingNoiseSurrogate() {
  return Boolean(
    noiseSurrogate && currentBlock
    && noiseSurrogate.blockId === currentBlock.id
    && externalityChannel === 'noise'
  );
}

function f16BufferToF32(buf) {
  if (typeof Float16Array === 'function') {
    const h = new Float16Array(buf);
    const out = new Float32Array(h.length);
    out.set(h);
    return out;
  }
  const u16 = new Uint16Array(buf);
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i];
    const s = (h & 0x8000) << 16;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    let bits;
    if (e === 0) bits = s | (f ? (f << 13) : 0);
    else if (e === 31) bits = s | 0x7f800000 | (f << 13);
    else bits = s | ((e + 112) << 23) | (f << 13);
    out[i] = new Float32Array(new Uint32Array([bits]).buffer)[0];
  }
  return out;
}

async function loadNoiseSurrogate(blockId) {
  noiseSurrogate = null;
  try {
    const res = await fetch(`data/noise-surrogate/${blockId}.meta.json`);
    if (!res.ok) return null;
    const meta = await res.json();
    const [gBuf, fBuf] = await Promise.all([
      fetch(`data/noise-surrogate/${meta.files.ground}`).then(r => r.arrayBuffer()),
      fetch(`data/noise-surrogate/${meta.files.facade}`).then(r => r.arrayBuffer()),
    ]);
    noiseSurrogate = {
      ...meta,
      ground: f16BufferToF32(gBuf),
      facade: f16BufferToF32(fBuf),
      facadePts: meta.facadeXyz || [],
    };
    return noiseSurrogate;
  } catch (err) {
    console.warn('noise surrogate', err);
    noiseSurrogate = null;
    return null;
  }
}

function poseLutIndex(ia, iz, ix) {
  const s = noiseSurrogate;
  return (ia * s.poseNz + iz) * s.poseNx + ix;
}

function lerpAxis(value, knots) {
  if (value <= knots[0]) return [0, 0, 1, 0];
  const last = knots.length - 1;
  if (value >= knots[last]) return [last, last, 1, 0];
  let i = 0;
  while (i < last && knots[i + 1] < value) i++;
  const t = (value - knots[i]) / Math.max(1e-9, knots[i + 1] - knots[i]);
  return [i, i + 1, 1 - t, t];
}

function addPoseLut(x, y, z, amp, gAcc, fAcc) {
  const s = noiseSurrogate;
  if (!s || !(amp > 0)) return;
  const [ix0, ix1, wx0, wx1] = lerpAxis(x, s.poseXs);
  const [iz0, iz1, wz0, wz1] = lerpAxis(z, s.poseZs);
  const [ia0, ia1, wa0, wa1] = lerpAxis(y, s.poseAlts);
  const corners = [
    [ia0, iz0, ix0, wa0 * wz0 * wx0],
    [ia0, iz0, ix1, wa0 * wz0 * wx1],
    [ia0, iz1, ix0, wa0 * wz1 * wx0],
    [ia0, iz1, ix1, wa0 * wz1 * wx1],
    [ia1, iz0, ix0, wa1 * wz0 * wx0],
    [ia1, iz0, ix1, wa1 * wz0 * wx1],
    [ia1, iz1, ix0, wa1 * wz1 * wx0],
    [ia1, iz1, ix1, wa1 * wz1 * wx1],
  ];
  const nG = s.nGround;
  const nF = s.nFacade;
  for (const [ia, iz, ix, w] of corners) {
    if (!(w > 1e-8)) continue;
    const base = poseLutIndex(ia, iz, ix);
    const gw = amp * w;
    const gOff = base * nG;
    const fOff = base * nF;
    const g = s.ground;
    const f = s.facade;
    for (let i = 0; i < nG; i++) gAcc[i] += gw * g[gOff + i];
    if (fAcc) for (let i = 0; i < nF; i++) fAcc[i] += gw * f[fOff + i];
  }
}

function nearestFacadeIndex(wx, wy, wz) {
  const pts = noiseSurrogate?.facadePts;
  if (!pts || !pts.length) return 0;
  let best = 0;
  let bestD = 1e30;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const d = (p[0] - wx) ** 2 + (p[1] - wy) ** 2 + (p[2] - wz) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function bindFacadeLutIndices(item) {
  if (!noiseSurrogate?.facadePts || !item?.world) return;
  const idx = new Int32Array(item.count);
  const step = Math.max(1, Math.floor(item.count / 36));
  for (let i = 0; i < item.count; i += step) {
    const id = nearestFacadeIndex(item.world[i * 3], item.world[i * 3 + 1], item.world[i * 3 + 2]);
    const until = Math.min(item.count, i + step);
    for (let k = i; k < until; k++) idx[k] = id;
  }
  item.lutIndex = idx;
}

function composeSurrogateFromPoses(poses) {
  const gAcc = new Float32Array(noiseSurrogate.nGround);
  const fAcc = new Float32Array(noiseSurrogate.nFacade);
  for (const p of poses) addPoseLut(p.x, p.y, p.z, p.amp == null ? 1 : p.amp, gAcc, fAcc);
  return { gAcc, fAcc };
}

function totalComposePoses() {
  const poses = [];
  const pushRoutePts = (pts, amp) => {
    if (!pts || pts.length < 2) return;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1][0], ay = pts[i - 1][2], az = -pts[i - 1][1];
      const bx = pts[i][0], by = pts[i][2], bz = -pts[i][1];
      const ds = Math.hypot(bx - ax, by - ay, bz - az);
      const nStep = Math.max(1, Math.ceil(ds / 24));
      for (let k = 0; k < nStep; k++) {
        const t = (k + 0.5) / nStep;
        poses.push({
          x: ax + (bx - ax) * t,
          y: ay + (by - ay) * t,
          z: az + (bz - az) * t,
          amp: amp * (ds / nStep) / 16,
        });
      }
      acc += ds;
    }
    void acc;
  };
  if (flightRoutes?.length) {
    for (const route of flightRoutes) {
      if (typeof routeInFilter === 'function' && !routeInFilter(route)) continue;
      pushRoutePts(route.p, route.nOnPath || 1);
    }
    return poses;
  }
  for (const s of routeSummaries) {
    for (const cells of (s.paths || [])) {
      if (!cells || cells.length < 2) continue;
      const pts = cells.map(c => {
        const v = cellToVec(c, s.alt);
        return [v.x, -v.z, v.y];
      });
      pushRoutePts(pts, s.weight || 1);
    }
  }
  return poses;
}

function sampleNoiseV2Grid(arr, x, z) {
  if (!arr || !noiseV2?.height) return null;
  const n = noiseV2.height.n;
  const half = noiseV2.height.half;
  const cell = noiseV2.height.cell;
  const u = (x + half) / cell - 0.5;
  const v = (z + half) / cell - 0.5;
  if (u < 0 || v < 0 || u > n - 1 || v > n - 1) return 0;
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const i1 = Math.min(n - 1, i0 + 1);
  const j1 = Math.min(n - 1, j0 + 1);
  const fu = u - i0;
  const fv = v - j0;
  const a = arr[j0 * n + i0];
  const b = arr[j0 * n + i1];
  const c = arr[j1 * n + i0];
  const d = arr[j1 * n + i1];
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
}

function decodeNoiseV2(raw) {
  const laeq = {};
  for (const t of Object.keys(NOISE_V2_TIERS)) laeq[t] = b64ToTyped(raw.laeq[t], Float32Array);
  return {
    raw,
    pos: b64ToTyped(raw.positions, Float32Array),
    idx: b64ToTyped(raw.indices, Uint32Array),
    centers: b64ToTyped(raw.centers, Float32Array),
    surface: b64ToTyped(raw.surface, Uint8Array),
    laeq,
    height: {
      n: raw.height.n,
      cell: raw.height.cell,
      half: raw.height.half,
      obstacle: b64ToTyped(raw.height.obstacle, Float32Array),
      terrain: b64ToTyped(raw.height.terrain, Float32Array),
    },
  };
}

async function ensureNoiseV2(blockId) {
  const url = NOISE_V2_FILES[blockId];
  if (!url) return null;
  if (!noiseV2Cache[blockId]) {
    const res = await fetch(url);
    if (!res.ok) {
      noiseV2 = null;
      return null;
    }
    noiseV2Cache[blockId] = decodeNoiseV2(await res.json());
  }
  return noiseV2Cache[blockId];
}

function disposeNoiseV2Mesh() {
  while (noiseV2Group.children.length) {
    const child = noiseV2Group.children[0];
    child.geometry?.dispose();
    if (child.material && child.material !== noiseV2Mat) child.material.dispose();
    noiseV2Group.remove(child);
  }
  noiseV2Mesh = null;
}

function colorNoiseV2Mesh(useLaeq) {
  if (!noiseV2Mesh || !noiseV2) return;
  const colors = noiseV2Mesh.geometry.getAttribute('color');
  const n = noiseV2.raw.n;
  const gray = [0.76, 0.76, 0.745];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) colors.setXYZ(i * 4 + k, gray[0], gray[1], gray[2]);
  }
  colors.needsUpdate = true;
}

function ensureNoiseV2Mesh() {
  disposeNoiseV2Mesh();
  if (!noiseV2) return;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(noiseV2.pos), 3));
  geom.setIndex(new THREE.BufferAttribute(new Uint32Array(noiseV2.idx), 1));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(noiseV2.raw.n * 4 * 3), 3));
  geom.computeVertexNormals();
  noiseV2Mesh = new THREE.Mesh(geom, noiseV2Mat);
  noiseV2Mesh.castShadow = shadowsEnabled;
  noiseV2Mesh.receiveShadow = shadowsEnabled;
  noiseV2Mesh.renderOrder = 2;
  noiseV2Group.add(noiseV2Mesh);
  colorNoiseV2Mesh(noiseEnabled);
  applyNoiseV2Visibility();
}

function nearestNoiseV2Facet(x, y, z) {
  if (!noiseV2) return null;
  const c = noiseV2.centers;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < noiseV2.raw.n; i++) {
    const dx = c[i * 3] - x;
    const dy = c[i * 3 + 1] - y;
    const dz = c[i * 3 + 2] - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const L = noiseV2.laeq[noiseV2Tier] || noiseV2.laeq.refl;
  return {
    i: best,
    L: L[best],
    surface: SURFACE_NAMES[noiseV2.surface[best]] || 'facet',
    d: Math.sqrt(bestD),
  };
}

function applyNoiseV2Visibility() {
  if (!noiseV2Mesh) return;
  noiseV2Mesh.visible = Boolean(currentBlock?.noiseV2) && buildingsVisible;
  colorNoiseV2Mesh(false);
}

function syncChannelUI() {
  syncSceneLegend();
  const wrapV2 = $('noiseV2Wrap');
  const wrapFour = $('channelFourWrap');
  if (wrapV2) wrapV2.style.display = 'none';
  if (wrapFour) wrapFour.style.display = '';
  $('channelV').textContent = (CHANNELS[externalityChannel] || CHANNELS.noise).label;
}

async function ensurePrecomputed(blockId) {
  const url = PRECOMPUTED_FILES[blockId];
  if (!url) return null;
  if (!precomputedCache[blockId]) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`precomputed ${url} ${res.status}`);
    precomputedCache[blockId] = decodePrecomputed(await res.json());
  }
  return precomputedCache[blockId];
}

function flightCumlen(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    c.push(c[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return c;
}

function prepareFlightRoutes(raw) {
  return (raw.routes || []).map(r => {
    const p = r.p || [];
    const c = flightCumlen(p);
    const h = Math.round(r.h);
    return { p, c, L: c[c.length - 1] || 1, h, col: altitudeColorHex(h), od: r.od, id: r.id };
  });
}

function atFlightRoute(route, u) {
  const d = u * route.L;
  const c = route.c;
  const p = route.p;
  let i = 1;
  while (i < c.length && c[i] < d) i++;
  const i0 = Math.max(0, i - 1);
  const i1 = Math.min(p.length - 1, i);
  const span = Math.max(1e-6, c[i1] - c[i0]);
  const t = (d - c[i0]) / span;
  return [
    p[i0][0] + (p[i1][0] - p[i0][0]) * t,
    p[i0][1] + (p[i1][1] - p[i0][1]) * t,
    p[i0][2] + (p[i1][2] - p[i0][2]) * t,
  ];
}

async function ensureFlights(blockId) {
  const url = FLIGHT_FILES[blockId];
  if (!url) {
    flightData = null;
    flightRoutes = null;
    return null;
  }
  if (flightBlockId !== blockId) {
    flightBlockId = blockId;
    playOdSet = null;
    playAltSet = null;
  }
  if (!flightCache[blockId]) {
    const res = await fetch(url);
    if (!res.ok) {
      flightData = null;
      flightRoutes = null;
      return null;
    }
    const raw = await res.json();
    flightCache[blockId] = { raw, routes: prepareFlightRoutes(raw) };
  }
  flightData = flightCache[blockId].raw;
  flightRoutes = flightCache[blockId].routes;
  return flightData;
}

function mergePlaybackDroneParts(parts) {
  const positions = [];
  const normals = [];
  for (const source of parts) {
    const geo = source.index ? source.toNonIndexed() : source;
    const pos = geo.getAttribute('position');
    const normal = geo.getAttribute('normal');
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
    }
    if (geo !== source) geo.dispose();
    source.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.computeBoundingSphere();
  return merged;
}

// 与点位探针同构的低面数 3D 四旋翼，合并后再实例化数百架。
function makePlaybackDroneGeometry() {
  const parts = [];
  parts.push(new THREE.CylinderGeometry(3.5, 4.3, 2.4, 10));
  for (const [x, z] of [[6.2, 6.2], [6.2, -6.2], [-6.2, 6.2], [-6.2, -6.2]]) {
    const len = Math.hypot(x, z);
    const arm = new THREE.BoxGeometry(len, 0.8, 0.8);
    arm.rotateY(-Math.atan2(z, x));
    arm.translate(x * 0.5, 0, z * 0.5);
    parts.push(arm);

    const motor = new THREE.CylinderGeometry(1.15, 1.15, 1.8, 10);
    motor.translate(x, 0.75, z);
    parts.push(motor);

    const rotor = new THREE.CylinderGeometry(3.5, 3.5, 0.22, 16);
    rotor.translate(x, 1.72, z);
    parts.push(rotor);

    const leg = new THREE.CylinderGeometry(0.34, 0.34, 3.1, 6);
    leg.translate(x * 0.48, -2.0, z * 0.48);
    parts.push(leg);
  }
  for (const z of [-3.4, 3.4]) {
    const skid = new THREE.BoxGeometry(10.6, 0.55, 0.55);
    skid.translate(0, -3.55, z);
    parts.push(skid);
  }
  return mergePlaybackDroneParts(parts);
}

function makePlaybackDroneAccentGeometry() {
  const parts = [];
  const dome = new THREE.SphereGeometry(2.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(0, 1.15, 0);
  parts.push(dome);

  const nose = new THREE.ConeGeometry(1.25, 3.2, 8);
  nose.rotateZ(-Math.PI / 2);
  nose.translate(4.8, 0.15, 0);
  parts.push(nose);

  for (const z of [-6.2, 6.2]) {
    const cap = new THREE.CylinderGeometry(1.3, 1.3, 0.5, 10);
    cap.translate(6.2, 1.92, z);
    parts.push(cap);
  }
  return mergePlaybackDroneParts(parts);
}

function ensureDroneMesh() {
  if (droneMesh) return;
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x323a43, shininess: 38, flatShading: true, transparent: true, opacity: 0.92 });
  const accentMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 76, flatShading: true });
  droneMesh = new THREE.InstancedMesh(makePlaybackDroneGeometry(), bodyMat, MAX_DRONES);
  droneAccentMesh = new THREE.InstancedMesh(makePlaybackDroneAccentGeometry(), accentMat, MAX_DRONES);
  if (THREE.DynamicDrawUsage) droneMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (THREE.DynamicDrawUsage) droneAccentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  droneMesh.castShadow = false;
  droneMesh.receiveShadow = false;
  droneMesh.renderOrder = 12;
  droneMesh.frustumCulled = false;
  droneAccentMesh.castShadow = false;
  droneAccentMesh.receiveShadow = false;
  droneAccentMesh.renderOrder = 13;
  droneAccentMesh.frustumCulled = false;
  droneGroup.add(droneMesh);
  droneGroup.add(droneAccentMesh);
  droneDummy = new THREE.Object3D();
  droneHide = new THREE.Matrix4().makeScale(0, 0, 0);
  droneColor = new THREE.Color();
  for (let i = 0; i < MAX_DRONES; i++) {
    droneMesh.setMatrixAt(i, droneHide);
    droneAccentMesh.setMatrixAt(i, droneHide);
    if (typeof droneAccentMesh.setColorAt === 'function') droneAccentMesh.setColorAt(i, droneColor.setHex(0xffffff));
  }
  droneMesh.instanceMatrix.needsUpdate = true;
  droneAccentMesh.instanceMatrix.needsUpdate = true;
  if (droneAccentMesh.instanceColor) droneAccentMesh.instanceColor.needsUpdate = true;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function isPlaybackFocused() {
  return Boolean((playOdSet && playOdSet.size) || (playAltSet && playAltSet.size));
}

function routeInFilter(route) {
  if (!route) return false;
  if (playOdSet && !playOdSet.has(route.od)) return false;
  if (playAltSet && !playAltSet.has(route.h)) return false;
  return true;
}

function routeFocused(ri, route) {
  if (!routeInFilter(route)) return false;
  return true;
}

function odLabel(od) { return od.replace(/[EWNS]/g, c => ({E:'东',W:'西',N:'北',S:'南'})[c]).replace('>', '→'); }

function playbackFilterLabel() {
  const od = !playOdSet ? '全部方向' : [...playOdSet].map(odLabel).join(' · ');
  const alt = !playAltSet ? '全部高度' : [...playAltSet].map(h => h + ' m').join(' · ');
  return od + ' · ' + alt;
}

function disposeFocusRibbons() {
  for (const child of focusRibbonGroup.children) {
    child.geometry?.dispose();
    child.material?.dispose();
  }
  focusRibbonGroup.clear();
}

function rebuildFocusRibbons() {
  disposeFocusRibbons();
  if (!flightRoutes || !isPlaybackFocused()) {
    applyRouteVisibility();
    return;
  }
  const byAlt = new Map();
  flightRoutes.forEach((route, ri) => {
    if (!routeFocused(ri, route) || route.p.length < 2) return;
    if (!byAlt.has(route.h)) byAlt.set(route.h, []);
    byAlt.get(route.h).push(route.p.map(([e, n, u]) => [e, u, -n]));
  });
  for (const [alt, polys] of byAlt) {
    const mesh = makeWorldRibbonMesh(polys, 0.72, altitudeColorHex(alt));
    if (mesh) {
      bindRouteOpacity(mesh, 0.72, 1, true);
      mesh.renderOrder = 11;
      focusRibbonGroup.add(mesh);
    }
  }
  applyRouteVisibility();
}

function ensureTrailLines(n) {
  while (trailGroup.children.length < n) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_STEPS * 3), 3));
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }));
    bindRouteOpacity(line, 0.88, 1, true);
    line.frustumCulled = false;
    line.renderOrder = 13;
    trailGroup.add(line);
  }
  for (let i = 0; i < trailGroup.children.length; i++) trailGroup.children[i].visible = i < n;
}

function writeTrail(line, route, u, colorHex) {
  const pos = line.geometry.getAttribute('position');
  const u0 = Math.max(0, u - TRAIL_U);
  for (let s = 0; s < TRAIL_STEPS; s++) {
    const t = TRAIL_STEPS === 1 ? 1 : s / (TRAIL_STEPS - 1);
    const p = atFlightRoute(route, u0 + (u - u0) * t);
    pos.setXYZ(s, p[0], p[2], -p[1]);
  }
  pos.needsUpdate = true;
  line.material.color.setHex(colorHex);
}

function onPlayFilterChange() {
  if (!computing && routeSummaries.length) rebuildRouteMeshes();
  rebuildFocusRibbons();
  syncPlayFilterUI();
  placeDrones();
  drawMiniMap();
  syncSheetNavigation();
  if (routeSource === 'gallery') drawGalleryKeepAway();
  if (noiseEnabled) applyImpactTimeMode();
}

function setOdPreset(role) {
  const preset = OD_PRESETS.find(p => p.role === role);
  playOdSet = preset?.ods ? new Set(preset.ods) : null;
  onPlayFilterChange();
}

function togglePlayOd(od) {
  if (!playOdSet) playOdSet = new Set([od]);
  else if (playOdSet.has(od)) {
    playOdSet.delete(od);
    if (!playOdSet.size) playOdSet = null;
  } else playOdSet.add(od);
  onPlayFilterChange();
}

function buildPlayFilterChips() {
  const odBox = $('playOdChips');
  if (odBox && !odBox.dataset.ready) {
    odBox.dataset.ready = '1';
    const add = (label, attrs, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      Object.entries(attrs).forEach(([k, v]) => { b.dataset[k] = v; });
      b.addEventListener('click', onClick);
      odBox.appendChild(b);
    };
    OD_PRESETS.forEach(p => add(p.label, { role: p.role }, () => setOdPreset(p.role)));
  }
}

function syncPlayFilterUI() {
  buildPlayFilterChips();
  const odBox = $('playOdChips');
  if (odBox) {
    odBox.querySelectorAll('button').forEach(btn => {
      const preset = OD_PRESETS.find(p => p.role === btn.dataset.role);
      const on = !preset?.ods ? !playOdSet
        : Boolean(playOdSet && setsEqual(playOdSet, new Set(preset.ods)));
      btn.classList.toggle('on', on);
    });
  }
  if ($('playOdV')) $('playOdV').textContent = playOdSet ? [...playOdSet].map(odLabel).join(' · ') : '全部';
  if ($('filterSummary')) $('filterSummary').textContent = playbackFilterLabel();
}

function fmtPlaybackClock(t, withHour) {
  t = Math.max(0, t);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (withHour || h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function setPlaybackPlaying(on) {
  playbackPlaying = on;
  const label = on ? '暂停' : '播放';
  if ($('playBtn')) $('playBtn').textContent = label;
  if ($('playHudBtn')) $('playHudBtn').textContent = label;
}

function setPlaybackRate(v) {
  playbackRate = v;
  [1, 5, 10, 20, 60].forEach(spd => {
    const btn = $('spd' + spd);
    if (btn) btn.classList.toggle('on', spd === v);
  });
}

function setPlaybackTime(t) {
  const tmax = flightData?.t_eval_s || 3600;
  playbackT = ((t % tmax) + tmax) % tmax;
  const pct = 100 * playbackT / tmax;
  if ($('playBar')) {
    $('playBar').max = tmax;
    $('playBar').value = playbackT;
    $('playBar').style.setProperty('--playback-pct', pct + '%');
  }
  const hour = tmax >= 3600;
  const clock = fmtPlaybackClock(playbackT, hour) + ' / ' + fmtPlaybackClock(tmax, hour);
  if ($('playHudClock')) $('playHudClock').textContent = clock;
}

function placeDrones() {
  const live = usingPlayback() && aircraftVisible;
  if (droneMesh) droneMesh.visible = Boolean(live);
  if (droneAccentMesh) droneAccentMesh.visible = Boolean(live);
  trailGroup.visible = Boolean(live);
  liveCraft = [];
  if (!live || !droneMesh) {
    ensureTrailLines(0);
    return;
  }
  const fl = flightData.flights || [];
  dronePickMap = [];
  const trails = [];
  let n = 0;
  let nFocus = 0;
  const placed = [];
  const sep2 = policyUavSepM > 0 ? policyUavSepM * policyUavSepM : 0;
  for (let i = 0; i < fl.length && n < MAX_DRONES; i++) {
    const ri = fl[i][0];
    const t0 = fl[i][1];
    const t1 = fl[i][2];
    const u = flightProgress(t0, t1);
    if (u == null) continue;
    const route = flightRoutes[ri];
    if (!route || route.p.length < 2) continue;
    if (playAltSet && !playAltSet.has(route.h)) continue;
    const focused = routeFocused(ri, route);
    if (!focused) continue;
    nFocus++;
    const p = atFlightRoute(route, u);
    const x = p[0], y = p[2], z = -p[1];
    if (sep2 > 0 && placed.some(q => {
      const dx = x - q.x, dy = y - q.y, dz = z - q.z;
      return dx * dx + dy * dy + dz * dz < sep2;
    })) continue;
    placed.push({ x, y, z });
    liveCraft.push({ id: i, x, y, z });
    const p0 = atFlightRoute(route, Math.max(0, u - 0.003));
    const p1 = atFlightRoute(route, Math.min(1, u + 0.003));
    droneDummy.position.set(x, y, z);
    droneDummy.rotation.set(0, Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), 0);
    const scale = 0.32; // Keep all aircraft at the unfocused reference size.
    droneDummy.scale.set(scale, scale, scale);
    droneDummy.updateMatrix();
    droneMesh.setMatrixAt(n, droneDummy.matrix);
    droneAccentMesh.setMatrixAt(n, droneDummy.matrix);
    if (typeof droneAccentMesh.setColorAt === 'function') {
      droneAccentMesh.setColorAt(n, droneColor.setHex(route.col));
    }
    dronePickMap[n] = ri;
    if (focused) trails.push({ route, u, col: route.col });
    n++;
  }
  for (let i = n; i < MAX_DRONES; i++) {
    droneMesh.setMatrixAt(i, droneHide);
    droneAccentMesh.setMatrixAt(i, droneHide);
  }
  droneMesh.count = Math.max(1, n);
  droneAccentMesh.count = Math.max(1, n);
  droneMesh.instanceMatrix.needsUpdate = true;
  droneAccentMesh.instanceMatrix.needsUpdate = true;
  if (droneAccentMesh.instanceColor) droneAccentMesh.instanceColor.needsUpdate = true;
  ensureTrailLines(trails.length);
  trails.forEach((item, i) => writeTrail(trailGroup.children[i], item.route, item.u, item.col));
  if ($('playHudAir')) {
    $('playHudAir').textContent = `当前显示 ${n} 架`;
    syncAirThroughputHud(n);
  }
}

function syncPlaybackUI() {
  syncSheetNavigation();
  const show = usingPlayback();
  if ($('playbackWrap')) $('playbackWrap').style.display = 'none';
  const hud = $('playHud');
  if (hud) hud.classList.toggle('on', show);
  droneGroup.visible = show && aircraftVisible;
  if (show) {
    ensureDroneMesh();
    setPlaybackTime(playbackT);
    placeDrones();
    if ($('filterSummary')) $('filterSummary').textContent = timelineVariant()
      ? (impactTimeMode === 'live' ? '原型 · 全部航线 · 瞬时影响（非 SZU refl）' : '原型 · 全部航线 · 区域总量（非 SZU refl）')
      : playbackFilterLabel();
    const nFlights = flightData.n_flights || (flightData.flights || []).length;
    syncAirThroughputHud(nFlights);
  } else {
    liveCraft = [];
    if (droneMesh) droneMesh.visible = false;
    if (droneAccentMesh) droneAccentMesh.visible = false;
    disposeFocusRibbons();
    ensureTrailLines(0);
  }
}

function sampleCapacityGround(x, z, channel) {
  const g = capacityField.ground;
  const n = g.n;
  const half = g.extent / 2;
  const u = (x + half) / g.extent * (n - 1);
  const vv = (z + half) / g.extent * (n - 1);
  if (u < 0 || vv < 0 || u > n - 1 || vv > n - 1) return 0;
  const arr = g.v[channel] || g.v.noise;
  const i0 = Math.floor(u);
  const j0 = Math.floor(vv);
  const i1 = Math.min(n - 1, i0 + 1);
  const j1 = Math.min(n - 1, j0 + 1);
  const fu = u - i0;
  const fv = vv - j0;
  const a = arr[j0 * n + i0];
  const b = arr[j0 * n + i1];
  const c = arr[j1 * n + i0];
  const d = arr[j1 * n + i1];
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
}

function sampleCapacityField(x, y, z, channel) {
  const vs = capacityField.vs;
  const ix = Math.round(x / vs);
  const iy = Math.round((-z) / vs);
  const iz = Math.round(y / vs);
  let best = 0;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      for (let dk = -1; dk <= 1; dk++) {
        const rec = capacityField.map.get(capacityField.pack(ix + di, iy + dj, iz + dk));
        if (!rec) continue;
        const val = rec[channel] || 0;
        if (val > best) best = val;
      }
    }
  }
  return best;
}

function syncRouteSourceUI() {
  routeOpacityScale = routeOpacityBySource.probe;
  $('routeOpacity').value = String(Math.round(routeOpacityScale * 100));
  $('opacityV').textContent = String(Math.round(routeOpacityScale * 100));
  const density = $('density');
  if (density) {
    density.disabled = false;
    density.value = entriesPerEdge;
    $('densityV').textContent = entriesPerEdge;
  }
  const gap = $('heightGapV');
  if (gap) gap.textContent = `${HEIGHT_GAP} m`;
  const note = $('routeSourceNote');
  const sub = $('sandboxSub');
  if (note) note.textContent = `${policyRuleText()} · 800 m 外缘对穿`;
  if (sub) sub.textContent = `${currentBlock?.name || ''} · ${policyRuleText()}`;
}

function restoreProbeAltitudes() {
  altitudes = buildAltitudes(HEIGHT_GAP);
  maxHeightWeight = Math.max(...altitudes.map(heightWeight));
  buildMapTiles();
}

function computeFlyableAt(alt) {
  const fly = new Uint8Array(N * N);
  let count = 0;
  let coreCount = 0;
  for (let k = 0; k < N * N; k++) {
    fly[k] = heightField[k] <= alt ? 1 : 0;
    count += fly[k];
    const i = k % N;
    const j = (k / N) | 0;
    if (isCoreCell(i, j)) coreCount += fly[k];
  }
  return {
    flyable: fly,
    flyPct: { all: count / (N * N), core: coreCount / (CORE_N * CORE_N) },
  };
}

// ============ 净空规则对照：数据与几何 ============
// 三个旋钮（galleryParams：净空距离 / 量法 / 离人距离）→ 逐高度半径 → 粉色禁区层、
// 可飞体块、可飞百分比。矩阵与面板在文件末尾。预计算过参数的组合才有排班航线与容量。

function galleryPlaceForBlock(block) {
  return GALLERY_PLACES.find(p => p.sandboxId === block?.id) || null;
}

function galleryTagForBlock(block) {
  return galleryPlaceForBlock(block)?.tag || null;
}

async function ensureGallery() {
  if (galleryCells) return galleryCells;
  if (!galleryLoading) {
    galleryLoading = fetch(GALLERY_FILE)
      .then(res => { if (!res.ok) throw new Error(`gallery ${res.status}`); return res.json(); })
      .then(json => {
        galleryCells = new Map((json.cells || []).map(c => [c.id, c]));
        return galleryCells;
      })
      .catch(err => { console.warn(err); galleryLoading = null; return null; }); // 失败可重试
  }
  return galleryLoading;
}

// 当前参数三元组对应的预计算格；没有 → null（自定义参数：只有几何，没有排班与容量）
function galleryCellFor(tag) {
  if (!galleryCells || !tag) return null;
  for (const pkg of GALLERY_PACKAGES) {
    const cell = galleryCells.get(`${tag}_${pkg}`);
    if (!cell) continue;
    if (Number(cell.d_obs) === galleryParams.d &&
        cell.building_metric === galleryParams.metric &&
        Number(cell.pedestrian_clearance_m) === galleryParams.pedestrianM) return cell;
  }
  return null;
}

// 列头文案 = 参数本身（不出现任何辖区名）
function galleryPackageLabel(cell) {
  const d = Number(cell?.d_obs ?? galleryParams.d);
  const ped = Number(cell?.pedestrian_clearance_m ?? galleryParams.pedestrianM);
  if (ped > 0) return `离人${ped}`;
  return `${d}m${cell?.building_metric === 'horizontal' ? '平' : ''}`;
}

function galleryRuleText() {
  const parts = [`${galleryParams.d} m ${GALLERY_METRIC_LABEL[galleryParams.metric]}`];
  if (galleryParams.pedestrianM > 0) parts.push(`离人 ${galleryParams.pedestrianM} m`);
  return parts.join(' · ');
}

// 逐高度净空半径：与管线（policy_sweep_run.py）和原页面 keepAwayRadius() 同口径。
// 离人规则与高度无关；水平量法取常数（屋顶正上方也不放行）；三维量法在屋顶以上按
// √(d²−dz²) 收缩、dz≥d 后归零（可以从屋顶“抄近路”）。
function galleryKeepAwayRadius(b, alt) {
  const { d, metric, pedestrianM } = galleryParams;
  if (pedestrianM > 0) return GALLERY_RING_M + pedestrianM;
  if (metric === 'horizontal') return d;
  if (alt <= b.h) return d;
  const dz = alt - b.h;
  if (dz >= d) return 0;
  return Math.sqrt(d * d - dz * dz);
}

// 四态分类：逐字对应原页面 outcome()
function galleryOutcome(cell) {
  if (!cell) return 'loading';
  const routes = cell.routes || [];
  const throughUsed = routes.filter(r => OPPOSITE_OD.has(r.od) && r.used);
  if (cell.capacity_status !== 'ok') {
    if (cell.capacity_reason === 'empty_routes' || cell.probe_connected) return 'empty_path';
    return 'blocked';
  }
  if (throughUsed.length === 0) return 'corners_only';
  return 'ok';
}

// 该规则的高度层：预计算格给的是带高度上限的层高；自定义参数退回主沙盘的默认高度阶梯，
// 保证高度地图永远非空（12 个 no_connection 格没有航线，不能让 altitudes 为空）。
function galleryAltsFor(cell) {
  const fromData = (cell?.layers || []).map(l => Number(l.h)).filter(Number.isFinite);
  const base = fromData.length ? fromData : buildAltitudes(HEIGHT_GAP);
  return [...new Set(base)].sort((a, b) => a - b);
}

// 半径与高度无关的规则（水平量法 / 离人距离）：全高度共用一张切片，
// 省掉 5 倍重复外扩——实测东京 1167 栋下单张切片就要 0.4 s，重复算是纯浪费。
function galleryRuleAltIndependent() {
  return galleryParams.pedestrianM > 0 || galleryParams.metric === 'horizontal';
}

// 一个高度上的净空切片：外扩并集（画粉色禁区）+ 可飞面（算可飞%、喂体块）。
// 外扩用 jtMiter 而非圆角：与主沙盘可飞体块同一套（受 ClipperLib 的 miter limit 限制），
// 且在东京这种千栋级街区快 2.6 倍（实测 1152 ms → 441 ms）。
function gallerySliceFor(alt) {
  const sliceAlt = galleryRuleAltIndependent() ? 0 : alt;
  const key = `${galleryTagForBlock(currentBlock)}|${galleryParams.d}|${galleryParams.metric}|${galleryParams.pedestrianM}|${sliceAlt}`;
  const hit = gallerySliceCache.get(key);
  if (hit) return hit;
  const radii = obstacleBuildings.map(b => galleryKeepAwayRadius(b, sliceAlt));
  const buffered = bufferedObstaclePaths(obstacleBuildings, CLIP_SCALE, radii, ClipperLib.JoinType.jtMiter);
  const region = flyableRegion(buffered, CLIP_SCALE);
  const slice = { solids: clipperPathsToSolids(buffered), region };
  gallerySliceCache.set(key, slice);
  return slice;
}

// 用画布把可飞面栅格化成 N×N（不要逐格点包含判定——那是一圈外环加上千个孔）
function galleryFlyableAt(alt) {
  const { region } = gallerySliceFor(alt);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  const path = new Path2D();
  const addRing = ring => {
    ring.forEach(([x, z], i) => {
      const px = (x + HALF) / CELL, py = (z + HALF) / CELL;
      if (i) path.lineTo(px, py); else path.moveTo(px, py);
    });
    path.closePath();
  };
  for (const s of region.solids) {
    addRing(s.outer);
    for (const h of s.holes) addRing(h);
  }
  ctx.fill(path, 'evenodd');
  const img = ctx.getImageData(0, 0, N, N).data;
  const fly = new Uint8Array(N * N);
  let count = 0, coreCount = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (img[(j * N + i) * 4 + 3] > 127) {
        fly[idx(i, j)] = 1; count++;
        if (isCoreCell(i, j)) coreCount++;
      }
    }
  }
  return { flyable: fly, flyPct: { all: count / (N * N), core: coreCount / (CORE_N * CORE_N) } };
}

// 禁区层画在高度地图当前选中的那一层上（沿用“高度地图是唯一选层入口”的约定）
function galleryKeepAlt() {
  if (!altitudes.length) return ALT_MIN;
  return altitudes[Math.max(0, Math.min(selectedHeightIndex, altitudes.length - 1))];
}

function clearGalleryKeepAway() {
  for (const child of galleryKeepGroup.children) child.geometry?.dispose(); // 材质共用，不 dispose
  galleryKeepGroup.clear();
}

function drawGalleryKeepAway() {
  clearGalleryKeepAway();
  galleryKeepGroup.visible = routeSource === 'gallery' && galleryKeepVisible && Boolean(currentBlock);
  if (!galleryKeepGroup.visible) return;
  const alt = galleryKeepAlt();
  const { solids } = gallerySliceFor(alt);
  const positions = [], indices = [];
  for (const s of solids) emitCap(s.outer, s.holes, alt + 0.4, true, positions, indices);
  if (!positions.length) return;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, galleryKeepMat);
  mesh.renderOrder = 6;
  galleryKeepGroup.add(mesh);
}

// 可飞体块按所选规则重算：水平量法与离人规则全程阻挡（直棱柱），
// 三维量法按屋顶以上收缩（梯田）；体块封顶在该规则的最高层高。
function galleryVolumeSpec(cell) {
  const alts = galleryAltsFor(cell);
  return {
    buildings: obstacleBuildings,
    yMax: Math.min(ALT_MAX, Math.max(...alts, FLYABLE_VISUAL_BASE_M)),
    gallery: {
      d: galleryParams.d,
      metric: galleryParams.metric,
      pedestrianM: galleryParams.pedestrianM,
      ringM: GALLERY_RING_M,
    },
  };
}

async function recomputeGallery(version) {
  const loaded = await ensureGallery();
  if (version !== computeVersion) return false;
  if (!loaded || !galleryTagForBlock(currentBlock)) return false;
  const cell = galleryCellFor(galleryTagForBlock(currentBlock));
  const routes = cell?.routes || [];
  flyableVolumeSpec = galleryVolumeSpec(cell);
  // 规则对照不叠外部性：cell.noise 是标量、与噪声 v2 的面片口径不同，混图例会讲错话
  noiseEnabled = false;
  const noiseBox = $('noiseToggle');
  if (noiseBox) noiseBox.checked = false;
  const busy = $('busy');
  if (busy) busy.textContent = cell ? '加载净空规则航线…' : '按当前参数重算净空几何…';
  const ok = await drawCapacityRoutes(version, {
    routes,
    alts: galleryAltsFor(cell),
    flyableAt: alt => galleryFlyableAt(alt),
  });
  if (!ok || version !== computeVersion) return false;
  drawGalleryKeepAway();
  rebuildFlyableVolume();
  updateMetrics();
  drawMiniMap();
  syncRouteSourceUI();
  syncPlaybackUI();
  syncSceneLegend();
  paintGalleryMatrix();
  writeGalleryStatus(cell);
  return true;
}

// opts 可选（净空规则模式用）：routes（改用这组航线）/ alts（改用这组高度层，
// 没有航线的格子高度地图也不至于空）/ flyableAt(alt)（改用这套可飞面）。
// 省略 opts 时（容量排班）行为与旧实现一致。
async function drawCapacityRoutes(version, opts) {
  const byAlt = new Map();
  for (const r of opts?.routes || flightRoutes || precomputed.raw.routes) {
    const alt = r.h;
    if (!byAlt.has(alt)) byAlt.set(alt, []);
    byAlt.get(alt).push(r.p.map(([e, n, u]) => [e, u, -n]));
  }
  const altList = opts?.alts?.length ? opts.alts : [...byAlt.keys()];
  altitudes = [...new Set(altList)].sort((a, b) => a - b);
  if (!altitudes.length) altitudes = [ALT_MIN]; // 兜底：Math.max(...[]) 会得到 -Infinity
  maxHeightWeight = Math.max(...altitudes.map(heightWeight));
  buildMapTiles();
  for (const alt of altitudes) {
    if (version !== computeVersion) return false;
    const polys = byAlt.get(alt) || [];
    const { flyable: fly, flyPct } = opts?.flyableAt ? opts.flyableAt(alt) : computeFlyableAt(alt);
    const weight = heightWeight(alt) / maxHeightWeight;
    const routeOpacity = 0.010 + 0.070 * weight;
    if (polys.length) {
      const mesh = makeWorldRibbonMesh(polys, routeOpacity, altitudeColorHex(alt));
      // userData.altitude：高度层筛选要用（容量模式靠 usingCapacity() 短路，probe 模式由 drawAltitudeResult 设置）
      if (mesh) { mesh.userData.altitude = alt; bindRouteOpacity(mesh, routeOpacity, 0.55); routeGroup.add(mesh); }
    }
    totalRoutes += polys.length;
    routeSummaries.push({
      alt,
      weight,
      flyPct,
      flyable: fly,
      paths: [],
      worldPaths: polys.map(poly => poly.map(p => [p[0], p[2]])),
      pathCount: polys.length,
      anchors: [],
    });
    await nextFrame();
  }
  applyRouteVisibility();
  return true;
}

function startProbeWorker(version, resolve) {
  activeComputeDone = resolve;
  routeWorker = new Worker('route-worker.js?v=ux-41');
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
        rebuildRouteMeshes();
        drawMiniMap();
        buildLiveFlightsFromSummaries();
        updateMetrics();
        applyTimelinePrototype();
        syncPlayFilterUI();
        syncPlaybackUI();
        if (noiseEnabled) applyImpactTimeMode();
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
    padM: 0,
    uavSepM: policyUavSepM,
  }, [heightFieldBuffer]);
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
  precomputed = null;
  capacityField = null;
  flyableVolumeSpec = policyVolumeSpec();
  if (typeof clearGalleryKeepAway === 'function') {
    clearGalleryKeepAway();
    galleryKeepGroup.visible = false;
  }

  flightData = null;
  flightRoutes = null;
  liveCraft = [];
  restoreProbeAltitudes();
  syncRouteSourceUI();
  syncChannelUI();
  syncPlaybackUI();
  syncSceneLegend();
  const busy = $('busy');
  if (busy) busy.textContent = '计算多高度航线...';

  return new Promise(resolve => startProbeWorker(version, resolve));
}

function updateMetrics() {
  const legend = $('altLegend');
  legend.innerHTML = '';
  if (usingCapacity()) {
    const s = precomputed.raw.source || {};
    const cap = s.summary?.capacity_stable_hour;
    const row = document.createElement('div');
    row.className = 'alt';
    row.innerHTML = `<span class="sw altCmapSw"></span><span>容量排班</span><span style="margin-left:auto">稳定容量 ${cap} 架次/时 · 排班记录 ${s.n_flights} 架次</span>`;
    legend.appendChild(row);
  } else if (flightData?.live) {
    const row = document.createElement('div');
    row.className = 'alt';
    row.innerHTML = `<span class="sw altCmapSw"></span><span>通行能力</span><span style="margin-left:auto">${fmtFlightsPerHour(liveThroughputPerHour())} 架次/时 · 回放 1 h</span>`;
    legend.appendChild(row);
  }
  routeSummaries.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'alt';
    const pct = Math.round(s.flyPct.core * 100);
    row.innerHTML = `<span class="sw" style="background:${altitudeColorCss(s.alt)};opacity:${Math.min(1, (0.30 + 0.70 * s.weight) * routeOpacityScale).toFixed(2)}"></span><span>${s.alt} m</span><span style="margin-left:auto">W ${(s.weight).toFixed(2)} · ${s.pathCount || s.paths.length} 条 · ${pct}%</span>`;
    legend.appendChild(row);
  });
}

function drawMiniMap() {
  syncHeightPage();
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
    ctx.strokeStyle = '#1677db';
    ctx.globalAlpha = 0.85;
    const toX = wx => (wx + HALF) / DOMAIN * W;
    const toY = wz => H - (wz + HALF) / DOMAIN * H;
    // The map and 3D filter ribbons use the same scheduled routes and OD labels.
    let mapPaths;
    if (s.worldPaths && flightRoutes) {
      mapPaths = flightRoutes.filter(r => r.h === s.alt && routeInFilter(r)).map(r => r.p.map(p => [p[0], -p[1]]));
    } else if (s.worldPaths) {
      mapPaths = s.worldPaths;
    } else {
      mapPaths = visibleSummaryPaths(s).map(path => path.map(k => [gx(k % N), iToZ((k / N) | 0)]));
    }
    for (const path of mapPaths) {
      let drawing = false;
      ctx.beginPath();
      for (const [wx, wz] of path) {
        if (Math.abs(wx) > HALF || Math.abs(wz) > HALF) {
          if (drawing) {
            ctx.stroke();
            ctx.beginPath();
            drawing = false;
          }
          continue;
        }
        const x = toX(wx);
        const y = toY(wz);
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
    const x0 = CORE_OFFSET / N * W;
    const x1 = (CORE_OFFSET + CORE_N) / N * W;
    const yTop = H - (CORE_OFFSET + CORE_N) / N * H;
    const yBot = H - CORE_OFFSET / N * H;
    ctx.strokeStyle = '#17191c';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x0, yTop, x1 - x0, yBot - yTop);
    ctx.strokeStyle = '#1677ff';
    ctx.strokeRect(1, 1, W - 2, H - 2);
    const cap = $(`mapCap-${si}`);
    if (cap) { cap.textContent = `${mapPaths.length} 条 · 可飞 ${Math.round(s.flyPct.core * 100)}%`; }
  });
}

function cellToVec(k, alt) {
  return new THREE.Vector3(gx(k % N), alt + 2.4, iToZ((k / N) | 0));
}

function collectNoiseSegments() {
  const segments = [];
  if (flightRoutes && flightRoutes.length) {
    const routes = flightRoutes.filter(routeInFilter);
    const stride = Math.max(1, Math.ceil(routes.length / (NOISE_MAX_PATHS_PER_ALT * Math.max(1, altitudes.length))));
    for (let ri = 0; ri < routes.length; ri += stride) {
      const route = routes[ri];
      const pts = route.p;
      if (!pts || pts.length < 2) continue;
      const step = Math.max(1, Math.floor(pts.length / 24));
      for (let i = 0; i < pts.length - 1; i += step) {
        const pa = pts[i];
        const pb = pts[Math.min(pts.length - 1, i + step)];
        const a = new THREE.Vector3(pa[0], pa[2], -pa[1]);
        const b = new THREE.Vector3(pb[0], pb[2], -pb[1]);
        const hx = b.x - a.x;
        const hz = b.z - a.z;
        const hLen = Math.hypot(hx, hz) || 1;
        segments.push({
          a, b,
          amp: heightWeight(route.h) / maxHeightWeight * stride * step,
          dirX: hx / hLen,
          dirZ: hz / hLen,
          alt: route.h,
        });
        if (segments.length >= NOISE_MAX_SEGMENTS) return segments;
      }
    }
    return segments;
  }
  for (const s of routeSummaries) {
    const paths = visibleSummaryPaths(s);
    if (!paths.length) continue;
    const stride = Math.max(1, Math.ceil(paths.length / NOISE_MAX_PATHS_PER_ALT));
    for (let pi = 0; pi < paths.length; pi += stride) {
      const path = paths[pi];
      const cellStep = Math.max(1, Math.floor(path.length / 24));
      for (let ci = 0; ci < path.length - 1; ci += cellStep) {
        const a = cellToVec(path[ci], s.alt);
        const b = cellToVec(path[Math.min(path.length - 1, ci + cellStep)], s.alt);
        const hx = b.x - a.x;
        const hz = b.z - a.z;
        const hLen = Math.hypot(hx, hz) || 1;
        segments.push({
          a, b,
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
      // Direct spherical spreading + ground image source (coarse 1st-order reflection).
      v += s.amp / (420 + d2);
      const imgA = { x: s.a.x, y: -Math.abs(s.a.y), z: s.a.z };
      const imgB = { x: s.b.x, y: -Math.abs(s.b.y), z: s.b.z };
      const d2r = pointSegmentDistanceSq3(px, py, pz, imgA, imgB);
      v += 0.47 * s.amp / (420 + d2r);
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
  if (timelineHeatMesh) timelineHeatMesh.visible = visible && impactTimeMode === 'live';
  if (liveFacadeGroup) liveFacadeGroup.visible = visible && impactTimeMode === 'live' && !probeMode;
  if (usingNoiseV2()) applyNoiseV2Visibility();
}

function scheduleExternalityLayer() {
  if (impactTimeMode === 'live') return;
  clearTimeout(externalityTimer);
  const version = ++externalityVersion;
  $('busy').classList.add('on');
  $('busy').textContent = '估算当前航线的影响...';
  externalityTimer = setTimeout(async () => {
    await nextFrame();
    await buildNoiseLayer(version);
    if (version === externalityVersion && !computing) $('busy').classList.remove('on');
  }, 30);
}

async function buildNoiseLayer(version) {
  clearNoiseLayer();
  const useLut = usingNoiseSurrogate();
  let composed = null;
  let segmentsForNoise = null;
  if (useLut) {
    const poses = totalComposePoses();
    if (!poses.length) return;
    composed = composeSurrogateFromPoses(poses);
  } else {
    segmentsForNoise = collectNoiseSegments();
    if (!segmentsForNoise.length) return;
  }
  const channel = CHANNELS[externalityChannel] || CHANNELS.noise;
  const chKey = externalityChannel;

  const groundPositions = [];
  const groundIndices = [];
  const groundValues = [];
  for (let j = 0; j <= NOISE_GRID; j++) {
    for (let i = 0; i <= NOISE_GRID; i++) {
      const x = -CORE_HALF + CORE_DOMAIN * i / NOISE_GRID;
      const z = -CORE_HALF + CORE_DOMAIN * j / NOISE_GRID;
      const y = terrainVisualHeight(x, z) + 0.42;
      groundPositions.push(x, y, z);
      const raw = useLut
        ? composed.gAcc[j * (NOISE_GRID + 1) + i]
        : noiseAt(x, y, z, segmentsForNoise);
      groundValues.push(channel.ground ? raw * channel.ground : 0);
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
      const wx = pos.getX(i) + b.group.position.x;
      const wy = pos.getY(i) + b.group.position.y;
      const wz = pos.getZ(i) + b.group.position.z;
      const raw = useLut
        ? composed.fAcc[nearestFacadeIndex(wx, wy, wz)]
        : noiseAt(wx, wy, wz, segmentsForNoise);
      probeValues.push(raw * channel.facade);
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
      const value = (useLut
        ? composed.fAcc[nearestFacadeIndex(wx, wy, wz)]
        : noiseAt(wx, wy, wz, segmentsForNoise)) * channel.facade;
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
    tile.innerHTML = `<div class="mapCap"><b>${alt} m</b><span id="mapCap-${i}">-</span></div><canvas id="mapCanvas-${i}" width="384" height="384"></canvas>`;
    grid.appendChild(tile);
  });
  syncHeightPage();
}

function applyRouteVisibility() {
  const focused = usingCapacity() && Boolean(flightData) && isPlaybackFocused();
  for (const group of [routeGroup, anchorGroup]) {
    for (const child of group.children) child.visible = usingCapacity() || !playAltSet || playAltSet.has(child.userData.altitude);
  }
  routeGroup.visible = routesVisible && !focused;
  anchorGroup.visible = routesVisible && !focused;
  focusRibbonGroup.visible = routesVisible && focused;
  droneGroup.visible = usingPlayback() && aircraftVisible;
}

function applyAuxiliaryBuildingVisibility() {
  const replaceWhiteModel = Boolean(currentBlock?.noiseV2) && Boolean(noiseV2Mesh) && !(currentBlock.buildings && currentBlock.buildings.length);
  for (const b of buildings) {
    if (!b.group) continue;
    if (replaceWhiteModel) {
      b.group.visible = false;
      continue;
    }
    b.group.visible = buildingsVisible && (!b.isHalo || haloBuildingsVisible);
  }
  applyNoiseV2Visibility();
}

function applyTerrainMode() {
  clearNoiseLayer();
  buildTerrain();
  buildBufferRings();
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
  document.body.dataset.view = tab;
  document.querySelectorAll('.tabBtn').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
    item.setAttribute('aria-pressed', String(item.dataset.tab === tab));
  });
  document.querySelectorAll('.tabPanel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === tab);
  });
  syncSheetNavigation();
}

document.querySelectorAll('.tabBtn').forEach(btn => {
  btn.addEventListener('click', () => { activatePanelTab(btn.dataset.tab); applyDisplayPreset(btn.dataset.tab); });
});

activatePanelTab(document.querySelector('.tabBtn.active')?.dataset.tab || 'routes');

$('presets').addEventListener('change', e => {
  loadPreset(e.target.value);
});

$('density').addEventListener('input', e => {
  if (e.target.disabled) return;
  entriesPerEdge = +e.target.value;
  $('densityV').textContent = entriesPerEdge;
  scheduleCompute();
});

$('routeOpacity').addEventListener('input', e => {
  routeOpacityScale = +e.target.value / 100;
  routeOpacityBySource[routeSource] = routeOpacityScale;
  $('opacityV').textContent = e.target.value;
  updateRouteOpacity();
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

if ($('aircraftToggle')) {
  $('aircraftToggle').addEventListener('change', e => {
    aircraftVisible = e.target.checked;
    applyRouteVisibility();
    placeDrones();
  });
}

function bindPlaybackControls() {
  if ($('playBtn')) $('playBtn').addEventListener('click', () => setPlaybackPlaying(!playbackPlaying));
  if ($('playHudBtn')) $('playHudBtn').addEventListener('click', () => setPlaybackPlaying(!playbackPlaying));
  [1, 5, 10, 20, 60].forEach(spd => {
    const btn = $('spd' + spd);
    if (btn) btn.addEventListener('click', () => setPlaybackRate(spd));
  });
  if ($('playBar')) {
    $('playBar').addEventListener('input', e => {
      if (!flightData) return;
      setPlaybackTime(+e.currentTarget.value);
      placeDrones();
    });
  }

}
bindPlaybackControls();

$('noiseToggle').addEventListener('change', e => {
  noiseEnabled = e.target.checked;
  applyAuxiliaryBuildingVisibility();
  if (noiseEnabled) {
    applyImpactTimeMode();
  } else {
    externalityVersion++;
    clearNoiseLayer();
    disposeTimelineHeat();
    disposeLiveFacades();
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
    if (noiseEnabled) applyImpactTimeMode();
    if (probeMode) rebuildProbe();
  });
});

document.querySelectorAll('input[name="noiseV2Tier"]').forEach(input => {
  input.addEventListener('change', e => {
    if (!e.target.checked) return;
    noiseV2Tier = e.target.value;
    syncChannelUI();
    if (usingNoiseV2()) colorNoiseV2Mesh(noiseEnabled);
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

$('flyableVolumeToggle').addEventListener('change', e => setFlyableVolumeVisible(e.target.checked));

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
  const x = probePos.x, z = probePos.z, alt = probeAlt;
  const hr = probeHeadingDeg * Math.PI / 180;
  const hx = Math.cos(hr), hz = Math.sin(hr);
  if (usingNoiseV2()) {
    const drone = makeDroneIcon(hr);
    drone.position.set(x, alt, z);
    probeGroup.add(drone);
    probeGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, alt, z), new THREE.Vector3(x, terrainVisualHeight(x, z), z)]),
      new THREE.LineBasicMaterial({ color: '#d94841', transparent: true, opacity: 0.5 })));
    probeGroup.add(new THREE.ArrowHelper(new THREE.Vector3(hx, 0, hz), new THREE.Vector3(x, alt, z), 34, '#1677ff', 10, 6));
    const hit = nearestNoiseV2Facet(x, alt, z);
    const ro = $('probeReadout');
    if (ro && hit) {
      ro.innerHTML = `噪声 v2 <b>${NOISE_V2_TIERS[noiseV2Tier]}</b> · 高度 <b>${alt} m</b><br>` +
        `最近面片 ${hit.surface} · L<sub>Aeq</sub> <b>${hit.L.toFixed(2)} dB</b> · ${hit.d.toFixed(1)} m`;
    }
    return;
  }
  const ch = externalityChannel;
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
      values.push(usingCapacity()
        ? (cy < 8 ? sampleCapacityGround(cx, cz, ch) : sampleCapacityField(cx, cy, cz, ch))
        : noiseAt(cx, cy, cz, segs, ch));
    }
  }
  // 立面采样(复用缓存的世界坐标),和地面共用同一峰值刻度
  ensureProbeFacade();
  for (const f of probeFacade) {
    f.vals = new Float32Array(f.count);
    for (let i = 0; i < f.count; i++) {
      f.vals[i] = usingCapacity()
        ? sampleCapacityField(f.world[i * 3], f.world[i * 3 + 1], f.world[i * 3 + 2], ch)
        : noiseAt(f.world[i * 3], f.world[i * 3 + 1], f.world[i * 3 + 2], segs, ch);
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
    const extra = usingCapacity()
      ? '叠加 = SZU 四通道受体场<br>'
      : (ch === 'risk'
        ? `前甩落点 <b>${fwd.toFixed(0)} m</b> · 落区 σ∥×σ⊥ <b>${sl}×${scc} m</b><br>`
        : '');
    ro.innerHTML = `通道 <b>${(CHANNELS[ch] || CHANNELS.noise).label}</b> · 高度 <b>${alt} m</b><br>${extra}峰值(相对) <b>${peak.toExponential(2)}</b> · 拖高度看变化`;
  }
}

(function setupProbeUI() {
  if (!$('probeToggle')) return;
  $('probeToggle').addEventListener('click', () => {
    probeMode = !probeMode;
    $('probeToggle').textContent = probeMode ? '开' : '关';
    $('probeToggle').classList.toggle('active', probeMode);
    if (probeMode) {
      if (!usingNoiseV2()) setNoiseLayerVisible(false);
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
  if (!dn) return;
  if (Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > 6) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1);
  probeRaycaster.setFromCamera(ndc, camera);
  if (!probeMode) return;
  if (usingNoiseV2() && noiseV2Mesh) {
    const hits = probeRaycaster.intersectObject(noiseV2Mesh);
    if (hits.length) {
      probePos = { x: hits[0].point.x, z: hits[0].point.z };
      rebuildProbe();
      return;
    }
  }
  const hit = new THREE.Vector3();
  if (probeRaycaster.ray.intersectPlane(probeGroundPlane, hit)) {
    probePos = { x: hit.x, z: hit.z };
    rebuildProbe();
  }
});

let drawerMotionUntil = 0;
function onResize() {
  const panelRight = window.innerWidth <= 600 ? 0 : Math.max(0, $('controlPanel').getBoundingClientRect().right + 30);
  // Measure the translated edge while the drawer moves, including its handle.
  const w = Math.max(1, stage.clientWidth - panelRight), h = stage.clientHeight;
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.left = panelRight + 'px';
  renderer.domElement.style.top = '0';
  document.body.style.setProperty('--scene-left', panelRight + 'px');
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  fitScene();
}
window.addEventListener('resize', onResize);

function fitScene() {
  // Fit the 500 m core, leaving room for the legend and playback controls.
  const distance = Math.max(1550, 490 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  const direction = camera.position.clone().sub(ORBIT_TARGET).normalize();
  camera.position.copy(ORBIT_TARGET).addScaledVector(direction, Math.min(distance, 2900));
  controls.update();
}

function syncSceneLegend() {
  if (!$('sceneLegendTitle')) return;
  const title = $('sceneLegendTitle'), bar = $('sceneLegendBar'), scale = $('sceneLegendScale');
  if (noiseEnabled) {
    const ch = (CHANNELS[externalityChannel] || CHANNELS.noise).label;
    const live = impactTimeMode === 'live';
    title.textContent = live ? `${ch} · 瞬时` : `${ch} · 区域总量`;
    bar.style.background = 'linear-gradient(90deg,#3b4cc0 0%,#6888ee 18%,#aac6fd 36%,#f2f2f2 50%,#fcbea1 64%,#db5e4b 82%,#b40426 100%)';
    scale.textContent = '低 ← 相对影响 → 高';
    $('sceneLegendNote').textContent = live
      ? (usingNoiseSurrogate()
        ? '地面和立面 = 当前机位单位场相加（dir_proxy LUT）。不是 SZU refl。'
        : '地面和立面跟着这一秒天上的飞机走。浏览器粗核，不是 SZU refl。')
      : (usingNoiseSurrogate()
        ? '地面和立面 = 航线单位场按架次相加。只看空间格局，不作论文定量。'
        : '地面和立面是当前全部航线的累积分布。只看空间格局，不作论文定量。');
    const variant = timelineVariant();
    $('sceneScope').textContent = live
      ? (variant === 'wake' ? '尾迹 = 最近几秒的位置。' : variant === 'corridor' ? '淡走廊是全部航线，亮斑是当前机位。' : '热点来自当前这一秒天上的飞机。')
      : '机间距为任意两机三维距离。加入口只加密，不挤掉已有航线。';
  } else {
    const routesOn = $('routeToggle').checked;
    title.textContent = routesOn ? '航线 · 巡航高度' : '街区形态 · 可飞空间';
    bar.style.background = routesOn ? 'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)' : '#d8dde1';
    scale.textContent = routesOn
      ? (altitudes.length ? `${Math.min(...altitudes)} m — ${Math.max(...altitudes)} m` : '—')
      : '黑框：500 m 核心区 · 外围：缓冲区';
    $('sceneLegendNote').textContent = routesOn
      ? '800 m 外缘对穿；颜色表示巡航高度。'
      : '蓝色体块是当前侧向/纵向净空下的可飞空间。';
    $('sceneScope').textContent = '机间距为任意两机三维距离。加入口只加密，不挤掉已有航线。';
  }
  $('impactToggle').checked = noiseEnabled;
}

function setLayer(id, checked) {
  const input = $(id);
  if (input.checked !== checked) { input.checked = checked; input.dispatchEvent(new Event('change')); }
}

function applyDisplayPreset(tab) {
  // Tabs only open tools. Do not hide routes just because impact coloring is on.
  if (tab === 'settings' || tab === 'view') return;
  setLayer('buildingToggle', true);
  if (tab === 'routes') {
    setLayer('routeToggle', true);
    setLayer('aircraftToggle', true);
  }
  if (tab === 'analysis') {
    setLayer('routeToggle', true);
    setLayer('noiseToggle', true);
  }
  syncSceneLegend();
}

function syncPanelHandle() {
  const collapsed = document.body.classList.contains('panelCollapsed');
  $('controlPanel').inert = collapsed;
  $('panelToggle').setAttribute('aria-expanded', String(!collapsed));
  $('panelToggle').setAttribute('aria-label', collapsed ? '展开控制面板' : '收起控制面板');
  $('panelToggle').title = collapsed ? '展开控制面板' : '收起控制面板';
}
$('panelToggle').addEventListener('click', () => {
  document.body.classList.toggle('panelCollapsed');
  syncPanelHandle();
  drawerMotionUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 480);
});

[['viewReset', -46, 35], ['viewTop', 0, 80], ['viewSide', 0, 8]].forEach(([id, az, pitch]) => {
  $(id).addEventListener('click', () => { cameraAzimuthDeg = az; cameraPitchDeg = pitch; applyCameraAngles(); fitScene(); syncCameraControls(); });
});
$('clearFilters').addEventListener('click', () => { playOdSet = null; onPlayFilterChange(); });
$('impactToggle').addEventListener('change', e => setLayer('noiseToggle', e.target.checked));
// Keep controls in small, named pages instead of stacking a scrolling form.
const sheetSelections = {view:'overview',routes:'policy',analysis:'model'};
let selectedHeightIndex = 0;
let sheetRegistry = {};
function syncSheetNavigation() {
  if (!$('sheetNav')) return;
  const selectedAltitude = playAltSet?.size === 1 ? [...playAltSet][0] : null;
  const altitudeIndex = altitudes.indexOf(selectedAltitude);
  sheetSelections.view = altitudeIndex >= 0 ? 'single' : 'overview';
  if (altitudeIndex >= 0) selectedHeightIndex = altitudeIndex;
  const tab = document.body.dataset.view || 'routes';
  const pages = (sheetRegistry[tab] || []).filter(p =>
    (!p.capacity || routeSource === 'capacity') &&
    (!p.interactive || routeSource === 'probe') &&
    (!p.gallery || routeSource === 'gallery'));
  $('sheetNav').classList.toggle('singleSection', pages.length <= 1);
  const selected = pages.find(p => p.id === sheetSelections[tab]) || pages[0];
  const pendingCapacity = routeSource === 'capacity' && !usingCapacity();
  if ($('capacityPending')) $('capacityPending').hidden = !pendingCapacity;
  for (const id of ['playbackWrap']) if ($(id)) $(id).inert = pendingCapacity;
  $('sheetNav').replaceChildren();
  Object.values(sheetRegistry).flat().forEach(p => p.node.classList.toggle('sheetActive', p === selected));
  pages.forEach(p => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = p.label;
    button.classList.toggle('active', p === selected);
    button.setAttribute('aria-pressed', String(p === selected));
    button.addEventListener('click', () => {
      sheetSelections[tab] = p.id; syncSheetNavigation();
    });
    $('sheetNav').appendChild(button);
  });
  syncHeightPage();
}
function setSharedHeight(index) {
  if (index == null) playAltSet = null;
  else {
    selectedHeightIndex = Math.max(0, Math.min(index, altitudes.length - 1));
    playAltSet = new Set([altitudes[selectedHeightIndex]]);
  }
  onPlayFilterChange();
}

function syncHeightPage() {
  if (!$('heightSelect')) return;
  selectedHeightIndex = Math.max(0, Math.min(selectedHeightIndex, altitudes.length - 1));
  const picker = $('heightSelect');
  if (picker.dataset.heights !== altitudes.join(',')) {
    picker.replaceChildren(...altitudes.map((h,i) => new Option(`${h} m`, String(i))));
    picker.dataset.heights = altitudes.join(',');
  }
  picker.value = String(selectedHeightIndex);
  const overview = sheetSelections.view === 'overview';
  $('heightOverview').hidden = !overview;
  $('heightSingle').hidden = overview;
  const host = overview ? $('heightOverview') : $('heightSingle');
  const grid = $('mapsGrid');
  if (grid.parentElement !== host) host.appendChild(grid);
  grid.classList.toggle('allHeights', overview);
  grid.style.setProperty('--height-rows', Math.ceil(altitudes.length / 3));
  [...grid.children].forEach((el,i) => {
    el.classList.toggle('mapActive', overview || i === selectedHeightIndex);
    el.setAttribute('role', overview ? 'button' : 'group');
    el.tabIndex = overview ? 0 : -1;
    el.classList.toggle('heightSelected', Boolean(playAltSet?.has(altitudes[i])));
    if (overview) el.setAttribute('aria-pressed', String(Boolean(playAltSet?.has(altitudes[i]))));
    else el.removeAttribute('aria-pressed');
    el.setAttribute('aria-label', overview ? `${altitudes[i]} m，查看切片并筛选该高度航线` : `${altitudes[i]} m 高度切片`);
  });
  $('heightPrev').disabled = selectedHeightIndex === 0;
  $('heightNext').disabled = selectedHeightIndex === altitudes.length - 1;


}
function organizeViewPanel(pages) {
  const toolbar = document.querySelector('.workspaceTools');
  const shortcuts = document.querySelector('.viewTools');
  const panel = document.createElement('section');panel.id='viewPanel';panel.setAttribute('aria-label','视图设置');
  const header = document.createElement('div');header.className='viewPanelHeader';
  header.appendChild(shortcuts);
  const toggle = document.createElement('button');toggle.id='viewSettingsToggle';toggle.type='button';
  toggle.setAttribute('aria-controls','viewSettingsBody');toggle.setAttribute('aria-expanded','false');
  toggle.innerHTML='设置 <span aria-hidden="true">⌄</span>';header.appendChild(toggle);
  const body = document.createElement('div');body.id='viewSettingsBody';body.inert=true;
  const inner = document.createElement('div');inner.className='viewSettingsInner';
  const nav = document.createElement('nav');nav.className='viewSettingsNav';nav.setAttribute('aria-label','视图设置分区');
  const deck = document.createElement('div');deck.className='viewSettingsDeck';
  const select = index => pages.forEach((page,i) => {
    page.node.hidden=i!==index;page.button.classList.toggle('active',i===index);
    page.button.setAttribute('aria-pressed',String(i===index));
  });
  pages.forEach((page,i) => {
    page.node.classList.add('viewSettingsPage');
    page.button=document.createElement('button');page.button.type='button';page.button.textContent=page.label;
    page.button.addEventListener('click',()=>select(i));nav.appendChild(page.button);deck.appendChild(page.node);
  });
  inner.append(nav,deck);body.appendChild(inner);panel.append(header,body);toolbar.appendChild(panel);
  toolbar.appendChild(document.querySelector('.sceneLegend'));
  const setOpen = open => {
    panel.classList.toggle('expanded',open);body.inert=!open;
    toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'收起视图设置':'展开视图设置');
  };
  toggle.addEventListener('click',()=>setOpen(!panel.classList.contains('expanded')));
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);toggle.focus();}});
  select(0);setOpen(false);
}

function organizePanelPages() {
  const panel = $('controlPanel');
  const spatial = document.querySelector('[data-panel="view"]');
  const analysis = document.querySelector('[data-panel="analysis"]');
  const policy = $('policyWrap');

  // 限定在视图面板内查找：净空规则 sheet 里也有一份 .layerList，全局 query 会选错
  const layers = spatial.querySelector('.layerList').closest('.controlGroup');
  const settingsSource = spatial.querySelector('details');
  const settingsFields = [...settingsSource.querySelector('.controlGrid').children];
  const cameraPage = document.createElement('div'), lightPage = document.createElement('div');
  cameraPage.innerHTML = '<div class="settingsGrid"></div>';
  lightPage.innerHTML = '<div class="settingsGrid"></div>';
  layers.prepend(settingsFields[0]);
  settingsFields.slice(1).forEach((field,i) => (i < 2 ? cameraPage : lightPage).querySelector('.settingsGrid').appendChild(field));
  settingsSource.remove();
  const probeDetails = analysis.querySelector('details');
  const probe = probeDetails.querySelector('.detailsBody');probeDetails.replaceWith(probe);
  const model = $('noiseV2Wrap').closest('.controlGroup');
  const maps = $('spaceMaps');
  const overview = document.createElement('div');overview.id='heightOverview';
  const single = document.createElement('div');single.id='heightSingle';
  const grid = $('mapsGrid');overview.appendChild(grid);
  // Retain the existing metric target for the compute pipeline; visible metrics stay beside maps.
  const legacyMetrics = $('altLegend');legacyMetrics.hidden = true;panel.appendChild(legacyMetrics);
  maps.remove();
  const heightNav = document.createElement('div');heightNav.className='heightNav';
  heightNav.innerHTML = '<button id="heightPrev" aria-label="上一个高度">‹</button><select id="heightSelect" aria-label="查看高度"></select><button id="heightNext" aria-label="下一个高度">›</button>';
  const back = document.createElement('button');back.id='heightBack';back.type='button';back.textContent='‹ 返回';back.setAttribute('aria-label','返回全部高度');
  back.addEventListener('click',()=>{setSharedHeight(null);grid.children[selectedHeightIndex]?.focus({preventScroll:true});});
  single.append(back,heightNav);
  const selectHeight = i => {setSharedHeight(i);$('heightBack').focus({preventScroll:true});};
  grid.addEventListener('click',e => {const tile=e.target.closest('.mapTile');if(tile) selectHeight([...grid.children].indexOf(tile));});
  grid.addEventListener('keydown',e => {if(e.key==='Enter'||e.key===' '){const tile=e.target.closest('.mapTile');if(tile){e.preventDefault();selectHeight([...grid.children].indexOf(tile));}}});
  function add(tab,id,label,node,capacity=false,interactive=false,gallery=false) {
    node.classList.add('deckSheet');node.dataset.sheet=id;
    (sheetRegistry[tab] ||= []).push({id,label,node,capacity,interactive,gallery});
    document.querySelector(`[data-panel="${tab}"]`).appendChild(node);
  }
  const heightPage = document.createElement('div');heightPage.id='heightPage';
  heightPage.append(overview, single);
  add('routes','height','高度地图',heightPage);
  const pending = document.createElement('p');pending.id='capacityPending';pending.className='sub';pending.textContent='正在准备排班航线…';$('playbackWrap').prepend(pending);
  heightPage.appendChild($('playbackWrap'));
  add('routes','policy','净空规则',policy);
  add('analysis','model','影响模型',model);add('analysis','probe','点位取样',probe);
  organizeViewPanel([{label:'图层',node:layers},{label:'视角',node:cameraPage},{label:'光照',node:lightPage}]);
  spatial.remove();
  const nav=document.createElement('nav');nav.id='sheetNav';nav.setAttribute('aria-label','面板分区');
  $('tabBar').after(nav);
  const deck=document.createElement('div');deck.id='panelDeck';nav.after(deck);
  document.querySelectorAll('.tabPanel').forEach(p => deck.appendChild(p));

  $('heightSelect').addEventListener('change',e => {setSharedHeight(+e.target.value);});
  $('heightPrev').addEventListener('click',()=>{setSharedHeight(selectedHeightIndex - 1);});
  $('heightNext').addEventListener('click',()=>{setSharedHeight(selectedHeightIndex + 1);});
  syncSheetNavigation();
  syncPlayFilterUI();
}
organizePanelPages();

// ---- 净空规则对照：矩阵、旋钮、状态行 ----
function galleryCellTitle(tag, pkgId) {
  const cell = galleryCells?.get(`${tag}_${pkgId}`) || null;
  const place = GALLERY_PLACES.find(p => p.tag === tag);
  const block = BLOCKS.find(b => b.id === place?.sandboxId);
  const label = cell ? galleryPackageLabel(cell) : '—';
  const kind = GALLERY_KIND_LABEL[galleryOutcome(cell)];
  const cap = cell?.capacity_per_hour != null ? ` · ${Math.round(cell.capacity_per_hour).toLocaleString('en-US')} 架次/时` : '';
  return `${block?.name || tag} · 净空 ${label} · ${kind}${cap}`;
}

function buildGalleryMatrix() {
  const root = $('galleryMatrix');
  if (!root || root.dataset.ready) return;
  const head = document.createElement('div');
  head.className = 'galleryRow galleryHead';
  head.appendChild(document.createElement('span'));
  for (const pkg of GALLERY_PACKAGES) {
    const span = document.createElement('span');
    const cell = galleryCells?.get(`${GALLERY_PLACES[0].tag}_${pkg}`);
    span.textContent = cell ? galleryPackageLabel(cell) : '—';
    head.appendChild(span);
  }
  root.appendChild(head);
  for (const place of GALLERY_PLACES) {
    const row = document.createElement('div');
    row.className = 'galleryRow';
    const lab = document.createElement('button');
    lab.type = 'button';
    lab.className = 'galleryLab';
    lab.dataset.row = place.tag;
    lab.textContent = place.label;
    lab.title = `加载 ${BLOCKS.find(b => b.id === place.sandboxId)?.name || place.tag}`;
    lab.setAttribute('aria-label', lab.title);
    lab.addEventListener('click', () => {
      const block = BLOCKS.find(b => b.id === place.sandboxId);
      if (block) { routeSourcePreference = 'gallery'; loadPreset(block.name); }
    });
    row.appendChild(lab);
    for (const pkg of GALLERY_PACKAGES) {
      const cellBtn = document.createElement('button');
      cellBtn.type = 'button';
      cellBtn.className = 'galleryCell';
      cellBtn.dataset.cell = `${place.tag}|${pkg}`;
      cellBtn.addEventListener('click', () => selectGalleryCell(place.tag, pkg));
      row.appendChild(cellBtn);
    }
    root.appendChild(row);
  }
  root.dataset.ready = '1';
  paintGalleryMatrix();
}

function paintGalleryMatrix() {
  const root = $('galleryMatrix');
  if (!root || !root.dataset.ready) return;
  const curTag = galleryTagForBlock(currentBlock);
  for (const btn of root.querySelectorAll('[data-cell]')) {
    const [tag, pkgId] = btn.dataset.cell.split('|');
    const cell = galleryCells?.get(`${tag}_${pkgId}`) || null;
    btn.dataset.kind = galleryOutcome(cell);
    const matched = Boolean(cell) && tag === curTag &&
      Number(cell.d_obs) === galleryParams.d &&
      cell.building_metric === galleryParams.metric &&
      Number(cell.pedestrian_clearance_m) === galleryParams.pedestrianM;
    btn.classList.toggle('on', matched);
    const title = galleryCellTitle(tag, pkgId);
    btn.title = title;
    btn.setAttribute('aria-label', title);
  }
  for (const el of root.querySelectorAll('.galleryLab')) el.classList.toggle('on', el.dataset.row === curTag);
}

function writeGalleryStatus(cell) {
  const el = $('galleryStatus');
  if (!el) return;
  const kind = galleryOutcome(cell);
  el.dataset.kind = kind;
  const cap = cell?.capacity_per_hour != null ? `${Math.round(cell.capacity_per_hour).toLocaleString('en-US')} 架次/时` : '—';
  el.textContent = cell ? `${GALLERY_KIND_LABEL[kind]} · ${cap}` : `自定义 · ${galleryRuleText()} · ${cap}`;
}

function syncGalleryControls() {
  const dEl = $('galleryD'), dV = $('galleryDV');
  if (dEl) dEl.value = String(galleryParams.d);
  if (dV) dV.textContent = String(galleryParams.d);
  const pedEl = $('galleryPed'), pedV = $('galleryPedV');
  if (pedEl) pedEl.value = String(galleryParams.pedestrianM);
  if (pedV) pedV.textContent = galleryParams.pedestrianM > 0 ? `${galleryParams.pedestrianM} m` : '关';
  const chips = $('galleryMetricChips');
  if (chips) for (const b of chips.querySelectorAll('button')) b.classList.toggle('on', b.dataset.metric === galleryParams.metric);
}

// 切到净空规则模式（不重建建筑；换街区仍走 loadPreset）
function enterGalleryMode() {
  const switched = routeSource !== 'gallery';
  routeSource = 'gallery';
  routeSourcePreference = 'gallery';
  const input = document.querySelector('input[name="routeSource"][value="gallery"]');
  if (input && !input.checked) input.checked = true;
  sheetSelections.routes = 'gallery';
  if (switched) { playAltSet = null; syncRouteSourceUI(); syncPlaybackUI(); syncSceneLegend(); }
}

// live = 拖动滑块中：读数/高亮立刻跟手，重活（外扩、体块、航线）等停手 220 ms 再做
function setGalleryParams(patch, live = false) {
  galleryParams = { ...galleryParams, ...patch };
  syncGalleryControls();
  gallerySliceCache.clear();
  paintGalleryMatrix();
  writeGalleryStatus(galleryCellFor(galleryTagForBlock(currentBlock)));
  enterGalleryMode();
  clearTimeout(galleryComputeTimer);
  if (live) {
    galleryComputeTimer = setTimeout(() => { drawGalleryKeepAway(); scheduleCompute(); }, 220);
    return;
  }
  scheduleCompute();
}

function selectGalleryCell(tag, pkg) {
  const cell = galleryCells?.get(`${tag}_${pkg}`);
  if (!cell) return;
  galleryParams = {
    d: Number(cell.d_obs),
    metric: cell.building_metric || 'euclidean_3d',
    pedestrianM: Number(cell.pedestrian_clearance_m || 0),
  };
  syncGalleryControls();
  enterGalleryMode();
  gallerySliceCache.clear();
  paintGalleryMatrix();
  const place = GALLERY_PLACES.find(p => p.tag === tag);
  if (tag !== galleryTagForBlock(currentBlock) && place) {
    const block = BLOCKS.find(b => b.id === place.sandboxId);
    if (block) { loadPreset(block.name); return; }
  }
  scheduleCompute();
}

function setFlyableVolumeVisible(v) {
  flyableVolumeVisible = v;
  const a = $('flyableVolumeToggle');
  if (a && a.checked !== v) a.checked = v;
  rebuildFlyableVolume();
}

$('policyLat').addEventListener('input', e => setPolicyParams({ lat: +e.target.value }, true));
$('policyVert').addEventListener('input', e => setPolicyParams({ vert: +e.target.value }, true));
$('policySep').addEventListener('input', e => setPolicyParams({ uavSep: +e.target.value }, true));
$('policyPresets').addEventListener('click', e => {
  const btn = e.target.closest('button[data-lat]');
  if (!btn) return;
  setPolicyParams({ lat: +btn.dataset.lat, vert: +btn.dataset.vert });
});

document.querySelectorAll('#controlPanel input, #viewPanel input').forEach(input => input.addEventListener('change', syncSceneLegend));
if (window.innerWidth <= 600) document.body.classList.add('panelCollapsed');
syncPanelHandle();
syncPolicyControls();

function readImpactTimeMode() {
  const q = new URLSearchParams(location.search).get('impact');
  if (q === 'live' || q === 'total') return q;
  return timelineVariant() ? 'live' : 'total';
}

function syncImpactTimeUI() {
  document.querySelectorAll('input[name="impactTime"]').forEach(input => {
    input.checked = input.value === impactTimeMode;
  });
  if ($('impactTimeV')) $('impactTimeV').textContent = impactTimeMode === 'live' ? '瞬时' : '区域总量';
  const bar = $('protoBar');
  if (bar) {
    bar.querySelectorAll('button[data-impact]').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.impact === impactTimeMode);
    });
    bar.querySelectorAll('button[data-variant]').forEach(btn => {
      btn.classList.toggle('dim', impactTimeMode !== 'live');
      btn.classList.toggle('on', impactTimeMode === 'live' && btn.dataset.variant === (timelineVariant() || 'instant'));
    });
  }
}

function setImpactTimeMode(mode) {
  if (mode !== 'live' && mode !== 'total') return;
  impactTimeMode = mode;
  const url = new URL(location.href);
  url.searchParams.set('impact', mode);
  if (mode === 'live' && !timelineVariant()) url.searchParams.set('variant', 'instant');
  history.replaceState({}, '', url);
  syncImpactTimeUI();
  applyImpactTimeMode();
  syncSceneLegend();
}

function applyImpactTimeMode() {
  syncImpactTimeUI();
  if (!noiseEnabled) {
    disposeTimelineHeat();
    disposeLiveFacades();
    setNoiseLayerVisible(false);
    return;
  }
  if (impactTimeMode === 'total') {
    disposeTimelineHeat();
    disposeLiveFacades();
    scheduleExternalityLayer();
  } else {
    clearNoiseLayer();
    ensureTimelineHeat();
    ensureLiveFacades();
    paintTimelineHeat(true);
  }
  if ($('filterSummary') && timelineVariant()) {
    $('filterSummary').textContent = impactTimeMode === 'live'
      ? '原型 · 全部航线 · 瞬时影响（非 SZU refl）'
      : '原型 · 全部航线 · 区域总量（非 SZU refl）';
  }
  syncSceneLegend();
}

function disposeLiveFacades() {
  if (!liveFacadeGroup) return;
  for (const child of liveFacadeGroup.children) {
    child.geometry?.dispose();
    child.material?.dispose();
  }
  liveFacadeGroup.clear();
  scene.remove(liveFacadeGroup);
  liveFacadeGroup = null;
  liveFacades = null;
}

function ensureLiveFacades() {
  if (liveFacades && liveFacades.length) {
    liveFacadeGroup.visible = true;
    return;
  }
  disposeLiveFacades();
  liveFacadeGroup = new THREE.Group();
  liveFacadeGroup.renderOrder = 5;
  scene.add(liveFacadeGroup);
  liveFacades = [];
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
      const lx = pos.getX(i) + normal.getX(i) * 0.45;
      const ly = pos.getY(i) + normal.getY(i) * 0.45;
      const lz = pos.getZ(i) + normal.getZ(i) * 0.45;
      pos.setXYZ(i, lx, ly, lz);
      world[i * 3] = lx + bx;
      world[i * 3 + 1] = ly + by;
      world[i * 3 + 2] = lz + bz;
    }
    pos.needsUpdate = true;
    geom.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    const mesh = new THREE.Mesh(geom, noiseMat.clone());
    mesh.position.set(bx, by, bz);
    mesh.renderOrder = 5;
    liveFacadeGroup.add(mesh);
    liveFacades.push({ mesh, world, count });
  }
  if (usingNoiseSurrogate()) {
    for (const item of liveFacades) bindFacadeLutIndices(item);
  }
}

function liveNoiseSegments(poses) {
  const segs = [];
  const pushPose = (p, amp) => {
    segs.push({
      a: new THREE.Vector3(p.x - 8, p.y, p.z),
      b: new THREE.Vector3(p.x + 8, p.y, p.z),
      amp, dirX: 1, dirZ: 0, alt: p.y,
    });
  };
  const variant = timelineVariant() || 'instant';
  if (variant === 'corridor') {
    const routes = flightRoutes || [];
    const per = Math.max(3, Math.floor(36 / Math.max(1, routes.length)));
    for (const route of routes) {
      const pts = route.p || [];
      const step = Math.max(1, Math.floor(pts.length / per));
      for (let i = 0; i < pts.length; i += step) {
        const x = pts[i][0], y = pts[i][2], z = -pts[i][1];
        segs.push({
          a: new THREE.Vector3(x - 6, y, z),
          b: new THREE.Vector3(x + 6, y, z),
          amp: 0.18, dirX: 1, dirZ: 0, alt: y,
        });
      }
    }
  }
  if (variant === 'wake') {
    for (let i = 0; i < timelineWake.length; i++) {
      const age = 1 - i / Math.max(1, timelineWake.length);
      for (const p of capPoses(timelineWake[i], 28)) pushPose(p, 0.28 + 0.72 * age);
    }
  }
  for (const p of capPoses(poses, 36)) pushPose(p, variant === 'corridor' ? 1.35 : 1);
  return segs;
}

function timelineVariant() {
  const q = new URLSearchParams(location.search).get('variant');
  return q === 'instant' || q === 'wake' || q === 'corridor' ? q : null;
}

function setTimelineVariant(name) {
  const url = new URL(location.href);
  url.searchParams.set('variant', name);
  url.searchParams.set('impact', 'live');
  history.replaceState({}, '', url);
  impactTimeMode = 'live';
  syncImpactTimeUI();
  const bar = $('protoBar');
  if (bar) bar.classList.add('on');
  if (timelinePinned && noiseEnabled) {
    ensureTimelineHeat();
    ensureLiveFacades();
    paintTimelineHeat(true);
    syncSceneLegend();
    return;
  }
  applyTimelinePrototype();
  applyImpactTimeMode();
  syncPlaybackUI();
}

function disposeTimelineHeat() {
  if (!timelineHeatMesh) return;
  noiseGroup.remove(timelineHeatMesh);
  timelineHeatMesh.geometry.dispose();
  timelineHeatMesh.material.dispose();
  timelineHeatMesh = null;
  timelineHeatColors = null;
  timelineHeatPos = null;
  timelineWake = [];
}

function ensureTimelineHeat() {
  if (timelineHeatMesh) return;
  const n = NOISE_GRID;
  const positions = [];
  const indices = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = -CORE_HALF + CORE_DOMAIN * i / n;
      const z = -CORE_HALF + CORE_DOMAIN * j / n;
      positions.push(x, terrainVisualHeight(x, z) + 0.55, z);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      indices.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1);
    }
  }
  const colors = new Float32Array(positions.length);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  timelineHeatMesh = new THREE.Mesh(geom, noiseMat.clone());
  timelineHeatMesh.renderOrder = 4;
  noiseGroup.add(timelineHeatMesh);
  timelineHeatPos = geom.getAttribute('position');
  timelineHeatColors = geom.getAttribute('color');
}

function timelineAircraftPoses() {
  if (!flightRoutes?.length || !flightData) return [];
  const out = [];
  for (const f of flightData.flights || []) {
    const u = flightProgress(f[1], f[2]);
    if (u == null) continue;
    const route = flightRoutes[f[0]];
    if (!route || route.p.length < 2) continue;
    const p = atFlightRoute(route, u);
    out.push({ x: p[0], y: p[2], z: -p[1] });
  }
  return out;
}

function capPoses(poses, maxN) {
  if (poses.length <= maxN) return poses;
  const step = Math.ceil(poses.length / maxN);
  return poses.filter((_, i) => i % step === 0);
}

function paintTimelineHeat(force) {
  if (impactTimeMode !== 'live' || !timelineHeatMesh || !timelineHeatColors || !timelineHeatPos) return;
  if (!force && timelineLastPaintT >= 0 && Math.abs(playbackT - timelineLastPaintT) < 0.22) return;
  timelineLastPaintT = playbackT;
  const poses = timelineAircraftPoses();
  if (poses.length) {
    if (timelineLastSimT == null || Math.abs(playbackT - timelineLastSimT) > 0.35) {
      timelineWake.push(poses.map(p => ({ ...p })));
      if (timelineWake.length > 14) timelineWake.shift();
      timelineLastSimT = playbackT;
    }
  }
  const channel = CHANNELS[externalityChannel] || CHANNELS.noise;
  const n = timelineHeatPos.count;
  const groundVals = new Float32Array(n);
  let peak = 1e-12;
  if (usingNoiseSurrogate()) {
    const lutPoses = [];
    const variant = timelineVariant() || 'instant';
    if (variant === 'corridor') {
      for (const route of flightRoutes || []) {
        const pts = route.p || [];
        const step = Math.max(1, Math.floor(pts.length / Math.max(3, Math.floor(36 / Math.max(1, (flightRoutes || []).length)))));
        for (let i = 0; i < pts.length; i += step) {
          lutPoses.push({ x: pts[i][0], y: pts[i][2], z: -pts[i][1], amp: 0.18 });
        }
      }
    }
    if (variant === 'wake') {
      for (let i = 0; i < timelineWake.length; i++) {
        const age = 1 - i / Math.max(1, timelineWake.length);
        for (const p of capPoses(timelineWake[i], 28)) lutPoses.push({ ...p, amp: 0.28 + 0.72 * age });
      }
    }
    for (const p of capPoses(poses, 36)) lutPoses.push({ ...p, amp: variant === 'corridor' ? 1.35 : 1 });
    if (!lutPoses.length) return;
    const { gAcc, fAcc } = composeSurrogateFromPoses(lutPoses);
    for (let i = 0; i < n; i++) {
      const v = gAcc[i] * channel.ground;
      groundVals[i] = v;
      if (v > peak) peak = v;
    }
    if (liveFacades) {
      for (const f of liveFacades) {
        if (!f.lutIndex) bindFacadeLutIndices(f);
        f.vals = f.vals || new Float32Array(f.count);
        for (let i = 0; i < f.count; i++) {
          const v = fAcc[f.lutIndex[i]] * channel.facade;
          f.vals[i] = v;
          if (v > peak) peak = v;
        }
      }
    }
  } else {
    const segs = liveNoiseSegments(poses);
    if (!segs.length) return;
    for (let i = 0; i < n; i++) {
      const v = noiseAt(timelineHeatPos.getX(i), timelineHeatPos.getY(i), timelineHeatPos.getZ(i), segs) * channel.ground;
      groundVals[i] = v;
      if (v > peak) peak = v;
    }
    if (liveFacades) {
      for (const f of liveFacades) {
        f.vals = f.vals || new Float32Array(f.count);
        const step = Math.max(1, Math.floor(f.count / 36));
        for (let i = 0; i < f.count; i += step) {
          const v = noiseAt(f.world[i * 3], f.world[i * 3 + 1], f.world[i * 3 + 2], segs) * channel.facade;
          const until = Math.min(f.count, i + step);
          for (let k = i; k < until; k++) f.vals[k] = v;
          if (v > peak) peak = v;
        }
      }
    }
  }
  const norm = Math.max(1e-9, peak * 0.72);
  for (let i = 0; i < n; i++) {
    const t = Math.log1p(groundVals[i] / norm * 3.2) / Math.log1p(3.2);
    const c = colorRamp(t, channel.palette);
    timelineHeatColors.setXYZ(i, c[0], c[1], c[2]);
  }
  timelineHeatColors.needsUpdate = true;
  if (liveFacades) {
    for (const f of liveFacades) {
      const col = f.mesh.geometry.getAttribute('color');
      for (let i = 0; i < f.count; i++) {
        const t = Math.log1p(f.vals[i] / norm * 3.2) / Math.log1p(3.2);
        const c = colorRamp(0.10 + 0.90 * Math.min(1, t), channel.palette);
        col.setXYZ(i, c[0], c[1], c[2]);
      }
      col.needsUpdate = true;
    }
  }
  void force;
}

function applyTimelinePrototype() {
  const variant = timelineVariant();
  const bar = $('protoBar');
  if (bar) {
    bar.classList.toggle('on', Boolean(variant) || impactTimeMode === 'live');
  }
  syncImpactTimeUI();
  if (!variant) {
    timelinePinned = false;
    return;
  }
  if (!routeSummaries.some(s => (s.paths || []).length)) return;
  timelinePinned = true;
  rebuildRouteMeshes();
  buildLiveFlightsFromSummaries();
  updateMetrics();
  const nAir = flightData?.n_flights || 0;
  noiseEnabled = true;
  if ($('noiseToggle')) $('noiseToggle').checked = true;
  if ($('impactToggle')) $('impactToggle').checked = true;
  setPlaybackPlaying(true);
  playbackT = 0;
  timelineWake = [];
  timelineLastSimT = null;
  if ($('filterSummary')) {
    $('filterSummary').textContent = impactTimeMode === 'live'
      ? '原型 · 全部航线 · 瞬时影响（非 SZU refl）'
      : '原型 · 全部航线 · 区域总量（非 SZU refl）';
  }
  syncAirThroughputHud(nAir);
  setPlaybackTime(0);
}

const LISTEN_EYE = 1.6;
const LISTEN_SPEED = 6;
const LISTEN_STEP = 0.45;
const LISTEN_RANGE = 220;
const LISTEN_RANGE2 = LISTEN_RANGE * LISTEN_RANGE;
const LISTEN_REF = 1 / (420 + 30 * 30);
const LISTEN_VOICES = 10;
const LISTEN_SKINS = {
  open: { db: 0, hz: 12000, label: '无遮挡' },
  single: { db: -6, hz: 2800, label: '单层玻璃' },
  double: { db: -12, hz: 1600, label: '双层玻璃' },
  multi: { db: -18, hz: 1000, label: '多层玻璃' },
  wall: { db: -26, hz: 520, label: '墙面' },
};

let listenMode = null;
let listenArmed = false;
let listenFeet = new THREE.Vector3();
let listenVy = 0;
let listenYaw = 0;
let listenPitch = 0;
let listenSkin = 'open';
let listenDrag = null;
let listenKeys = new Set();
let listenSavedCam = null;
let listenSavedRate = null;
let listenAudio = null;
let listenPrevCraft = new Map();
let listenPrevEar = new THREE.Vector3();
let listenStatusAt = 0;
let listenHaveEar = false;

function listenDbToGain(db) {
  return 10 ** (db / 20);
}

function softenListen(x) {
  const knee = 2.2;
  if (x <= knee) return x;
  return knee + (x - knee) / (1 + (x - knee) / 1.4);
}

function buildingTopY(b) {
  return b.group.position.y + Math.max(1, b.h - b.minH);
}

function listenInsideFootprint(b, x, z) {
  return pointInPoly(x - b.x, z - b.z, b.localPoly);
}

function listenSolidAt(x, z, feetY) {
  if (Math.abs(x) > HALF - 0.8 || Math.abs(z) > HALF - 0.8) return true;
  const terr = terrainVisualHeight(x, z);
  if (terr > feetY + LISTEN_STEP) return true;
  for (const b of buildings) {
    if (!b.group || b.group.visible === false || !b.localPoly) continue;
    const top = buildingTopY(b);
    if (top <= feetY + LISTEN_STEP) continue;
    if (listenInsideFootprint(b, x, z)) return true;
  }
  return false;
}

function listenBlocked(x, z, feetY) {
  const r = 0.36;
  return listenSolidAt(x, z, feetY)
    || listenSolidAt(x + r, z, feetY)
    || listenSolidAt(x - r, z, feetY)
    || listenSolidAt(x, z + r, feetY)
    || listenSolidAt(x, z - r, feetY);
}

function listenSupportY(x, z, feetY, falling) {
  const limit = falling ? feetY + 0.05 : feetY + LISTEN_STEP;
  let y = terrainVisualHeight(x, z);
  if (y > limit) y = -1e9;
  for (const b of buildings) {
    if (!b.group || b.group.visible === false || !b.localPoly) continue;
    if (!listenInsideFootprint(b, x, z)) continue;
    const top = buildingTopY(b);
    if (top <= limit && top > y) y = top;
  }
  if (y < -1e8) return terrainVisualHeight(x, z);
  return y;
}

function craftKernel(px, py, pz, c) {
  const dx = px - c.x;
  const dy = py - c.y;
  const dz = pz - c.z;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > LISTEN_RANGE2) return 0;
  const iy = -Math.abs(c.y);
  const d2r = dx * dx + (py - iy) ** 2 + dz * dz;
  return 1 / (420 + d2) + 0.47 / (420 + d2r);
}

function buildDroneLoop(ctx) {
  const sr = ctx.sampleRate;
  const dur = 0.5;
  const n = Math.round(sr * dur);
  const data = new Float32Array(n);
  const f0 = 40;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const phase = 2 * Math.PI * f0 * t;
    let s = 0.34 * Math.sin(phase * 2);
    s += 0.28 * Math.sin(phase * 3 + 0.4);
    s += 0.18 * Math.sin(phase * 4 + 0.8);
    s += 0.1 * Math.sin(phase * 5);
    s += 0.06 * Math.sin(phase * 8);
    s += 0.05 * Math.sin(phase * 18);
    const nphase = 2 * Math.PI * i / n;
    s += 0.08 * Math.sin(nphase * 47);
    s += 0.05 * Math.sin(nphase * 73 + 1.2);
    s += 0.04 * Math.sin(nphase * 110 + 0.4);
    s += 0.03 * Math.sin(nphase * 160);
    data[i] = s;
  }
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
  const scale = 0.55 / peak;
  for (let i = 0; i < n; i++) data[i] *= scale;
  const buf = ctx.createBuffer(1, n, sr);
  buf.copyToChannel(data, 0);
  return buf;
}

function ensureListenAudio() {
  if (listenAudio) return listenAudio;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const buf = buildDroneLoop(ctx);
  const sum = ctx.createGain();
  const skinFilter = ctx.createBiquadFilter();
  skinFilter.type = 'lowpass';
  skinFilter.frequency.value = 12000;
  skinFilter.Q.value = 0.7;
  const skinGain = ctx.createGain();
  const userGain = ctx.createGain();
  userGain.gain.value = 0.4;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 8;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.12;
  sum.connect(skinFilter);
  skinFilter.connect(skinGain);
  skinGain.connect(userGain);
  userGain.connect(limiter);
  limiter.connect(ctx.destination);
  const voices = [];
  for (let i = 0; i < LISTEN_VOICES; i++) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 1;
    p.maxDistance = 10000;
    p.rolloffFactor = 0;
    src.connect(g);
    g.connect(p);
    p.connect(sum);
    src.start();
    voices.push({ src, gain: g, panner: p, id: null });
  }
  const bedSrc = ctx.createBufferSource();
  bedSrc.buffer = buf;
  bedSrc.loop = true;
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0;
  bedSrc.connect(bedGain);
  bedGain.connect(sum);
  bedSrc.start();
  listenAudio = { ctx, voices, bedGain, skinFilter, skinGain, userGain };
  return listenAudio;
}

function driveListenParam(param, value) {
  const now = listenAudio.ctx.currentTime;
  param.cancelScheduledValues(now);
  try {
    param.setValueAtTime(value, now);
  } catch (err) {
    param.value = value;
  }
}

function silenceListenAudio() {
  const audio = listenAudio;
  if (!audio) return;
  for (const v of audio.voices) {
    v.id = null;
    driveListenParam(v.gain.gain, 0);
    driveListenParam(v.src.playbackRate, 1);
  }
  driveListenParam(audio.bedGain.gain, 0);
  if (audio.ctx.state === 'running') audio.ctx.suspend().catch(() => {});
}

function setListenUserGain(v) {
  const audio = listenAudio;
  if (!audio) return;
  driveListenParam(audio.userGain.gain, (Number(v) || 0) / 100);
}

function applyListenSkin() {
  const audio = listenAudio;
  const skin = LISTEN_SKINS[listenMode === 'facade' ? listenSkin : 'open'] || LISTEN_SKINS.open;
  if (!audio) return skin;
  driveListenParam(audio.skinGain.gain, listenDbToGain(skin.db));
  driveListenParam(audio.skinFilter.frequency, skin.hz);
  return skin;
}

function syncListenSkinButtons() {
  const row = $('listenSkin');
  if (!row) return;
  const show = listenMode === 'facade';
  row.hidden = !show;
  row.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.skin === listenSkin);
  });
}

function syncListenChrome() {
  const hud = $('listenHud');
  const arm = $('listenArm');
  const hint = document.querySelector('.sceneHint');
  if (hud) hud.hidden = !listenMode;
  if (arm) {
    arm.classList.toggle('on', listenArmed || Boolean(listenMode));
    arm.textContent = listenMode ? '退出听声' : (listenArmed ? '取消选点' : '站到这里听');
  }
  if (hint) {
    if (listenMode === 'facade') hint.textContent = '拖动转头 · Esc 退出 · 隔声档只改变这一点的声音';
    else if (listenMode === 'walk') hint.textContent = 'WASD 行走 · 拖动转头 · 走下屋顶会落下 · Esc 退出';
    else if (listenArmed) hint.textContent = '点击屋顶、街道或立面，站到那里听';
    else hint.textContent = '拖动旋转 · 滚轮缩放 · 黑框为 500 m 研究区';
  }
  const help = $('listenHelp');
  if (help) {
    help.textContent = listenMode === 'facade'
      ? '人钉在墙外。无遮挡是满响度；玻璃和墙把整段声音一起减弱。'
      : '人可以走。约 220 米以外的飞机不计入。耳机里最响的 10 架有方位。';
  }
  syncListenSkinButtons();
}

function exitListen() {
  if (!listenMode && !listenArmed && !listenSavedCam) {
    listenArmed = false;
    syncListenChrome();
    return;
  }
  listenMode = null;
  listenArmed = false;
  listenVy = 0;
  listenKeys.clear();
  listenDrag = null;
  listenHaveEar = false;
  listenPrevCraft.clear();
  silenceListenAudio();
  if (listenSavedCam) {
    camera.position.copy(listenSavedCam.pos);
    camera.quaternion.copy(listenSavedCam.quat);
    camera.fov = listenSavedCam.fov;
    camera.near = listenSavedCam.near;
    camera.updateProjectionMatrix();
    listenSavedCam = null;
  }
  if (listenSavedRate != null) {
    setPlaybackRate(listenSavedRate);
    listenSavedRate = null;
  }
  controls.enabled = true;
  controls.target.copy(ORBIT_TARGET);
  controls.update();
  syncListenChrome();
}

function enterListen(hit) {
  const n = hit.face
    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
    : new THREE.Vector3(0, 1, 0);
  const facade = Math.abs(n.y) < 0.62 && !listenHitIsGround(hit.object);
  if (!listenSavedCam) {
    listenSavedCam = {
      pos: camera.position.clone(),
      quat: camera.quaternion.clone(),
      fov: camera.fov,
      near: camera.near,
    };
  }
  camera.fov = 72;
  camera.near = 0.12;
  camera.updateProjectionMatrix();
  controls.enabled = false;
  listenArmed = false;
  listenVy = 0;
  listenPitch = 0;
  listenSkin = 'open';
  if (facade) {
    listenMode = 'facade';
    const outward = n.clone();
    outward.y = 0;
    if (outward.lengthSq() < 1e-6) outward.set(1, 0, 0);
    outward.normalize();
    const host = buildings.find(item => item.box === hit.object);
    if (host && listenInsideFootprint(host, hit.point.x + outward.x * 0.8, hit.point.z + outward.z * 0.8)) {
      outward.multiplyScalar(-1);
    }
    let stand = 0.55;
    if (host) {
      while (stand < 4 && listenInsideFootprint(host, hit.point.x + outward.x * stand, hit.point.z + outward.z * stand)) {
        stand += 0.4;
      }
    }
    listenFeet.set(
      hit.point.x + outward.x * stand,
      Math.max(hit.point.y, terrainVisualHeight(hit.point.x, hit.point.z) + 1.2),
      hit.point.z + outward.z * stand
    );
    listenYaw = Math.atan2(outward.x, -outward.z);
  } else {
    listenMode = 'walk';
    const x = hit.point.x;
    const z = hit.point.z;
    listenFeet.set(x, listenSupportY(x, z, hit.point.y + 0.2, false), z);
    listenYaw = Math.atan2(-x, z);
  }
  const audio = ensureListenAudio();
  if (audio && audio.ctx.state === 'suspended') audio.ctx.resume();
  setListenUserGain($('listenGain') ? $('listenGain').value : 40);
  applyListenSkin();
  if (!playbackPlaying) setPlaybackPlaying(true);
  if (listenSavedRate == null) listenSavedRate = playbackRate;
  setPlaybackRate(1);
  listenPrevCraft.clear();
  listenHaveEar = false;
  syncListenChrome();
  updateListenCamera();
  listenStatusAt = -1;
  updateListen(0.016, 0);
}

function updateListenMotion(dt) {
  if (listenMode !== 'walk') return;
  const fx = Math.sin(listenYaw);
  const fz = -Math.cos(listenYaw);
  const rx = Math.cos(listenYaw);
  const rz = Math.sin(listenYaw);
  let mx = 0;
  let mz = 0;
  if (listenKeys.has('KeyW') || listenKeys.has('ArrowUp')) { mx += fx; mz += fz; }
  if (listenKeys.has('KeyS') || listenKeys.has('ArrowDown')) { mx -= fx; mz -= fz; }
  if (listenKeys.has('KeyD') || listenKeys.has('ArrowRight')) { mx += rx; mz += rz; }
  if (listenKeys.has('KeyA') || listenKeys.has('ArrowLeft')) { mx -= rx; mz -= rz; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    const step = LISTEN_SPEED * dt / len;
    const nx = listenFeet.x + mx * step;
    const nz = listenFeet.z + mz * step;
    if (!listenBlocked(nx, nz, listenFeet.y)) {
      listenFeet.x = nx;
      listenFeet.z = nz;
    } else if (!listenBlocked(nx, listenFeet.z, listenFeet.y)) {
      listenFeet.x = nx;
    } else if (!listenBlocked(listenFeet.x, nz, listenFeet.y)) {
      listenFeet.z = nz;
    }
  }
  listenFeet.x = Math.max(-HALF + 0.8, Math.min(HALF - 0.8, listenFeet.x));
  listenFeet.z = Math.max(-HALF + 0.8, Math.min(HALF - 0.8, listenFeet.z));
  const drop = listenSupportY(listenFeet.x, listenFeet.z, listenFeet.y, true);
  if (listenFeet.y > drop + 0.12) {
    listenVy -= 9.8 * dt;
    listenFeet.y += listenVy * dt;
    if (listenFeet.y <= drop) {
      listenFeet.y = drop;
      listenVy = 0;
    }
  } else {
    listenVy = 0;
    listenFeet.y = listenSupportY(listenFeet.x, listenFeet.z, listenFeet.y, false);
  }
}

function listenEarPosition() {
  if (listenMode === 'facade') return listenFeet.clone();
  return new THREE.Vector3(listenFeet.x, listenFeet.y + LISTEN_EYE, listenFeet.z);
}

function setPannerPos(panner, x, y, z) {
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else if (panner.setPosition) {
    panner.setPosition(x, y, z);
  }
}

function updateListenAudio(dt) {
  const audio = listenAudio;
  if (!audio || !listenMode) return;
  const ear = listenEarPosition();
  const ranked = [];
  for (const c of liveCraft) {
    const k = craftKernel(ear.x, ear.y, ear.z, c);
    if (k > 0) ranked.push({ c, k });
  }
  ranked.sort((a, b) => b.k - a.k);
  let total = 0;
  for (const item of ranked) total += item.k / LISTEN_REF;
  const heard = softenListen(total);
  const scale = total > 1e-8 ? heard / total : 0;
  const dirN = Math.min(LISTEN_VOICES, ranked.length);
  const used = new Set();
  const assigned = new Array(LISTEN_VOICES).fill(null);
  for (let i = 0; i < dirN; i++) {
    const id = ranked[i].c.id;
    const slot = audio.voices.findIndex(v => v.id === id);
    if (slot >= 0) {
      assigned[slot] = ranked[i];
      used.add(i);
    }
  }
  for (let i = 0; i < dirN; i++) {
    if (used.has(i)) continue;
    const slot = assigned.findIndex(v => !v);
    if (slot >= 0) assigned[slot] = ranked[i];
  }
  let dirSum = 0;
  for (let i = 0; i < LISTEN_VOICES; i++) {
    const voice = audio.voices[i];
    const item = assigned[i];
    if (!item) {
      voice.id = null;
      driveListenParam(voice.gain.gain, 0);
      continue;
    }
    voice.id = item.c.id;
    const lin = item.k / LISTEN_REF * scale;
    dirSum += lin;
    driveListenParam(voice.gain.gain, lin);
    setPannerPos(voice.panner, item.c.x, item.c.y, item.c.z);
    const prev = listenPrevCraft.get(item.c.id);
    let rate = 1;
    if (prev && dt > 1e-4 && dt < 0.08) {
      const vx = (item.c.x - prev.x) / dt;
      const vy = (item.c.y - prev.y) / dt;
      const vz = (item.c.z - prev.z) / dt;
      const lx = item.c.x - ear.x;
      const ly = item.c.y - ear.y;
      const lz = item.c.z - ear.z;
      const llen = Math.hypot(lx, ly, lz) || 1;
      let approaching = -(vx * lx + vy * ly + vz * lz) / llen;
      if (listenHaveEar) {
        const lvx = (ear.x - listenPrevEar.x) / dt;
        const lvy = (ear.y - listenPrevEar.y) / dt;
        const lvz = (ear.z - listenPrevEar.z) / dt;
        approaching += (lvx * lx + lvy * ly + lvz * lz) / llen;
      }
      rate = 1 + Math.max(-0.06, Math.min(0.06, approaching / 343));
    }
    driveListenParam(voice.src.playbackRate, rate);
  }
  const bed = Math.max(0, heard - dirSum);
  driveListenParam(audio.bedGain.gain, bed);
  const skinNow = LISTEN_SKINS[listenMode === 'facade' ? listenSkin : 'open'] || LISTEN_SKINS.open;
  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const listener = audio.ctx.listener;
  if (listener.positionX) {
    listener.positionX.value = ear.x;
    listener.positionY.value = ear.y;
    listener.positionZ.value = ear.z;
    if (listener.forwardX) {
      listener.forwardX.value = ahead.x;
      listener.forwardY.value = ahead.y;
      listener.forwardZ.value = ahead.z;
      listener.upX.value = up.x;
      listener.upY.value = up.y;
      listener.upZ.value = up.z;
    }
  } else if (listener.setPosition) {
    listener.setPosition(ear.x, ear.y, ear.z);
    listener.setOrientation(ahead.x, ahead.y, ahead.z, up.x, up.y, up.z);
  }
  listenPrevCraft.clear();
  for (const c of liveCraft) listenPrevCraft.set(c.id, { x: c.x, y: c.y, z: c.z });
  listenPrevEar.copy(ear);
  listenHaveEar = true;
  return { heard, count: ranked.length, dirN, skin: skinNow };
}

function updateListenCamera() {
  const ear = listenEarPosition();
  const cp = Math.cos(listenPitch);
  const sp = Math.sin(listenPitch);
  camera.position.copy(ear);
  camera.up.set(0, 1, 0);
  camera.lookAt(
    ear.x + Math.sin(listenYaw) * cp,
    ear.y + sp,
    ear.z - Math.cos(listenYaw) * cp
  );
}

function updateListen(dt, t) {
  if (!listenMode) return;
  try {
    updateListenMotion(dt);
    updateListenCamera();
    const info = updateListenAudio(dt);
    if (info && t - listenStatusAt > 0.2) {
      listenStatusAt = t;
      const rel = info.heard > 1e-4 ? 20 * Math.log10(info.heard) + info.skin.db : -80;
      const where = listenMode === 'facade' ? `立面 · ${info.skin.label}` : '屋顶 / 街道';
      const el = $('listenStatus');
      if (el) {
        el.textContent = info.count
          ? `${where} · 相对 30 m ${rel >= 0 ? '+' : ''}${rel.toFixed(0)} dB · 计入 ${info.count} 架`
          : (flightData
            ? `${where} · 附近没有计入的飞机`
            : `${where} · 航线还在计算`);
      }
    }
  } catch (err) {
    const el = $('listenStatus');
    if (el) el.textContent = '听声中断：' + (err && err.message ? err.message : err);
  }
}

function listenHitIsGround(object) {
  return object === terrainMesh
    || object === shadowGroundMesh
    || object === noiseGroundMesh
    || object === timelineHeatMesh;
}

function listenRayHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  probeRaycaster.setFromCamera(ndc, camera);
  const grounds = [];
  if (terrainMesh) grounds.push(terrainMesh);
  if (shadowGroundMesh?.visible) grounds.push(shadowGroundMesh);
  if (noiseGroundMesh?.visible) grounds.push(noiseGroundMesh);
  if (timelineHeatMesh?.visible) grounds.push(timelineHeatMesh);
  const savedSides = grounds.map(mesh => {
    const side = mesh.material.side;
    mesh.material.side = THREE.DoubleSide;
    return [mesh, side];
  });
  const targets = [];
  for (const b of buildings) {
    if (b.box && b.group && b.group.visible !== false) targets.push(b.box);
  }
  targets.push(...grounds);
  if (noiseV2Mesh && noiseV2Mesh.visible) targets.push(noiseV2Mesh);
  let hit = null;
  try {
    hit = probeRaycaster.intersectObjects(targets, false)[0] || null;
  } finally {
    for (const [mesh, side] of savedSides) mesh.material.side = side;
  }
  return hit;
}

function animate(t) {
  requestAnimationFrame(animate);
  const dt = lastAnimMs == null ? 0 : Math.min(0.1, (t - lastAnimMs) / 1000);
  lastAnimMs = t;
  if (playbackPlaying && usingPlayback() && flightData) {
    setPlaybackTime(playbackT + dt * playbackRate);
    placeDrones();
  } else if (!flightData) {
    liveCraft = [];
  }
  updateListen(dt, t * 0.001);
  if (noiseEnabled && impactTimeMode === 'live') paintTimelineHeat();
  if (drawerMotionUntil) { onResize(); if (t >= drawerMotionUntil) drawerMotionUntil = 0; }
  flushCompute();
  if (!listenMode) {
    controls.target.copy(ORBIT_TARGET);
    controls.update();
    controls.target.copy(ORBIT_TARGET);
  }
  renderer.render(scene, camera);
}

buildMapTiles();
syncCameraControls();
syncAppearanceControls();
updateSunDirection();
updateBuildingAppearance();
applyShadowMode();
applyCameraAngles();
$('protoBar')?.querySelectorAll('button[data-variant]').forEach(btn => {
  btn.addEventListener('click', () => setTimelineVariant(btn.dataset.variant));
});
$('protoBar')?.querySelectorAll('button[data-impact]').forEach(btn => {
  btn.addEventListener('click', () => setImpactTimeMode(btn.dataset.impact));
});
document.querySelectorAll('input[name="impactTime"]').forEach(input => {
  input.addEventListener('change', e => {
    if (e.target.checked) setImpactTimeMode(e.target.value);
  });
});
impactTimeMode = readImpactTimeMode();
syncImpactTimeUI();
if (timelineVariant() || impactTimeMode === 'live') {
  if ($('protoBar')) $('protoBar').classList.add('on');
}
currentPreset = (BLOCKS.find(b => b.id === 'rep-oh-hongkong') || BLOCKS.find(b => b.id === 'hk-54-29-noisev2') || BLOCKS[0]).name;
loadPreset(currentPreset);
onResize();
animate(0);

$('listenArm')?.addEventListener('click', () => {
  if (listenMode) exitListen();
  else if (listenArmed) {
    listenArmed = false;
    syncListenChrome();
  } else {
    listenArmed = true;
    if (probeMode && $('probeToggle')) $('probeToggle').click();
    syncListenChrome();
  }
});
$('listenExit')?.addEventListener('click', () => exitListen());
$('listenGain')?.addEventListener('input', e => {
  if ($('listenGainV')) $('listenGainV').textContent = e.target.value;
  setListenUserGain(e.target.value);
});
$('listenSkin')?.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    listenSkin = btn.dataset.skin || 'open';
    applyListenSkin();
    syncListenSkinButtons();
  });
});
window.addEventListener('keydown', e => {
  if (!listenMode) {
    if (e.key === 'Escape' && listenArmed) {
      listenArmed = false;
      syncListenChrome();
    }
    return;
  }
  if (e.key === 'Escape') {
    exitListen();
    return;
  }
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    listenKeys.add(e.code);
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => listenKeys.delete(e.code));
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if (listenMode) {
    listenDrag = { x: e.clientX, y: e.clientY, id: e.pointerId, look: true };
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers have no capture */ }
  } else if (listenArmed) {
    listenDrag = { x: e.clientX, y: e.clientY, id: e.pointerId, look: false };
  }
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!listenDrag || e.pointerId !== listenDrag.id || !listenDrag.look) return;
  listenYaw -= (e.clientX - listenDrag.x) * 0.004;
  listenPitch = Math.max(-1.15, Math.min(1.15, listenPitch - (e.clientY - listenDrag.y) * 0.0032));
  listenDrag.x = e.clientX;
  listenDrag.y = e.clientY;
});
renderer.domElement.addEventListener('pointerup', e => {
  const drag = listenDrag;
  if (drag && e.pointerId === drag.id) listenDrag = null;
  if (listenMode || !listenArmed) return;
  if (drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) return;
  const hit = listenRayHit(e);
  if (hit) enterListen(hit);
});
syncListenChrome();
