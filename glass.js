// Frosted glass over every opaque content box in the conversation, plus the
// input card. Pure geometry, tone and buffer arithmetic; reading-layout.js
// owns layout policy and engine.js paints the result.

// A pane equal to its box: only boxes too small to hold readable text are
// dropped, so the glass can never sit inside the box it covers.
const GLASS_CONTENT_MIN_WIDTH = 40;
const GLASS_CONTENT_MIN_HEIGHT = 24;
// A 10px ramp keeps the sharp glyphs dissolving into the glass right at the box
// edge without leaving a visible straight cut.
const GLASS_CONTENT_FEATHER = 10;
const GLASS_CONTENT_MAX = 16;
// Two boxes with every edge within 2px are the same surface seen twice (e.g. a
// wrapper and the card inside it); the first one wins.
const GLASS_CONTENT_EDGE_TOLERANCE = 2;
// An inner box inset by this much on every side is real nesting (a code block
// inside a card) and gets its own glass; anything tighter is the same frame.
const GLASS_CONTENT_NEST_INSET = 6;
// The reading-pane crest was a 22–32px bright band, far too heavy for a 100px
// card: every content box uses the input card's quarter-strength highlight.
const GLASS_CONTENT_CREST_SCALE = 0.22;
// The bottom shade is the darkest layer in the contrast budget; softening it for
// a card keeps the last line of text above the AA floor.
const GLASS_CONTENT_SHADE_SCALE = 0.45;
// How much of the blurred sea shows through. 30–36% keeps the whale legible as a
// frosted shape while the contrast test holds body text at ≥4.5:1 even over the
// darkest cell tile.
const GLASS_CONTENT_MIST_BASE = 0.30;
const GLASS_CONTENT_MIST_RANGE = 0.06;

const glassClamp = (value, low, high) => value < low ? low : value > high ? high : value;

/**
 * One pane per opaque content box, in canvas coordinates.
 *
 * `boxes` are page rectangles from `getBoundingClientRect` plus each box's own
 * computed corner radius. A pane is *exactly* the box clipped to the canvas —
 * never inset, never padded — so its corner radius and edges line up with the
 * DOM box and there is no second, smaller rounded frame to notice.
 *
 * Near-identical boxes collapse to the first one; a genuinely nested box (a card
 * inside a card) keeps its own pane, marked `nested`; more boxes than `max` are
 * cut down to the largest ones while keeping document order for painting.
 *
 * @returns {Array<{x:number,y:number,width:number,height:number,radius:number,feather:number,nested:boolean}>}
 */
