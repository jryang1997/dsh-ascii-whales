// The squared sea: every character cell of the water gets a faint frame, so
// open water reads as the same lattice the school is drawn on. The reference is
// a graph-paper pond: pale cell tiles for the bodies, hairline squares for the
// water between them. The lattice is static scenery — it carries no clock and
// no random seed, so pausing, reduced motion and theme changes need no extra
// bookkeeping.
//
// The frame is a layer below the whales, not a decoration around them: it does
// not fade at the screen edges the way a whale does. A whale fades there only
// because it wraps around the sea; the water itself continues past the window.
// Reading protection erases this layer under text exactly like the rest of the
// sea, and the frosted panes receive it through the shared blurred-sea pass.

const SEA_GRID_INK = Object.freeze({ light: [36, 54, 70], dark: [203, 219, 236] });
// Tuned against the reference screenshots: a 1-device-pixel hairline around
// #ececec on white. The value is the alpha at the default background
// concentration (0.6); the concentration slider still governs the whole sea.
const SEA_GRID_ALPHA = Object.freeze({ light: 0.105, dark: 0.075 });
const SEA_GRID_BASE_OPACITY = 0.6;
const SEA_GRID_MAX_ALPHA = 0.16;

const gridFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const gridClamp = (value, low, high) => value < low ? low : value > high ? high : value;

/** Line alpha for the current theme and background concentration. */
export function seaGridAlpha(opacity = SEA_GRID_BASE_OPACITY, dark = false) {
  const concentration = gridClamp(gridFinite(opacity, SEA_GRID_BASE_OPACITY), 0, 1);
  const base = dark ? SEA_GRID_ALPHA.dark : SEA_GRID_ALPHA.light;
  return gridClamp(base * (concentration / SEA_GRID_BASE_OPACITY), 0, SEA_GRID_MAX_ALPHA);
}

/**
 * Paint the hairline cell lattice of the sea surface.
 *
 * `scale` is device pixels per CSS pixel and `offsetX`/`offsetY` place the
 * logical sea inside the canvas (the settings preview letterboxes the real
 * conversation sea). Lines are snapped to half device pixels and stroked one
 * device pixel wide: at fractional device scales independently rounded edges
 * would otherwise overlap and read as a double line.
 *
 * `extend` lets the lattice continue past the logical sea to the canvas edges.
 * Only the settings preview needs it: its canvas is far wider than the
 * conversation viewport it borrows, and without the extension the paper would
 * stop at an invisible letterbox boundary. The conversation overlay never
 * extends — it covers the canvas exactly.
 */
export function drawSeaGrid(target, options = {}) {
  const width = Math.max(0, gridFinite(options.width, 0));
  const height = Math.max(0, gridFinite(options.height, 0));
  const cellWidth = gridFinite(options.cellWidth, 0);
  const cellHeight = gridFinite(options.cellHeight, 0);
  const scale = Math.max(0.05, gridFinite(options.scale, 1));
  const offsetX = gridFinite(options.offsetX, 0);
  const offsetY = gridFinite(options.offsetY, 0);
  const alpha = seaGridAlpha(options.opacity, options.dark === true);
  const result = { lines: 0, alpha };
  if (!target || typeof target.beginPath !== 'function' || typeof target.moveTo !== 'function'
    || typeof target.lineTo !== 'function' || typeof target.stroke !== 'function') return result;
  if (!(width > 0 && height > 0) || !(cellWidth >= 2 && cellHeight >= 2)) return result;
  if (!(alpha > 0.001)) return result;
  const ink = options.dark === true ? SEA_GRID_INK.dark : SEA_GRID_INK.light;
  // Work in device space so the one-pixel hairline is exact regardless of the
  // CSS transform the caller uses for glyphs and tiles.
  const canvas = options.extend === true ? target.canvas : null;
  const extend = Boolean(canvas && canvas.width > 1 && canvas.height > 1);
  const left = extend ? 0.5 : Math.round(offsetX) + 0.5;
  const top = extend ? 0.5 : Math.round(offsetY) + 0.5;
  const right = extend ? canvas.width - 0.5 : Math.round(offsetX + width * scale) - 0.5;
  const bottom = extend ? canvas.height - 0.5 : Math.round(offsetY + height * scale) - 0.5;
  if (!(right > left && bottom > top)) return result;
  // In letterbox mode the lattice starts one cell before the logical sea so
  // the continuation keeps the same phase in both directions, and it runs to
  // the canvas edges instead of stopping at the logical sea.
  const stepX = cellWidth * scale, stepY = cellHeight * scale;
  const firstColumn = extend ? Math.floor((left - offsetX) / stepX) - 1 : 1;
  const lastColumn = extend ? Math.ceil((right - offsetX) / stepX) + 1
    : Math.ceil((width - 0.01) / cellWidth) - 1;
  const firstRow = extend ? Math.floor((top - offsetY) / stepY) - 1 : 1;
  const lastRow = extend ? Math.ceil((bottom - offsetY) / stepY) + 1
    : Math.ceil((height - 0.01) / cellHeight) - 1;
  target.save?.();
  target.setTransform?.(1, 0, 0, 1, 0, 0);
  target.beginPath();
  for (let column = firstColumn; column <= lastColumn; column++) {
    const x = Math.round(offsetX + column * cellWidth * scale) + 0.5;
    if (x <= left || x >= right) continue;
    target.moveTo(x, top);
    target.lineTo(x, bottom);
    result.lines++;
  }
  for (let row = firstRow; row <= lastRow; row++) {
    const y = Math.round(offsetY + row * cellHeight * scale) + 0.5;
    if (y <= top || y >= bottom) continue;
    target.moveTo(left, y);
    target.lineTo(right, y);
    result.lines++;
  }
  if (!result.lines) { target.restore?.(); return result; }
  target.lineWidth = 1;
  target.strokeStyle = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, ${alpha.toFixed(4)})`;
  target.stroke();
  target.restore?.();
  return result;
}
