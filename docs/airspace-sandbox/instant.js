const DATA = 'data/instant-compare';

function colorRamp(v) {
  const stops = [
    [0.00, [59, 76, 192]],
    [0.18, [104, 136, 238]],
    [0.36, [170, 198, 253]],
    [0.50, [242, 242, 242]],
    [0.64, [252, 190, 161]],
    [0.82, [219, 94, 75]],
    [1.00, [180, 4, 38]],
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
  return [180 / 255, 4 / 255, 38 / 255];
}

function f16(u) {
  const s = (u & 0x8000) >> 15;
  const e = (u & 0x7c00) >> 10;
  const f = u & 0x03ff;
  const sign = s ? -1 : 1;
  if (e === 0) return sign * (2 ** -14) * (f / 1024);
  if (e === 31) return f ? NaN : sign * Infinity;
  return sign * (2 ** (e - 15)) * (1 + f / 1024);
}

function decodeF16(buf) {
  const u16 = new Uint16Array(buf);
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) out[i] = f16(u16[i]);
  return out;
}

function centroid(poly) {
  let x = 0;
  let y = 0;
  poly.forEach((p) => { x += p[0]; y += p[1]; });
  return [x / poly.length, y / poly.length];
}

function makeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ffffff');
  scene.add(new THREE.HemisphereLight('#ffffff', '#d7dde2', 0.72));
  const sun = new THREE.DirectionalLight('#fff7ee', 1.15);
  sun.position.set(180, 420, 140);
  scene.add(sun);
  return scene;
}

const camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
const sceneL = makeScene();
const sceneR = makeScene();
const rendererL = new THREE.WebGLRenderer({ canvas: document.getElementById('cLeft'), antialias: true });
const rendererR = new THREE.WebGLRenderer({ canvas: document.getElementById('cRight'), antialias: true });
rendererL.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
rendererR.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const controls = new THREE.OrbitControls(camera, document.getElementById('viewLeft'));
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const buildingMat = new THREE.MeshStandardMaterial({
  color: '#c2c2c2', roughness: 0.72, metalness: 0, vertexColors: true, side: THREE.DoubleSide,
});
const haloMat = new THREE.MeshStandardMaterial({
  color: '#d7dde3', roughness: 0.82, metalness: 0, vertexColors: true,
  side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthWrite: false,
});
const edgeMat = new THREE.LineBasicMaterial({ color: '#67717d', transparent: true, opacity: 0.92 });
const haloEdgeMat = new THREE.LineBasicMaterial({ color: '#96a1ad', transparent: true, opacity: 0.22 });
const noiseMat = new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0.58, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, side: THREE.DoubleSide,
});
const routeMat = new THREE.MeshBasicMaterial({
  color: '#1677ff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide,
});

let index = null;
let current = null;
let showVersion = 0;
let showBuildings = true;
let showRoute = true;
let showDiff = false;
const groups = { L: new THREE.Group(), R: new THREE.Group() };
sceneL.add(groups.L);
sceneR.add(groups.R);

function layout() {
  const left = document.getElementById('viewLeft');
  const right = document.getElementById('viewRight');
  const wL = left.clientWidth;
  const h = left.clientHeight;
  rendererL.setSize(wL, h, false);
  rendererR.setSize(right.clientWidth, h, false);
  camera.aspect = wL / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function shadeGeometry(geom) {
  const normals = geom.getAttribute('normal');
  const light = new THREE.Vector3(0.35, 0.82, 0.45).normalize();
  const colors = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const n = new THREE.Vector3(normals.getX(i), normals.getY(i), normals.getZ(i)).normalize();
    const shade = 0.74 + 0.18 * Math.max(0, n.dot(light)) + 0.10 * Math.max(0, n.y);
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function makePrism(localPoly, height) {
  let contour = localPoly.map((p) => new THREE.Vector2(p[0], p[1]));
  if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse();
  const geom = new THREE.ExtrudeGeometry(new THREE.Shape(contour), {
    depth: height, bevelEnabled: false, curveSegments: 1,
  });
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i), pos.getZ(i), pos.getY(i));
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  shadeGeometry(geom);
  return geom;
}

