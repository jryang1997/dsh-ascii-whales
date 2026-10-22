import { whaleSpecies } from './species.js';
import { resetWhaleRig, resizeWhaleRig, updateWhaleRig, writeWhaleRigPose } from './rig.js';

// Stateful screen-space swimming. All helpers are prefixed because the release
// build concatenates this module with the renderer and geometry modules.
const motionTick = 1 / 60;
// Mirrors FIELDS.whaleSize; motion.js cannot import model.js because model.js
// already imports this module (a cycle would leave FIELDS uninitialized).
const motionWhaleSizeFloor = 0.55, motionWhaleSizeCeiling = 1.55;
const motionLimit = (value, low, high) => Math.max(low, Math.min(high, value));
const motionFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const motionAngle = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

function motionSeed(whale, index) {
  const key = `${whale.id ?? index}:${motionFinite(whale.phase, 0)}`;
  let state = 2166136261;
  for (let i = 0; i < key.length; i++) state = Math.imul(state ^ key.charCodeAt(i), 16777619);
  return state >>> 0;
}

function motionRandom(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function motionGeometry(whale, width, height, count, size = 1) {
  const areaScale = Math.min(width / 1600, height / 900, 1.25);
  const density = Math.min(1, Math.sqrt(3 / Math.max(1, count)));
  const depth = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5);
  const variation = 0.98 + Math.sin(motionFinite(whale.phase, 0) + 0.7) * 0.035;
  const anatomy = whaleSpecies(whale.species);
  const scale = 495 / (1 + depth * 0.48) * variation * areaScale * density * anatomy.size * size;
  // At the default 1 the expression is exactly the 0.8.0 length (same formula,
  // same 560 px ceiling, `* 1` is exact). The ceiling rises with the slider for
  // larger whales; below 1 the formula is already smaller than 560, so the cap
  // can stay, and the slider always visibly changes the body.
  whale.length = Math.min(560 * Math.max(1, size), scale);
  whale.halfLength = whale.length * 0.5;
  whale.bodyRadius = whale.length * Math.max(...anatomy.profile.map(point => point[1])) / 2.24;
  whale.bodyWidth = whale.bodyRadius * 2;
}

function motionLayout(index, count) {
  if (count === 1) return [0.24, 0.30];
  if (count === 2) return index === 0 ? [0.22, 0.30] : [0.78, 0.70];
  if (count === 3) return [[0.20, 0.27], [0.79, 0.29], [0.50, 0.77]][index];
  const columns = count <= 6 ? Math.ceil(count / 2) : 4;
  const column = index % columns, row = Math.floor(index / columns);
  return [0.14 + column * 0.72 / Math.max(1, columns - 1), 0.25 + row * 0.50];
}

function motionTarget(whale, width, height, first = false, obstacles = null) {
  const state = whale._motion;
  if (first) {
    const quadrant = whale.y < height * 0.5
      ? (whale.x < width * 0.5 ? 0 : 1)
      : (whale.x < width * 0.5 ? 3 : 2);
    state.targetIndex = (quadrant + state.routeDirection + 4) % 4;
  } else state.targetIndex = (state.targetIndex + state.routeDirection + 4) % 4;
  // Each destination is independently jittered. Visiting successive regions
  // provides broad exploration without prescribing the path between them.
  const right = state.targetIndex === 1 || state.targetIndex === 2;
  const bottom = state.targetIndex >= 2;
  state.targetX = width * ((right ? 0.83 : 0.17) + (motionRandom(state) - 0.5) * 0.075);
  state.targetY = height * ((bottom ? 0.77 : 0.23) + (motionRandom(state) - 0.5) * 0.10);
  // A destination inside the input card would keep the whale pressed against the
  // obstacle for a whole route leg, so it is moved to the nearest point outside.
  const safe = motionAvoidTarget(whale, state.targetX, state.targetY, obstacles, width, height);
  state.targetX = safe.x;
  state.targetY = safe.y;
  const cruise = state.cruise * Math.min(1, Math.min(width, height) / 650);
  const travel = Math.hypot(state.targetX - whale.x, state.targetY - whale.y) / Math.max(1, cruise);
  state.targetDue = state.age + motionLimit(travel * 1.5 + 8, 18, 110);
}

// The body is a long capsule, not a point: five stations along the spine cover
// nose-to-fluke. Each station carries the silhouette half-width of that part of
// the whale (flukes at the tail, flipper tips mid-body), because those extremit-
// ies are what leaked into the card while the spine itself was clear (T3c found
// fluke and fin cells inside it). The line runs from tail to nose.
const motionBodySampleU = Object.freeze([-0.5357142857142857, -0.2857142857142857,
  -0.0357142857142857, 0.2142857142857143, 0.4642857142857143]);
