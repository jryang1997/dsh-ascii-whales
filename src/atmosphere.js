import { createInkPalette, glyphInkIndex } from './shading.js';

// Sea-surface atmosphere. Fixed soft lobes cast continuous shadows while short
// ASCII wind packets advect independently through the scene.
const ATMOS_MAX_WIND = 192;
const ATMOS_CLOUD_TEXELS = 8192;
const ATMOS_MASK_TILES = 6144;
const ATMOS_MASK_PIXELS = 2097152;
const ATMOS_MASK_LEVELS = 32;
const atmosCloudBuffers = new WeakMap();
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

export function stepAtmosphere(field, delta, metrics = null) {
  if (field && Number.isFinite(delta) && delta > 0) {
    const started = metrics?.begin();
    field.time += delta;
    metrics?.end('atmosphereUpdate', started);
  }
  return field;
}

/** Shared sea-plane breeze, in CSS pixels per simulated second. */
export function atmosphereWindAt(field, x = 0, y = 0, out = {}) {
  const width = Math.max(1, atmosFinite(field?.width, 1));
  const height = Math.max(1, atmosFinite(field?.height, 1));
  const time = atmosFinite(field?.time, 0), seed = atmosFinite(field?.seed, 0);
  const phase = atmosHash(seed, 17, 91) * Math.PI * 2;
  const u = atmosFinite(x, 0) / width, v = atmosFinite(y, 0) / height;
  // Slow shared veering and a broad local gust keep wind strokes and rain in
  // agreement. Periodic coordinates agree across the wrapping sea's edges.
  const angle = -0.14 + 0.15 * Math.sin(time * 0.065 + phase)
    + 0.045 * Math.sin(Math.PI * 2 * v + time * 0.09 + phase);
  const strength = 0.86 + 0.14 * Math.sin(time * 0.21 + phase + Math.PI * 2 * u);
  const speed = Math.min(width, height) * 0.027 * strength;
  out.x = Math.cos(angle) * speed;
  out.y = Math.sin(angle) * speed;
  return out;
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

// Both axes are capped as well as the area, including very narrow viewports.
function atmosRasterSize(width, height, budget, minimum = 1) {
  const scale = Math.max(minimum, width / 192, height / 128, Math.sqrt(width * height / budget));
  return { columns: Math.max(1, Math.floor(width / scale)), rows: Math.max(1, Math.floor(height / scale)) };
}

function atmosCloudBuffer(target, field, width, height, ink) {
  if (typeof target.drawImage !== 'function') return null;
  let buffer = atmosCloudBuffers.get(field);
  if (!buffer) {
    try {
      const document = target.canvas?.ownerDocument || globalThis.document;
      const canvas = document?.createElement ? document.createElement('canvas')
        : typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : null;
      const context = canvas?.getContext('2d');
      if (!context || typeof context.fillRect !== 'function') return null;
      buffer = { canvas, context };
      atmosCloudBuffers.set(field, buffer);
    } catch { return null; }
  }
  const { columns, rows } = atmosRasterSize(width, height, ATMOS_CLOUD_TEXELS);
  if (buffer.time === field.time && buffer.width === width && buffer.height === height
    && buffer.fieldWidth === field.width && buffer.fieldHeight === field.height && buffer.ink === ink) return buffer;
  const { canvas, context } = buffer;
  if (canvas.width !== columns) canvas.width = columns;
  if (canvas.height !== rows) canvas.height = rows;
  context.clearRect(0, 0, columns, rows);
  context.fillStyle = ink;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const shadow = atmosphereCloudAt(field, (col + 0.5) * width / columns, (row + 0.5) * height / rows);
    if (!(shadow > 0.001)) continue;
    context.globalAlpha = shadow;
    context.fillRect(col, row, 1, 1);
  }
  context.globalAlpha = 1;
  Object.assign(buffer, { time: field.time, width, height, fieldWidth: field.width, fieldHeight: field.height, ink });
  return buffer;
}

function atmosMaskRuns(buffer, fade, width, height, pixelsX, pixelsY, columns, rows) {
  const cached = buffer.maskRuns;
  if (cached && cached.fade === fade && cached.width === width && cached.height === height
    && cached.pixelsX === pixelsX && cached.pixelsY === pixelsY && cached.columns === columns
    && cached.rows === rows) return cached.runs;
  const runs = [];
  for (let row = 0; row < rows; row++) {
    const top = Math.floor(row * pixelsY / rows), bottom = Math.floor((row + 1) * pixelsY / rows);
    let start = 0, previous = 0;
    for (let col = 0; col <= columns; col++) {
      let rank = 0;
      if (col < columns) {
        const left = Math.floor(col * pixelsX / columns), right = Math.floor((col + 1) * pixelsX / columns);
        let mask = 1;
        // Nine samples cover each footprint conservatively. Reuse these runs
        // while the reading layout's fade reference and raster geometry stay fixed.
        for (let iy = 0; iy < 3 && mask > 0; iy++) for (let ix = 0; ix < 3 && mask > 0; ix++) {
          mask = Math.min(mask, atmosClamp(atmosFinite(fade((left + (right - left) * ix / 2) * width / pixelsX,
            (top + (bottom - top) * iy / 2) * height / pixelsY), 0)));
        }
        rank = Math.floor(mask * ATMOS_MASK_LEVELS);
      }
      if (rank !== previous) {
        if (previous > 0) {
          const left = Math.floor(start * pixelsX / columns), right = Math.floor(col * pixelsX / columns);
          runs.push(left, top, right - left, bottom - top, previous / ATMOS_MASK_LEVELS);
        }
        start = col;
        previous = rank;
      }
    }
  }
  buffer.maskRuns = { fade, width, height, pixelsX, pixelsY, columns, rows, runs };
  return runs;
}

