import { createInkPalette, glyphInkIndex } from './shading.js';

// Voice sea: the surface answers a voice. Every swell is a broken ring front
// pushed outward from the composer rectangle; loudness decides how many rings
// arrive, how far they reach and how bright their sheen is. Everything here is
// pure geometry and integer hashes, so tests can drive it frame by frame with
// no canvas, no clock and no Math.random.

const VOICE_SEA_TAU = Math.PI * 2;
// A voice is a live level: open the swell quickly, let it settle slowly.
export const VOICE_SEA_ATTACK_SECONDS = 0.08;
export const VOICE_SEA_RELEASE_SECONDS = 0.4;
export const VOICE_SEA_MAX_RINGS = 6;
export const VOICE_SEA_MAX_GLYPHS = 180;
// Below this smoothed level the composer is not pushing water; existing rings
// keep fading but no new front is born.
const VOICE_SEA_LEVEL_FLOOR = 0.05;
const VOICE_SEA_SPAWN_BASE = 1.4;
const VOICE_SEA_SPAWN_GAIN = 7.2;
const VOICE_SEA_MIN_LIFE = 0.8;
const VOICE_SEA_MAX_LIFE = 1.6;
// The swell may not cover the whole screen: cap it against the smaller canvas
// edge, with a floor so a small viewport still gets a readable wave.
const VOICE_SEA_RADIUS_FRACTION = 0.55;
const VOICE_SEA_RADIUS_FLOOR = 24;
const VOICE_SEA_MIN_RING_RADIUS = 12;
const VOICE_SEA_MAX_GLYPHS_PER_RING = 32;
// The surface is the shallowest ink row: the voice stays a bright sheen instead
// of growing into a second, whale-coloured body.
const VOICE_SEA_DEPTH = 0.16;
// A closed circle would read as a bubble outline on the glyph grid; three
// separate arcs with irregular ends keep the same quiet hand-drawn character
// as the rest of the sea.
const VOICE_SEA_ARCS = 3;
const VOICE_SEA_ASPECT_BASE = 0.68;
const VOICE_SEA_ASPECT_RANGE = 0.22;
const VOICE_SEA_RISE_MIN = 2;
const VOICE_SEA_RISE_RANGE = 8;
const VOICE_SEA_PRESENCE_EXPONENT = 0.7;
const VOICE_SEA_GLYPH_QUIET = ['·', '˙', "'"];
const VOICE_SEA_GLYPH_BREAK = ';';

const voiceSeaFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const voiceSeaClamp = (value, low, high) => value < low ? low : value > high ? high : value;