// A glyph cell is wider than the spine: half a cell can still reach past a
// station that sits exactly on the boundary. This gap keeps every cell centre
// outside the card, which is the visible definition of "the body avoids it".
const motionBodyClearance = 12;

/**
 * How wide the silhouette is around each of the five stations, in canvas pixels,
 * scaled from the species anatomy by the body length.
 */
function motionStationRadii(whale) {
  const anatomy = whaleSpecies(whale.species);
  const unit = Math.max(0, motionFinite(whale.length, 0)) / 2.24;
  const body = Math.max(0, motionFinite(whale.bodyRadius, 0));
  const fluke = anatomy.fluke.span * unit;
  const flipperTip = Math.abs(anatomy.flipper.tip[2]) * unit;
  const flipperRoot = Math.abs(anatomy.flipper.root[2]) * unit + anatomy.flipper.width * unit;
  return [
    fluke,                                          // fluke lobes at the tail
    Math.max(body * 0.6, fluke * 0.45),             // peduncle
    Math.max(body, flipperTip),                     // mid-body: flipper tips reach widest here
    Math.max(body, flipperRoot),                    // chest: flipper roots
    body * 0.25,                                    // snout
  ];
}

/** Station points with the silhouette half-extent at each: flat [x,y,r, ...]. */
function motionBodyHull(whale) {
  const length = motionFinite(whale.length, 0);
  const x = motionFinite(whale.x, 0), y = motionFinite(whale.y, 0);
  const radii = motionStationRadii(whale);
  const hull = [];
  if (!(length > 0)) return [x, y, Math.max(0, motionFinite(whale.bodyRadius, 0)) + motionBodyClearance];
  const c = Math.cos(motionFinite(whale.heading, 0)), s = Math.sin(motionFinite(whale.heading, 0));
  for (let i = 0; i < motionBodySampleU.length; i++) {
    const u = motionBodySampleU[i];
    hull.push(x + c * length * u, y + s * length * u, radii[i] + motionBodyClearance);
  }
  return hull;
}

/** Widest clearance any part of this whale keeps around an obstacle. */
function motionHullReach(whale) {
  let reach = 0;
  for (const radius of motionStationRadii(whale)) reach = Math.max(reach, radius);
  return reach + motionBodyClearance;
}

/** Soft boundary of one obstacle for one point, grown by that point's allowance. */
function motionObstacleBounds(obstacle, allowance) {
  if (obstacle.circle) {
    const reach = obstacle.radius + allowance;
    return { left: obstacle.x - reach, right: obstacle.x + reach,
      top: obstacle.y - reach, bottom: obstacle.y + reach };
  }
  return { left: obstacle.x - allowance, right: obstacle.x + obstacle.width + allowance,
    top: obstacle.y - allowance, bottom: obstacle.y + obstacle.height + allowance };
}

/**
 * Obstacles are canvas-space shapes the school must swim around. The reading
 * column and the input card are rectangles; reefs are circles, because a
 * bounding box would make the school dodge the empty corners of a round rock.
 * Anything unusable is dropped so a broken measurement can never push a whale
 * to NaN.
 */
function motionObstacleNormalize(obstacles) {
  if (!Array.isArray(obstacles)) return [];
  const normalized = [];
  for (const obstacle of obstacles) {
    if (!obstacle) continue;
    const x = Number(obstacle.x), y = Number(obstacle.y);
    const width = Number(obstacle.width), height = Number(obstacle.height);
    const radius = Number(obstacle.radius);
    // No extent plus a positive radius means a circle (see reef.js). A rect may
    // also carry a corner radius, so the extent check decides the shape.
    if (!(width > 0) && !(height > 0)) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || !(radius > 0)) continue;
      normalized.push({ x, y, radius, circle: true });
      continue;
    }
    if (![x, y, width, height].every(Number.isFinite) || !(width > 0) || !(height > 0)) continue;
    normalized.push({ x, y, width, height,
      radius: motionLimit(motionFinite(radius, 0), 0, Math.min(width, height) / 2) });
  }
  return normalized;
}

/**
 * How close a point is to the soft boundary, as a signed distance plus the
 * outward normal. Positive depth is inside (nearest edge decides the normal);
 * negative depth is outside and still within `band`, where the whale should
 * already begin to turn — the clamp alone would leave it sliding along the
 * glass, so the steering has to anticipate rather than react *inside* it.
 */
