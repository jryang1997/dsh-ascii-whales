import { atmosphereWindAt } from './atmosphere.js';
import { createInkPalette, glyphInkIndex } from './shading.js';

const MAX_DROPS = 320, MAX_IMPACTS = 160, RESPONSE = 0.26;
const storage = new WeakMap();
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const size = value => clamp(finite(value), 0, 1e7);
function hash(id, seed, salt) {
  let value = Math.imul(id | 0, 374761393) ^ Math.imul(seed | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Live rain history in CSS pixels and simulated seconds. */
export function createRainField({ seed = 0, width = 0, height = 0, intensity = 0 } = {}) {
  const field = { seed: finite(seed) >>> 0, width: size(width), height: size(height),
    intensity: clamp(finite(intensity)), time: 0, drops: [], impacts: [] };
  storage.set(field, { dropPool: Array.from({ length: MAX_DROPS }, () => ({})),
    impactPool: Array.from({ length: MAX_IMPACTS }, () => ({})), credit: 0, nextId: 0,
    width: field.width, height: field.height, wind: { x: 0, y: 0 }, segments: new Float64Array(32) });
  return field;
}

export function resizeRainField(field, width, height) {
  const state = storage.get(field);
  if (!state) return field;
  field.width = size(width); field.height = size(height);
  if (!(field.width > 0 && field.height > 0)) return field;
  const sx = state.width > 0 ? field.width / state.width : 1;
  const sy = state.height > 0 ? field.height / state.height : 1;
  for (const drop of field.drops) {
    drop.x *= sx; drop.y *= sy; drop.landY *= sy;
    drop.vx *= sx; drop.vy *= sy; drop.speed *= sy;
  }
  for (const impact of field.impacts) { impact.x *= sx; impact.y *= sy; }
  state.width = field.width; state.height = field.height;
  return field;
}

export function resetRainField(field) {
  const state = storage.get(field);
  if (!state) return field;
  for (const drop of field.drops) state.dropPool.push(drop);
  for (const impact of field.impacts) state.impactPool.push(impact);
  field.drops.length = 0; field.impacts.length = 0;
  field.intensity = 0; field.time = 0; state.credit = 0; state.nextId = 0;
  return field;
}

function velocity(state, drop, options, dt = 0, initialize = false) {
  const vector = state.wind;
  vector.x = 0; vector.y = 0;
  if (options.wind && options.atmosphere) atmosphereWindAt(options.atmosphere, drop.x, drop.y, vector);
  // Project the shared breeze into the falling column without changing energy.
  const side = clamp(finite(vector.x) * 3.2, -drop.speed * 0.8, drop.speed * 0.8);
  const down = Math.max(drop.speed * 0.5, drop.speed + finite(vector.y) * 3.2);
  const normal = drop.speed / Math.hypot(side, down);
  const targetX = side * normal, targetY = down * normal;
  if (initialize) { drop.vx = targetX; drop.vy = targetY; return; }
  const blend = 1 - Math.exp(-dt / RESPONSE);
  const vx = drop.vx + (targetX - drop.vx) * blend, vy = drop.vy + (targetY - drop.vy) * blend;
  const speed = drop.speed / Math.hypot(vx, vy);
  drop.vx = vx * speed; drop.vy = vy * speed;
}

function impactAt(field, state, drop, x, age) {
  if (!state.impactPool.length) return;
  const impact = state.impactPool.pop();
  impact.dropId = drop.id; impact.x = x; impact.y = drop.landY;
  impact.age = age; impact.life = 0.48 + drop.variation * 0.32;
  impact.energy = drop.energy; impact.scale = drop.scale;
  impact.radius = (3.5 + 6 * drop.energy) * drop.scale;
  impact.shape = drop.variation * Math.PI * 2;
  if (age < impact.life) field.impacts.push(impact);
  else state.impactPool.push(impact);
}

function moveDrop(field, state, drop, dt, options, feedback = true) {
  velocity(state, drop, options, dt);
  const remaining = Math.max(0, (drop.landY - drop.y) / drop.vy);
  if (remaining <= dt) {
    if (feedback) impactAt(field, state, drop, drop.x + drop.vx * remaining, dt - remaining);
    return false;
  }
  drop.x += drop.vx * dt; drop.y += drop.vy * dt; drop.age += dt;
  return true;
}

function spawn(field, state, options, age) {
  if (!state.dropPool.length) return;
  const drop = state.dropPool.pop(), id = state.nextId++;
  const u = hash(id, field.seed, 1), v = hash(id, field.seed, 2);
  drop.id = id; drop.variation = hash(id, field.seed, 3);
  drop.scale = 0.68 + v * 0.48;
  drop.energy = (0.24 + 0.76 * field.intensity) * (0.8 + drop.variation * 0.2);
  drop.speed = (260 + drop.variation * 100) * drop.scale;
  drop.life = 0.38 + hash(id, field.seed, 4) * 0.32;
  drop.landY = v * field.height;
  drop.x = u * field.width; drop.y = drop.landY;
  velocity(state, drop, options, 0, true);
  drop.x -= drop.vx * drop.life; drop.y -= drop.vy * drop.life; drop.age = 0;
  if (moveDrop(field, state, drop, age, options)) field.drops.push(drop);
  else state.dropPool.push(drop);
}

function advance(field, state, dt, options, target, emit) {
  field.time += dt;
  const before = field.intensity, decay = Math.exp(-dt / RESPONSE);
  field.intensity = target + (before - target) * decay;
  if (target === 0 && field.intensity < 0.002) field.intensity = 0;
  let live = 0;
  for (const impact of field.impacts) {
    impact.age += dt;
    if (impact.age < impact.life) field.impacts[live++] = impact;
    else state.impactPool.push(impact);
  }
  field.impacts.length = live; live = 0;
  for (const drop of field.drops) {
    if (moveDrop(field, state, drop, dt, options, emit)) field.drops[live++] = drop;
    else state.dropPool.push(drop);
  }
  field.drops.length = live;
  if (!emit) { state.credit = 0; return; }
  const rate = Math.min(260, 180 * Math.sqrt(field.width * field.height / (960 * 600)));
  // Integrate the response curve so frame rate does not change rainfall density.
  // Hashes are consulted only at births, never to reroll a live particle.
  const amount = field.intensity === 0 ? 0 : rate * (target * dt + (before - target) * RESPONSE * (1 - decay));
  const previous = state.credit, total = previous + Math.max(0, amount), count = Math.floor(total);
  state.credit = total - count;
  for (let i = 1; i <= count && i <= MAX_DROPS; i++) {
    const age = amount > 0 ? dt * (1 - (i - previous) / amount) : 0;
    spawn(field, state, options, Math.max(0, age));
  }
}

/** Retarget rain without replacing live drops; disabled rain drains naturally. */
export function stepRain(field, delta, { enabled = false, intensity = 0.45, wind = true, atmosphere } = {}) {
  const state = storage.get(field);
  if (!state || !(Number.isFinite(delta) && delta > 0 && field.width > 0 && field.height > 0)) return field;
  const target = enabled ? clamp(finite(intensity, 0.45)) : 0, options = { wind, atmosphere };
  // Only the last two seconds of a suspended tab can contribute visible history.
  if (delta > 2) advance(field, state, delta - 2, options, target, false);
  const window = Math.min(delta, 2), steps = Math.ceil(window * 60), dt = window / steps;
  for (let i = 0; i < steps; i++) advance(field, state, dt, options, target, true);
  return field;
}

// Sample every short segment and both stroke edges, rather than only its head.
function maskAt(segments, count, fade, width, height, thickness) {
  let mask = 1;
  const pad = thickness * 0.5;
  for (let i = 0; i < count * 4; i += 4) {
    const x = segments[i], y = segments[i + 1], dx = segments[i + 2] - x, dy = segments[i + 3] - y;
    const length = Math.hypot(dx, dy), steps = Math.max(1, Math.min(32, Math.ceil(length)));
    const nx = length > 0 ? -dy / length * pad : pad, ny = length > 0 ? dx / length * pad : 0;
    for (let j = 0; j <= steps; j++) {
      const px = x + dx * j / steps, py = y + dy * j / steps;
      if (px - pad < 0 || py - pad < 0 || px + pad > width || py + pad > height) return 0;
      if (fade) {
        mask = Math.min(mask, clamp(finite(fade(px, py))), clamp(finite(fade(px + nx, py + ny))),
          clamp(finite(fade(px - nx, py - ny))));
        if (mask <= 0) return 0;
      }
    }
  }
  return mask;
}
function strokeSegments(target, segments, count) {
  target.beginPath();
  for (let i = 0; i < count * 4; i += 4) {
    target.moveTo(segments[i], segments[i + 1]); target.lineTo(segments[i + 2], segments[i + 3]);
  }
  target.stroke();
}

/** Whale opacity can be a whisper. Weather still has to read, so strokes keep a floor. */
function rainPresence(opacity) {
  return Math.min(0.83, 0.48 + 0.52 * opacity);
}

/** Draw surface before whales and fall afterwards. Drawing never advances time. */
export function drawRain(target, field, options = {}) {
  const result = { drops: 0, impacts: 0, glyphs: 0 }, state = storage.get(field);
  if (!state || !target || typeof target.beginPath !== 'function' || typeof target.moveTo !== 'function'
    || typeof target.lineTo !== 'function' || typeof target.stroke !== 'function') return result;
  const width = size(options.width ?? field.width), height = size(options.height ?? field.height);
  const opacity = clamp(finite(options.opacity, 0.6));
  if (!(width > 0 && height > 0 && field.width > 0 && field.height > 0 && opacity > 0)) return result;
  const phase = options.phase, reduced = !!options.reduced;
  const sx = width / field.width, sy = height / field.height, ratio = clamp(finite(options.ratio, 1), 0.1, 8);
  const cellHeight = clamp(finite(options.cellHeight, 13), 5, 32), cellWidth = clamp(finite(options.cellWidth, 11), 5, 32);
  const palette = options.palette || createInkPalette('ocean'), segments = state.segments;
  const fade = typeof options.fade === 'function' ? options.fade : null;
  const alpha = target.globalAlpha, ink = target.strokeStyle, lineWidth = target.lineWidth;
  const lineCap = target.lineCap, lineJoin = target.lineJoin;
  try {
    target.lineCap = 'butt'; target.lineJoin = 'round';
    if (!phase || phase === 'surface') for (const impact of field.impacts) {
      if (reduced && impact.dropId % 4) continue;
      const progress = clamp(impact.age / impact.life);
      const envelope = Math.min(1, impact.age / 0.035) * (1 - progress) ** 1.7;
      const radius = (1 + impact.radius * (1 - (1 - progress) ** 1.6)) * cellWidth / 11;
      const x = impact.x * sx, y = impact.y * sy;
      let count = 0;
      // Three separated crests imply a ring without a closed bubble outline.
      for (let arc = 0; arc < 3; arc++) for (let part = 0; part < 2; part++) {
        const a = impact.shape + arc * Math.PI * 2 / 3 + part * 0.35, b = a + 0.35, i = count++ * 4;
        segments[i] = x + Math.cos(a) * radius; segments[i + 1] = y + Math.sin(a) * radius * 0.42;
        segments[i + 2] = x + Math.cos(b) * radius; segments[i + 3] = y + Math.sin(b) * radius * 0.42;
      }
      if (impact.age < 0.16 && !reduced) {
        const lift = Math.sin(impact.age / 0.16 * Math.PI) * (1 + impact.energy * 3) * impact.scale;
        for (let side = -1; side <= 1; side += 2) {
          const i = count++ * 4;
          segments[i] = x + side * radius * 0.3; segments[i + 1] = y - lift;
          segments[i + 2] = x + side * (radius * 0.3 + 1); segments[i + 3] = y - lift - 1.3;
        }
      }
      target.lineWidth = Math.max(1, 1.1 / ratio) * impact.scale;
      const mask = maskAt(segments, count, fade, width, height, target.lineWidth);
      const amount = rainPresence(opacity) * (options.dark ? 0.72 : 0.68) * envelope * mask * (reduced ? 0.55 : 1);
      if (!(amount > 0.001)) continue;
      target.globalAlpha = amount; target.strokeStyle = palette[glyphInkIndex(options.dark ? 0.72 : 0.2, 0.16)];
      strokeSegments(target, segments, count); result.impacts++;
    }
    if (!phase || phase === 'fall') for (const drop of field.drops) {
      if (reduced && drop.id % 4) continue;
      const x = drop.x * sx, y = drop.y * sy;
      const length = cellHeight * (0.55 + drop.scale * 0.35) * (reduced ? 0.65 : 1);
      const speed = Math.hypot(drop.vx * sx, drop.vy * sy) || 1;
      segments[0] = x; segments[1] = y;
      segments[2] = x - drop.vx * sx / speed * length; segments[3] = y - drop.vy * sy / speed * length;
      target.lineWidth = Math.max(1, 1.05 / ratio) * drop.scale;
      const mask = maskAt(segments, 1, fade, width, height, target.lineWidth);
      const amount = rainPresence(opacity) * (options.dark ? 0.66 : 0.62) * Math.min(1, drop.age / 0.055)
        * (0.65 + 0.35 * drop.energy) * mask * (reduced ? 0.5 : 1);
      if (!(amount > 0.001)) continue;
      target.globalAlpha = amount; target.strokeStyle = palette[glyphInkIndex(options.dark ? 0.76 : 0.16, 0.16)];
      strokeSegments(target, segments, 1); result.drops++;
    }
  } finally {
    target.globalAlpha = alpha; target.strokeStyle = ink; target.lineWidth = lineWidth;
    target.lineCap = lineCap; target.lineJoin = lineJoin;
  }
  return result;
}
