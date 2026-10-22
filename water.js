import { createInkPalette, glyphInkIndex } from './shading.js';

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
  const length = Math.max(0, waterFinite(whale.length, 0));
  const heading = waterFinite(whale.heading, 0);
  return {
    x: waterFinite(whale.x, 0) - Math.cos(heading) * length * WATER_TAIL_FACTOR,
    y: waterFinite(whale.y, 0) - Math.sin(heading) * length * WATER_TAIL_FACTOR,
  };
}

function waterSpawnRipple(ripples, whale, stroke, index, beat) {
  const bodyRadius = Math.max(1, waterFinite(whale.bodyRadius, 10));
  const tail = waterTailPoint(whale);
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
}

/** Current ring radius: fast at the slap, slow as the ring spends its energy. */
export function waterRippleRadius(ripple) {
  const life = Math.max(0.001, waterFinite(ripple && ripple.life, WATER_MIN_LIFE));
  const age = waterClamp(waterFinite(ripple && ripple.age, 0), 0, life);
  const start = Math.max(0, waterFinite(ripple && ripple.startRadius, WATER_MIN_START_RADIUS));
  const end = Math.max(start, waterFinite(ripple && ripple.endRadius, start));
  const progress = age / life;
  return start + (end - start) * (1 - (1 - progress) ** 1.8);
}

/** A new, empty surface: live rings plus each whale's last observed beat. */
export function createWaterField() {
  return { ripples: [], beats: new Map() };
}

/** Clear both the rings and the beat memory; the next beat starts afresh. */
export function resetWaterField(field) {
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
export function stepWater(field, scene, delta, options = {}) {
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
    const previous = beats.get(key);
    if (!previous) {
      // First sighting: remember the beat, never splash for a phase we never saw.
      beats.set(key, { beat, age: 0 });
      continue;
    }
    previous.age = waterFinite(previous.age, 0) + step;
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
    if (stroke < WATER_ACTIVE_STROKE || ripples.length >= maxRipples) continue;
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
export function drawWater(target, field, options = {}) {
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
        const tangent = angle + Math.PI / 2;
        const horizontal = Math.abs(Math.cos(tangent)) > 0.82;
        const glyph = ring === 0
          ? (horizontal ? (pick < 0.75 ? '~' : '·') : (pick < 0.72 ? '·' : pick < 0.9 ? '˙' : "'"))
          : (pick < 0.7 ? '·' : '˙');
        paintPoint(x + Math.cos(angle) * pointRadius, y + Math.sin(angle) * pointRadius,
          glyph, ring === 0 ? outerAlpha : outerAlpha * 0.5, pointLight, seen);
      }
    }

    // The first third of a second is the splash: a few drops thrown outward
    // from the tail, then gone. This is what keeps the slap from looking like a
    // ring that merely faded in.
    if (age < WATER_SPLASH_SECONDS) {
      const splashFade = 1 - age / WATER_SPLASH_SECONDS;
      const drops = 3 + Math.floor(seed * 2);
      const startRadius = Math.max(WATER_MIN_START_RADIUS,
        waterFinite(ripple.startRadius, WATER_MIN_START_RADIUS));
      for (let s = 0; s < drops; s++) {
        const angle = seed * Math.PI * 2 + s / drops * Math.PI * 2
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
