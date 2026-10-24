import { createReadingLayout, demoReadingSnapshot } from './reading-layout.js';
import { createWhalePainter } from './surface.js';
import { whalePose, projectParticle, createDepthGrid, resolveDepthGrid, stampSeaWraps, fitCanvas, normalizeConfig, attenuation } from './model.js';
import { createWhaleSimulation, sceneConfigChanged } from './simulation.js';
import { glassRoundedPath, glassRoundedSubpath, glassClipExterior, glassTone, glassSeaFactor, glassSeaBuffer } from './glass.js';
import { attachSpout } from './spout.js';
import { drawWater } from './water.js';
import { drawRain } from './rain.js';
import { createInkPalette } from './shading.js';
import { drawAtmosphere, shadeAtmosphere } from './atmosphere.js';
import { measureForeground, clearForeground, observeForeground } from './foreground.js';
import { drawActivityBadges } from './activity.js';
import { collectRightbarSurfaces, createReadingProtection, readingEffectTone } from './reading-protection.js';

// DSH publishes these hooks on the conversation subtree. Every one of them is
// optional: without them the whales simply paint as before, so an unknown
// layout can never break the background.
const SCROLL_SELECTOR = '[data-conversation-scroll]';
// The composer card is the rounded input itself; the seat is its sticky wrapper
// and is only used when the card hook is missing from the build.
const COMPOSER_CARD_SELECTOR = '[data-composer-card]';
const COMPOSER_SEAT_SELECTOR = '[data-composer-seat]';
const COMPOSER_RADIUS = 18;
const MEASURE_INTERVAL = 120;

// Rounded content surfaces get their own glass: opaque cards and translucent
// native menus, including panels whose background lives on a pseudo element.
const CONTENT_MAX_SCAN = 600;
const CONTENT_MAX_VISIT = 6000;
const CONTENT_MIN_AREA = 960;
const CONTENT_MAX_WIDTH_RATIO = 0.95;
const CONTENT_MAX_HEIGHT_RATIO = 0.9;
const CONTENT_MIN_ALPHA = 0.9;
const CONTENT_SKIP_TAGS = new Set([
  'SVG', 'PATH', 'G', 'CIRCLE', 'RECT', 'LINE', 'POLYLINE', 'POLYGON',
  'CODE', 'KBD', 'SAMP', 'VAR', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'CANVAS',
  'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'LABEL', 'TIME', 'BR', 'HR', 'WBR',
  'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SMALL', 'SUB', 'SUP', 'MARK', 'A',
]);
const CONTENT_LEAF_TAGS = new Set(['PRE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

// The injected demo card (settings preview): one near-opaque rounded body plus
// grey text lines, standing in for a DSH content card that the preview canvas
// has no DOM hook for. Two theme variants, like the material below.
const DEMO_CARD_BODY_DARK = 'rgba(24, 26, 31, 0.96)';
const DEMO_CARD_BODY_LIGHT = 'rgba(252, 253, 254, 0.96)';
const DEMO_LINE_DARK = 'rgba(203, 217, 231, 0.34)';
const DEMO_LINE_LIGHT = 'rgba(45, 66, 88, 0.32)';
const DEMO_LINE_INSET = 14;
const DEMO_LINE_HEIGHT = 7;


// Which option belongs to which kind of work. A group only rebuilds its own
// part; `live` options are read straight from the config while painting, so
// changing one needs nothing more than the next frame.
const METRIC_KEYS = Object.freeze(['glyphSize', 'fillMode', 'renderStyle']);
const PALETTE_KEYS = Object.freeze(['color']);
const GLASS_KEYS = Object.freeze(['glass', 'glassStrength', 'readingEffect']);
const COMPOSER_KEYS = Object.freeze(['composerGlass', 'composerAvoid']);
const LIVE_KEYS = Object.freeze(['enabled', 'speed', 'opacity', 'quietCenter', 'leftInset', 'spout', 'ripples', 'wind', 'clouds', 'rain', 'rainIntensity', 'activity']);
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
export function diffWhaleConfig(previous, next) {
  const before = previous || {}, after = next || {};
  return {
    scene: sceneConfigChanged(before, after),
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
  const text = String(value || '').trim();
  const modern = text.match(/^(?:color|lab|lch|oklab|oklch|hwb|hsla?)\(([^)]+)\)$/i);
  if (modern) {
    const alpha = modern[1].split('/')[1]?.trim() ?? '1';
    const number = parseFloat(alpha);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, alpha.endsWith('%') ? number / 100 : number)) : null;
  }
  const match = text.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(/[,/ ]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) return null;
  return parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1;
}

