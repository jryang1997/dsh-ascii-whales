import { createInkPalette, glyphInkIndex } from './shading.js';

// Sea-surface atmosphere, not sky icons. Seeds and character ranks stay fixed;
// only coherent fields and short wind packets advect through the scene.
const ATMOS_MAX_WIND = 192;
const ATMOS_MAX_CLOUD = 1100;
const atmosFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const atmosClamp = (value, lo = 0, hi = 1) => value < lo ? lo : value > hi ? hi : value;
const atmosSmooth = value => { const t = atmosClamp(value); return t * t * (3 - 2 * t); };
const atmosWrap = value => value - Math.floor(value);
const atmosDelta = value => value - Math.round(value);
function atmosHash(a, b = 0, salt = 0) {
  let value = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function createAtmosphereField(options = {}) {
  const seed = atmosFinite(options.seed, 0) >>> 0;
  const clouds = Array.from({ length: 3 }, (_, i) => {
    const key = i + 11;
    return { u: atmosHash(key, seed, 1), v: atmosHash(key, seed, 2),
      rx: 0.18 + 0.075 * atmosHash(key, seed, 3),
      ry: 0.14 + 0.07 * atmosHash(key, seed, 4),
      phase: atmosHash(key, seed, 5) * Math.PI * 2,
      lobes: Array.from({ length: 4 }, (_, lobe) => ({
        x: (atmosHash(key, seed, 10 + lobe) - 0.5) * 0.9,
        y: (atmosHash(key, seed, 20 + lobe) - 0.5) * 0.8,
        radius: 0.5 + 0.25 * atmosHash(key, seed, 30 + lobe),
      })) };
  });
  const gusts = Array.from({ length: 12 }, (_, i) => ({
    u: atmosHash(i + 1, seed, 71), v: atmosHash(i + 1, seed, 72),
    life: 9 + 7 * atmosHash(i + 1, seed, 73),
    phase: 17 * atmosHash(i + 1, seed, 74),
    length: 0.055 + 0.055 * atmosHash(i + 1, seed, 75),
    bend: (atmosHash(i + 1, seed, 76) - 0.5) * 0.8,
  }));
  return { seed, time: 0, width: Math.max(0, atmosFinite(options.width, 0)),
    height: Math.max(0, atmosFinite(options.height, 0)), clouds, gusts };
}

export function resizeAtmosphereField(field, width, height) {
  if (!field) return field;
  field.width = Math.max(0, atmosFinite(width, 0));
  field.height = Math.max(0, atmosFinite(height, 0));
  return field;
}

export function stepAtmosphere(field, delta) {
  if (field && Number.isFinite(delta) && delta > 0) field.time += delta;
  return field;
}

/** Normalized, broad shadow coverage. The coordinate field is continuous in time. */
export function atmosphereCloudAt(field, x, y) {
  if (!field || !(field.width > 0 && field.height > 0)
    || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const time = atmosFinite(field.time, 0);
  const u = x / field.width, v = y / field.height;
  let remaining = 1;
  for (const cloud of field.clouds || []) {
    const dx = atmosDelta(u - cloud.u - time * 0.0009) / cloud.rx;
    const dy = atmosDelta(v - cloud.v + time * 0.00016) / cloud.ry;
    if (Math.abs(dx) > 2.2 || Math.abs(dy) > 2.2) continue;
    let density = 0;
    // Four overlapping soft lobes make an irregular, unfenced penumbra. There
    // are no per-frame random samples, thresholded noise or changing glyphs.
    for (const lobe of cloud.lobes) {
      const lx = (dx - lobe.x) / lobe.radius, ly = (dy - lobe.y) / lobe.radius;
      density += Math.exp(-(lx * lx + ly * ly) * 1.6) * 0.42;
    }
    remaining *= 1 - atmosSmooth((density - 0.10) / 0.87) * 0.82;
  }
  return atmosClamp(1 - remaining);
}

/** Call once after resolving the mesh. Geometry and character density stay untouched. */
export function shadeAtmosphere(field, grid, options = {}) {
  if (!grid || !grid.lights) return;
  if (!options.clouds) {
    if (grid.atmosphereLights) grid.atmosphereLights.set(grid.lights);
    return;
  }
  if (grid.atmosphereLights?.length !== grid.lights.length) {
    grid.atmosphereLights = new Float32Array(grid.lights.length);
  }
  grid.atmosphereLights.set(grid.lights);
  for (let cell = 0; cell < grid.owners.length; cell++) {
    if (grid.owners[cell] < 0) continue;
    grid.atmosphereLights[cell] = Math.max(0, grid.lights[cell]
      - 0.10 * atmosphereCloudAt(field, grid.centersX[cell], grid.centersY[cell]));
  }
}

/** A bounded ASCII stipple shadow and sparse, wind-aligned surface strokes. */
export function drawAtmosphere(target, field, options = {}) {
  const result = { wind: 0, clouds: 0 };
  if (!target || typeof target.fillText !== 'function' || !field) return result;
  const width = atmosFinite(options.width, field.width), height = atmosFinite(options.height, field.height);
  const opacity = atmosClamp(atmosFinite(options.opacity, 0.6));
  if (!(width > 0 && height > 0 && opacity > 0)) return result;
  const ratio = Math.max(0.1, atmosFinite(options.ratio, 1));
  const cellWidth = Math.max(5, atmosFinite(options.cellWidth, 11));
  const cellHeight = Math.max(5, atmosFinite(options.cellHeight, 13));
  const palette = options.palette || createInkPalette('ocean');
  const fade = typeof options.fade === 'function' ? options.fade : null;
  const time = atmosFinite(field.time, 0);
  target.font = `600 ${Math.max(9, Math.min(13, cellHeight * 0.92))}px Consolas, "Cascadia Mono", monospace`;
  target.textAlign = 'center'; target.textBaseline = 'middle';
  let fill = null;
  const paint = (glyph, x, y, alpha, light, kind) => {
    x = Math.round(x * ratio) / ratio; y = Math.round(y * ratio) / ratio;
    if (!(x >= 0 && x < width && y >= 0 && y < height)) return;
    const mask = fade ? atmosClamp(atmosFinite(fade(x, y), 0)) : 1;
    alpha *= mask;
    if (!(alpha > 0.006)) return;
    const ink = kind === 'clouds' && options.dark
      ? 'rgb(3, 12, 20)' : palette[glyphInkIndex(light, 0.16)];
    if (ink !== fill) { target.fillStyle = ink; fill = ink; }
    target.globalAlpha = Math.min(opacity * 0.24, alpha);
    target.fillText(glyph, x, y, cellWidth);
    result[kind]++;
  };
  if (options.clouds) {
    // About 2200 candidates even on a 4K monitor; only fixed-rank stipple in
    // shadow cores is painted, with a second hard budget on actual glyphs.
    const spacing = Math.max(cellWidth * 1.4, cellHeight * 1.1, Math.sqrt(width * height / 2200));
    const columns = Math.ceil(width / spacing), rows = Math.ceil(height / spacing);
    for (let row = 0; row < rows && result.clouds < ATMOS_MAX_CLOUD; row++) {
      for (let col = 0; col < columns && result.clouds < ATMOS_MAX_CLOUD; col++) {
        const key = row * 8192 + col, rank = atmosHash(key, field.seed, 91);
        const x = (col + 0.5) * spacing, y = (row + 0.5) * spacing;
        const shadow = atmosphereCloudAt(field, x, y);
        const density = atmosSmooth((shadow - rank * 0.40) / 0.32);
        const glyph = rank < 0.34 ? '.' : rank < 0.64 ? "'" : ':';
        paint(glyph, x, y, opacity * 0.24 * density,
          options.dark ? 0.32 : 0.16, 'clouds');
      }
    }
  }
  if (options.wind) {
    const size = Math.min(width, height), angle = -0.14;
    const fx = Math.cos(angle), fy = Math.sin(angle), nx = -fy, ny = fx;
    const speed = size * 0.027;
    for (let i = 0; i < field.gusts.length && result.wind < ATMOS_MAX_WIND; i++) {
      const gust = field.gusts[i];
      const clock = time + gust.phase, cycle = Math.floor(clock / gust.life), age = clock - cycle * gust.life;
      const envelope = atmosSmooth(age / (gust.life * 0.22))
        * atmosSmooth((gust.life - age) / (gust.life * 0.28));
      if (envelope < 0.02) continue;
      const anchorX = atmosWrap(gust.u + atmosHash(i, cycle, field.seed) * 0.25) * width;
      const anchorY = atmosWrap(gust.v + atmosHash(i, cycle, field.seed + 1) * 0.2) * height;
      const length = Math.max(cellWidth * 4, size * gust.length);
      const count = Math.min(16, Math.max(4, Math.ceil(length / (cellWidth * 0.85))));
      for (let j = 0; j < count && result.wind < ATMOS_MAX_WIND; j++) {
        const u = j / (count - 1), along = length * (u - 0.5) + speed * age;
        const bend = Math.sin(u * Math.PI) * size * gust.bend * 0.025;
        const x = atmosWrap((anchorX + fx * along + nx * bend) / width) * width;
        const y = atmosWrap((anchorY + fy * along + ny * bend) / height) * height;
        const feather = Math.sin(Math.PI * (0.08 + 0.84 * u));
        const shadow = options.clouds ? atmosphereCloudAt(field, x, y) : 0;
        paint(j % 4 === 1 ? '~' : '-', x, y, opacity * 0.24 * envelope * feather,
          0.40 - shadow * 0.10, 'wind');
      }
    }
  }
  target.globalAlpha = 1;
  return result;
}
