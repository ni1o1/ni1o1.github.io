/* global THREE, ClipperLib */
'use strict';

const CORE = 500;
const HALO = 150;
const DOMAIN = CORE + HALO * 2;
const CORE_HALF = CORE / 2;
const CLIP_SCALE = 100;
const ALT_COLOR = { 30: 0x5eead4, 50: 0x38bdf8, 70: 0xa78bfa, 90: 0xf472b6, 110: 0xfbbf24 };
const ROUTE_BLUE = 0x1677ff;

const PLACES = [
  {
    tag: 'LA815',
    sandboxId: 'rep-ch-losangeles',
    zhName: '洛杉矶 · 又高又挤',
    enName: 'Los Angeles · compact high-rise',
    zhWhy: '这是一处中心区式的高楼簇。楼又高、彼此又近，街道像峡谷。同一条“离楼几米”的规则，在这里会很快把可走的缝挤掉。',
    enWhy: 'A downtown-like cluster: tall buildings packed close together. A keep-away distance eats the street canyons quickly.',
  },
  {
    tag: 'TK161',
    sandboxId: 'rep-cm-tokyo',
    zhName: '东京 · 中等高度但很密',
    enName: 'Tokyo · compact mid-rise',
    zhWhy: '楼大多没有洛杉矶那么高，但栋数很多、间距很窄。水平方向的离楼距离（不能从屋顶正上方“抄近路”）在这里特别苛刻。',
    enWhy: 'Buildings are mostly mid-height, but there are many of them and the gaps are tight. A horizontal keep-away (no shortcut over the roof) is especially harsh here.',
  },
  {
    tag: 'HK15',
    sandboxId: 'rep-oh-hongkong',
    zhName: '香港 · 高楼但更疏',
    enName: 'Hong Kong · open high-rise',
    zhWhy: '楼可以很高，可楼与楼之间空地更多。这是我们对照里“同规则下更可能还留得住一条过境缝”的形态。',
    enWhy: 'Towers can be very tall, but there is more open ground between them. In this comparison, this form is the one most likely to keep a through-gap under a tight rule.',
  },
  {
    tag: 'SH127',
    sandboxId: 'rep-om-shanghai',
    zhName: '上海 · 中等高度且更疏',
    enName: 'Shanghai · open mid-rise',
    zhWhy: '楼高中等，间隔更宽。实验室 5 米规则下，过境走廊通常还很多；一旦改成“任何高度都要离楼墙 30 或 50 米”，宽街也会被吃掉。',
    enWhy: 'Mid-height buildings with wider spacing. Under the laboratory 5 m rule there are usually many corridors; a 30 m or 50 m side gap at every height still swallows those streets.',
  },
];

