// A rounded water-glass pane behind the reading column. Everything here is pure
// geometry and tone so the tests can drive it without a DOM or a Canvas;
// engine.js supplies the measured rectangles and paints the result.
//
// build.mjs concatenates the renderer modules into one factory, so no top-level
// name may collide with model.js (which owns `clamp`, `mix`, `smooth`, `noise`
// and the other short helpers). Every helper here is prefixed with `glass`.

const GLASS_PAD = 20;
const GLASS_RADIUS = 24;
const GLASS_GUTTER = 12;
const GLASS_TOP_GAP = 8;
const GLASS_MIN_WIDTH = 340;
const GLASS_MIN_HEIGHT = 240;
const GLASS_FALLBACK_CLEARANCE = 172;
const GLASS_DEFAULT_COLUMN = 748;
// The composer card is a much smaller target than the reading column: a pane
// narrower than this would read as a stripe, so those cards opt out.
const GLASS_COMPOSER_MIN_WIDTH = 60;
const GLASS_COMPOSER_MIN_HEIGHT = 36;
const GLASS_COMPOSER_RADIUS = 18;
// Glyphs dissolve earlier around the input box than around the reading column:
// the card edge is close to the words, so a wide feather would erase the body
// before it even reaches the glass.
const GLASS_COMPOSER_FEATHER = 14;
// The reading-pane crest is a wide, bright band meant for a large pane. Over a
// 120px input card it would sit right on the first line of text, so the composer
// material keeps under a quarter of that highlight (and a short band). The value
// is set as low as the AA contrast assertion in composer.test.js permits: with a
// full crest the worst case (light theme, strength 1) drops to 2.7:1, and 0.22
// keeps every layer — body, crest and bottom shade — at or above 4.5:1.
const GLASS_COMPOSER_CREST_SCALE = 0.22;

const glassClamp = (value, low, high) => value < low ? low : value > high ? high : value;

/**
 * Rounded pane around the text column, in canvas coordinates.
 *
 * `canvas` is the whale canvas, `viewport` the conversation scroller, `column`
 * the chat flow and `footer` the composer seat. A missing viewport falls back to
 * the whole canvas and a missing column to a centred default width, so an
 * unknown DSH layout still yields a sane pane instead of none.
 *
 * @returns {{x:number,y:number,width:number,height:number,radius:number}|null}
 */
export function glassPanel({ canvas, viewport = null, column = null,
  pad = GLASS_PAD, radius = GLASS_RADIUS, gutter = GLASS_GUTTER } = {}) {
  if (!canvas || !(canvas.width > 0) || !(canvas.height > 0)) return null;
  const area = viewport && viewport.width > 0 && viewport.height > 0 ? viewport : canvas;
  // Only the part of the scroller the sea actually covers may hold the pane.
  const left = Math.max(area.left, canvas.left) - canvas.left + gutter;
  const right = Math.min(area.left + area.width, canvas.left + canvas.width) - canvas.left - gutter;
  const top = Math.max(area.top, canvas.top) - canvas.top + GLASS_TOP_GAP;
  const bottom = Math.min(area.top + area.height, canvas.top + canvas.height) - canvas.top - gutter;
  const room = right - left;
  if (!(room >= GLASS_MIN_WIDTH) || !(bottom - top >= GLASS_MIN_HEIGHT)) return null;
  const columnWidth = column && column.width > 0 ? Math.min(column.width, room) : Math.min(GLASS_DEFAULT_COLUMN, room * 0.64);
  const centre = column && column.width > 0 ? column.left + column.width / 2 - canvas.left : (left + right) / 2;
  const width = Math.min(columnWidth + pad * 2, room);
  if (width < GLASS_MIN_WIDTH) return null;
  const x = glassClamp(centre - width / 2, left, right - width);
  const height = bottom - top;
  if (!(height >= GLASS_MIN_HEIGHT)) return null;
  return { x, y: top, width, height, radius: Math.min(radius, width / 2, height / 2) };
}

/**
 * One sheet of glass over the whole reading column, composer included.
 *
 * The composer is as much a place for words as the transcript is, and its card
 * has its own opaque fill, so a single pane running to the bottom of the viewport
 * covers both. Splitting them would leave a stripe of bare sea between the two
 * and make the material read as two bands instead of one surface.
 *
 * @returns {Array<{x:number,y:number,width:number,height:number,radius:number}>}
 */