function makeOutline(localPoly, height) {
  const pts = [];
  const add = (a, b) => pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  for (let i = 0; i < localPoly.length; i++) {
    const p = localPoly[i];
    const q = localPoly[(i + 1) % localPoly.length];
    add([p[0], 0.16, p[1]], [q[0], 0.16, q[1]]);
    add([p[0], height + 0.02, p[1]], [q[0], height + 0.02, q[1]]);
    add([p[0], 0.16, p[1]], [p[0], height + 0.02, p[1]]);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geom;
}

function buildingRecords(rawList) {
  return (rawList || []).map((raw) => {
    const absPoly = raw.polygon.map((p) => [p[0], -p[1]]);
    const c = centroid(absPoly);
    return {
      x: c[0],
      z: c[1],
      localPoly: absPoly.map((p) => [p[0] - c[0], p[1] - c[1]]),
      h: Math.max(3, Math.min(220, raw.height || 12)),
      halo: raw.role === 'halo',
    };
  }).filter((b) => b.localPoly.length >= 3);
}

function addBuildings(group, records) {
  records.forEach((b) => {
    let prism;
    try {
      prism = makePrism(b.localPoly, b.h);
    } catch (err) {
      return;
    }
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    const box = new THREE.Mesh(prism, b.halo ? haloMat : buildingMat);
    const edges = new THREE.LineSegments(makeOutline(b.localPoly, b.h), b.halo ? haloEdgeMat : edgeMat);
    edges.renderOrder = 2;
    g.add(box, edges);
    group.add(g);
  });
}

function facadeSkin(records) {
  const skins = [];
  records.forEach((b) => {
    if (b.halo) return;
    let geom;
    try {
      geom = makePrism(b.localPoly, b.h);
    } catch (err) {
      return;
    }
    const pos = geom.getAttribute('position');
    const normal = geom.getAttribute('normal');
    const world = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + normal.getX(i) * 0.45;
      const y = pos.getY(i) + normal.getY(i) * 0.45;
      const z = pos.getZ(i) + normal.getZ(i) * 0.45;
      pos.setXYZ(i, x, y, z);
      world[i * 3] = x + b.x;
      world[i * 3 + 1] = y;
      world[i * 3 + 2] = z + b.z;
    }
    pos.needsUpdate = true;
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    const mesh = new THREE.Mesh(geom, noiseMat.clone());
    mesh.position.set(b.x, 0, b.z);
    mesh.renderOrder = 5;
    skins.push({ mesh, world, count: pos.count });
  });
  return skins;
}

function groundSheet(width, depth) {
  const cell = 14;
  const nx = Math.max(8, Math.round(width / cell));
  const nz = Math.max(8, Math.round(depth / cell));
  const positions = [];
  const indices = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      positions.push(width * i / nx, 0.55, -depth * j / nz);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      indices.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.length), 3));
  geom.setIndex(indices);
  const mesh = new THREE.Mesh(geom, noiseMat.clone());
  mesh.renderOrder = 4;
  return mesh;
}

