import { createInkPalette, glyphInkIndex, rainbowColorStops } from './shading.js';
import { attenuation, glyphOpacity, createScene, resizeScene, whalePose, projectParticle, createDepthGrid, resolveDepthGrid, fitCanvas } from './model.js';
import { resetWhaleRig } from './rig.js';

// Ordered by visual density. Selection depends on the skin, never on a clock.
export const ASCII_RAMP = '.:-=+*ox%#@';
const surfaceClamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
const surfacePalettes = new Map();

function surfaceKey(particle) {
  const along = Math.round((particle.x + 1.2) * 28);
  const across = Math.round(Math.atan2(particle.z, particle.y) * 10);
  return (Math.imul(along, 73856093) ^ Math.imul(across, 19349663) ^ Math.imul(particle.whale + 1, 83492791)) >>> 0;
}

export function surfaceGlyph(particle, light, coverage, mode) {
  if (mode !== 'ascii') return particle.glyph;
  if (coverage < 0.6) return coverage < 0.3 ? '.' : ':';
  if (particle.part === 'eye') return 'o';
  const density = surfaceClamp(1 - light);
  const index = Math.round(density * (ASCII_RAMP.length - 1));
  return ASCII_RAMP[index];
}

/** Cached cell backgrounds with restrained cool, neutral and warm variations. */
export function createCellPalette(name = 'ocean', colorIndex) {
  const rainbow = name === 'rainbow' ? rainbowColorStops(colorIndex) : null;
  name = rainbow ? `rainbow:${colorIndex}` : name === 'azure' || name === 'indigo' ? name : 'ocean';
  if (surfacePalettes.has(name)) return surfacePalettes.get(name);
  const stops = {
    ocean: [[25, 47, 66], [99, 128, 146], [219, 231, 236]],
    azure: [[21, 55, 73], [83, 138, 160], [210, 234, 241]],
    indigo: [[38, 43, 68], [114, 123, 155], [225, 228, 241]],
  };
  const [shadow, mid, highlight] = rainbow || stops[name];
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

// Match the ink palette's depth range; retain enough contrast for distant
// whales while giving a crossing foreground silhouette a clear visual lead.
function surfaceDepthOpacity(pose) {
  const depth = pose?.focal > 0 && Number.isFinite(pose.cameraZ) ? pose.cameraZ / pose.focal : 0.14;
  const t = Math.max(0, Math.min(1, (depth - 0.14) / 1.21));
  return 1 - 0.38 * t * t * (3 - 2 * t);
}

/** One painter shared by the plugin, live previews and rendering checks. */
export function createWhalePainter(scene, config) {
  const ascii = config.fillMode === 'ascii', tiles = config.renderStyle === 'cells';
  const font = ascii
    ? `600 ${config.glyphSize}px Consolas, "Cascadia Mono", "Courier New", monospace`
    : `600 ${config.glyphSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
  const alphabet = ascii ? Array.from(ASCII_RAMP) : Array.from(new Set(scene.particles.map(p => p.glyph)));
  const palette = { ink: createInkPalette(config.color), cells: createCellPalette(config.color) };
  const whalePalettes = config.color === 'rainbow' ? (scene.whales || []).map(whale => ({
    ink: createInkPalette(config.color, whale.colorIndex),
    cells: createCellPalette(config.color, whale.colorIndex),
  })) : null;
  const textDark = '#122635', textLight = '#f2f6fa';

  function paint(target, grid, poses, width, height, ratio = 1, fade = null, dark = false) {
    // Opacity and the reading-area fade stay live: the engine reuses one config
    // object and updates it in place, so those two options need a repaint, not a
    // rebuilt painter. Font, alphabet, cell shape and palette are fixed here.
    const opacity = config.opacity, quietCenter = config.quietCenter;
    const depthOpacities = poses.map(surfaceDepthOpacity);
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
      let alpha = glyphOpacity(opacity, light, grid.visibility[cell], attenuation(x, y, width, height, quietCenter))
        * (0.3 + coverage * 0.7) * depthOpacities[particle.whale];
      if (fade) alpha *= fade(x, y);
      if (alpha < 0.01) continue;
      // Clouds tint the ink, while the original surface light still selects
      // literal/ASCII glyphs and coverage. A passing shadow cannot change text.
      const inkLight = grid.atmosphereLights ? grid.atmosphereLights[cell] : light;
      const shade = glyphInkIndex(inkLight, pose.cameraZ / pose.focal);
      const solid = tiles && coverage >= 0.6 && grid.sampleOwners[cell * 5] >= 0;
      const colors = whalePalettes?.[particle.whale] || palette;
      const material = colors.cells[shade + (surfaceKey(particle) % 4) * 512];
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
        useFill(colors.ink[shade]);
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
export function drawWhaleSample(canvas, config, options = {}) {
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
