window.__ModuleLoader__.load({
  id: '@local/dsh-ascii-ocean',
  factory(require) {
    const React = require('react');
// Proportions are drawing parameters informed by the sources in WHALE-REFERENCES.md.
// x runs from the fluke trailing edge (-1.2) to the nose (1.04); y is depth.
const WHALE_SPECIES = Object.freeze({
  blue: {
    name: '蓝鲸', height: 1.05, pleats: true,
    profile: [[-1, 0.018], [-0.82, 0.035], [-0.58, 0.073], [-0.28, 0.13], [0.08, 0.177], [0.4, 0.193], [0.64, 0.171], [0.84, 0.135], [0.97, 0.105], [1.025, 0.061], [1.04, 0]],
    flipper: { root: [0.34, 0.078, 0.153], tip: [0.01, 0.115, 0.39], width: 0.052, thickness: 0.012 },
    fluke: { span: 0.35, tipX: -1.115, leadingX: -0.9, trailingX: -1.2, notch: 0.072, width: 0.018 },
    dorsal: { root: [-0.62, -0.064, 0], tip: [-0.71, -0.16, 0], width: 0.055 },
    cruise: 25, turnRate: 0.22, beat: 1.45, amplitude: 0.1, glide: 0.32, size: 1,
  },
  humpback: {
    name: '座头鲸', height: 1.02, pleats: true,
    profile: [[-1, 0.021], [-0.82, 0.043], [-0.58, 0.09], [-0.28, 0.17], [0.08, 0.227], [0.36, 0.244], [0.62, 0.209], [0.8, 0.158], [0.95, 0.113], [1.025, 0.054], [1.04, 0]],
    flipper: { root: [0.35, 0.1, 0.194], tip: [-0.12, 0.14, 0.79], width: 0.079, thickness: 0.014 },
    fluke: { span: 0.435, tipX: -1.115, leadingX: -0.855, trailingX: -1.2, notch: 0.095, width: 0.021 },
    dorsal: { root: [-0.36, -0.145, 0], tip: [-0.45, -0.3, 0], width: 0.085 },
    cruise: 22, turnRate: 0.25, beat: 1.65, amplitude: 0.12, glide: 0.28, size: 0.93,
  },
  sperm: {
    name: '抹香鲸', height: 1.15, pleats: false,
    profile: [[-1, 0.024], [-0.82, 0.05], [-0.59, 0.099], [-0.28, 0.16], [0.05, 0.209], [0.36, 0.237], [0.62, 0.249], [0.9, 0.247], [1.015, 0.231], [1.04, 0.172]],
    flipper: { root: [0.29, 0.125, 0.193], tip: [-0.025, 0.16, 0.39], width: 0.075, thickness: 0.015 },
    fluke: { span: 0.37, tipX: -1.09, leadingX: -0.855, trailingX: -1.2, notch: 0.09, width: 0.023 },
    dorsal: { root: [-0.39, -0.16, 0], tip: [-0.44, -0.245, 0], width: 0.13 },
    cruise: 21, turnRate: 0.19, beat: 1.35, amplitude: 0.1, glide: 0.4, size: 0.96,
  },
  fin: {
    name: '长须鲸', height: 1.1, pleats: true,
    profile: [[-1, 0.017], [-0.82, 0.031], [-0.58, 0.065], [-0.28, 0.115], [0.08, 0.163], [0.38, 0.178], [0.6, 0.157], [0.8, 0.111], [0.96, 0.049], [1.04, 0]],
    flipper: { root: [0.35, 0.08, 0.14], tip: [0.02, 0.12, 0.345], width: 0.045, thickness: 0.011 },
    fluke: { span: 0.315, tipX: -1.135, leadingX: -0.92, trailingX: -1.2, notch: 0.06, width: 0.017 },
    dorsal: { root: [-0.41, -0.11, 0], tip: [-0.52, -0.27, 0], width: 0.065 },
    cruise: 29, turnRate: 0.24, beat: 1.6, amplitude: 0.092, glide: 0.3, size: 0.98,
  },
  bowhead: {
    name: '弓头鲸', height: 1.08, pleats: false,
    profile: [[-1, 0.025], [-0.82, 0.053], [-0.59, 0.116], [-0.28, 0.215], [0.02, 0.284], [0.3, 0.295], [0.53, 0.259], [0.76, 0.198], [0.94, 0.116], [1.025, 0.052], [1.04, 0]],
    flipper: { root: [0.27, 0.14, 0.238], tip: [-0.11, 0.18, 0.55], width: 0.123, thickness: 0.019 },
    fluke: { span: 0.445, tipX: -1.08, leadingX: -0.83, trailingX: -1.2, notch: 0.1, width: 0.025 },
    dorsal: null,
    cruise: 18, turnRate: 0.18, beat: 1.2, amplitude: 0.11, glide: 0.43, size: 0.94,
  },
});

const SPECIES_IDS = Object.freeze(Object.keys(WHALE_SPECIES));
function whaleSpecies(id) { return WHALE_SPECIES[id] || WHALE_SPECIES.blue; }


const RIG_NODES = 18;
const RIG_SPAN = 2.24;
const RIG_NOSE = 1.04;
const rigLimit = (value, low, high) => Math.max(low, Math.min(high, value));
const rigAngle = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const rigSmooth = value => { const t = rigLimit(value, 0, 1); return t * t * (3 - 2 * t); };

function resetWhaleRig(whale) {
  const length = Math.max(1, whale.length || 400);
  const nodes = new Float64Array(RIG_NODES * 2);
  const c = Math.cos(whale.heading), s = Math.sin(whale.heading);
  for (let i = 0; i < RIG_NODES; i++) {
    const along = length * (RIG_NOSE / RIG_SPAN - i / (RIG_NODES - 1));
    nodes[i * 2] = whale.x + c * along;
    nodes[i * 2 + 1] = whale.y + s * along;
  }
  whale.rig = { nodes };
  return whale.rig;
}

function updateWhaleRig(whale) {
  if (!whale.rig) resetWhaleRig(whale);
  const nodes = whale.rig.nodes, length = Math.max(1, whale.length);
  const head = length * RIG_NOSE / RIG_SPAN, segment = length / (RIG_NODES - 1);
  nodes[0] = whale.x + Math.cos(whale.heading) * head;
  nodes[1] = whale.y + Math.sin(whale.heading) * head;
  let forward = whale.heading;
  for (let i = 1; i < RIG_NODES; i++) {
    const j = i * 2, px = nodes[j - 2], py = nodes[j - 1];
    const history = Math.atan2(py - nodes[j + 1], px - nodes[j]);
    // The anterior body resists bending; the peduncle follows a broad turn.
    const jointLimit = 0.018 + 0.038 * (i / (RIG_NODES - 1)) ** 1.5;
    forward += rigLimit(rigAngle(forward, history), -jointLimit, jointLimit);
    nodes[j] = px - Math.cos(forward) * segment;
    nodes[j + 1] = py - Math.sin(forward) * segment;
  }
}

function resizeWhaleRig(whale, scaleX, scaleY) {
  if (!whale.rig) { resetWhaleRig(whale); return; }
  const nodes = whale.rig.nodes;
  for (let i = 0; i < nodes.length; i += 2) { nodes[i] *= scaleX; nodes[i + 1] *= scaleY; }
  updateWhaleRig(whale);
}

function writeWhaleRigPose(whale, pose) {
  if (!whale.rig) resetWhaleRig(whale);
  const nodes = whale.rig.nodes;
  const spine = pose.spine?.length === RIG_NODES * 4 ? pose.spine : new Float64Array(RIG_NODES * 4);
  const c = Math.cos(whale.heading), s = Math.sin(whale.heading);
  const scale = RIG_SPAN / Math.max(1, whale.length);
  for (let i = 0; i < RIG_NODES; i++) {
    const k = i * 2, before = Math.max(0, i - 1) * 2, after = Math.min(RIG_NODES - 1, i + 1) * 2;
    const dx = nodes[k] - whale.x, dy = nodes[k + 1] - whale.y;
    const fx = nodes[before] - nodes[after], fy = nodes[before + 1] - nodes[after + 1];
    const magnitude = Math.hypot(fx, fy) || 1;
    spine[i * 4] = (c * dx + s * dy) * scale;
    spine[i * 4 + 1] = (-s * dx + c * dy) * scale;
    spine[i * 4 + 2] = (c * fx + s * fy) / magnitude;
    spine[i * 4 + 3] = (-s * fx + c * fy) / magnitude;
  }
  pose.spine = spine;
  pose.anatomy = whaleSpecies(whale.species);
  pose.stroke = whale._motion?.stroke ?? 1;
  pose.diveEngagement = rigDiveEngagement(pose);
  const dive = Number.isFinite(pose.divePitch) ? pose.divePitch : 0;
  pose.diveSin = Math.sin(dive);
  pose.diveCos = Math.cos(dive);
  return pose;
}

function rigDiveEngagement(pose) {
  const sub = Number.isFinite(pose.submergence) ? pose.submergence : 0;
  const depth = Number.isFinite(pose.diveDepth) ? pose.diveDepth : 0;
  const pitch = Number.isFinite(pose.divePitch) ? pose.divePitch : 0;
  const kick = Number.isFinite(pose.diveKick) ? pose.diveKick : 0;
  return rigSmooth(Math.max(sub * 8, Math.abs(depth) * 4, Math.abs(pitch) * 3, Math.abs(kick) * 2));
}

function deformWhaleParticle(p, pose, out) {
  const anatomy = pose.anatomy || WHALE_SPECIES.blue;
  let x = p.x, y = p.y, z = p.z, nx = p.nx, ny = p.ny, nz = p.nz;
  const bank = rigLimit((pose.turn || 0) * 0.28, -0.09, 0.09);
  const wave = pose.wave || 0;
  let stroke = pose.stroke ?? 1;
  const engagement = Number.isFinite(pose.diveEngagement) ? pose.diveEngagement : rigDiveEngagement(pose);
  if (engagement > 0) stroke *= 1 - engagement;
  const kick = Number.isFinite(pose.diveKick) ? pose.diveKick : 0;
  const arch = Number.isFinite(pose.diveArch) ? pose.diveArch : 0;
  let bind = x;
  if (p.part === 'fin') {
    const root = anatomy.flipper.root;
    bind = root[0];
    const side = z < 0 ? -1 : 1, rootZ = side * root[2];
    // Flippers trim and steer. They are not continuously rowing wings.
    const flap = side * Math.sin(wave * 0.24 + 0.3) * 0.025 + bank * 0.7;
    const cf = Math.cos(flap), sf = Math.sin(flap), dy = y - root[1], dz = z - rootZ;
    y = root[1] + cf * dy - sf * dz; z = rootZ + sf * dy + cf * dz;
    const normalY = cf * ny - sf * nz; nz = sf * ny + cf * nz; ny = normalY;
    const sweep = bank * 0.1, cs = Math.cos(sweep), ss = Math.sin(sweep), dx = x - bind, lateral = z - rootZ;
    x = bind + cs * dx + ss * lateral; z = rootZ - ss * dx + cs * lateral;
    const normalX = cs * nx + ss * nz; nz = -ss * nx + cs * nz; nx = normalX;
  } else if (p.part === 'fluke') {
    bind = -0.96;
    let pitch = Math.cos(wave - 1.2) * 0.24 * stroke;
    if (kick !== 0) pitch -= kick * 0.65;
    const c = Math.cos(pitch), s = Math.sin(pitch), dx = x - bind, dy = y - 0.01;
    x = bind + c * dx - s * dy; y = 0.01 + s * dx + c * dy;
    const normalX = c * nx - s * ny; ny = s * nx + c * ny; nx = normalX;
    // Both lobes travel together vertically; only a small elastic lag remains.
    const side = z < 0 ? -1 : 1, flex = side * Math.sin(wave - 1.55) * 0.035 * stroke;
    const cf = Math.cos(flex), sf = Math.sin(flex), fy = y - 0.01, fz = z - side * 0.012;
    y = 0.01 + cf * fy - sf * fz; z = side * 0.012 + sf * fy + cf * fz;
    const normalY = cf * ny - sf * nz; nz = sf * ny + cf * nz; ny = normalY;
  } else if (p.part === 'dorsal') bind = anatomy.dorsal?.root[0] ?? x;

  let cx = bind, cy = 0, tx = 1, ty = 0;
  if (pose.spine) {
    const u = rigLimit((RIG_NOSE - bind) / RIG_SPAN, 0, 1) * (RIG_NODES - 1);
    const i = Math.min(RIG_NODES - 2, Math.floor(u)), t = u - i, a = i * 4, b = a + 4;
    const spine = pose.spine, t2 = t * t, t3 = t2 * t;
    const chord = Math.hypot(spine[b] - spine[a], spine[b + 1] - spine[a + 1]);
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    cx = h00 * spine[a] - h10 * chord * spine[a + 2] + h01 * spine[b] - h11 * chord * spine[b + 2];
    cy = h00 * spine[a + 1] - h10 * chord * spine[a + 3] + h01 * spine[b + 1] - h11 * chord * spine[b + 3];
    const d00 = 6 * t2 - 6 * t, d10 = 3 * t2 - 4 * t + 1, d01 = -d00, d11 = 3 * t2 - 2 * t;
    tx = -(d00 * spine[a] - d10 * chord * spine[a + 2] + d01 * spine[b] - d11 * chord * spine[b + 2]);
    ty = -(d00 * spine[a + 1] - d10 * chord * spine[a + 3] + d01 * spine[b + 1] - d11 * chord * spine[b + 3]);
    const magnitude = Math.hypot(tx, ty) || 1; tx /= magnitude; ty /= magnitude;
    const extension = bind - rigLimit(bind, -1.2, RIG_NOSE);
    cx += tx * extension; cy += ty * extension;
  }

  // The stroke bends in x/y (up and down), independent of the historical
  // x/z steering curve. Preserve surface normals through both rotations.
  const u = rigLimit((0.5 - bind) / 1.46, 0, 1), ramp = rigSmooth(u);
  const phase = wave - u * 1.2;
  let heave = anatomy.amplitude * ramp * ramp * Math.sin(phase) * stroke;
  const rampDerivative = u > 0 && u < 1 ? -6 * u * (1 - u) / 1.46 : 0;
  let slope = anatomy.amplitude * stroke * (2 * ramp * rampDerivative * Math.sin(phase)
    + ramp * ramp * Math.cos(phase) * (u > 0 && u < 1 ? 1.2 / 1.46 : 0));
  if (kick !== 0) {
    heave += kick * ramp * ramp;
    slope += kick * 2 * ramp * rampDerivative;
  }
  if (arch !== 0) {
    const a = rigLimit((bind + 1.05) / 1.9, 0, 1), b = 1 - a;
    heave -= arch * 16 * a * a * b * b;
    slope -= arch * 32 * a * b * (1 - 2 * a) / 1.9;
  }
  const pitch = Math.atan(slope), cv = Math.cos(pitch), sv = Math.sin(pitch);
  const along = x - bind, localX = cv * along - sv * y;
  const vertical = heave + sv * along + cv * y;
  const localNX = cv * nx - sv * ny, verticalNY = sv * nx + cv * ny;
  const cb = Math.cos(bank), sb = Math.sin(bank);
  const verticalY = cb * vertical - sb * z, lateral = sb * vertical + cb * z;
  const verticalNormal = cb * verticalNY - sb * nz, lateralNormal = sb * verticalNY + cb * nz;
  out.x = cx + tx * localX + ty * lateral;
  out.y = verticalY;
  out.z = -cy - ty * localX + tx * lateral;
  out.nx = tx * localNX + ty * lateralNormal;
  out.ny = verticalNormal;
  out.nz = -ty * localNX + tx * lateralNormal;
  const dive = pose.divePitch;
  if (Number.isFinite(dive) && dive !== 0) {
    const cd = Number.isFinite(pose.diveCos) ? pose.diveCos : Math.cos(dive);
    const sd = Number.isFinite(pose.diveSin) ? pose.diveSin : Math.sin(dive);
    const ox = out.x, oy = out.y;
    out.x = cd * ox - sd * oy;
    out.y = sd * ox + cd * oy;
    const nx = out.nx, ny = out.ny;
    out.nx = cd * nx - sd * ny;
    out.ny = sd * nx + cd * ny;
  }
  if (Number.isFinite(pose.diveDepth) && pose.diveDepth !== 0) out.y += pose.diveDepth;
  return out;
}

// Keep these names distinct when the renderer modules are concatenated.
const GLYPH_INK_LIGHT_LEVELS = 32;
const GLYPH_INK_DEPTH_LEVELS = 16;
const GLYPH_INK_NEAR_DEPTH = 0.14;
const GLYPH_INK_FAR_DEPTH = 1.35;

// Each depth row contains a complete shadow-to-highlight ramp. Construct the
// CSS strings once; drawing only selects an integer index into a cached array.
const GLYPH_INK_PALETTES = (() => {
  const ramps = {
    ocean: [[38, 63, 88], [94, 119, 141], [187, 205, 218]],
    azure: [[32, 62, 88], [76, 127, 158], [169, 207, 226]],
    indigo: [[48, 55, 83], [109, 116, 153], [199, 202, 224]],
  };
  const palettes = {};
  for (const [name, [shadow, mid, highlight]] of Object.entries(ramps)) {
    const palette = [];
    for (let distance = 0; distance < GLYPH_INK_DEPTH_LEVELS; distance++) {
      const depth = distance / (GLYPH_INK_DEPTH_LEVELS - 1);
      const haze = 0.34 * depth * depth * (3 - 2 * depth);
      for (let shade = 0; shade < GLYPH_INK_LIGHT_LEVELS; shade++) {
        const light = shade / (GLYPH_INK_LIGHT_LEVELS - 1);
        const unlit = 1 - light;
        // A quadratic ramp keeps the slope continuous as bending normals
        // change their light, without random hue changes or extra opacity.
        const channels = shadow.map((start, channel) => {
          const ink = unlit * unlit * start + 2 * unlit * light * mid[channel]
            + light * light * highlight[channel];
          return Math.round(ink + (255 - ink) * haze);
        });
        palette.push(`rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`);
      }
    }
    palettes[name] = Object.freeze(palette);
  }
  return Object.freeze(palettes);
})();

/** Return the shared opaque 32-light × 16-distance LUT, with ocean as fallback. */
function createInkPalette(name) {
  return name === 'azure' ? GLYPH_INK_PALETTES.azure
    : name === 'indigo' ? GLYPH_INK_PALETTES.indigo : GLYPH_INK_PALETTES.ocean;
}

/**
 * light is 0..1; depth is cameraZ / focal, with full ink at 0.14 and maximum
 * haze at 1.35. Both axes use the nearest bin. Index = depthBin * 32 + lightBin.
 * NaN/non-numbers default to mid-light and near depth; infinities clamp to ends.
 * This per-cell path allocates nothing and never constructs a CSS color.
 */
function glyphInkIndex(light, depth) {
  if (typeof light !== 'number' || light !== light) light = 0.5;
  if (typeof depth !== 'number' || depth !== depth) depth = GLYPH_INK_NEAR_DEPTH;
  const shade = light <= 0 ? 0 : light >= 1 ? GLYPH_INK_LIGHT_LEVELS - 1
    : Math.round(light * (GLYPH_INK_LIGHT_LEVELS - 1));
  const distance = depth <= GLYPH_INK_NEAR_DEPTH ? 0
    : depth >= GLYPH_INK_FAR_DEPTH ? GLYPH_INK_DEPTH_LEVELS - 1
      : Math.round((depth - GLYPH_INK_NEAR_DEPTH) * (GLYPH_INK_DEPTH_LEVELS - 1)
        / (GLYPH_INK_FAR_DEPTH - GLYPH_INK_NEAR_DEPTH));
  return distance * GLYPH_INK_LIGHT_LEVELS + shade;
}

/** Dark ink describes the raised back seen through a shorter water column. */
function surfaceInkTone(elevation, upness, sideFacing, material = 'skin', seed = 0.5) {
  const raised = Math.max(0, Math.min(1.25, elevation / 0.235));
  const crown = Math.max(0, Math.min(1, upness));
  const aspect = Math.max(-1, Math.min(1, sideFacing));
  const relief = raised * 0.82 + crown * 0.18;
  let tone = 0.86 - relief * 0.66 + aspect * 0.025 + (seed - 0.5) * 0.025;
  if (material === 'fin') tone += 0.02 + Math.max(0, Math.min(1, -elevation / 0.25)) * 0.04;
  else if (material === 'pleat') tone -= 0.035;
  else if (material === 'eye') tone = Math.min(tone, 0.18);
  return Math.max(0.14, Math.min(0.9, tone));
}

// Reef islands for the sea surface. The layout is seeded once per page load and
// then never re-rolled: a resize only rescales the same rocks, so the background
// does not pop when the window changes.
//
// build.mjs concatenates the renderer modules into one factory, so no top-level
// name may collide with model.js (which owns `clamp`, `smooth`, `noise` and the
// other short helpers). Every helper here carries a `reef` prefix.


// Ordered densest to sparsest. The banded pressure ridges of a rock read as
// dark lines, so the shadow side gets the dense glyph and the lit side the
// sparse one; the ink palette supplies the matching tone.
const REEF_GLYPHS = '@%#*+:.';
const REEF_SPECKLE = '·';
// The reading column owns the middle of the sea and the glass pane leaves only
// narrow margins on a normal desktop, so the rocks live in the far margins
// instead of behind the words. They still steer the school.
const REEF_LEFT_BAND = Object.freeze([0.02, 0.10]);
const REEF_RIGHT_BAND = Object.freeze([0.90, 0.98]);
const REEF_VERTICAL_BAND = Object.freeze([0.16, 0.78]);
const REEF_RADIUS_MIN_FRACTION = 0.05;
const REEF_RADIUS_MAX_FRACTION = 0.07;
const REEF_RADIUS_MIN = 26;
const REEF_RADIUS_MAX = 72;
const REEF_MIN_GAP = 14;
const REEF_ATTEMPTS = 220;
const REEF_FALLBACK_ATTEMPTS = 120;
const REEF_DEFAULT_WIDTH = 1280;
const REEF_DEFAULT_HEIGHT = 800;
const REEF_DEFAULT_COUNT = 3;
const REEF_MAX_COUNT = 8;
const REEF_DEFAULT_OPACITY = 0.6;
const REEF_DEFAULT_CELL_WIDTH = 11;
const REEF_DEFAULT_CELL_HEIGHT = 13;

// The renderer fades glyphs near the reading pane; the reef must obey the same
// per-point fade so it dissolves with the rest of the sea.
const reefClamp = (value, low, high) => value < low ? low : value > high ? high : value;
const reefFinite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const reefPositive = (value, fallback) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
const reefSmooth = t => { t = reefClamp(t, 0, 1); return t * t * (3 - 2 * t); };

/** Small deterministic PRNG (mulberry32); one instance per field creation. */
const reefRandom = seed => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stable 0..1 fraction of an integer seed, used instead of another RNG. */
const reefFraction = seed => ((seed >>> 0) % 1000) / 1000;

/**
 * Fixed per-cell noise. Drawing must not allocate or advance a clock, so the
 * grain is a pure hash of the rock seed and the character cell.
 */
const reefCellNoise = (seed, column, row) => {
  let hash = (seed | 0) ^ Math.imul(column + 1, 0x9e3779b1) ^ Math.imul(row + 1, 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2545f491);
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4294967296;
};

/**
 * One main stone plus one or two smaller stones leaning against it, expressed
 * relative to the reef centre and normalised so the outer radius is exact.
 */
function reefBuildLobes(radius, rand) {
  const count = rand() < 0.5 ? 2 : 3;
  // The main stone sits on the field anchor; only the satellites are offset, so
  // `radius` really is the circumcircle of the whole group. The satellites are
  // deliberately chunky and close, so the cluster reads as one island at an
  // 11px cell resolution instead of a few isolated pebbles.
  const lobes = [{ dx: 0, dy: 0, r: radius * (0.48 + 0.08 * rand()) }];
  const base = rand() * Math.PI * 2;
  for (let i = 1; i < count; i++) {
    const angle = base + (i - 1) * Math.PI * 0.85 + (rand() - 0.5) * 0.6;
    const distance = radius * (0.42 + 0.16 * rand());
    const small = radius * (0.34 + 0.08 * rand());
    lobes.push({
      dx: lobes[0].dx + Math.cos(angle) * distance,
      dy: lobes[0].dy + Math.sin(angle) * distance,
      r: small,
    });
  }
  let bound = 0;
  for (const lobe of lobes) bound = Math.max(bound, Math.hypot(lobe.dx, lobe.dy) + lobe.r);
  const scale = bound > 0 ? radius / bound : 1;
  for (const lobe of lobes) {
    lobe.dx *= scale; lobe.dy *= scale; lobe.r *= scale;
  }
  return lobes;
}

/** True when the candidate circumcircle keeps the required gap to every rock. */
function reefSeparated(reefs, x, y, radius) {
  for (const reef of reefs) {
    const dx = reef.x - x, dy = reef.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < reef.radius + radius + REEF_MIN_GAP) return false;
  }
  return true;
}

/**
 * One rejection-sampling attempt. Returns null when the position collides.
 *
 * The bands already leave a wide margin on normal viewports; the clamp only
 * matters for windows narrower than the reading column and keeps a whole rock
 * on the canvas instead of half of one.
 */
function reefCandidate(width, height, left, radius, existing, rand) {
  const band = left ? REEF_LEFT_BAND : REEF_RIGHT_BAND;
  const nx = band[0] + (band[1] - band[0]) * rand();
  const ny = REEF_VERTICAL_BAND[0] + (REEF_VERTICAL_BAND[1] - REEF_VERTICAL_BAND[0]) * rand();
  let x = nx * width, y = ny * height;
  if (width > radius * 2 + 4) x = reefClamp(x, radius + 2, width - radius - 2);
  else x = width / 2;
  if (height > radius * 2 + 4) y = reefClamp(y, radius + 2, height - radius - 2);
  else y = height / 2;
  if (!reefSeparated(existing, x, y, radius)) return null;
  const seed = (Math.floor(rand() * 0x100000000) >>> 0);
  return { x, y, radius, seed, lobes: reefBuildLobes(radius, rand) };
}

/**
 * Build the fixed reef field.
 *
 * `seed` is the one thing the caller draws at page load; with the same seed and
 * the same size this returns an identical field, which is what lets a settings
 * change repaint without moving the rocks.
 */
function createReefField({ width, height, seed, count = REEF_DEFAULT_COUNT } = {}) {
  const safeWidth = reefPositive(width, REEF_DEFAULT_WIDTH);
  const safeHeight = reefPositive(height, REEF_DEFAULT_HEIGHT);
  const rootSeed = typeof seed === 'number' && Number.isFinite(seed)
    ? (seed >>> 0) : (Math.floor(Math.random() * 0x100000000) >>> 0);
  const wanted = reefClamp(Math.round(reefFinite(count, REEF_DEFAULT_COUNT)), 1, REEF_MAX_COUNT);
  const minSide = Math.min(safeWidth, safeHeight);
  const span = REEF_RADIUS_MAX_FRACTION - REEF_RADIUS_MIN_FRACTION;
  const rand = reefRandom(rootSeed);
  const reefs = [];
  for (let index = 0; index < wanted; index++) {
    // Left, right, left, ... so the pair never crowds one margin.
    const left = index % 2 === 0;
    let reef = null;
    for (let attempt = 0; attempt < REEF_ATTEMPTS && !reef; attempt++) {
      const radius = reefClamp(minSide * (REEF_RADIUS_MIN_FRACTION + span * rand()),
        REEF_RADIUS_MIN, REEF_RADIUS_MAX);
      reef = reefCandidate(safeWidth, safeHeight, left, radius, reefs, rand);
    }
    if (!reef) {
      // Tiny windows or very large counts: shrink to the floor radius and try a
      // little harder, but never draw an overlapping pair.
      const radius = reefClamp(minSide * REEF_RADIUS_MIN_FRACTION, REEF_RADIUS_MIN, REEF_RADIUS_MAX);
      for (let attempt = 0; attempt < REEF_FALLBACK_ATTEMPTS && !reef; attempt++) {
        reef = reefCandidate(safeWidth, safeHeight, left, radius, reefs, rand);
      }
    }
    if (reef) reefs.push(reef);
  }
  return { width: safeWidth, height: safeHeight, seed: rootSeed, reefs };
}

/**
 * Rescale the field in place. Positions keep their normalized coordinates, so
 * the reef belongs to the same page layout after a window resize and no new
 * random values are drawn.
 *
 * Rocks scale by the smaller of the two axis factors. Anisotropic resizing can
 * pull two neighbours closer together; keeping the radius below that factor is
 * what stops the groups from fusing when a window changes aspect ratio.
 */
function resizeReefField(field, width, height) {
  if (!field || !Array.isArray(field.reefs)) return field;
  const oldWidth = reefFinite(field.width, 0);
  const oldHeight = reefFinite(field.height, 0);
  if (!(oldWidth > 0) || !(oldHeight > 0)) return field;
  const nextWidth = reefPositive(width, oldWidth);
  const nextHeight = reefPositive(height, oldHeight);
  const xScale = nextWidth / oldWidth, yScale = nextHeight / oldHeight;
  const rockScale = Math.min(xScale, yScale);
  for (const reef of field.reefs) {
    if (!reef) continue;
    if (Number.isFinite(reef.x)) reef.x *= xScale;
    if (Number.isFinite(reef.y)) reef.y *= yScale;
    if (reef.radius > 0) reef.radius *= rockScale;
    if (!Array.isArray(reef.lobes)) continue;
    for (const lobe of reef.lobes) {
      lobe.dx *= rockScale; lobe.dy *= rockScale; lobe.r *= rockScale;
    }
  }
  field.width = nextWidth; field.height = nextHeight;
  return field;
}

/**
 * One circle per rock for the motion layer. The circumcircle is deliberately a
 * little generous: a whale should start steering before its body clips a stone.
 */
function reefObstacles(field) {
  const obstacles = [];
  if (!field || !Array.isArray(field.reefs)) return obstacles;
  for (const reef of field.reefs) {
    if (!reef) continue;
    const radius = reefFinite(reef.radius, 0);
    if (!(radius > 0)) continue;
    const x = reefFinite(reef.x, NaN), y = reefFinite(reef.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    obstacles.push({ x, y, radius });
  }
  return obstacles;
}

/**
 * Paint the reefs as ASCII cells.
 *
 * Only `fillText` and the basic text state are used, so this can drive the real
 * canvas or a test double. Every cell is sampled at its centre: inside a stone
 * the palette tone and glyph density follow a fixed upper-left light, and the
 * band just outside gets sparse `·` as broken water over the shallows.
 *
 * @returns {number} glyphs drawn, which is also what the zero-fade test checks.
 */
function drawReefs(target, field, options = {}) {
  if (!target || typeof target.fillText !== 'function' || !field
    || !Array.isArray(field.reefs) || !field.reefs.length) return 0;
  const settings = options && typeof options === 'object' ? options : {};
  const width = reefPositive(settings.width, reefPositive(field.width, REEF_DEFAULT_WIDTH));
  const height = reefPositive(settings.height, reefPositive(field.height, REEF_DEFAULT_HEIGHT));
  const cellWidth = reefPositive(settings.cellWidth, REEF_DEFAULT_CELL_WIDTH);
  const cellHeight = reefPositive(settings.cellHeight, REEF_DEFAULT_CELL_HEIGHT);
  const ratio = reefPositive(settings.ratio, 1);
  const opacity = reefClamp(reefFinite(settings.opacity, REEF_DEFAULT_OPACITY), 0, 1);
  const palette = settings.palette && typeof settings.palette.length === 'number' && settings.palette.length > 0
    ? settings.palette : createInkPalette('ocean');
  const fade = typeof settings.fade === 'function' ? settings.fade : null;
  if (!(opacity > 0)) return 0;

  if (typeof settings.font === 'string' && settings.font) target.font = settings.font;
  target.textAlign = 'center';
  target.textBaseline = 'middle';
  const columns = Math.max(1, Math.ceil(width / cellWidth));
  const rows = Math.max(1, Math.ceil(height / cellHeight));
  const maxWidth = Math.max(1, cellWidth - 1);
  const paletteSize = palette.length;
  let currentInk = null;
  let drawn = 0;

  for (const reef of field.reefs) {
    if (!reef || !Array.isArray(reef.lobes) || !reef.lobes.length) continue;
    const originX = reefFinite(reef.x, NaN), originY = reefFinite(reef.y, NaN);
    const radius = reefFinite(reef.radius, 0);
    if (!Number.isFinite(originX) || !Number.isFinite(originY) || !(radius > 0)) continue;
    const lobes = reef.lobes, lobeCount = lobes.length;
    const seed = reefFinite(reef.seed, 0) >>> 0;
    // Rock colour varies a little per island so the group does not look stamped.
    const depth = 0.30 + reefFraction(seed) * 0.18;
    const halo = Math.max(cellWidth * 0.45, Math.min(radius * 0.32, 14));
    const left = Math.max(0, Math.floor((originX - radius - halo) / cellWidth));
    const right = Math.min(columns - 1, Math.floor((originX + radius + halo) / cellWidth));
    const top = Math.max(0, Math.floor((originY - radius - halo) / cellHeight));
    const bottom = Math.min(rows - 1, Math.floor((originY + radius + halo) / cellHeight));
    for (let row = top; row <= bottom; row++) {
      const cy = (row + 0.5) * cellHeight;
      for (let column = left; column <= right; column++) {
        const cx = (column + 0.5) * cellWidth;
        let best = -Infinity, normalX = 0, normalY = 0, hits = 0;
        for (let index = 0; index < lobeCount; index++) {
          const lobe = lobes[index];
          if (!(lobe.r > 0)) continue;
          const dx = cx - (originX + lobe.dx), dy = cy - (originY + lobe.dy);
          const inside = lobe.r - Math.sqrt(dx * dx + dy * dy);
          if (inside > 0) hits++;
          if (inside > best) {
            best = inside; normalX = dx / lobe.r; normalY = dy / lobe.r;
          }
        }
        if (best === -Infinity) continue;
        // A zero or invalid fade means the glass owns this point: no glyph at all.
        const fadeValue = fade ? fade(cx, cy) : 1;
        if (!(fadeValue > 0)) continue;
        const fadeScale = fadeValue < 1 ? fadeValue : 1;

        if (best > 0) {
          const cover = reefSmooth(best / Math.max(1, cellWidth * 0.9));
          const rim = 1 - cover;
          const facing = -0.62 * normalX - 0.78 * normalY;
          const grain = reefCellNoise(seed, column, row);
          // The rim carries the densest glyphs: that outline is what makes a few
          // dozen cells read as a rock instead of scattered marks. Inside, the
          // stone is a sparser texture, and the upper-left light thins it further.
          // Creases where two stones meet sit in their own shadow.
          let density = 3.4 + facing * 0.9 - rim * 2.2 + (grain - 0.5) * 1.4;
          if (hits > 1) density -= 0.6;
          const glyph = REEF_GLYPHS[reefClamp(Math.round(density), 0, REEF_GLYPHS.length - 1)];
          // Keep the whole stone inside the dark half of the ink ramp: the pale
          // end all but disappears on a light page, so relief comes from the
          // glyph density while the ink stays legible on both themes.
          const light = reefClamp(0.20 + 0.16 * (1 - rim) + 0.08 * facing + (grain - 0.5) * 0.06, 0.08, 0.55);
          const shade = glyphInkIndex(light, depth);
          const ink = palette[shade < paletteSize ? shade : paletteSize - 1];
          const alpha = Math.min(opacity * 0.85, opacity * (0.26 + 0.62 * cover)) * fadeScale;
          if (!(alpha > 0.004)) continue;
          if (ink !== currentInk) { target.fillStyle = ink; currentInk = ink; }
          target.globalAlpha = alpha;
          target.fillText(glyph, Math.round(cx * ratio) / ratio, Math.round(cy * ratio) / ratio, maxWidth);
          drawn++;
        } else if (-best <= halo) {
          const facing = reefClamp(-0.62 * normalX - 0.78 * normalY, -1, 1);
          const noise = reefCellNoise(seed ^ 0x51ed270b, column, row);
          const density = 0.10 + 0.10 * reefClamp(facing, 0, 1) + 0.06 * reefCellNoise(seed ^ 0x2c1b3d, row, column);
          if (!(noise < density)) continue;
          // Mid-tone rather than a white glint: the page is usually light, and a
          // pale dot at low alpha would disappear completely.
          const light = 0.58 + 0.18 * reefCellNoise(seed ^ 0x7f4a7c15, column + 7, row + 3);
          const shade = glyphInkIndex(light, depth + 0.10);
          const ink = palette[shade < paletteSize ? shade : paletteSize - 1];
          const alpha = Math.min(opacity * 0.85, opacity * 0.26) * fadeScale;
          if (!(alpha > 0.004)) continue;
          if (ink !== currentInk) { target.fillStyle = ink; currentInk = ink; }
          target.globalAlpha = alpha;
          target.fillText(REEF_SPECKLE, Math.round(cx * ratio) / ratio, Math.round(cy * ratio) / ratio, maxWidth);
          drawn++;
        }
      }
    }
  }
  target.globalAlpha = 1;
  return drawn;
}


// Ripples are a top-down read of the surface: one fluke slap sends out a calm
// ring that swells quickly and then settles. Everything here is pure geometry
// and deterministic hashes, so tests can drive it without a canvas or a clock.
//
// build.mjs concatenates the renderer modules into one factory, so every
// top-level name carries a `water`/`WATER_` prefix to stay clear of model.js,
// motion.js and glass.js.

const WATER_BEAT = Math.PI * 2;
// Below this the fluke is gliding on momentum instead of pushing water, so a
// coasting whale must not splash a ring just because its phase wraps.
const WATER_ACTIVE_STROKE = 0.42;
const WATER_MAX_RIPPLES = 16;
const WATER_MIN_LIFE = 2.8;
const WATER_LIFE_RANGE = 1.0;
const WATER_TAIL_FACTOR = 0.54;
const WATER_MIN_END_RADIUS = 34;
const WATER_MAX_END_RADIUS = 120;
const WATER_MIN_START_RADIUS = 3;
const WATER_MIN_RING_POINTS = 12;
const WATER_MAX_RING_POINTS = 180;
const WATER_SPLASH_SECONDS = 0.3;
// The surface is the shallowest row of the ink LUT: ripples stay a bright
// sheen instead of growing into a second, whale-coloured body.
const WATER_RIPPLE_DEPTH = 0.16;
const WATER_SPLASH_GLYPHS = ["'", '·', ','];
// A solid ring would read as a bubble outline on the glyph grid; broken dashes
// keep the same quiet character as the rest of the sea.
const WATER_DASH_PERIOD = 7;
const WATER_DASH_GAP = 3;

const waterFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const waterClamp = (value, low, high) => value < low ? low : value > high ? high : value;

/** Integer hash in [0, 1): deterministic per whale, beat and sample. */
function waterHash(a, b, salt = 0) {
  let hash = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
    ^ Math.imul(salt | 0, 1442695041);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function waterKeySeed(index, beat) {
  return waterHash(index + 1, beat);
}

/** Stable per-whale key: numeric ids win, then names, then a negative slot. */
function waterWhaleKey(whale, index) {
  const id = whale.id;
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  if (typeof id === 'string' && id) return id;
  // Negative fallbacks cannot collide with the non-negative ids createScene uses.
  return -1 - index;
}

function waterTailPoint(whale) {
  const nodes = whale.rig && whale.rig.nodes;
  if (nodes && nodes.length >= 4) {
    const x = nodes[nodes.length - 2], y = nodes[nodes.length - 1];
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  const length = Math.max(0, waterFinite(whale.length, 0));
  const heading = waterFinite(whale.heading, 0);
  return {
    x: waterFinite(whale.x, 0) - Math.cos(heading) * length * WATER_TAIL_FACTOR,
    y: waterFinite(whale.y, 0) - Math.sin(heading) * length * WATER_TAIL_FACTOR,
  };
}

function waterHeadPoint(whale) {
  const nodes = whale.rig && whale.rig.nodes;
  if (nodes && nodes.length >= 2 && Number.isFinite(nodes[0]) && Number.isFinite(nodes[1])) {
    return { x: nodes[0], y: nodes[1] };
  }
  const reach = Math.max(0, waterFinite(whale.length, 0)) * (1.04 / 2.24);
  const heading = waterFinite(whale.heading, 0);
  return { x: waterFinite(whale.x, 0) + Math.cos(heading) * reach,
    y: waterFinite(whale.y, 0) + Math.sin(heading) * reach };
}

function waterSpawnRipple(ripples, whale, stroke, index, beat, impact = null) {
  const bodyRadius = Math.max(1, waterFinite(whale.bodyRadius, 10));
  const tail = impact === 'surface' ? waterHeadPoint(whale) : waterTailPoint(whale);
  // One seed decides the life, splash pattern and ring dashes together, so a
  // ring keeps its shape while it expands.
  const seed = waterKeySeed(index, beat);
  const strength = waterClamp(stroke, 0, 1);
  const endRadius = waterClamp(bodyRadius * (1.9 + 0.9 * strength),
    WATER_MIN_END_RADIUS, WATER_MAX_END_RADIUS);
  ripples.push({
    x: tail.x,
    y: tail.y,
    age: 0,
    life: WATER_MIN_LIFE + WATER_LIFE_RANGE * seed,
    startRadius: Math.min(Math.max(WATER_MIN_START_RADIUS, bodyRadius * 0.22), endRadius * 0.5),
    endRadius,
    strength,
    seed,
  });
  if (impact) {
    const ripple = ripples[ripples.length - 1];
    ripple.kind = impact;
    ripple.heading = waterFinite(whale.heading, 0);
    ripple.aspect = impact === 'surface' ? 0.68 : 0.76;
    ripple.endRadius = waterClamp(bodyRadius * (impact === 'surface' ? 3.8 : 3.0), 42, 160);
    ripple.startRadius = Math.max(4, bodyRadius * (impact === 'surface' ? 0.45 : 0.3));
    ripple.life = (impact === 'surface' ? 4.1 : 3.3) + seed * 0.5;
  }
}

/** Current ring radius: fast at the slap, slow as the ring spends its energy. */
function waterRippleRadius(ripple) {
  const life = Math.max(0.001, waterFinite(ripple && ripple.life, WATER_MIN_LIFE));
  const age = waterClamp(waterFinite(ripple && ripple.age, 0), 0, life);
  const start = Math.max(0, waterFinite(ripple && ripple.startRadius, WATER_MIN_START_RADIUS));
  const end = Math.max(start, waterFinite(ripple && ripple.endRadius, start));
  const progress = age / life;
  return start + (end - start) * (1 - (1 - progress) ** 1.8);
}

/** A new, empty surface: live rings plus each whale's last observed beat. */
function createWaterField() {
  return { ripples: [], beats: new Map() };
}

/** Clear both the rings and the beat memory; the next beat starts afresh. */
function resetWaterField(field) {
  if (!field || typeof field !== 'object') return field;
  if (Array.isArray(field.ripples)) field.ripples.length = 0;
  else field.ripples = [];
  if (field.beats instanceof Map) field.beats.clear();
  else field.beats = new Map();
  return field;
}

/**
 * Advance the surface by `delta` simulated seconds.
 *
 * Each whale's `_motion.wave` grows continuously; a 2π wrap is one fluke beat.
 * A ring is born only when the beat is crossed *and* the fluke is actively
 * pushing water (stroke above the glide threshold). A multi-beat jump still
 * leaves a single ring, because one slap is what the eye can see.
 */
function stepWater(field, scene, delta, options = {}) {
  if (!field || typeof field !== 'object') return field;
  if (!Array.isArray(field.ripples)) field.ripples = [];
  if (!(field.beats instanceof Map)) field.beats = new Map();
  const ripples = field.ripples, beats = field.beats;
  const step = waterFinite(delta, 0);
  const settings = options && typeof options === 'object' ? options : {};
  const maxRipples = Math.max(0, Math.floor(waterFinite(settings.maxRipples, WATER_MAX_RIPPLES)));

  // Age first, then drop the spent rings: a single step long enough to outlive
  // a ring must remove it in this same call.
  if (step > 0) {
    for (let i = 0; i < ripples.length; i++) {
      const ripple = ripples[i];
      if (ripple && typeof ripple === 'object') ripple.age = waterFinite(ripple.age, 0) + step;
    }
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const ripple = ripples[i];
    const age = waterFinite(ripple && ripple.age, 0);
    const life = waterFinite(ripple && ripple.life, WATER_MIN_LIFE);
    // Rings without a usable centre are worse than no ring at all: drop them
    // rather than let a NaN position reach the glyph grid.
    const centred = Boolean(ripple) && typeof ripple === 'object'
      && Number.isFinite(waterFinite(ripple.x, NaN)) && Number.isFinite(waterFinite(ripple.y, NaN));
    if (!centred || !(age < life)) ripples.splice(i, 1);
  }
  if (!(step > 0)) return field;

  const whales = scene && Array.isArray(scene.whales) ? scene.whales : [];
  for (let i = 0; i < whales.length; i++) {
    const whale = whales[i];
    if (!whale || typeof whale !== 'object') continue;
    const key = waterWhaleKey(whale, i);
    const motion = whale._motion;
    // Without a motion state there is no phase to read: forget the whale so a
    // later respawn counts as a first sighting instead of a crossing.
    if (!motion || typeof motion !== 'object' || !Number.isFinite(motion.wave)) {
      beats.delete(key);
      continue;
    }
    const beat = Math.floor(motion.wave / WATER_BEAT);
    const dive = motion.dive;
    const splashSerial = Math.max(0, Math.floor(waterFinite(dive && dive.splashSerial, 0)));
    const previous = beats.get(key);
    if (!previous) {
      // An already-completed contact must not replay when water is enabled.
      beats.set(key, { beat, age: 0, splashSerial });
      continue;
    }
    previous.age = waterFinite(previous.age, 0) + step;
    const previousSplash = waterFinite(previous.splashSerial, splashSerial);
    previous.splashSerial = splashSerial;
    if (splashSerial > previousSplash && dive
      && (dive.splashKind === 'dive' || dive.splashKind === 'surface') && maxRipples > 0) {
      while (ripples.length >= maxRipples) {
        const ordinary = ripples.findIndex(ripple => !ripple.kind);
        ripples.splice(ordinary < 0 ? 0 : ordinary, 1);
      }
      waterSpawnRipple(ripples, whale,
        waterClamp(waterFinite(dive.splashStrength, 1), 0, 1), i, splashSerial, dive.splashKind);
    }
    const previousBeat = waterFinite(previous.beat, beat);
    if (beat === previousBeat) continue;
    if (beat < previousBeat) {
      // Phase was reset (new school, restored scene): resync silently.
      previous.beat = beat;
      previous.age = 0;
      continue;
    }
    previous.beat = beat;
    previous.age = 0;
    const stroke = waterClamp(waterFinite(motion.stroke, 0), 0, 1);
    const submergence = waterClamp(waterFinite(motion.submergence, 0), 0, 1);
    const deliberate = dive && dive.startedAt !== null && Number.isFinite(dive.startedAt);
    if (deliberate || submergence > 0.12 || stroke < WATER_ACTIVE_STROKE || ripples.length >= maxRipples) continue;
    waterSpawnRipple(ripples, whale, stroke, i, beat);
  }
  // Prune beat memory for whales that have left the scene. Only build a set
  // when the map is clearly larger than the school, keeping the per-frame path
  // allocation-free in the common case.
  if (beats.size > whales.length + 8) {
    const live = new Set();
    for (let i = 0; i < whales.length; i++) {
      const whale = whales[i];
      if (whale && typeof whale === 'object') live.add(waterWhaleKey(whale, i));
    }
    for (const key of beats.keys()) if (!live.has(key)) beats.delete(key);
  }
  return field;
}

/**
 * Paint every live ring into an ASCII cell grid.
 *
 * The target is only a pseudo 2D context: `font`, `fillStyle`, `globalAlpha`,
 * `textAlign`, `textBaseline` and `fillText` are the whole contract, because
 * the engine hands in a glyph painter rather than a real canvas context.
 *
 * @returns {number} glyphs drawn, which is also what the zero-fade test checks.
 */
function drawWater(target, field, options = {}) {
  if (!target || typeof target.fillText !== 'function') return 0;
  const ripples = field && Array.isArray(field.ripples) ? field.ripples : null;
  if (!ripples || !ripples.length) return 0;
  const settings = options && typeof options === 'object' ? options : {};
  const width = waterFinite(settings.width, 0);
  const height = waterFinite(settings.height, 0);
  const cellWidth = Math.max(1, waterFinite(settings.cellWidth, 11));
  const cellHeight = Math.max(1, waterFinite(settings.cellHeight, 13));
  const ratio = Math.max(0.01, waterFinite(settings.ratio, 1));
  const opacity = waterClamp(waterFinite(settings.opacity, 0.5), 0, 1);
  if (!(width > 0) || !(height > 0) || !(opacity > 0)) return 0;
  // Like the reef, a missing palette falls back to the shared ocean ink table,
  // so an unfinished caller still gets real ink instead of one flat colour.
  const palette = settings.palette && typeof settings.palette.length === 'number'
    && settings.palette.length > 0 ? settings.palette : createInkPalette('ocean');
  const fade = typeof settings.fade === 'function' ? settings.fade : null;
  const columns = Math.max(1, Math.ceil(width / cellWidth));
  const rows = Math.max(1, Math.ceil(height / cellHeight));
  const snap = value => Math.round(value * ratio) / ratio;

  // Leave the font alone unless the caller supplies one: the engine has already
  // set the configured glyph size on the shared context.
  if (typeof settings.font === 'string' && settings.font) target.font = settings.font;
  target.textAlign = 'center';
  target.textBaseline = 'middle';
  let currentFill = null;
  let drawn = 0;

  // Snap one sample to its cell centre, dedupe within this ripple, then write
  // it. Every alpha is clamped under the caller's opacity.
  const paintPoint = (x, y, glyph, alpha, light, seen) => {
    if (!(alpha > 0)) return;
    const col = Math.floor(x / cellWidth), row = Math.floor(y / cellHeight);
    if (col < 0 || col >= columns || row < 0 || row >= rows) return;
    const key = row * columns + col;
    if (seen.has(key)) return;
    seen.add(key);
    const centreX = snap((col + 0.5) * cellWidth);
    const centreY = snap((row + 0.5) * cellHeight);
    let visibility = 1;
    if (fade) {
      visibility = waterClamp(waterFinite(fade(centreX, centreY), 0), 0, 1);
      if (!(visibility > 0)) return;
    }
    const value = Math.min(opacity, alpha * visibility);
    if (!(value > 0.01)) return;
    const shade = glyphInkIndex(light, WATER_RIPPLE_DEPTH);
    const fill = palette[shade < palette.length ? shade : palette.length - 1];
    if (fill !== currentFill) {
      target.fillStyle = fill;
      currentFill = fill;
    }
    target.globalAlpha = value;
    target.fillText(glyph, centreX, centreY, Math.max(1, cellWidth * 1.1));
    drawn++;
  };

  for (let r = 0; r < ripples.length; r++) {
    const ripple = ripples[r];
    if (!ripple || typeof ripple !== 'object') continue;
    const x = waterFinite(ripple.x, NaN), y = waterFinite(ripple.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const life = Math.max(0.001, waterFinite(ripple.life, WATER_MIN_LIFE));
    const age = waterClamp(waterFinite(ripple.age, 0), 0, life);
    const progress = age / life;
    const strength = waterClamp(waterFinite(ripple.strength, 0.5), 0, 1);
    const seed = waterClamp(waterFinite(ripple.seed, 0.5), 0, 1);
    const radius = waterRippleRadius(ripple);
    const impact = ripple.kind === 'surface' || ripple.kind === 'dive';
    const bow = ripple.kind === 'surface';
    const axis = impact ? waterFinite(ripple.heading, 0) + Math.PI / 2 : 0;
    const aspect = impact ? waterClamp(waterFinite(ripple.aspect, 1), 0.4, 1) : 1;
    const axisCos = Math.cos(axis), axisSin = Math.sin(axis);
    // The ring is brightest at birth and thins while it expands, so it
    // dissolves into the sea instead of popping out at its widest.
    const ageFade = (1 - progress) ** 1.5;
    if (!(ageFade > 0)) continue;
    // Mid-dark ink, not the pale end of the ramp: the page under the canvas is
    // usually light, and a highlight-coloured ring would simply vanish there.
    const light = waterClamp(0.40 + 0.10 * strength, 0, 1);
    const outerAlpha = opacity * (0.70 + 0.25 * strength) * ageFade;
    const seen = new Set();
    const spacing = Math.max(4, (cellWidth + cellHeight) * 0.45);

    for (let ring = 0; ring < 2; ring++) {
      const ringRadius = ring === 0 ? radius : radius * 0.7;
      // The inner echo is weak and disappears first; below a cell or two it
      // would collapse into the same glyphs as the main ring.
      if (ring === 1 && (ringRadius < 6 || ageFade < 0.3)) continue;
      const count = Math.max(WATER_MIN_RING_POINTS, Math.min(WATER_MAX_RING_POINTS,
        Math.ceil(Math.PI * 2 * ringRadius / spacing)));
      const dashOffset = Math.floor(seed * 97) + ring * 31;
      for (let i = 0; i < count; i++) {
        if ((i + dashOffset) % WATER_DASH_PERIOD < WATER_DASH_GAP) continue;
        const angle = (i + 0.5) / count * Math.PI * 2
          + (waterHash(i, ring + 7, dashOffset) - 0.5) * 0.14;
        const wobble = (waterHash(i, ring + 11, dashOffset) - 0.5) * cellWidth * 0.5;
        const pointRadius = ringRadius + wobble;
        const pointLight = waterClamp(light + (waterHash(i, ring + 17, dashOffset) - 0.5) * 0.1
          + (ring === 0 ? 0.05 : -0.05), 0, 1);
        const pick = waterHash(i, ring + 23, dashOffset);
        // On the top and bottom of the circle the wave front runs horizontally,
        // so a tilde belongs there; everywhere else the quiet dots keep it calm.
        const angleCos = Math.cos(angle), angleSin = Math.sin(angle);
        if (bow && angleSin > 0.65) continue;
        const tangentX = -angleSin * axisCos - angleCos * aspect * axisSin;
        const tangentY = -angleSin * axisSin + angleCos * aspect * axisCos;
        const horizontal = Math.abs(tangentX) / Math.hypot(tangentX, tangentY) > 0.82;
        const glyph = ring === 0
          ? (horizontal ? (pick < 0.75 ? '~' : '·') : (pick < 0.72 ? '·' : pick < 0.9 ? '˙' : "'"))
          : (pick < 0.7 ? '·' : '˙');
        const localX = angleCos * pointRadius;
        const localY = angleSin * pointRadius * aspect;
        paintPoint(x + localX * axisCos - localY * axisSin, y + localX * axisSin + localY * axisCos,
          glyph, ring === 0 ? outerAlpha : outerAlpha * 0.5, pointLight, seen);
      }
    }

    // The first third of a second is the splash: a few drops thrown outward
    // from the tail, then gone. This is what keeps the slap from looking like a
    // ring that merely faded in.
    const splashLife = impact ? 0.5 : WATER_SPLASH_SECONDS;
    if (age < splashLife) {
      const splashFade = 1 - age / splashLife;
      const drops = (impact ? 7 : 3) + Math.floor(seed * 2);
      const startRadius = Math.max(WATER_MIN_START_RADIUS,
        waterFinite(ripple.startRadius, WATER_MIN_START_RADIUS));
      for (let s = 0; s < drops; s++) {
        const angle = bow
          ? waterFinite(ripple.heading, 0) + (s / Math.max(1, drops - 1) - 0.5) * Math.PI * 1.2
          : seed * Math.PI * 2 + s / drops * Math.PI * 2
            + (waterHash(s, 5, Math.round(seed * 1024)) - 0.5) * 0.8;
        const spread = startRadius + (cellWidth + 3) * (0.4 + (1 - splashFade) * 1.1);
        paintPoint(x + Math.cos(angle) * spread, y + Math.sin(angle) * spread,
          WATER_SPLASH_GLYPHS[s % WATER_SPLASH_GLYPHS.length],
          opacity * 0.85 * splashFade, waterClamp(light + 0.08, 0, 1), seen);
      }
    }
  }
  target.globalAlpha = 1;
  return drawn;
}


// Stateful screen-space swimming. All helpers are prefixed because the release
// build concatenates this module with the renderer and geometry modules.
const motionTick = 1 / 60;
// Model y points down into the water; the fog band begins at this plane.
const DIVE_WATERLINE = 0.10;
// Mirrors FIELDS.whaleSize; motion.js cannot import model.js because model.js
// already imports this module (a cycle would leave FIELDS uninitialized).
const motionWhaleSizeFloor = 0.55, motionWhaleSizeCeiling = 1.55;
const motionLimit = (value, low, high) => Math.max(low, Math.min(high, value));
const motionFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const motionAngle = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

function motionSeed(whale, index) {
  const key = `${whale.id ?? index}:${motionFinite(whale.phase, 0)}`;
  let state = 2166136261;
  for (let i = 0; i < key.length; i++) state = Math.imul(state ^ key.charCodeAt(i), 16777619);
  return state >>> 0;
}

function motionRandom(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function motionGeometry(whale, width, height, count, size = 1) {
  const areaScale = Math.min(width / 1600, height / 900, 1.25);
  const density = Math.min(1, Math.sqrt(3 / Math.max(1, count)));
  const depth = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5);
  const variation = 0.98 + Math.sin(motionFinite(whale.phase, 0) + 0.7) * 0.035;
  const anatomy = whaleSpecies(whale.species);
  const scale = 495 / (1 + depth * 0.48) * variation * areaScale * density * anatomy.size * size;
  // At the default 1 the expression is exactly the 0.8.0 length (same formula,
  // same 560 px ceiling, `* 1` is exact). The ceiling rises with the slider for
  // larger whales; below 1 the formula is already smaller than 560, so the cap
  // can stay, and the slider always visibly changes the body.
  whale.length = Math.min(560 * Math.max(1, size), scale);
  whale.halfLength = whale.length * 0.5;
  whale.bodyRadius = whale.length * Math.max(...anatomy.profile.map(point => point[1])) / 2.24;
  whale.bodyWidth = whale.bodyRadius * 2;
}

function motionLayout(index, count) {
  if (count === 1) return [0.24, 0.30];
  if (count === 2) return index === 0 ? [0.22, 0.30] : [0.78, 0.70];
  if (count === 3) return [[0.20, 0.27], [0.79, 0.29], [0.50, 0.77]][index];
  const columns = count <= 6 ? Math.ceil(count / 2) : 4;
  const column = index % columns, row = Math.floor(index / columns);
  return [0.14 + column * 0.72 / Math.max(1, columns - 1), 0.25 + row * 0.50];
}

function motionTarget(whale, width, height, first = false, obstacles = null) {
  const state = whale._motion;
  if (first) {
    const quadrant = whale.y < height * 0.5
      ? (whale.x < width * 0.5 ? 0 : 1)
      : (whale.x < width * 0.5 ? 3 : 2);
    state.targetIndex = (quadrant + state.routeDirection + 4) % 4;
  } else state.targetIndex = (state.targetIndex + state.routeDirection + 4) % 4;
  // Each destination is independently jittered. Visiting successive regions
  // provides broad exploration without prescribing the path between them.
  const right = state.targetIndex === 1 || state.targetIndex === 2;
  const bottom = state.targetIndex >= 2;
  state.targetX = width * ((right ? 0.83 : 0.17) + (motionRandom(state) - 0.5) * 0.075);
  state.targetY = height * ((bottom ? 0.77 : 0.23) + (motionRandom(state) - 0.5) * 0.10);
  // A destination inside the input card would keep the whale pressed against the
  // obstacle for a whole route leg, so it is moved to the nearest point outside.
  const safe = motionAvoidTarget(whale, state.targetX, state.targetY, obstacles, width, height);
  state.targetX = safe.x;
  state.targetY = safe.y;
  const cruise = state.cruise * Math.min(1, Math.min(width, height) / 650);
  const travel = Math.hypot(state.targetX - whale.x, state.targetY - whale.y) / Math.max(1, cruise);
  state.targetDue = state.age + motionLimit(travel * 1.5 + 8, 18, 110);
}

// The body is a long capsule, not a point: five stations along the spine cover
// nose-to-fluke. Each station carries the silhouette half-width of that part of
// the whale (flukes at the tail, flipper tips mid-body), because those extremit-
// ies are what leaked into the card while the spine itself was clear (T3c found
// fluke and fin cells inside it). The line runs from tail to nose.
const motionBodySampleU = Object.freeze([-0.5357142857142857, -0.2857142857142857,
  -0.0357142857142857, 0.2142857142857143, 0.4642857142857143]);
// A glyph cell is wider than the spine: half a cell can still reach past a
// station that sits exactly on the boundary. This gap keeps every cell centre
// outside the card, which is the visible definition of "the body avoids it".
const motionBodyClearance = 12;

/**
 * How wide the silhouette is around each of the five stations, in canvas pixels,
 * scaled from the species anatomy by the body length.
 */
function motionStationRadii(whale) {
  const anatomy = whaleSpecies(whale.species);
  const unit = Math.max(0, motionFinite(whale.length, 0)) / 2.24;
  const body = Math.max(0, motionFinite(whale.bodyRadius, 0));
  const fluke = anatomy.fluke.span * unit;
  const flipperTip = Math.abs(anatomy.flipper.tip[2]) * unit;
  const flipperRoot = Math.abs(anatomy.flipper.root[2]) * unit + anatomy.flipper.width * unit;
  return [
    fluke,                                          // fluke lobes at the tail
    Math.max(body * 0.6, fluke * 0.45),             // peduncle
    Math.max(body, flipperTip),                     // mid-body: flipper tips reach widest here
    Math.max(body, flipperRoot),                    // chest: flipper roots
    body * 0.25,                                    // snout
  ];
}

/** Station points with the silhouette half-extent at each: flat [x,y,r, ...]. */
function motionBodyHull(whale) {
  const length = motionFinite(whale.length, 0);
  const x = motionFinite(whale.x, 0), y = motionFinite(whale.y, 0);
  const radii = motionStationRadii(whale);
  const hull = [];
  if (!(length > 0)) return [x, y, Math.max(0, motionFinite(whale.bodyRadius, 0)) + motionBodyClearance];
  const c = Math.cos(motionFinite(whale.heading, 0)), s = Math.sin(motionFinite(whale.heading, 0));
  for (let i = 0; i < motionBodySampleU.length; i++) {
    const u = motionBodySampleU[i];
    hull.push(x + c * length * u, y + s * length * u, radii[i] + motionBodyClearance);
  }
  return hull;
}

/** Widest clearance any part of this whale keeps around an obstacle. */
function motionHullReach(whale) {
  let reach = 0;
  for (const radius of motionStationRadii(whale)) reach = Math.max(reach, radius);
  return reach + motionBodyClearance;
}

/** Soft boundary of one obstacle for one point, grown by that point's allowance. */
function motionObstacleBounds(obstacle, allowance) {
  if (obstacle.circle) {
    const reach = obstacle.radius + allowance;
    return { left: obstacle.x - reach, right: obstacle.x + reach,
      top: obstacle.y - reach, bottom: obstacle.y + reach };
  }
  return { left: obstacle.x - allowance, right: obstacle.x + obstacle.width + allowance,
    top: obstacle.y - allowance, bottom: obstacle.y + obstacle.height + allowance };
}

/**
 * Obstacles are canvas-space shapes the school must swim around. The reading
 * column and the input card are rectangles; reefs are circles, because a
 * bounding box would make the school dodge the empty corners of a round rock.
 * Anything unusable is dropped so a broken measurement can never push a whale
 * to NaN.
 */
function motionObstacleNormalize(obstacles) {
  if (!Array.isArray(obstacles)) return [];
  const normalized = [];
  for (const obstacle of obstacles) {
    if (!obstacle) continue;
    const x = Number(obstacle.x), y = Number(obstacle.y);
    const width = Number(obstacle.width), height = Number(obstacle.height);
    const radius = Number(obstacle.radius);
    // No extent plus a positive radius means a circle (see reef.js). A rect may
    // also carry a corner radius, so the extent check decides the shape.
    if (!(width > 0) && !(height > 0)) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || !(radius > 0)) continue;
      normalized.push({ x, y, radius, circle: true });
      continue;
    }
    if (![x, y, width, height].every(Number.isFinite) || !(width > 0) || !(height > 0)) continue;
    normalized.push({ x, y, width, height,
      radius: motionLimit(motionFinite(radius, 0), 0, Math.min(width, height) / 2) });
  }
  return normalized;
}

/**
 * How close a point is to the soft boundary, as a signed distance plus the
 * outward normal. Positive depth is inside (nearest edge decides the normal);
 * negative depth is outside and still within `band`, where the whale should
 * already begin to turn — the clamp alone would leave it sliding along the
 * glass, so the steering has to anticipate rather than react *inside* it.
 */
function motionObstacleApproach(obstacle, allowance, x, y, band) {
  if (obstacle.circle) {
    // Radial signed distance: positive inside the rock plus the hull's own
    // clearance, negative outside and still inside the turning band.
    const dx = x - obstacle.x, dy = y - obstacle.y;
    const distance = Math.hypot(dx, dy);
    const clearance = obstacle.radius + allowance;
    const gap = distance - clearance;
    if (!(gap < band)) return null;
    if (distance > 1e-6) return { depth: -gap, nx: dx / distance, ny: dy / distance };
    return { depth: -gap, nx: 1, ny: 0 };
  }
  const { left, right, top, bottom } = motionObstacleBounds(obstacle, allowance);
  const insideX = x > left && x < right, insideY = y > top && y < bottom;
  if (insideX && insideY) {
    const toLeft = x - left, toRight = right - x, toTop = y - top, toBottom = bottom - y;
    return Math.min(toLeft, toRight) <= Math.min(toTop, toBottom)
      ? { depth: Math.min(toLeft, toRight), nx: toLeft < toRight ? -1 : 1, ny: 0 }
      : { depth: Math.min(toTop, toBottom), nx: 0, ny: toTop < toBottom ? -1 : 1 };
  }
  const gapX = insideX ? 0 : Math.max(left - x, x - right, 0);
  const gapY = insideY ? 0 : Math.max(top - y, y - bottom, 0);
  const gap = Math.hypot(gapX, gapY);
  if (!(gap < band)) return null;
  const awayX = insideX ? 0 : x <= left ? -1 : x >= right ? 1 : 0;
  const awayY = insideY ? 0 : y <= top ? -1 : y >= bottom ? 1 : 0;
  const length = Math.hypot(awayX, awayY) || 1;
  return { depth: -gap, nx: awayX / length, ny: awayY / length };
}

/**
 * The body station with the least clearance (deepest penetration when inside).
 * Steering follows that station, so a stretched snout or a wide fluke starts
 * turning before the body centre would have noticed the card at all.
 */
function motionObstacleApproachBody(whale, obstacle, band) {
  const hull = motionBodyHull(whale);
  let closest = null;
  for (let i = 0; i < hull.length; i += 3) {
    const hit = motionObstacleApproach(obstacle, hull[i + 2], hull[i], hull[i + 1], band);
    if (!hit) continue;
    if (!closest || hit.depth < closest.depth) closest = hit;
  }
  return closest;
}

/** True when this station's silhouette disc reaches into the obstacle bounds. */
function motionHullInside(obstacle, x, y, radius) {
  if (obstacle.circle) return Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius + radius;
  const { left, right, top, bottom } = motionObstacleBounds(obstacle, radius);
  return x > left && x < right && y > top && y < bottom;
}

/**
 * Move the body rigidly until every station's silhouette is outside the
 * obstacles, keeping the whale on the canvas.
 *
 * A rigid translation is what a swimming animal can do in one tick: it cannot
 * bend to clear both sides of a card, so the move is chosen as the shortest one
 * that works for the widest station. Exits that would push the centre off the
 * sea are skipped while another exit exists; if the obstacle fills the sea the
 * canvas bound still wins, which is safer than a whale outside its own window.
 *
 * Returns true when the position changed.
 */
function motionPushOut(whale, obstacles, width, height) {
  if (!obstacles || !obstacles.length) return false;
  let moved = false;
  // Several passes: clearing one side can leave a different station inside the
  // same obstacle (a body diagonal across a corner), and one obstacle can push
  // into another.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const obstacle of obstacles) {
      const hull = motionBodyHull(whale);
      if (obstacle.circle) {
        // A round rock has no sides to slide along, so the rigid move is radial:
        // away from the rock centre, far enough for the last-reaching station.
        const centreX = motionFinite(whale.x, 0), centreY = motionFinite(whale.y, 0);
        let dx = centreX - obstacle.x, dy = centreY - obstacle.y;
        let length = Math.hypot(dx, dy);
        if (!(length > 0.001)) {
          dx = Math.cos(motionFinite(whale.heading, 0));
          dy = Math.sin(motionFinite(whale.heading, 0));
          length = 1;
        }
        const nx = dx / length, ny = dy / length;
        let shift = 0;
        for (let i = 0; i < hull.length; i += 3) {
          const clearance = obstacle.radius + hull[i + 2];
          if (!(Math.hypot(hull[i] - obstacle.x, hull[i + 1] - obstacle.y) < clearance)) continue;
          shift = Math.max(shift, clearance - ((hull[i] - obstacle.x) * nx + (hull[i + 1] - obstacle.y) * ny));
        }
        if (shift > 0) {
          whale.x = motionLimit(centreX + nx * shift, 0, width);
          whale.y = motionLimit(centreY + ny * shift, 0, height);
          moved = changed = true;
        }
        continue;
      }
      let leftShift = 0, rightShift = 0, upShift = 0, downShift = 0, inside = false;
      for (let i = 0; i < hull.length; i += 3) {
        const x = hull[i], y = hull[i + 1], radius = hull[i + 2];
        if (!motionHullInside(obstacle, x, y, radius)) continue;
        inside = true;
        const bounds = motionObstacleBounds(obstacle, radius);
        leftShift = Math.max(leftShift, x - bounds.left);
        rightShift = Math.max(rightShift, bounds.right - x);
        upShift = Math.max(upShift, y - bounds.top);
        downShift = Math.max(downShift, bounds.bottom - y);
      }
      if (!inside) continue;
      const centreX = motionFinite(whale.x, 0), centreY = motionFinite(whale.y, 0);
      const candidates = [
        { dx: -leftShift, dy: 0, distance: leftShift },
        { dx: rightShift, dy: 0, distance: rightShift },
        { dx: 0, dy: -upShift, distance: upShift },
        { dx: 0, dy: downShift, distance: downShift },
      ].sort((a, b) => a.distance - b.distance);
      // Prefer an exit that keeps the centre on the canvas; only when every exit
      // would leave it does the shortest one win, and the canvas clamp below keeps
      // the whale inside its own window.
      const move = candidates.find(candidate => {
        const x = centreX + candidate.dx, y = centreY + candidate.dy;
        return x >= 0 && x <= width && y >= 0 && y <= height;
      }) || candidates[0];
      whale.x = motionLimit(centreX + move.dx, 0, width);
      whale.y = motionLimit(centreY + move.dy, 0, height);
      moved = changed = true;
    }
    if (!changed) break;
  }
  if (moved) updateWhaleRig(whale);
  return moved;
}

/** Move a route target out of an obstacle, preferring the closest point above it. */
function motionAvoidTarget(whale, x, y, obstacles, width, height) {
  if (!obstacles || !obstacles.length) return { x, y };
  const allowance = motionHullReach(whale) + Math.max(8, motionFinite(whale.length, 0) * 0.08);
  for (const obstacle of obstacles) {
    if (obstacle.circle) {
      const clearance = obstacle.radius + allowance;
      const dx = x - obstacle.x, dy = y - obstacle.y;
      const distance = Math.hypot(dx, dy);
      if (!(distance < clearance)) continue;
      const nx = distance > 0.001 ? dx / distance : 1, ny = distance > 0.001 ? dy / distance : 0;
      x = motionLimit(obstacle.x + nx * clearance, 0, width);
      y = motionLimit(obstacle.y + ny * clearance, 0, height);
      continue;
    }
    const { left, right, top, bottom } = motionObstacleBounds(obstacle, allowance);
    if (!(x > left && x < right && y > top && y < bottom)) continue;
    if (top >= 0) { x = motionLimit(x, 0, width); y = top; continue; }
    if (bottom <= height) { y = bottom; continue; }
    x = motionLimit(x - left < right - x ? left : right, 0, width);
  }
  return { x, y };
}

/**
 * Install the obstacles the school must swim around and fix the current frame.
 *
 * Called right after the input card is measured, so a config change or a scroll
 * takes effect before the next animation tick; this is also what makes reduced
 * motion correct, where the scene never steps and only paints.
 *
 * The list is copied, not shared, and `[]` restores the pre-obstacle behaviour.
 */
function setSceneObstacles(scene, obstacles) {
  if (!scene) return [];
  const normalized = motionObstacleNormalize(obstacles);
  scene.obstacles = normalized;
  const width = motionFinite(scene.width, 0), height = motionFinite(scene.height, 0);
  if (!normalized.length || !(width > 0) || !(height > 0)) return normalized;
  for (const whale of scene.whales || []) {
    motionPushOut(whale, normalized, width, height);
    if (whale._motion) {
      const target = motionAvoidTarget(whale, whale._motion.targetX, whale._motion.targetY, normalized, width, height);
      whale._motion.targetX = target.x;
      whale._motion.targetY = target.y;
    }
  }
  return normalized;
}

/** Resize existing objects; a resize never restarts their route or clock. */
function resizeScene(scene, width, height) {
  width = Math.max(1, motionFinite(width, 1));
  height = Math.max(1, motionFinite(height, 1));
  const oldWidth = scene.width > 0 ? scene.width : width;
  const oldHeight = scene.height > 0 ? scene.height : height;
  const size = motionLimit(motionFinite(scene.whaleSize, 1), motionWhaleSizeFloor, motionWhaleSizeCeiling);
  scene.time = motionFinite(scene.time, 0);
  scene.accumulator = motionFinite(scene.accumulator, 0);
  // Obstacles are stored in canvas pixels, so a resize scales them with the sea.
  // Without obstacles these lines do nothing and the old numbers are untouched.
  if (scene.obstacles && scene.obstacles.length) {
    const scaleX = width / oldWidth, scaleY = height / oldHeight;
    for (const obstacle of scene.obstacles) {
      obstacle.x *= scaleX; obstacle.y *= scaleY;
      if (obstacle.circle) {
        obstacle.radius *= Math.min(scaleX, scaleY);
        continue;
      }
      obstacle.width *= scaleX; obstacle.height *= scaleY;
    }
  }
  const whales = scene.whales || [];
  for (let i = 0; i < whales.length; i++) {
    const whale = whales[i];
    motionGeometry(whale, width, height, whales.length, size);
    if (whale._motion) {
      whale.x *= width / oldWidth;
      whale.y *= height / oldHeight;
      whale._motion.targetX *= width / oldWidth;
      whale._motion.targetY *= height / oldHeight;
      const previousPace = Math.min(1, Math.min(oldWidth, oldHeight) / 650);
      const nextPace = Math.min(1, Math.min(width, height) / 650);
      whale.speed *= nextPace / Math.max(1 / 650, previousPace);
    } else {
      const state = whale._motion = { seed: motionSeed(whale, i), age: 0,
        routeDirection: i % 2 ? -1 : 1, targetIndex: 0, wander: 0,
        wanderGoal: 0, wanderDue: 0, wave: motionFinite(whale.phase, 0),
        submergence: 0, pitch: 0, noseFirst: false, depth: 0, tailKick: 0, arch: 0 };
      const anatomy = whaleSpecies(whale.species);
      state.cruise = anatomy.cruise * (0.94 + motionRandom(state) * 0.12);
      state.agility = anatomy.turnRate * (0.96 + motionRandom(state) * 0.08);
      state.stroke = 1;
      const [x, y] = motionLayout(i, whales.length);
      whale.x = width * x;
      whale.y = height * y;
      whale.heading = [0.28, 2.72, -0.88, 1.85, -2.1, 0.95, -0.4, 2.1][i % 8]
        + (motionRandom(state) - 0.5) * 0.18;
      whale.turn = 0;
      whale.speed = state.cruise * Math.min(1, Math.min(width, height) / 650);
      motionTarget(whale, width, height, true, scene.obstacles);
    }
    whale.vx = Math.cos(whale.heading) * whale.speed;
    whale.vy = Math.sin(whale.heading) * whale.speed;
    resizeWhaleRig(whale, width / oldWidth, height / oldHeight);
  }
  // Scaling can carry a whale into the (scaled) obstacle: fix that in the same
  // pass, before anything is painted.
  if (scene.obstacles && scene.obstacles.length) {
    for (const whale of whales) motionPushOut(whale, scene.obstacles, width, height);
  }
  scene.width = width;
  scene.height = height;
  return scene;
}

/**
 * Carry the swimming state of one scene into the scene that replaces it.
 *
 * A settings change that touches count/text/species/whaleSize builds a new
 * scene from scratch. Without this hand-over the school would jump back to its
 * start layout on every such write; here each whale with the same id keeps its
 * position, heading, turn, speed, velocity, route state (`_motion`) and spine.
 *
 * The caller sizes `next` to the same on-screen space as `previous` first, so
 * the copied coordinates are already valid. Geometry (length, radii) and the
 * new particle budget are owned by `next`; nothing here touches the clock, the
 * DOM or global state, which is what makes the function unit-testable.
 *
 * Returns the number of whales that were migrated.
 */
function adoptSceneState(previous, next) {
  if (!previous || !next || previous === next) return 0;
  const sources = new Map();
  for (const whale of previous.whales || []) {
    if (whale && whale.id !== undefined) sources.set(whale.id, whale);
  }
  let adopted = 0;
  for (const whale of next.whales || []) {
    const source = sources.get(whale.id);
    if (!source || source === whale) continue;
    for (const key of ['x', 'y', 'heading', 'turn', 'speed', 'vx', 'vy']) {
      if (Number.isFinite(source[key])) whale[key] = source[key];
    }
    if (source._motion) {
      whale._motion = { ...source._motion };
      // Dive scheduling owns a separate random stream and duration snapshot.
      // A rebuilt scene must continue it without mutating the discarded scene.
      if (source._motion.dive) whale._motion.dive = { ...source._motion.dive };
    }
    // `_motion` carries the species base cruise/turn values with the individual
    // jitter already baked in. On a species switch (mixed group <-> one species)
    // the rebuilt whale must swim with the new anatomy straight away, so rescale
    // those two by the base-parameter ratio while keeping the same relative
    // variation. A same-species hand-over is left completely untouched.
    const previousAnatomy = whaleSpecies(source.species), nextAnatomy = whaleSpecies(whale.species);
    if (previousAnatomy !== nextAnatomy && whale._motion) {
      whale._motion.cruise *= nextAnatomy.cruise / previousAnatomy.cruise;
      whale._motion.agility *= nextAnatomy.turnRate / previousAnatomy.turnRate;
    }
    // The spine is normalized by the body length, so after a size change one
    // stale frame would show the old silhouette. Allocate a correctly shaped
    // rig, keep the old nodes when they fit, and re-anchor them to the new length
    // with updateWhaleRig: the bend continues, only the scale is refreshed.
    resetWhaleRig(whale);
    const nodes = source.rig && source.rig.nodes;
    if (nodes && nodes.length === whale.rig.nodes.length) {
      whale.rig.nodes.set(nodes);
      updateWhaleRig(whale);
    }
    adopted++;
  }
  return adopted;
}

// Find the closest pair of samples on two heading-extended bodies, including
// where those bodies will be after a short coast. A center-only check misses
// a nose crossing another whale's tail.
function motionBodyContact(a, b, horizon) {
  const ac = Math.cos(a.heading), as = Math.sin(a.heading);
  const bc = Math.cos(b.heading), bs = Math.sin(b.heading);
  let bestSquared = Infinity, bestX = 0, bestY = 0;
  for (const ahead of [0, horizon]) {
    const dx = a.x - b.x + (a.vx - b.vx) * ahead;
    const dy = a.y - b.y + (a.vy - b.vy) * ahead;
    for (let i = -2; i <= 2; i++) {
      const ax = dx + ac * a.length * i * 0.225;
      const ay = dy + as * a.length * i * 0.225;
      for (let j = -2; j <= 2; j++) {
        const x = ax - bc * b.length * j * 0.225;
        const y = ay - bs * b.length * j * 0.225;
        const squared = x * x + y * y;
        if (squared < bestSquared) { bestSquared = squared; bestX = x; bestY = y; }
      }
    }
  }
  return { distance: Math.sqrt(bestSquared), x: bestX, y: bestY };
}

function motionIntegrate(scene, speed) {
  const whales = scene.whales, width = scene.width, height = scene.height;
  const environmentSpeed = Math.min(1, Math.min(width, height) / 650);
  const obstacles = scene.obstacles;
  const forces = whales.map(() => ({ x: 0, y: 0, caution: 0 }));
  // Accumulate reciprocal forces before moving any body, so update order
  // cannot give a whale an advantage over its neighbor.
  for (let i = 0; i < whales.length; i++) {
    const a = whales[i];
    for (let j = i + 1; j < whales.length; j++) {
      const b = whales[j], dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
      const relativeSpeedSquared = dvx * dvx + dvy * dvy;
      const intercept = relativeSpeedSquared > 0.001
        ? motionLimit(-(dx * dvx + dy * dvy) / relativeSpeedSquared, 0, 2.6 / Math.max(0.3, speed)) : 0;
      const contact = motionBodyContact(a, b, intercept);
      const personalSpace = (a.length + b.length) * 0.53;
      const centerThreat = Math.max(0, 1 - distance / Math.max(1, personalSpace));
      const clearance = a.bodyRadius + b.bodyRadius + Math.min(a.length, b.length) * 0.12;
      const bodyThreat = Math.max(0, 1 - contact.distance / Math.max(1, clearance));
      if (centerThreat <= 0 && bodyThreat <= 0) continue;
      let pushX = -dx / (distance || 1) * centerThreat * 2.8;
      let pushY = -dy / (distance || 1) * centerThreat * 2.8;
      const normalX = -Math.sin(a.heading), normalY = Math.cos(a.heading);
      const side = dx * normalX + dy * normalY;
      const sideSign = side > clearance * 0.30 ? -1 : 1;
      const awayX = contact.distance > 0.01 ? contact.x / contact.distance : normalX * sideSign;
      const awayY = contact.distance > 0.01 ? contact.y / contact.distance : normalY * sideSign;
      pushX += awayX * bodyThreat * 3.0;
      pushY += awayY * bodyThreat * 3.0;
      if (intercept > 0.05) {
        // Give an exactly head-on encounter a stable passing side instead of
        // asking both animals to reverse along the same line.
        pushX += normalX * sideSign * bodyThreat * 4.5;
        pushY += normalY * sideSign * bodyThreat * 4.5;
      }
      forces[i].x += pushX; forces[i].y += pushY;
      forces[j].x -= pushX; forces[j].y -= pushY;
      forces[i].caution = Math.max(forces[i].caution, bodyThreat);
      forces[j].caution = Math.max(forces[j].caution, bodyThreat);
    }
  }
  for (let i = 0; i < whales.length; i++) {
    const whale = whales[i], state = whale._motion, force = forces[i];
    const travelTick = motionTick * speed;
    state.age += travelTick;
    if (state.age >= state.targetDue
      || Math.hypot(state.targetX - whale.x, state.targetY - whale.y) < Math.max(8, whale.length * 0.14)) {
      motionTarget(whale, width, height, false, obstacles);
    }
    if (state.age >= state.wanderDue) {
      state.wanderGoal = (motionRandom(state) - 0.5) * 0.42;
      state.wanderDue = state.age + 8 + motionRandom(state) * 8;
    }
    state.wander += (state.wanderGoal - state.wander) * (1 - Math.exp(-travelTick * 0.5));
    const dx = state.targetX - whale.x, dy = state.targetY - whale.y;
    const targetDistance = Math.hypot(dx, dy) || 1;
    const forwardX = Math.cos(whale.heading), forwardY = Math.sin(whale.heading);
    if (obstacles && obstacles.length) {
      // The band is where steering starts: outside the clamp boundary but close
      // enough to turn, measured from the nearest body station (hull included) so
      // a long snout or a wide fluke banks away while the centre still looks far.
      const band = Math.max(48, motionHullReach(whale) * 2, whale.length * 0.14);
      let caution = 0;
      for (const obstacle of obstacles) {
        const hit = motionObstacleApproachBody(whale, obstacle, band);
        if (!hit) continue;
        const depth = hit.depth;
        // Positive depth pushes hard; the outer band only nudges. A body drifting
        // near the glass is turned gently, one already inside is pushed firmly.
        const push = depth >= 0
          ? 0.9 + 5.4 * Math.min(1.6, depth / Math.max(24, whale.bodyRadius))
          : 0.9 * (1 + depth / band);
        force.x += hit.nx * push;
        force.y += hit.ny * push;
        // A normal-only push can stall the whale head-on against the edge; the
        // tangential part turns it into a swim-around. The side it already faces
        // wins, so the two directions never fight.
        const tangentX = -hit.ny, tangentY = hit.nx;
        const side = Math.sign(forwardX * tangentX + forwardY * tangentY) || state.routeDirection || 1;
        const steer = depth >= 0 ? 1.2 : 0.9 * (1 + depth / band);
        force.x += tangentX * side * steer;
        force.y += tangentY * side * steer;
        caution = Math.max(caution, depth >= 0 ? Math.min(1, depth / Math.max(24, whale.bodyRadius)) : (1 + depth / band) * 0.5);
      }
      // Slow down near the card instead of gliding into it at cruise speed.
      if (caution > 0) force.caution = Math.max(force.caution, caution * 0.55);
    }
    let desiredX = dx / targetDistance * 1.5 + forwardX * 0.85
      + Math.cos(whale.heading + state.wander) * 0.35 + force.x;
    let desiredY = dy / targetDistance * 1.5 + forwardY * 0.85
      + Math.sin(whale.heading + state.wander) * 0.35 + force.y;
    const turnLimit = state.agility * Math.sqrt(speed);
    const cruise = state.cruise * environmentSpeed * speed;
    // Look beyond the snout by more than a turning radius. The response is
    // continuous; even a body temporarily outside the view swims back in.
    const lookAhead = whale.length * 0.22 + cruise / Math.max(0.08, turnLimit) * 0.95;
    const lookX = whale.x + forwardX * lookAhead, lookY = whale.y + forwardY * lookAhead;
    const marginX = Math.min(width * 0.17, whale.length * 0.24 + width * 0.025);
    const marginY = Math.min(height * 0.18, whale.length * 0.17 + height * 0.025);
    const left = motionLimit((marginX - lookX) / Math.max(1, marginX), 0, 3);
    const right = motionLimit((lookX - width + marginX) / Math.max(1, marginX), 0, 3);
    const top = motionLimit((marginY - lookY) / Math.max(1, marginY), 0, 3);
    const bottom = motionLimit((lookY - height + marginY) / Math.max(1, marginY), 0, 3);
    desiredX += (left * left - right * right) * 7;
    desiredY += (top * top - bottom * bottom) * 7;
    // A neighbor can push the center outward while the snout already points
    // inward. Retain a positional restoring force during that recovery.
    const centerLeft = motionLimit((marginX * 0.6 - whale.x) / Math.max(1, marginX), 0, 4);
    const centerRight = motionLimit((whale.x - width + marginX * 0.6) / Math.max(1, marginX), 0, 4);
    const centerTop = motionLimit((marginY * 0.6 - whale.y) / Math.max(1, marginY), 0, 4);
    const centerBottom = motionLimit((whale.y - height + marginY * 0.6) / Math.max(1, marginY), 0, 4);
    desiredX += (centerLeft * centerLeft - centerRight * centerRight) * 14;
    desiredY += (centerTop * centerTop - centerBottom * centerBottom) * 14;
    let steeringError = motionAngle(whale.heading, Math.atan2(desiredY, desiredX));
    if (Math.abs(steeringError) > 2.5) {
      const turnSide = Math.abs(whale.turn) > 0.05 ? Math.sign(whale.turn) : state.routeDirection;
      steeringError = Math.abs(steeringError) * turnSide;
    }
    const requestedTurn = motionLimit(steeringError * 1.1, -turnLimit, turnLimit);
    whale.turn += (requestedTurn - whale.turn) * (1 - Math.exp(-motionTick * 1.7));
    whale.turn = motionLimit(whale.turn, -turnLimit, turnLimit);
    whale.heading += whale.turn * motionTick;
    const brakingX = marginX + cruise / Math.max(0.1, turnLimit);
    const brakingY = marginY + cruise / Math.max(0.1, turnLimit);
    const outward = Math.max(
      -forwardX * motionLimit(1 - whale.x / Math.max(1, brakingX), 0, 1),
      forwardX * motionLimit(1 - (width - whale.x) / Math.max(1, brakingX), 0, 1),
      -forwardY * motionLimit(1 - whale.y / Math.max(1, brakingY), 0, 1),
      forwardY * motionLimit(1 - (height - whale.y) / Math.max(1, brakingY), 0, 1), 0);
    const targetSpeed = cruise * (1 - force.caution * 0.3) * (1 - outward * 0.65)
      * (1 - 0.12 * Math.abs(whale.turn) / Math.max(0.01, turnLimit));
    whale.speed += (targetSpeed - whale.speed) * (1 - Math.exp(-motionTick * (0.8 + outward * 1.6)));
    whale.vx = Math.cos(whale.heading) * whale.speed;
    whale.vy = Math.sin(whale.heading) * whale.speed;
    whale.x += whale.vx * motionTick;
    whale.y += whale.vy * motionTick;
    updateWhaleRig(whale);
    // The force steers, but only the clamp guarantees the invariant (a strong
    // neighbor push can still cross the boundary for a tick).
    if (obstacles && obstacles.length) motionPushOut(whale, obstacles, width, height);
    const effort = whale.speed / Math.max(1, state.cruise * environmentSpeed);
    const anatomy = whaleSpecies(whale.species);
    // Two smooth strokes followed by a coast. These durations are deliberately
    // calm decoration settings, not measured swimming periods for each species.
    const active = Math.PI * 4 / anatomy.beat, rest = active * anatomy.glide / (1 - anatomy.glide);
    const gait = (state.age + whale.phase * 1.7) % (active + rest);
    const easeStroke = value => { const t = motionLimit(value, 0, 1); return t * t * (3 - 2 * t); };
    const envelope = gait < active ? easeStroke(gait / 1.1) * easeStroke((active - gait) / 1.1) : 0;
    state.stroke += (envelope - state.stroke) * (1 - Math.exp(-travelTick * 2.2));
    state.wave += travelTick * anatomy.beat * (0.7 + 0.3 * Math.min(1.4, Math.sqrt(effort)))
      * (0.08 + 0.92 * state.stroke);
    motionStepDive(whale, i, scene.diveSeed, anatomy, travelTick);
  }
  scene.time += motionTick;
}

function diveSmoothstep(amount) {
  const u = amount < 0 ? 0 : amount > 1 ? 1 : amount;
  return u * u * (3 - 2 * u);
}

// Hash a separate stream from identity, never from the mutable cruise seed.
// Optional scene.diveSeed (or whale.diveSeed) is read only at the first tick,
// allowing the engine to supply session entropy after createScene's resize.
function motionDiveSeed(whale, index, sceneSeed) {
  const supplied = motionFinite(whale.diveSeed, motionFinite(sceneSeed, 0)) >>> 0;
  let seed = (motionSeed(whale, index) ^ supplied ^ 0x91e10da5) >>> 0;
  seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b);
  seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35);
  return (seed ^ (seed >>> 16)) >>> 0;
}