function sampleEnergy(field, ex, east, north, up) {
  const [gx, gy, gz] = ex.volGrid;
  const [px, py, pz] = ex.volPool;
  const vs = ex.vs;
  let x = east / (px * vs) - 0.5;
  let y = north / (py * vs) - 0.5;
  let z = up / (pz * vs) - 0.5;
  x = Math.max(0, Math.min(gx - 1.001, x));
  y = Math.max(0, Math.min(gy - 1.001, y));
  z = Math.max(0, Math.min(gz - 1.001, z));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const x1 = Math.min(gx - 1, x0 + 1);
  const y1 = Math.min(gy - 1, y0 + 1);
  const z1 = Math.min(gz - 1, z0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const tz = z - z0;
  const at = (i, j, k) => field[(i * gy + j) * gz + k] || 0;
  const c00 = at(x0, y0, z0) * (1 - tz) + at(x0, y0, z1) * tz;
  const c01 = at(x0, y1, z0) * (1 - tz) + at(x0, y1, z1) * tz;
  const c10 = at(x1, y0, z0) * (1 - tz) + at(x1, y0, z1) * tz;
  const c11 = at(x1, y1, z0) * (1 - tz) + at(x1, y1, z1) * tz;
  const c0 = c00 * (1 - ty) + c01 * ty;
  const c1 = c10 * (1 - ty) + c11 * ty;
  return Math.max(0, Math.expm1(c0 * (1 - tx) + c1 * tx));
}

function energyAt(field, ex, east, up, zThree) {
  return sampleEnergy(field, ex, east, -zThree, up);
}

function streetEnergy(field, ex, x, z) {
  let best = 0;
  for (const h of [4, 8, 12, 18]) best = Math.max(best, energyAt(field, ex, x, h, z));
  return best;
}

function paintPair(ground, skins, valueAt, groundAt, norm, signed) {
  const gPos = ground.geometry.getAttribute('position');
  const gCol = ground.geometry.getAttribute('color');
  const vals = [];
  for (let i = 0; i < gPos.count; i++) vals.push(groundAt(gPos.getX(i), gPos.getZ(i)));
  skins.forEach((skin) => {
    skin.vals = new Float32Array(skin.count);
    for (let i = 0; i < skin.count; i++) {
      skin.vals[i] = valueAt(skin.world[i * 3], skin.world[i * 3 + 1], skin.world[i * 3 + 2]);
    }
  });
  const colorOf = (v) => {
    if (signed) {
      const a = Math.max(Math.abs(norm[1]), 1e-6);
      return colorRamp(0.5 + 0.5 * Math.max(-1, Math.min(1, v / a)));
    }
    const t = v > 1 ? (Math.log10(v) - norm[0]) / (norm[1] - norm[0]) : 0;
    return colorRamp(t);
  };
  for (let i = 0; i < gPos.count; i++) {
    const c = colorOf(vals[i]);
    gCol.setXYZ(i, c[0], c[1], c[2]);
  }
  gCol.needsUpdate = true;
  skins.forEach((skin) => {
    const col = skin.mesh.geometry.getAttribute('color');
    for (let i = 0; i < skin.count; i++) {
      const t = signed ? null : (skin.vals[i] > 1 ? (Math.log10(skin.vals[i]) - norm[0]) / (norm[1] - norm[0]) : 0);
      const c = signed ? colorOf(skin.vals[i]) : colorRamp(0.10 + 0.90 * Math.max(0, Math.min(1, t)));
      col.setXYZ(i, c[0], c[1], c[2]);
    }
    col.needsUpdate = true;
  });
}

function collectSamples(ground, skins, valueAt, groundAt) {
  const vals = [];
  const gPos = ground.geometry.getAttribute('position');
  for (let i = 0; i < gPos.count; i++) vals.push(groundAt(gPos.getX(i), gPos.getZ(i)));
  skins.forEach((skin) => {
    const step = Math.max(1, Math.floor(skin.count / 24));
    for (let i = 0; i < skin.count; i += step) {
      vals.push(valueAt(skin.world[i * 3], skin.world[i * 3 + 1], skin.world[i * 3 + 2]));
    }
  });
  return vals;
}

function logStretch(vals) {
  const logs = [];
  vals.forEach((v) => { if (v > 1) logs.push(Math.log10(v)); });
  logs.sort((a, b) => a - b);
  if (!logs.length) return [0, 1];
  const lo = logs[Math.floor(logs.length * 0.08)];
  const hi = logs[Math.min(logs.length - 1, Math.floor(logs.length * 0.92))];
  return [lo, Math.max(hi, lo + 0.3)];
}

function addRoute(group, ex) {
  const origin = ex.originEnu;
  const pts = (ex.routePolylineEnu || ex.posesEnu || []).map((p) => new THREE.Vector3(
    p[0] - origin[0],
    p[2] - origin[2],
    -(p[1] - origin[1]),
  ));
  if (pts.length < 2) return;
  const positions = [];
  const indices = [];
  const half = 4.2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const ox = -dz / len * half;
    const oz = dx / len * half;
    const base = positions.length / 3;
    positions.push(a.x + ox, a.y, a.z + oz, a.x - ox, a.y, a.z - oz, b.x + ox, b.y, b.z + oz, b.x - ox, b.y, b.z - oz);
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  const mesh = new THREE.Mesh(geom, routeMat);
  mesh.renderOrder = 10;
  group.add(mesh);
}

function clearGroup(g) {
  const shared = new Set([buildingMat, haloMat, edgeMat, haloEdgeMat, routeMat]);
  while (g.children.length) {
    const c = g.children.pop();
    if (c.children && c.children.length) clearGroup(c);
    c.geometry?.dispose?.();
    if (c.material && !shared.has(c.material)) c.material.dispose();
  }
}

function frameCamera(ex) {
  const w = ex.grid[0] * ex.vs;
  const d = ex.grid[1] * ex.vs;
  const half = Math.max(w, d) * 0.5;
  camera.position.set(w * 0.5 + half * 0.15, half * 0.72, -d * 0.5 + half * 0.95);
  controls.target.set(w * 0.5, 24, -d * 0.5);
  controls.update();
}

async function loadBin(name) {
  const res = await fetch(`${DATA}/${name}?v=prism1`);
  if (!res.ok) throw new Error(name);
  return res.arrayBuffer();
}

function setBusy(on, text) {
  const el = document.getElementById('busy');
  el.textContent = text || '载入对照例子…';
  el.style.display = on ? 'block' : 'none';
}

const FLIGHT = 'data/instant-flight';
let flight = null;
let flightPlaying = false;
let flightFrame = 0;
let flightAcc = 0;
let flightClock = 0;

function stopFlight() {
  flightPlaying = false;
  flightAcc = 0;
  const row = document.getElementById('flightRow');
  if (row) row.classList.remove('on');
  const play = document.getElementById('flightPlay');
  if (play) play.textContent = '播放';
  document.getElementById('flightBtn')?.classList.remove('on');
}

function aircraftMarker() {
  const marker = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(14, 18, 12),
    new THREE.MeshBasicMaterial({ color: '#1677ff', depthTest: false }),
  );
  body.renderOrder = 20;
  const stemGeom = new THREE.BufferGeometry();
  stemGeom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -1, 0], 3));
  const stem = new THREE.Line(stemGeom, new THREE.LineBasicMaterial({ color: '#1677ff', transparent: true, opacity: 0.8 }));
  stem.renderOrder = 11;
  marker.add(body, stem);
  marker.userData.stem = stem;
  return marker;
}