/** Integer hash in [0, 1): deterministic per ring, arc and sample. */
function voiceSeaHash(a, b, salt = 0) {
  let hash = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
    ^ Math.imul(salt | 0, 1442695041);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

// Spawn bookkeeping is private: the field keeps the documented public shape,
// while the credit/serial lives beside it so a clone still restarts cleanly.
const voiceSeaStates = new WeakMap();
function voiceSeaState(field) {
  let state = voiceSeaStates.get(field);
  if (!state) {
    state = { credit: 0, serial: 0, anchored: false };
    voiceSeaStates.set(field, state);
  }
  return state;
}

function voiceSeaRadiusLimit(width, height) {
  const span = Math.min(width, height);
  if (!(span > 0)) return 0;
  return Math.max(VOICE_SEA_RADIUS_FLOOR, span * VOICE_SEA_RADIUS_FRACTION);
}

/** Live noise-driven swell history in CSS pixels and simulated seconds. */
export function createVoiceSeaField() {
  const field = {
    rings: [],
    level: 0,
    smoothed: 0,
    time: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  voiceSeaStates.set(field, { credit: 0, serial: 0, anchored: false });
  return field;
}

/** Drop every ring and the envelope; the next voice starts from silence. */
export function resetVoiceSeaField(field) {
  if (!field || typeof field !== 'object') return field;
  field.rings = [];
  field.level = 0;
  field.smoothed = 0;
  field.time = 0;
  field.x = 0;
  field.y = 0;
  field.width = 0;
  field.height = 0;
  voiceSeaStates.set(field, { credit: 0, serial: 0, anchored: false });
  return field;
}

/**
 * Grow one broken front from the composer anchor.
 *
 * The seed is drawn from the ring serial and the active clock, so the same
 * input timeline always produces the same rings while consecutive rings never
 * share a shape. Loudness at birth sets strength, terminal radius and life.
 */
function voiceSeaSpawn(field, state, strength) {
  const limit = voiceSeaRadiusLimit(field.width, field.height);
  // A canvas smaller than the radius floor cannot host a ring: skip the spawn
  // instead of culling the same ring again on the next step.
  if (!(limit > 0) || limit > Math.max(field.width, field.height) * 1.1) return false;
  const seed = voiceSeaHash(state.serial + 1, Math.round(field.time * 1000), 17);
  const shape = 0.55 * seed + 0.45 * strength;
  field.rings.push({
    x: field.x,
    y: field.y,
    age: 0,
    life: VOICE_SEA_MIN_LIFE + (VOICE_SEA_MAX_LIFE - VOICE_SEA_MIN_LIFE) * shape,
    startRadius: 3 + seed * 5,
    maxRadius: Math.min(limit,
      Math.max(VOICE_SEA_MIN_RING_RADIUS, limit * (0.52 + 0.48 * strength))),
    strength,
    seed,
    serial: state.serial,
    phase: seed * VOICE_SEA_TAU,
    rise: VOICE_SEA_RISE_MIN + VOICE_SEA_RISE_RANGE * (0.4 * seed + 0.6 * strength),
  });
  state.serial++;
  return true;
}

/**
 * Advance the swell by `delta` simulated seconds.
 *
 * `level` is the raw RMS value from the dictation service (unclamped 0..1);
 * `options` carries the composer centre in canvas CSS px plus the canvas size.
 * A zero or invalid delta is a true no-op, so a paused clock never advances the
 * field. `enabled: false` stops emission and lets rings and the envelope drain
 * naturally instead of freezing them mid-swell. While enabled and above the
 * floor, fronts are born at a loudness-driven rate, capped at
 * {@link VOICE_SEA_MAX_RINGS} live rings.
 */
export function stepVoiceSea(field, delta, level, options = {}) {
  if (!field || typeof field !== 'object') return field;
  const dt = voiceSeaFinite(delta, 0);
  if (!(dt > 0)) return field;
  const settings = options && typeof options === 'object' ? options : {};
  const state = voiceSeaState(field);
  if (!Array.isArray(field.rings)) field.rings = [];
  const rings = field.rings;
  const enabled = settings.enabled !== false;
  // Infinity is a loud voice, not an invalid one: clamp it like any other
  // over-range metre, and only NaN/non-numbers fall back to silence.
  const live = typeof level === 'number' && !Number.isNaN(level) ? level : 0;
  // The provider returns raw PCM RMS, not a display meter. Expand quiet input
  // before the visual floor; zero stays silent and the loud end remains bounded.
  const target = enabled ? Math.sqrt(voiceSeaClamp(live, 0, 1)) : 0;
  const current = voiceSeaClamp(voiceSeaFinite(field.smoothed, 0), 0, 1);
  // Linear slew: 80ms to the live value, 400ms back to silence. The time-based
  // step is exact for any frame split, and a longer step simply lands on the
  // target instead of overshooting.
  const next = target > current
    ? Math.min(target, current + dt / VOICE_SEA_ATTACK_SECONDS)
    : Math.max(target, current - dt / VOICE_SEA_RELEASE_SECONDS);
  const resting = !enabled && next === 0 && current === 0 && rings.length === 0
    && voiceSeaFinite(field.level, 0) === 0;
  // A switched-off field at rest is byte-identical across frames: the engine may
  // keep calling with enabled:false and nothing is advanced or allocated.
  if (resting) return field;

  field.smoothed = next;
  field.level = target;
  if (enabled) field.time = voiceSeaFinite(field.time, 0) + dt;

  const width = voiceSeaFinite(settings.width, field.width);
  const height = voiceSeaFinite(settings.height, field.height);
  if (width > 0) field.width = width;
  if (height > 0) field.height = height;
  // The simulation hands in 0/0 while no composer rect has been measured yet. A
  // real composer centre always sits inside the canvas with non-zero width, so
  // the origin acts as "not anchored": hold the swell until a measured rect
  // arrives instead of growing rings out of the top-left corner.
  if (enabled && Number.isFinite(settings.x) && Number.isFinite(settings.y)
    && (settings.x !== 0 || settings.y !== 0)) {
    field.x = settings.x;
    field.y = settings.y;
    state.anchored = true;
  }

  // Age first, then prune: a single step long enough to outlive a ring must
  // retire it in this same call.
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (ring && typeof ring === 'object') ring.age = Math.max(0, voiceSeaFinite(ring.age, 0) + dt);
  }
  const limit = voiceSeaRadiusLimit(field.width, field.height);
  const hardCeiling = Math.max(field.width, field.height) * 1.1;
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    let dead = !ring || typeof ring !== 'object';
    if (!dead) {
      const x = voiceSeaFinite(ring.x, NaN), y = voiceSeaFinite(ring.y, NaN);
      const age = voiceSeaFinite(ring.age, NaN), life = voiceSeaFinite(ring.life, NaN);
      const radius = voiceSeaFinite(ring.maxRadius, NaN);
      // Rings without a usable centre or clock are worse than no ring at all:
      // drop them rather than let NaN positions reach the glyph grid.
      dead = !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(age)
        || !Number.isFinite(life) || !(life > 0)
        || !Number.isFinite(radius) || !(radius > 0) || age >= life;
      if (!dead && field.width > 0 && field.height > 0) {
        if (x < 0 || x > field.width || y < 0 || y > field.height) dead = true;
        else if (radius > hardCeiling) dead = true;
      }
      if (!dead) {
        ring.x = x;
        ring.y = y;
        ring.age = age;
        ring.life = life;
        // A resize may shrink the canvas under a live ring: clamp the reach
        // instead of popping the ring mid-flight; the hard ceiling still culls.
        ring.maxRadius = limit > 0 && radius > limit ? limit : radius;
        ring.startRadius = Math.max(1, voiceSeaFinite(ring.startRadius, 3));
        ring.strength = voiceSeaClamp(voiceSeaFinite(ring.strength, 0.3), 0, 1);
        ring.seed = voiceSeaClamp(voiceSeaFinite(ring.seed, 0.5), 0, 1);
        ring.phase = voiceSeaFinite(ring.phase, ring.seed * VOICE_SEA_TAU);
        ring.rise = voiceSeaClamp(voiceSeaFinite(ring.rise, 4), 0, 32);
        ring.serial = Math.floor(voiceSeaFinite(ring.serial, 0));
      }
    }
    if (dead) rings.splice(i, 1);
  }

  if (enabled && state.anchored && next > VOICE_SEA_LEVEL_FLOOR
    && field.width > 0 && field.height > 0) {
    // Integrate the rate over the frame instead of rolling per frame: a varying
    // frame time cannot change the number of rings a level earns.
    const rate = VOICE_SEA_SPAWN_BASE + VOICE_SEA_SPAWN_GAIN * next;
    state.credit = Math.min(VOICE_SEA_MAX_RINGS, state.credit + rate * dt);
    let spawns = Math.min(VOICE_SEA_MAX_RINGS, Math.floor(state.credit));
    state.credit -= spawns;
    while (spawns-- > 0 && rings.length < VOICE_SEA_MAX_RINGS) {
      if (!voiceSeaSpawn(field, state, next)) break;
    }
  }
  return field;
}

