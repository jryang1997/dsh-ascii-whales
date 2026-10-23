import { WHALE_SPECIES, whaleSpecies } from './species.js';

const RIG_NODES = 18;
const RIG_SPAN = 2.24;
const RIG_NOSE = 1.04;
const rigLimit = (value, low, high) => Math.max(low, Math.min(high, value));
const rigAngle = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const rigSmooth = value => { const t = rigLimit(value, 0, 1); return t * t * (3 - 2 * t); };

export function resetWhaleRig(whale) {
  const length = Math.max(1, whale.length || 400);
  const nodes = new Float64Array(RIG_NODES * 2);
  const c = Math.cos(whale.heading), s = Math.sin(whale.heading);
  for (let i = 0; i < RIG_NODES; i++) {
    const along = length * (RIG_NOSE / RIG_SPAN - i / (RIG_NODES - 1));
    nodes[i * 2] = whale.x + c * along;
    nodes[i * 2 + 1] = whale.y + s * along;
  }
  whale.rig = { nodes };
  return whale.rig;
}

export function updateWhaleRig(whale) {
  if (!whale.rig) resetWhaleRig(whale);
  const nodes = whale.rig.nodes, length = Math.max(1, whale.length);
  const head = length * RIG_NOSE / RIG_SPAN, segment = length / (RIG_NODES - 1);
  nodes[0] = whale.x + Math.cos(whale.heading) * head;
  nodes[1] = whale.y + Math.sin(whale.heading) * head;
  let forward = whale.heading;
  for (let i = 1; i < RIG_NODES; i++) {
    const j = i * 2, px = nodes[j - 2], py = nodes[j - 1];
    const history = Math.atan2(py - nodes[j + 1], px - nodes[j]);
    // The anterior body resists bending; the peduncle follows a broad turn.
    const jointLimit = 0.018 + 0.038 * (i / (RIG_NODES - 1)) ** 1.5;
    forward += rigLimit(rigAngle(forward, history), -jointLimit, jointLimit);
    nodes[j] = px - Math.cos(forward) * segment;
    nodes[j + 1] = py - Math.sin(forward) * segment;
  }
}

export function resizeWhaleRig(whale, scaleX, scaleY) {
  if (!whale.rig) { resetWhaleRig(whale); return; }
  const nodes = whale.rig.nodes;
  for (let i = 0; i < nodes.length; i += 2) { nodes[i] *= scaleX; nodes[i + 1] *= scaleY; }
  updateWhaleRig(whale);
}

export function writeWhaleRigPose(whale, pose) {
  if (!whale.rig) resetWhaleRig(whale);
  const nodes = whale.rig.nodes;
  const spine = pose.spine?.length === RIG_NODES * 4 ? pose.spine : new Float64Array(RIG_NODES * 4);
  const c = Math.cos(whale.heading), s = Math.sin(whale.heading);
  const scale = RIG_SPAN / Math.max(1, whale.length);
  for (let i = 0; i < RIG_NODES; i++) {
    const k = i * 2, before = Math.max(0, i - 1) * 2, after = Math.min(RIG_NODES - 1, i + 1) * 2;
    const dx = nodes[k] - whale.x, dy = nodes[k + 1] - whale.y;
    const fx = nodes[before] - nodes[after], fy = nodes[before + 1] - nodes[after + 1];
    const magnitude = Math.hypot(fx, fy) || 1;
    spine[i * 4] = (c * dx + s * dy) * scale;
    spine[i * 4 + 1] = (-s * dx + c * dy) * scale;
    spine[i * 4 + 2] = (c * fx + s * fy) / magnitude;
    spine[i * 4 + 3] = (-s * fx + c * fy) / magnitude;
  }
  pose.spine = spine;
  pose.anatomy = whaleSpecies(whale.species);
  pose.stroke = whale._motion?.stroke ?? 1;
  pose.diveEngagement = rigDiveEngagement(pose);
  const dive = Number.isFinite(pose.divePitch) ? pose.divePitch : 0;
  pose.diveSin = Math.sin(dive);
  pose.diveCos = Math.cos(dive);
  return pose;
}