export function glassContentPanes({ canvas, boxes, max = GLASS_CONTENT_MAX } = {}) {
  if (!canvas || !(canvas.width > 0) || !(canvas.height > 0) || !Array.isArray(boxes)) return [];
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : GLASS_CONTENT_MAX;
  const clipped = [];
  for (const box of boxes) {
    if (!box) continue;
    const left = Number(box.left), top = Number(box.top);
    const boxWidth = Number(box.width), boxHeight = Number(box.height);
    if (![left, top, boxWidth, boxHeight].every(Number.isFinite)) continue;
    if (!(boxWidth >= GLASS_CONTENT_MIN_WIDTH) || !(boxHeight >= GLASS_CONTENT_MIN_HEIGHT)) continue;
    const x = Math.max(0, left - canvas.left);
    const y = Math.max(0, top - canvas.top);
    const right = Math.min(canvas.width, left - canvas.left + boxWidth);
    const bottom = Math.min(canvas.height, top - canvas.top + boxHeight);
    const width = right - x, height = bottom - y;
    if (!(width >= 1) || !(height >= 1)) continue;
    clipped.push({ x, y, width, height,
      radius: glassClamp(Number.isFinite(Number(box.radius)) ? Number(box.radius) : 0, 0, Math.min(width, height) / 2),
      feather: GLASS_CONTENT_FEATHER });
  }
  // Same surface measured twice: every edge within the tolerance.
  const unique = [];
  for (const pane of clipped) {
    const duplicate = unique.some(other => Math.abs(pane.x - other.x) <= GLASS_CONTENT_EDGE_TOLERANCE
      && Math.abs(pane.y - other.y) <= GLASS_CONTENT_EDGE_TOLERANCE
      && Math.abs((pane.x + pane.width) - (other.x + other.width)) <= GLASS_CONTENT_EDGE_TOLERANCE
      && Math.abs((pane.y + pane.height) - (other.y + other.height)) <= GLASS_CONTENT_EDGE_TOLERANCE);
    if (!duplicate) unique.push(pane);
  }
  // Over the budget, keep the largest boxes but draw in document order so an
  // outer card is always painted before the card nested inside it.
  let kept = unique;
  if (unique.length > limit) {
    kept = unique
      .map((pane, index) => ({ pane, index }))
      .sort((a, b) => b.pane.width * b.pane.height - a.pane.width * a.pane.height || a.index - b.index)
      .slice(0, limit)
      .sort((a, b) => a.index - b.index)
      .map(entry => entry.pane);
  }
  for (const pane of kept) {
    pane.nested = kept.some(other => other !== pane
      && pane.x >= other.x + GLASS_CONTENT_NEST_INSET
      && pane.y >= other.y + GLASS_CONTENT_NEST_INSET
      && pane.x + pane.width <= other.x + other.width - GLASS_CONTENT_NEST_INSET
      && pane.y + pane.height <= other.y + other.height - GLASS_CONTENT_NEST_INSET);
  }
  return kept;
}

/**
 * Append one rounded rectangle to the current path (no beginPath).
 *
 * Several boxes can be appended to one path and clipped together: the clip is
 * then the union of the rounded rectangles, so a single shared image can be
 * drawn for all panes while the gaps *between* boxes stay outside the union and
 * remain uncovered.
 */