const PACKAGES = [
  {
    id: 'eng_d5',
    zhShort: '实验室 5 米',
    enShort: 'Lab 5 m',
    zhTitle: '实验室基线：离楼 5 米，允许从屋顶上空过',
    enTitle: 'Laboratory baseline: 5 m from buildings, rooftop overflight allowed',
    zhBody: '这不是任何国家的成文法。无人机必须和建筑保持至少 5 米的直线距离。如果它飞得比楼顶还高，只要那条斜线仍大于 5 米，就可以从屋顶正上方过去。巡航高度是 30、50、70、90、110 米；穿过街区时高度保持不变，不爬升、不降落。格子分辨率是 5 米，所以 1 米和 5 米在可飞地图上看起来几乎一样。',
    enBody: 'This is not a statute. The drone must stay at least 5 metres in a straight line from buildings. If it is higher than the roof, it may overfly the roof as long as that straight-line gap stays 5 metres. Cruise heights are 30, 50, 70, 90 and 110 m; the crossing does not climb or descend. The grid is 5 m, so 1 m and 5 m look almost the same on the flyable map.',
    buildingM: 5,
    metric: 'euclidean_3d',
    pedestrianM: 0,
    ringM: 0,
    alts: [30, 50, 70, 90, 110],
    legal: false,
  },
  {
    id: 'hk_A1',
    zhShort: '香港 A1 风',
    enShort: 'Hong Kong A1-like',
    zhTitle: '香港标准 A1 风：水平离楼 10 米，只飞约 30 米高',
    enTitle: 'Hong Kong standard A1-like: 10 m sideways from buildings, about 30 m high',
    zhBody: '灵感来自香港《小型无人驾驶飞机令》对标准 A1 运行的写法：在地图平面上离构筑物 10 米，高度大约 30 米（100 英尺）。“水平”的意思是：即使你飞得比楼顶高，只要在地图上看仍压在楼的水平 10 米圈里，就不算合格——不能靠“从屋顶抄过去”来省距离。这是研究情景，不是在说这块地已经获批。',
    enBody: 'Inspired by Hong Kong’s standard Category A1 wording: 10 m from structures in the map plane, and a ceiling near 30 m (100 ft). “Horizontal” means you cannot save distance by flying over the roof: if the map still shows you inside that 10 m band, the path is illegal in this scenario. This is a research case, not an approval.',
    buildingM: 10,
    metric: 'horizontal',
    pedestrianM: 0,
    ringM: 0,
    alts: [30],
    legal: false,
  },
  {
    id: 'hk_A2_cruise',
    zhShort: '香港 A2 巡航风',
    enShort: 'Hong Kong A2 cruise-like',
    zhTitle: '香港标准 A2 巡航风：水平离楼 30 米，可飞到约 90 米',
    enTitle: 'Hong Kong standard A2 cruise-like: 30 m sideways, up to about 90 m',
    zhBody: '灵感来自香港标准 A2、速度大约 20–50 公里/小时的那一档：离构筑物水平 30 米，高度上限大约 90 米（300 英尺）。本页的飞机以约 10 米/秒巡航，和这一档同一量级。因为航线保持平飞，30 米的侧向空隙在又高又挤的街区里常常不够一条街的宽度。',
    enBody: 'Inspired by Hong Kong standard A2 at about 20–50 km/h: 30 m sideways from structures, ceiling near 90 m (300 ft). The cruise here is about 10 m/s, the same order. Because the path stays level, a 30 m side gap is often wider than the remaining street in a tight block.',
    buildingM: 30,
    metric: 'horizontal',
    pedestrianM: 0,
    ringM: 0,
    alts: [30, 50, 70, 90],
    legal: false,
  },
  {
    id: 'jp_30',
    zhShort: '日本 30 米',
    enShort: 'Japan 30 m',
    zhTitle: '日本风：离楼 30 米直线距离，允许从足够高的屋顶上空过',
    enTitle: 'Japan-like: 30 m straight-line from buildings, rooftop overflight allowed if high enough',
    zhBody: '灵感来自日本对第三者或其物件（包括楼）保持 30 米直线距离的原则。和实验室 5 米是同一种量法，只是距离更远。飞过矮楼屋顶时，竖直方向已经贡献了一部分距离，所以不必再在水平方向留满 30 米。白模场景里没有树木；真的日本法条也不把树当“物件”，但这块地用的是建筑轮廓。',
    enBody: 'Inspired by Japan’s 30 m straight-line distance to third parties or their objects, including buildings. Same geometry as the 5 m laboratory case, just farther. Over a short roof, vertical separation already counts, so you need less leftover sideways gap. This white model has no trees.',
    buildingM: 30,
    metric: 'euclidean_3d',
    pedestrianM: 0,
    ringM: 0,
    alts: [30, 50, 70, 90, 110],
    legal: false,
  },
  {
    id: 'people_30',
    zhShort: '离人 30 米（人行带）',
    enShort: '30 m from people (sidewalk stand-in)',
    zhTitle: '离人 30 米：用楼墙外 8 米环带代替真实人行道',
    enTitle: '30 m from people: an 8 m belt around buildings stands in for sidewalks',
    zhBody: '许多法规量的是离人，不是离楼。我们没有真实的人行道地图，所以在每栋楼墙外画一圈 8 米宽的环，当作“人可能走的地方”，再要求无人机离这圈环 30 米。它在每一个飞行高度都生效：飞到 110 米也不能从人行带正上方穿过。楼本身仍保留实验室那 5 米直线净空。这比“离墙 30 米”更严，也不是 OSM 人行道。',
    enBody: 'Many rules measure distance to people, not to walls. We do not have a real sidewalk map, so we draw an 8 m ring around each building as a stand-in for where people might walk, then require 30 m from that ring. It applies at every cruise height: even at 110 m you cannot overfly the ring. Buildings still keep the laboratory 5 m straight-line gap. This is stricter than “30 m from the wall”, and it is not OSM sidewalks.',
    buildingM: 5,
    metric: 'euclidean_3d',
    pedestrianM: 30,
    ringM: 8,
    alts: [30, 50, 70, 90, 110],
    legal: false,
  },
  {
    id: 'uk_a3_bldg50',
    zhShort: '英国 A3 风 50 米',
    enShort: 'UK A3-like 50 m',
    zhTitle: '英国 Open A3 风：水平离任何建筑 50 米（不是城市物流默认）',
    enTitle: 'UK Open A3-like: 50 m sideways from any building (not the city-logistics default)',
    zhBody: '灵感来自英国开放类 A3：离任何建筑水平 50 米。A3 本来就是“到建成区外面去飞”的类别，不能拿来当作城市物流已经被禁止的结论。我们把它放进来，是为了看：当侧向空隙大到 50 米时，这四个 500 米街区还剩不剩对穿的路。',
    enBody: 'Inspired by UK Open A3: 50 m horizontally from any building. A3 is the “go away from built-up areas” category, not a ban on city logistics. We include it as a stress test: with a 50 m side gap, can any of these 500 m blocks still be crossed?',
    buildingM: 50,
    metric: 'horizontal',
    pedestrianM: 0,
    ringM: 0,
    alts: [30, 50, 70, 90, 110],
    legal: false,
  },
];