function motionStepDive(whale, index, sceneSeed, anatomy, dt) {
  const state = whale._motion;
  if (!state.dive) {
    const dive = state.dive = { seed: motionDiveSeed(whale, index, sceneSeed),
      activity: 0, nextDecision: 0, startedAt: null, entry: 0, under: 0, exit: 0,
      decisions: 0, skipped: 0, dives: 0, completed: 0,
      splashSerial: 0, splashKind: 'dive', splashStrength: 0, contactStage: 0 };
    dive.activity = 0.32 + motionRandom(dive) * 0.36;
    dive.nextDecision = Math.max(6, state.age - dt) + 2 + motionRandom(dive) * 16;
  }
  const dive = state.dive;
  const surfacePace = motionLimit(22 / anatomy.cruise, 0.75, 1.3);
  if (dive.startedAt !== null && state.age >= dive.startedAt + dive.entry + dive.under + dive.exit) {
    const endedAt = dive.startedAt + dive.entry + dive.under + dive.exit;
    dive.startedAt = null;
    dive.completed++;
    dive.nextDecision = endedAt + (10 + motionRandom(dive) * 16) * surfacePace;
  }
  if (dive.startedAt === null && state.age >= dive.nextDecision) {
    dive.decisions++;
    if (motionRandom(dive) < dive.activity) {
      dive.startedAt = dive.nextDecision;
      dive.dives++;
      dive.contactStage = 0;
      // Snapshot the whole action. Later species/size changes do not truncate it.
      dive.entry = 2 + motionRandom(dive) * 2;
      dive.under = (3 + motionRandom(dive) * 4) * motionLimit(anatomy.glide / 0.32, 0.8, 1.5);
      dive.exit = 2.4 + motionRandom(dive) * 1.6;
    } else {
      dive.skipped++;
      dive.nextDecision += (5 + motionRandom(dive) * 10) * surfacePace;
    }
  }
  const pose = dive.startedAt === null ? diveLevel() : divePose(state.age - dive.startedAt, dive);
  state.submergence = pose.submergence;
  state.pitch = pose.pitch;
  state.noseFirst = pose.noseFirst;
  state.depth = pose.depth;
  state.tailKick = pose.tailKick;
  state.arch = pose.arch;
  if (dive.startedAt !== null && dive.contactStage < 2) {
    const elapsed = state.age - dive.startedAt;
    const isTail = dive.contactStage === 0;
    // Tail: wait until after the lift. Nose: wait until the ascent starts.
    // The height then comes from the very same rig, gait and curve as the mesh.
    if (elapsed >= (isTail ? dive.entry * 0.46 : dive.entry + dive.under)) {
      const contactPose = writeWhaleRigPose(whale, { wave: state.wave, turn: whale.turn,
        submergence: state.submergence, divePitch: state.pitch, diveDepth: state.depth,
        diveKick: state.tailKick, diveArch: state.arch });
      const point = isTail ? motionDiveTailContact : motionDiveNoseContact;
      const height = deformWhaleParticle(point, contactPose, motionDiveContactOut).y;
      if (isTail ? height >= DIVE_WATERLINE : height <= DIVE_WATERLINE) {
        dive.splashSerial++;
        dive.splashKind = isTail ? 'dive' : 'surface';
        dive.splashStrength = isTail ? 0.95 : 0.9;
        dive.contactStage++;
      }
    }
  }
}

