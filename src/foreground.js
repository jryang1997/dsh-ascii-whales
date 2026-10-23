import { glassRoundedSubpath } from './glass.js';

const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS']);
const MAX_VISIT = 6000;
const MAX_STYLE = 512;
const MAX_REGIONS = 128;
function rectOf(element) {
  try {
    const rect = element?.getBoundingClientRect();
    return rect && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
      && rect.width > 0 && rect.height > 0 ? rect : null;
  } catch { return null; }
}
function intersection(a, b) {
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width), bottom = Math.min(a.top + a.height, b.top + b.height);
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}
function radiusOf(style, rect) {
  const values = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']
    .map(key => style[key] || style.borderRadius || '0').map(value => {
      const length = parseFloat(value);
      return Number.isFinite(length) ? Math.max(0, String(value).includes('%')
        ? length * Math.min(rect.width, rect.height) / 100 : length) : 0;
    });
  return Math.min(...values, rect.width / 2, rect.height / 2);
}

/** Foreground media is independent of card styling, glass and input avoidance. */
export function measureForeground(root, canvasRect, canvas) {
  const rootRect = rectOf(root), clip = rootRect && intersection(rootRect, canvasRect);
  const regions = [];
  if (!clip) return { regions, clip: null };
  const styles = new Map();
  let reads = 0;
  const styleOf = element => {
    if (styles.has(element)) return styles.get(element);
    if (reads++ >= MAX_STYLE) return null;
    let style = null;
    try { style = getComputedStyle(element); } catch { /* Missing DOM style is not a visible media box. */ }
    styles.set(element, style);
    return style;
  };
  const visible = element => {
    for (let ancestor = element, depth = 0; ancestor && depth < 64; ancestor = ancestor.parentElement, depth++) {
      if (ancestor.hidden || ancestor.isConnected === false) return false;
      const style = styleOf(ancestor);
      if (!style || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
        || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) return false;
      if (ancestor === root) return true;
    }
    return false;
  };
  const queue = [root];
  for (let index = 0; index < queue.length && index < MAX_VISIT && regions.length < MAX_REGIONS; index++) {
    const element = queue[index];
    if (!element || element === canvas || element.hidden || element.isConnected === false
      || element.style?.display === 'none') continue;
    const tag = String(element.tagName || '').toUpperCase();
    if (MEDIA_TAGS.has(tag)) {
      const rect = rectOf(element);
      if (rect && intersection(rect, clip) && visible(element)) {
        regions.push({ x: rect.left - canvasRect.left, y: rect.top - canvasRect.top,
          width: rect.width, height: rect.height, radius: radiusOf(styleOf(element), rect), element });
      }
      continue;
    }
    if (element.children) for (const child of element.children) {
      if (queue.length >= MAX_VISIT) break;
      queue.push(child);
    }
  }
  return { regions, clip: { x: clip.left - canvasRect.left, y: clip.top - canvasRect.top,
    width: clip.width, height: clip.height, radius: 0 } };
}

/** Watch only the active conversation and visible media, never our own Canvas writes. */
export function observeForeground(canvas, invalidate) {
  let root = null, resized = new Set();
  const events = ['load', 'loadedmetadata', 'error'];
  let resizeObserver = new ResizeObserver(invalidate);
  const mutationObserver = new MutationObserver(records => {
    if (!records || records.some(record => record.target !== canvas)) invalidate();
  });
  function detachRoot() {
    for (const type of events) root?.removeEventListener?.(type, invalidate, true);
    mutationObserver.disconnect();
  }
  return {
    update(nextRoot, regions) {
      if (nextRoot !== root) {
        detachRoot();
        root = nextRoot || null;
        for (const type of events) root?.addEventListener?.(type, invalidate, true);
        if (root) mutationObserver.observe(root, { childList: true, subtree: true, attributes: true,
          attributeFilter: ['src', 'srcset', 'sizes', 'width', 'height', 'class', 'style', 'hidden', 'open', 'poster'] });
      }
      const next = new Set(root ? [root, ...regions.map(region => region.element)] : []);
      const removed = [...resized].filter(element => !next.has(element));
      if (removed.length && typeof resizeObserver.unobserve !== 'function') {
        resizeObserver.disconnect();
        resizeObserver = new ResizeObserver(invalidate);
        resized.clear();
      } else for (const element of removed) { resizeObserver.unobserve(element); resized.delete(element); }
      for (const element of next) if (!resized.has(element)) { resizeObserver.observe(element); resized.add(element); }
    },
    dispose() { detachRoot(); resizeObserver.disconnect(); resized.clear(); root = null; },
  };
}

/** Erase the completed overlay; nonzero winding keeps overlapping media a union. */
export function clearForeground(target, foreground, width, height) {
  if (!foreground?.regions.length || !foreground.clip) return;
  target.save();
  target.beginPath();
  glassRoundedSubpath(target, foreground.clip);
  target.clip();
  target.beginPath();
  for (const region of foreground.regions) glassRoundedSubpath(target, region);
  target.clip();
  target.clearRect(0, 0, width, height);
  target.restore();
}