const $ = (id) => document.getElementById(id);
const isOpposite = (od) => od === 'N>S' || od === 'S>N' || od === 'E>W' || od === 'W>E';
const fmtInt = (n) => (n == null || Number.isNaN(n)) ? '—' : Math.round(Number(n)).toLocaleString('en-US');
const fmt1 = (n) => (n == null || Number.isNaN(n)) ? '—' : Number(n).toFixed(1);

let blocksById = new Map();
let cells = [];
let cellIndex = new Map();
let currentTag = 'LA815';
let currentPkg = 'eng_d5';
let showCorners = false;
let showKeepAway = true;
let showUnused = false;
let playOn = true;
let focusAlt = 0;
let buildings = [];
let drones = [];
let clock = 0;

const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');
const camera = new THREE.PerspectiveCamera(34, stage.clientWidth / stage.clientHeight, 1, 6000);
camera.position.set(980, 670, 980);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 160;
controls.maxDistance = 2800;
controls.maxPolarAngle = Math.PI * 0.49;
const ORBIT_TARGET = new THREE.Vector3(0, 35, 0);
controls.target.copy(ORBIT_TARGET);

scene.add(new THREE.HemisphereLight('#ffffff', '#d7dde2', 0.72));
const sun = new THREE.DirectionalLight('#ffffff', 1.12);
sun.position.set(-360, 520, 280);
sun.target.position.copy(ORBIT_TARGET);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -560;
sun.shadow.camera.right = 560;
sun.shadow.camera.top = 560;
sun.shadow.camera.bottom = -560;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 1600;
sun.shadow.bias = -0.0002;
scene.add(sun, sun.target);

const buildingGroup = new THREE.Group();
const routeGroup = new THREE.Group();
const keepGroup = new THREE.Group();
const droneGroup = new THREE.Group();
const guideGroup = new THREE.Group();
scene.add(buildingGroup, routeGroup, keepGroup, droneGroup, guideGroup);

const buildingMat = new THREE.MeshStandardMaterial({
  color: '#c2c2c2', roughness: 0.72, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
});
const haloMat = new THREE.MeshStandardMaterial({
  color: '#d7dde3', roughness: 0.82, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
  transparent: true, opacity: 0.42, depthWrite: false,
});
const edgeMat = new THREE.LineBasicMaterial({ color: '#67717d', transparent: true, opacity: 0.92, depthWrite: false });
const haloEdgeMat = new THREE.LineBasicMaterial({ color: '#96a1ad', transparent: true, opacity: 0.22, depthWrite: false });
const keepMat = new THREE.MeshBasicMaterial({
  color: '#d94841', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
});
const planeMat = new THREE.MeshBasicMaterial({
  color: '#1677ff', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide,
});

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(DOMAIN, DOMAIN),
  new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const coreLoop = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-CORE_HALF, 0.25, -CORE_HALF),
    new THREE.Vector3(CORE_HALF, 0.25, -CORE_HALF),
    new THREE.Vector3(CORE_HALF, 0.25, CORE_HALF),
    new THREE.Vector3(-CORE_HALF, 0.25, CORE_HALF),
  ]),
  new THREE.LineBasicMaterial({ color: '#17191c' }),
);
scene.add(coreLoop);

function makeLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 22px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#242a31';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 20);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9 }));
  sprite.scale.set(48, 15, 1);
  return sprite;
}

function addCardinals() {
  const n = makeLabelSprite('北 N');
  n.position.set(0, 8, -CORE_HALF - 28);
  const s = makeLabelSprite('南 S');
  s.position.set(0, 8, CORE_HALF + 28);
  const e = makeLabelSprite('东 E');
  e.position.set(CORE_HALF + 28, 8, 0);
  const w = makeLabelSprite('西 W');
  w.position.set(-CORE_HALF - 28, 8, 0);
  scene.add(n, s, e, w);
}
addCardinals();

function centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
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

function makePrismGeometry(localPoly, height) {
  let contour = localPoly.map((p) => new THREE.Vector2(p[0], p[1]));
  if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse();
  const shape = new THREE.Shape(contour);
  const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setXYZ(i, x, z, y);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  applyFacadeShading(geom);
  geom.computeBoundingBox();
  return geom;
}

function makeOutlineGeometry(localPoly, height) {
  const pts = [];
  const add = (a, b) => pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  for (let i = 0; i < localPoly.length; i++) {
    const p = localPoly[i], q = localPoly[(i + 1) % localPoly.length];
    add([p[0], 0.16, p[1]], [q[0], 0.16, q[1]]);
    add([p[0], height + 0.02, p[1]], [q[0], height + 0.02, q[1]]);
    add([p[0], 0.16, p[1]], [p[0], height + 0.02, p[1]]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geom;
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
    else child.material?.dispose?.();
    group.remove(child);
  }
}

function makeBuilding(raw) {
  const absPoly = raw.polygon.map((p) => [p[0], -p[1]]);
  const c = centroid(absPoly);
  const localPoly = absPoly.map((p) => [p[0] - c[0], p[1] - c[1]]);
  const isHalo = raw.role === 'halo' || raw.tags?.role === 'halo';
  const h = Math.max(3, Math.min(220, raw.height || 12));
  const b = { x: c[0], z: c[1], localPoly, h, isHalo };
  const group = new THREE.Group();
  group.position.set(b.x, 0, b.z);
  const box = new THREE.Mesh(makePrismGeometry(localPoly, h), isHalo ? haloMat : buildingMat);
  box.castShadow = !isHalo;
  box.receiveShadow = true;
  const edges = new THREE.LineSegments(makeOutlineGeometry(localPoly, h), isHalo ? haloEdgeMat : edgeMat);
  edges.renderOrder = 2;
  group.add(box, edges);
  buildingGroup.add(group);
  b.group = group;
  return b;
}

function makeWorldRibbonMesh(polylines, opacity, color) {
  const positions = [];
  const indices = [];
  const halfWidth = 1.45;
  for (const poly of polylines) {
    for (let p = 0; p < poly.length - 1; p++) {
      const ax = poly[p][0], ay = poly[p][1], az = poly[p][2];
      const bx = poly[p + 1][0], by = poly[p + 1][1], bz = poly[p + 1][2];
      const dx = bx - ax, dz = bz - az;
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
    color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = 10;
  return mesh;
}

function toWorldRoute(p) {
  return p.map(([e, n, u]) => [e, u, -n]);
}

function keepAwayRadius(b, pkg, altitude) {
  if (pkg.pedestrianM > 0) return pkg.ringM + pkg.pedestrianM;
  const d = pkg.buildingM;
  if (pkg.metric === 'horizontal') return d;
  if (altitude <= b.h) return d;
  const dz = altitude - b.h;
  if (dz >= d) return 0;
  return Math.sqrt(d * d - dz * dz);
}

function offsetUnion(items) {
  if (typeof ClipperLib === 'undefined' || !items.length) return [];
  const S = CLIP_SCALE;
  const buckets = new Map();
  for (const it of items) {
    const r = Math.max(0, it.r);
    if (r < 0.4) continue;
    const key = Math.round(r);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(it);
  }
  const merged = [];
  for (const [r, group] of buckets) {
    const paths = group.map((it) => {
      const b = it.b;
      return b.localPoly.map((p) => ({
        X: Math.round((p[0] + b.x) * S),
        Y: Math.round((p[1] + b.z) * S),
      }));
    }).filter((path) => path.length >= 3);
    if (!paths.length) continue;
    const co = new ClipperLib.ClipperOffset(2, 0.25 * S);
    co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
    const out = new ClipperLib.Paths();
    co.Execute(out, r * S);
    for (const path of out) {
      if (path.length >= 3) merged.push(path.map((pt) => [pt.X / S, pt.Y / S]));
    }
  }
  return merged;
}

function drawKeepAway(pkg, altitude) {
  clearGroup(keepGroup);
  if (!showKeepAway) return;
  const coreB = buildings.filter((b) => !b.isHalo);
  const items = coreB.map((b) => ({ b, r: keepAwayRadius(b, pkg, altitude) }));
  const loops = offsetUnion(items);
  for (const loop of loops) {
    let contour = loop.map((p) => new THREE.Vector2(p[0], p[1]));
    if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse();
    if (contour.length < 3) continue;
    const shape = new THREE.Shape(contour);
    const geom = new THREE.ShapeGeometry(shape);
    const pos = geom.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i), altitude + 0.4, pos.getY(i));
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, keepMat);
    mesh.renderOrder = 6;
    keepGroup.add(mesh);
  }
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(CORE, CORE), planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = altitude;
  plane.renderOrder = 5;
  keepGroup.add(plane);
}