// Reused probes and output avoid allocating a particle per tick. Contact state
// stays primitive so adopting a scene can keep its existing independent clone.
const motionDiveTailContact = Object.freeze({ x: -1.05, y: 0.01, z: 0,
  nx: 0, ny: -1, nz: 0, part: 'fluke' });
const motionDiveNoseContact = Object.freeze({ x: 1.04, y: -0.08, z: 0,
  nx: 0, ny: -1, nz: 0, part: 'body' });
const motionDiveContactOut = {};

function motionEnsureDive(state) {
  if (!Number.isFinite(state.submergence)) state.submergence = 0;
  if (!Number.isFinite(state.pitch)) state.pitch = 0;
  if (!Number.isFinite(state.depth)) state.depth = 0;
  if (!Number.isFinite(state.tailKick)) state.tailKick = 0;
  if (!Number.isFinite(state.arch)) state.arch = 0;
  if (state.noseFirst !== true && state.noseFirst !== false) state.noseFirst = false;
}

function diveLevel() {
  return { submergence: 0, pitch: 0, noseFirst: false, depth: 0, tailKick: 0, arch: 0 };
}

/** Pure pose for one sampled action; elapsed starts at entry, never repeats. */
function divePose(elapsed, timing) {
  if (!Number.isFinite(elapsed) || !timing) return diveLevel();
  const { entry, under, exit } = timing;
  if (![entry, under, exit].every(value => Number.isFinite(value) && value > 0)
    || elapsed <= 0 || elapsed >= entry + under + exit) return diveLevel();
  let t = elapsed;
  if (t < entry) {
    const u = t / entry;
    const submergence = diveSmoothstep(u);
    const pitch = u < 0.38 ? 0.5 * diveSmoothstep(u / 0.38)
      : 0.5 + 0.22 * diveSmoothstep((u - 0.38) / 0.62);
    const depth = 0.12 * diveSmoothstep((u - 0.2) / 0.35)
      + 1.08 * diveSmoothstep((u - 0.55) / 0.45);
    const tailKick = u < 0.46 ? -0.55 * diveSmoothstep((u - 0.18) / 0.28)
      : u < 0.68 ? -0.55 + 1.05 * diveSmoothstep((u - 0.46) / 0.22)
        : 0.5 * (1 - diveSmoothstep((u - 0.68) / 0.24));
    const arch = 0.13 * diveSmoothstep(u / 0.35) * (1 - diveSmoothstep((u - 0.65) / 0.35));
    return { submergence, pitch, noseFirst: false, depth, tailKick, arch };
  }
  t -= entry;
  if (t < under) {
    return { submergence: 1, pitch: 0.72 * (1 - diveSmoothstep(t / under)),
      noseFirst: false, depth: 1.2, tailKick: 0, arch: 0 };
  }
  t -= under;
  const u = t / exit;
  // A faster push through the surface, then a longer, monotonic settle.
  const pitch = u < 0.32 ? -0.5 * diveSmoothstep(u / 0.32)
    : -0.5 * (1 - diveSmoothstep((u - 0.32) / 0.68));
  const depth = u < 0.58 ? 1.2 - 1.3 * diveSmoothstep(u / 0.58)
    : -0.1 * (1 - diveSmoothstep((u - 0.58) / 0.42));
  const arch = 0.08 * diveSmoothstep(u / 0.3) * (1 - diveSmoothstep((u - 0.4) / 0.6));
  const submergence = u < 0.65 ? 1 - 0.8 * diveSmoothstep(u / 0.65)
    : 0.2 * (1 - diveSmoothstep((u - 0.65) / 0.35));
  return { submergence, pitch, noseFirst: submergence > 0, depth, tailKick: 0, arch };
}