function placeAircraft(marker, ex, pose) {
  const origin = ex.originEnu;
  const y = pose[2] - origin[2];
  marker.position.set(pose[0] - origin[0], y, -(pose[1] - origin[1]));
  const pos = marker.userData.stem.geometry.getAttribute('position');
  pos.setXYZ(1, 0, -Math.max(0, y), 0);
  pos.needsUpdate = true;
}

function splitFrames(buf, n, count) {
  const all = decodeF16(buf);
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(all.subarray(i * count, (i + 1) * count));
  return frames;
}

function paintFlightFrame(frame) {
  const meta = flight.meta;
  const teacher = flight.teacher[frame];
  const pred = flight.pred[frame];
  const teacherAt = (x, y, z) => energyAt(teacher, meta, x, y, z);
  const predAt = (x, y, z) => energyAt(pred, meta, x, y, z);
  const teacherStreet = (x, z) => streetEnergy(teacher, meta, x, z);
  const predStreet = (x, z) => streetEnergy(pred, meta, x, z);
  paintPair(flight.groundL, flight.skinL, teacherAt, teacherStreet, flight.span, false);
  if (showDiff) {
    paintPair(
      flight.groundR, flight.skinR,
      (x, y, z) => predAt(x, y, z) - teacherAt(x, y, z),
      (x, z) => predStreet(x, z) - teacherStreet(x, z),
      flight.diffSpan, true,
    );
  } else {
    paintPair(flight.groundR, flight.skinR, predAt, predStreet, flight.span, false);
  }
  placeAircraft(flight.markerL, meta, meta.posesEnu[frame]);
  placeAircraft(flight.markerR, meta, meta.posesEnu[frame]);
  const scrub = document.getElementById('flightScrub');
  scrub.max = String(meta.nFrames - 1);
  scrub.value = String(frame);
  document.getElementById('mPoses').textContent = `第 ${frame + 1}/${meta.nFrames} 帧 · 一架`;
  document.getElementById('rightLabel').textContent = showDiff ? '差值 · 网络 − 物理' : '瞬时网络';
  document.getElementById('legendTitle').textContent = showDiff ? '右侧差值 · 能量差' : '同一色标 · 整段飞行固定';
}