function motionObstacleApproach(obstacle, allowance, x, y, band) {
  if (obstacle.circle) {
    // Radial signed distance: positive inside the rock plus the hull's own
    // clearance, negative outside and still inside the turning band.
    const dx = x - obstacle.x, dy = y - obstacle.y;
    const distance = Math.hypot(dx, dy);
    const clearance = obstacle.radius + allowance;
    const gap = distance - clearance;
    if (!(gap < band)) return null;
    if (distance > 1e-6) return { depth: -gap, nx: dx / distance, ny: dy / distance };
    return { depth: -gap, nx: 1, ny: 0 };
  }
  const { left, right, top, bottom } = motionObstacleBounds(obstacle, allowance);
  const insideX = x > left && x < right, insideY = y > top && y < bottom;
  if (insideX && insideY) {
    const toLeft = x - left, toRight = right - x, toTop = y - top, toBottom = bottom - y;
    return Math.min(toLeft, toRight) <= Math.min(toTop, toBottom)
      ? { depth: Math.min(toLeft, toRight), nx: toLeft < toRight ? -1 : 1, ny: 0 }
      : { depth: Math.min(toTop, toBottom), nx: 0, ny: toTop < toBottom ? -1 : 1 };
  }
  const gapX = insideX ? 0 : Math.max(left - x, x - right, 0);
  const gapY = insideY ? 0 : Math.max(top - y, y - bottom, 0);
  const gap = Math.hypot(gapX, gapY);
  if (!(gap < band)) return null;
  const awayX = insideX ? 0 : x <= left ? -1 : x >= right ? 1 : 0;
  const awayY = insideY ? 0 : y <= top ? -1 : y >= bottom ? 1 : 0;
  const length = Math.hypot(awayX, awayY) || 1;
  return { depth: -gap, nx: awayX / length, ny: awayY / length };
}

/**
 * The body station with the least clearance (deepest penetration when inside).
 * Steering follows that station, so a stretched snout or a wide fluke starts
 * turning before the body centre would have noticed the card at all.
 */
function motionObstacleApproachBody(whale, obstacle, band) {
  const hull = motionBodyHull(whale);
  let closest = null;
  for (let i = 0; i < hull.length; i += 3) {
    const hit = motionObstacleApproach(obstacle, hull[i + 2], hull[i], hull[i + 1], band);
    if (!hit) continue;
    if (!closest || hit.depth < closest.depth) closest = hit;
  }
  return closest;
}

/** True when this station's silhouette disc reaches into the obstacle bounds. */
function motionHullInside(obstacle, x, y, radius) {
  if (obstacle.circle) return Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius + radius;
  const { left, right, top, bottom } = motionObstacleBounds(obstacle, radius);
  return x > left && x < right && y > top && y < bottom;
}

/**
 * Move the body rigidly until every station's silhouette is outside the
 * obstacles, keeping the whale on the canvas.
 *
 * A rigid translation is what a swimming animal can do in one tick: it cannot
 * bend to clear both sides of a card, so the move is chosen as the shortest one
 * that works for the widest station. Exits that would push the centre off the
 * sea are skipped while another exit exists; if the obstacle fills the sea the
 * canvas bound still wins, which is safer than a whale outside its own window.
 *
 * Returns true when the position changed.
 */
function motionPushOut(whale, obstacles, width, height) {
  if (!obstacles || !obstacles.length) return false;
  let moved = false;
  // Several passes: clearing one side can leave a different station inside the
  // same obstacle (a body diagonal across a corner), and one obstacle can push
  // into another.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const obstacle of obstacles) {
      const hull = motionBodyHull(whale);
      if (obstacle.circle) {
        // A round rock has no sides to slide along, so the rigid move is radial:
        // away from the rock centre, far enough for the last-reaching station.
        const centreX = motionFinite(whale.x, 0), centreY = motionFinite(whale.y, 0);
        let dx = centreX - obstacle.x, dy = centreY - obstacle.y;
        let length = Math.hypot(dx, dy);
        if (!(length > 0.001)) {
          dx = Math.cos(motionFinite(whale.heading, 0));
          dy = Math.sin(motionFinite(whale.heading, 0));
          length = 1;
        }
        const nx = dx / length, ny = dy / length;
        let shift = 0;
        for (let i = 0; i < hull.length; i += 3) {
          const clearance = obstacle.radius + hull[i + 2];
          if (!(Math.hypot(hull[i] - obstacle.x, hull[i + 1] - obstacle.y) < clearance)) continue;
          shift = Math.max(shift, clearance - ((hull[i] - obstacle.x) * nx + (hull[i + 1] - obstacle.y) * ny));
        }
        if (shift > 0) {
          whale.x = motionLimit(centreX + nx * shift, 0, width);
          whale.y = motionLimit(centreY + ny * shift, 0, height);
          moved = changed = true;
        }
        continue;
      }
      let leftShift = 0, rightShift = 0, upShift = 0, downShift = 0, inside = false;
      for (let i = 0; i < hull.length; i += 3) {
        const x = hull[i], y = hull[i + 1], radius = hull[i + 2];
        if (!motionHullInside(obstacle, x, y, radius)) continue;
        inside = true;
        const bounds = motionObstacleBounds(obstacle, radius);
        leftShift = Math.max(leftShift, x - bounds.left);
        rightShift = Math.max(rightShift, bounds.right - x);
        upShift = Math.max(upShift, y - bounds.top);
        downShift = Math.max(downShift, bounds.bottom - y);
      }
      if (!inside) continue;
      const centreX = motionFinite(whale.x, 0), centreY = motionFinite(whale.y, 0);
      const candidates = [
        { dx: -leftShift, dy: 0, distance: leftShift },
        { dx: rightShift, dy: 0, distance: rightShift },
        { dx: 0, dy: -upShift, distance: upShift },
        { dx: 0, dy: downShift, distance: downShift },
      ].sort((a, b) => a.distance - b.distance);
      // Prefer an exit that keeps the centre on the canvas; only when every exit
      // would leave it does the shortest one win, and the canvas clamp below keeps
      // the whale inside its own window.
      const move = candidates.find(candidate => {
        const x = centreX + candidate.dx, y = centreY + candidate.dy;
        return x >= 0 && x <= width && y >= 0 && y <= height;
      }) || candidates[0];
      whale.x = motionLimit(centreX + move.dx, 0, width);
      whale.y = motionLimit(centreY + move.dy, 0, height);
      moved = changed = true;
    }
    if (!changed) break;
  }
  if (moved) updateWhaleRig(whale);
  return moved;
}