/** Integrate a capped frame in fixed ticks; no DOM or wall-clock dependency. */
function stepScene(scene, dt, speed = 1) {
  if (!Number.isFinite(dt) || dt <= 0) return scene;
  speed = motionLimit(motionFinite(speed, 1), 0, 3);
  if (speed === 0) return scene;
  if (!(scene.width > 0 && scene.height > 0)
    || scene.whales.some(whale => !whale._motion)) {
    resizeScene(scene, scene.width || 1600, scene.height || 900);
  }
  scene.accumulator = motionFinite(scene.accumulator, 0) + Math.min(dt, 0.25);
  while (scene.accumulator + 1e-10 >= motionTick) {
    motionIntegrate(scene, speed);
    scene.accumulator = Math.max(0, scene.accumulator - motionTick);
  }
  return scene;
}

/** Projection compatible with transformParticle; elapsed never sets position. */
function whalePose(whale, elapsed, width, height, speed, out = {}) {
  width = Math.max(1, motionFinite(width, 1));
  height = Math.max(1, motionFinite(height, 1));
  const phase = motionFinite(whale.phase, 0), state = whale._motion;
  if (state) motionEnsureDive(state);
  const age = state ? state.age : motionFinite(elapsed, 0) * motionFinite(speed, 1);
  const heading = motionFinite(whale.heading, 0), turn = motionFinite(whale.turn, 0);
  const depth = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5)
    + Math.sin(age * 0.07 + phase) * 0.025;
  const focal = motionLimit(width * 0.95, 520, 1800);
  const yaw = 0, pitch = Math.PI / 2, roll = heading;
  const cy = 1, sy = 0, cp = 0, sp = 1;
  const length = motionFinite(whale.length, Math.min(width * 0.30, height * 0.53));
  // x is length, y is height into the water, and z is lateral spread.
  // A fixed overhead camera projects x/-z; heading turns within that plane.
  const scale = length * (1 + depth) / 2.24;
  Object.assign(out, { x: motionFinite(whale.x, width * 0.5), y: motionFinite(whale.y, height * 0.5),
    scale, focal, cameraZ: focal * depth, near: focal * 0.12,
    yaw, pitch, roll, heading, length, turn,
    wave: state ? state.wave : age * 1.8 + phase,
    submergence: state ? state.submergence : 0,
    divePitch: state ? state.pitch : 0,
    diveDepth: state ? state.depth : 0,
    diveKick: state ? state.tailKick : 0,
    diveArch: state ? state.arch : 0,
    noseFirst: state ? state.noseFirst : false,
    cy, sy, cp, sp, cr: Math.cos(roll), sr: Math.sin(roll) });
  return writeWhaleRigPose(whale, out);
}


const FIELDS = Object.freeze({
  enabled: { kind: 'boolean', default: true },
  count: { kind: 'number', min: 1, max: 8, step: 1, default: 3 },
  species: { kind: 'enum', values: ['mixed', ...SPECIES_IDS], default: 'mixed' },
  renderStyle: { kind: 'enum', values: ['glyphs', 'cells'], default: 'glyphs' },
  fillMode: { kind: 'enum', values: ['custom', 'ascii'], default: 'custom' },
  text: { kind: 'string', max: 40, default: '探索未至之境' },
  speed: { kind: 'number', min: 0.3, max: 2, step: 0.05, default: 0.65 },
  opacity: { kind: 'number', min: 0.04, max: 0.9, step: 0.01, default: 0.6 },
  glyphSize: { kind: 'number', min: 4, max: 16, step: 1, default: 11 },
  whaleSize: { kind: 'number', min: 0.55, max: 1.55, step: 0.05, default: 1 },
  color: { kind: 'enum', values: ['ocean', 'azure', 'indigo'], default: 'ocean' },
  quietCenter: { kind: 'boolean', default: true },
  leftInset: { kind: 'number', min: 0, max: 500, step: 1, default: 280 },
  glass: { kind: 'boolean', default: true },
  glassStrength: { kind: 'number', min: 0, max: 1, step: 0.05, default: 0.55 },
  // Folded into `glass` in 0.11.0: every content box, the composer included, is
  // frosted by the same option. Kept as a hidden field so old profile entries
  // still validate, and so a 0.10.0 config that only enabled the composer is
  // migrated below instead of silently losing its effect.
  composerGlass: { kind: 'boolean', default: false, hidden: true },
  composerAvoid: { kind: 'boolean', default: false },
  spout: { kind: 'boolean', default: false },
  reefs: { kind: 'boolean', default: true },
  ripples: { kind: 'boolean', default: true },
});
const DEFAULTS = Object.freeze(Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.default])));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const fract = n => n - Math.floor(n);
const noise = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

function normalizeConfig(value = {}) {
  const config = Object.fromEntries(Object.entries(FIELDS).map(([key, f]) => {
    let v = value[key];
    if (f.kind === 'number') {
      v = typeof v === 'number' && Number.isFinite(v) ? clamp(v, f.min, f.max) : f.default;
      if (f.step === 1) v = Math.round(v);
    } else if (f.kind === 'boolean') v = typeof v === 'boolean' ? v : f.default;
    else if (f.kind === 'enum') v = f.values.includes(v) ? v : f.default;
    else v = typeof v === 'string' ? v.slice(0, f.max).replace(/[\uD800-\uDBFF]$/u, '') : f.default;
    return [key, v];
  }));
  // 0.10.0 had a separate composer-only glass. When a stored config never
  // mentioned `glass` at all but had that switch on, fold it into the content
  // glass so the upgrade keeps the effect instead of silently dropping it.
  if (config.composerGlass === true && value && !('glass' in value)) {
    config.glass = true;
    config.composerGlass = false;
  }
  // The content glass and the input-box avoidance are alternatives: glass
  // already hides the whales behind every box, so avoiding them as well would
  // only squeeze the school for no visual gain. Glass wins if both arrive on.
  if (config.glass && config.composerAvoid) config.composerAvoid = false;
  return config;
}

/**
 * A value fingerprint independent of object identity.
 *
 * DSH re-reads the whole settings document on every settings write (choosing a
 * model saves the default model there too) and hands every config form a fresh
 * `value` object even when nothing changed. Rendering must compare meaning, not
 * references, or a model switch would rebuild the school.
 */
function configSignature(value) {
  return JSON.stringify(normalizeConfig(value));
}

function glyphSequence(text = DEFAULTS.text) {
  const characters = text.replace(/\s/gu, '') || DEFAULTS.text;
  return typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(characters), item => item.segment)
    : Array.from(characters);
}

function bodyRadius(x, anatomy) {
  const profile = anatomy.profile;
  for (let i = 1; i < profile.length; i++) {
    if (x <= profile[i][0]) {
      const [a, ra] = profile[i - 1], [b, rb] = profile[i], span = b - a;
      const slope = (rb - ra) / span;
      const previous = i > 1 ? (ra - profile[i - 2][1]) / (a - profile[i - 2][0]) : slope;
      const next = i + 1 < profile.length ? (profile[i + 1][1] - rb) / (profile[i + 1][0] - b) : slope;
      const ma = previous * slope > 0 ? 2 * previous * slope / (previous + slope) : 0;
      const mb = next * slope > 0 ? 2 * next * slope / (next + slope) : 0;
      const t = clamp((x - a) / span, 0, 1), t2 = t * t, t3 = t2 * t;
      return Math.max(0, (2 * t3 - 3 * t2 + 1) * ra + (t3 - 2 * t2 + t) * span * ma
        + (-2 * t3 + 3 * t2) * rb + (t3 - t2) * span * mb);
    }
  }
  return profile[profile.length - 1][1];
}
function bodySurface(anatomy) {
  return (u, angle) => {
    const x = mix(-1, 1.04, u), radius = bodyRadius(x, anatomy);
    const pleat = anatomy.pleats && x > -0.02 && Math.cos(angle) > 0.15 ? 1 + 0.012 * Math.cos(angle * 36) : 1;
    return { x, y: radius * anatomy.height * Math.cos(angle) * pleat, z: radius * Math.sin(angle) * pleat };
  };
}