function selectedRoutes(cell) {
  const list = cell.routes || [];
  const kind = outcome(cell);
  const allowCorners = showCorners || kind === 'corners_only';
  return list.filter((r) => {
    if (!allowCorners && !isOpposite(r.od)) return false;
    if (!showUnused && !r.used) return false;
    if (focusAlt && Math.abs(r.h - focusAlt) > 0.1) return false;
    return true;
  });
}

function drawRoutes(cell) {
  clearGroup(routeGroup);
  const byAlt = new Map();
  for (const r of selectedRoutes(cell)) {
    const alt = r.h;
    if (!byAlt.has(alt)) byAlt.set(alt, []);
    byAlt.get(alt).push(toWorldRoute(r.p));
  }
  for (const [alt, polys] of byAlt) {
    const usedish = 0.55;
    const mesh = makeWorldRibbonMesh(polys, usedish, ALT_COLOR[alt] || ROUTE_BLUE);
    if (mesh) routeGroup.add(mesh);
  }
}

function polylineLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  }
  return L || 1;
}

function pointAlong(pts, t) {
  const target = t * polylineLength(pts);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (acc + d >= target || i === pts.length - 1) {
      const u = d < 1e-6 ? 0 : (target - acc) / d;
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }
    acc += d;
  }
  return pts[pts.length - 1];
}