/** Move a route target out of an obstacle, preferring the closest point above it. */
function motionAvoidTarget(whale, x, y, obstacles, width, height) {
  if (!obstacles || !obstacles.length) return { x, y };
  const allowance = motionHullReach(whale) + Math.max(8, motionFinite(whale.length, 0) * 0.08);
  for (const obstacle of obstacles) {
    if (obstacle.circle) {
      const clearance = obstacle.radius + allowance;
      const dx = x - obstacle.x, dy = y - obstacle.y;
      const distance = Math.hypot(dx, dy);
      if (!(distance < clearance)) continue;
      const nx = distance > 0.001 ? dx / distance : 1, ny = distance > 0.001 ? dy / distance : 0;
      x = motionLimit(obstacle.x + nx * clearance, 0, width);
      y = motionLimit(obstacle.y + ny * clearance, 0, height);
      continue;
    }
    const { left, right, top, bottom } = motionObstacleBounds(obstacle, allowance);
    if (!(x > left && x < right && y > top && y < bottom)) continue;
    if (top >= 0) { x = motionLimit(x, 0, width); y = top; continue; }
    if (bottom <= height) { y = bottom; continue; }
    x = motionLimit(x - left < right - x ? left : right, 0, width);
  }
  return { x, y };
}

/**
 * Install the obstacles the school must swim around and fix the current frame.
 *
 * Called right after the input card is measured, so a config change or a scroll
 * takes effect before the next animation tick; this is also what makes reduced
 * motion correct, where the scene never steps and only paints.
 *
 * The list is copied, not shared, and `[]` restores the pre-obstacle behaviour.
 */
export function setSceneObstacles(scene, obstacles) {
  if (!scene) return [];
  const normalized = motionObstacleNormalize(obstacles);
  scene.obstacles = normalized;
  const width = motionFinite(scene.width, 0), height = motionFinite(scene.height, 0);
  if (!normalized.length || !(width > 0) || !(height > 0)) return normalized;
  for (const whale of scene.whales || []) {
    motionPushOut(whale, normalized, width, height);
    if (whale._motion) {
      const target = motionAvoidTarget(whale, whale._motion.targetX, whale._motion.targetY, normalized, width, height);
      whale._motion.targetX = target.x;
      whale._motion.targetY = target.y;
    }
  }
  return normalized;
}