function isContentMaterial(style) {
  if (!style || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const alpha = colorAlpha(style.backgroundColor);
  if (alpha >= CONTENT_MIN_ALPHA) return true;
  // Native translucent menus already express their material with backdrop blur.
  // CSS cannot blur the later shell overlay, so they still need our sea buffer.
  return alpha > 0 && [style.backdropFilter, style.webkitBackdropFilter].some(value =>
    typeof value === 'string' && Number(value.match(/\bblur\(\s*([\d.]+)px\s*\)/i)?.[1]) > 0);
}

function hasContentMaterial(element, style, readStyle) {
  if (Number(style.opacity) === 0) return false;
  if (isContentMaterial(style)) return true;
  for (const pseudo of ['::before', '::after']) {
    const material = readStyle(element, pseudo);
    if (!material || !material.content || material.content === 'none' || material.content === 'normal'
      || material.position !== 'absolute') continue;
    // A full background layer counts; an underline, icon or small accent does not.
    if (!['top', 'right', 'bottom', 'left'].every(side => parseFloat(material[side]) === 0)) continue;
    if (isContentMaterial(material)) return true;
  }
  return false;
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
  const scroller = pick(SCROLL_SELECTOR, canvasRect);
  if (scroller) {
    const queue = [scroller.element];
    let visited = 0, styled = 0;
    const readStyle = (element, pseudo) => {
      if (styled >= CONTENT_MAX_SCAN) return null;
      styled++;
      try { return getComputedStyle(element, pseudo); } catch { return null; }
    };
    while (queue.length && visited < CONTENT_MAX_VISIT && styled < CONTENT_MAX_SCAN) {
      const element = queue.shift();
      visited++;
      if (!element || element.hidden || (typeof element.hasAttribute === 'function' && element.hasAttribute('hidden'))) continue;
      const tag = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : '';
      if (CONTENT_SKIP_TAGS.has(tag)) continue;
      if (element.style?.display === 'none') continue;
      if (element.style?.display === 'contents' || element.dataset?.slot !== undefined) {
        if (element.children) for (const child of element.children) queue.push(child);
        continue;
      }
      let rect;
      try { rect = element.getBoundingClientRect(); } catch { continue; }
      if (!(rect.width > 0) || !(rect.height > 0)) {
        let style;
        try { style = getComputedStyle(element); } catch { continue; }
        if (style.display !== 'none' && style.visibility !== 'hidden' && !CONTENT_LEAF_TAGS.has(tag) && element.children) {
          for (const child of element.children) queue.push(child);
        }
        continue;
      }
      if (rect.left + rect.width < canvasRect.left || rect.left > canvasRect.left + canvasRect.width) continue;
      if (rect.top + rect.height < canvasRect.top || rect.top > canvasRect.top + canvasRect.height) continue;
      if (!CONTENT_LEAF_TAGS.has(tag) && element.children) {
        for (const child of element.children) queue.push(child);
      }
      if (element === scroller.element) continue;
      const clippedWidth = Math.min(rect.left + rect.width, canvasRect.left + canvasRect.width) - Math.max(rect.left, canvasRect.left);
      const clippedHeight = Math.min(rect.top + rect.height, canvasRect.top + canvasRect.height) - Math.max(rect.top, canvasRect.top);
      if (clippedWidth >= canvasRect.width * CONTENT_MAX_WIDTH_RATIO
        && clippedHeight >= canvasRect.height * CONTENT_MAX_HEIGHT_RATIO) continue;
      const area = rect.width * rect.height;
      if (!(area >= CONTENT_MIN_AREA) || rect.width < 32 || rect.height < 24) continue;
      const style = readStyle(element);
      if (!style || style.position === 'fixed') continue;
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const radius = cornerRadius(style);
      if (!(radius > 0)) continue;
      if (rect.width < 40 && !(rect.height >= 36 && radius >= 16)) continue;
      if (!hasContentMaterial(element, style, readStyle)) continue;
      const width = Math.max(40, rect.width);
      const left = rect.left - (width - rect.width) / 2;
      boxes.push({ left, top: rect.top, width, height: rect.height, radius });
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
export function createWhaleLayer(canvas, initialConfig, options = {}) {
  const ink = canvas.getContext('2d');
  if (!ink) return { update() {}, setActivity() {}, dispose() {} };
  const config = normalizeLayerConfig(initialConfig);
  // Optional preview injection: `demoCard` places one card by canvas ratios
  // (0..1) with a pixel radius. With it, measure() never reads the DOM — the
  // settings preview has no conversation hooks to find, yet the glass and
  // avoidance options still need a card to act on. Overlay and the standalone
  // preview use the DOM adapter instead.
  const demo = options.demoCard || null;
  const readingProtection = createReadingProtection();
  const scenerySeed = Math.floor(Math.random() * 0x100000000) >>> 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  const simulation = createWhaleSimulation(config, { seed: scenerySeed });
  let scene = simulation.scene;
  const { water, atmosphere, rain } = simulation;
  let sceneryPalette = createInkPalette(config.color);
  let poses = scene.whales.map(() => ({}));
  let projected = scene.particles.map((_, particleIndex) => ({ particleIndex }));
  let painter = createWhalePainter(scene, config);
  ink.font = painter.font;
  let metrics = measureGlyphs();
  let width = 0, height = 0, ratio = 1, grid = null;
  let offsetX = 0, offsetY = 0;
  // A preview uses the same logical sea as the background. Only its final
  // presentation is smaller, so body geometry and glyphs keep their proportions.
  const viewport = options.viewport;
  // Shared blurred sea: one downsampled painter pass and one blur per frame; the
  // number of panes only changes how many times the image is drawn, never the
  // blur cost.
  let sea = null, seaInk = null, blurredSea = null, blurredSeaInk = null;
  let seaFactor = 0, seaPad = 0, seaBlurRadius = 0, blurSupport = false;
  let panes = [], tone = null, readingLayout = null, foreground = null, sidebarForegrounds = [];
  let raf = 0, foregroundRaf = 0, previous = null, lastPaint = -Infinity, measuredAt = -Infinity, disposed = false;
  let readingTextDirty = true, readingRoots = [], scrolling = false, scrollTimer = 0;
  const originalOpacity = canvas.style?.opacity ?? '', originalTransition = canvas.style?.transition ?? '';
  const SCROLL_IDLE_MS = 140;
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
    drawAtmosphere(seaInk, atmosphere, { width, height, cellWidth: grid.cellWidth,
      cellHeight: grid.cellHeight, palette: sceneryPalette, opacity: config.opacity,
      wind: config.wind, clouds: config.clouds, dark });
    const rainScenery = { width, height, palette: sceneryPalette,
      dark, reduced: reduced.matches,
      opacity: config.opacity * (reduced.matches ? (config.rain ? config.rainIntensity : 0) : 1) };
    drawRain(seaInk, rain, { ...rainScenery, phase: 'surface' });
    if (config.renderStyle !== 'cells') paintSeaSilhouette(seaInk, material);
    const savedQuietCenter = config.quietCenter;
    config.quietCenter = false;
    painter.paint(seaInk, grid, poses, width, height, 1, null, dark);
    config.quietCenter = savedQuietCenter;
    drawRain(seaInk, rain, { ...rainScenery, phase: 'fall' });
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
    let largest = 0;
    for (const whale of scene.whales) largest = Math.max(largest, Number(whale.bodyRadius) || 0);
    simulation.setObstacles(readingLayout ? readingLayout.obstacles(largest) : []);
  }

  /** The demo card as a pixel rectangle for the current canvas size. */
  function demoCardRect() {
    if (!demo || !width || !height) return null;
    return demoReadingSnapshot(demo, width, height).composer;
  }

  /** Apply the shared policy to either a DOM or a ratio-based snapshot. */
  function applyReadingSnapshot(snapshot) {
    readingLayout = createReadingLayout(snapshot, config, {
      dark: document.body.hasAttribute('data-ds-dark-theme'),
      reducedTransparency: reducedTransparency.matches,
    });
    ({ panes, tone } = readingLayout);
    applySceneObstacles();
  }

  /**
   * Re-read the conversation geometry: one box list for the content glass, plus
   * the input card for avoidance.
   *
   * Card geometry uses a 120ms budget plus invalidations. Text ranges are cached
   * until content, scrolling, fonts or viewport changes invalidate them. During
   * scrolling the whole layer yields, so neither scan competes with input.
   */
  function measure() {
    measuredAt = performance.now();
    panes = [];
    tone = null;
    readingLayout = null;
    foreground = null;
    sidebarForegrounds = [];
    if (!width || !height || !scene || disposed) return;
    if (demo) {
      applyReadingSnapshot(demoReadingSnapshot(demo, width, height));
      const card = demoCardRect();
      const groups = card && config.glass
        ? [{ clip: { x: card.left, y: card.top, width: card.width, height: card.height, radius: card.radius },
          regions: demoTextRegions(card) }] : [];
      readingProtection.setRegions(groups, { width, height }, config.readingEffect);
      return;
    }
    const canvasRect = rectOf(canvas);
    if (!canvasRect) return;
    const scroller = pick(SCROLL_SELECTOR, canvasRect)?.element;
    const cardHit = pick(COMPOSER_CARD_SELECTOR, canvasRect);
    const composer = cardHit || pick(COMPOSER_SEAT_SELECTOR, canvasRect);
    const sidebars = collectRightbarSurfaces(canvasRect);
    sidebarForegrounds = sidebars.map(panel => measureForeground(panel.element, canvasRect, canvas));
    readingRoots = [scroller, composer?.element, ...sidebars.map(panel => panel.element)].filter(Boolean);
    if (readingTextDirty) {
      readingProtection.measure(readingRoots, canvasRect, config.readingEffect);
      readingTextDirty = false;
    }
    foreground = measureForeground(scroller, canvasRect, canvas);
    foregroundObserver?.update(scroller, foreground.regions);
    if (!config.glass && !config.composerAvoid) {
      applyReadingSnapshot({ canvas: canvasRect, boxes: [] });
      return;
    }
    applyReadingSnapshot({ canvas: canvasRect,
      boxes: config.glass ? collectContentBoxes(canvasRect, cardHit) : [],
      sidebars: config.glass ? sidebars : [],
      composer: composer ? composer.rect : null });
  }

  function draw() {
    if (scrolling || !width || !height || !scene || !grid) return;
    if (performance.now() - measuredAt > MEASURE_INTERVAL) measure();
    if (viewport) {
      ink.setTransform(1, 0, 0, 1, 0, 0);
      ink.clearRect(0, 0, canvas.width, canvas.height);
      ink.setTransform(ratio, 0, 0, ratio, offsetX, offsetY);
    } else {
      ink.setTransform(ratio, 0, 0, ratio, 0, 0);
      ink.clearRect(0, 0, width, height);
    }
    for (let i = 0; i < scene.whales.length; i++) whalePose(scene.whales[i], scene.time, width, height, config.speed, poses[i]);
    for (let i = 0; i < scene.particles.length; i++) projectParticle(scene.particles[i], poses[scene.particles[i].whale], projected[i]);
    resolveDepthGrid(projected, grid, scene.triangles, scene.decals);
    // A body crossing the top is the same body entering from the bottom.
    stampSeaWraps(scene, projected, grid);
    shadeAtmosphere(atmosphere, grid, config);
    ink.save();
    glassClipExterior(ink, panes, width, height);
    const fade = readingLayout?.fade ?? null;
    const sceneryFade = readingLayout ? readingLayout.sceneryFade
      : (x, y) => attenuation(x, y, width, height, config.quietCenter);
    const scenery = { width, height, ratio, font: painter.font, palette: sceneryPalette,
      cellWidth: grid.cellWidth, cellHeight: grid.cellHeight, opacity: config.opacity, fade: sceneryFade };
    drawAtmosphere(ink, atmosphere, { ...scenery, wind: config.wind, clouds: config.clouds,
      dark: document.body.hasAttribute('data-ds-dark-theme') });
    if (config.ripples) drawWater(ink, water, scenery);
    const rainScenery = { ...scenery, dark: document.body.hasAttribute('data-ds-dark-theme'),
      reduced: reduced.matches,
      opacity: config.opacity * (reduced.matches ? (config.rain ? config.rainIntensity : 0) : 1) };
    drawRain(ink, rain, { ...rainScenery, phase: 'surface' });
    paintGlyphs(ink, fade);
    drawRain(ink, rain, { ...rainScenery, phase: 'fall' });
    spout.paint(ink, fade);
    if (config.activity) drawActivityBadges(ink, scene.whales, width, height, {
      dark: document.body.hasAttribute('data-ds-dark-theme'), opacity: config.opacity,
      fade: sceneryFade,
    });
    ink.restore();
    const readingMaterial = readingEffectTone(config.readingEffect, config.glassStrength, {
      dark: document.body.hasAttribute('data-ds-dark-theme'), reducedTransparency: reducedTransparency.matches,
    });
    const seaReady = prepareBlurredSea(readingMaterial);
    const readingOptions = { material: readingMaterial, source: seaReady ? blurredSea : null,
      sourceRect: [seaPad, seaPad, width / seaFactor, height / seaFactor] };
    // The demo card is the preview's stand-in for a DSH card: sharp sea is
    // clipped at its rounded edge, the body covers the open sea, the ordinary
    // glass pipeline stacks on the body, and text lines stay crisp on top.
    if (demo && (config.glass || config.composerAvoid)) {
      const card = demoCardRect();
      if (card) {
        paintDemoCardBody(card);
        paintGlassMaterial(seaReady);
        readingProtection.paint(ink, width, height, { ...readingOptions,
          underlay: document.body.hasAttribute('data-ds-dark-theme') ? DEMO_CARD_BODY_DARK : DEMO_CARD_BODY_LIGHT });
        paintDemoCardText(card);
      }
      return;
    }
    paintGlassMaterial(seaReady);
    readingProtection.paint(ink, width, height, readingOptions);
    clearForeground(ink, foreground, width, height);
    for (const media of sidebarForegrounds) clearForeground(ink, media, width, height);
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

  /**
   * The whole glass pipeline behind one guard: nothing to paint unless the
   * material is frost and there is a pane. This is the exact condition the draw
   * tail used to test inline (open water / clear mode / no pane), so the default
   * path paints the same calls in the same order as before; the demo card reuses
   * it between its card body and its text lines.
   */
  function prepareBlurredSea(readingMaterial) {
    const materials = [];
    if (tone?.mode === 'frost' && panes.length) {
      materials.push(tone);
      if (readingLayout.sidebarPanes.length) materials.push(readingLayout.sidebarTone);
    }
    if (readingProtection.active && readingMaterial.mode !== 'glow') materials.push(readingMaterial);
    if (!materials.length) return false;
    const shared = { ...materials[0], blur: Math.max(...materials.map(material => material.blur)) };
    if (!seaBuffers(shared)) return false;
    paintBlurredSea(shared);
    return true;
  }

  function paintGlassMaterial(seaReady) {
    if (!seaReady || !tone || tone.mode !== 'frost' || !panes.length) return;
    const { contentPanes, sidebarPanes, sidebarTone } = readingLayout;
    ink.save();
    // An overlay/fullscreen sidebar owns its entire rectangle, including any
    // conversation cards beneath it. Never stack two sea images there.
    glassClipExterior(ink, sidebarPanes, width, height);
    paintPaneSeaUnion(contentPanes, tone);
    for (const pane of contentPanes) paintPaneSurface(pane, tone);
    ink.restore();
    paintPaneSeaUnion(sidebarPanes, sidebarTone);
    for (const pane of sidebarPanes) {
      paintPaneSurface(pane, sidebarTone);
      ink.save();
      glassRoundedPath(ink, pane); ink.clip();
      const edge = ink.createLinearGradient(pane.x, 0, pane.x + 18, 0);
      edge.addColorStop(0, document.body.hasAttribute('data-ds-dark-theme')
        ? 'rgba(205, 222, 245, 0.12)' : 'rgba(255, 255, 255, 0.34)');
      edge.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ink.fillStyle = edge;
      ink.fillRect(pane.x, pane.y, Math.min(18, pane.width), pane.height);
      ink.restore();
    }
  }

  /** The demo card's own body: one near-opaque rounded fill under the glass. */
  function paintDemoCardBody(card) {
    glassRoundedPath(ink, { x: card.left, y: card.top, width: card.width, height: card.height, radius: card.radius });
    ink.fillStyle = document.body.hasAttribute('data-ds-dark-theme') ? DEMO_CARD_BODY_DARK : DEMO_CARD_BODY_LIGHT;
    ink.fill();
  }

  /**
   * Four grey text lines, the last one 70% wide — the "text stays crisp" half
   * of the demo. A card too short for four lines (the narrow-screen preview)
   * draws as many as fit instead of overlapping them.
   */
  function demoTextRegions(card) {
    const inner = Math.max(0, card.height - DEMO_LINE_INSET * 2);
    const count = Math.min(4, Math.floor(inner / DEMO_LINE_HEIGHT));
    if (count < 1 || !(card.width > DEMO_LINE_INSET * 2 + 2)) return [];
    const step = count > 1 ? (inner - DEMO_LINE_HEIGHT) / (count - 1) : 0;
    return Array.from({ length: count }, (_, line) => ({ x: card.left + DEMO_LINE_INSET,
      y: card.top + DEMO_LINE_INSET + step * line,
      width: (card.width - DEMO_LINE_INSET * 2) * (line === count - 1 ? 0.7 : 1),
      height: DEMO_LINE_HEIGHT, radius: DEMO_LINE_HEIGHT / 2 }));
  }

  function paintDemoCardText(card) {
    ink.fillStyle = document.body.hasAttribute('data-ds-dark-theme') ? DEMO_LINE_DARK : DEMO_LINE_LIGHT;
    for (const line of demoTextRegions(card)) { glassRoundedPath(ink, line); ink.fill(); }
  }

  function frame(now) {
    raf = 0;
    if (disposed || scrolling || document.hidden || reduced.matches || !width || !height || !scene) return;
    if (previous !== null) {
      simulation.advance(Math.min(0.1, (now - previous) / 1000));
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
    readingTextDirty = true;
    if (!disposed && !scrolling && !document.hidden && width && height) {
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
    const sceneRebuilt = simulation.update(next);
    Object.assign(config, next);

    if (sceneRebuilt) {
      scene = simulation.scene;
      poses = scene.whales.map(() => ({}));
      projected = scene.particles.map((_, particleIndex) => ({ particleIndex }));
      // A new scene starts without obstacles: put the already-measured card
      // back in front of it (margin follows the new body sizes), no DOM read.
      applySceneObstacles();
    }
    // A scene change also brings a new glyph alphabet (the user's body text), so
    // the painter is rebuilt for it as well — not only for font and style.
    if (sceneRebuilt || changes.metrics) {
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
      readingTextDirty = true;
      if (!scrolling && width && height) measure();
    }

    if (changes.palette) sceneryPalette = createInkPalette(config.color);
    if (viewport) resize();

    lastPaint = -Infinity;
    if (!scrolling && !document.hidden && width && height) {
      // Repaint one frame now, so a change is visible even while reduced motion
      // keeps the animation loop stopped; otherwise the loop simply continues.
      if (!reduced.matches && !raf) raf = requestAnimationFrame(frame);
      draw();
      lastPaint = performance.now();
    }
  }

  function finishScroll() {
    scrollTimer = 0;
    if (disposed) return;
    scrolling = false;
    // Repaint while hidden before showing the new mask. Reset the clock so the
    // pause never becomes a catch-up leap in the school or a dive.
    sync();
    if (canvas.style) {
      canvas.style.transition = reduced.matches ? 'none' : 'opacity 120ms ease-out';
      canvas.style.opacity = originalOpacity;
    }
  }

  /** Passive input handlers do no layout reads, text scans or Canvas drawing. */
  function onScroll(event) {
    if (demo || disposed || document.hidden || event?.ctrlKey) return;
    const target = event?.target;
    if (target && target !== document && target !== document.body && target !== document.documentElement
      && !readingRoots.some(root => root === target || root.contains?.(target))) return;
    measuredAt = -Infinity;
    readingTextDirty = true;
    if (!scrolling) {
      scrolling = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(foregroundRaf);
      raf = foregroundRaf = 0;
      previous = null;
      if (canvas.style) {
        canvas.style.transition = 'none';
        canvas.style.opacity = '0';
      }
    }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(finishScroll, SCROLL_IDLE_MS);
  }

  // Coalesce layout/content changes into one static redraw; scrolling owns the
  // quiet interval and consumes these invalidations only after it ends.
  function onForegroundChange() {
    measuredAt = -Infinity;
    readingTextDirty = true;
    if (disposed || scrolling || document.hidden || !reduced.matches || foregroundRaf) return;
    foregroundRaf = requestAnimationFrame(() => {
      foregroundRaf = 0;
      if (!disposed && !document.hidden) { draw(); lastPaint = performance.now(); }
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const displayWidth = Math.floor(rect.width), displayHeight = Math.floor(rect.height);
    const source = viewport?.();
    const visible = displayWidth > 0 && displayHeight > 0;
    const nextWidth = visible ? Math.max(1, Math.floor(source?.width ?? displayWidth)) : 0;
    const nextHeight = visible ? Math.max(1, Math.floor(source?.height ?? displayHeight)) : 0;
    const pixels = fitCanvas(displayWidth, displayHeight, window.devicePixelRatio);
    const scale = viewport && visible ? Math.min(displayWidth / nextWidth, displayHeight / nextHeight) : 1;
    const nextRatio = pixels.ratio * scale;
    const nextOffsetX = viewport ? (displayWidth - nextWidth * scale) * pixels.ratio / 2 : 0;
    const nextOffsetY = viewport ? (displayHeight - nextHeight * scale) * pixels.ratio / 2 : 0;
    if (width === nextWidth && height === nextHeight && canvas.width === pixels.width && canvas.height === pixels.height
      && ratio === nextRatio && offsetX === nextOffsetX && offsetY === nextOffsetY) return;
    width = nextWidth; height = nextHeight; ratio = nextRatio;
    offsetX = nextOffsetX; offsetY = nextOffsetY;
    canvas.width = pixels.width; canvas.height = pixels.height;
    ink.setTransform(ratio, 0, 0, ratio, offsetX, offsetY);
    grid = createDepthGrid(width, height, config.glyphSize, metrics);
    simulation.resize(width, height);
    measuredAt = -Infinity;
    sync();
  }

  const observer = new ResizeObserver(resize);
  const themeObserver = new MutationObserver(sync);
  const foregroundObserver = demo ? null : observeForeground(canvas, onForegroundChange);
  const readingObserver = demo ? null : new MutationObserver(records => {
    if (!records || records.some(record => record.target !== canvas)) onForegroundChange();
  });
  readingObserver?.observe(document.body, { childList: true, characterData: true, subtree: true,
    attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  observer.observe(canvas);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  reducedTransparency.addEventListener('change', sync);
  window.addEventListener('resize', resize);
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('wheel', onScroll, { capture: true, passive: true });
  document.addEventListener('touchmove', onScroll, { capture: true, passive: true });
  document.fonts?.addEventListener('loadingdone', onForegroundChange);
  document.addEventListener('transitionend', onForegroundChange, true);
  document.addEventListener('animationend', onForegroundChange, true);
  resize();
  function dispose() {
    spout.detach();
    simulation.dispose();
    disposed = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(foregroundRaf);
    foregroundRaf = 0;
    raf = 0;
    observer.disconnect();
    foregroundObserver?.dispose();
    readingObserver?.disconnect();
    readingProtection?.dispose();
    themeObserver.disconnect();
    document.removeEventListener('visibilitychange', sync);
    reduced.removeEventListener('change', sync);
    reducedTransparency.removeEventListener('change', sync);
    window.removeEventListener('resize', resize);
    document.removeEventListener('scroll', onScroll, true);
    document.removeEventListener('wheel', onScroll, true);
    document.removeEventListener('touchmove', onScroll, true);
    document.fonts?.removeEventListener('loadingdone', onForegroundChange);
    document.removeEventListener('transitionend', onForegroundChange, true);
    document.removeEventListener('animationend', onForegroundChange, true);
    clearTimeout(scrollTimer);
    scrollTimer = 0;
    readingRoots = [];
    if (canvas.style) {
      canvas.style.opacity = originalOpacity;
      canvas.style.transition = originalTransition;
    }
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
    readingLayout = null;
    foreground = null;
    sidebarForegrounds = [];
    canvas.width = canvas.height = 1;
  }
  function setActivity(snapshot) {
    if (disposed) return;
    simulation.setActivity(snapshot);
    if (!document.hidden && width && height) draw();
  }
  return { update, setActivity, dispose };
}

/** Backwards-compatible entry point: mounts a layer and returns its disposer. */
export function mountWhales(canvas, config) {
  const layer = createWhaleLayer(canvas, config);
  return () => layer.dispose();
}