export function glassPanes({ canvas, viewport = null, column = null,
  pad = GLASS_PAD, radius = GLASS_RADIUS, gutter = GLASS_GUTTER } = {}) {
  const pane = glassPanel({ canvas, viewport, column, pad, radius, gutter });
  return pane ? [pane] : [];
}

/**
 * Rounded pane over the input card, in canvas coordinates.
 *
 * `card` and `canvas` are both page rectangles (`getBoundingClientRect` results):
 * the card is translated into the canvas and then clipped to it, so the pane can
 * never paint outside the sea even when the composer is half scrolled away. The
 * card is the whole target here: no padding, because the card's own rounded
 * background is exactly the shape whose text the glass sits above.
 *
 * Cards too small to hold readable text (or entirely off the canvas) opt out.
 *
 * @returns {{x:number,y:number,width:number,height:number,radius:number,feather:number}|null}
 */
export function glassComposerPane({ canvas, card, radius = GLASS_COMPOSER_RADIUS } = {}) {
  if (!canvas || !card || !(canvas.width > 0) || !(canvas.height > 0)) return null;
  if (!(card.width >= GLASS_COMPOSER_MIN_WIDTH) || !(card.height >= GLASS_COMPOSER_MIN_HEIGHT)) return null;
  const left = card.left - canvas.left, top = card.top - canvas.top;
  const x = Math.max(0, left), y = Math.max(0, top);
  const right = Math.min(canvas.width, left + card.width);
  const bottom = Math.min(canvas.height, top + card.height);
  const width = right - x, height = bottom - y;
  // Entirely outside the sea: nothing to frost and no geometry to report.
  if (!(width >= 1) || !(height >= 1)) return null;
  return { x, y, width, height,
    radius: glassClamp(Number.isFinite(radius) ? radius : GLASS_COMPOSER_RADIUS, 0, Math.min(width / 2, height / 2)),
    feather: GLASS_COMPOSER_FEATHER };
}

