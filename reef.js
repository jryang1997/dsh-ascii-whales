// Reef islands for the sea surface. The layout is seeded once per page load and
// then never re-rolled: a resize only rescales the same rocks, so the background
// does not pop when the window changes.
//
// build.mjs concatenates the renderer modules into one factory, so no top-level
// name may collide with model.js (which owns `clamp`, `smooth`, `noise` and the
// other short helpers). Every helper here carries a `reef` prefix.

import { createInkPalette, glyphInkIndex } from './shading.js';

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
export function createReefField({ width, height, seed, count = REEF_DEFAULT_COUNT } = {}) {
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
export function resizeReefField(field, width, height) {
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
export function reefObstacles(field) {
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
export function drawReefs(target, field, options = {}) {
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