function flukeSurface(anatomy, side) {
  const { span, tipX, leadingX, trailingX, notch, width } = anatomy.fluke;
  return (u, angle) => {
    u = clamp(u, 0, 1);
    angle *= -side;
    const leading = mix(leadingX, tipX, u * u) + 0.04 * Math.sin(Math.PI * u);
    const trailing = trailingX + notch * (1 - u) ** 6 + (tipX - trailingX) * u ** 1.5;
    return { x: mix(leading, trailing, (1 + Math.cos(angle)) * 0.5),
      y: 0.01 + width * (0.25 + 0.75 * Math.sin(Math.PI * u)) * Math.sin(angle),
      z: side * mix(0.012, span, u) };
  };
}

function surfaceParticle(surface, u, angle) {
  const p = surface(u, angle), epsilon = 0.0001;
  const a = surface(u + epsilon, angle), b = surface(u - epsilon, angle);
  const c = surface(u, angle + epsilon), d = surface(u, angle - epsilon);
  const ax = a.x - b.x, ay = a.y - b.y, az = a.z - b.z;
  const bx = c.x - d.x, by = c.y - d.y, bz = c.z - d.z;
  let nx = az * by - ay * bz, ny = ax * bz - az * bx, nz = ay * bx - ax * by;
  const length = Math.hypot(nx, ny, nz) || 1;
  nx /= length; ny /= length; nz /= length;
  return { ...p, nx, ny, nz };
}

function bladeSurface(start, end, width, thickness, reference) {
  const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
  const length = Math.hypot(dx, dy, dz), ax = dx / length, ay = dy / length, az = dz / length;
  let bx = ay * reference[2] - az * reference[1];
  let by = az * reference[0] - ax * reference[2];
  let bz = ax * reference[1] - ay * reference[0];
  const crossLength = Math.hypot(bx, by, bz);
  bx /= crossLength; by /= crossLength; bz /= crossLength;
  const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
  return (u, angle) => {
    const taper = Math.sin(Math.PI * clamp(u, 0, 1)) ** 0.7;
    const broad = width * taper * Math.cos(angle), thin = thickness * taper * Math.sin(angle);
    return { x: start[0] + dx * u + bx * broad + cx * thin,
      y: start[1] + dy * u + by * broad + cy * thin,
      z: start[2] + dz * u + bz * broad + cz * thin };
  };
}

/**
 * Build a full school at a virtual 1600x900 stage.
 *
 * `whaleSize` only scales the bodies. The particle budget follows its square so
 * a bigger whale keeps the same glyph density instead of turning sparse, and
 * the default 1 reproduces the 0.8.0 budget exactly (`count * 2200`, capped at
 * 8000), so existing pictures are untouched.
 */
function createScene(count, text = DEFAULTS.text, species = DEFAULTS.species, whaleSize = DEFAULTS.whaleSize) {
  const alphabet = glyphSequence(text);
  count = clamp(Math.round(count), 1, 8);
  const size = clamp(typeof whaleSize === 'number' && Number.isFinite(whaleSize) ? whaleSize : DEFAULTS.whaleSize,
    FIELDS.whaleSize.min, FIELDS.whaleSize.max);
  const total = Math.min(8000, Math.round(count * 2200 * Math.max(0.36, size * size)));
  const whales = Array.from({ length: count }, (_, id) => ({
    id, species: species === 'mixed' || !WHALE_SPECIES[species] ? SPECIES_IDS[id % SPECIES_IDS.length] : species,
    depth: [0.14, 0.52, 0.72, 0.95, 0.38][id % 5], phase: noise(id + 80) * Math.PI * 2,
  }));
  const particles = [], triangles = [], decals = [];
  for (const whale of whales) {
    const anatomy = whaleSpecies(whale.species), surface = bodySurface(anatomy);
    const budget = Math.floor(total / count);
    const addSurface = (part, surfaceFn, allocation, material = 'skin') => {
      const start = particles.length;
      const around = Math.max(8, Math.round(Math.sqrt(allocation / 2.5)));
      const rings = Math.max(2, Math.floor(allocation / around)), number = rings * around;
      for (let ring = 0; ring < rings; ring++) for (let col = 0; col < around; col++) {
        const seed = noise(particles.length + 900);
        const u = (ring + 0.001) / (rings - 1 + 0.002);
        const angle = Math.PI * 2 * col / around;
        const p = surfaceParticle(surfaceFn, u, angle);
        const pleat = anatomy.pleats && part === 'body' && p.x > 0.02 && p.y > 0.04 && Math.cos(angle * 36) > 0.5;
        particles.push({ id: particles.length, whale: whale.id, part, ...p, seed,
          material: pleat ? 'pleat' : material });
      }
      for (let ring = 0; ring < rings - 1; ring++) for (let col = 0; col < around; col++) {
        const a = start + ring * around + col, b = start + ring * around + (col + 1) % around;
        const c = a + around, d = b + around;
        if (c < start + number && d < start + number) triangles.push(a, b, c, b, d, c);
      }
    };
    const finCount = Math.floor(budget * (whale.species === 'humpback' ? 0.085 : 0.045));
    const flukeCount = Math.floor(budget * 0.055), dorsalCount = anatomy.dorsal ? Math.max(24, Math.floor(budget * 0.02)) : 0;
    const mouthCount = 12;
    addSurface('body', surface, budget - finCount * 2 - flukeCount * 2 - dorsalCount - mouthCount - 2);
    for (const side of [-1, 1]) {
      const { root, tip, width, thickness } = anatomy.flipper;
      addSurface('fin', bladeSurface([root[0], root[1], side * root[2]], [tip[0], tip[1], side * tip[2]], width, thickness, [0, 1, 0]), finCount, 'fin');
      addSurface('fluke', flukeSurface(anatomy, side), flukeCount, 'fin');
      const x = whale.species === 'sperm' ? 0.4 : 0.77, y = 0.015, radius = bodyRadius(x, anatomy);
      decals.push(particles.length);
      particles.push({ id: particles.length, whale: whale.id, part: 'eye', x, y,
        z: side * (radius * Math.sqrt(1 - (y / (radius * anatomy.height)) ** 2) + 0.004),
        nx: 0, ny: 0, nz: side, seed: noise(whale.id + side + 45), material: 'eye' });
    }
    if (anatomy.dorsal) {
      const { root, tip, width } = anatomy.dorsal;
      addSurface('dorsal', bladeSurface(root, tip, width, 0.014, [0, 0, 1]), dorsalCount, 'fin');
    }
    for (let i = 0; i < mouthCount; i++) {
      const x = mix(0.64, 1.02, (Math.floor(i / 2) + 0.5) / (mouthCount / 2)), side = i % 2 ? 1 : -1;
      const p = surfaceParticle(surface, (x + 1) / 2.04, side * Math.acos(0.36));
      decals.push(particles.length);
      particles.push({ id: particles.length, whale: whale.id, part: 'mouth', ...p,
        z: p.z + side * 0.003, seed: noise(i + 340), material: 'mouth' });
    }
  }
  for (const p of particles) p.glyph = alphabet[p.id % alphabet.length];
  // `whaleSize` is part of the scene because motion.js reads it from there when
  // it derives every body length; keeping it out of the whale objects means a
  // resize can never disagree with the scene the whales belong to.
  const scene = { whales, particles, triangles: new Uint16Array(triangles), decals, time: 0, accumulator: 0, width: 0, height: 0, whaleSize: size };
  resizeScene(scene, 1600, 900);
  return scene;
}

function transformParticle(p, pose, out = {}) {
  deformWhaleParticle(p, pose, out);
  const { x, y, z, nx, ny, nz } = out;
  out.elevation = -y;
  const rx = pose.cy * x + pose.sy * z, rz = -pose.sy * x + pose.cy * z;
  const ry = pose.cp * y - pose.sp * rz, depth = pose.sp * y + pose.cp * rz;
  const rnx = pose.cy * nx + pose.sy * nz, rnz = -pose.sy * nx + pose.cy * nz;
  const rny = pose.cp * ny - pose.sp * rnz, normalZ = pose.sp * ny + pose.cp * rnz;
  const normalX = pose.cr * rnx - pose.sr * rny, normalY = pose.sr * rnx + pose.cr * rny;
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
  out.x = (pose.cr * rx - pose.sr * ry) * pose.scale;
  out.y = (pose.sr * rx + pose.cr * ry) * pose.scale;
  out.z = depth * pose.scale;
  out.nx = normalX / normalLength; out.ny = normalY / normalLength; out.nz = normalZ / normalLength;
  return out;
}

function projectParticle(p, pose, out = {}) {
  transformParticle(p, pose, out);
  const cameraDistance = pose.focal + pose.cameraZ + out.z;
  const depth = Math.max(pose.near, cameraDistance), perspective = pose.focal / depth;
  const rayLength = Math.hypot(out.x, out.y, depth);
  const facing = -(out.nx * out.x + out.ny * out.y + out.nz * depth) / rayLength;
  const tone = surfaceInkTone(out.elevation, -out.nz, -0.6 * out.nx - 0.8 * out.ny, p.material, p.seed);
  out.x = pose.x + out.x * perspective;
  out.y = pose.y + out.y * perspective;
  out.z = depth;
  out.perspective = perspective;
  out.light = tone;
  out.visibility = cameraDistance <= pose.near ? 0 : smooth((facing + 0.04) / 0.26);
  const sub = Number.isFinite(pose.submergence) ? pose.submergence : 0;
  if (Number.isFinite(pose.diveDepth)) {
    // elevation was recorded immediately after rig deformation, before camera
    // projection. An exposed fluke remains visible even when the nose is deep.
    const wet = smooth((-out.elevation - DIVE_WATERLINE) / 0.18);
    const engagement = Number.isFinite(pose.diveEngagement) ? pose.diveEngagement
      : smooth(Math.max(sub * 8, Math.abs(pose.diveDepth) * 4,
        Math.abs(Number.isFinite(pose.divePitch) ? pose.divePitch : 0) * 3,
        Math.abs(Number.isFinite(pose.diveKick) ? pose.diveKick : 0) * 2));
    // Blend the physical waterline in/out with flat endpoints, so returning to
    // the unmasked resting pose cannot suddenly reveal a partially wet flank.
    if (engagement > 0) out.visibility *= 1 - engagement * wet;
  } else {
    const lead = Math.min(1, Math.max(0, (p.x + 1.2) / 2.24));
    const noseFirst = pose.noseFirst === true;
    const gate = 0.35 + 0.65 * (noseFirst ? lead : 1 - lead);
    let u = sub > 0 ? (gate - sub) / gate : 1;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    out.visibility *= u * u * (3 - 2 * u);
  }
  return out;
}

function createDepthGrid(width, height, glyphSize, metrics = {}) {
  const naturalWidth = Math.ceil(Math.max(5, glyphSize, metrics.width || 0) + 2);
  const naturalHeight = Math.ceil(Math.max(5, glyphSize * 1.2, metrics.height || 0) + 2);
  const cellWidth = metrics.square ? Math.max(naturalWidth, naturalHeight) : naturalWidth;
  const cellHeight = metrics.square ? cellWidth : naturalHeight;
  const columns = Math.max(1, Math.ceil(width / cellWidth)), rows = Math.max(1, Math.ceil(height / cellHeight));
  const count = columns * rows;
  const centersX = new Float64Array(count), centersY = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    centersX[i] = (i % columns + 0.5) * cellWidth;
    centersY[i] = (Math.floor(i / columns) + 0.5) * cellHeight;
  }
  return { width, height, cellWidth, cellHeight, columns, rows, centersX, centersY,
    owners: new Int32Array(count), depths: new Float64Array(count), lights: new Float32Array(count),
    coverage: new Float32Array(count), visibility: new Float32Array(count),
    sampleDepths: new Float64Array(count * 5), sampleOwners: new Int32Array(count * 5),
    sampleLights: new Float32Array(count * 5), sampleVisibility: new Float32Array(count * 5) };
}

const CELL_SAMPLES = [0.5, 0.5, 0.2, 0.2, 0.8, 0.2, 0.2, 0.8, 0.8, 0.8];

function resolveDepthGrid(projected, grid, triangles, decals = []) {
  grid.owners.fill(-1); grid.depths.fill(Infinity);
  grid.coverage.fill(0); grid.visibility.fill(0);
  for (const p of projected) { p.cell = -1; p.surfaceVisibility = 0; }
  if (triangles?.length) {
    grid.sampleDepths.fill(Infinity); grid.sampleOwners.fill(-1);
    for (let triangle = 0; triangle < triangles.length; triangle += 3) {
      const ia = triangles[triangle], ib = triangles[triangle + 1], ic = triangles[triangle + 2];
      const a = projected[ia], b = projected[ib], c = projected[ic];
      if (Math.max(a.visibility, b.visibility, c.visibility) < 0.05) continue;
      const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(denominator) < 0.0001) continue;
      const left = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x) / grid.cellWidth));
      const right = Math.min(grid.columns - 1, Math.floor(Math.max(a.x, b.x, c.x) / grid.cellWidth));
      const top = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y) / grid.cellHeight));
      const bottom = Math.min(grid.rows - 1, Math.floor(Math.max(a.y, b.y, c.y) / grid.cellHeight));
      for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
        const cell = row * grid.columns + col;
        for (let sample = 0; sample < 5; sample++) {
          const x = (col + CELL_SAMPLES[sample * 2]) * grid.cellWidth;
          const y = (row + CELL_SAMPLES[sample * 2 + 1]) * grid.cellHeight;
          const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
          const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
          const w = 1 - u - v;
          if (Math.min(u, v, w) < -0.000001) continue;
          const visible = a.visibility * u + b.visibility * v + c.visibility * w;
          if (visible < 0.05) continue;
          const depth = a.z * u + b.z * v + c.z * w, index = cell * 5 + sample;
          if (depth >= grid.sampleDepths[index]) continue;
          grid.sampleDepths[index] = depth;
          grid.sampleOwners[index] = u >= v && u >= w ? ia : v >= w ? ib : ic;
          grid.sampleLights[index] = a.light * u + b.light * v + c.light * w;
          grid.sampleVisibility[index] = visible;
        }
      }
    }
    for (let cell = 0; cell < grid.owners.length; cell++) {
      let hits = 0, light = 0, visible = 0, selected = -1;
      for (let sample = 0; sample < 5; sample++) {
        const index = cell * 5 + sample;
        if (grid.sampleOwners[index] < 0) continue;
        hits++; light += grid.sampleLights[index]; visible += grid.sampleVisibility[index];
        if (sample === 0 || selected < 0) selected = index;
      }
      if (!hits) continue;
      grid.owners[cell] = grid.sampleOwners[selected];
      grid.depths[cell] = grid.sampleDepths[selected];
      grid.lights[cell] = light / hits;
      grid.coverage[cell] = hits / 5;
      grid.visibility[cell] = visible / hits;
    }
  }
  const pointIndices = triangles?.length ? decals : projected.keys();
  for (const i of pointIndices) {
    const p = projected[i];
    if (p.visibility < 0.05 || p.x < 0 || p.x >= grid.width || p.y < 0 || p.y >= grid.height) continue;
    const cell = Math.floor(p.y / grid.cellHeight) * grid.columns + Math.floor(p.x / grid.cellWidth);
    if (p.z > grid.depths[cell] + (triangles?.length ? 0.75 : 0)) continue;
    grid.owners[cell] = i; grid.depths[cell] = p.z; grid.lights[cell] = p.light ?? 0.75;
    grid.coverage[cell] = 1; grid.visibility[cell] = p.visibility;
  }
  for (let cell = 0; cell < grid.owners.length; cell++) {
    const index = grid.owners[cell];
    if (index < 0) continue;
    const p = projected[index];
    p.cell = cell; p.surfaceVisibility = grid.visibility[cell];
    p.drawX = grid.centersX[cell]; p.drawY = grid.centersY[cell];
  }
}

function glyphOpacity(opacity, light, visibility, fade) {
  return clamp(opacity * (0.9 + 0.1 * light) * visibility * fade, 0, 1);
}

function fitCanvas(width, height, dpr) {
  const ratio = Math.min(2, Math.max(0.1, dpr || 1), Math.sqrt(12000000 / Math.max(1, width * height)));
  return { ratio, width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) };
}

function attenuation(x, y, width, height, quietCenter) {
  const bottom = 1 - smooth((y - height * 0.86) / Math.max(1, height * 0.10));
  const edge = smooth(Math.min(x, width - x) / 24);
  const central = quietCenter ? 1 - 0.25 * Math.exp(-(((x / width - 0.5) / 0.29) ** 2)) * smooth(y / height / 0.18) : 1;
  return clamp(bottom * edge * central, 0, 1);
}


// Ordered by visual density. Selection depends on the skin, never on a clock.
const ASCII_RAMP = '.:-=+*ox%#@';
const surfaceClamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
const surfacePalettes = new Map();

function surfaceKey(particle) {
  const along = Math.round((particle.x + 1.2) * 28);
  const across = Math.round(Math.atan2(particle.z, particle.y) * 10);
  return (Math.imul(along, 73856093) ^ Math.imul(across, 19349663) ^ Math.imul(particle.whale + 1, 83492791)) >>> 0;
}

function surfaceGlyph(particle, light, coverage, mode) {
  if (mode !== 'ascii') return particle.glyph;
  if (coverage < 0.6) return coverage < 0.3 ? '.' : ':';
  if (particle.part === 'eye') return 'o';
  const density = surfaceClamp(1 - light);
  const index = Math.round(density * (ASCII_RAMP.length - 1));
  return ASCII_RAMP[index];
}

/** Cached cell backgrounds with restrained cool, neutral and warm variations. */
function createCellPalette(name = 'ocean') {
  name = name === 'azure' || name === 'indigo' ? name : 'ocean';
  if (surfacePalettes.has(name)) return surfacePalettes.get(name);
  const stops = {
    ocean: [[25, 47, 66], [99, 128, 146], [219, 231, 236]],
    azure: [[21, 55, 73], [83, 138, 160], [210, 234, 241]],
    indigo: [[38, 43, 68], [114, 123, 155], [225, 228, 241]],
  };
  const [shadow, mid, highlight] = stops[name];
  const variations = [[0, 0, 0], [-5, 4, 5], [7, 3, -6], [3, -3, 6]];
  const palette = [];
  for (const variation of variations) for (let depth = 0; depth < 16; depth++) for (let shade = 0; shade < 32; shade++) {
    const t = shade / 31, unlit = 1 - t, haze = 0.3 * (depth / 15) ** 1.4;
    const rgb = shadow.map((start, channel) => {
      const value = unlit * unlit * start + 2 * t * unlit * mid[channel] + t * t * highlight[channel] + variation[channel];
      return Math.round(Math.max(0, Math.min(255, value + (247 - value) * haze)));
    });
    palette.push(Object.freeze({ background: `rgb(${rgb.join(', ')})`, luminance: rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 }));
  }
  Object.freeze(palette);
  surfacePalettes.set(name, palette);
  return palette;
}