export function glassRoundedSubpath(ctx, rect) {
  const { x, y, width, height } = rect;
  const radius = Math.max(0, Math.min(rect.radius, width / 2, height / 2));
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

/** Trace a rounded rectangle; callers decide whether to fill, stroke or clip. */
export function glassRoundedPath(ctx, rect) {
  ctx.beginPath();
  glassRoundedSubpath(ctx, rect);
}

/**
 * Material for one strength setting.
 *
 * The pane is composited *above* the DOM text — the whale canvas lives in DSH's
 * overlay layer — so every layer here is also a contrast cost for the words
 * underneath. `mist` (the blurred sea) and `veil` (a flat tint) are the two
 * layers that carry visible colour; the top crest and bottom shade shape the
 * glass edge. There is deliberately no rim colour here: the outline belongs to
 * the DOM card, never to this canvas (see paintContentPane).
 *
 * test 'the pane keeps body text above the AAA contrast threshold' computes the
 * worst case for both themes and fails if any strength drops below 7:1.
 */
export function glassTone(strength = 0.55, { dark = false, reducedTransparency = false, enabled = true,
  crestScale = 1, compact = false } = {}) {
  const s = glassClamp(Number.isFinite(strength) ? strength : 0.55, 0, 1);
  if (!enabled || reducedTransparency) return { mode: 'clear', strength: s, feather: compact ? 12 : 26 };
  return {
    mode: 'frost',
    strength: s,
    scale: Math.round(3 + 4 * s),
    blur: 8 + 12 * s,
    mist: 0.24 + 0.06 * s,
    veil: dark ? 0.045 + 0.005 * s : 0.033 + 0.002 * s,
    tint: dark ? '20, 21, 24' : '255, 255, 255',
    silhouette: dark ? '120, 135, 158' : '160, 178, 200',
    crest: `rgba(255, 255, 255, ${(dark ? 0.06 + 0.05 * s : 0.52 + 0.34 * s) * crestScale})`,
    shade: dark ? `rgba(0, 0, 0, ${0.14 + 0.16 * s})` : `rgba(30, 43, 58, ${0.045 + 0.05 * s})`,
    crestHeight: compact ? Math.min(18, 8 + 4 * s) : 22 + 10 * s,
    shadeHeight: compact ? Math.min(18, 10 + 4 * s) : 20 + 12 * s,
    feather: compact ? 12 + 4 * s : 26 + 12 * s,
  };
}

/**
 * Material for a content box.
 *
 * Same contrast budget as the reading pane (identical tint and silhouette), with
 * the changes a card demands: the blurred sea carries real colour (mist), so it
 * is capped below the level that would push body text under 4.5:1; the top
 * highlight is cut to a quarter and capped, so it cannot land on the first line
 * of text as a bright bar; and the bottom shade is softened.
 *
 * No outline is produced: the frame is DSH's own, and painting a second rim here
 * made the corners read as two different radii (T3). The material only ever
 * fills inside the card's own rounded clip.
 * The whole budget is asserted in content-glass.test.js, band by band.
 */
export function glassContentTone(strength = 0.55, options = {}) {
  const tone = glassTone(strength, { ...options, crestScale: GLASS_CONTENT_CREST_SCALE, compact: true });
  if (tone.mode !== 'frost') return tone;
  const s = tone.strength;
  const dark = Boolean(options.dark);
  return {
    ...tone,
    mist: GLASS_CONTENT_MIST_BASE + GLASS_CONTENT_MIST_RANGE * s,
    blur: 9 + 12 * s,
    shade: dark
      ? `rgba(0, 0, 0, ${(0.14 + 0.16 * s) * GLASS_CONTENT_SHADE_SCALE})`
      : `rgba(30, 43, 58, ${(0.045 + 0.05 * s) * GLASS_CONTENT_SHADE_SCALE})`,
  };
}

/**
 * Downsampling factor for the shared blurred sea, 4–6 depending on strength.
 *
 * One buffer is built per frame for all panes: the number of panes changes the
 * number of draw calls, never the blur cost.
 */
export function glassSeaFactor(strength = 0.55) {
  const s = glassClamp(Number.isFinite(strength) ? strength : 0.55, 0, 1);
  return glassClamp(Math.round(4 + 2 * s), 4, 6);
}

/**
 * Size of the shared blurred-sea buffer, in low-resolution pixels.
 *
 * The buffer covers the whole canvas (so every pane slices the same image) with
 * a padding band wide enough that the Gaussian blur has real pixels to pull in
 * from outside the pane, which keeps pane edges from darkening.
 */
export function glassSeaBuffer(width, height, { factor = 4, blur = 12 } = {}) {
  const sourceWidth = Math.max(1, Math.floor(Number.isFinite(width) ? width : 1));
  const sourceHeight = Math.max(1, Math.floor(Number.isFinite(height) ? height : 1));
  const f = glassClamp(Number.isFinite(factor) ? Math.round(factor) : 4, 2, 8);
  const blurPx = Math.max(0, Number.isFinite(blur) ? blur : 0);
  const blurRadius = blurPx / f;
  const pad = Math.max(2, Math.ceil(blurRadius * 3) + 2);
  return { factor: f, pad, blurRadius,
    width: Math.ceil(sourceWidth / f) + pad * 2,
    height: Math.ceil(sourceHeight / f) + pad * 2 };
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
 * 0 inside the pane (the frosted sea owns it), ramping to 1 across `feather`
 * pixels outside it. Without the ramp a whale crossing the pane edge would be
 * cut off in a straight line; with it the body dissolves into the glass.
 */
export function glassEdgeFade(rect, x, y, feather = 26) {
  const inside = -glassDistance(rect, x, y);
  if (inside >= 0) return 0;
  const t = glassClamp(-inside / Math.max(1, feather), 0, 1);
  return t * t * (3 - 2 * t);
}
