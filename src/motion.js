import { whaleSpecies } from './species.js';
import { deformWhaleParticle, resetWhaleRig, resizeWhaleRig, updateWhaleRig, writeWhaleRigPose } from './rig.js';

// Stateful screen-space swimming with fixed-step integration.
const motionTick = 1 / 60;
// Model y points down into the water; the fog band begins at this plane.
export const DIVE_WATERLINE = 0.10;
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
  // Destinations sit near the rim. The sea has no wall there: a whale that is
  // already heading out keeps going and comes back on the opposite side.
  state.targetX = width * ((right ? 0.94 : 0.06) + (motionRandom(state) - 0.5) * 0.05);
  state.targetY = height * ((bottom ? 0.92 : 0.08) + (motionRandom(state) - 0.5) * 0.06);
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
  const nodes = whale.rig?.nodes;
  if (nodes?.length >= 4) {
    const last = nodes.length / 2 - 1;
    const shiftX = x + c * length * motionBodySampleU[4] - nodes[0];
    const shiftY = y + s * length * motionBodySampleU[4] - nodes[1];
    for (let i = 0; i < motionBodySampleU.length; i++) {
      const at = (motionBodySampleU[4] - motionBodySampleU[i]) * last;
      const a = Math.min(last - 1, Math.floor(at)), t = at - a;
      hull.push(nodes[a * 2] * (1 - t) + nodes[(a + 1) * 2] * t + shiftX,
        nodes[a * 2 + 1] * (1 - t) + nodes[(a + 1) * 2 + 1] * t + shiftY,
        radii[i] + motionBodyClearance);
    }
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

// Collision geometry has the same periodic copies as the rendered animal.
// Detect the landing-side reef while the snout is still leaving this side;
// waiting until the centre folds would require a discontinuous push-out.
function motionPeriodicObstacles(obstacles, width, height) {
  if (!obstacles?.length) return obstacles;
  const copies = [];
  for (const obstacle of obstacles) {
    copies.push(obstacle);
    for (const oy of [-height, 0, height]) for (const ox of [-width, 0, width]) {
      if (ox || oy) copies.push({ ...obstacle, x: obstacle.x + ox, y: obstacle.y + oy, periodic: true });
    }
  }
  return copies;
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
function motionObstacleApproachBody(whale, obstacle, band, deepest = false) {
  const hull = motionBodyHull(whale);
  let closest = null;
  for (let i = 0; i < hull.length; i += 3) {
    const hit = motionObstacleApproach(obstacle, hull[i + 2], hull[i], hull[i + 1], band);
    if (!hit) continue;
    if (!closest || (deepest ? hit.depth > closest.depth : hit.depth < closest.depth)) closest = hit;
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
 * obstacles. The screen itself is not an obstacle: the shortest exit may leave
 * the sea, and the caller folds that position back in from the opposite edge.
 *
 * Returns true when the position changed.
 */
function motionPushOut(whale, obstacles, width, height) {
  if (!obstacles || !obstacles.length) return false;
  let moved = false;
  const startX = whale.x, startY = whale.y;
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
          // Leaving the sea is allowed, but a slide that stays on screen wins so a
          // rock in the margin does not throw the body onto the reef opposite.
          let ex = nx, ey = ny;
          const landedX = centreX + nx * shift, landedY = centreY + ny * shift;
          if (landedX < 0 || landedX > width || landedY < 0 || landedY > height) {
            for (const [tx, ty] of [[-ny, nx], [ny, -nx]]) {
              const x = centreX + tx * shift, y = centreY + ty * shift;
              if (x < 0 || x > width || y < 0 || y > height) continue;
              ex = tx; ey = ty;
              break;
            }
          }
          whale.x = centreX + ex * shift;
          whale.y = centreY + ey * shift;
          moved = changed = true;
        }
        continue;
      }
      let leftShift = 0, rightShift = 0, upShift = 0, downShift = 0, inside = false;
      for (let i = 0; i < hull.length; i += 3) {
        const x = hull[i], y = hull[i + 1], radius = hull[i + 2];
        if (motionHullInside(obstacle, x, y, radius)) inside = true;
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
      // An exit that stays on the sea wins. Off-screen is only the way out when
      // the rock is pressed against the edge and every on-screen exit is longer
      // than the sea itself — the caller then folds the body in from the far side.
      const move = candidates.find(candidate => {
        const x = centreX + candidate.dx, y = centreY + candidate.dy;
        return x >= 0 && x <= width && y >= 0 && y <= height;
      }) || candidates[0];
      whale.x = centreX + move.dx;
      whale.y = centreY + move.dy;
      moved = changed = true;
    }
    if (!changed) break;
  }
  if (moved) {
    const dx = whale.x - startX, dy = whale.y - startY;
    whale.x = startX; whale.y = startY;
    motionShiftWhale(whale, dx, dy);
  }
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
  const periodic = motionPeriodicObstacles(normalized, width, height);
  for (const whale of scene.whales || []) {
    motionPushOut(whale, periodic, width, height);
    motionFoldWhale(whale, width, height);
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
        wanderGoal: 0, wanderDue: 0, wave: motionFinite(whale.phase, 0),
        submergence: 0, pitch: 0, noseFirst: false, depth: 0, tailKick: 0, arch: 0 };
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
    const periodic = motionPeriodicObstacles(scene.obstacles, width, height);
    for (const whale of whales) {
      motionPushOut(whale, periodic, width, height);
      motionFoldWhale(whale, width, height);
    }
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
    for (const key of ['x', 'y', 'heading', 'turn', 'speed', 'vx', 'vy', 'depth']) {
      if (Number.isFinite(source[key])) whale[key] = source[key];
    }
    if (source._motion) {
      whale._motion = { ...source._motion };
      // Dive scheduling owns a separate random stream and duration snapshot.
      // A rebuilt scene must continue it without mutating the discarded scene.
      if (source._motion.dive) whale._motion.dive = { ...source._motion.dive };
    }
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
    motionGeometry(whale, next.width, next.height, next.whales.length,
      motionLimit(motionFinite(next.whaleSize, 1), motionWhaleSizeFloor, motionWhaleSizeCeiling));
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

function motionWrap(value, size) {
  if (!(size > 0) || !Number.isFinite(value)) return value;
  const wrapped = value % size;
  return wrapped < 0 ? wrapped + size : wrapped;
}

function motionTorusDelta(delta, size) {
  if (!(size > 0) || !Number.isFinite(delta)) return delta;
  const half = size * 0.5;
  if (delta > half) return delta - size;
  if (delta < -half) return delta + size;
  return delta;
}

/** Translate the centre and the spine together, so a wrap cannot tear the body. */
function motionShiftWhale(whale, dx, dy) {
  if (!dx && !dy) return;
  whale.x += dx;
  whale.y += dy;
  const nodes = whale.rig && whale.rig.nodes;
  if (!nodes) return;
  for (let i = 0; i < nodes.length; i += 2) {
    nodes[i] += dx;
    nodes[i + 1] += dy;
  }
}

function motionWhaleBlocked(whale, obstacles) {
  const hull = motionBodyHull(whale);
  for (const obstacle of obstacles) {
    for (let i = 0; i < hull.length; i += 3) {
      if (motionHullInside(obstacle, hull[i], hull[i + 1], hull[i + 2])) return true;
    }
  }
  return false;
}

// Reuse snapshots while evaluating a whole physical pose, including its history.
// A trial never borrows the already-mutated spine from another rejected trial.
const motionContactRig = { before: null, after: null };
function motionContactTrial(whale, x, y, heading, nodes) {
  whale.x = x; whale.y = y; whale.heading = heading;
  whale.rig.nodes.set(nodes);
  updateWhaleRig(whale);
}

// On a seam, predict the real future rig before accepting any movement. Sliding
// and a partial step must keep the centre, bearing and historical nodes together.
function motionConstrainStep(whale, x, y, heading, obstacles, width, height, motionTick) {
  if (!obstacles?.length) return false;
  const seamReach = whale.length * 0.6 + motionHullReach(whale);
  if (Math.min(x, width - x, y, height - y) > seamReach) return false;
  const nodes = whale.rig.nodes;
  if (motionContactRig.before?.length !== nodes.length) {
    motionContactRig.before = new Float64Array(nodes.length);
    motionContactRig.after = new Float64Array(nodes.length);
  }
  const before = motionContactRig.before, after = motionContactRig.after;
  before.set(nodes);
  const endX = whale.x, endY = whale.y, endHeading = whale.heading;
  updateWhaleRig(whale);
  if (!motionWhaleBlocked(whale, obstacles)) return true;
  after.set(nodes);
  const travel = Math.hypot(endX - x, endY - y);
  let slid = false;
  for (const turnFraction of [1, 0.5, 0.25, 0]) {
    const trialHeading = heading + (endHeading - heading) * turnFraction;
    motionContactTrial(whale, endX, endY, trialHeading, before);
    for (let pass = 0; pass < 10; pass++) {
      let corrected = false;
      for (const obstacle of obstacles) {
        const hit = motionObstacleApproachBody(whale, obstacle, 0, true);
        if (!hit || !(hit.depth > 0)) continue;
        motionContactTrial(whale, whale.x + hit.nx * (hit.depth + 1e-8),
          whale.y + hit.ny * (hit.depth + 1e-8), trialHeading, before);
        corrected = true;
      }
      if (!corrected) break;
    }
    if (Math.hypot(whale.x - x, whale.y - y) <= travel + 1e-8
      && !motionWhaleBlocked(whale, obstacles)) {
      slid = true;
      break;
    }
  }
  if (!slid) {
    let best = null, bestScore = -Infinity;
    for (const turnFraction of [1, 0.5, 0.25]) {
      const trialHeading = heading + (endHeading - heading) * turnFraction;
      for (let i = 0; i < 16; i++) {
        const angle = Math.PI * 2 * i / 16;
        const dx = Math.cos(angle) * travel, dy = Math.sin(angle) * travel;
        motionContactTrial(whale, x + dx, y + dy, trialHeading, before);
        if (motionWhaleBlocked(whale, obstacles)) continue;
        const score = dx * (endX - x) + dy * (endY - y) + travel * travel * turnFraction * 0.05;
        if (score > bestScore) { bestScore = score; best = { x: whale.x, y: whale.y, heading: trialHeading }; }
      }
    }
    if (best) {
      motionContactTrial(whale, best.x, best.y, best.heading, before);
      slid = true;
    }
  }
  if (!slid) {
    // Interpolate the complete previous and proposed states. At zero progress
    // the exact safe historical rig is retained, rather than relaxing it again.
    const sample = t => {
      whale.x = x + (endX - x) * t;
      whale.y = y + (endY - y) * t;
      whale.heading = heading + (endHeading - heading) * t;
      for (let i = 0; i < nodes.length; i++) nodes[i] = before[i] + (after[i] - before[i]) * t;
      nodes[0] = whale.x + Math.cos(whale.heading) * whale.length * 1.04 / 2.24;
      nodes[1] = whale.y + Math.sin(whale.heading) * whale.length * 1.04 / 2.24;
    };
    let low = 0, high = 1;
    for (let i = 0; i < 20; i++) {
      const t = (low + high) * 0.5;
      sample(t);
      if (motionWhaleBlocked(whale, obstacles)) high = t;
      else low = t;
    }
    sample(low);
  }
  whale.vx = (whale.x - x) / motionTick;
  whale.vy = (whale.y - y) / motionTick;
  whale.speed = Math.hypot(whale.vx, whale.vy);
  whale.turn = (whale.heading - heading) / motionTick;
  return true;
}

/** Fold by whole periods only; obstacle safety is resolved before this seam. */
function motionFoldWhale(whale, width, height) {
  const dx = motionWrap(whale.x, width) - whale.x;
  const dy = motionWrap(whale.y, height) - whale.y;
  motionShiftWhale(whale, dx, dy);
}

// Find the closest pair of samples on two heading-extended bodies, including
// where those bodies will be after a short coast. A center-only check misses
// a nose crossing another whale's tail. Distances wrap, so two whales passing
// through opposite edges still separate.
function motionBodyContact(a, b, horizon, width, height) {
  const ac = Math.cos(a.heading), as = Math.sin(a.heading);
  const bc = Math.cos(b.heading), bs = Math.sin(b.heading);
  let bestSquared = Infinity, bestX = 0, bestY = 0;
  for (const ahead of [0, horizon]) {
    const dx = motionTorusDelta(a.x - b.x + (a.vx - b.vx) * ahead, width);
    const dy = motionTorusDelta(a.y - b.y + (a.vy - b.vy) * ahead, height);
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

// Cruise depth owns an independent random stream, so adding vertical motion
// cannot change route choices or the separate dive scheduler. All fields are
// scalars: scene adoption can copy them without sharing mutable state.
function motionCruiseDepth(whale, index, age) {
  const state = whale._motion;
  if (!Number.isFinite(state.cruiseBase)) {
    state.cruiseBase = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5);
    state.depthSeed = (motionSeed(whale, index) ^ 0x3c6ef372) >>> 0;
    state.depthFrom = state.cruiseBase;
    state.depthTarget = state.cruiseBase;
    state.depthStartedAt = state.age;
    state.depthDuration = 0;
    state.depthDirection = 1;
  }
  if (age >= state.depthStartedAt + state.depthDuration) {
    state.depthFrom = state.depthTarget;
    state.depthSeed = (Math.imul(state.depthSeed, 1664525) + 1013904223) >>> 0;
    const excursion = 0.14 + state.depthSeed / 4294967296 * 0.10;
    state.depthDirection *= -1;
    state.depthTarget = motionLimit(state.cruiseBase + state.depthDirection * excursion, 0.10, 2.5);
    state.depthStartedAt += state.depthDuration;
    state.depthSeed = (Math.imul(state.depthSeed, 1664525) + 1013904223) >>> 0;
    state.depthDuration = 20 + state.depthSeed / 4294967296 * 18;
  }
  const u = motionLimit((age - state.depthStartedAt) / state.depthDuration, 0, 1);
  whale.depth = state.depthFrom + (state.depthTarget - state.depthFrom) * u * u * (3 - 2 * u);
}

function motionIntegrate(scene, speed, motionTick) {
  const whales = scene.whales, width = scene.width, height = scene.height;
  const size = motionLimit(motionFinite(scene.whaleSize, 1), motionWhaleSizeFloor, motionWhaleSizeCeiling);
  // Update every body's geometry before reciprocal avoidance. Rescale historical
  // nodes about the centre without advancing their steering history twice.
  for (let i = 0; i < whales.length; i++) {
    const whale = whales[i], previousLength = whale.length;
    motionCruiseDepth(whale, i, whale._motion.age + motionTick * speed);
    motionGeometry(whale, width, height, whales.length, size);
    const nodes = whale.rig?.nodes, ratio = whale.length / previousLength;
    if (nodes && Number.isFinite(ratio) && ratio !== 1) {
      for (let j = 0; j < nodes.length; j += 2) {
        nodes[j] = whale.x + (nodes[j] - whale.x) * ratio;
        nodes[j + 1] = whale.y + (nodes[j + 1] - whale.y) * ratio;
      }
    }
  }
  const environmentSpeed = Math.min(1, Math.min(width, height) / 650);
  const obstacles = motionPeriodicObstacles(scene.obstacles, width, height);
  const forces = whales.map(() => ({ x: 0, y: 0, caution: 0 }));
  // Accumulate reciprocal forces before moving any body, so update order
  // cannot give a whale an advantage over its neighbor.
  for (let i = 0; i < whales.length; i++) {
    const a = whales[i];
    for (let j = i + 1; j < whales.length; j++) {
      const b = whales[j];
      const dx = motionTorusDelta(b.x - a.x, width), dy = motionTorusDelta(b.y - a.y, height);
      const distance = Math.hypot(dx, dy);
      const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
      const relativeSpeedSquared = dvx * dvx + dvy * dvy;
      const intercept = relativeSpeedSquared > 0.001
        ? motionLimit(-(dx * dvx + dy * dvy) / relativeSpeedSquared, 0, 2.6 / Math.max(0.3, speed)) : 0;
      const contact = motionBodyContact(a, b, intercept, width, height);
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
    const startX = whale.x, startY = whale.y, startHeading = whale.heading;
    const anatomy = whaleSpecies(whale.species);
    const activityKind = whale.activity?.kind;
    const activityPace = activityKind === 'running' ? 1.35
      : activityKind === 'waiting' ? 0.32 : activityKind === 'idle' ? 0.62 : 1;
    const travelTick = motionTick * speed;
    state.age += travelTick;
    motionPrepareDive(whale, i, scene.diveSeed, anatomy, travelTick, activityKind === 'waiting');
    const bearingHold = motionDiveBearingHold(state.dive, state.age);
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
    const nearSeam = Math.min(whale.x, width - whale.x, whale.y, height - whale.y)
      < whale.length * 0.6 + motionHullReach(whale);
    let seamBrake = 0;
    if (obstacles && obstacles.length) {
      // The band is where steering starts: outside the clamp boundary but close
      // enough to turn, measured from the nearest body station (hull included) so
      // a long snout or a wide fluke banks away while the centre still looks far.
      const band = Math.max(48, motionHullReach(whale) * 2, whale.length * 0.14);
      let caution = 0;
      for (const obstacle of obstacles) {
        const hit = motionObstacleApproachBody(whale, obstacle, band, obstacle.periodic === true);
        if (!hit) continue;
        if (nearSeam) {
          const contact = motionObstacleApproachBody(whale, obstacle, band, true);
          const closing = contact ? -(whale.vx * contact.nx + whale.vy * contact.ny) : 0;
          if (contact && closing > 0.1) {
            const gap = Math.max(0, -contact.depth);
            const cruise = state.cruise * environmentSpeed * speed * activityPace;
            const safePace = Math.max(cruise * 0.15, gap / 2.8);
            seamBrake = Math.max(seamBrake, 1 - motionLimit(safePace / Math.max(1, cruise), 0.15, 1));
          }
        }
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
    const cruise = state.cruise * environmentSpeed * speed * activityPace;
    // A heading that already points off the screen is committed. Turning back
    // here is what pinned a whale on a reef: the rock pushed it outward and the
    // screen edge pushed it back. It leaves instead, and folds in from the far side.
    const lookAhead = whale.length * 0.35 + cruise / Math.max(0.08, turnLimit);
    const lookX = whale.x + forwardX * lookAhead, lookY = whale.y + forwardY * lookAhead;
    if (lookX < 0 || lookX > width) {
      desiredX = forwardX * 1.7 + Math.cos(whale.heading + state.wander) * 0.2 + force.x;
    }
    if (lookY < 0 || lookY > height) {
      desiredY = forwardY * 1.7 + Math.sin(whale.heading + state.wander) * 0.2 + force.y;
    }
    if (bearingHold > 0) {
      const routine = 1 - bearingHold;
      desiredX = (desiredX - force.x) * routine + forwardX * 2.7 * bearingHold + force.x;
      desiredY = (desiredY - force.y) * routine + forwardY * 2.7 * bearingHold + force.y;
    }
    let steeringError = motionAngle(whale.heading, Math.atan2(desiredY, desiredX));
    if (Math.abs(steeringError) > 2.5) {
      const turnSide = Math.abs(whale.turn) > 0.05 ? Math.sign(whale.turn) : state.routeDirection;
      steeringError = Math.abs(steeringError) * turnSide;
    }
    const requestedTurn = motionLimit(steeringError * 1.1, -turnLimit, turnLimit);
    const turnResponse = 1.7 + (1 / 0.06 - 1.7) * bearingHold;
    whale.turn += (requestedTurn - whale.turn) * (1 - Math.exp(-motionTick * turnResponse));
    whale.turn = motionLimit(whale.turn, -turnLimit, turnLimit);
    whale.heading += whale.turn * motionTick;
    const targetSpeed = cruise * (1 - force.caution * 0.3) * (1 - seamBrake)
      * (1 - 0.12 * Math.abs(whale.turn) / Math.max(0.01, turnLimit));
    whale.speed += (targetSpeed - whale.speed) * (1 - Math.exp(-motionTick * (0.8 + seamBrake * 3.2)));
    whale.vx = Math.cos(whale.heading) * whale.speed;
    whale.vy = Math.sin(whale.heading) * whale.speed;
    whale.x += whale.vx * motionTick;
    whale.y += whale.vy * motionTick;
    if (!motionConstrainStep(whale, startX, startY, startHeading, obstacles, width, height, motionTick)) updateWhaleRig(whale);
    if (obstacles && obstacles.length) motionPushOut(whale, obstacles, width, height);
    motionFoldWhale(whale, width, height);
    const effort = whale.speed / Math.max(1, state.cruise * environmentSpeed);
    // Two smooth strokes followed by a coast. These durations are deliberately
    // calm decoration settings, not measured swimming periods for each species.
    const active = Math.PI * 4 / anatomy.beat, rest = active * anatomy.glide / (1 - anatomy.glide);
    const gait = (state.age + whale.phase * 1.7) % (active + rest);
    const easeStroke = value => { const t = motionLimit(value, 0, 1); return t * t * (3 - 2 * t); };
    const envelope = gait < active ? easeStroke(gait / 1.1) * easeStroke((active - gait) / 1.1) : 0;
    const activityStroke = activityKind === 'running' ? 0.35 + envelope * 0.65
      : envelope * (activityKind === 'waiting' ? 0.35 : activityKind === 'idle' ? 0.6 : 1);
    state.stroke += (activityStroke - state.stroke) * (1 - Math.exp(-travelTick * 2.2));
    state.wave += travelTick * anatomy.beat * (0.7 + 0.3 * Math.min(1.4, Math.sqrt(effort)))
      * (0.08 + 0.92 * state.stroke);
    motionStepDive(whale);
  }
  scene.time += motionTick;
}

// This gate only suppresses routine route/wander steering. Collision forces
// stay in the same physical controller and may override the decorative hold.
function motionDiveBearingHold(dive, age) {
  if (Number.isFinite(dive.returnStartedAt)) return 1;
  if (dive.startedAt === null) {
    return Number.isFinite(dive.bearingReleaseAt)
      ? 1 - diveSmoothstep((age - dive.bearingReleaseAt) / 0.6) : 0;
  }
  const elapsed = age - dive.startedAt;
  if (elapsed < 0) return 0;
  if (elapsed < dive.entry) return 1;
  if (elapsed < dive.entry + dive.under) {
    const hidden = elapsed - dive.entry;
    const release = 1 - diveSmoothstep(hidden / 0.2);
    const brakeWindow = Math.min(0.65, dive.under * 0.4);
    const preBrake = diveSmoothstep((hidden - dive.under + brakeWindow) / brakeWindow);
    return Math.max(release, preBrake);
  }
  const endedAt = dive.entry + dive.under + dive.exit;
  return elapsed < endedAt ? 1 : 1 - diveSmoothstep((elapsed - endedAt) / 0.6);
}

function diveSmoothstep(amount) {
  const u = amount < 0 ? 0 : amount > 1 ? 1 : amount;
  return u * u * (3 - 2 * u);
}

// Hash a separate stream from identity, never from the mutable cruise seed.
// Optional scene.diveSeed (or whale.diveSeed) is read only at the first tick,
// allowing the engine to supply session entropy after createScene's resize.
function motionDiveSeed(whale, index, sceneSeed) {
  const supplied = motionFinite(whale.diveSeed, motionFinite(sceneSeed, 0)) >>> 0;
  let seed = (motionSeed(whale, index) ^ supplied ^ 0x91e10da5) >>> 0;
  seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b);
  seed = Math.imul(seed ^ (seed >>> 13), 0xc2b2ae35);
  return (seed ^ (seed >>> 16)) >>> 0;
}

function motionPrepareDive(whale, index, sceneSeed, anatomy, dt, waiting) {
  const state = whale._motion;
  if (!state.dive) {
    const dive = state.dive = { seed: motionDiveSeed(whale, index, sceneSeed),
      activity: 0, nextDecision: 0, startedAt: null, entry: 0, under: 0, exit: 0,
      decisions: 0, skipped: 0, dives: 0, completed: 0,
      splashSerial: 0, splashKind: 'dive', splashStrength: 0, contactStage: 0 };
    dive.activity = 0.32 + motionRandom(dive) * 0.36;
    dive.nextDecision = Math.max(6, state.age - dt) + 2 + motionRandom(dive) * 16;
  }
  const dive = state.dive;
  const surfacePace = motionLimit(22 / anatomy.cruise, 0.75, 1.3);
  if (waiting && dive.startedAt !== null && !Number.isFinite(dive.returnStartedAt)) {
    // Retarget the visible pose, even mid-entry or mid-exit. Scalar snapshots
    // survive scene adoption without a shared object or a second animation clock.
    dive.returnStartedAt = state.age - dt;
    dive.returnSubmergence = state.submergence;
    dive.returnPitch = state.pitch;
    dive.returnDepth = state.depth;
    dive.returnTailKick = state.tailKick;
    dive.returnArch = state.arch;
    dive.returnNoseFirst = state.noseFirst;
    if (dive.contactStage < 2) {
      dive.contactStage = motionDiveContactHeight(whale, DIVE_NOSE_CONTACT) > DIVE_WATERLINE ? 1 : 2;
    }
  }
  const endedAt = Number.isFinite(dive.returnStartedAt)
    ? dive.returnStartedAt + dive.exit : dive.startedAt + dive.entry + dive.under + dive.exit;
  if (dive.startedAt !== null && state.age >= endedAt) {
    dive.startedAt = null;
    dive.returnStartedAt = null;
    dive.bearingReleaseAt = endedAt;
    dive.completed++;
    dive.nextDecision = endedAt + (10 + motionRandom(dive) * 16) * surfacePace;
  }
  // Keep an overdue opportunity at the present, so leaving a long wait cannot
  // start an action in the past and jump straight into its underwater pose.
  if (waiting && dive.startedAt === null) dive.nextDecision = Math.max(dive.nextDecision, state.age);
  if (!waiting && dive.startedAt === null && state.age >= dive.nextDecision) {
    dive.decisions++;
    if (motionRandom(dive) < dive.activity) {
      dive.startedAt = dive.nextDecision;
      dive.dives++;
      dive.contactStage = 0;
      // Snapshot the whole action. Later species/size changes do not truncate it.
      dive.entry = 2 + motionRandom(dive) * 2;
      dive.under = (3 + motionRandom(dive) * 4) * motionLimit(anatomy.glide / 0.32, 0.8, 1.5);
      dive.exit = 2.4 + motionRandom(dive) * 1.6;
    } else {
      dive.skipped++;
      dive.nextDecision += (5 + motionRandom(dive) * 10) * surfacePace;
    }
  }
}

function motionStepDive(whale) {
  const state = whale._motion, dive = state.dive;
  const returning = Number.isFinite(dive.returnStartedAt);
  if (returning) {
    const remaining = 1 - diveSmoothstep((state.age - dive.returnStartedAt) / dive.exit);
    state.submergence = dive.returnSubmergence * remaining;
    state.pitch = dive.returnPitch * remaining;
    state.depth = dive.returnDepth * remaining;
    state.tailKick = dive.returnTailKick * remaining;
    state.arch = dive.returnArch * remaining;
    // Switching the visibility direction mid-pose would reveal the other end.
    state.noseFirst = remaining > 0 && dive.returnNoseFirst;
  } else {
    const pose = dive.startedAt === null ? diveLevel() : divePose(state.age - dive.startedAt, dive);
    state.submergence = pose.submergence;
    state.pitch = pose.pitch;
    state.noseFirst = pose.noseFirst;
    state.depth = pose.depth;
    state.tailKick = pose.tailKick;
    state.arch = pose.arch;
  }
  if (dive.startedAt !== null && dive.contactStage < 2) {
    const elapsed = state.age - dive.startedAt;
    const isTail = dive.contactStage === 0;
    // Tail: wait until after the lift. Nose: wait until the ascent starts.
    // The height then comes from the very same rig, gait and curve as the mesh.
    if (returning || elapsed >= (isTail ? dive.entry * 0.46 : dive.entry + dive.under)) {
      const height = motionDiveContactHeight(whale, isTail ? DIVE_TAIL_CONTACT : DIVE_NOSE_CONTACT);
      if (isTail ? height >= DIVE_WATERLINE : height <= DIVE_WATERLINE) {
        dive.splashSerial++;
        dive.splashKind = isTail ? 'dive' : 'surface';
        dive.splashStrength = isTail ? 0.95 : 0.9;
        dive.contactStage++;
      }
    }
  }
}

// Reused probes and output avoid allocating a particle per tick. Contact state
// stays primitive so adopting a scene can keep its existing independent clone.
export const DIVE_TAIL_CONTACT = Object.freeze({ x: -1.05, y: 0.01, z: 0,
  nx: 0, ny: -1, nz: 0, part: 'fluke' });
export const DIVE_NOSE_CONTACT = Object.freeze({ x: 1.04, y: -0.08, z: 0,
  nx: 0, ny: -1, nz: 0, part: 'body' });
const motionDiveContactPose = {};
const motionDiveContactOut = {};

function motionDiveContactHeight(whale, point) {
  const state = whale._motion, pose = motionDiveContactPose;
  pose.wave = state.wave;
  pose.turn = whale.turn;
  pose.submergence = state.submergence;
  pose.divePitch = state.pitch;
  pose.diveDepth = state.depth;
  pose.diveKick = state.tailKick;
  pose.diveArch = state.arch;
  writeWhaleRigPose(whale, pose);
  return deformWhaleParticle(point, pose, motionDiveContactOut).y;
}

function motionEnsureDive(state) {
  if (!Number.isFinite(state.submergence)) state.submergence = 0;
  if (!Number.isFinite(state.pitch)) state.pitch = 0;
  if (!Number.isFinite(state.depth)) state.depth = 0;
  if (!Number.isFinite(state.tailKick)) state.tailKick = 0;
  if (!Number.isFinite(state.arch)) state.arch = 0;
  if (state.noseFirst !== true && state.noseFirst !== false) state.noseFirst = false;
}

function diveLevel() {
  return { submergence: 0, pitch: 0, noseFirst: false, depth: 0, tailKick: 0, arch: 0 };
}

/** Pure pose for one sampled action; elapsed starts at entry, never repeats. */
export function divePose(elapsed, timing) {
  if (!Number.isFinite(elapsed) || !timing) return diveLevel();
  const { entry, under, exit } = timing;
  if (![entry, under, exit].every(value => Number.isFinite(value) && value > 0)
    || elapsed <= 0 || elapsed >= entry + under + exit) return diveLevel();
  let t = elapsed;
  if (t < entry) {
    const u = t / entry;
    const submergence = diveSmoothstep(u);
    const pitch = u < 0.38 ? 0.5 * diveSmoothstep(u / 0.38)
      : 0.5 + 0.22 * diveSmoothstep((u - 0.38) / 0.62);
    const depth = 0.12 * diveSmoothstep((u - 0.2) / 0.35)
      + 1.08 * diveSmoothstep((u - 0.55) / 0.45);
    const tailKick = u < 0.46 ? -0.55 * diveSmoothstep((u - 0.18) / 0.28)
      : u < 0.68 ? -0.55 + 1.05 * diveSmoothstep((u - 0.46) / 0.22)
        : 0.5 * (1 - diveSmoothstep((u - 0.68) / 0.24));
    const arch = 0.13 * diveSmoothstep(u / 0.35) * (1 - diveSmoothstep((u - 0.65) / 0.35));
    return { submergence, pitch, noseFirst: false, depth, tailKick, arch };
  }
  t -= entry;
  if (t < under) {
    return { submergence: 1, pitch: 0.72 * (1 - diveSmoothstep(t / under)),
      noseFirst: false, depth: 1.2, tailKick: 0, arch: 0 };
  }
  t -= under;
  const u = t / exit;
  // Establish a readable head first, then let the shoulders and tail follow.
  // A whole-body heave plus an arched back makes thick-backed species appear
  // to surface from the middle even when a single nose probe leads by a frame.
  const pitch = u < 0.22 ? -0.58 * diveSmoothstep(u / 0.22)
    : u < 0.48 ? -0.58 : -0.58 * (1 - diveSmoothstep((u - 0.48) / 0.52));
  const depth = u < 0.24 ? 1.2 - 0.58 * diveSmoothstep(u / 0.24)
    : u < 0.48 ? 0.62 - 0.04 * diveSmoothstep((u - 0.24) / 0.24)
      : u < 0.76 ? 0.58 - 0.68 * diveSmoothstep((u - 0.48) / 0.28)
        : -0.1 * (1 - diveSmoothstep((u - 0.76) / 0.24));
  const arch = 0;
  const submergence = u < 0.65 ? 1 - 0.8 * diveSmoothstep(u / 0.65)
    : 0.2 * (1 - diveSmoothstep((u - 0.65) / 0.35));
  return { submergence, pitch, noseFirst: submergence > 0, depth, tailKick: 0, arch };
}

/** Integrate a capped frame in fixed ticks; no DOM or wall-clock dependency. */
export function stepScene(scene, dt, speed = 1, metrics = null, integrationTick = motionTick) {
  if (!Number.isFinite(dt) || dt <= 0) return scene;
  speed = motionLimit(motionFinite(speed, 1), 0, 3);
  if (speed === 0) return scene;
  if (!(scene.width > 0 && scene.height > 0)
    || scene.whales.some(whale => !whale._motion)) {
    resizeScene(scene, scene.width || 1600, scene.height || 900);
  }
  scene.accumulator = motionFinite(scene.accumulator, 0) + Math.min(dt, 0.25);
  while (scene.accumulator + 1e-10 >= integrationTick) {
    const started = metrics?.begin();
    motionIntegrate(scene, speed, integrationTick);
    metrics?.end('motionStep', started);
    scene.accumulator = Math.max(0, scene.accumulator - integrationTick);
  }
  return scene;
}

/** Projection compatible with transformParticle; elapsed never sets position. */
export function whalePose(whale, elapsed, width, height, speed, out = {}) {
  width = Math.max(1, motionFinite(width, 1));
  height = Math.max(1, motionFinite(height, 1));
  const phase = motionFinite(whale.phase, 0), state = whale._motion;
  if (state) motionEnsureDive(state);
  const age = state ? state.age : motionFinite(elapsed, 0) * motionFinite(speed, 1);
  const heading = motionFinite(whale.heading, 0), turn = motionFinite(whale.turn, 0);
  const depth = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5);
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
    submergence: state ? state.submergence : 0,
    divePitch: state ? state.pitch : 0,
    diveDepth: state ? state.depth : 0,
    diveKick: state ? state.tailKick : 0,
    diveArch: state ? state.arch : 0,
    noseFirst: state ? state.noseFirst : false,
    cy, sy, cp, sp, cr: Math.cos(roll), sr: Math.sin(roll) });
  return writeWhaleRigPose(whale, out);
}
