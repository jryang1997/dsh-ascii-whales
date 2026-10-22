import { createWhalePainter } from './surface.js';
import { createScene, resizeScene, stepScene, whalePose, projectParticle, createDepthGrid, resolveDepthGrid, fitCanvas, normalizeConfig } from './model.js';
import { adoptSceneState, setSceneObstacles } from './motion.js';
import { glassPanes, glassComposerPane, glassRoundedPath, glassTone, glassComposerTone, glassFrostSize, glassEdgeFade, glassDistance } from './glass.js';

// DSH publishes these hooks on the conversation subtree. Every one of them is
// optional: without them the whales simply paint as before, so an unknown
// layout can never break the background.
const FLOW_SELECTOR = '[data-chat-flow], [data-slot="conversation.chat.flow"]';
const SCROLL_SELECTOR = '[data-conversation-scroll]';
// The composer card is the rounded input itself; the seat is its sticky wrapper
// and is only used when the card hook is missing from the build.
const COMPOSER_CARD_SELECTOR = '[data-composer-card]';
const COMPOSER_SEAT_SELECTOR = '[data-composer-seat]';
const COMPOSER_RADIUS = 18;
const MEASURE_INTERVAL = 400;

// Which option belongs to which kind of work. A group only rebuilds its own
// part; `live` options are read straight from the config while painting, so
// changing one needs nothing more than the next frame.
const SCENE_KEYS = Object.freeze(['count', 'text', 'species', 'whaleSize']);
const METRIC_KEYS = Object.freeze(['glyphSize', 'fillMode', 'renderStyle']);
const PALETTE_KEYS = Object.freeze(['color']);
const GLASS_KEYS = Object.freeze(['glass', 'glassStrength']);
const COMPOSER_KEYS = Object.freeze(['composerGlass', 'composerAvoid']);
const LIVE_KEYS = Object.freeze(['enabled', 'speed', 'opacity', 'quietCenter', 'leftInset']);
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
 * The card's own corner radius, so the glass matches the input it covers.
 * A failed parse falls back to the DSH panel radius.
 */