/**
 * Paint the live swell fronts into an ASCII cell grid.
 *
 * The target is only a pseudo 2D context: `font`, `fillStyle`,
 * `globalAlpha`, `textAlign`, `textBaseline` and `fillText` are the whole
 * contract, because the engine hands in a glyph painter rather than a real
 * canvas context. Every ring is three irregular arcs sampled at the cell
 * spacing, deduped per ring, snapped to the cell centre and clipped by the same
 * pane fade as the rest of the sea.
 *
 * @returns {number} glyphs drawn, bounded by {@link VOICE_SEA_MAX_GLYPHS}.
 */
export function drawVoiceSea(target, field, options = {}) {
  if (!target || typeof target.fillText !== 'function') return 0;
  const rings = field && Array.isArray(field.rings) ? field.rings : [];
  if (!rings.length) return 0;
  const settings = options && typeof options === 'object' ? options : {};
  const width = voiceSeaFinite(settings.width, 0);
  const height = voiceSeaFinite(settings.height, 0);
  const cellWidth = Math.max(1, voiceSeaFinite(settings.cellWidth, 11));
  const cellHeight = Math.max(1, voiceSeaFinite(settings.cellHeight, 13));
  const ratio = Math.max(0.01, voiceSeaFinite(settings.ratio, 1));
  const opacity = voiceSeaClamp(voiceSeaFinite(settings.opacity, 0.5), 0, 1);
  if (!(width > 0) || !(height > 0) || !(opacity > 0)) return 0;
  // The swell is part of the voice: once the envelope settles, the painted sea
  // is calm even if a last ring is still finishing its fade.
  const presence = Math.pow(voiceSeaClamp(voiceSeaFinite(field.smoothed, 1), 0, 1),
    VOICE_SEA_PRESENCE_EXPONENT);
  if (!(presence > 0)) return 0;
  const budget = Math.max(0, Math.min(VOICE_SEA_MAX_GLYPHS,
    Math.floor(voiceSeaFinite(settings.maxGlyphs, VOICE_SEA_MAX_GLYPHS))));
  if (!(budget > 0)) return 0;
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
  // One dedupe set per frame, reused (cleared) for every ring.
  const seen = new Set();

  // Snap one sample to its cell centre, dedupe within this ring, then write it.
  const paintPoint = (x, y, glyph, alpha, light) => {
    if (!(alpha > 0)) return false;
    const col = Math.floor(x / cellWidth), row = Math.floor(y / cellHeight);
    if (col < 0 || col >= columns || row < 0 || row >= rows) return false;
    const key = row * columns + col;
    if (seen.has(key)) return false;
    seen.add(key);
    const centreX = snap((col + 0.5) * cellWidth);
    const centreY = snap((row + 0.5) * cellHeight);
    let visibility = 1;
    if (fade) {
      visibility = voiceSeaClamp(voiceSeaFinite(fade(centreX, centreY), 0), 0, 1);
      if (!(visibility > 0)) return false;
    }
    const value = Math.min(opacity, alpha * visibility);
    if (!(value > 0.01)) return false;
    const shade = glyphInkIndex(light, VOICE_SEA_DEPTH);
    const fill = palette[shade < palette.length ? shade : palette.length - 1];
    if (fill !== currentFill) {
      target.fillStyle = fill;
      currentFill = fill;
    }
    target.globalAlpha = value;
    target.fillText(glyph, centreX, centreY, Math.max(1, cellWidth * 1.1));
    drawn++;
    return true;
  };

  for (let r = 0; r < rings.length && drawn < budget; r++) {
    const ring = rings[r];
    if (!ring || typeof ring !== 'object') continue;
    const x = voiceSeaFinite(ring.x, NaN), y = voiceSeaFinite(ring.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const life = Math.max(0.001, voiceSeaFinite(ring.life, 1));
    const age = voiceSeaClamp(voiceSeaFinite(ring.age, 0), 0, life);
    const progress = age / life;
    const ageFade = (1 - progress) ** 1.35;
    const birth = Math.min(1, age / 0.04);
    if (!(ageFade > 0) || !(birth > 0)) continue;
    const strength = voiceSeaClamp(voiceSeaFinite(ring.strength, 0.3), 0, 1);
    const seed = voiceSeaClamp(voiceSeaFinite(ring.seed, 0.5), 0, 1);
    const serial = Math.floor(voiceSeaFinite(ring.serial, 0));
    const endRadius = Math.max(1, voiceSeaFinite(ring.maxRadius, 1));
    const startRadius = Math.min(endRadius, Math.max(1, voiceSeaFinite(ring.startRadius, 3)));
    const radius = startRadius + (endRadius - startRadius) * (1 - (1 - progress) ** 1.7);
    if (!(radius > 1)) continue;
    const phase = voiceSeaFinite(ring.phase, seed * VOICE_SEA_TAU);
    const rise = voiceSeaClamp(voiceSeaFinite(ring.rise, 4), 0, 32);
    // Drift the whole front slightly upward as it ages: a voice pressing on the
    // surface lifts the rings it leaves behind.
    const drift = rise * progress;
    const aspect = VOICE_SEA_ASPECT_BASE + VOICE_SEA_ASPECT_RANGE * seed;
    // The front is brightest at birth and thins while it expands, so it dissolves
    // into the sea instead of popping out at its widest.
    const alpha = opacity * (0.30 + 0.44 * strength) * ageFade * birth * presence;
    if (!(alpha > 0.01)) continue;
    const light = voiceSeaClamp(0.5 + 0.16 * strength - 0.14 * progress, 0, 1);
    const spacing = Math.max(5, (cellWidth + cellHeight) * 0.42);
    seen.clear();
    let ringDrawn = 0;
    for (let arc = 0; arc < VOICE_SEA_ARCS && drawn < budget
      && ringDrawn < VOICE_SEA_MAX_GLYPHS_PER_RING; arc++) {
      const arcSeed = voiceSeaHash(serial, arc + 1, 3);
      const span = (VOICE_SEA_TAU / VOICE_SEA_ARCS) * (0.5 + 0.35 * arcSeed);
      const startAngle = phase + arc * (VOICE_SEA_TAU / VOICE_SEA_ARCS)
        + (arcSeed - 0.5) * 0.5;
      const samples = Math.max(2, Math.min(12,
        Math.ceil(radius * span / spacing)));
      for (let i = 0; i < samples; i++) {
        if (drawn >= budget || ringDrawn >= VOICE_SEA_MAX_GLYPHS_PER_RING) break;
        const angle = startAngle + span * (i + 0.5) / samples
          + (voiceSeaHash(i, arc + 5, serial) - 0.5) * 0.06;
        const wobble = (voiceSeaHash(i, arc + 9, serial) - 0.5)
          * Math.min(cellWidth, radius * 0.12);
        const pointRadius = radius + wobble;
        const px = x + Math.cos(angle) * pointRadius;
        const py = y + Math.sin(angle) * pointRadius * aspect - drift;
        // On the top and bottom of a squashed ring the front runs horizontally,
        // so a tilde belongs there; everywhere else the quiet dots keep it calm.
        const tangentX = -Math.sin(angle), tangentY = Math.cos(angle) * aspect;
        const horizontal = Math.abs(tangentX) / Math.hypot(tangentX, tangentY) > 0.86;
        const pick = voiceSeaHash(i, arc + 13, serial);
        const glyph = horizontal
          ? (pick < 0.82 ? '~' : VOICE_SEA_GLYPH_QUIET[0])
          : strength > 0.62 && pick > 0.88
            ? VOICE_SEA_GLYPH_BREAK
            : pick < 0.55 ? VOICE_SEA_GLYPH_QUIET[0]
              : pick < 0.84 ? VOICE_SEA_GLYPH_QUIET[1] : VOICE_SEA_GLYPH_QUIET[2];
        const pointLight = voiceSeaClamp(light
          + (voiceSeaHash(i, arc + 17, serial) - 0.5) * 0.08, 0, 1);
        if (paintPoint(px, py, glyph, alpha, pointLight)) ringDrawn++;
      }
    }
  }
  target.globalAlpha = 1;
  return drawn;
}