/** Resize existing objects; a resize never restarts their route or clock. */
export function resizeScene(scene, width, height) {
  width = Math.max(1, motionFinite(width, 1));
  height = Math.max(1, motionFinite(height, 1));
  const oldWidth = scene.width > 0 ? scene.width : width;
  const oldHeight = scene.height > 0 ? scene.height : height;
  const size = motionLimit(motionFinite(scene.whaleSize, 1), motionWhaleSizeFloor, motionWhaleSizeCeiling);
  scene.time = motionFinite(scene.time, 0);
  scene.accumulator = motionFinite(scene.accumulator, 0);
  // Obstacles are stored in canvas pixels, so a resize scales them with the sea.
  // Without obstacles these lines do nothing and the old numbers are untouched.
  if (scene.obstacles && scene.obstacles.length) {
    const scaleX = width / oldWidth, scaleY = height / oldHeight;
    for (const obstacle of scene.obstacles) {
      obstacle.x *= scaleX; obstacle.y *= scaleY;
      if (obstacle.circle) {
        obstacle.radius *= Math.min(scaleX, scaleY);
        continue;
      }
      obstacle.width *= scaleX; obstacle.height *= scaleY;
    }
  }
  const whales = scene.whales || [];
  for (let i = 0; i < whales.length; i++) {
    const whale = whales[i];
    motionGeometry(whale, width, height, whales.length, size);
    if (whale._motion) {
      whale.x *= width / oldWidth;
      whale.y *= height / oldHeight;
      whale._motion.targetX *= width / oldWidth;
      whale._motion.targetY *= height / oldHeight;
      const previousPace = Math.min(1, Math.min(oldWidth, oldHeight) / 650);
      const nextPace = Math.min(1, Math.min(width, height) / 650);
      whale.speed *= nextPace / Math.max(1 / 650, previousPace);
    } else {
      const state = whale._motion = { seed: motionSeed(whale, i), age: 0,
        routeDirection: i % 2 ? -1 : 1, targetIndex: 0, wander: 0,
        wanderGoal: 0, wanderDue: 0, wave: motionFinite(whale.phase, 0) };
      const anatomy = whaleSpecies(whale.species);
      state.cruise = anatomy.cruise * (0.94 + motionRandom(state) * 0.12);
      state.agility = anatomy.turnRate * (0.96 + motionRandom(state) * 0.08);
      state.stroke = 1;
      const [x, y] = motionLayout(i, whales.length);
      whale.x = width * x;
      whale.y = height * y;
      whale.heading = [0.28, 2.72, -0.88, 1.85, -2.1, 0.95, -0.4, 2.1][i % 8]
        + (motionRandom(state) - 0.5) * 0.18;
      whale.turn = 0;
      whale.speed = state.cruise * Math.min(1, Math.min(width, height) / 650);
      motionTarget(whale, width, height, true, scene.obstacles);
    }
    whale.vx = Math.cos(whale.heading) * whale.speed;
    whale.vy = Math.sin(whale.heading) * whale.speed;
    resizeWhaleRig(whale, width / oldWidth, height / oldHeight);
  }
  // Scaling can carry a whale into the (scaled) obstacle: fix that in the same
  // pass, before anything is painted.
  if (scene.obstacles && scene.obstacles.length) {
    for (const whale of whales) motionPushOut(whale, scene.obstacles, width, height);
  }
  scene.width = width;
  scene.height = height;
  return scene;
}

/**
 * Carry the swimming state of one scene into the scene that replaces it.
 *
 * A settings change that touches count/text/species/whaleSize builds a new
 * scene from scratch. Without this hand-over the school would jump back to its
 * start layout on every such write; here each whale with the same id keeps its
 * position, heading, turn, speed, velocity, route state (`_motion`) and spine.
 *
 * The caller sizes `next` to the same on-screen space as `previous` first, so
 * the copied coordinates are already valid. Geometry (length, radii) and the
 * new particle budget are owned by `next`; nothing here touches the clock, the
 * DOM or global state, which is what makes the function unit-testable.
 *
 * Returns the number of whales that were migrated.
 */
export function adoptSceneState(previous, next) {
  if (!previous || !next || previous === next) return 0;
  const sources = new Map();
  for (const whale of previous.whales || []) {
    if (whale && whale.id !== undefined) sources.set(whale.id, whale);
  }
  let adopted = 0;
  for (const whale of next.whales || []) {
    const source = sources.get(whale.id);
    if (!source || source === whale) continue;
    for (const key of ['x', 'y', 'heading', 'turn', 'speed', 'vx', 'vy']) {
      if (Number.isFinite(source[key])) whale[key] = source[key];
    }
    if (source._motion) whale._motion = { ...source._motion };
    // `_motion` carries the species base cruise/turn values with the individual
    // jitter already baked in. On a species switch (mixed group <-> one species)
    // the rebuilt whale must swim with the new anatomy straight away, so rescale
    // those two by the base-parameter ratio while keeping the same relative
    // variation. A same-species hand-over is left completely untouched.
    const previousAnatomy = whaleSpecies(source.species), nextAnatomy = whaleSpecies(whale.species);
    if (previousAnatomy !== nextAnatomy && whale._motion) {
      whale._motion.cruise *= nextAnatomy.cruise / previousAnatomy.cruise;
      whale._motion.agility *= nextAnatomy.turnRate / previousAnatomy.turnRate;
    }
    // The spine is normalized by the body length, so after a size change one
    // stale frame would show the old silhouette. Allocate a correctly shaped
    // rig, keep the old nodes when they fit, and re-anchor them to the new length
    // with updateWhaleRig: the bend continues, only the scale is refreshed.
    resetWhaleRig(whale);
    const nodes = source.rig && source.rig.nodes;
    if (nodes && nodes.length === whale.rig.nodes.length) {
      whale.rig.nodes.set(nodes);
      updateWhaleRig(whale);
    }
    adopted++;
  }
  return adopted;
}