function mountFlight() {
  const meta = flight.meta;
  const records = flight.records;
  const width = meta.grid[0] * meta.vs;
  const depth = meta.grid[1] * meta.vs;
  for (const g of [groups.L, groups.R]) clearGroup(g);
  const groundL = groundSheet(width, depth);
  const groundR = groundSheet(width, depth);
  const skinL = showBuildings ? facadeSkin(records) : [];
  const skinR = showBuildings ? facadeSkin(records) : [];
  if (showBuildings) {
    addBuildings(groups.L, records);
    addBuildings(groups.R, records);
    skinL.forEach((s) => groups.L.add(s.mesh));
    skinR.forEach((s) => groups.R.add(s.mesh));
  }
  groups.L.add(groundL);
  groups.R.add(groundR);
  if (showRoute) {
    addRoute(groups.L, meta);
    addRoute(groups.R, meta);
  }
  const markerL = aircraftMarker();
  const markerR = aircraftMarker();
  groups.L.add(markerL);
  groups.R.add(markerR);
  flight.groundL = groundL;
  flight.groundR = groundR;
  flight.skinL = skinL;
  flight.skinR = skinR;
  flight.markerL = markerL;
  flight.markerR = markerR;
  if (!flight.span) {
    const probe = [];
    const step = Math.max(1, Math.floor(meta.nFrames / 6));
    for (let i = 0; i < meta.nFrames; i += step) {
      probe.push(...collectSamples(groundL, [], (x, y, z) => energyAt(flight.teacher[i], meta, x, y, z), (x, z) => streetEnergy(flight.teacher[i], meta, x, z)));
      probe.push(...collectSamples(groundR, [], (x, y, z) => energyAt(flight.pred[i], meta, x, y, z), (x, z) => streetEnergy(flight.pred[i], meta, x, z)));
    }
    flight.span = logStretch(probe);
    const abs = [];
    for (let i = 0; i < meta.nFrames; i += step) {
      const teacher = flight.teacher[i];
      const pred = flight.pred[i];
      abs.push(...collectSamples(
        groundR, [],
        (x, y, z) => energyAt(pred, meta, x, y, z) - energyAt(teacher, meta, x, y, z),
        (x, z) => streetEnergy(pred, meta, x, z) - streetEnergy(teacher, meta, x, z),
      ).map(Math.abs));
    }
    abs.sort((a, b) => a - b);
    flight.diffSpan = [0, Math.max(1e-6, abs[Math.floor(abs.length * 0.92)] || 1)];
  }
  paintFlightFrame(flightFrame);
}

async function startFlight() {
  const version = ++showVersion;
  setBusy(true, '载入单机飞行…');
  const meta = flight?.meta || await (await fetch(`${FLIGHT}/index.json?v=flight1`)).json();
  if (version !== showVersion) return;
  if (!flight?.teacher) {
    const count = meta.volGrid[0] * meta.volGrid[1] * meta.volGrid[2];
    const [tb, pb, bres] = await Promise.all([
      fetch(`${FLIGHT}/${meta.files.teacherFrames}?v=flight1`).then((r) => r.arrayBuffer()),
      fetch(`${FLIGHT}/${meta.files.predFrames}?v=flight1`).then((r) => r.arrayBuffer()),
      fetch(`${DATA}/${meta.city}__${meta.block}.buildings.json?v=prism1`).then((r) => r.json()),
    ]);
    if (version !== showVersion) return;
    flight = {
      meta,
      teacher: splitFrames(tb, meta.nFrames, count),
      pred: splitFrames(pb, meta.nFrames, count),
      records: buildingRecords(bres.buildings || []),
    };
  }
  current = meta;
  flightFrame = 0;
  flightPlaying = true;
  flightAcc = 0;
  flightClock = 0;
  document.getElementById('flightBtn').classList.add('on');
  document.getElementById('flightRow').classList.add('on');
  document.getElementById('flightPlay').textContent = '暂停';
  document.getElementById('mCorr').textContent = '—';
  document.getElementById('mDb').textContent = meta.mae_db == null ? '—' : `${meta.mae_db.toFixed(1)} dB`;
  document.querySelectorAll('.ex').forEach((b) => b.classList.remove('on'));
  mountFlight();
  if (camera.userData.block !== meta.id) {
    camera.userData.block = meta.id;
    frameCamera(meta);
  }
  setBusy(false);
}