function atmosDrawClouds(target, field, width, height, opacity, palette, dark, fade) {
  const buffer = atmosCloudBuffer(target, field, width, height,
    dark ? 'rgb(2, 8, 16)' : palette[glyphInkIndex(0.10, 0.16)]);
  if (!buffer) return 0;
  let source = buffer.canvas;
  if (fade) {
    if (!buffer.maskCanvas) {
      try {
        const document = target.canvas?.ownerDocument || globalThis.document;
        buffer.maskCanvas = document?.createElement ? document.createElement('canvas')
          : typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : null;
        buffer.maskContext = buffer.maskCanvas?.getContext('2d');
      } catch { return 0; }
      if (!buffer.maskContext) return 0;
    }
    const canvas = buffer.maskCanvas, context = buffer.maskContext;
    const scale = Math.min(1, 4096 / width, 4096 / height, Math.sqrt(ATMOS_MASK_PIXELS / (width * height)));
    const pixelsX = Math.max(1, Math.floor(width * scale)), pixelsY = Math.max(1, Math.floor(height * scale));
    if (canvas.width !== pixelsX) canvas.width = pixelsX;
    if (canvas.height !== pixelsY) canvas.height = pixelsY;
    context.clearRect(0, 0, pixelsX, pixelsY);
    const size = atmosRasterSize(width, height, ATMOS_MASK_TILES, 8);
    const columns = Math.min(pixelsX, size.columns), rows = Math.min(pixelsY, size.rows);
    const runs = atmosMaskRuns(buffer, fade, width, height, pixelsX, pixelsY, columns, rows);
    if (!runs.length) { context.globalAlpha = 1; return 0; }
    context.fillStyle = '#fff';
    for (let i = 0; i < runs.length; i += 5) {
      context.globalAlpha = runs[i + 4];
      context.fillRect(runs[i], runs[i + 1], runs[i + 2], runs[i + 3]);
    }
    context.globalAlpha = 1;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.globalCompositeOperation = 'source-in';
    context.drawImage(buffer.canvas, 0, 0, pixelsX, pixelsY);
    context.globalCompositeOperation = 'source-over';
    source = canvas;
  }
  const smoothing = target.imageSmoothingEnabled, quality = target.imageSmoothingQuality;
  // The cloud field has already been smoothed inside the mask. A second linear
  // upscale would bleed its alpha over a reading boundary on large viewports.
  target.imageSmoothingEnabled = !fade;
  target.imageSmoothingQuality = 'high';
  target.globalAlpha = opacity * (dark ? 0.78 : 0.42);
  target.drawImage(source, 0, 0, width, height);
  target.imageSmoothingEnabled = smoothing;
  target.imageSmoothingQuality = quality;
  return 1;
}

/** Continuous cloud shadows and bounded ASCII wind strokes. Counts are image draws / wind glyphs. */
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
    const ink = palette[glyphInkIndex(light, 0.16)];
    if (ink !== fill) { target.fillStyle = ink; fill = ink; }
    target.globalAlpha = Math.min(opacity * 0.24, alpha);
    target.fillText(glyph, x, y, cellWidth);
    result[kind]++;
  };
  if (options.clouds) result.clouds = atmosDrawClouds(target, field, width, height,
    opacity, palette, options.dark, fade);
  if (options.wind) {
    const size = Math.min(width, height), breeze = {};
    for (let i = 0; i < field.gusts.length && result.wind < ATMOS_MAX_WIND; i++) {
      const gust = field.gusts[i];
      const clock = time + gust.phase, cycle = Math.floor(clock / gust.life), age = clock - cycle * gust.life;
      const envelope = atmosSmooth(age / (gust.life * 0.22))
        * atmosSmooth((gust.life - age) / (gust.life * 0.28));
      if (envelope < 0.02) continue;
      const anchorX = atmosWrap(gust.u + atmosHash(i, cycle, field.seed) * 0.25) * width;
      const anchorY = atmosWrap(gust.v + atmosHash(i, cycle, field.seed + 1) * 0.2) * height;
      atmosphereWindAt(field, anchorX, anchorY, breeze);
      const speed = Math.hypot(breeze.x, breeze.y) || 1;
      const fx = breeze.x / speed, fy = breeze.y / speed, nx = -fy, ny = fx;
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
