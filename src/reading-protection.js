import { glassRoundedSubpath, glassContentTone } from './glass.js';

/** Material above DOM text: blur only the ocean, never the document itself. */
export function readingEffectTone(effect = 'frost', strength = 0.55, options = {}) {
  const base = glassContentTone(strength, options);
  if (effect === 'glow' || options.reducedTransparency) return { ...base, mode: 'glow' };
  const frost = effect !== 'blur';
  return { ...base, mode: frost ? 'frost' : 'blur', blur: frost ? 16 + 6 * base.strength : 8 + 4 * base.strength,
    mist: frost ? 0.24 : 0.30, veil: frost ? 0.025 : 0 };
}

const MAX_NODES = 6000;
const MAX_LINES = 1200;
const SKIP_TEXT = 'script,style,noscript,svg,[aria-hidden="true"]';
const intersects = (a, b) => a && b && a.left < b.left + b.width && a.left + a.width > b.left
  && a.top < b.top + b.height && a.top + a.height > b.top;
const boundsOf = element => {
  try { return element?.getBoundingClientRect(); } catch { return null; }
};
const intersect = (a, b) => {
  if (!intersects(a, b)) return null;
  const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
  return { left, top, width: Math.min(a.left + a.width, b.left + b.width) - left,
    height: Math.min(a.top + a.height, b.top + b.height) - top };
};

/** The rightbar track can be zero-width while its absolute panel is open. */
export function collectRightbarSurfaces(canvasRect) {
  const surfaces = [];
  for (const root of document.querySelectorAll('[data-rightbar-col]')) {
    const queue = [...(root.children || [])];
    if (!queue.length) queue.push(root);
    for (let i = 0; i < queue.length && i < 80; i++) {
      const element = queue[i], rect = boundsOf(element);
      if (element.hidden || element.isConnected === false || element.getAttribute?.('aria-hidden') === 'true') continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      if (element.hasAttribute?.('data-sidebar-right-panel') && !element.hasAttribute('data-sidebar-right-open')) {
        for (const floating of element.querySelectorAll('[data-dockkit-float]')) queue.push(floating);
        continue;
      }
      if (rect?.width >= 160 && rect?.height >= 120 && intersects(rect, canvasRect)) {
        const radius = Math.max(0, parseFloat(style.borderTopLeftRadius || style.borderRadius) || 0);
        surfaces.push({ element, left: rect.left, top: rect.top, width: rect.width, height: rect.height, radius });
        continue;
      }
      for (const child of element.children || []) queue.push(child);
    }
  }
  return surfaces;
}

/** Measure actual text lines, including transparent prose and editable input. */
export function measureReadingText(roots, canvasRect) {
  if (typeof document.createTreeWalker !== 'function' || typeof document.createRange !== 'function') return [];
  const groups = [], seen = new Set(), styles = new Map();
  const styleOf = element => {
    if (!styles.has(element)) styles.set(element, getComputedStyle(element));
    return styles.get(element);
  };
  for (const root of roots) {
    if (!root || seen.has(root)) continue;
    seen.add(root);
    const clip = intersect(boundsOf(root), canvasRect);
    if (!clip) continue;
    const regions = [];
    const walker = document.createTreeWalker(root, 4);
    const range = document.createRange();
    let visited = 0, overflow = false, text;
    while ((text = walker.nextNode())) {
      if (++visited > MAX_NODES || regions.length >= MAX_LINES) { overflow = true; break; }
      if (!text.textContent?.trim()) continue;
      const parent = text.parentElement;
      if (!parent || parent.closest?.(SKIP_TEXT) || !intersects(boundsOf(parent), clip)) continue;
      let visible = true, textClip = clip;
      for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
        const style = styleOf(ancestor);
        if (ancestor.hidden || style.display === 'none' || style.visibility === 'hidden'
          || style.visibility === 'collapse' || Number(style.opacity) === 0) { visible = false; break; }
        // A line scrolled out of a nested code/tool panel must not erase open water.
        const x = /hidden|clip|auto|scroll/.test(style.overflowX || style.overflow || '');
        const y = /hidden|clip|auto|scroll/.test(style.overflowY || style.overflow || '');
        if (x || y) {
          const rect = boundsOf(ancestor);
          if (rect) textClip = intersect(textClip, { left: x ? rect.left : textClip.left,
            top: y ? rect.top : textClip.top, width: x ? rect.width : textClip.width,
            height: y ? rect.height : textClip.height });
          if (!textClip) { visible = false; break; }
        }
        if (ancestor === root) break;
      }
      if (!visible) continue;
      range.selectNodeContents(text);
      for (const line of range.getClientRects()) {
        const rect = intersect({ left: line.left - 3, top: line.top - 2,
          width: line.width + 6, height: line.height + 4 }, textClip);
        if (rect && line.width > 0 && line.height > 0) regions.push({ x: rect.left - canvasRect.left,
          y: rect.top - canvasRect.top, width: rect.width, height: rect.height, radius: 3 });
        if (regions.length >= MAX_LINES) { overflow = true; break; }
      }
      if (overflow) break;
    }
    // Native text controls have no DOM text nodes for their current value.
    for (const input of root.querySelectorAll?.('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),textarea') || []) {
      const rect = intersect(boundsOf(input), clip);
      const style = styleOf(input);
      if (rect && style.visibility !== 'hidden' && Number(style.opacity) !== 0) regions.push({
        x: rect.left - canvasRect.left, y: rect.top - canvasRect.top, width: rect.width, height: rect.height, radius: 4 });
    }
    const localClip = { x: clip.left - canvasRect.left, y: clip.top - canvasRect.top,
      width: clip.width, height: clip.height, radius: 0 };
    groups.push({ clip: localClip, regions: overflow ? [localClip] : regions });
  }
  return groups;
}