// Find the closest pair of samples on two heading-extended bodies, including
// where those bodies will be after a short coast. A center-only check misses
// a nose crossing another whale's tail.
function motionBodyContact(a, b, horizon) {
  const ac = Math.cos(a.heading), as = Math.sin(a.heading);
  const bc = Math.cos(b.heading), bs = Math.sin(b.heading);
  let bestSquared = Infinity, bestX = 0, bestY = 0;
  for (const ahead of [0, horizon]) {
    const dx = a.x - b.x + (a.vx - b.vx) * ahead;
    const dy = a.y - b.y + (a.vy - b.vy) * ahead;
    for (let i = -2; i <= 2; i++) {
      const ax = dx + ac * a.length * i * 0.225;
      const ay = dy + as * a.length * i * 0.225;
      for (let j = -2; j <= 2; j++) {
        const x = ax - bc * b.length * j * 0.225;
        const y = ay - bs * b.length * j * 0.225;
        const squared = x * x + y * y;
        if (squared < bestSquared) { bestSquared = squared; bestX = x; bestY = y; }
      }
    }
  }
  return { distance: Math.sqrt(bestSquared), x: bestX, y: bestY };
}

function motionIntegrate(scene, speed) {
  const whales = scene.whales, width = scene.width, height = scene.height;
  const environmentSpeed = Math.min(1, Math.min(width, height) / 650);
  const obstacles = scene.obstacles;
  const forces = whales.map(() => ({ x: 0, y: 0, caution: 0 }));
  // Accumulate reciprocal forces before moving any body, so update order
  // cannot give a whale an advantage over its neighbor.
  for (let i = 0; i < whales.length; i++) {
    const a = whales[i];
    for (let j = i + 1; j < whales.length; j++) {
      const b = whales[j], dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
      const relativeSpeedSquared = dvx * dvx + dvy * dvy;
      const intercept = relativeSpeedSquared > 0.001
        ? motionLimit(-(dx * dvx + dy * dvy) / relativeSpeedSquared, 0, 2.6 / Math.max(0.3, speed)) : 0;
      const contact = motionBodyContact(a, b, intercept);
      const personalSpace = (a.length + b.length) * 0.53;
      const centerThreat = Math.max(0, 1 - distance / Math.max(1, personalSpace));
      const clearance = a.bodyRadius + b.bodyRadius + Math.min(a.length, b.length) * 0.12;
      const bodyThreat = Math.max(0, 1 - contact.distance / Math.max(1, clearance));
      if (centerThreat <= 0 && bodyThreat <= 0) continue;
      let pushX = -dx / (distance || 1) * centerThreat * 2.8;
      let pushY = -dy / (distance || 1) * centerThreat * 2.8;
      const normalX = -Math.sin(a.heading), normalY = Math.cos(a.heading);
      const side = dx * normalX + dy * normalY;
      const sideSign = side > clearance * 0.30 ? -1 : 1;
      const awayX = contact.distance > 0.01 ? contact.x / contact.distance : normalX * sideSign;
      const awayY = contact.distance > 0.01 ? contact.y / contact.distance : normalY * sideSign;
      pushX += awayX * bodyThreat * 3.0;
      pushY += awayY * bodyThreat * 3.0;
      if (intercept > 0.05) {
        // Give an exactly head-on encounter a stable passing side instead of
        // asking both animals to reverse along the same line.
        pushX += normalX * sideSign * bodyThreat * 4.5;
        pushY += normalY * sideSign * bodyThreat * 4.5;
      }
      forces[i].x += pushX; forces[i].y += pushY;
      forces[j].x -= pushX; forces[j].y -= pushY;
      forces[i].caution = Math.max(forces[i].caution, bodyThreat);
      forces[j].caution = Math.max(forces[j].caution, bodyThreat);
    }
  }
  for (let i = 0; i < whales.length; i++) {
    const whale = whales[i], state = whale._motion, force = forces[i];
    const travelTick = motionTick * speed;
    state.age += travelTick;
    if (state.age >= state.targetDue
      || Math.hypot(state.targetX - whale.x, state.targetY - whale.y) < Math.max(8, whale.length * 0.14)) {
      motionTarget(whale, width, height, false, obstacles);
    }
    if (state.age >= state.wanderDue) {
      state.wanderGoal = (motionRandom(state) - 0.5) * 0.42;
      state.wanderDue = state.age + 8 + motionRandom(state) * 8;
    }
    state.wander += (state.wanderGoal - state.wander) * (1 - Math.exp(-travelTick * 0.5));
    const dx = state.targetX - whale.x, dy = state.targetY - whale.y;
    const targetDistance = Math.hypot(dx, dy) || 1;
    const forwardX = Math.cos(whale.heading), forwardY = Math.sin(whale.heading);
    if (obstacles && obstacles.length) {
      // The band is where steering starts: outside the clamp boundary but close
      // enough to turn, measured from the nearest body station (hull included) so
      // a long snout or a wide fluke banks away while the centre still looks far.
      const band = Math.max(48, motionHullReach(whale) * 2, whale.length * 0.14);
      let caution = 0;
      for (const obstacle of obstacles) {
        const hit = motionObstacleApproachBody(whale, obstacle, band);
        if (!hit) continue;
        const depth = hit.depth;
        // Positive depth pushes hard; the outer band only nudges. A body drifting
        // near the glass is turned gently, one already inside is pushed firmly.
        const push = depth >= 0
          ? 0.9 + 5.4 * Math.min(1.6, depth / Math.max(24, whale.bodyRadius))
          : 0.9 * (1 + depth / band);
        force.x += hit.nx * push;
        force.y += hit.ny * push;
        // A normal-only push can stall the whale head-on against the edge; the
        // tangential part turns it into a swim-around. The side it already faces
        // wins, so the two directions never fight.
        const tangentX = -hit.ny, tangentY = hit.nx;
        const side = Math.sign(forwardX * tangentX + forwardY * tangentY) || state.routeDirection || 1;
        const steer = depth >= 0 ? 1.2 : 0.9 * (1 + depth / band);
        force.x += tangentX * side * steer;
        force.y += tangentY * side * steer;
        caution = Math.max(caution, depth >= 0 ? Math.min(1, depth / Math.max(24, whale.bodyRadius)) : (1 + depth / band) * 0.5);
      }
      // Slow down near the card instead of gliding into it at cruise speed.
      if (caution > 0) force.caution = Math.max(force.caution, caution * 0.55);
    }
    let desiredX = dx / targetDistance * 1.5 + forwardX * 0.85
      + Math.cos(whale.heading + state.wander) * 0.35 + force.x;
    let desiredY = dy / targetDistance * 1.5 + forwardY * 0.85
      + Math.sin(whale.heading + state.wander) * 0.35 + force.y;
    const turnLimit = state.agility * Math.sqrt(speed);
    const cruise = state.cruise * environmentSpeed * speed;
    // Look beyond the snout by more than a turning radius. The response is
    // continuous; even a body temporarily outside the view swims back in.
    const lookAhead = whale.length * 0.22 + cruise / Math.max(0.08, turnLimit) * 0.95;
    const lookX = whale.x + forwardX * lookAhead, lookY = whale.y + forwardY * lookAhead;
    const marginX = Math.min(width * 0.17, whale.length * 0.24 + width * 0.025);
    const marginY = Math.min(height * 0.18, whale.length * 0.17 + height * 0.025);
    const left = motionLimit((marginX - lookX) / Math.max(1, marginX), 0, 3);
    const right = motionLimit((lookX - width + marginX) / Math.max(1, marginX), 0, 3);
    const top = motionLimit((marginY - lookY) / Math.max(1, marginY), 0, 3);
    const bottom = motionLimit((lookY - height + marginY) / Math.max(1, marginY), 0, 3);
    desiredX += (left * left - right * right) * 7;
    desiredY += (top * top - bottom * bottom) * 7;
    // A neighbor can push the center outward while the snout already points
    // inward. Retain a positional restoring force during that recovery.
    const centerLeft = motionLimit((marginX * 0.6 - whale.x) / Math.max(1, marginX), 0, 4);
    const centerRight = motionLimit((whale.x - width + marginX * 0.6) / Math.max(1, marginX), 0, 4);
    const centerTop = motionLimit((marginY * 0.6 - whale.y) / Math.max(1, marginY), 0, 4);
    const centerBottom = motionLimit((whale.y - height + marginY * 0.6) / Math.max(1, marginY), 0, 4);
    desiredX += (centerLeft * centerLeft - centerRight * centerRight) * 14;
    desiredY += (centerTop * centerTop - centerBottom * centerBottom) * 14;
    let steeringError = motionAngle(whale.heading, Math.atan2(desiredY, desiredX));
    if (Math.abs(steeringError) > 2.5) {
      const turnSide = Math.abs(whale.turn) > 0.05 ? Math.sign(whale.turn) : state.routeDirection;
      steeringError = Math.abs(steeringError) * turnSide;
    }
    const requestedTurn = motionLimit(steeringError * 1.1, -turnLimit, turnLimit);
    whale.turn += (requestedTurn - whale.turn) * (1 - Math.exp(-motionTick * 1.7));
    whale.turn = motionLimit(whale.turn, -turnLimit, turnLimit);
    whale.heading += whale.turn * motionTick;
    const brakingX = marginX + cruise / Math.max(0.1, turnLimit);
    const brakingY = marginY + cruise / Math.max(0.1, turnLimit);
    const outward = Math.max(
      -forwardX * motionLimit(1 - whale.x / Math.max(1, brakingX), 0, 1),
      forwardX * motionLimit(1 - (width - whale.x) / Math.max(1, brakingX), 0, 1),
      -forwardY * motionLimit(1 - whale.y / Math.max(1, brakingY), 0, 1),
      forwardY * motionLimit(1 - (height - whale.y) / Math.max(1, brakingY), 0, 1), 0);
    const targetSpeed = cruise * (1 - force.caution * 0.3) * (1 - outward * 0.65)
      * (1 - 0.12 * Math.abs(whale.turn) / Math.max(0.01, turnLimit));
    whale.speed += (targetSpeed - whale.speed) * (1 - Math.exp(-motionTick * (0.8 + outward * 1.6)));
    whale.vx = Math.cos(whale.heading) * whale.speed;
    whale.vy = Math.sin(whale.heading) * whale.speed;
    whale.x += whale.vx * motionTick;
    whale.y += whale.vy * motionTick;
    updateWhaleRig(whale);
    // The force steers, but only the clamp guarantees the invariant (a strong
    // neighbor push can still cross the boundary for a tick).
    if (obstacles && obstacles.length) motionPushOut(whale, obstacles, width, height);
    const effort = whale.speed / Math.max(1, state.cruise * environmentSpeed);
    const anatomy = whaleSpecies(whale.species);
    // Two smooth strokes followed by a coast. These durations are deliberately
    // calm decoration settings, not measured swimming periods for each species.
    const active = Math.PI * 4 / anatomy.beat, rest = active * anatomy.glide / (1 - anatomy.glide);
    const gait = (state.age + whale.phase * 1.7) % (active + rest);
    const easeStroke = value => { const t = motionLimit(value, 0, 1); return t * t * (3 - 2 * t); };
    const envelope = gait < active ? easeStroke(gait / 1.1) * easeStroke((active - gait) / 1.1) : 0;
    state.stroke += (envelope - state.stroke) * (1 - Math.exp(-travelTick * 2.2));
    state.wave += travelTick * anatomy.beat * (0.7 + 0.3 * Math.min(1.4, Math.sqrt(effort)))
      * (0.08 + 0.92 * state.stroke);
  }
  scene.time += motionTick;
}