async function show(ex) {
  const version = ++showVersion;
  stopFlight();
  current = ex;
  setBusy(true, `${ex.city} / ${ex.block}`);
  const [tb, pb, bres] = await Promise.all([
    loadBin(ex.files.teacherVol),
    loadBin(ex.files.predVol),
    fetch(`${DATA}/${ex.city}__${ex.block}.buildings.json?v=prism1`).then((r) => r.json()),
  ]);
  if (version !== showVersion) return;
  const teacher = decodeF16(tb);
  const pred = decodeF16(pb);
  const records = buildingRecords(bres.buildings || []);
  const width = ex.grid[0] * ex.vs;
  const depth = ex.grid[1] * ex.vs;
  for (const g of [groups.L, groups.R]) clearGroup(g);
  const groundL = groundSheet(width, depth);
  const groundR = groundSheet(width, depth);
  const skinL = facadeSkin(records);
  const skinR = facadeSkin(records);
  if (showBuildings) {
    addBuildings(groups.L, records);
    addBuildings(groups.R, records);
    skinL.forEach((s) => groups.L.add(s.mesh));
    skinR.forEach((s) => groups.R.add(s.mesh));
  }
  groups.L.add(groundL);
  groups.R.add(groundR);
  const teacherAt = (x, y, z) => energyAt(teacher, ex, x, y, z);
  const predAt = (x, y, z) => energyAt(pred, ex, x, y, z);
  const teacherStreet = (x, z) => streetEnergy(teacher, ex, x, z);
  const predStreet = (x, z) => streetEnergy(pred, ex, x, z);
  const span = logStretch(collectSamples(groundL, [], teacherAt, teacherStreet)
    .concat(collectSamples(groundR, [], predAt, predStreet)));
  paintPair(groundL, skinL, teacherAt, teacherStreet, span, false);
  if (showDiff) {
    const diffs = collectSamples(
      groundR, skinR,
      (x, y, z) => predAt(x, y, z) - teacherAt(x, y, z),
      (x, z) => predStreet(x, z) - teacherStreet(x, z),
    ).map(Math.abs).sort((a, b) => a - b);
    const diffSpan = [0, Math.max(1e-6, diffs[Math.floor(diffs.length * 0.92)] || 1)];
    paintPair(
      groundR, skinR,
      (x, y, z) => predAt(x, y, z) - teacherAt(x, y, z),
      (x, z) => predStreet(x, z) - teacherStreet(x, z),
      diffSpan, true,
    );
  } else {
    paintPair(groundR, skinR, predAt, predStreet, span, false);
  }
  if (showRoute) {
    addRoute(groups.L, ex);
    addRoute(groups.R, ex);
  }
  document.getElementById('mCorr').textContent = ex.corr == null ? '—' : ex.corr.toFixed(2);
  document.getElementById('mDb').textContent = ex.mae_db == null ? '—' : `${ex.mae_db.toFixed(1)} dB`;
  document.getElementById('mPoses').textContent = `${ex.nPoses} · 固定航线`;
  document.getElementById('rightLabel').textContent = showDiff ? '差值 · 网络 − 物理' : '瞬时网络';
  document.getElementById('legendTitle').textContent = showDiff ? '右侧差值 · 能量差' : '同一色标 · 对数能量';
  document.querySelectorAll('.ex').forEach((b) => b.classList.toggle('on', b.dataset.id === ex.id));
  if (camera.userData.block !== ex.id) {
    camera.userData.block = ex.id;
    frameCamera(ex);
  }
  setBusy(false);
}