/** Cache the soft mask; text measurement and per-line blur never run per frame. */
export function createReadingProtection() {
  let mask = null, key = '', replacement = null, replacementInk = null;
  function setRegions(groups, canvasRect, effect = 'glow') {
    const nextKey = JSON.stringify([canvasRect.width, canvasRect.height, effect, groups]);
    if (nextKey === key) return;
    key = nextKey;
    if (!groups.some(group => group.regions.length)) { mask = null; return; }
    mask ??= document.createElement('canvas');
    mask.width = Math.max(1, Math.ceil(canvasRect.width));
    mask.height = Math.max(1, Math.ceil(canvasRect.height));
    const target = mask.getContext('2d');
    if (!target) { mask = null; return; }
    const through = effect !== 'glow', padding = through ? 5 : 0;
    target.fillStyle = '#000';
    target.shadowColor = '#000';
    target.shadowBlur = through ? 12 : 8;
    for (const { clip, regions } of groups) {
      if (!regions.length) continue;
      target.save();
      target.beginPath(); glassRoundedSubpath(target, clip); target.clip();
      target.beginPath();
      // Overlapping padded lines form a continuous patch through a paragraph,
      // instead of cutting the whale into alternating clear and blurred stripes.
      for (const region of regions) glassRoundedSubpath(target, { x: region.x - padding, y: region.y - padding,
        width: region.width + padding * 2, height: region.height + padding * 2, radius: through ? 7 : region.radius });
      target.fill(); target.restore();
    }
  }
  return {
    get active() { return Boolean(mask); },
    measure(roots, canvasRect, effect = 'glow') { setRegions(measureReadingText(roots, canvasRect), canvasRect, effect); },
    setRegions,
    paint(target, width, height, { material = { mode: 'glow' }, source = null, sourceRect = null, underlay = null } = {}) {
      if (!mask) return;
      target.save();
      target.globalAlpha = 1;
      target.globalCompositeOperation = 'destination-out';
      target.drawImage(mask, 0, 0, width, height);
      target.restore();
      const through = material.mode !== 'glow' && source && sourceRect;
      if (!through && !underlay) return;
      if (!replacement) {
        replacement = document.createElement('canvas');
        replacementInk = replacement.getContext('2d');
      }
      if (!replacementInk) return;
      if (replacement.width !== mask.width || replacement.height !== mask.height) {
        replacement.width = mask.width; replacement.height = mask.height;
      }
      const ink = replacementInk;
      ink.clearRect(0, 0, replacement.width, replacement.height);
      ink.save();
      if (underlay) { ink.fillStyle = underlay; ink.fillRect(0, 0, width, height); }
      if (through) {
        ink.imageSmoothingEnabled = true; ink.imageSmoothingQuality = 'high';
        ink.globalAlpha = material.mist;
        ink.drawImage(source, ...sourceRect, 0, 0, width, height);
        ink.globalAlpha = 1;
        if (material.veil) {
          ink.fillStyle = `rgba(${material.tint}, ${material.veil})`;
          ink.fillRect(0, 0, width, height);
        }
      }
      ink.globalCompositeOperation = 'destination-in';
      ink.drawImage(mask, 0, 0, width, height);
      ink.restore();
      target.save();
      target.globalAlpha = 1;
      target.drawImage(replacement, 0, 0, width, height);
      target.restore();
    },
    dispose() { mask = replacement = replacementInk = null; key = ''; },
  };
}