/** Trace a rounded rectangle; callers decide whether to fill, stroke or clip. */
export function glassRoundedPath(ctx, rect) {
  const { x, y, width, height } = rect;
  const radius = Math.max(0, Math.min(rect.radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/**
 * Material for one strength setting.
 *
 * The pane is composited *above* the DOM text — the whale canvas lives in DSH's
 * overlay layer — so every layer here is also a contrast cost for the words
 * underneath, and the budget is tight: a 0.5 alpha fill over body text collapses
 * black-on-white from 21:1 to about 3:1 no matter which colour it uses.
 *
 * So the pane is built the other way round. `mist` is hard-capped low and only
 * tints the surface; the material reads from what sits at the edges instead —
 * the rim stroke, the light band along the top, the shade along the bottom, and
 * the fact that everything behind the pane is blurred. The whale still shows as a
 * pale shape, because that is what a real pane leaves of what lies beneath it.
 *
 * test 'the pane keeps body text above the AAA contrast threshold' computes the
 * worst case for both themes and fails if any strength drops below 7:1.
 */
export function glassTone(strength = 0.55, { dark = false, reducedTransparency = false, enabled = true,
  crestScale = 1, compact = false } = {}) {
  const s = glassClamp(Number.isFinite(strength) ? strength : 0.55, 0, 1);
  if (!enabled || reducedTransparency) return { mode: 'clear', strength: s, feather: compact ? GLASS_COMPOSER_FEATHER : 26 };
  return {
    mode: 'frost',
    strength: s,
    scale: Math.round(3 + 4 * s),
    blur: 8 + 12 * s,
    mist: 0.24 + 0.06 * s,
    veil: dark ? 0.045 + 0.005 * s : 0.033 + 0.002 * s,
    tint: dark ? '20, 21, 24' : '255, 255, 255',
    // A thicker pane hides what is behind it a little more, but the visible range
    // is narrow: the whale tint is the largest layer in the pane and the one that
    // sets the text-contrast floor. It is set at the top of that budget, so more
    // strength buys blur and rim definition rather than a deeper silhouette.
    silhouette: dark ? '120, 135, 158' : '160, 178, 200',
    stroke: dark ? `rgba(255, 255, 255, ${0.14 + 0.10 * s})` : `rgba(24, 34, 48, ${0.11 + 0.07 * s})`,
    crest: `rgba(255, 255, 255, ${(dark ? 0.06 + 0.05 * s : 0.52 + 0.34 * s) * crestScale})`,
    shade: dark ? `rgba(0, 0, 0, ${0.14 + 0.16 * s})` : `rgba(30, 43, 58, ${0.045 + 0.05 * s})`,
    crestHeight: compact ? Math.min(18, 8 + 4 * s) : 22 + 10 * s,
    shadeHeight: compact ? Math.min(18, 10 + 4 * s) : 20 + 12 * s,
    feather: compact ? 12 + 4 * s : 26 + 12 * s,
  };
}

/**
 * Material for the input card.
 *
 * Same contrast budget as the reading pane (identical tint, veil, mist and
 * silhouette), because both sit above words. The only differences are the ones
 * the card demands: a short pane needs a short top highlight — a 22–32px bright
 * band would land on the first line of the message — so the crest is cut to a
 * quarter and capped, and glyphs dissolve over the composer's own short feather.
 * The WCAG worst case including that crest is asserted in composer.test.js.
 */
export function glassComposerTone(strength = 0.55, options = {}) {
  return glassTone(strength, { ...options, crestScale: GLASS_COMPOSER_CREST_SCALE, compact: true });
}

/**
 * Crop of the pane region used for the frost pass, in CSS pixels.
 *
 * Only this rectangle is copied into the small buffer, so the per-frame cost is
 * a fraction of the sea instead of a full-canvas resample. The clip keeps the
 * copy inside the canvas even when the pane is partly scrolled off.
 */
export function glassFrostRegion(panel, width, height) {
  if (!panel || !(width > 0) || !(height > 0)) return null;
  const x = glassClamp(panel.x, 0, width);
  const y = glassClamp(panel.y, 0, height);
  const right = glassClamp(panel.x + panel.width, 0, width);
  const bottom = glassClamp(panel.y + panel.height, 0, height);
  if (!(right - x >= 1) || !(bottom - y >= 1)) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Signed distance from a point to a rounded rectangle, in CSS pixels:
 * negative inside, positive outside, zero on the edge. The renderer uses one
 * number for two decisions, so a glyph can never fall between "outside the
 * shape" and "inside the shape" and vanish from both layers.
 */
export function glassDistance(rect, x, y) {
  const radius = Math.max(0, Math.min(rect.radius, rect.width / 2, rect.height / 2));
  const halfWidth = rect.width / 2 - radius, halfHeight = rect.height / 2 - radius;
  const qx = Math.abs(x - (rect.x + rect.width / 2)) - halfWidth;
  const qy = Math.abs(y - (rect.y + rect.height / 2)) - halfHeight;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** True when a point falls inside the rounded rectangle. */
export function glassContains(rect, x, y) {
  return glassDistance(rect, x, y) <= 0;
}

/**
 * How much of a sharp glyph survives at this point.
 *
 * 0 inside the pane (the frost owns it), ramping to 1 across `feather` pixels
 * outside it. Without the ramp a whale crossing the pane edge would be cut off
 * in a straight line; with it the body dissolves into the glass.
 */
export function glassEdgeFade(rect, x, y, feather = 26) {
  const inside = -glassDistance(rect, x, y);
  if (inside >= 0) return 0;
  const t = glassClamp(-inside / Math.max(1, feather), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Downsampled frost buffer size for one source canvas and tone.
 *
 * This is the fallback used when the canvas cannot blur for us: copy the pane a
 * few times smaller and let the upscale do the smearing. The factor is kept low
 * enough that the shape survives, high enough that no glyph edges show.
 */
export function glassFrostSize(width, height, scale) {
  const wanted = Number.isFinite(scale) ? Math.round(scale) : 4;
  const factor = glassClamp(wanted, 2, 8);
  return { factor, width: Math.max(2, Math.ceil(width / factor)), height: Math.max(2, Math.ceil(height / factor)) };
}


