'use strict';

importScripts('vendor/clipper.js');

const CLIP_SCALE = 100;
const FLYABLE_VISUAL_BAND_M = 5;
const FLYABLE_VISUAL_CLEARANCE_M = 5;
const FLYABLE_VISUAL_BUFFER_M = 5;

function clipPathToWorld(path, S) {
  return path.map(pt => [pt.X / S, pt.Y / S]);
}

function collectClipperSolids(node, out, S) {
  for (const child of node.Childs()) {
    const outer = clipPathToWorld(child.Contour(), S);
    const holes = child.Childs().map(h => clipPathToWorld(h.Contour(), S));
    if (outer.length >= 3) out.push({ outer, holes: holes.filter(h => h.length >= 3) });
    for (const h of child.Childs()) collectClipperSolids(h, out, S);
  }
}

function polyTreePaths(tree) {
  const out = [];
  (function walk(node) {
    for (const ch of node.Childs()) { out.push(ch.Contour()); walk(ch); }
  })(tree);
  return out;
}

function squareClipPath(S, rangeHalf) {
  const R = rangeHalf;
  return [[
    { X: -R * S, Y: -R * S }, { X: R * S, Y: -R * S },
    { X: R * S, Y: R * S }, { X: -R * S, Y: R * S },
  ]];
}

function bufferedObstaclePaths(buildings, S, radii) {
  const buckets = new Map();
  buildings.forEach((b, i) => {
    const r = radii ? radii[i] : FLYABLE_VISUAL_BUFFER_M;
    if (!(r >= 0.4)) return;
    const key = Math.round(r * 10);
    if (!buckets.has(key)) buckets.set(key, { r, group: [] });
    buckets.get(key).group.push(b);
  });
  const out = new ClipperLib.Paths();
  for (const { r, group } of buckets.values()) {
    const paths = group
      .map(b => b.localPoly.map(p => ({ X: Math.round((p[0] + b.x) * S), Y: Math.round((p[1] + b.z) * S) })))
      .filter(path => path.length >= 3);
    if (!paths.length) continue;
    const co = new ClipperLib.ClipperOffset(2, 0.25 * S);
    co.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const part = new ClipperLib.Paths();
    co.Execute(part, r * S);
    for (const p of part) out.push(p);
  }
  return out.length ? out : null;
}

function flyableRegion(buffered, S, rangeHalf) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(squareClipPath(S, rangeHalf), ClipperLib.PolyType.ptSubject, true);
  if (buffered && buffered.length) c.AddPaths(buffered, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctDifference, tree,
    ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const solids = [];
  collectClipperSolids(tree, solids, S);
  return { solids, paths: polyTreePaths(tree) };
}

function differenceSolids(subjPaths, clipPaths, S) {
  if (!subjPaths || !subjPaths.length) return [];
  const c = new ClipperLib.Clipper();
  c.AddPaths(subjPaths, ClipperLib.PolyType.ptSubject, true);
  if (clipPaths && clipPaths.length) c.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctDifference, tree,
    ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const solids = [];
  collectClipperSolids(tree, solids, S);
  return solids;
}

function galleryRadius(b, alt, gallery) {
  const { d, metric, pedestrianM, ringM } = gallery;
  if (pedestrianM > 0) return ringM + pedestrianM;
  if (metric === 'horizontal') return d;
  if (alt <= b.h) return d;
  const dz = alt - b.h;
  if (dz >= d) return 0;
  return Math.sqrt(d * d - dz * dz);
}

function buildVolume(data) {
  const obs = data.buildings || [];
  const S = data.clipScale || CLIP_SCALE;
  const STEP = data.bandM || FLYABLE_VISUAL_BAND_M;
  const yBase = data.yBase;
  const yMax = data.yMax;
  const rangeHalf = data.rangeHalf;
  const gallery = data.gallery || null;
  const releaseVal = gallery
    ? (gallery.metric === 'horizontal' || gallery.pedestrianM > 0 ? Infinity : gallery.d)
    : (Number.isFinite(data.releaseM) ? data.releaseM : FLYABLE_VISUAL_CLEARANCE_M);
  const radiusConst = Number.isFinite(data.radiusM) ? data.radiusM : FLYABLE_VISUAL_BUFFER_M;

  const obstacles = obs.map(b => {
    const top = Math.max(yBase, Math.min(yMax, Math.ceil((b.h + (Number.isFinite(releaseVal) ? releaseVal : 1e6)) / STEP) * STEP));
    return { b, top };
  }).filter(o => o.top > yBase + 1e-6);

  const bands = [];
  const ledges = [];
  let floor = [];
  let ceiling = [];

  if (!obstacles.length) {
    const { solids } = flyableRegion(null, S, rangeHalf);
    floor = solids;
    ceiling = solids;
    bands.push({ yA: yBase, yB: yMax, solids });
    return { bands, ledges, floor, ceiling };
  }

  const cuts = [...new Set([yBase, yMax, ...obstacles.map(o => o.top)])]
    .filter(y => y >= yBase && y <= yMax).sort((a, b) => a - b);

  let prevPaths = null;
  for (let i = 0; i < cuts.length - 1; i++) {
    const yA = cuts[i], yB = cuts[i + 1];
    if (yB - yA < 1e-6) continue;
    const blockers = obstacles.filter(o => o.top > yA + 1e-6).map(o => o.b);
    const radii = blockers.map(b => gallery ? galleryRadius(b, yA, gallery) : radiusConst);
    const buffered = blockers.length ? bufferedObstaclePaths(blockers, S, radii) : null;
    const { solids, paths } = flyableRegion(buffered, S, rangeHalf);
    bands.push({ yA, yB, solids });
    if (i === 0) floor = solids;
    else ledges.push({ y: yA, solids: differenceSolids(paths, prevPaths, S) });
    if (i === cuts.length - 2) ceiling = solids;
    prevPaths = paths;
  }
  return { bands, ledges, floor, ceiling };
}

self.onmessage = event => {
  const data = event.data;
  if (data.type !== 'compute') return;
  try {
    const mesh = buildVolume(data);
    self.postMessage({ type: 'volume', version: data.version, ...mesh });
  } catch (err) {
    self.postMessage({ type: 'error', version: data.version, message: String(err && err.message || err) });
  }
};
