import { WHALE_SPECIES, SPECIES_IDS, whaleSpecies } from './species.js';
import { DIVE_WATERLINE, resizeScene } from './motion.js';
import { deformWhaleParticle } from './rig.js';
import { surfaceInkTone } from './shading.js';
export { resizeScene, stepScene, whalePose } from './motion.js';

export const FIELDS = Object.freeze({
  enabled: { kind: 'boolean', default: true },
  resourceMode: { kind: 'enum', values: ['standard', 'economy'], default: 'standard' },
  count: { kind: 'number', min: 1, max: 8, step: 1, default: 3 },
  species: { kind: 'enum', values: ['mixed', ...SPECIES_IDS], default: 'mixed' },
  renderStyle: { kind: 'enum', values: ['glyphs', 'cells'], default: 'glyphs' },
  fillMode: { kind: 'enum', values: ['custom', 'ascii'], default: 'custom' },
  text: { kind: 'string', max: 40, default: '探索未至之境' },
  speed: { kind: 'number', min: 0.3, max: 2, step: 0.05, default: 0.65 },
  opacity: { kind: 'number', min: 0.04, max: 0.9, step: 0.01, default: 0.6 },
  glyphSize: { kind: 'number', min: 4, max: 16, step: 1, default: 11 },
  whaleSize: { kind: 'number', min: 0.55, max: 1.55, step: 0.05, default: 1 },
  color: { kind: 'enum', values: ['ocean', 'azure', 'indigo', 'rainbow'], default: 'ocean' },
  activity: { kind: 'boolean', default: true },
  quietCenter: { kind: 'boolean', default: true },
  leftInset: { kind: 'number', min: 0, max: 500, step: 1, default: 280 },
  readingEffect: { kind: 'enum', values: ['none', 'glow', 'blur', 'frost'], default: 'frost' },
  glass: { kind: 'boolean', default: true },
  glassStrength: { kind: 'number', min: 0, max: 1, step: 0.05, default: 0.55 },
  // Folded into `glass` in 0.11.0: every content box, the composer included, is
  // frosted by the same option. Kept as a hidden field so old profile entries
  // still validate, and so a 0.10.0 config that only enabled the composer is
  // migrated below instead of silently losing its effect.
  composerGlass: { kind: 'boolean', default: false, hidden: true },
  composerAvoid: { kind: 'boolean', default: false },
  spout: { kind: 'boolean', default: true },
  ripples: { kind: 'boolean', default: true },
  wind: { kind: 'boolean', default: true },
  clouds: { kind: 'boolean', default: true },
  rain: { kind: 'boolean', default: false },
  rainIntensity: { kind: 'number', min: 0, max: 1, step: 0.01, default: 0.45 },
  // Opt-in reading guard, off by default. When on, a scroll burst hides the
  // decorative layer and freezes the school until the page goes quiet, so the
  // soft text mask can never trail behind moving text. When off the whales keep
  // swimming and the mask refreshes on the ordinary 120ms measure budget.
  pauseOnScroll: { kind: 'boolean', default: false },
});
export const DEFAULTS = Object.freeze(Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.default])));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const fract = n => n - Math.floor(n);
const noise = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

