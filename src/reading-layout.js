import { glassContentPanes, glassContentTone, glassSidebarTone } from './glass.js';
import { attenuation } from './model.js';

function readingExpandedRect(canvas, card, margin) {
  const x = Math.max(0, card.left - canvas.left - margin);
  const y = Math.max(0, card.top - canvas.top - margin);
  const right = Math.min(canvas.width, card.left - canvas.left + card.width + margin);
  const bottom = Math.min(canvas.height, card.top - canvas.top + card.height + margin);
  return right - x > 0 && bottom - y > 0
    ? { x, y, width: right - x, height: bottom - y } : null;
}

/** Both DOM and demo adapters supply page rectangles; policy stays here. */
export function createReadingLayout(snapshot, config, material = {}) {
  const { canvas, boxes = [], sidebars = [], composer = null } = snapshot;
  const contentPanes = config.glass ? glassContentPanes({ canvas, boxes, max: 16 }) : [];
  const sidebarPanes = config.glass ? glassContentPanes({ canvas, boxes: sidebars, max: 4 }) : [];
  const panes = [...contentPanes, ...sidebarPanes];
  const tone = config.glass ? glassContentTone(config.glassStrength, material) : null;
  const sidebarTone = config.glass ? glassSidebarTone(config.glassStrength, material) : null;
  const avoidRect = config.composerAvoid && composer
    ? readingExpandedRect(canvas, composer, 8) : null;
  const fade = !avoidRect ? null : (x, y) => x > avoidRect.x && x < avoidRect.x + avoidRect.width
    && y > avoidRect.y && y < avoidRect.y + avoidRect.height ? 0 : 1;
  return {
    panes, contentPanes, sidebarPanes, tone, sidebarTone, fade,
    sceneryFade(x, y) {
      // Glass is clipped by the renderer at the actual rounded edge. Feeding a
      // pane mask to the cloud raster would erase whole tiles outside that edge.
      return attenuation(x, y, canvas.width, canvas.height, config.quietCenter) * (fade ? fade(x, y) : 1);
    },
    obstacles(largestRadius) {
      if (!config.composerAvoid || !composer) return [];
      const radius = Number.isFinite(largestRadius) ? largestRadius : 0;
      const obstacle = readingExpandedRect(canvas, composer, Math.max(26, 22 + 0.35 * radius));
      return obstacle && obstacle.width >= 1 && obstacle.height >= 1 ? [obstacle] : [];
    },
  };
}

/** Ratio-based settings preview adapter, expressed in the same space as DOM. */
export function demoReadingSnapshot(card, width, height) {
  const canvas = { left: 0, top: 0, width, height };
  const composer = card && width > 0 && height > 0
    && card.width * width >= 1 && card.height * height >= 1 ? {
    left: card.x * width, top: card.y * height,
    width: card.width * width, height: card.height * height,
    radius: Number.isFinite(card.radius) ? card.radius : 0,
  } : null;
  return { canvas, boxes: composer ? [composer] : [], composer };
}