function renderList() {
  const box = document.getElementById('exampleList');
  const city = document.getElementById('citySel').value;
  const rows = (index.examples || []).filter((ex) => !city || city === 'all' || ex.city === city);
  box.innerHTML = '';
  rows.forEach((ex) => {
    const b = document.createElement('button');
    b.className = 'ex';
    b.dataset.id = ex.id;
    b.innerHTML = `<b>${ex.city} · ${ex.block}</b><small>${ex.note || ''} · 固定航线 · r=${ex.corr == null ? '—' : ex.corr.toFixed(2)}</small>`;
    b.addEventListener('click', () => show(ex));
    box.appendChild(b);
  });
  if (rows.length && (!current || !rows.some((e) => e.id === current.id))) show(rows[0]);
}

function tick(now) {
  if (flight && flightPlaying) {
    if (!flightClock) flightClock = now;
    flightAcc += now - flightClock;
    flightClock = now;
    const step = 1000 / (flight.meta.fps || 4);
    if (flightAcc >= step) {
      flightAcc %= step;
      flightFrame = (flightFrame + 1) % flight.meta.nFrames;
      paintFlightFrame(flightFrame);
    }
  } else {
    flightClock = 0;
  }
  controls.update();
  rendererL.render(sceneL, camera);
  rendererR.render(sceneR, camera);
  requestAnimationFrame(tick);
}

async function boot() {
  layout();
  window.addEventListener('resize', layout);
  index = await (await fetch(`${DATA}/index.json?v=prism1`)).json();
  const cities = ['all', ...new Set(index.examples.map((e) => e.city))];
  const sel = document.getElementById('citySel');
  sel.innerHTML = cities.map((c) => `<option value="${c}">${c === 'all' ? '全部城市' : c}</option>`).join('');
  sel.addEventListener('change', renderList);
  document.getElementById('modeNear').onclick = () => {
    showDiff = false;
    document.getElementById('modeNear').classList.add('on');
    document.getElementById('modeDiff').classList.remove('on');
    if (flight && document.getElementById('flightBtn').classList.contains('on')) paintFlightFrame(flightFrame);
    else if (current) show(current);
  };
  document.getElementById('modeDiff').onclick = () => {
    showDiff = true;
    document.getElementById('modeDiff').classList.add('on');
    document.getElementById('modeNear').classList.remove('on');
    if (flight && document.getElementById('flightBtn').classList.contains('on')) paintFlightFrame(flightFrame);
    else if (current) show(current);
  };
  document.getElementById('bldgToggle').onchange = (e) => {
    showBuildings = e.target.checked;
    if (flight && document.getElementById('flightBtn').classList.contains('on')) mountFlight();
    else if (current) show(current);
  };
  document.getElementById('routeToggle').onchange = (e) => {
    showRoute = e.target.checked;
    if (flight && document.getElementById('flightBtn').classList.contains('on')) mountFlight();
    else if (current) show(current);
  };
  document.getElementById('flightBtn').onclick = () => startFlight().catch((err) => {
    setBusy(true, '单机飞行还没准备好');
    console.error(err);
  });
  document.getElementById('flightPlay').onclick = () => {
    if (!flight) return;
    flightPlaying = !flightPlaying;
    flightClock = 0;
    document.getElementById('flightPlay').textContent = flightPlaying ? '暂停' : '播放';
  };
  document.getElementById('flightScrub').oninput = (e) => {
    if (!flight) return;
    flightPlaying = false;
    flightClock = 0;
    document.getElementById('flightPlay').textContent = '播放';
    flightFrame = Number(e.target.value);
    paintFlightFrame(flightFrame);
  };
  document.getElementById('viewReset').onclick = () => { if (current) frameCamera(current); };
  document.getElementById('viewTop').onclick = () => {
    if (!current) return;
    const w = current.grid[0] * current.vs;
    const d = current.grid[1] * current.vs;
    camera.position.set(w * 0.5, Math.max(w, d) * 1.15, -d * 0.5);
    controls.target.set(w * 0.5, 0, -d * 0.5);
  };
  document.getElementById('viewSide').onclick = () => {
    if (!current) return;
    const w = current.grid[0] * current.vs;
    const d = current.grid[1] * current.vs;
    camera.position.set(w * 1.35, 80, -d * 0.5);
    controls.target.set(w * 0.5, 30, -d * 0.5);
  };
  renderList();
  setBusy(false);
  tick();
}

boot();
