import { createWhalePainter } from './surface.js';
import { createScene, resizeScene, stepScene, whalePose, projectParticle, createDepthGrid, resolveDepthGrid, fitCanvas, normalizeConfig, attenuation } from './model.js';
import { adoptSceneState, setSceneObstacles } from './motion.js';
import { glassContentPanes, glassContentTone, glassRoundedPath, glassRoundedSubpath, glassTone, glassSeaFactor, glassSeaBuffer, glassEdgeFade } from './glass.js';
import { attachSpout } from './spout.js';
import { createReefField, resizeReefField, reefObstacles, drawReefs } from './reef.js';
import { createWaterField, resetWaterField, stepWater, drawWater } from './water.js';
import { createInkPalette } from './shading.js';

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
export function diffWhaleConfig(previous, next) {
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
export function createWhaleLayer(canvas, initialConfig, options = {}) {
  const ink = canvas.getContext('2d');
  if (!ink) return { update() {}, dispose() {} };
  const config = normalizeLayerConfig(initialConfig);
  // Optional preview injection: `demoCard` places one card by canvas ratios
  // (0..1) with a pixel radius. With it, measure() never reads the DOM — the
  // settings preview has no conversation hooks to find, yet the glass and
  // avoidance options still need a card to act on. Without it every path below
  // is byte-for-byte the default one; Overlay and the standalone preview never
  // pass a third argument.
  const demo = options.demoCard || null;
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

  /** The demo card as a pixel rectangle for the current canvas size. */
  function demoCardRect() {
    if (!demo || !width || !height) return null;
    const left = demo.x * width, top = demo.y * height;
    const cardWidth = demo.width * width, cardHeight = demo.height * height;
    if (!(cardWidth >= 1) || !(cardHeight >= 1)) return null;
    return { left, top, width: cardWidth, height: cardHeight,
      radius: Number.isFinite(demo.radius) ? demo.radius : 0 };
  }

  /**
   * Preview measurement: the injected ratios replace every DOM read. The card
   * is both the one glass pane and the avoidance target, so those two options
   * show their real effect inside the settings preview; with both off the sea
   * is simply open water and nothing is painted for the card. Resizes need no
   * extra bookkeeping: every resize invalidates the measurement, and the ratios
   * are re-applied to the new canvas size.
   */
  function measureDemoCard() {
    const card = demoCardRect();
    if (card && config.glass) {
      panes = glassContentPanes({ canvas: { left: 0, top: 0, width, height }, boxes: [card], max: 1 });
      tone = glassContentTone(config.glassStrength,
        { dark: document.body.hasAttribute('data-ds-dark-theme'), reducedTransparency: reducedTransparency.matches });
    }
    if (card && config.composerAvoid) {
      // Same shapes as the real composer: the margin obstacle steers the
      // school, and the 8px rectangle guarantees no ink on the card even from
      // a transiently bent fluke.
      composerCard = { card, canvas: { left: 0, top: 0, width, height } };
      const left = Math.max(0, card.left - 8);
      const top = Math.max(0, card.top - 8);
      const right = Math.min(width, card.left + card.width + 8);
      const bottom = Math.min(height, card.top + card.height + 8);
      avoidRect = right - left > 0 && bottom - top > 0
        ? { x: left, y: top, width: right - left, height: bottom - top } : null;
    }
    applySceneObstacles();
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
    if (demo) { measureDemoCard(); return; }
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
    // The demo card is the preview's stand-in for a DSH card: whale ink is
    // already held out of it by the fade above, the card body covers the open
    // sea, the ordinary glass pipeline stacks on the body, and the text lines
    // stay crisp on top — the same composite the real overlay produces over
    // the DOM. Avoidance mode skips the material and keeps body plus lines.
    if (demo && (config.glass || config.composerAvoid)) {
      const card = demoCardRect();
      if (card) {
        paintDemoCardBody(card);
        paintGlassMaterial();
        paintDemoCardText(card);
      }
      return;
    }
    paintGlassMaterial();
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
  function paintGlassMaterial() {
    if (!tone || tone.mode !== 'frost' || !panes.length) return;
    if (!seaBuffers(tone)) return;
    paintBlurredSea(tone);
    // One shared sea image for every pane, then the cheap per-pane surface work.
    paintPaneSeaUnion(panes, tone);
    for (const pane of panes) paintPaneSurface(pane, tone);
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
  function paintDemoCardText(card) {
    const inner = Math.max(0, card.height - DEMO_LINE_INSET * 2);
    const count = Math.min(4, Math.floor(inner / DEMO_LINE_HEIGHT));
    if (count < 1 || !(card.width > DEMO_LINE_INSET * 2 + 2)) return;
    const step = count > 1 ? (inner - DEMO_LINE_HEIGHT) / (count - 1) : 0;
    ink.fillStyle = document.body.hasAttribute('data-ds-dark-theme') ? DEMO_LINE_DARK : DEMO_LINE_LIGHT;
    for (let line = 0; line < count; line++) {
      const width = (card.width - DEMO_LINE_INSET * 2) * (line === count - 1 ? 0.7 : 1);
      glassRoundedPath(ink, {
        x: card.left + DEMO_LINE_INSET,
        y: card.top + DEMO_LINE_INSET + step * line,
        width, height: DEMO_LINE_HEIGHT, radius: DEMO_LINE_HEIGHT / 2,
      });
      ink.fill();
    }
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
export function mountWhales(canvas, config) {
  const layer = createWhaleLayer(canvas, config);
  return () => layer.dispose();
}
