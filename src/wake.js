// A distance-sampled history of displaced surface water. Nothing in this module
// reads a clock, Canvas or global randomness; old packets keep their own bearing.
const WAKE_MAX_PACKETS = 96;
const WAKE_MAX_GLYPHS = 1200;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const wrap = (value, span) => ((value % span) + span) % span;
const delta = (value, span) => value - Math.round(value / span) * span;
const turn = value => Math.atan2(Math.sin(value), Math.cos(value));

function identity(whale, index) {
  return Number.isFinite(whale.id) || typeof whale.id === 'string' ? whale.id : -1 - index;
}
function seedAt(key, sequence) {
  const text = String(key);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ sequence, 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}
function trailingFrame(whale) {
  const nodes = whale.rig?.nodes;
  if (nodes && nodes.length >= 4) {
    const end = nodes.length - 2, x = nodes[end], y = nodes[end + 1];
    const dx = nodes[end - 2] - x, dy = nodes[end - 1] - y;
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(dx) && Number.isFinite(dy)
      && Math.hypot(dx, dy) > 0.001) return { x, y, angle: Math.atan2(dy, dx) };
  }
  const angle = finite(whale.heading), length = Math.max(0, finite(whale.length));
  return { x: whale.x - Math.cos(angle) * length * 0.54,
    y: whale.y - Math.sin(angle) * length * 0.54, angle };
}

export function createWakeField() {
  return { packets: [], tracks: new Map(), width: 0, height: 0 };
}
export function resetWakeField(field) {
  if (!field || typeof field !== 'object') return field;
  if (Array.isArray(field.packets)) field.packets.length = 0;
  else field.packets = [];
  if (field.tracks instanceof Map) field.tracks.clear();
  else field.tracks = new Map();
  field.width = field.height = 0;
  return field;
}

/** Emit by distance travelled, including passive glides, rather than tail beats. */
export function stepWake(field, scene, elapsed, options = {}) {
  const dt = finite(elapsed);
  if (!field || typeof field !== 'object' || !(dt > 0)) return field;
  if (!Array.isArray(field.packets) || !(field.tracks instanceof Map)) resetWakeField(field);
  const width = finite(scene?.width), height = finite(scene?.height);
  if (width > 0 && height > 0 && field.width > 0
    && (field.width !== width || field.height !== height)) resetWakeField(field);
  for (let i = field.packets.length - 1; i >= 0; i--) {
    const packet = field.packets[i];
    if (!packet || !Number.isFinite(packet.age) || !Number.isFinite(packet.life)
      || !Number.isFinite(packet.x) || !Number.isFinite(packet.y)
      || (packet.age += dt) >= packet.life) field.packets.splice(i, 1);
  }
  if (!(width > 0 && height > 0)) { field.tracks.clear(); return field; }
  field.width = width; field.height = height;
  const limit = Math.floor(clamp(finite(options?.maxWakePackets, WAKE_MAX_PACKETS), 0, WAKE_MAX_PACKETS));
  while (field.packets.length > limit) field.packets.shift();
  const whales = Array.isArray(scene?.whales) ? scene.whales : [];
  const live = new Set();
  for (let i = 0; i < whales.length; i++) {
    const whale = whales[i];
    if (!whale || !Number.isFinite(whale.x) || !Number.isFinite(whale.y)) continue;
    const key = identity(whale, i), tail = trailingFrame(whale), motion = whale._motion;
    live.add(key);
    const previous = field.tracks.get(key);
    const radius = clamp(finite(whale.bodyRadius, finite(whale.length, 120) * 0.08), 4, 90);
    const current = { x: whale.x, y: whale.y, tailX: tail.x, tailY: tail.y, angle: tail.angle,
      radius, distance: 0, sequence: previous?.sequence ?? 0 };
    field.tracks.set(key, current);
    const submergence = clamp(finite(motion?.submergence));
    const diving = motion?.dive && Number.isFinite(motion.dive.startedAt);
    // Gradual cruise-depth changes preserve the trail; a discrete geometry
    // change still establishes a fresh anchor instead of connecting old poses.
    const resized = previous && Math.abs(previous.radius - radius) > Math.max(0.5, previous.radius * 0.05);
    if (!previous || dt > 0.5 || diving || submergence >= 0.12 || resized) continue;
    const dx = delta(whale.x - previous.x, width), dy = delta(whale.y - previous.y, height);
    const distance = Math.hypot(dx, dy);
    const tailDX = delta(tail.x - previous.tailX, width), tailDY = delta(tail.y - previous.tailY, height);
    const pace = Math.max(1, Math.abs(finite(whale.speed)), Math.abs(finite(motion?.cruise)));
    // Navigation corrections, teleports and long resumes establish a fresh anchor.
    // They cannot leave a line connecting two unrelated positions.
    if (distance > Math.max(3, pace * dt * 2.5)
      || Math.hypot(tailDX, tailDY) > Math.max(6, distance * 4 + radius * 0.3)) continue;
    if (distance < 0.0001) { current.distance = previous.distance; continue; }
    const speed = distance / dt;
    if (speed < 0.5) continue;
    const spacing = clamp(radius * 0.65, 10, 24), total = previous.distance + distance;
    const count = Math.floor(total / spacing);
    current.distance = total % spacing;
    const strength = (1 - smooth(submergence / 0.12)) * (0.28 + 0.72 * clamp(speed / Math.max(12, radius * 0.8)));
    for (let emitted = Math.max(0, count - 4); emitted < count && limit > 0; emitted++) {
      const t = clamp((spacing * (emitted + 1) - previous.distance) / distance);
      const seed = seedAt(key, ++current.sequence);
      while (field.packets.length >= limit) field.packets.shift();
      field.packets.push({ x: wrap(previous.tailX + tailDX * t, width),
        y: wrap(previous.tailY + tailDY * t, height),
        angle: previous.angle + turn(tail.angle - previous.angle) * t,
        age: dt * (1 - t), life: 5.8 + seed * 1.4, radius,
        span: spacing * 2.4, speed, strength, seed });
    }
  }
  for (const key of field.tracks.keys()) if (!live.has(key)) field.tracks.delete(key);
  return field;
}