export function normalizeConfig(value = {}) {
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
export function configSignature(value) {
  return JSON.stringify(normalizeConfig(value));
}

export function glyphSequence(text = DEFAULTS.text) {
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

function whaleColorOrder(seed) {
  const colors = Array.from({ length: 8 }, (_, index) => index);
  let state = seed;
  for (let i = colors.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(state / 0x100000000 * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return colors;
}

/**
 * Build a full school at a virtual 1600x900 stage.
 *
 * `whaleSize` only scales the bodies. The particle budget follows its square so
 * a bigger whale keeps the same glyph density instead of turning sparse, and
 * the default 1 reproduces the 0.8.0 budget exactly (`count * 2200`, capped at
 * 8000), so existing pictures are untouched.
 */
export function createScene(count, text = DEFAULTS.text, species = DEFAULTS.species, whaleSize = DEFAULTS.whaleSize, colorSeed = 0) {
  const alphabet = glyphSequence(text);
  count = clamp(Math.round(count), 1, 8);
  colorSeed = typeof colorSeed === 'number' && Number.isFinite(colorSeed) ? colorSeed >>> 0 : 0;
  // Shuffle all eight slots independently of count, text, size and species.
  // Reusing this seed on reconstruction keeps every surviving whale's hue.
  const colorOrder = whaleColorOrder(colorSeed);
  const size = clamp(typeof whaleSize === 'number' && Number.isFinite(whaleSize) ? whaleSize : DEFAULTS.whaleSize,
    FIELDS.whaleSize.min, FIELDS.whaleSize.max);
  const total = Math.min(8000, Math.round(count * 2200 * Math.max(0.36, size * size)));
  // Give every whale its own plane, including schools larger than five.
  // A separate shuffle leaves the existing color assignments untouched.
  const depthOrder = Array.from({ length: count }, (_, index) => index);
  let depthSeed = (colorSeed ^ 0x6a09e667) >>> 0;
  for (let i = count - 1; i > 0; i--) {
    depthSeed = (Math.imul(depthSeed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(depthSeed / 0x100000000 * (i + 1));
    [depthOrder[i], depthOrder[j]] = [depthOrder[j], depthOrder[i]];
  }
  const whales = Array.from({ length: count }, (_, id) => ({
    id, colorIndex: colorOrder[id], species: species === 'mixed' || !WHALE_SPECIES[species] ? SPECIES_IDS[id % SPECIES_IDS.length] : species,
    depth: count === 1 ? 0.16 : 0.16 + 0.89 * depthOrder[id] / (count - 1), phase: noise(id + 80) * Math.PI * 2,
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
  const scene = { whales, particles, triangles: new Uint16Array(triangles), decals, time: 0, accumulator: 0, width: 0, height: 0, whaleSize: size, colorSeed };
  resizeScene(scene, 1600, 900);
  return scene;
}

export function transformParticle(p, pose, out = {}) {
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

export function projectParticle(p, pose, out = {}) {
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

export function createDepthGrid(width, height, glyphSize, metrics = {}) {
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

export function resolveDepthGrid(projected, grid, triangles, decals = []) {
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

function rasterShiftedTriangles(projected, grid, triangles, particles, whaleId, ox, oy, touched) {
  for (let triangle = 0; triangle < triangles.length; triangle += 3) {
    const ia = triangles[triangle], ib = triangles[triangle + 1], ic = triangles[triangle + 2];
    if (particles[ia].whale !== whaleId) continue;
    const a = projected[ia], b = projected[ib], c = projected[ic];
    if (!a || !b || !c || Math.max(a.visibility, b.visibility, c.visibility) < 0.05) continue;
    const ax = a.x + ox, ay = a.y + oy, bx = b.x + ox, by = b.y + oy, cx = c.x + ox, cy = c.y + oy;
    const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denominator) < 0.0001) continue;
    const left = Math.max(0, Math.floor(Math.min(ax, bx, cx) / grid.cellWidth));
    const right = Math.min(grid.columns - 1, Math.floor(Math.max(ax, bx, cx) / grid.cellWidth));
    const top = Math.max(0, Math.floor(Math.min(ay, by, cy) / grid.cellHeight));
    const bottom = Math.min(grid.rows - 1, Math.floor(Math.max(ay, by, cy) / grid.cellHeight));
    if (left > right || top > bottom) continue;
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      const cell = row * grid.columns + col;
      let wrote = false;
      for (let sample = 0; sample < 5; sample++) {
        const x = (col + CELL_SAMPLES[sample * 2]) * grid.cellWidth;
        const y = (row + CELL_SAMPLES[sample * 2 + 1]) * grid.cellHeight;
        const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
        const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
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
        wrote = true;
      }
      if (wrote) touched.add(cell);
    }
  }
}

function repaintWrappedCells(grid, touched) {
  for (const cell of touched) {
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

function stampWrappedPoint(projected, grid, index, ox, oy) {
  const p = projected[index];
  if (!p || p.visibility < 0.05) return;
  const x = p.x + ox, y = p.y + oy;
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;
  const cell = Math.floor(y / grid.cellHeight) * grid.columns + Math.floor(x / grid.cellWidth);
  if (p.z > grid.depths[cell] + 0.75) return;
  grid.owners[cell] = index; grid.depths[cell] = p.z; grid.lights[cell] = p.light ?? 0.75;
  grid.coverage[cell] = 1; grid.visibility[cell] = p.visibility;
}

/**
 * Draw the part of a body that has crossed an edge on the opposite edge.
 * The centre stays in range; only the overhang is stamped, so a whale swims
 * off the top and the same stroke comes back in from the bottom.
 */
export function stampSeaWraps(scene, projected, grid) {
  const width = grid?.width, height = grid?.height;
  const triangles = scene?.triangles, particles = scene?.particles;
  if (!(width > 0) || !(height > 0) || !triangles?.length || !particles?.length) return;
  const touched = new Set();
  const shifts = [];
  for (const whale of scene.whales || []) {
    const reach = Math.max(48, motionFiniteLength(whale) * 0.9);
    const xShifts = whale.x - reach < 0 ? [width] : whale.x + reach > width ? [-width] : [];
    const yShifts = whale.y - reach < 0 ? [height] : whale.y + reach > height ? [-height] : [];
    for (const ox of xShifts) shifts.push([whale.id, ox, 0]);
    for (const oy of yShifts) shifts.push([whale.id, 0, oy]);
    for (const ox of xShifts) for (const oy of yShifts) shifts.push([whale.id, ox, oy]);
  }
  if (!shifts.length) return;
  for (const [whaleId, ox, oy] of shifts) {
    rasterShiftedTriangles(projected, grid, triangles, particles, whaleId, ox, oy, touched);
  }
  repaintWrappedCells(grid, touched);
  const decals = scene.decals || [];
  for (const index of decals) {
    const whaleId = particles[index]?.whale;
    for (const [id, ox, oy] of shifts) {
      if (id !== whaleId) continue;
      stampWrappedPoint(projected, grid, index, ox, oy);
    }
  }
}

function motionFiniteLength(whale) {
  const length = whale && whale.length;
  return typeof length === 'number' && Number.isFinite(length) ? length : 0;
}

export function glyphOpacity(opacity, light, visibility, fade) {
  return clamp(opacity * (0.9 + 0.1 * light) * visibility * fade, 0, 1);
}

export function fitCanvas(width, height, dpr) {
  const ratio = Math.min(2, Math.max(0.1, dpr || 1), Math.sqrt(12000000 / Math.max(1, width * height)));
  return { ratio, width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) };
}

// One edge of the historical bottom fade: full until 14% in, gone by 4% in.
function edgeAttenuation(distance, span) {
  const outer = span * 0.14;
  const feather = Math.max(1, span * 0.10);
  return 1 - smooth((outer - distance) / feather);
}

export function attenuation(x, y, width, height, quietCenter) {
  // Top and bottom keep the original band. Left and right use the same thickness
  // (the shorter screen side), so a wide window does not grow a huge side vignette
  // and a whale leaving any edge fades out the same way.
  const side = Math.min(width, height);
  const vertical = edgeAttenuation(y, height) * edgeAttenuation(height - y, height);
  const horizontal = edgeAttenuation(x, side) * edgeAttenuation(width - x, side);
  const central = quietCenter ? 1 - 0.25 * Math.exp(-(((x / width - 0.5) / 0.29) ** 2)) * smooth(y / height / 0.18) : 1;
  return clamp(vertical * horizontal * central, 0, 1);
}