function rigDiveEngagement(pose) {
  const sub = Number.isFinite(pose.submergence) ? pose.submergence : 0;
  const depth = Number.isFinite(pose.diveDepth) ? pose.diveDepth : 0;
  const pitch = Number.isFinite(pose.divePitch) ? pose.divePitch : 0;
  const kick = Number.isFinite(pose.diveKick) ? pose.diveKick : 0;
  return rigSmooth(Math.max(sub * 8, Math.abs(depth) * 4, Math.abs(pitch) * 3, Math.abs(kick) * 2));
}

export function deformWhaleParticle(p, pose, out) {
  const anatomy = pose.anatomy || WHALE_SPECIES.blue;
  let x = p.x, y = p.y, z = p.z, nx = p.nx, ny = p.ny, nz = p.nz;
  const bank = rigLimit((pose.turn || 0) * 0.28, -0.09, 0.09);
  const wave = pose.wave || 0;
  let stroke = pose.stroke ?? 1;
  const engagement = Number.isFinite(pose.diveEngagement) ? pose.diveEngagement : rigDiveEngagement(pose);
  if (engagement > 0) stroke *= 1 - engagement;
  const kick = Number.isFinite(pose.diveKick) ? pose.diveKick : 0;
  const arch = Number.isFinite(pose.diveArch) ? pose.diveArch : 0;
  let bind = x;
  if (p.part === 'fin') {
    const root = anatomy.flipper.root;
    bind = root[0];
    const side = z < 0 ? -1 : 1, rootZ = side * root[2];
    // Flippers trim and steer. They are not continuously rowing wings.
    const flap = side * Math.sin(wave * 0.24 + 0.3) * 0.025 + bank * 0.7;
    const cf = Math.cos(flap), sf = Math.sin(flap), dy = y - root[1], dz = z - rootZ;
    y = root[1] + cf * dy - sf * dz; z = rootZ + sf * dy + cf * dz;
    const normalY = cf * ny - sf * nz; nz = sf * ny + cf * nz; ny = normalY;
    const sweep = bank * 0.1, cs = Math.cos(sweep), ss = Math.sin(sweep), dx = x - bind, lateral = z - rootZ;
    x = bind + cs * dx + ss * lateral; z = rootZ - ss * dx + cs * lateral;
    const normalX = cs * nx + ss * nz; nz = -ss * nx + cs * nz; nx = normalX;
  } else if (p.part === 'fluke') {
    bind = -0.96;
    let pitch = Math.cos(wave - 1.2) * 0.24 * stroke;
    if (kick !== 0) pitch -= kick * 0.65;
    const c = Math.cos(pitch), s = Math.sin(pitch), dx = x - bind, dy = y - 0.01;
    x = bind + c * dx - s * dy; y = 0.01 + s * dx + c * dy;
    const normalX = c * nx - s * ny; ny = s * nx + c * ny; nx = normalX;
    // Both lobes travel together vertically; only a small elastic lag remains.
    const side = z < 0 ? -1 : 1, flex = side * Math.sin(wave - 1.55) * 0.035 * stroke;
    const cf = Math.cos(flex), sf = Math.sin(flex), fy = y - 0.01, fz = z - side * 0.012;
    y = 0.01 + cf * fy - sf * fz; z = side * 0.012 + sf * fy + cf * fz;
    const normalY = cf * ny - sf * nz; nz = sf * ny + cf * nz; ny = normalY;
  } else if (p.part === 'dorsal') bind = anatomy.dorsal?.root[0] ?? x;

  let cx = bind, cy = 0, tx = 1, ty = 0;
  if (pose.spine) {
    const u = rigLimit((RIG_NOSE - bind) / RIG_SPAN, 0, 1) * (RIG_NODES - 1);
    const i = Math.min(RIG_NODES - 2, Math.floor(u)), t = u - i, a = i * 4, b = a + 4;
    const spine = pose.spine, t2 = t * t, t3 = t2 * t;
    const chord = Math.hypot(spine[b] - spine[a], spine[b + 1] - spine[a + 1]);
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    cx = h00 * spine[a] - h10 * chord * spine[a + 2] + h01 * spine[b] - h11 * chord * spine[b + 2];
    cy = h00 * spine[a + 1] - h10 * chord * spine[a + 3] + h01 * spine[b + 1] - h11 * chord * spine[b + 3];
    const d00 = 6 * t2 - 6 * t, d10 = 3 * t2 - 4 * t + 1, d01 = -d00, d11 = 3 * t2 - 2 * t;
    tx = -(d00 * spine[a] - d10 * chord * spine[a + 2] + d01 * spine[b] - d11 * chord * spine[b + 2]);
    ty = -(d00 * spine[a + 1] - d10 * chord * spine[a + 3] + d01 * spine[b + 1] - d11 * chord * spine[b + 3]);
    const magnitude = Math.hypot(tx, ty) || 1; tx /= magnitude; ty /= magnitude;
    const extension = bind - rigLimit(bind, -1.2, RIG_NOSE);
    cx += tx * extension; cy += ty * extension;
  }

  // The stroke bends in x/y (up and down), independent of the historical
  // x/z steering curve. Preserve surface normals through both rotations.
  const u = rigLimit((0.5 - bind) / 1.46, 0, 1), ramp = rigSmooth(u);
  const phase = wave - u * 1.2;
  let heave = anatomy.amplitude * ramp * ramp * Math.sin(phase) * stroke;
  const rampDerivative = u > 0 && u < 1 ? -6 * u * (1 - u) / 1.46 : 0;
  let slope = anatomy.amplitude * stroke * (2 * ramp * rampDerivative * Math.sin(phase)
    + ramp * ramp * Math.cos(phase) * (u > 0 && u < 1 ? 1.2 / 1.46 : 0));
  if (kick !== 0) {
    heave += kick * ramp * ramp;
    slope += kick * 2 * ramp * rampDerivative;
  }
  if (arch !== 0) {
    const a = rigLimit((bind + 1.05) / 1.9, 0, 1), b = 1 - a;
    heave -= arch * 16 * a * a * b * b;
    slope -= arch * 32 * a * b * (1 - 2 * a) / 1.9;
  }
  const pitch = Math.atan(slope), cv = Math.cos(pitch), sv = Math.sin(pitch);
  const along = x - bind, localX = cv * along - sv * y;
  const vertical = heave + sv * along + cv * y;
  const localNX = cv * nx - sv * ny, verticalNY = sv * nx + cv * ny;
  const cb = Math.cos(bank), sb = Math.sin(bank);
  const verticalY = cb * vertical - sb * z, lateral = sb * vertical + cb * z;
  const verticalNormal = cb * verticalNY - sb * nz, lateralNormal = sb * verticalNY + cb * nz;
  out.x = cx + tx * localX + ty * lateral;
  out.y = verticalY;
  out.z = -cy - ty * localX + tx * lateral;
  out.nx = tx * localNX + ty * lateralNormal;
  out.ny = verticalNormal;
  out.nz = -ty * localNX + tx * lateralNormal;
  const dive = pose.divePitch;
  if (Number.isFinite(dive) && dive !== 0) {
    const cd = Number.isFinite(pose.diveCos) ? pose.diveCos : Math.cos(dive);
    const sd = Number.isFinite(pose.diveSin) ? pose.diveSin : Math.sin(dive);
    if (Math.abs(cy) < 1e-12 && Math.abs(ty) < 1e-12 && Math.abs(tx - 1) < 1e-12) {
      // Preserve the original straight-body path, including its arithmetic.
      const ox = out.x, oy = out.y;
      out.x = cd * ox - sd * oy;
      out.y = sd * ox + cd * oy;
      const nx = out.nx, ny = out.ny;
      out.nx = cd * nx - sd * ny;
      out.ny = sd * nx + cd * ny;
    } else {
      // Both components of the historical centreline foreshorten together.
      // Rotate along/vertical in the local tangent frame; lateral width and
      // follow-through remain attached to that same unmodified spine.
      const pitchedAlong = cd * localX - sd * verticalY;
      const pitchedNormal = cd * localNX - sd * verticalNormal;
      out.x = cd * cx + tx * pitchedAlong + ty * lateral;
      out.z = -cd * cy - ty * pitchedAlong + tx * lateral;
      out.y = sd * (bind + localX) + cd * verticalY;
      out.nx = tx * pitchedNormal + ty * lateralNormal;
      out.nz = -ty * pitchedNormal + tx * lateralNormal;
      out.ny = sd * localNX + cd * verticalNormal;
    }
  }
  if (Number.isFinite(pose.diveDepth) && pose.diveDepth !== 0) out.y += pose.diveDepth;
  return out;
}