/** One painter shared by the plugin, live previews and rendering checks. */
function createWhalePainter(scene, config) {
  const ascii = config.fillMode === 'ascii', tiles = config.renderStyle === 'cells';
  const font = ascii
    ? `600 ${config.glyphSize}px Consolas, "Cascadia Mono", "Courier New", monospace`
    : `600 ${config.glyphSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
  const alphabet = ascii ? Array.from(ASCII_RAMP) : Array.from(new Set(scene.particles.map(p => p.glyph)));
  const inkPalette = createInkPalette(config.color), cells = createCellPalette(config.color);
  const textDark = '#122635', textLight = '#f2f6fa';

  function paint(target, grid, poses, width, height, ratio = 1, fade = null, dark = false) {
    // Opacity and the reading-area fade stay live: the engine reuses one config
    // object and updates it in place, so those two options need a repaint, not a
    // rebuilt painter. Font, alphabet, cell shape and palette are fixed here.
    const opacity = config.opacity, quietCenter = config.quietCenter;
    target.font = font;
    target.textAlign = 'center';
    target.textBaseline = 'middle';
    let currentFill = '';
    const useFill = value => { if (value !== currentFill) { target.fillStyle = value; currentFill = value; } };
    for (let cell = 0; cell < grid.owners.length; cell++) {
      const owner = grid.owners[cell];
      if (owner < 0) continue;
      const particle = scene.particles[owner], pose = poses[particle.whale];
      const x = grid.centersX[cell], y = grid.centersY[cell], coverage = grid.coverage[cell], light = grid.lights[cell];
      let alpha = glyphOpacity(opacity, light, grid.visibility[cell], attenuation(x, y, width, height, quietCenter)) * (0.3 + coverage * 0.7);
      if (fade) alpha *= fade(x, y);
      if (alpha < 0.01) continue;
      const shade = glyphInkIndex(light, pose.cameraZ / pose.focal);
      const solid = tiles && coverage >= 0.6 && grid.sampleOwners[cell * 5] >= 0;
      const material = cells[shade + (surfaceKey(particle) % 4) * 512];
      if (solid) {
        // A one-device-pixel seam retains the individual squares. Round both
        // edges independently to avoid overlaps at fractional device scales.
        const gap = 1 / ratio;
        const left = Math.round((x - grid.cellWidth / 2) * ratio) / ratio + gap / 2;
        const top = Math.round((y - grid.cellHeight / 2) * ratio) / ratio + gap / 2;
        const right = Math.round((x + grid.cellWidth / 2) * ratio) / ratio - gap / 2;
        const bottom = Math.round((y + grid.cellHeight / 2) * ratio) / ratio - gap / 2;
        useFill(material.background);
        target.globalAlpha = alpha;
        target.fillRect(left, top, right - left, bottom - top);
      }
      if (solid) {
        // Decide contrast against the composited tile, including its opacity.
        // A fading dark tile on a light page needs dark letters, not white ones.
        const under = dark ? 31 : 250;
        const luminance = material.luminance * alpha + under * (1 - alpha);
        useFill(luminance < 145 ? textLight : textDark);
        target.globalAlpha = Math.min(1, alpha * 1.2);
      } else {
        useFill(inkPalette[shade]);
        target.globalAlpha = alpha;
      }
      target.fillText(surfaceGlyph(particle, light, coverage, config.fillMode),
        Math.round(x * ratio) / ratio, Math.round(y * ratio) / ratio, grid.cellWidth - 2);
    }
    target.globalAlpha = 1;
  }
  return { font, alphabet, square: tiles || ascii, paint };
}

/** A static sample; no animation frame, listener or hidden simulation is left running. */
function drawWhaleSample(canvas, config, options = {}) {
  const target = canvas.getContext('2d');
  if (!target) return;
  const width = options.width || Math.max(1, Math.floor(canvas.getBoundingClientRect().width));
  const height = options.height || 220, pixels = fitCanvas(width, height, options.ratio || 1);
  canvas.width = pixels.width; canvas.height = pixels.height;
  target.setTransform(pixels.ratio, 0, 0, pixels.ratio, 0, 0);
  target.clearRect(0, 0, width, height);
  // The sample must show the same body size the background will use. The length
  // is scaled first and only then clipped to what still fits the card, so 1.55
  // reads bigger than 1 without ever drawing outside the canvas.
  const whaleSize = typeof config.whaleSize === 'number' && Number.isFinite(config.whaleSize)
    ? Math.max(0.55, Math.min(1.55, config.whaleSize)) : 1;
  const scene = createScene(1, config.text, config.species, whaleSize);
  resizeScene(scene, width, height);
  const whale = scene.whales[0];
  Object.assign(whale, { x: width * 0.52, y: height * 0.46,
    length: Math.min(Math.min(width * 0.83, height * 1.35) * whaleSize, Math.min(width * 0.95, height * 1.8)),
    heading: 0, turn: 0 });
  resetWhaleRig(whale);
  const pose = whalePose(whale, 0, width, height, 0);
  pose.stroke = 0;
  const painter = createWhalePainter(scene, { ...config, quietCenter: false });
  target.font = painter.font;
  const metrics = { width: config.glyphSize, height: config.glyphSize * 1.2, square: painter.square };
  for (const glyph of painter.alphabet) {
    const measured = target.measureText(glyph);
    metrics.width = Math.max(metrics.width, measured.width, (measured.actualBoundingBoxLeft || 0) + (measured.actualBoundingBoxRight || 0));
    metrics.height = Math.max(metrics.height, (measured.actualBoundingBoxAscent || 0) + (measured.actualBoundingBoxDescent || 0));
  }
  const grid = createDepthGrid(width, height, config.glyphSize, metrics);
  const projected = scene.particles.map(p => projectParticle(p, pose));
  resolveDepthGrid(projected, grid, scene.triangles, scene.decals);
  painter.paint(target, grid, [pose], width, height, pixels.ratio, null, !!options.dark);
}

// Frosted glass over every opaque content box in the conversation, plus the
// input card. Everything here is pure geometry, tone and buffer arithmetic so
// the tests can drive it without a DOM or a Canvas; engine.js measures the
// boxes and paints the result.
//
// build.mjs concatenates the renderer modules into one factory, so no top-level
// name may collide with model.js (which owns `clamp`, `mix`, `smooth`, `noise`
// and the other short helpers). Every helper here is prefixed with `glass`.

// A pane equal to its box: only boxes too small to hold readable text are
// dropped, so the glass can never sit inside the box it covers.
const GLASS_CONTENT_MIN_WIDTH = 40;
const GLASS_CONTENT_MIN_HEIGHT = 24;
// A 10px ramp keeps the sharp glyphs dissolving into the glass right at the box
// edge without leaving a visible straight cut.
const GLASS_CONTENT_FEATHER = 10;
const GLASS_CONTENT_MAX = 16;
// Two boxes with every edge within 2px are the same surface seen twice (e.g. a
// wrapper and the card inside it); the first one wins.
const GLASS_CONTENT_EDGE_TOLERANCE = 2;
// An inner box inset by this much on every side is real nesting (a code block
// inside a card) and gets its own glass; anything tighter is the same frame.
const GLASS_CONTENT_NEST_INSET = 6;
// The reading-pane crest was a 22–32px bright band, far too heavy for a 100px
// card: every content box uses the input card's quarter-strength highlight.
const GLASS_CONTENT_CREST_SCALE = 0.22;
// The bottom shade is the darkest layer in the contrast budget; softening it for
// a card keeps the last line of text above the AA floor.
const GLASS_CONTENT_SHADE_SCALE = 0.45;
// How much of the blurred sea shows through. 30–36% keeps the whale legible as a
// frosted shape while the contrast test holds body text at ≥4.5:1 even over the
// darkest cell tile.
const GLASS_CONTENT_MIST_BASE = 0.30;
const GLASS_CONTENT_MIST_RANGE = 0.06;

const glassClamp = (value, low, high) => value < low ? low : value > high ? high : value;

/**
 * One pane per opaque content box, in canvas coordinates.
 *
 * `boxes` are page rectangles from `getBoundingClientRect` plus each box's own
 * computed corner radius. A pane is *exactly* the box clipped to the canvas —
 * never inset, never padded — so its corner radius and edges line up with the
 * DOM box and there is no second, smaller rounded frame to notice.
 *
 * Near-identical boxes collapse to the first one; a genuinely nested box (a card
 * inside a card) keeps its own pane, marked `nested`; more boxes than `max` are
 * cut down to the largest ones while keeping document order for painting.
 *
 * @returns {Array<{x:number,y:number,width:number,height:number,radius:number,feather:number,nested:boolean}>}
 */
function glassContentPanes({ canvas, boxes, max = GLASS_CONTENT_MAX } = {}) {
  if (!canvas || !(canvas.width > 0) || !(canvas.height > 0) || !Array.isArray(boxes)) return [];
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : GLASS_CONTENT_MAX;
  const clipped = [];
  for (const box of boxes) {
    if (!box) continue;
    const left = Number(box.left), top = Number(box.top);
    const boxWidth = Number(box.width), boxHeight = Number(box.height);
    if (![left, top, boxWidth, boxHeight].every(Number.isFinite)) continue;
    if (!(boxWidth >= GLASS_CONTENT_MIN_WIDTH) || !(boxHeight >= GLASS_CONTENT_MIN_HEIGHT)) continue;
    const x = Math.max(0, left - canvas.left);
    const y = Math.max(0, top - canvas.top);
    const right = Math.min(canvas.width, left - canvas.left + boxWidth);
    const bottom = Math.min(canvas.height, top - canvas.top + boxHeight);
    const width = right - x, height = bottom - y;
    if (!(width >= 1) || !(height >= 1)) continue;
    clipped.push({ x, y, width, height,
      radius: glassClamp(Number.isFinite(Number(box.radius)) ? Number(box.radius) : 0, 0, Math.min(width, height) / 2),
      feather: GLASS_CONTENT_FEATHER });
  }
  // Same surface measured twice: every edge within the tolerance.
  const unique = [];
  for (const pane of clipped) {
    const duplicate = unique.some(other => Math.abs(pane.x - other.x) <= GLASS_CONTENT_EDGE_TOLERANCE
      && Math.abs(pane.y - other.y) <= GLASS_CONTENT_EDGE_TOLERANCE
      && Math.abs((pane.x + pane.width) - (other.x + other.width)) <= GLASS_CONTENT_EDGE_TOLERANCE
      && Math.abs((pane.y + pane.height) - (other.y + other.height)) <= GLASS_CONTENT_EDGE_TOLERANCE);
    if (!duplicate) unique.push(pane);
  }
  // Over the budget, keep the largest boxes but draw in document order so an
  // outer card is always painted before the card nested inside it.
  let kept = unique;
  if (unique.length > limit) {
    kept = unique
      .map((pane, index) => ({ pane, index }))
      .sort((a, b) => b.pane.width * b.pane.height - a.pane.width * a.pane.height || a.index - b.index)
      .slice(0, limit)
      .sort((a, b) => a.index - b.index)
      .map(entry => entry.pane);
  }
  for (const pane of kept) {
    pane.nested = kept.some(other => other !== pane
      && pane.x >= other.x + GLASS_CONTENT_NEST_INSET
      && pane.y >= other.y + GLASS_CONTENT_NEST_INSET
      && pane.x + pane.width <= other.x + other.width - GLASS_CONTENT_NEST_INSET
      && pane.y + pane.height <= other.y + other.height - GLASS_CONTENT_NEST_INSET);
  }
  return kept;
}

/**
 * Append one rounded rectangle to the current path (no beginPath).
 *
 * Several boxes can be appended to one path and clipped together: the clip is
 * then the union of the rounded rectangles, so a single shared image can be
 * drawn for all panes while the gaps *between* boxes stay outside the union and
 * remain uncovered.
 */
function glassRoundedSubpath(ctx, rect) {
  const { x, y, width, height } = rect;
  const radius = Math.max(0, Math.min(rect.radius, width / 2, height / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** Trace a rounded rectangle; callers decide whether to fill, stroke or clip. */
function glassRoundedPath(ctx, rect) {
  ctx.beginPath();
  glassRoundedSubpath(ctx, rect);
}

/**
 * Material for one strength setting.
 *
 * The pane is composited *above* the DOM text — the whale canvas lives in DSH's
 * overlay layer — so every layer here is also a contrast cost for the words
 * underneath. `mist` (the blurred sea) and `veil` (a flat tint) are the two
 * layers that carry visible colour; the top crest and bottom shade shape the
 * glass edge. There is deliberately no rim colour here: the outline belongs to
 * the DOM card, never to this canvas (see paintContentPane).
 *
 * test 'the pane keeps body text above the AAA contrast threshold' computes the
 * worst case for both themes and fails if any strength drops below 7:1.
 */
function glassTone(strength = 0.55, { dark = false, reducedTransparency = false, enabled = true,
  crestScale = 1, compact = false } = {}) {
  const s = glassClamp(Number.isFinite(strength) ? strength : 0.55, 0, 1);
  if (!enabled || reducedTransparency) return { mode: 'clear', strength: s, feather: compact ? 12 : 26 };
  return {
    mode: 'frost',
    strength: s,
    scale: Math.round(3 + 4 * s),
    blur: 8 + 12 * s,
    mist: 0.24 + 0.06 * s,
    veil: dark ? 0.045 + 0.005 * s : 0.033 + 0.002 * s,
    tint: dark ? '20, 21, 24' : '255, 255, 255',
    silhouette: dark ? '120, 135, 158' : '160, 178, 200',
    crest: `rgba(255, 255, 255, ${(dark ? 0.06 + 0.05 * s : 0.52 + 0.34 * s) * crestScale})`,
    shade: dark ? `rgba(0, 0, 0, ${0.14 + 0.16 * s})` : `rgba(30, 43, 58, ${0.045 + 0.05 * s})`,
    crestHeight: compact ? Math.min(18, 8 + 4 * s) : 22 + 10 * s,
    shadeHeight: compact ? Math.min(18, 10 + 4 * s) : 20 + 12 * s,
    feather: compact ? 12 + 4 * s : 26 + 12 * s,
  };
}

/**
 * Material for a content box.
 *
 * Same contrast budget as the reading pane (identical tint and silhouette), with
 * the changes a card demands: the blurred sea carries real colour (mist), so it
 * is capped below the level that would push body text under 4.5:1; the top
 * highlight is cut to a quarter and capped, so it cannot land on the first line
 * of text as a bright bar; and the bottom shade is softened.
 *
 * No outline is produced: the frame is DSH's own, and painting a second rim here
 * made the corners read as two different radii (T3). The material only ever
 * fills inside the card's own rounded clip.
 * The whole budget is asserted in content-glass.test.js, band by band.
 */
function glassContentTone(strength = 0.55, options = {}) {
  const tone = glassTone(strength, { ...options, crestScale: GLASS_CONTENT_CREST_SCALE, compact: true });
  if (tone.mode !== 'frost') return tone;
  const s = tone.strength;
  const dark = Boolean(options.dark);
  return {
    ...tone,
    mist: GLASS_CONTENT_MIST_BASE + GLASS_CONTENT_MIST_RANGE * s,
    blur: 9 + 12 * s,
    shade: dark
      ? `rgba(0, 0, 0, ${(0.14 + 0.16 * s) * GLASS_CONTENT_SHADE_SCALE})`
      : `rgba(30, 43, 58, ${(0.045 + 0.05 * s) * GLASS_CONTENT_SHADE_SCALE})`,
  };
}

/**
 * Downsampling factor for the shared blurred sea, 4–6 depending on strength.
 *
 * One buffer is built per frame for all panes: the number of panes changes the
 * number of draw calls, never the blur cost.
 */
function glassSeaFactor(strength = 0.55) {
  const s = glassClamp(Number.isFinite(strength) ? strength : 0.55, 0, 1);
  return glassClamp(Math.round(4 + 2 * s), 4, 6);
}

/**
 * Size of the shared blurred-sea buffer, in low-resolution pixels.
 *
 * The buffer covers the whole canvas (so every pane slices the same image) with
 * a padding band wide enough that the Gaussian blur has real pixels to pull in
 * from outside the pane, which keeps pane edges from darkening.
 */
function glassSeaBuffer(width, height, { factor = 4, blur = 12 } = {}) {
  const sourceWidth = Math.max(1, Math.floor(Number.isFinite(width) ? width : 1));
  const sourceHeight = Math.max(1, Math.floor(Number.isFinite(height) ? height : 1));
  const f = glassClamp(Number.isFinite(factor) ? Math.round(factor) : 4, 2, 8);
  const blurPx = Math.max(0, Number.isFinite(blur) ? blur : 0);
  const blurRadius = blurPx / f;
  const pad = Math.max(2, Math.ceil(blurRadius * 3) + 2);
  return { factor: f, pad, blurRadius,
    width: Math.ceil(sourceWidth / f) + pad * 2,
    height: Math.ceil(sourceHeight / f) + pad * 2 };
}

/**
 * Signed distance from a point to a rounded rectangle, in CSS pixels:
 * negative inside, positive outside, zero on the edge. The renderer uses one
 * number for two decisions, so a glyph can never fall between "outside the
 * shape" and "inside the shape" and vanish from both layers.
 */
function glassDistance(rect, x, y) {
  const radius = Math.max(0, Math.min(rect.radius, rect.width / 2, rect.height / 2));
  const halfWidth = rect.width / 2 - radius, halfHeight = rect.height / 2 - radius;
  const qx = Math.abs(x - (rect.x + rect.width / 2)) - halfWidth;
  const qy = Math.abs(y - (rect.y + rect.height / 2)) - halfHeight;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** True when a point falls inside the rounded rectangle. */
function glassContains(rect, x, y) {
  return glassDistance(rect, x, y) <= 0;
}

/**
 * How much of a sharp glyph survives at this point.
 *
 * 0 inside the pane (the frosted sea owns it), ramping to 1 across `feather`
 * pixels outside it. Without the ramp a whale crossing the pane edge would be
 * cut off in a straight line; with it the body dissolves into the glass.
 */
function glassEdgeFade(rect, x, y, feather = 26) {
  const inside = -glassDistance(rect, x, y);
  if (inside >= 0) return 0;
  const t = glassClamp(-inside / Math.max(1, feather), 0, 1);
  return t * t * (3 - 2 * t);
}


// Helpers stay `spout`-prefixed: build.mjs strips `export` and concatenates this
// file into the same scope as model.js, which already owns clamp/mix/smooth/noise.
const SPOUT_LIMIT = 3;
const SPOUT_BLOCK_TAGS = new Set(['button', 'input', 'textarea', 'a', 'select', 'label', 'summary']);
const SPOUT_BLOCK_ROLES = new Set(['button', 'slider', 'textbox']);
const SPOUT_PHASES = new Set(['jet', 'bush', 'droplets']);

// Blowhole stations are drawing choices, not measurements.
const SPOUT_MARK = Object.freeze({
  blue: Object.freeze({ x: 0.62, y: -0.12, z: 0, basis: 'screen' }),
  humpback: Object.freeze({ x: 0.56, y: -0.14, z: 0, basis: 'screen' }),
  fin: Object.freeze({ x: 0.60, y: -0.10, z: 0, basis: 'screen' }),
  bowhead: Object.freeze({ x: 0.50, y: -0.16, z: 0, basis: 'lateral' }),
  sperm: Object.freeze({ x: 0.88, y: -0.08, z: 0.06, basis: 'body' }),
});

const SPOUT_STAMPS = Object.freeze({
  blue: {
    basis: 'screen',
    jet: { anchor: { row: 0, col: 1 }, rows: [' * '] },
    bush: { anchor: { row: 1, col: 1 }, rows: [' o ', 'o*o', ' o '] },
    droplets: { anchor: { row: 1, col: 1 }, rows: [' . ', '. .', ' . '] },
  },
  humpback: {
    basis: 'screen',
    jet: { anchor: { row: 0, col: 2 }, rows: [' *** '] },
    bush: { anchor: { row: 1, col: 3 }, rows: [" 'o o' ", 'o  *  o', " 'o o' "] },
    droplets: { anchor: { row: 1, col: 3 }, rows: ['.  .  .', ' .   . ', '   .   '] },
  },
  bowhead: {
    basis: 'lateral',
    jet: { anchor: { row: 1, col: 2 }, rows: ["  '  ", '  *  '] },
    bush: { anchor: { row: 3, col: 4 }, rows: ['O       O', " '     ' ", "  '   '  ", '    *    '] },
    droplets: { anchor: { row: 2, col: 4 }, rows: ['.       .', " '     ' ", '    .    '] },
  },
  fin: {
    basis: 'screen',
    unverified: true,
    jet: { anchor: { row: 0, col: 1 }, rows: [' * '] },
    bush: { anchor: { row: 1, col: 1 }, rows: [' . ', ' * ', ' . '] },
    droplets: { anchor: { row: 0, col: 1 }, rows: [' . '] },
  },
  sperm: {
    basis: 'body',
    jet: { anchor: { row: 0, col: 0 }, rows: ['*  ', " ' ", '  o'] },
    bush: { anchor: { row: 0, col: 0 }, rows: ['*   ', " '  ", '  o ', '   ~'] },
    droplets: { anchor: { row: 0, col: 0 }, rows: ['*  ', ' . ', '  .'] },
  },
});

/**
 * Phase window is half-open [0, 760). Alpha is 1 until 160ms, then linear to 0
 * at 760. The burst keeps the whale until 760 even after the ink falls under
 * 0.04 — otherwise a click at 759ms would start a second mist. Glyphs skip the
 * faint ink themselves.
 */
function spoutAge(ageMs) {
  if (typeof ageMs !== 'number' || !Number.isFinite(ageMs) || ageMs < 0 || ageMs >= 760) return null;
  const alpha = ageMs < 160 ? 1 : (760 - ageMs) / 600;
  const phase = ageMs < 160 ? 'jet' : ageMs < 420 ? 'bush' : 'droplets';
  return { phase, alpha };
}

function spoutFrame(species, phase) {
  if (!SPOUT_PHASES.has(phase)) return null;
  const speciesStamps = SPOUT_STAMPS[species];
  const stamp = speciesStamps && speciesStamps[phase];
  if (!stamp) return null;
  const frame = {
    rows: stamp.rows.slice(),
    anchor: { row: stamp.anchor.row, col: stamp.anchor.col },
    basis: speciesStamps.basis,
  };
  if (speciesStamps.unverified) frame.unverified = true;
  return frame;
}

/** Whale index under a primary click, or null. Depth is the grid's; not recomputed. */
function spoutHit(hit, grid, particles) {
  if (!hit || hit.enabled !== true || hit.button !== 0) return null;
  const tag = String(hit.tag ?? '').toLowerCase();
  if (SPOUT_BLOCK_TAGS.has(tag)) return null;
  if (hit.editable === true || hit.composer === true) return null;
  const role = String(hit.role ?? '').toLowerCase();
  if (SPOUT_BLOCK_ROLES.has(role)) return null;
  if (!grid || !(grid.cellWidth > 0) || !(grid.cellHeight > 0) || !(grid.columns > 0) || !(grid.rows > 0)) return null;
  const x = hit.x, y = hit.y;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const spanW = Number.isFinite(grid.width) ? grid.width : grid.columns * grid.cellWidth;
  const spanH = Number.isFinite(grid.height) ? grid.height : grid.rows * grid.cellHeight;
  if (x < 0 || y < 0 || x >= spanW || y >= spanH) return null;
  const col = Math.floor(x / grid.cellWidth);
  const row = Math.floor(y / grid.cellHeight);
  if (col < 0 || row < 0 || col >= grid.columns || row >= grid.rows) return null;
  const cell = row * grid.columns + col;
  const owners = grid.owners;
  if (!owners || cell >= owners.length) return null;
  const owner = owners[cell];
  if (typeof owner !== 'number' || owner < 0) return null;
  const particle = particles && particles[owner];
  if (!particle || !Number.isInteger(particle.whale)) return null;
  return particle.whale;
}

function spoutBlit(ink, frame, place) {
  if (!ink) return;
  const savedAlpha = ink.globalAlpha;
  const savedFill = ink.fillStyle;
  const savedAlign = ink.textAlign;
  const savedBaseline = ink.textBaseline;
  const savedFont = ink.font;
  try {
    if (!frame || !place || !Array.isArray(frame.rows)) return;
    const anchor = frame.anchor || { row: 0, col: 0 };
    const acrossX = Number.isFinite(place.acrossX) ? place.acrossX : 0;
    const acrossY = Number.isFinite(place.acrossY) ? place.acrossY : 0;
    const alongX = Number.isFinite(place.alongX) ? place.alongX : 0;
    const alongY = Number.isFinite(place.alongY) ? place.alongY : 0;
    const alphaAt = typeof place.alphaAt === 'function' ? place.alphaAt : null;
    if (!alphaAt && !(place.alpha >= 0.04)) return;
    if (place.fillStyle != null) ink.fillStyle = place.fillStyle;
    if (place.font != null) ink.font = place.font;
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    for (let row = 0; row < frame.rows.length; row++) {
      const line = frame.rows[row];
      if (typeof line !== 'string') continue;
      for (let col = 0; col < line.length; col++) {
        const glyph = line[col];
        if (glyph === ' ') continue;
        const dx = col - anchor.col;
        const dy = row - anchor.row;
        const x = place.anchorX + dx * acrossX + dy * alongX;
        const y = place.anchorY + dx * acrossY + dy * alongY;
        const glyphAlpha = alphaAt ? alphaAt(x, y) : place.alpha;
        if (!(glyphAlpha >= 0.04)) continue;
        ink.globalAlpha = glyphAlpha;
        ink.fillText(glyph, x, y);
      }
    }
  } finally {
    ink.globalAlpha = savedAlpha;
    ink.fillStyle = savedFill;
    ink.textAlign = savedAlign;
    ink.textBaseline = savedBaseline;
    ink.font = savedFont;
  }
}

function spoutParticle(x, y, z) {
  return { x, y, z, nx: 0, ny: -1, nz: 0, part: 'body', material: 'skin', seed: 0 };
}

function spoutPoseReady(pose) {
  return Boolean(pose) && Number.isFinite(pose.scale) && pose.spine != null && Number(pose.spine.length) > 0;
}

function spoutProjected(particle, pose) {
  try {
    const point = projectParticle(particle, pose);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return point;
  } catch {
    return null;
  }
}

function spoutCellLength(grid) {
  return Math.hypot(grid.cellWidth, grid.cellHeight) / Math.SQRT2;
}

function spoutScreenAxes(grid) {
  return { acrossX: grid.cellWidth, acrossY: 0, alongX: 0, alongY: grid.cellHeight };
}

function spoutNormalizeCell(dx, dy, cell) {
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !Number.isFinite(length)) return null;
  return { x: dx / length * cell, y: dy / length * cell };
}

function spoutAxes(mark, pose, origin, grid) {
  const screen = spoutScreenAxes(grid);
  if (mark.basis === 'screen') return screen;
  const cell = spoutCellLength(grid);
  if (!(cell > 0)) return screen;
  if (mark.basis === 'lateral') {
    const side = spoutProjected(spoutParticle(mark.x, mark.y, mark.z + 0.12), pose);
    if (!side) return screen;
    const across = spoutNormalizeCell(side.x - origin.x, side.y - origin.y, cell);
    if (!across) return screen;
    return { acrossX: across.x, acrossY: across.y, alongX: -across.y, alongY: across.x };
  }
  if (mark.basis === 'body') {
    const forward = spoutProjected(spoutParticle(mark.x + 0.08, mark.y, mark.z), pose);
    const side = spoutProjected(spoutParticle(mark.x, mark.y, mark.z + 0.06), pose);
    if (!forward || !side) return screen;
    const along = spoutNormalizeCell(forward.x - origin.x, forward.y - origin.y, cell);
    const across = spoutNormalizeCell(side.x - origin.x, side.y - origin.y, cell);
    if (!along || !across) return screen;
    return { acrossX: across.x, acrossY: across.y, alongX: along.x, alongY: along.y };
  }
  return screen;
}

function spoutDescribePointer(target) {
  let node = target ?? null;
  if (node && node.nodeType === 3) node = node.parentElement ?? null;
  let tag = '';
  let editable = false;
  let role = '';
  let composer = false;
  if (node && typeof node.closest === 'function') composer = Boolean(node.closest('[data-composer-card]'));
  for (let el = node; el; el = el.parentElement) {
    const name = typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
    if (!tag && name) tag = name;
    if (SPOUT_BLOCK_TAGS.has(name)) tag = name;
    if (el.isContentEditable === true) editable = true;
    else if (typeof el.getAttribute === 'function') {
      const flag = el.getAttribute('contenteditable');
      if (flag != null && String(flag).toLowerCase() !== 'false') editable = true;
    }
    const folded = typeof el.getAttribute === 'function' ? String(el.getAttribute('role') || '').toLowerCase() : '';
    if (!role && SPOUT_BLOCK_ROLES.has(folded)) role = folded;
  }
  return { tag, editable, composer, role };
}

function attachSpout(canvas, read) {
  let bursts = [];
  let seenScene;
  let detached = false;

  function spoutAdoptScene(state) {
    if (state.scene !== seenScene) {
      seenScene = state.scene;
      bursts.length = 0;
    }
  }

  function spoutDropExpired(now) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      if (!spoutAge(now - bursts[i].born)) bursts.splice(i, 1);
    }
  }

  function spoutPushBurst(state, whaleId) {
    const whale = state.scene && state.scene.whales && state.scene.whales[whaleId];
    if (!whale) return;
    const mark = SPOUT_MARK[whale.species];
    if (!mark) return;
    const pose = state.poses && state.poses[whaleId];
    if (!spoutPoseReady(pose)) return;
    const grid = state.grid;
    if (!grid || !(grid.cellWidth > 0) || !(grid.cellHeight > 0)) return;
    if (!Number.isFinite(state.now)) return;
    const origin = spoutProjected(spoutParticle(mark.x, mark.y, mark.z), pose);
    if (!origin) return;
    const axes = spoutAxes(mark, pose, origin, grid);
    spoutDropExpired(state.now);
    if (bursts.some(burst => burst.whaleId === whaleId)) return;
    if (bursts.length >= SPOUT_LIMIT) bursts.shift();
    bursts.push({
      whaleId,
      species: whale.species,
      born: state.now,
      anchorX: origin.x,
      anchorY: origin.y,
      acrossX: axes.acrossX,
      acrossY: axes.acrossY,
      alongX: axes.alongX,
      alongY: axes.alongY,
    });
  }

  function onPointerDown(event) {
    if (detached || !event) return;
    let state;
    try { state = read(); } catch { return; }
    if (!state || state.reduced || state.hidden || state.enabled !== true || event.button !== 0) return;
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!(x >= 0 && y >= 0 && x < rect.width && y < rect.height)) return;
    spoutAdoptScene(state);
    const described = spoutDescribePointer(event.target);
    const whaleId = spoutHit({
      enabled: true, button: 0, x, y,
      tag: described.tag, editable: described.editable, composer: described.composer, role: described.role,
    }, state.grid, state.scene && state.scene.particles);
    if (whaleId == null) return;
    spoutPushBurst(state, whaleId);
  }

  function paint(ink, fade) {
    if (detached) return;
    let state;
    try { state = read(); } catch { return; }
    if (!state || state.enabled !== true || state.reduced) {
      bursts.length = 0;
      return;
    }
    spoutAdoptScene(state);
    spoutDropExpired(state.now);
    if (!ink || !bursts.length) return;
    const opacity = Number.isFinite(state.opacity) ? state.opacity : 0;
    const fillStyle = state.dark ? '#d7e8ee' : '#b7d0d6';
    const font = `600 ${state.glyphSize}px Consolas, "Cascadia Mono", "Courier New", monospace`;
    for (const burst of bursts) {
      const aged = spoutAge(state.now - burst.born);
      if (!aged) continue;
      const frame = spoutFrame(burst.species, aged.phase);
      if (!frame) continue;
      spoutBlit(ink, frame, {
        anchorX: burst.anchorX, anchorY: burst.anchorY,
        acrossX: burst.acrossX, acrossY: burst.acrossY,
        alongX: burst.alongX, alongY: burst.alongY,
        fillStyle, font,
        alphaAt(x, y) {
          const veil = attenuation(x, y, state.width, state.height, state.quietCenter);
          const edge = typeof fade === 'function' ? fade(x, y) : 1;
          const whale = state.scene && state.scene.whales && state.scene.whales[burst.whaleId];
          const submergence = whale && whale._motion ? whale._motion.submergence : undefined;
          const surfaced = Number.isFinite(submergence) && submergence > 0 ? 1 - submergence : 1;
          return aged.alpha * opacity * veil * edge * surfaced;
        },
      });
    }
  }

  function detach() {
    if (detached) return;
    detached = true;
    bursts.length = 0;
    document.removeEventListener('pointerdown', onPointerDown);
  }

  document.addEventListener('pointerdown', onPointerDown);
  return { paint, detach };
}


// DSH publishes these hooks on the conversation subtree. Every one of them is
// optional: without them the whales simply paint as before, so an unknown
// layout can never break the background.
const SCROLL_SELECTOR = '[data-conversation-scroll]';
// The composer card is the rounded input itself; the seat is its sticky wrapper
// and is only used when the card hook is missing from the build.
const COMPOSER_CARD_SELECTOR = '[data-composer-card]';
const COMPOSER_SEAT_SELECTOR = '[data-composer-seat]';
const COMPOSER_RADIUS = 18;
const MEASURE_INTERVAL = 400;

// Which of the conversation's boxes get their own pane of glass. Only opaque,
// rounded, card-sized boxes are candidates; the input card is always one.
const CONTENT_MAX_BOXES = 16;
const CONTENT_MAX_SCAN = 600;
const CONTENT_MIN_AREA = 2000;
const CONTENT_MAX_AREA_RATIO = 0.55;
const CONTENT_MAX_HEIGHT_RATIO = 0.9;
const CONTENT_MIN_ALPHA = 0.9;


// Which option belongs to which kind of work. A group only rebuilds its own
// part; `live` options are read straight from the config while painting, so
// changing one needs nothing more than the next frame.
const SCENE_KEYS = Object.freeze(['count', 'text', 'species', 'whaleSize']);
const METRIC_KEYS = Object.freeze(['glyphSize', 'fillMode', 'renderStyle']);
const PALETTE_KEYS = Object.freeze(['color']);
const GLASS_KEYS = Object.freeze(['glass', 'glassStrength']);
const COMPOSER_KEYS = Object.freeze(['composerGlass', 'composerAvoid']);
const LIVE_KEYS = Object.freeze(['enabled', 'speed', 'opacity', 'quietCenter', 'leftInset', 'spout', 'reefs', 'ripples']);
const anyChanged = (keys, previous, next) => keys.some(key => previous[key] !== next[key]);
const noChange = changes => !changes.scene && !changes.metrics && !changes.palette
  && !changes.glass && !changes.composer && !changes.live;

/**
 * Compare two normalized configs by value, not by object identity.
 *
 * DSH re-reads and re-decodes the whole settings document after every write
 * (choosing a model saves the default model in the same document) and hands the
 * plugin a brand new `value` object even when nothing changed. Comparing by
 * identity would restart the school for a model switch; comparing the values
 * lets `update` return immediately.
 */
function diffWhaleConfig(previous, next) {
  const before = previous || {}, after = next || {};
  return {
    scene: anyChanged(SCENE_KEYS, before, after),
    metrics: anyChanged(METRIC_KEYS, before, after),
    palette: anyChanged(PALETTE_KEYS, before, after),
    glass: anyChanged(GLASS_KEYS, before, after),
    composer: anyChanged(COMPOSER_KEYS, before, after),
    live: anyChanged(LIVE_KEYS, before, after),
  };
}

function rectOf(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
}

/** The match that overlaps the canvas most, so a stale hidden copy cannot win. */
function pick(selector, canvasRect) {
  let best = null, bestArea = 0;
  for (const element of document.querySelectorAll(selector)) {
    const rect = rectOf(element);
    if (!rect) continue;
    const overlap = Math.max(0, Math.min(rect.left + rect.width, canvasRect.left + canvasRect.width) - Math.max(rect.left, canvasRect.left));
    const area = overlap * Math.min(rect.height, canvasRect.height);
    if (area > bestArea) { bestArea = area; best = { element, rect }; }
  }
  return best;
}

/**
 * Parse a computed CSS colour into channels plus alpha. Anything unparsable is
 * treated as fully transparent, which is exactly how a candidate box that is not
 * an opaque surface should behave.
 */
function colorAlpha(value) {
  const match = String(value || '').match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(/[,/ ]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) return null;
  return parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1;
}

/** Smallest computed corner radius of an element, in CSS pixels (null if none). */
function cornerRadius(style) {
  const values = [style.borderTopLeftRadius, style.borderTopRightRadius,
    style.borderBottomRightRadius, style.borderBottomLeftRadius]
    .map(value => parseFloat(value))
    .filter(value => Number.isFinite(value) && value >= 0);
  if (values.length) return Math.min(...values);
  const shorthand = parseFloat(style.borderRadius);
  return Number.isFinite(shorthand) && shorthand >= 0 ? shorthand : null;
}

/** The card's own corner radius, so the glass matches the input it covers. */
function composerRadius(element) {
  try {
    const radius = cornerRadius(getComputedStyle(element));
    return radius === null ? COMPOSER_RADIUS : radius;
  } catch { return COMPOSER_RADIUS; }
}

/**
 * Every box in the conversation that should carry its own glass.
 *
 * Walks the scroller subtree breadth-first (parents before children, so an outer
 * card is always painted before a card nested in it) and stops after
 * CONTENT_MAX_SCAN elements. Cheap geometry filters run before any style read:
 * only elements that are visible, intersect the canvas and are card-sized get a
 * getComputedStyle call. The input card is appended explicitly because its fill
 * can be a layered background that the generic opacity test would miss.
 *
 * This runs inside measure() only — never per frame.
 */
function collectContentBoxes(canvasRect, composerHit) {
  const boxes = [];
  const canvasArea = canvasRect.width * canvasRect.height;
  const scroller = pick(SCROLL_SELECTOR, canvasRect);
  if (scroller) {
    const queue = [scroller.element];
    let checked = 0;
    while (queue.length && checked < CONTENT_MAX_SCAN) {
      const element = queue.shift();
      checked++;
      const children = element.children;
      if (children) for (const child of children) queue.push(child);
      let rect;
      try { rect = element.getBoundingClientRect(); } catch { continue; }
      if (!(rect.width > 0) || !(rect.height > 0)) continue;
      if (rect.left + rect.width < canvasRect.left || rect.left > canvasRect.left + canvasRect.width) continue;
      if (rect.top + rect.height < canvasRect.top || rect.top > canvasRect.top + canvasRect.height) continue;
      const area = rect.width * rect.height;
      if (!(area >= CONTENT_MIN_AREA) || area > canvasArea * CONTENT_MAX_AREA_RATIO) continue;
      if (!(rect.height < canvasRect.height * CONTENT_MAX_HEIGHT_RATIO)) continue;
      let style;
      try { style = getComputedStyle(element); } catch { continue; }
      if (style.position === 'fixed') continue;
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const alpha = colorAlpha(style.backgroundColor);
      if (alpha === null || alpha < CONTENT_MIN_ALPHA) continue;
      const radius = cornerRadius(style);
      if (!(radius > 0)) continue;
      boxes.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, radius });
    }
  }
  // The input card is always a content box, whatever its background shorthand.
  if (composerHit) {
    boxes.push({ left: composerHit.rect.left, top: composerHit.rect.top,
      width: composerHit.rect.width, height: composerHit.rect.height,
      radius: composerRadius(composerHit.element) });
  }
  return boxes;
}

/**
 * The card plus a margin, in canvas coordinates, as a motion obstacle.
 *
 * The margin is what keeps bodies from merely touching the glass: it grows with
 * the largest whale in the school (so a bigger school keeps proportionally more
 * room) and never shrinks below 26px. A card entirely off the sea yields no
 * obstacle at all.
 */
function composerObstacle(canvasRect, cardRect, largestRadius) {
  const margin = Math.max(26, 22 + 0.35 * (Number.isFinite(largestRadius) ? largestRadius : 0));
  const left = Math.max(0, cardRect.left - canvasRect.left - margin);
  const top = Math.max(0, cardRect.top - canvasRect.top - margin);
  const right = Math.min(canvasRect.width, cardRect.left - canvasRect.left + cardRect.width + margin);
  const bottom = Math.min(canvasRect.height, cardRect.top - canvasRect.top + cardRect.height + margin);
  return right - left >= 1 && bottom - top >= 1
    ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

/**
 * Normalize like the settings form, but keep an explicit `speed: 0`.
 *
 * The settings range starts at 0.3, so the form can never produce a zero. The
 * standalone preview uses 0 as "paused", and stepScene already treats a zero
 * speed as "do not advance". Honouring that sentinel inside the layer gives the
 * preview a pause without adding a second public API, and leaves
 * normalizeConfig/FIELDS (and their tests) exactly as contracted.
 */
function normalizeLayerConfig(value) {
  const config = normalizeConfig(value);
  if (value && typeof value.speed === 'number' && value.speed <= 0) config.speed = 0;
  return config;
}

/**
 * Mount the animated background and keep it alive across settings writes.
 *
 * `update(next)` is the replacement for remounting: it applies only what the
 * changed options require, and an identical configuration is a complete no-op.
 * That is what stops "choose a model" (which rewrites the settings document,
 * not these settings) from restarting the school.
 *
 * The normalized config is kept as one object that is mutated in place, so the
 * painter and the draw loop read the new opacity/speed straight away instead of
 * being rebuilt.
 */
function createWhaleLayer(canvas, initialConfig) {
  const ink = canvas.getContext('2d');
  if (!ink) return { update() {}, dispose() {} };
  const config = normalizeLayerConfig(initialConfig);
  const scenerySeed = Math.floor(Math.random() * 0x100000000) >>> 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  let scene = createScene(config.count, config.text, config.species, config.whaleSize);
  scene.diveSeed = scenerySeed;
  let reef = null;
  const water = createWaterField();
  let sceneryPalette = createInkPalette(config.color);
  let poses = scene.whales.map(() => ({}));
  let projected = scene.particles.map((_, particleIndex) => ({ particleIndex }));
  let painter = createWhalePainter(scene, config);
  ink.font = painter.font;
  let metrics = measureGlyphs();
  let width = 0, height = 0, ratio = 1, grid = null;
  // Shared blurred sea: one downsampled painter pass and one blur per frame; the
  // number of panes only changes how many times the image is drawn, never the
  // blur cost.
  let sea = null, seaInk = null, blurredSea = null, blurredSeaInk = null;
  let seaFactor = 0, seaPad = 0, seaBlurRadius = 0, blurSupport = false;
  let panes = [], tone = null, composerCard = null;
  let avoidRect = null;
  let raf = 0, previous = null, lastPaint = -Infinity, measuredAt = -Infinity, disposed = false;
  const spout = attachSpout(canvas, () => ({
    enabled: config.spout,
    reduced: reduced.matches,
    hidden: document.hidden,
    opacity: config.opacity,
    quietCenter: config.quietCenter,
    glyphSize: config.glyphSize,
    dark: document.body.hasAttribute('data-ds-dark-theme'),
    scene, poses, grid, width, height,
    now: performance.now(),
  }));

  /** The widest/tallest glyph decides the cell size, so measure the whole alphabet. */
  function measureGlyphs() {
    ink.font = painter.font;
    const measured = { width: config.glyphSize, height: config.glyphSize * 1.2, square: painter.square };
    for (const glyph of painter.alphabet) {
      const inkMetrics = ink.measureText(glyph);
      measured.width = Math.max(measured.width, inkMetrics.width, (inkMetrics.actualBoundingBoxLeft || 0) + (inkMetrics.actualBoundingBoxRight || 0));
      measured.height = Math.max(measured.height, (inkMetrics.actualBoundingBoxAscent || 0) + (inkMetrics.actualBoundingBoxDescent || 0));
    }
    return measured;
  }

  /** Allocate or resize the shared low-resolution sea buffers for one tone. */
  function seaBuffers(material) {
    const factor = glassSeaFactor(material.strength);
    const buffer = glassSeaBuffer(width, height, { factor, blur: material.blur });
    try {
      if (!sea) {
        sea = document.createElement('canvas');
        seaInk = sea.getContext('2d');
        blurredSea = document.createElement('canvas');
        blurredSeaInk = blurredSea.getContext('2d');
        if (!seaInk || !blurredSeaInk) { sea = seaInk = blurredSea = blurredSeaInk = null; return false; }
        // Feature-detect the Gaussian filter once; without it the downsample and
        // upscale still smear the field, just more coarsely.
        seaInk.filter = 'blur(1px)';
        blurSupport = seaInk.filter === 'blur(1px)';
        seaInk.filter = 'none';
      }
    } catch { sea = seaInk = blurredSea = blurredSeaInk = null; return false; }
    if (sea.width !== buffer.width || sea.height !== buffer.height) {
      sea.width = buffer.width;
      sea.height = buffer.height;
    }
    if (blurredSea.width !== buffer.width || blurredSea.height !== buffer.height) {
      blurredSea.width = buffer.width;
      blurredSea.height = buffer.height;
    }
    seaFactor = buffer.factor;
    seaPad = buffer.pad;
    seaBlurRadius = buffer.blurRadius;
    return true;
  }

  /**
   * Paint the whole sea (glyph field, no pane fade) into the low-resolution
   * buffer and blur it once.
   *
   * This image must not be a copy of the main canvas: by the time a pane is
   * painted, the sharp glyphs inside it have already been faded out, so a copy
   * would be empty exactly where the glass has to show whales. This separate
   * pass is the source of truth for "what lies under the glass".
   *
   * The glyph-only mode also gets a body silhouette under the letters. At 1/4–1/6
   * resolution glyph strokes rasterise to a couple of pixels, and the blur then
   * spreads their alpha so thin that the pane would look empty again — the pale
   * silhouette is what makes the blurred whale a shape rather than a faint
   * texture. Cells mode already fills the body with tiles, so it skips this.
   */
  function paintBlurredSea(material) {
    const dark = document.body.hasAttribute('data-ds-dark-theme');
    seaInk.setTransform(1, 0, 0, 1, 0, 0);
    seaInk.clearRect(0, 0, sea.width, sea.height);
    // The painter works in CSS pixels; the 1/factor transform rasterises it at a
    // fraction of the resolution and the panes scale the blur back up.
    seaInk.setTransform(1 / seaFactor, 0, 0, 1 / seaFactor, seaPad, seaPad);
    if (config.renderStyle !== 'cells') paintSeaSilhouette(seaInk, material);
    painter.paint(seaInk, grid, poses, width, height, 1, null, dark);
    blurredSeaInk.setTransform(1, 0, 0, 1, 0, 0);
    blurredSeaInk.clearRect(0, 0, blurredSea.width, blurredSea.height);
    blurredSeaInk.filter = blurSupport ? `blur(${Math.max(0.4, seaBlurRadius).toFixed(2)}px)` : 'none';
    blurredSeaInk.drawImage(sea, 0, 0);
    blurredSeaInk.filter = 'none';
  }

  /** Pale body shape under the sea's glyphs; the blur turns it into frosted glass. */
  function paintSeaSilhouette(target, material) {
    target.fillStyle = `rgb(${material.silhouette})`;
    target.globalAlpha = 0.9;
    const over = grid.cellWidth * 0.22;
    for (let cell = 0; cell < grid.owners.length; cell++) {
      if (grid.owners[cell] < 0 || grid.visibility[cell] < 0.05) continue;
      const x = grid.centersX[cell], y = grid.centersY[cell];
      target.fillRect(x - grid.cellWidth / 2 - over, y - grid.cellHeight / 2 - over,
        grid.cellWidth + over * 2, grid.cellHeight + over * 2);
    }
    target.globalAlpha = 1;
  }

  /** The cells and their glyphs share one fade at every pane edge. */
  function paintGlyphs(target, fade = null) {
    painter.paint(target, grid, poses, width, height, ratio, fade, document.body.hasAttribute('data-ds-dark-theme'));
  }

  /**
   * Install the obstacle for the current scene from the card recorded by the
   * last measure. No DOM read: a scene rebuild only changes the school, so the
   * margin (which depends on the largest body) is refreshed without measuring.
   */
  function applySceneObstacles() {
    if (!scene) return;
    const obstacles = config.reefs && reef ? reefObstacles(reef) : [];
    if (config.composerAvoid && composerCard) {
      let largest = 0;
      for (const whale of scene.whales) largest = Math.max(largest, Number(whale.bodyRadius) || 0);
      const obstacle = composerObstacle(composerCard.canvas, composerCard.card, largest);
      if (obstacle) obstacles.push(obstacle);
    }
    setSceneObstacles(scene, obstacles);
  }

  /**
   * Re-read the conversation geometry: one box list for the content glass, plus
   * the input card for avoidance.
   *
   * Cheap and only layout can change it, so it runs on a 400ms budget and on
   * every invalidation. Box collection and style reads happen here only — never
   * per frame.
   */
  function measure() {
    measuredAt = performance.now();
    panes = [];
    tone = null;
    composerCard = null;
    avoidRect = null;
    if (!width || !height || !scene || disposed) return;
    if (!config.glass && !config.composerAvoid) {
      applySceneObstacles();
      return;
    }
    const canvasRect = rectOf(canvas);
    if (!canvasRect) return;
    const dark = document.body.hasAttribute('data-ds-dark-theme');
    const material = { dark, reducedTransparency: reducedTransparency.matches };
    // The input card is both a content box and the avoidance target; the card
    // hook wins over its sticky seat wrapper.
    const cardHit = pick(COMPOSER_CARD_SELECTOR, canvasRect);
    const composer = cardHit || pick(COMPOSER_SEAT_SELECTOR, canvasRect);
    if (composer) composerCard = { card: composer.rect, canvas: canvasRect };
    if (config.glass) {
      const boxes = collectContentBoxes(canvasRect, cardHit);
      panes = glassContentPanes({ canvas: canvasRect, boxes, max: CONTENT_MAX_BOXES });
      // 'clear' (reduced transparency) keeps the panes for the glyph hold-out but
      // paints no material, so the boxes stay free of the sea either way.
      tone = glassContentTone(config.glassStrength, material);
    }
    if (config.composerAvoid && composer) {
      // This canvas paints above the input card, so whale ink must never land on
      // it: avoidance keeps the bodies away, and this rectangle is the guarantee
      // for a transiently bent fluke. Eight pixels cover a glyph cell's edge.
      const left = Math.max(0, composer.rect.left - canvasRect.left - 8);
      const top = Math.max(0, composer.rect.top - canvasRect.top - 8);
      const right = Math.min(canvasRect.width, composer.rect.left - canvasRect.left + composer.rect.width + 8);
      const bottom = Math.min(canvasRect.height, composer.rect.top - canvasRect.top + composer.rect.height + 8);
      avoidRect = right - left > 0 && bottom - top > 0 ? { x: left, y: top, width: right - left, height: bottom - top } : null;
    }
    applySceneObstacles();
  }

  function draw() {
    if (!width || !height || !scene || !grid) return;
    if (performance.now() - measuredAt > MEASURE_INTERVAL) measure();
    ink.setTransform(ratio, 0, 0, ratio, 0, 0);
    ink.clearRect(0, 0, width, height);
    for (let i = 0; i < scene.whales.length; i++) whalePose(scene.whales[i], scene.time, width, height, config.speed, poses[i]);
    for (let i = 0; i < scene.particles.length; i++) projectParticle(scene.particles[i], poses[scene.particles[i].whale], projected[i]);
    resolveDepthGrid(projected, grid, scene.triangles, scene.decals);
    // Reduced transparency withholds the material, not the readability work: the
    // panes still hold the glyphs out, they just paint no glass over the words.
    const frosted = Boolean(tone) && tone.mode === 'frost';
    const visiblePanes = tone ? panes : [];
    const openWater = !visiblePanes.length && !avoidRect;
    const featherOf = pane => pane.feather ?? (tone ? tone.feather : 10) ?? 10;
    // Glyphs hold out of every pane across that pane's own feather, so no whale
    // is cut by a line; the ramp keeps the body readable right up to the glass.
    const fade = openWater ? null : (x, y) => {
      // The input card is opaque to whale ink when avoidance is on (see avoidRect).
      if (avoidRect && x > avoidRect.x && x < avoidRect.x + avoidRect.width
        && y > avoidRect.y && y < avoidRect.y + avoidRect.height) return 0;
      let fade = 1;
      for (const pane of visiblePanes) fade = Math.min(fade, glassEdgeFade(pane, x, y, featherOf(pane)));
      return fade;
    };
    const sceneryFade = (x, y) => attenuation(x, y, width, height, config.quietCenter)
      * (fade ? fade(x, y) : 1);
    const scenery = { width, height, ratio, font: painter.font, palette: sceneryPalette,
      cellWidth: grid.cellWidth, cellHeight: grid.cellHeight, opacity: config.opacity, fade: sceneryFade };
    if (config.reefs && reef) drawReefs(ink, reef, scenery);
    if (config.ripples) drawWater(ink, water, scenery);
    paintGlyphs(ink, fade);
    spout.paint(ink, fade);
    if (openWater || !frosted || !visiblePanes.length) return;
    if (!seaBuffers(tone)) return;
    paintBlurredSea(tone);
    // One shared sea image for every pane, then the cheap per-pane surface work.
    paintPaneSeaUnion(visiblePanes, tone);
    for (const pane of visiblePanes) paintPaneSurface(pane, tone);
  }

  /**
   * The glass material, drawn in two passes so the expensive step happens once.
   *
   * The blurred sea is the only large operation, so it is painted once for the
   * whole set of panes: every pane appends its own rounded rectangle to one path
   * and that union is clipped for a single drawImage. The union only covers the
   * inside of the boxes — the gaps between two cards are inside no subpath, so
   * the sea is never drawn there. The per-pane work that remains is one rounded
   * clip plus three small fills (flat tint, top crest, bottom shade), which keeps
   * each box's own rounded edge and never welds two cards together.
   *
   * The tint is applied on top of the shared sea instead of underneath it. The
   * veil is only 0.033–0.05 alpha, and composing the two orders gives 4.83:1 vs
   * 4.88:1 at the worst case — imperceptible, while it lets tint and rim share
   * one clip per pane instead of two.
   *
   * The pane deliberately draws no outline. The card already has DSH's own
   * hairline elevation ring on exactly this rectangle; a second 1px stroke on the
   * same path only diverges at the corners under fractional scaling, which reads
   * as two rounded frames with different radii (T3 measured r≈28.5 neutral vs
   * r≈33.4 blue-ish). The frame belongs to the DOM, the material belongs to us.
   *
   * Nested boxes (a code block inside a card) get the sea once instead of twice,
   * so an inner pane is no longer slightly denser than its host; each box still
   * keeps its own tint and rim light.
   */
  function paintPaneSeaUnion(list, material) {
    if (!list.length) return;
    ink.save();
    ink.beginPath();
    for (const pane of list) glassRoundedSubpath(ink, pane);
    ink.clip();
    ink.imageSmoothingEnabled = true;
    ink.imageSmoothingQuality = 'high';
    ink.globalAlpha = material.mist;
    // The whole shared buffer maps 1:1 onto the canvas: one image, one scale-up.
    ink.drawImage(blurredSea, seaPad, seaPad, width / seaFactor, height / seaFactor, 0, 0, width, height);
    ink.globalAlpha = 1;
    ink.restore();
  }

  /** Flat tint, top crest and bottom shade for one pane, in a single clip. */
  function paintPaneSurface(panel, material) {
    ink.save();
    glassRoundedPath(ink, panel);
    ink.clip();
    ink.fillStyle = `rgba(${material.tint}, ${material.veil})`;
    ink.fillRect(panel.x, panel.y, panel.width, panel.height);
    // Light on the rim: a short bright band at the top that fades out, and a soft
    // shade at the bottom. Gradients keep the pane from looking framed.
    const crestHeight = Math.min(material.crestHeight, panel.height * 0.2);
    const crest = ink.createLinearGradient(0, panel.y, 0, panel.y + crestHeight);
    crest.addColorStop(0, material.crest);
    crest.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ink.fillStyle = crest;
    ink.fillRect(panel.x + panel.radius * 0.6, panel.y + 1,
      Math.max(0, panel.width - panel.radius * 1.2), crestHeight);
    const shade = ink.createLinearGradient(0, panel.y + panel.height - material.shadeHeight, 0, panel.y + panel.height);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, material.shade);
    ink.fillStyle = shade;
    ink.fillRect(panel.x, panel.y + panel.height - material.shadeHeight, panel.width, material.shadeHeight);
    ink.restore();
  }

  function frame(now) {
    raf = 0;
    if (disposed || document.hidden || reduced.matches || !width || !height || !scene) return;
    if (previous !== null) {
      const startedAt = scene.time;
      stepScene(scene, Math.min(0.1, (now - previous) / 1000), config.speed);
      if (config.ripples) stepWater(water, scene, scene.time - startedAt);
    }
    previous = now;
    if (now - lastPaint >= 1000 / 30) { draw(); lastPaint = now; }
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    cancelAnimationFrame(raf);
    raf = 0;
    previous = null;
    lastPaint = -Infinity;
    measuredAt = -Infinity;
    if (!disposed && !document.hidden && width && height) {
      draw();
      if (!reduced.matches) raf = requestAnimationFrame(frame);
    }
  }

  /**
   * Apply a new configuration without remounting the layer.
   *
   * Called after every settings document write, so the first thing it does is
   * compare values: an unchanged configuration returns before touching the
   * canvas — no font measurement, no new depth grid, no new scene and no
   * interrupted animation frame. Each changed group then does only its own
   * work, and a rebuilt scene inherits the swimming state of the old one, so
   * the whales never jump back to their starting layout.
   */
  function update(nextConfig) {
    if (disposed) return;
    const next = normalizeLayerConfig(nextConfig);
    const changes = diffWhaleConfig(config, next);
    if (noChange(changes)) return;
    // The draw loop and the painter share this object, so live options such as
    // opacity and speed apply from the next frame without any rebuild.
    const previousReefs = config.reefs, previousRipples = config.ripples;
    Object.assign(config, next);

    if (changes.scene) {
      const previousScene = scene;
      const replacement = createScene(config.count, config.text, config.species, config.whaleSize);
      replacement.diveSeed = scenerySeed;
      // Give the replacement the discarded scene's coordinate space before the
      // hand-over, so the adopted positions are valid as they are and never get
      // rescaled. Deriving it from the scene (not from the canvas) also covers
      // the short window where the canvas has not been laid out yet.
      const spaceWidth = previousScene.width > 0 ? previousScene.width : (width || 1600);
      const spaceHeight = previousScene.height > 0 ? previousScene.height : (height || 900);
      resizeScene(replacement, spaceWidth, spaceHeight);
      adoptSceneState(previousScene, replacement);
      scene = replacement;
      poses = scene.whales.map(() => ({}));
      projected = scene.particles.map((_, particleIndex) => ({ particleIndex }));
      // A new scene starts without obstacles: put the already-measured card
      // back in front of it (margin follows the new body sizes), no DOM read.
      applySceneObstacles();
    }
    // A scene change also brings a new glyph alphabet (the user's body text), so
    // the painter is rebuilt for it as well — not only for font and style.
    if (changes.scene || changes.metrics) {
      painter = createWhalePainter(scene, config);
      metrics = measureGlyphs();
      if (width && height) grid = createDepthGrid(width, height, config.glyphSize, metrics);
    } else if (changes.palette) {
      painter = createWhalePainter(scene, config);
    }
    // Only the glass groups re-read the DOM; a scene change already reused the
    // measured card through applySceneObstacles above.
    if (changes.glass || changes.composer) {
      measuredAt = -Infinity;
      if (width && height) measure();
    }

    if (previousReefs !== config.reefs) applySceneObstacles();
    if (previousRipples !== config.ripples || changes.scene) resetWaterField(water);
    if (changes.palette) sceneryPalette = createInkPalette(config.color);

    lastPaint = -Infinity;
    if (!document.hidden && width && height) {
      // Repaint one frame now, so a change is visible even while reduced motion
      // keeps the animation loop stopped; otherwise the loop simply continues.
      if (!reduced.matches && !raf) raf = requestAnimationFrame(frame);
      draw();
      lastPaint = performance.now();
    }
  }

  /** Scrolling moves the column under a fixed sea, so only the geometry is stale. */
  function onScroll() {
    measuredAt = -Infinity;
    if (reduced.matches) sync();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.floor(rect.width), nextHeight = Math.floor(rect.height);
    const pixels = fitCanvas(nextWidth, nextHeight, window.devicePixelRatio);
    if (width === nextWidth && height === nextHeight && canvas.width === pixels.width && canvas.height === pixels.height) return;
    width = nextWidth; height = nextHeight; ratio = pixels.ratio;
    canvas.width = pixels.width; canvas.height = pixels.height;
    ink.setTransform(ratio, 0, 0, ratio, 0, 0);
    grid = createDepthGrid(width, height, config.glyphSize, metrics);
    resizeScene(scene, width, height);
    if (width > 0 && height > 0) {
      if (reef) resizeReefField(reef, width, height);
      else reef = createReefField({ width, height, seed: scenerySeed, count: width * height < 360000 ? 2 : 3 });
      resetWaterField(water);
    }
    measuredAt = -Infinity;
    sync();
  }

  const observer = new ResizeObserver(resize);
  const themeObserver = new MutationObserver(sync);
  observer.observe(canvas);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  reducedTransparency.addEventListener('change', sync);
  window.addEventListener('resize', resize);
  document.addEventListener('scroll', onScroll, true);
  resize();
  function dispose() {
    spout.detach();
    resetWaterField(water);
    reef = null;
    disposed = true;
    cancelAnimationFrame(raf);
    raf = 0;
    observer.disconnect();
    themeObserver.disconnect();
    document.removeEventListener('visibilitychange', sync);
    reduced.removeEventListener('change', sync);
    reducedTransparency.removeEventListener('change', sync);
    window.removeEventListener('resize', resize);
    document.removeEventListener('scroll', onScroll, true);
    grid = null;
    scene = previous = null;
    painter = null;
    poses = [];
    projected = [];
    sea = seaInk = blurredSea = blurredSeaInk = null;
    seaFactor = 0;
    seaPad = 0;
    panes = [];
    tone = null;
    composerCard = null;
    avoidRect = null;
    canvas.width = canvas.height = 1;
  }
  return { update, dispose };
}

/** Backwards-compatible entry point: mounts a layer and returns its disposer. */
function mountWhales(canvas, config) {
  const layer = createWhaleLayer(canvas, config);
  return () => layer.dispose();
}


/** Slider readouts follow the field's own step: whole-number fields show integers. */
function readout(field, value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '';
  return field.step === 1 ? String(Math.round(number)) : number.toFixed(2);
}

/** Filled part of a native range track, handed to CSS as a gradient stop. */
function trackFill(ratio) {
  const safe = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return `${(safe * 100).toFixed(1)}%`;
}

/** Index of the current option; a stale value falls back to the first option. */
function optionIndex(field, value) {
  const index = field.values.indexOf(value);
  return index < 0 ? 0 : index;
}

function registerWhales(ctx, React, dictionaries) {
  const h = React.createElement;
  const form = ctx.configForms.get('ascii-whale-background');
  const formSubscribe = callback => form.subscribe(callback);
  const formSnapshot = () => form.getSnapshot();
  const localeSubscribe = callback => ctx.locale.subscribe(callback);
  const localeSnapshot = () => ctx.locale.getSnapshot();
  ctx.effect(() => ctx.locale.register('asciiWhales', 'en', dictionaries.en));
  ctx.effect(() => ctx.locale.register('asciiWhales', 'zh', dictionaries.zh));
  const t = ctx.locale.bind('asciiWhales');
  const useForm = () => React.useSyncExternalStore(formSubscribe, formSnapshot, formSnapshot);

  /**
   * The canvas mounts exactly once and later changes are pushed through update().
   *
   * DSH re-reads the whole settings document on every settings write — choosing a
   * model in the composer saves the default model there too — and every config
   * form receives a freshly decoded `value` object even when nothing changed.
   * Re-creating the scene then would snap each whale back to its starting layout.
   * So the layer lives for as long as the canvas node and only the update effect
   * reacts to configuration changes.
   */
  function Canvas({ config }) {
    const ref = React.useRef(null);
    const configRef = React.useRef(config);
    const layer = React.useRef(null);
    React.useEffect(() => {
      const instance = createWhaleLayer(ref.current, configRef.current);
      layer.current = instance;
      return () => { instance.dispose(); layer.current = null; };
      // Mount-only on purpose: this effect owns the canvas, not the config.
    }, []);
    React.useEffect(() => {
      configRef.current = config;
      layer.current?.update(config);
    }, [config]);
    return h('canvas', { ref, 'aria-hidden': true, style: { display: 'block', width: '100%', height: '100%' } });
  }

  /**
   * A static sample of the draft. Drag events arrive faster than the renderer
   * needs them, so redraws are coalesced into one animation frame and that frame
   * reads the latest draft; the theme observer keeps the sample in step with
   * DSH switching between light and dark.
   */
  function StylePreview({ draft }) {
    const ref = React.useRef(null);
    const latest = React.useRef(draft);
    const frame = React.useRef(0);
    const draw = React.useCallback(() => {
      frame.current = 0;
      const canvas = ref.current;
      if (!canvas) return;
      drawWhaleSample(canvas, normalizeConfig(latest.current), {
        ratio: Math.min(2, window.devicePixelRatio || 1),
        dark: document.body.hasAttribute('data-ds-dark-theme'),
      });
    }, []);
    const schedule = React.useCallback(() => {
      if (!frame.current) frame.current = requestAnimationFrame(draw);
    }, [draw]);
    React.useEffect(() => { latest.current = draft; schedule(); }, [draft, schedule]);
    React.useEffect(() => {
      const observer = new ResizeObserver(schedule);
      const themeObserver = new MutationObserver(schedule);
      observer.observe(ref.current);
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
      schedule();
      return () => {
        observer.disconnect();
        themeObserver.disconnect();
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = 0;
      };
    }, [schedule]);
    return h('div', { className: 'aw-style-preview' },
      h('canvas', { ref, role: 'img', 'aria-label': t('stylePreview') }),
      h('p', null, t('stylePreviewNote')));
  }

  function Overlay(props) {
    const panelId = props.usePanelInfo(s => s.activePanelId);
    const snapshot = useForm();
    // Compare content, not references: an unchanged settings document must keep
    // the very same config object, so the update effect does not even fire.
    const signature = snapshot.status === 'ready' ? configSignature(snapshot.value) : '';
    const config = React.useMemo(() => normalizeConfig(snapshot.value ?? {}), [signature]);
    if (snapshot.status !== 'ready' || !config.enabled || (panelId !== null && panelId !== 'conversation')) return null;
    return h('div', { 'aria-hidden': true, style: {
      position: 'absolute', left: 'var(--dsh-windows-sidebar-width, var(--ascii-whale-inset, 280px))',
      top: 'var(--dsh-frame-top-clearance, 0px)', right: 0, bottom: 0,
      '--ascii-whale-inset': `${config.leftInset}px`, pointerEvents: 'none', overflow: 'hidden',
    } }, h(Canvas, { config }));
  }

  function editorFrom(snapshot) {
    const base = normalizeConfig(snapshot.value);
    return { base, draft: { ...base }, revision: snapshot.revision };
  }
  const isDirty = editor => editor && Object.entries(FIELDS).some(([key, field]) => {
    const value = editor.draft[key];
    return field.kind === 'number' ? value === '' || Number(value) !== editor.base[key] : value !== editor.base[key];
  });

  function Settings() {
    const snapshot = useForm();
    React.useSyncExternalStore(localeSubscribe, localeSnapshot, localeSnapshot);
    const [editor, setEditor] = React.useState(() => snapshot.status === 'ready' ? editorFrom(snapshot) : null);
    const [saving, setSaving] = React.useState(false);
    const [notice, setNotice] = React.useState('');
    const dirty = isDirty(editor);
    React.useEffect(() => {
      if (snapshot.status === 'ready' && !dirty) setEditor(editorFrom(snapshot));
    }, [snapshot, dirty]);
    const prefix = React.useId();
    if (snapshot.status !== 'ready' || !editor) return h('p', { role: 'status' }, t(snapshot.status === 'loading' ? 'loading' : 'unavailable'));
    const disabled = !snapshot.writable || saving;
    // The content glass and the input-box avoidance are alternatives: glass already
    // blurs what is behind every box, so avoiding the input box as well would only
    // squeeze the school for no visual gain. Turning one on turns the other off in
    // the same draft, and the save below submits both keys through the ordinary ops
    // path (only the keys that really changed).
    const EXCLUSIVE = { glass: 'composerAvoid', composerAvoid: 'glass' };
    function update(key, value) {
      setEditor(current => {
        const draft = { ...current.draft, [key]: value };
        const opposite = EXCLUSIVE[key];
        if (opposite && value === true) draft[opposite] = false;
        return { ...current, draft };
      });
      setNotice('');
    }
    async function save(event) {
      event.preventDefault();
      if (disabled || !dirty) return;
      const values = { ...editor.draft };
      for (const [key, f] of Object.entries(FIELDS)) {
        if (f.kind === 'number') {
          const value = Number(values[key]);
          if (values[key] === '' || !Number.isFinite(value) || value < f.min || value > f.max || (f.step === 1 && !Number.isInteger(value))) {
            setNotice('invalid');
            return;
          }
          values[key] = value;
        }
      }
      const ops = Object.keys(FIELDS).filter(k => values[k] !== editor.base[k]).map(k => ({ op: 'set', path: [k], value: values[k] }));
      if (!ops.length) return;
      setSaving(true);
      setNotice('');
      try {
        if (await form.mutate(ops, editor.revision)) {
          setEditor(editorFrom(form.getSnapshot()));
          setNotice('saved');
        } else setNotice('conflict');
      } catch { setNotice('failed'); }
      finally { setSaving(false); }
    }
    function discard() { setEditor(editorFrom(form.getSnapshot())); setNotice(''); }
    return h('form', { className: 'aw-settings', onSubmit: save },
      h('style', null, SETTINGS_CSS),
      h('h2', null, t('title')),
      h('p', { className: 'aw-purpose' }, t('purpose')),
      h(StylePreview, { draft: editor.draft }),
      !snapshot.writable && h('p', { role: 'status' }, t('readOnly')),
      // Hidden fields stay in FIELDS for Host schema compatibility (an old profile
      // may still carry composerGlass) but must not render a row of their own.
      ...Object.entries(FIELDS).filter(([, field]) => field.hidden !== true).map(([key, field]) => {
        const id = `${prefix}-${key}`, hint = `${id}-hint`, value = editor.draft[key];
        const off = disabled || (key === 'text' && editor.draft.fillMode === 'ascii');
        const common = { id, disabled: off, 'aria-describedby': hint };
        let control;
        if (field.kind === 'boolean') {
          control = h('button', {
            ...common, type: 'button', role: 'switch', 'aria-checked': value, 'aria-label': t(key),
            className: 'aw-switch', onClick: () => update(key, !value),
          }, h('span', { className: 'aw-switch-knob' }));
        } else if (field.kind === 'enum') {
          // Segmented slider: one native range over the option indexes, with the
          // option names under the track. A native range keeps arrow keys, Home,
          // End and screen-reader semantics without any custom key handling.
          const index = optionIndex(field, value), current = field.values[index];
          const last = field.values.length - 1;
          control = h('div', { className: 'aw-control aw-segments', style: { '--aw-stops': String(field.values.length) } },
            h('input', {
              ...common, type: 'range', className: 'aw-slider', min: 0, max: last, step: 1, value: index,
              'aria-valuetext': t(current), style: { '--aw-pct': trackFill(last ? index / last : 0) },
              onChange: event => update(key, field.values[Number(event.target.value)] ?? current),
            }),
            h('div', { className: 'aw-ticks' }, ...field.values.map((option, position) => h('button', {
              key: option, type: 'button', disabled: off, className: 'aw-tick', tabIndex: -1,
              'aria-pressed': position === index, onClick: () => update(key, option),
            }, t(option)))));
        } else if (field.kind === 'string') {
          control = h('input', {
            ...common, className: 'aw-text', type: 'text', value, maxLength: field.max,
            onChange: event => update(key, event.target.value),
          });
        } else {
          const number = value === '' || !Number.isFinite(Number(value)) ? field.default : Number(value);
          control = h('div', { className: 'aw-control aw-number' },
            h('div', { className: 'aw-number-head' },
              h('output', { htmlFor: id, className: 'aw-readout' }, readout(field, value))),
            h('input', {
              ...common, type: 'range', className: 'aw-slider', min: field.min, max: field.max, step: field.step,
              value: number, style: { '--aw-pct': trackFill((number - field.min) / (field.max - field.min || 1)) },
              onChange: event => update(key, Number(event.target.value)),
            }),
            h('div', { className: 'aw-scale', 'aria-hidden': 'true' },
              h('span', null, readout(field, field.min)), h('span', null, readout(field, field.max))));
        }
        return h('div', { className: 'aw-row', key },
          h('div', { className: 'aw-copy' }, h('label', { htmlFor: id }, t(key)), h('p', { id: hint }, t(`${key}Hint`))), control);
      }),
      h('div', { className: 'aw-actions' },
        h('button', { type: 'submit', disabled: disabled || !dirty, className: 'aw-save' }, t(saving ? 'saving' : 'save')),
        h('button', { type: 'button', disabled, onClick: () => { setEditor(e => ({ ...e, draft: { ...DEFAULTS } })); setNotice(''); } }, t('reset')),
        h('button', { type: 'button', disabled: saving, onClick: discard }, t('discard'))),
      notice && h('p', { role: notice === 'saved' ? 'status' : 'alert', 'aria-live': 'polite' }, t(notice)));
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'ascii-whale-background', order: -100,
  }, Overlay));
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config', key: '@local/dsh-ascii-ocean',
  }, Settings));
}

const SETTINGS_CSS = `
.aw-settings{color:var(--dsw-alias-label-primary);font:inherit;max-width:760px;padding:4px 0 24px}
.aw-settings h2{font-size:18px;font-weight:600;margin:0 0 8px}
.aw-settings .aw-purpose{color:var(--dsw-alias-label-secondary);line-height:1.6;margin:0 0 20px}
.aw-settings .aw-style-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;margin:0 0 8px;background:var(--dsw-alias-bg-layer-1)}
.aw-settings .aw-style-preview canvas{display:block;width:100%;height:220px}
.aw-settings .aw-style-preview p{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0;padding:0 14px 12px}
.aw-settings .aw-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 20px;padding:14px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.aw-settings .aw-copy{min-width:0;flex:1 1 200px}
.aw-settings label{font-weight:500}
.aw-settings .aw-copy p{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);margin:5px 0 0}
.aw-settings input,.aw-settings select,.aw-settings button{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:7px 10px}
.aw-settings input[type=text]{flex:1 1 160px;width:100%;min-width:0;max-width:320px}
.aw-settings button{cursor:pointer}
.aw-settings :disabled{opacity:.5;cursor:default}
.aw-settings :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}
/* One flexible control column: it yields space first and never widens the row. */
.aw-settings .aw-control{flex:1 1 160px;min-width:160px;max-width:320px;display:flex;flex-direction:column;gap:5px}
.aw-settings .aw-switch{width:36px;height:22px;border-radius:12px;padding:2px;flex:0 0 auto}
.aw-settings .aw-switch-knob{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-secondary)}
.aw-settings .aw-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}
.aw-settings .aw-switch[aria-checked=true] .aw-switch-knob{transform:translateX(12px);background:var(--dsw-alias-bg-base)}
/* Slider track and thumb. The rail uses a translucent grey so it reads on both
   themes; the filled part takes the brand colour through --aw-pct. */