function rebuildDrones(cell) {
  clearGroup(droneGroup);
  drones = [];
  const pool = selectedRoutes(cell).filter((r) => r.used);
  const take = pool.slice(0, 10);
  const geo = new THREE.SphereGeometry(2.4, 10, 10);
  for (const r of take) {
    const world = toWorldRoute(r.p);
    const mat = new THREE.MeshStandardMaterial({ color: ALT_COLOR[r.h] || ROUTE_BLUE, roughness: 0.4, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    droneGroup.add(mesh);
    drones.push({ mesh, world, speed: 18 + (r.len || 400) / 80, t0: Math.random() });
  }
}

function loadPlace(tag) {
  currentTag = tag;
  const place = PLACES.find((p) => p.tag === tag);
  const raw = blocksById.get(place.sandboxId);
  clearGroup(buildingGroup);
  buildings = (raw?.buildings || []).map(makeBuilding);
  highlightPlaceButtons();
  applyCell();
}

function currentCell() {
  return cellIndex.get(`${currentTag}_${currentPkg}`);
}

function currentPackage() {
  return PACKAGES.find((p) => p.id === currentPkg);
}

function outcome(cell) {
  if (!cell) return 'loading';
  const routes = cell.routes || [];
  const through = routes.filter((r) => isOpposite(r.od));
  const throughUsed = through.filter((r) => r.used);
  if (cell.capacity_status !== 'ok') {
    if (cell.capacity_reason === 'empty_routes' || cell.probe_connected) return 'empty_path';
    return 'blocked';
  }
  if (throughUsed.length === 0) return 'corners_only';
  return 'ok';
}

function writeReadout() {
  const cell = currentCell();
  const pkg = currentPackage();
  const place = PLACES.find((p) => p.tag === currentTag);
  const kind = outcome(cell);
  const through = (cell?.routes || []).filter((r) => isOpposite(r.od));
  const throughUsed = through.filter((r) => r.used);
  const corners = (cell?.routes || []).filter((r) => !isOpposite(r.od));
  const laeq = cell?.noise?.refl?.LAeq_area_weighted_dB;
  const alt = focusAlt || pkg.alts[0];

  $('hudPlace').textContent = place.zhName;
  $('hudPlaceEn').textContent = place.enName;
  $('hudRule').textContent = pkg.zhTitle;
  $('hudRuleEn').textContent = pkg.enTitle;

  const zh = [];
  const en = [];
  if (kind === 'ok') {
    zh.push(`在这一小时的排班里，模型一共装进了 ${fmtInt(cell.capacity_per_hour)} 架次，其中完成了 ${fmtInt(cell.n_completed)} 架。这个数字包含对穿和转弯，不是“官方城市容量”。`);
    zh.push(`图上默认只画对穿：从北到南或从东到西。对穿候选 ${through.length} 条，真正被这一小时用到的有 ${throughUsed.length} 条。转弯候选还有 ${corners.length} 条，可用右上开关打开。`);
    en.push(`The scheduler packed ${fmtInt(cell.capacity_per_hour)} trips in one hour, and ${fmtInt(cell.n_completed)} of them finished. That count includes both through-block trips and corner-turning trips. It is not an official city capacity.`);
    en.push(`The drawing defaults to through-block paths only (north–south or east–west). There are ${through.length} through candidates, ${throughUsed.length} used in this hour. ${corners.length} corner paths exist; turn them on at the top-right if you want to see them.`);
    if (laeq != null) {
      zh.push(`若这些飞机真的按这一小时飞完，建筑表面的面积平均声级大约是 ${fmt1(laeq)} 分贝（A 计权）。这是模型里的声音，不是现场麦克风。`);
      en.push(`If those trips really flew for this hour, the area-weighted sound level on building surfaces would be about ${fmt1(laeq)} dB(A). That is a modelled level, not a field microphone.`);
    }
  } else if (kind === 'corners_only') {
    zh.push(`排班数字是 ${fmtInt(cell.capacity_per_hour)} 架次/小时，但这些路都只是从相邻两边转弯，没有一条是“进一侧、出对侧”的过境。所以就过境而言，这个街区在这套规则下仍然过不去。图上因此画出了那几条转弯，避免你以为天上什么都没有。`);
    en.push(`The scheduler reports ${fmtInt(cell.capacity_per_hour)} trips per hour, but every packed path only turns a corner. None enters one side and leaves the opposite side. For through-block traffic, this neighbourhood still cannot be crossed under this rule. The drawing shows those corner paths so the scene is not empty.`);
  } else if (kind === 'empty_path') {
    zh.push('入口看起来还留着一条缝：街区对边的门口没有被规则完全封死。可是把这些门口连起来时，在格子上走不通——缝在，路不在。这不是飞机撞楼，也不是天上没有空间，只是对穿过境做不到。');
    en.push('The doorways on opposite sides still look open, but once you try to join them, the grid has no walkable path. The crack is there; the route is not. This is not a crash, and it is not “no sky”. It means through-block transit cannot be done.');
  } else if (kind === 'blocked') {
    zh.push('在这套规则和这些巡航高度上，对边门口已经没有同时能用的一对。飞机不能从这一侧进、对侧出。粉红色的层是“这一高度上离楼（或离人行带）太近、不能飞”的区域。');
    en.push('At these cruise heights, opposite-side doorways are not open at the same time. A drone cannot enter one side and leave the other. The pink layer is the band that is too close to buildings (or to the people stand-in) at this height.');
  }

  zh.push(`你现在看的高度层大约是 ${alt} 米。航线保持平飞：穿过这 500 米方块时不爬升、不降落。浅色建筑是方块外面的邻楼，用来避免路在边界上被突然切断。`);
  en.push(`The height layer you are looking at is about ${alt} m. Paths stay level: they do not climb or descend while crossing this 500 m square. Pale buildings are neighbours outside the square, so a path is not cut off at the edge.`);

  $('hudZh').innerHTML = zh.map((p) => `<p>${p}</p>`).join('');
  $('hudEn').innerHTML = en.map((p) => `<p>${p}</p>`).join('');

  $('metricCap').textContent = kind === 'ok' || kind === 'corners_only' ? `${fmtInt(cell.capacity_per_hour)} / 时` : '过不去';
  $('metricDone').textContent = kind === 'ok' || kind === 'corners_only' ? fmtInt(cell.n_completed) : '—';
  $('metricNoise').textContent = laeq != null ? `${fmt1(laeq)} dB(A)` : '—';
  $('metricThrough').textContent = `${throughUsed.length} / ${through.length}`;
  $('hudBanner').dataset.kind = kind;
  const banner = {
    ok: { zh: '可以对穿', en: 'Through-block paths exist' },
    corners_only: { zh: '只有转弯，没有对穿', en: 'Corner traffic only — no through-block path' },
    empty_path: { zh: '缝还在，对穿路不通', en: 'A crack remains, but no through path' },
    blocked: { zh: '对边过不去', en: 'Cannot cross to the opposite side' },
    loading: { zh: '载入中', en: 'Loading' },
  }[kind];
  $('hudBannerZh').textContent = banner.zh;
  $('hudBannerEn').textContent = banner.en;
}

function renderAltChips() {
  const pkg = currentPackage();
  const box = $('altChips');
  box.innerHTML = '';
  const all = document.createElement('button');
  all.type = 'button';
  all.textContent = '全部高度';
  all.className = focusAlt === 0 ? 'on' : '';
  all.addEventListener('click', () => { focusAlt = 0; applyCell(); });
  box.appendChild(all);
  for (const h of pkg.alts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${h} m`;
    b.style.setProperty('--sw', `#${(ALT_COLOR[h] || ROUTE_BLUE).toString(16).padStart(6, '0')}`);
    b.className = focusAlt === h ? 'on' : '';
    b.addEventListener('click', () => { focusAlt = h; applyCell(); });
    box.appendChild(b);
  }
}

function applyCell() {
  const cell = currentCell() || { routes: [], capacity_status: 'loading' };
  const pkg = currentPackage();
  if (focusAlt && !pkg.alts.includes(focusAlt)) focusAlt = 0;
  const alt = focusAlt || pkg.alts[0];
  drawKeepAway(pkg, alt);
  drawRoutes(cell);
  rebuildDrones(cell);
  renderAltChips();
  writeReadout();
  highlightRuleButtons();
  paintMatrix();
}

function highlightPlaceButtons() {
  document.querySelectorAll('[data-place]').forEach((el) => {
    el.classList.toggle('active', el.dataset.place === currentTag);
  });
}
function highlightRuleButtons() {
  document.querySelectorAll('[data-pkg]').forEach((el) => {
    el.classList.toggle('active', el.dataset.pkg === currentPkg);
  });
}

function cellKind(cell) {
  return outcome(cell);
}

function paintMatrix() {
  const root = $('matrix');
  if (!root.dataset.ready) {
    root.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'matrixHead';
    head.appendChild(document.createElement('span'));
    for (const pkg of PACKAGES) {
      const s = document.createElement('span');
      s.textContent = pkg.zhShort;
      s.title = pkg.enShort;
      head.appendChild(s);
    }
    root.appendChild(head);
    for (const place of PLACES) {
      const row = document.createElement('div');
      row.className = 'matrixRow';
      const lab = document.createElement('button');
      lab.type = 'button';
      lab.className = 'matrixLab';
      lab.innerHTML = `<b>${place.zhName}</b><i>${place.enName}</i>`;
      lab.addEventListener('click', () => { loadPlace(place.tag); document.getElementById('stage').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
      row.appendChild(lab);
      for (const pkg of PACKAGES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.matrix = `${place.tag}_${pkg.id}`;
        btn.addEventListener('click', () => {
          currentPkg = pkg.id;
          if (currentTag !== place.tag) loadPlace(place.tag);
          else applyCell();
          document.getElementById('stageWrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        row.appendChild(btn);
      }
      root.appendChild(row);
    }
    root.dataset.ready = '1';
  }
  for (const pkg of PACKAGES) {
    for (const place of PLACES) {
      const id = `${place.tag}_${pkg.id}`;
      const btn = root.querySelector(`[data-matrix="${id}"]`);
      const cell = cellIndex.get(id);
      const kind = cellKind(cell);
      const on = currentTag === place.tag && currentPkg === pkg.id;
      btn.className = `matrixCell ${kind}${on ? ' on' : ''}`;
      if (!cell) { btn.textContent = '…'; continue; }
      if (kind === 'ok') btn.innerHTML = `<b>${fmtInt(cell.capacity_per_hour)}</b><small>/时</small>`;
      else if (kind === 'corners_only') btn.innerHTML = `<b>${fmtInt(cell.capacity_per_hour)}</b><small>仅转弯</small>`;
      else if (kind === 'empty_path') btn.innerHTML = `<b>路不通</b><small>有缝</small>`;
      else btn.innerHTML = `<b>过不去</b><small>对边封死</small>`;
    }
  }
}

function bindHud() {
  $('placeBtns').innerHTML = '';
  for (const place of PLACES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.place = place.tag;
    b.innerHTML = `<b>${place.zhName}</b><span>${place.enName}</span>`;
    b.addEventListener('click', () => loadPlace(place.tag));
    $('placeBtns').appendChild(b);
  }
  $('ruleBtns').innerHTML = '';
  for (const pkg of PACKAGES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.pkg = pkg.id;
    b.innerHTML = `<b>${pkg.zhShort}</b><span>${pkg.enShort}</span>`;
    b.addEventListener('click', () => { currentPkg = pkg.id; applyCell(); });
    $('ruleBtns').appendChild(b);
  }
  $('togCorners').addEventListener('change', (e) => { showCorners = e.target.checked; applyCell(); });
  $('togKeep').addEventListener('change', (e) => { showKeepAway = e.target.checked; applyCell(); });
  $('togUnused').addEventListener('change', (e) => { showUnused = e.target.checked; applyCell(); });
  $('togPlay').addEventListener('change', (e) => { playOn = e.target.checked; });
  $('togEn').addEventListener('change', (e) => {
    document.body.classList.toggle('hide-en', !e.target.checked);
  });

  const storyPlaces = $('storyPlaces');
  if (storyPlaces) {
    storyPlaces.innerHTML = PLACES.map((p) => `
      <article class="card" data-place="${p.tag}">
        <h3>${p.zhName}</h3>
        <p class="en">${p.enName}</p>
        <p>${p.zhWhy}</p>
        <p class="en">${p.enWhy}</p>
      </article>`).join('');
    storyPlaces.querySelectorAll('[data-place]').forEach((el) => {
      el.addEventListener('click', () => loadPlace(el.dataset.place));
    });
  }
  const storyRules = $('storyRules');
  if (storyRules) {
    storyRules.innerHTML = PACKAGES.map((p) => `
      <article class="card" data-pkg="${p.id}">
        <h3>${p.zhTitle}</h3>
        <p class="en">${p.enTitle}</p>
        <p>${p.zhBody}</p>
        <p class="en">${p.enBody}</p>
      </article>`).join('');
    storyRules.querySelectorAll('[data-pkg]').forEach((el) => {
      el.addEventListener('click', () => { currentPkg = el.dataset.pkg; applyCell(); });
    });
  }
}

function onResize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, ((now || 0) - (tick.t || now || 0)) / 1000);
  tick.t = now;
  if (playOn) {
    clock += dt;
    for (const d of drones) {
      const t = (d.t0 + clock * d.speed / 400) % 1;
      const p = pointAlong(d.world, t);
      d.mesh.position.set(p[0], p[1] + 1.2, p[2]);
    }
  }
  controls.update();
  renderer.render(scene, camera);
}

async function boot() {
  bindHud();
  paintMatrix();
  try {
    const [bRes, cRes] = await Promise.all([
      fetch('data/policy-gallery-blocks.json'),
      fetch('data/precomputed/policy-gallery.json'),
    ]);
    if (!bRes.ok || !cRes.ok) throw new Error('fetch failed');
    const bJson = await bRes.json();
    const cJson = await cRes.json();
    for (const b of bJson.blocks) blocksById.set(b.id, b);
    cells = cJson.cells;
    cellIndex = new Map(cells.map((c) => [c.id, c]));
    $('loadNote').hidden = true;
    loadPlace(currentTag);
  } catch (err) {
    console.error(err);
    $('loadNote').hidden = false;
    $('loadNote').innerHTML = '无法读取数据。请在 <code>airspace-sandbox</code> 目录运行 <code>python3 -m http.server 8767</code>，然后打开 <code>http://127.0.0.1:8767/policy-gallery.html</code>。不要用 file:// 直接打开。<span class="en">Please serve this folder with a local web server; opening the file directly will fail.</span>';
  }
  requestAnimationFrame(tick);
}

boot();