/** Supply bounded geometric glyph samples; paint returns true only for a visible cell. */
export function visitWakePoints(field, options, paint) {
  const packets = field?.packets;
  if (!Array.isArray(packets) || typeof paint !== 'function') return 0;
  const width = finite(options?.width, field.width), height = finite(options?.height, field.height);
  if (!(width > 0 && height > 0)) return 0;
  const cell = Math.max(2, (finite(options?.cellWidth, 11) + finite(options?.cellHeight, 13)) * 0.5);
  const limit = Math.floor(clamp(finite(options?.maxWakeGlyphs, WAKE_MAX_GLYPHS), 0, WAKE_MAX_GLYPHS));
  let drawn = 0;
  const emit = (x, y, glyph, alpha, light) => {
    if (drawn < limit && paint(wrap(x, width), wrap(y, height), glyph, alpha, light)) drawn++;
  };
  // Prefer fresh crests when a crowded school reaches the shared drawing budget.
  for (let p = Math.min(packets.length, WAKE_MAX_PACKETS) - 1; p >= 0 && drawn < limit; p--) {
    const packet = packets[p];
    if (!packet || ![packet.x, packet.y, packet.angle, packet.age, packet.life,
      packet.radius, packet.span, packet.speed, packet.strength, packet.seed].every(Number.isFinite)) continue;
    const progress = clamp(packet.age / Math.max(0.001, packet.life));
    const alpha = clamp(packet.strength) * (1 - progress) ** 1.5
      * (0.35 + 0.65 * smooth(packet.age / 0.25));
    if (!(alpha > 0.015)) continue;
    const fx = Math.cos(packet.angle), fy = Math.sin(packet.angle), nx = -fy, ny = fx;
    const spread = packet.age * (packet.radius * 0.28 + packet.speed * 0.14);
    const samples = Math.floor(clamp(Math.ceil(packet.span / (cell * 0.8)), 4, 12));
    for (const side of [-1, 1]) for (let i = 0; i < samples && drawn < limit; i++) {
      if ((i + Math.floor(packet.seed * 17)) % 7 === 0) continue;
      const u = i / (samples - 1), along = (0.5 - u) * packet.span;
      const lateral = side * (packet.radius * (0.26 + 0.4 * u)
        + spread + Math.sin(u * Math.PI) * packet.radius * 0.18);
      const tangentX = -fx * packet.span + nx * side * packet.radius * (0.4 + Math.cos(u * Math.PI) * 0.18 * Math.PI);
      const tangentY = -fy * packet.span + ny * side * packet.radius * (0.4 + Math.cos(u * Math.PI) * 0.18 * Math.PI);
      const glyph = Math.abs(tangentY) < Math.abs(tangentX) * 0.45
        ? (i % 3 === 0 ? '~' : '-') : Math.abs(tangentX) < Math.abs(tangentY) * 0.35
          ? ':' : tangentX * tangentY > 0 ? '\\' : '/';
      emit(packet.x + fx * along + nx * lateral, packet.y + fy * along + ny * lateral,
        glyph, alpha * (0.55 + 0.3 * Math.sin(u * Math.PI)), 0.28 + packet.seed * 0.10);
    }
    // A few low-contrast fragments keep the centre broken, without turning a
    // cruising wake into a continuous splash or a chain of circular rings.
    for (let i = 0; i < 2 && drawn < limit; i++) {
      const along = -packet.span * (0.15 + i * 0.24);
      const lateral = (packet.seed - 0.5) * packet.radius * 0.35;
      emit(packet.x + fx * along + nx * lateral, packet.y + fy * along + ny * lateral,
        i ? "'" : '.', alpha * 0.24, 0.46);
    }
  }
  return drawn;
}