.aw-settings input[type=range]{-webkit-appearance:none;appearance:none;display:block;width:100%;min-width:0;height:22px;margin:0;padding:0;background:none;border:0;border-radius:6px;cursor:pointer;accent-color:var(--dsw-alias-brand-primary)}
.aw-settings input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:rgba(120,140,160,.35);background:linear-gradient(to right,var(--dsw-alias-brand-primary) 0 var(--aw-pct,0%),rgba(120,140,160,.35) var(--aw-pct,0%) 100%)}
.aw-settings input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;margin-top:-5px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);border:2px solid var(--dsw-alias-brand-primary);box-shadow:0 1px 2px rgba(0,0,0,.28)}
.aw-settings input[type=range]::-moz-range-track{height:6px;border-radius:999px;background:rgba(120,140,160,.35)}
.aw-settings input[type=range]::-moz-range-progress{height:6px;border-radius:999px;background:var(--dsw-alias-brand-primary)}
.aw-settings input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);border:2px solid var(--dsw-alias-brand-primary)}
.aw-settings input[type=range]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.aw-settings .aw-number-head{display:flex;align-items:baseline;justify-content:flex-end;min-height:18px}
.aw-settings .aw-readout{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.35;white-space:nowrap}
.aw-settings .aw-scale{display:flex;justify-content:space-between;gap:10px;font-size:11px;line-height:1.4;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.aw-settings .aw-scale span{white-space:nowrap}
/* Segmented slider: option names under the track double as jump buttons. */
.aw-settings .aw-ticks{display:grid;grid-template-columns:repeat(var(--aw-stops,2),minmax(0,1fr));gap:2px}
.aw-settings .aw-tick{font:inherit;font-size:11px;line-height:1.35;min-width:0;padding:3px 2px;border:0;border-radius:5px;background:none;color:var(--dsw-alias-label-secondary);text-align:center;overflow-wrap:anywhere}
.aw-settings .aw-tick[aria-pressed=true]{color:var(--dsw-alias-label-primary);font-weight:600;background:rgba(120,145,170,.16);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.aw-settings .aw-tick:disabled{cursor:default}
body[data-ds-dark-theme] .aw-settings input[type=range]::-webkit-slider-runnable-track{background:rgba(160,180,200,.32);background:linear-gradient(to right,var(--dsw-alias-brand-primary) 0 var(--aw-pct,0%),rgba(160,180,200,.32) var(--aw-pct,0%) 100%)}
body[data-ds-dark-theme] .aw-settings .aw-tick[aria-pressed=true]{background:rgba(120,160,200,.2);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,transparent)}
@media(prefers-reduced-motion:no-preference){
.aw-settings input[type=range]::-webkit-slider-thumb{transition:transform .12s ease}
.aw-settings input[type=range]:active::-webkit-slider-thumb{transform:scale(1.08)}
.aw-settings .aw-switch-knob{transition:transform .14s ease,background .14s ease}
.aw-settings .aw-tick{transition:color .12s ease,background .12s ease}
}
@media(max-width:540px){
.aw-settings .aw-row{gap:8px 12px;align-items:flex-start}
.aw-settings .aw-copy{flex:1 1 100%}
.aw-settings .aw-control,.aw-settings input[type=text]{flex:1 1 100%;max-width:none}
.aw-settings .aw-number-head{justify-content:flex-start}
.aw-settings .aw-tick{font-size:10px}
}
`;

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) { registerWhales(ctx, React, {"en":{"title":"Glyph whales","purpose":"Look straight down through the interface as a sea surface. Each species has its own head, flippers and flukes. Calm cruising alternates vertical tail strokes with glides. Raised backs are darker; flanks and deeper water are paler.","enabled":"Show whales","enabledHint":"Visible on the conversation page. Stops on other pages.","count":"Whale count","countHint":"1 to 8 whales with different sizes and depths.","text":"Whale body text","textHint":"Repeats these characters to form each whale. Spaces are ignored. Leave blank to use 探索未至之境. Up to 40 characters.","speed":"Swimming speed","speedHint":"0.3 to 2. Default 0.65. Scales cruising, turning and tail beats, with glides between strokes.","opacity":"Background opacity","opacityHint":"0.04 to 0.9. Default 0.6. Higher values make the body text clearer.","glyphSize":"Character size","glyphSizeHint":"4 to 16. Default 11. Characters occupy separate, fixed grid cells.","whaleSize":"Whale size","whaleSizeHint":"0.55 to 1.55. Default 1. Changes body length only, not swimming speed; larger whales cover more cells.","color":"Ocean palette","colorHint":"Choose the ocean palette for both glyphs and colored cells.","ocean":"Ocean","azure":"Azure","indigo":"Indigo","quietCenter":"Quieter reading area","quietCenterHint":"Fades whale bodies in the center. The bottom input area always fades out.","leftInset":"Browser left inset","leftInsetHint":"0 to 500 pixels. Default 280. Desktop follows the sidebar automatically. In a browser, adjust this to match its width.","glass":"Frosted content boxes","glassHint":"Every content card and the input box gets frosted: whales show through only as blurred shapes while the text stays crisp. On by default; use either this or input-box avoidance, not both.","glassStrength":"Glass strength","glassStrengthHint":"0 to 1. Default 0.55. Higher values make the glass thicker and blurrier, so less of the whale shows through.","composerGlass":"Frosted input box (folded into content boxes)","composerGlassHint":"The separate 0.10.0 input-box switch; since 0.11.0 it is part of the frosted content boxes. Kept only to read old configs.","composerAvoid":"Whales avoid the input box","composerAvoidHint":"Whales treat the input box as an obstacle and swim around it instead of crossing it. Use either this or the frosted content boxes, not both.","spout":"Spout when clicked","spoutHint":"Off by default. Click a whale for one short mist burst from its blowhole. Empty water, buttons, links and the input box do nothing. The burst fades and does not repeat.","reefs":"Reef rocks","reefsHint":"A few ASCII rocks stay fixed along the margins. Refresh for a new layout; settings keep them in place. Whales steer around them.","ripples":"Tail-stroke ripples","ripplesHint":"Active tail strokes send out a brief splash and spreading ripples. Gliding and submerged whales leave the surface quiet.","save":"Save","saving":"Saving…","reset":"Restore defaults","discard":"Reload saved values","loading":"Loading whale settings…","unavailable":"Whale settings are unavailable.","readOnly":"These settings are read-only.","saved":"Whale settings saved.","invalid":"Enter numbers within the listed ranges. Count, size, and inset must be whole numbers.","conflict":"Settings changed elsewhere, or the save was refused. Your edits are preserved. Reload saved values before editing again.","failed":"Could not save. Your edits are preserved and can be retried.","species":"Whale species","speciesHint":"Mixed groups cycle through blue, humpback, sperm, fin and bowhead whales. Or choose one species.","renderStyle":"Drawing style","renderStyleHint":"Glyphs draws letters only. Colored cells add shaded backgrounds inside the whale, with soft glyph-only edges.","glyphs":"Glyphs only","cells":"Colored cells","fillMode":"Fill content","fillModeHint":"Custom text keeps your original characters. ASCII selects symbols by density and shading. Either works with colored cells.","custom":"Custom text","ascii":"ASCII characters","stylePreview":"Static whale preview of the current style","stylePreviewNote":"The draft updates this preview. Save to apply it to the background. ASCII keeps your custom text so you can switch back.","mixed":"Mixed group","blue":"Blue whale","humpback":"Humpback whale","sperm":"Sperm whale","fin":"Fin whale","bowhead":"Bowhead whale"},"zh":{"title":"文字蓝鲸","purpose":"把界面看作海面，从正上方俯看文字鲸鱼。各鲸类有独立头型、胸鳍和尾叶，缓缓巡游并在上下摆尾之间滑行。背部隆起较深，两侧和深水处渐浅。","enabled":"显示蓝鲸","enabledHint":"仅在对话页面显示，切换到其他页面时停止。","count":"鲸鱼数量","countHint":"1 至 8 条，大小与远近各有不同。","text":"鱼身文字","textHint":"重复使用这些字组成鲸鱼；留空使用探索未至之境。忽略空白，最多 40 个字符。","speed":"游动速度","speedHint":"0.3 至 2，默认 0.65。巡游、转弯与摆尾同步放缓，摆尾之间有自然滑行。","opacity":"背景浓度","opacityHint":"0.04 至 0.9，默认 0.6。数值越高，鱼身文字越清楚。","glyphSize":"字符大小","glyphSizeHint":"4 至 16，默认 11。文字按固定字格排列，不互相叠压。","whaleSize":"鲸鱼大小","whaleSizeHint":"0.55 至 1.55，默认 1。只改鲸体长度，不改游速与摆尾节奏；鲸体越大，占用的字格越多。","color":"海洋色调","colorHint":"选择字符与彩色字格使用的海洋色调。","ocean":"深海蓝","azure":"晴空蓝","indigo":"靛蓝","quietCenter":"减淡阅读区域","quietCenterHint":"降低中央鲸体的浓度。底部输入区始终保持淡出。","leftInset":"浏览器左侧留白","leftInsetHint":"0 至 500 像素，默认 280。桌面版自动跟随左侧栏；浏览器版按侧栏宽度手动调整。","glass":"内容框毛玻璃","glassHint":"对话里的每个内容卡片和输入框都盖一块磨砂玻璃：框内鲸鱼只以模糊形态透出，文字保持清晰。默认开启；与「鱼群避让输入框」二选一。","glassStrength":"玻璃强度","glassStrengthHint":"0 至 1，默认 0.55。数值越大玻璃更厚、磨砂更重，透出的鲸影也更淡。","composerGlass":"输入框毛玻璃（已并入内容框毛玻璃）","composerGlassHint":"0.10.0 的独立输入框开关；0.11.0 起并入「内容框毛玻璃」，此字段仅用于兼容旧配置。","composerAvoid":"鱼群避让输入框","composerAvoidHint":"鲸鱼把输入框当作障碍物绕开，不再从框内穿过。与「内容框毛玻璃」二选一。","spout":"点击喷水","spoutHint":"默认关闭。点在鲸鱼身上，从喷气孔放出一小团雾；点在空海、按钮、链接或输入框上没有反应。雾会散掉，不会连成喷泉。","reefs":"海面礁石","reefsHint":"少量 ASCII 礁石随机分布在两侧，刷新后重新生成，游动和修改设置不会挪动；鲸鱼会绕开。","ripples":"尾拍涟漪","ripplesHint":"鲸鱼用力摆尾时溅起碎水和逐渐扩散的波纹；滑行或潜入水下时不生成。","save":"保存","saving":"保存中…","reset":"恢复默认值","discard":"重新载入已保存值","loading":"正在读取蓝鲸设置…","unavailable":"蓝鲸设置暂不可用。","readOnly":"当前设置为只读。","saved":"蓝鲸设置已保存。","invalid":"请在标出的范围内填写数字，数量、大小和留白须为整数。","conflict":"设置已在别处更新，或本次保存未获接受。你的修改已保留。重新载入已保存值后再修改。","failed":"未能保存。你的修改已保留，可以重试。","species":"鲸鱼种类","speciesHint":"混合鲸群依次包含蓝鲸、座头鲸、抹香鲸、长须鲸和弓头鲸；也可只显示一种。","renderStyle":"渲染样式","renderStyleHint":"纯字符只绘文字；彩色字格为鲸体内部铺设深浅底色，轮廓边缘保留柔和字符。","glyphs":"纯字符","cells":"彩色字格","fillMode":"填充内容","fillModeHint":"自定义文字按原文填充；ASCII 按明暗选择疏密不同的符号。两种内容均可搭配彩色字格。","custom":"自定义文字","ascii":"ASCII 字符","stylePreview":"当前样式的鲸鱼静态预览","stylePreviewNote":"预览随草稿更新；点击保存后应用到背景。ASCII 模式会保留你的自定义文字，切回即可使用。","mixed":"混合鲸群","blue":"蓝鲸","humpback":"座头鲸","sperm":"抹香鲸","fin":"长须鲸","bowhead":"弓头鲸"}}); },
    };
  },
});