function composerRadius(element) {
  try {
    const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius);
    return Number.isFinite(radius) && radius >= 0 ? radius : COMPOSER_RADIUS;
  } catch { return COMPOSER_RADIUS; }
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
export function createWhaleLayer(canvas, initialConfig) {
  const ink = canvas.getContext('2d');
  if (!ink) return { update() {}, dispose() {} };
  const config = normalizeLayerConfig(initialConfig);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  let scene = createScene(config.count, config.text, config.species, config.whaleSize);
  let poses = scene.whales.map(() => ({}));
  let projected = scene.particles.map((_, particleIndex) => ({ particleIndex }));
  let painter = createWhalePainter(scene, config);
  ink.font = painter.font;
  let metrics = measureGlyphs();
  let width = 0, height = 0, ratio = 1, grid = null;
  let frost = null, frostInk = null, blurScratch = null, blurInk = null, blurSupport = false;
  let panes = [], tone = null, composerPane = null, composerTone = null, composerCard = null;
  let avoidRect = null;
  let raf = 0, previous = null, lastPaint = -Infinity, measuredAt = -Infinity, disposed = false;

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

  function frostBuffer() {
    if (frostInk) return true;
    try {
      frost = document.createElement('canvas');
      frostInk = frost.getContext('2d');
      // Feature-detect the Gaussian blur once: older engines ignore the filter,
      // and the downsample alone still frosts, just more coarsely.
      frostInk.filter = 'blur(2px)';
      blurSupport = frostInk.filter === 'blur(2px)';
      frostInk.filter = 'none';
      if (blurSupport) {
        blurScratch = document.createElement('canvas');
        blurInk = blurScratch.getContext('2d');
        if (!blurInk) blurSupport = false;
      }
    } catch { frost = frostInk = null; }
    return Boolean(frostInk);
  }

  /** The cells and their glyphs share one fade at every reading-pane edge. */
  function paintGlyphs(target, fade = null) {
    painter.paint(target, grid, poses, width, height, ratio, fade, document.body.hasAttribute('data-ds-dark-theme'));
  }

  /**
   * Install the obstacle for the current scene from the card recorded by the
   * last measure. No DOM read: a scene rebuild only changes the school, so the
   * margin (which depends on the largest body) is refreshed without measuring.
   */
  function applyComposerObstacle() {
    if (!scene) return;
    if (!config.composerAvoid || !composerCard) { setSceneObstacles(scene, []); return; }
    let largest = 0;
    for (const whale of scene.whales) largest = Math.max(largest, Number(whale.bodyRadius) || 0);
    const obstacle = composerObstacle(composerCard.canvas, composerCard.card, largest);
    setSceneObstacles(scene, obstacle ? [obstacle] : []);
  }

  /**
   * Re-read the conversation geometry: reading column and/or input card.
   *
   * Cheap and only layout can change it, so it runs on a 400ms budget and on
   * every invalidation. The reading pane and the composer are measured
   * independently: either one alone must keep working.
   */
  function measure() {
    measuredAt = performance.now();
    panes = [];
    tone = null;
    composerPane = null;
    composerTone = null;
    composerCard = null;
    avoidRect = null;
    if (!width || !height || !scene || disposed) return;
    if (!config.glass && !config.composerGlass && !config.composerAvoid) {
      setSceneObstacles(scene, []);
      return;
    }
    const canvasRect = rectOf(canvas);
    if (!canvasRect) return;
    const dark = document.body.hasAttribute('data-ds-dark-theme');
    const material = { dark, reducedTransparency: reducedTransparency.matches };
    if (config.glass) {
      const scroll = pick(SCROLL_SELECTOR, canvasRect);
      const flow = pick(FLOW_SELECTOR, canvasRect);
      let column = flow ? flow.rect : null;
      if (!column && scroll) {
        const declared = parseFloat(getComputedStyle(scroll.element).getPropertyValue('--dsh-chat-content-width'));
        if (declared > 0) column = { left: scroll.rect.left + (scroll.rect.width - declared) / 2, top: scroll.rect.top, width: declared, height: scroll.rect.height };
      }
      panes = glassPanes({ canvas: canvasRect, viewport: scroll?.rect ?? null, column });
    }
    // The composer card is needed for both the glass and the avoidance, and the
    // card hook is preferred over its sticky seat wrapper.
    const composer = config.composerGlass || config.composerAvoid
      ? (pick(COMPOSER_CARD_SELECTOR, canvasRect) || pick(COMPOSER_SEAT_SELECTOR, canvasRect)) : null;
    if (composer) composerCard = { card: composer.rect, canvas: canvasRect };
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
    if (config.glass || config.composerGlass) {
      // 'clear' (reduced transparency) keeps the panes for the glyph hold-out but
      // paints no material, so the reading area stays free of the sea either way.
      tone = glassTone(config.glassStrength, { ...material, enabled: true });
      if (config.composerGlass) {
        composerTone = glassComposerTone(config.glassStrength, material);
        composerPane = composer
          ? glassComposerPane({ canvas: canvasRect, card: composer.rect, radius: composerRadius(composer.element) })
          : null;
      }
    }
    applyComposerObstacle();
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
    // panes still hold the glyphs out (that is what keeps the words over plain
    // sea), they just paint no tint, frost or rim on top of them.
    const frosted = Boolean(tone) && tone.mode === 'frost';
    const readingPanes = tone ? panes : [];
    const composer = tone ? composerPane : null;
    if (!readingPanes.length && !composer && !avoidRect) { paintGlyphs(ink); return; }
    const featherOf = pane => (pane.feather ?? tone.feather) || 26;
    // Glyphs hold out of every pane across that pane's own feather, so no whale
    // is cut by a line; the ramp keeps the body readable right up to the glass.
    paintGlyphs(ink, (x, y) => {
      // The input card is opaque to whale ink when avoidance is on (see avoidRect).
      if (avoidRect && x > avoidRect.x && x < avoidRect.x + avoidRect.width
        && y > avoidRect.y && y < avoidRect.y + avoidRect.height) return 0;
      let fade = 1;
      for (const pane of readingPanes) fade = Math.min(fade, glassEdgeFade(pane, x, y, featherOf(pane)));
      if (composer) fade = Math.min(fade, glassEdgeFade(composer, x, y, featherOf(composer)));
      return fade;
    });
    // Reading column first, input card second: the two panes overlap when both
    // are enabled, and the card material has to stay the top surface.
    if (!frosted) return;
    for (const pane of readingPanes) paintPane(pane, tone);
    if (composer) paintPane(composer, composerTone || tone);
  }

  /**
   * Frosted pane, built with no canvas readback and no second glyph pass.
   *
   * The whale's silhouette is what a pane really hides: at 11px the glyph strokes
   * would blur into noise, so the pane is filled from the depth grid as
   * overlapping cell blobs. Those go into a buffer several times smaller than the
   * pane; the blur runs inside that small buffer, so its cost is independent of
   * the window size, and the upscale finishes the smear.
   */
  function paintPane(panel, material) {
    if (!material || material.mode !== 'frost' || !frostBuffer()) return;
    const scale = glassFrostSize(panel.width, panel.height, material.scale);
    const pad = 2;
    const buffer = { width: scale.width + pad * 2, height: scale.height + pad * 2 };
    if (frost.width !== buffer.width || frost.height !== buffer.height) {
      frost.width = buffer.width;
      frost.height = buffer.height;
    }
    const s = scale.factor;
    frostInk.setTransform(1, 0, 0, 1, 0, 0);
    if (blurSupport) frostInk.filter = 'none';
    frostInk.clearRect(0, 0, buffer.width, buffer.height);
    frostInk.setTransform(1 / s, 0, 0, 1 / s, -panel.x / s + pad, -panel.y / s + pad);
    paintSilhouette(frostInk, panel, material);
    frostInk.setTransform(1, 0, 0, 1, 0, 0);
    // Blur inside the small buffer. The radius is divided by the downsample
    // factor, so the frost looks the same at any window size while the cost
    // stays proportional to the small buffer instead of the full pane.
    if (blurSupport) {
      frostInk.filter = `blur(${Math.max(0.4, material.blur / s).toFixed(2)}px)`;
      const copy = blurScratch;
      if (copy.width !== buffer.width || copy.height !== buffer.height) {
        copy.width = buffer.width; copy.height = buffer.height;
      }
      const copyInk = blurInk;
      copyInk.setTransform(1, 0, 0, 1, 0, 0);
      copyInk.clearRect(0, 0, buffer.width, buffer.height);
      copyInk.filter = frostInk.filter;
      copyInk.drawImage(frost, 0, 0);
      frostInk.filter = 'none';
      frostInk.clearRect(0, 0, buffer.width, buffer.height);
      frostInk.drawImage(copy, 0, 0);
    }

    ink.save();
    glassRoundedPath(ink, panel);
    ink.clip();
    ink.fillStyle = `rgba(${material.tint}, ${material.veil})`;
    ink.fillRect(panel.x, panel.y, panel.width, panel.height);
    ink.imageSmoothingEnabled = true;
    ink.imageSmoothingQuality = 'high';
    ink.globalAlpha = material.mist;
    ink.drawImage(frost, pad, pad, scale.width, scale.height, panel.x, panel.y, panel.width, panel.height);
    ink.globalAlpha = 1;
    // Light on the rim: a bright band at the top that fades out, and a shade at
    // the bottom that fades in. Gradients keep the pane from looking framed.
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
    glassRoundedPath(ink, panel);
    ink.lineWidth = 1;
    ink.strokeStyle = material.stroke;
    ink.stroke();
  }

  /**
   * The whale's silhouette, as what a pane really hides: bodies become pale
   * shapes, never letters (at 11px the strokes would blur into noise anyway).
   *
   * Cells are filled at full strength and slightly overlapped so contiguous
   * cells merge into one body instead of a grid of dots; the low-resolution
   * buffer plus the upscale supply the blur. Near the rim the shape fades out
   * over the same feather the sharp glyphs use outside, so a whale crossing the
   * pane edge dissolves instead of being cut by a straight line.
   */
  function paintSilhouette(target, panel, material) {
    target.fillStyle = `rgb(${material.silhouette})`;
    const over = grid.cellWidth * 0.22;
    for (let cell = 0; cell < grid.owners.length; cell++) {
      if (grid.owners[cell] < 0) continue;
      const visibility = grid.visibility[cell];
      if (visibility < 0.05) continue;
      const x = grid.centersX[cell], y = grid.centersY[cell];
      // The opaque input card (avoidance mode) hides the silhouette as well: a
      // pane drawn over the card must not carry a whale shape onto it.
      if (avoidRect && x > avoidRect.x && x < avoidRect.x + avoidRect.width
        && y > avoidRect.y && y < avoidRect.y + avoidRect.height) continue;
      // Only cells inside the pane are painted; the feather ramps them in. The
      // pane's own feather wins (it carries the composer's short band); the
      // reading column has none, so its material feather applies.
      const depthInside = -glassDistance(panel, x, y);
      if (depthInside <= 0) continue;
      const ramp = Math.min(1, depthInside / Math.max(1, panel.feather ?? material.feather));
      target.globalAlpha = Math.min(1, visibility * ramp * ramp * (3 - 2 * ramp));
      target.fillRect(x - grid.cellWidth / 2 - over, y - grid.cellHeight / 2 - over,
        grid.cellWidth + over * 2, grid.cellHeight + over * 2);
    }
    target.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (disposed || document.hidden || reduced.matches || !width || !height || !scene) return;
    if (previous !== null) stepScene(scene, Math.min(0.1, (now - previous) / 1000), config.speed);
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
    Object.assign(config, next);

    if (changes.scene) {
      const previousScene = scene;
      const replacement = createScene(config.count, config.text, config.species, config.whaleSize);
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
      applyComposerObstacle();
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
    // measured card through applyComposerObstacle above.
    if (changes.glass || changes.composer) {
      measuredAt = -Infinity;
      if (width && height) measure();
    }

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
    frost = frostInk = blurScratch = blurInk = null;
    panes = [];
    tone = null;
    composerPane = null;
    composerTone = null;
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