/** Integrate a capped frame in fixed ticks; no DOM or wall-clock dependency. */
export function stepScene(scene, dt, speed = 1) {
  if (!Number.isFinite(dt) || dt <= 0) return scene;
  speed = motionLimit(motionFinite(speed, 1), 0, 3);
  if (speed === 0) return scene;
  if (!(scene.width > 0 && scene.height > 0)
    || scene.whales.some(whale => !whale._motion)) {
    resizeScene(scene, scene.width || 1600, scene.height || 900);
  }
  scene.accumulator = motionFinite(scene.accumulator, 0) + Math.min(dt, 0.25);
  while (scene.accumulator + 1e-10 >= motionTick) {
    motionIntegrate(scene, speed);
    scene.accumulator = Math.max(0, scene.accumulator - motionTick);
  }
  return scene;
}

/** Projection compatible with transformParticle; elapsed never sets position. */
export function whalePose(whale, elapsed, width, height, speed, out = {}) {
  width = Math.max(1, motionFinite(width, 1));
  height = Math.max(1, motionFinite(height, 1));
  const phase = motionFinite(whale.phase, 0), state = whale._motion;
  const age = state ? state.age : motionFinite(elapsed, 0) * motionFinite(speed, 1);
  const heading = motionFinite(whale.heading, 0), turn = motionFinite(whale.turn, 0);
  const depth = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5)
    + Math.sin(age * 0.07 + phase) * 0.025;
  const focal = motionLimit(width * 0.95, 520, 1800);
  const yaw = 0, pitch = Math.PI / 2, roll = heading;
  const cy = 1, sy = 0, cp = 0, sp = 1;
  const length = motionFinite(whale.length, Math.min(width * 0.30, height * 0.53));
  // x is length, y is height into the water, and z is lateral spread.
  // A fixed overhead camera projects x/-z; heading turns within that plane.
  const scale = length * (1 + depth) / 2.24;
  Object.assign(out, { x: motionFinite(whale.x, width * 0.5), y: motionFinite(whale.y, height * 0.5),
    scale, focal, cameraZ: focal * depth, near: focal * 0.12,
    yaw, pitch, roll, heading, length, turn,
    wave: state ? state.wave : age * 1.8 + phase,
    cy, sy, cp, sp, cr: Math.cos(roll), sr: Math.sin(roll) });
  return writeWhaleRigPose(whale, out);
}
