(() => {
  // src/species.js
  var WHALE_SPECIES = Object.freeze({
    blue: {
      name: "蓝鲸",
      height: 1.05,
      pleats: true,
      profile: [[-1, 0.018], [-0.82, 0.035], [-0.58, 0.073], [-0.28, 0.13], [0.08, 0.177], [0.4, 0.193], [0.64, 0.171], [0.84, 0.135], [0.97, 0.105], [1.025, 0.061], [1.04, 0]],
      flipper: { root: [0.34, 0.078, 0.153], tip: [0.01, 0.115, 0.39], width: 0.052, thickness: 0.012 },
      fluke: { span: 0.35, tipX: -1.115, leadingX: -0.9, trailingX: -1.2, notch: 0.072, width: 0.018 },
      dorsal: { root: [-0.62, -0.064, 0], tip: [-0.71, -0.16, 0], width: 0.055 },
      cruise: 25,
      turnRate: 0.22,
      beat: 1.45,
      amplitude: 0.1,
      glide: 0.32,
      size: 1
    },
    humpback: {
      name: "座头鲸",
      height: 1.02,
      pleats: true,
      profile: [[-1, 0.021], [-0.82, 0.043], [-0.58, 0.09], [-0.28, 0.17], [0.08, 0.227], [0.36, 0.244], [0.62, 0.209], [0.8, 0.158], [0.95, 0.113], [1.025, 0.054], [1.04, 0]],
      flipper: { root: [0.35, 0.1, 0.194], tip: [-0.12, 0.14, 0.79], width: 0.079, thickness: 0.014 },
      fluke: { span: 0.435, tipX: -1.115, leadingX: -0.855, trailingX: -1.2, notch: 0.095, width: 0.021 },
      dorsal: { root: [-0.36, -0.145, 0], tip: [-0.45, -0.3, 0], width: 0.085 },
      cruise: 22,
      turnRate: 0.25,
      beat: 1.65,
      amplitude: 0.12,
      glide: 0.28,
      size: 0.93
    },
    sperm: {
      name: "抹香鲸",
      height: 1.15,
      pleats: false,
      profile: [[-1, 0.024], [-0.82, 0.05], [-0.59, 0.099], [-0.28, 0.16], [0.05, 0.209], [0.36, 0.237], [0.62, 0.249], [0.9, 0.247], [1.015, 0.231], [1.04, 0.172]],
      flipper: { root: [0.29, 0.125, 0.193], tip: [-0.025, 0.16, 0.39], width: 0.075, thickness: 0.015 },
      fluke: { span: 0.37, tipX: -1.09, leadingX: -0.855, trailingX: -1.2, notch: 0.09, width: 0.023 },
      dorsal: { root: [-0.39, -0.16, 0], tip: [-0.44, -0.245, 0], width: 0.13 },
      cruise: 21,
      turnRate: 0.19,
      beat: 1.35,
      amplitude: 0.1,
      glide: 0.4,
      size: 0.96
    },
    fin: {
      name: "长须鲸",
      height: 1.1,
      pleats: true,
      profile: [[-1, 0.017], [-0.82, 0.031], [-0.58, 0.065], [-0.28, 0.115], [0.08, 0.163], [0.38, 0.178], [0.6, 0.157], [0.8, 0.111], [0.96, 0.049], [1.04, 0]],
      flipper: { root: [0.35, 0.08, 0.14], tip: [0.02, 0.12, 0.345], width: 0.045, thickness: 0.011 },
      fluke: { span: 0.315, tipX: -1.135, leadingX: -0.92, trailingX: -1.2, notch: 0.06, width: 0.017 },
      dorsal: { root: [-0.41, -0.11, 0], tip: [-0.52, -0.27, 0], width: 0.065 },
      cruise: 29,
      turnRate: 0.24,
      beat: 1.6,
      amplitude: 0.092,
      glide: 0.3,
      size: 0.98
    },
    bowhead: {
      name: "弓头鲸",
      height: 1.08,
      pleats: false,
      profile: [[-1, 0.025], [-0.82, 0.053], [-0.59, 0.116], [-0.28, 0.215], [0.02, 0.284], [0.3, 0.295], [0.53, 0.259], [0.76, 0.198], [0.94, 0.116], [1.025, 0.052], [1.04, 0]],
      flipper: { root: [0.27, 0.14, 0.238], tip: [-0.11, 0.18, 0.55], width: 0.123, thickness: 0.019 },
      fluke: { span: 0.445, tipX: -1.08, leadingX: -0.83, trailingX: -1.2, notch: 0.1, width: 0.025 },
      dorsal: null,
      cruise: 18,
      turnRate: 0.18,
      beat: 1.2,
      amplitude: 0.11,
      glide: 0.43,
      size: 0.94
    }
  });
  var SPECIES_IDS = Object.freeze(Object.keys(WHALE_SPECIES));
  function whaleSpecies(id) {
    return WHALE_SPECIES[id] || WHALE_SPECIES.blue;
  }

  // src/rig.js
  var RIG_NODES = 18;
  var RIG_SPAN = 2.24;
  var RIG_NOSE = 1.04;
  var rigLimit = (value, low, high) => Math.max(low, Math.min(high, value));
  var rigAngle = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  var rigSmooth = (value) => {
    const t = rigLimit(value, 0, 1);
    return t * t * (3 - 2 * t);
  };
  function resetWhaleRig(whale) {
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
  function updateWhaleRig(whale) {
    if (!whale.rig) resetWhaleRig(whale);
    const nodes = whale.rig.nodes, length = Math.max(1, whale.length);
    const head = length * RIG_NOSE / RIG_SPAN, segment = length / (RIG_NODES - 1);
    nodes[0] = whale.x + Math.cos(whale.heading) * head;
    nodes[1] = whale.y + Math.sin(whale.heading) * head;
    let forward = whale.heading;
    for (let i = 1; i < RIG_NODES; i++) {
      const j = i * 2, px = nodes[j - 2], py = nodes[j - 1];
      const history = Math.atan2(py - nodes[j + 1], px - nodes[j]);
      const jointLimit = 0.018 + 0.038 * (i / (RIG_NODES - 1)) ** 1.5;
      forward += rigLimit(rigAngle(forward, history), -jointLimit, jointLimit);
      nodes[j] = px - Math.cos(forward) * segment;
      nodes[j + 1] = py - Math.sin(forward) * segment;
    }
  }
  function resizeWhaleRig(whale, scaleX, scaleY) {
    if (!whale.rig) {
      resetWhaleRig(whale);
      return;
    }
    const nodes = whale.rig.nodes;
    for (let i = 0; i < nodes.length; i += 2) {
      nodes[i] *= scaleX;
      nodes[i + 1] *= scaleY;
    }
    updateWhaleRig(whale);
  }
  function writeWhaleRigPose(whale, pose) {
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
  function deformWhaleParticle(p, pose, out) {
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
    if (p.part === "fin") {
      const root = anatomy.flipper.root;
      bind = root[0];
      const side = z < 0 ? -1 : 1, rootZ = side * root[2];
      const flap = side * Math.sin(wave * 0.24 + 0.3) * 0.025 + bank * 0.7;
      const cf = Math.cos(flap), sf = Math.sin(flap), dy = y - root[1], dz = z - rootZ;
      y = root[1] + cf * dy - sf * dz;
      z = rootZ + sf * dy + cf * dz;
      const normalY = cf * ny - sf * nz;
      nz = sf * ny + cf * nz;
      ny = normalY;
      const sweep = bank * 0.1, cs = Math.cos(sweep), ss = Math.sin(sweep), dx = x - bind, lateral2 = z - rootZ;
      x = bind + cs * dx + ss * lateral2;
      z = rootZ - ss * dx + cs * lateral2;
      const normalX = cs * nx + ss * nz;
      nz = -ss * nx + cs * nz;
      nx = normalX;
    } else if (p.part === "fluke") {
      bind = -0.96;
      let pitch2 = Math.cos(wave - 1.2) * 0.24 * stroke;
      if (kick !== 0) pitch2 -= kick * 0.65;
      const c = Math.cos(pitch2), s = Math.sin(pitch2), dx = x - bind, dy = y - 0.01;
      x = bind + c * dx - s * dy;
      y = 0.01 + s * dx + c * dy;
      const normalX = c * nx - s * ny;
      ny = s * nx + c * ny;
      nx = normalX;
      const side = z < 0 ? -1 : 1, flex = side * Math.sin(wave - 1.55) * 0.035 * stroke;
      const cf = Math.cos(flex), sf = Math.sin(flex), fy = y - 0.01, fz = z - side * 0.012;
      y = 0.01 + cf * fy - sf * fz;
      z = side * 0.012 + sf * fy + cf * fz;
      const normalY = cf * ny - sf * nz;
      nz = sf * ny + cf * nz;
      ny = normalY;
    } else if (p.part === "dorsal") bind = anatomy.dorsal?.root[0] ?? x;
    let cx = bind, cy = 0, tx = 1, ty = 0;
    if (pose.spine) {
      const u2 = rigLimit((RIG_NOSE - bind) / RIG_SPAN, 0, 1) * (RIG_NODES - 1);
      const i = Math.min(RIG_NODES - 2, Math.floor(u2)), t = u2 - i, a = i * 4, b = a + 4;
      const spine = pose.spine, t2 = t * t, t3 = t2 * t;
      const chord = Math.hypot(spine[b] - spine[a], spine[b + 1] - spine[a + 1]);
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      cx = h00 * spine[a] - h10 * chord * spine[a + 2] + h01 * spine[b] - h11 * chord * spine[b + 2];
      cy = h00 * spine[a + 1] - h10 * chord * spine[a + 3] + h01 * spine[b + 1] - h11 * chord * spine[b + 3];
      const d00 = 6 * t2 - 6 * t, d10 = 3 * t2 - 4 * t + 1, d01 = -d00, d11 = 3 * t2 - 2 * t;
      tx = -(d00 * spine[a] - d10 * chord * spine[a + 2] + d01 * spine[b] - d11 * chord * spine[b + 2]);
      ty = -(d00 * spine[a + 1] - d10 * chord * spine[a + 3] + d01 * spine[b + 1] - d11 * chord * spine[b + 3]);
      const magnitude = Math.hypot(tx, ty) || 1;
      tx /= magnitude;
      ty /= magnitude;
      const extension = bind - rigLimit(bind, -1.2, RIG_NOSE);
      cx += tx * extension;
      cy += ty * extension;
    }
    const u = rigLimit((0.5 - bind) / 1.46, 0, 1), ramp = rigSmooth(u);
    const phase = wave - u * 1.2;
    let heave = anatomy.amplitude * ramp * ramp * Math.sin(phase) * stroke;
    const rampDerivative = u > 0 && u < 1 ? -6 * u * (1 - u) / 1.46 : 0;
    let slope = anatomy.amplitude * stroke * (2 * ramp * rampDerivative * Math.sin(phase) + ramp * ramp * Math.cos(phase) * (u > 0 && u < 1 ? 1.2 / 1.46 : 0));
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
        const ox = out.x, oy = out.y;
        out.x = cd * ox - sd * oy;
        out.y = sd * ox + cd * oy;
        const nx2 = out.nx, ny2 = out.ny;
        out.nx = cd * nx2 - sd * ny2;
        out.ny = sd * nx2 + cd * ny2;
      } else {
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

  // src/motion.js
  var motionTick = 1 / 60;
  var DIVE_WATERLINE = 0.1;
  var motionWhaleSizeFloor = 0.55;
  var motionWhaleSizeCeiling = 1.55;
  var motionLimit = (value, low, high) => Math.max(low, Math.min(high, value));
  var motionFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  var motionAngle = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  function motionSeed(whale, index) {
    const key = `${whale.id ?? index}:${motionFinite(whale.phase, 0)}`;
    let state = 2166136261;
    for (let i = 0; i < key.length; i++) state = Math.imul(state ^ key.charCodeAt(i), 16777619);
    return state >>> 0;
  }
  function motionRandom(state) {
    state.seed = Math.imul(state.seed, 1664525) + 1013904223 >>> 0;
    return state.seed / 4294967296;
  }
  function motionGeometry(whale, width, height, count, size2 = 1) {
    const areaScale = Math.min(width / 1600, height / 900, 1.25);
    const density = Math.min(1, Math.sqrt(3 / Math.max(1, count)));
    const depth = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5);
    const variation = 0.98 + Math.sin(motionFinite(whale.phase, 0) + 0.7) * 0.035;
    const anatomy = whaleSpecies(whale.species);
    const scale = 495 / (1 + depth * 0.48) * variation * areaScale * density * anatomy.size * size2;
    whale.length = Math.min(560 * Math.max(1, size2), scale);
    whale.halfLength = whale.length * 0.5;
    whale.bodyRadius = whale.length * Math.max(...anatomy.profile.map((point) => point[1])) / 2.24;
    whale.bodyWidth = whale.bodyRadius * 2;
  }
  function motionLayout(index, count) {
    if (count === 1) return [0.24, 0.3];
    if (count === 2) return index === 0 ? [0.22, 0.3] : [0.78, 0.7];
    if (count === 3) return [[0.2, 0.27], [0.79, 0.29], [0.5, 0.77]][index];
    const columns = count <= 6 ? Math.ceil(count / 2) : 4;
    const column = index % columns, row = Math.floor(index / columns);
    return [0.14 + column * 0.72 / Math.max(1, columns - 1), 0.25 + row * 0.5];
  }
  function motionTarget(whale, width, height, first = false, obstacles = null) {
    const state = whale._motion;
    if (first) {
      const quadrant = whale.y < height * 0.5 ? whale.x < width * 0.5 ? 0 : 1 : whale.x < width * 0.5 ? 3 : 2;
      state.targetIndex = (quadrant + state.routeDirection + 4) % 4;
    } else state.targetIndex = (state.targetIndex + state.routeDirection + 4) % 4;
    const right = state.targetIndex === 1 || state.targetIndex === 2;
    const bottom = state.targetIndex >= 2;
    state.targetX = width * ((right ? 0.94 : 0.06) + (motionRandom(state) - 0.5) * 0.05);
    state.targetY = height * ((bottom ? 0.92 : 0.08) + (motionRandom(state) - 0.5) * 0.06);
    const safe = motionAvoidTarget(whale, state.targetX, state.targetY, obstacles, width, height);
    state.targetX = safe.x;
    state.targetY = safe.y;
    const cruise = state.cruise * Math.min(1, Math.min(width, height) / 650);
    const travel = Math.hypot(state.targetX - whale.x, state.targetY - whale.y) / Math.max(1, cruise);
    state.targetDue = state.age + motionLimit(travel * 1.5 + 8, 18, 110);
  }
  var motionBodySampleU = Object.freeze([
    -0.5357142857142857,
    -0.2857142857142857,
    -0.0357142857142857,
    0.2142857142857143,
    0.4642857142857143
  ]);
  var motionBodyClearance = 12;
  function motionStationRadii(whale) {
    const anatomy = whaleSpecies(whale.species);
    const unit = Math.max(0, motionFinite(whale.length, 0)) / 2.24;
    const body = Math.max(0, motionFinite(whale.bodyRadius, 0));
    const fluke = anatomy.fluke.span * unit;
    const flipperTip = Math.abs(anatomy.flipper.tip[2]) * unit;
    const flipperRoot = Math.abs(anatomy.flipper.root[2]) * unit + anatomy.flipper.width * unit;
    return [
      fluke,
      // fluke lobes at the tail
      Math.max(body * 0.6, fluke * 0.45),
      // peduncle
      Math.max(body, flipperTip),
      // mid-body: flipper tips reach widest here
      Math.max(body, flipperRoot),
      // chest: flipper roots
      body * 0.25
      // snout
    ];
  }
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
        hull.push(
          nodes[a * 2] * (1 - t) + nodes[(a + 1) * 2] * t + shiftX,
          nodes[a * 2 + 1] * (1 - t) + nodes[(a + 1) * 2 + 1] * t + shiftY,
          radii[i] + motionBodyClearance
        );
      }
    }
    return hull;
  }
  function motionHullReach(whale) {
    let reach = 0;
    for (const radius of motionStationRadii(whale)) reach = Math.max(reach, radius);
    return reach + motionBodyClearance;
  }
  function motionObstacleBounds(obstacle, allowance) {
    if (obstacle.circle) {
      const reach = obstacle.radius + allowance;
      return {
        left: obstacle.x - reach,
        right: obstacle.x + reach,
        top: obstacle.y - reach,
        bottom: obstacle.y + reach
      };
    }
    return {
      left: obstacle.x - allowance,
      right: obstacle.x + obstacle.width + allowance,
      top: obstacle.y - allowance,
      bottom: obstacle.y + obstacle.height + allowance
    };
  }
  function motionObstacleNormalize(obstacles) {
    if (!Array.isArray(obstacles)) return [];
    const normalized = [];
    for (const obstacle of obstacles) {
      if (!obstacle) continue;
      const x = Number(obstacle.x), y = Number(obstacle.y);
      const width = Number(obstacle.width), height = Number(obstacle.height);
      const radius = Number(obstacle.radius);
      if (!(width > 0) && !(height > 0)) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || !(radius > 0)) continue;
        normalized.push({ x, y, radius, circle: true });
        continue;
      }
      if (![x, y, width, height].every(Number.isFinite) || !(width > 0) || !(height > 0)) continue;
      normalized.push({
        x,
        y,
        width,
        height,
        radius: motionLimit(motionFinite(radius, 0), 0, Math.min(width, height) / 2)
      });
    }
    return normalized;
  }
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
  function motionObstacleApproach(obstacle, allowance, x, y, band) {
    if (obstacle.circle) {
      const dx = x - obstacle.x, dy = y - obstacle.y;
      const distance = Math.hypot(dx, dy);
      const clearance = obstacle.radius + allowance;
      const gap2 = distance - clearance;
      if (!(gap2 < band)) return null;
      if (distance > 1e-6) return { depth: -gap2, nx: dx / distance, ny: dy / distance };
      return { depth: -gap2, nx: 1, ny: 0 };
    }
    const { left, right, top, bottom } = motionObstacleBounds(obstacle, allowance);
    const insideX = x > left && x < right, insideY = y > top && y < bottom;
    if (insideX && insideY) {
      const toLeft = x - left, toRight = right - x, toTop = y - top, toBottom = bottom - y;
      return Math.min(toLeft, toRight) <= Math.min(toTop, toBottom) ? { depth: Math.min(toLeft, toRight), nx: toLeft < toRight ? -1 : 1, ny: 0 } : { depth: Math.min(toTop, toBottom), nx: 0, ny: toTop < toBottom ? -1 : 1 };
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
  function motionHullInside(obstacle, x, y, radius) {
    if (obstacle.circle) return Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius + radius;
    const { left, right, top, bottom } = motionObstacleBounds(obstacle, radius);
    return x > left && x < right && y > top && y < bottom;
  }
  function motionPushOut(whale, obstacles, width, height) {
    if (!obstacles || !obstacles.length) return false;
    let moved = false;
    const startX = whale.x, startY = whale.y;
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (const obstacle of obstacles) {
        const hull = motionBodyHull(whale);
        if (obstacle.circle) {
          const centreX2 = motionFinite(whale.x, 0), centreY2 = motionFinite(whale.y, 0);
          let dx = centreX2 - obstacle.x, dy = centreY2 - obstacle.y;
          let length = Math.hypot(dx, dy);
          if (!(length > 1e-3)) {
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
            let ex = nx, ey = ny;
            const landedX = centreX2 + nx * shift, landedY = centreY2 + ny * shift;
            if (landedX < 0 || landedX > width || landedY < 0 || landedY > height) {
              for (const [tx, ty] of [[-ny, nx], [ny, -nx]]) {
                const x = centreX2 + tx * shift, y = centreY2 + ty * shift;
                if (x < 0 || x > width || y < 0 || y > height) continue;
                ex = tx;
                ey = ty;
                break;
              }
            }
            whale.x = centreX2 + ex * shift;
            whale.y = centreY2 + ey * shift;
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
          { dx: 0, dy: downShift, distance: downShift }
        ].sort((a, b) => a.distance - b.distance);
        const move = candidates.find((candidate) => {
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
      whale.x = startX;
      whale.y = startY;
      motionShiftWhale(whale, dx, dy);
    }
    return moved;
  }
  function motionAvoidTarget(whale, x, y, obstacles, width, height) {
    if (!obstacles || !obstacles.length) return { x, y };
    const allowance = motionHullReach(whale) + Math.max(8, motionFinite(whale.length, 0) * 0.08);
    for (const obstacle of obstacles) {
      if (obstacle.circle) {
        const clearance = obstacle.radius + allowance;
        const dx = x - obstacle.x, dy = y - obstacle.y;
        const distance = Math.hypot(dx, dy);
        if (!(distance < clearance)) continue;
        const nx = distance > 1e-3 ? dx / distance : 1, ny = distance > 1e-3 ? dy / distance : 0;
        x = motionLimit(obstacle.x + nx * clearance, 0, width);
        y = motionLimit(obstacle.y + ny * clearance, 0, height);
        continue;
      }
      const { left, right, top, bottom } = motionObstacleBounds(obstacle, allowance);
      if (!(x > left && x < right && y > top && y < bottom)) continue;
      if (top >= 0) {
        x = motionLimit(x, 0, width);
        y = top;
        continue;
      }
      if (bottom <= height) {
        y = bottom;
        continue;
      }
      x = motionLimit(x - left < right - x ? left : right, 0, width);
    }
    return { x, y };
  }
  function setSceneObstacles(scene, obstacles) {
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
  function resizeScene(scene, width, height) {
    width = Math.max(1, motionFinite(width, 1));
    height = Math.max(1, motionFinite(height, 1));
    const oldWidth = scene.width > 0 ? scene.width : width;
    const oldHeight = scene.height > 0 ? scene.height : height;
    const size2 = motionLimit(motionFinite(scene.whaleSize, 1), motionWhaleSizeFloor, motionWhaleSizeCeiling);
    scene.time = motionFinite(scene.time, 0);
    scene.accumulator = motionFinite(scene.accumulator, 0);
    if (scene.obstacles && scene.obstacles.length) {
      const scaleX = width / oldWidth, scaleY = height / oldHeight;
      for (const obstacle of scene.obstacles) {
        obstacle.x *= scaleX;
        obstacle.y *= scaleY;
        if (obstacle.circle) {
          obstacle.radius *= Math.min(scaleX, scaleY);
          continue;
        }
        obstacle.width *= scaleX;
        obstacle.height *= scaleY;
      }
    }
    const whales = scene.whales || [];
    for (let i = 0; i < whales.length; i++) {
      const whale = whales[i];
      motionGeometry(whale, width, height, whales.length, size2);
      if (whale._motion) {
        whale.x *= width / oldWidth;
        whale.y *= height / oldHeight;
        whale._motion.targetX *= width / oldWidth;
        whale._motion.targetY *= height / oldHeight;
        const previousPace = Math.min(1, Math.min(oldWidth, oldHeight) / 650);
        const nextPace = Math.min(1, Math.min(width, height) / 650);
        whale.speed *= nextPace / Math.max(1 / 650, previousPace);
      } else {
        const state = whale._motion = {
          seed: motionSeed(whale, i),
          age: 0,
          routeDirection: i % 2 ? -1 : 1,
          targetIndex: 0,
          wander: 0,
          wanderGoal: 0,
          wanderDue: 0,
          wave: motionFinite(whale.phase, 0),
          submergence: 0,
          pitch: 0,
          noseFirst: false,
          depth: 0,
          tailKick: 0,
          arch: 0
        };
        const anatomy = whaleSpecies(whale.species);
        state.cruise = anatomy.cruise * (0.94 + motionRandom(state) * 0.12);
        state.agility = anatomy.turnRate * (0.96 + motionRandom(state) * 0.08);
        state.stroke = 1;
        const [x, y] = motionLayout(i, whales.length);
        whale.x = width * x;
        whale.y = height * y;
        whale.heading = [0.28, 2.72, -0.88, 1.85, -2.1, 0.95, -0.4, 2.1][i % 8] + (motionRandom(state) - 0.5) * 0.18;
        whale.turn = 0;
        whale.speed = state.cruise * Math.min(1, Math.min(width, height) / 650);
        motionTarget(whale, width, height, true, scene.obstacles);
      }
      whale.vx = Math.cos(whale.heading) * whale.speed;
      whale.vy = Math.sin(whale.heading) * whale.speed;
      resizeWhaleRig(whale, width / oldWidth, height / oldHeight);
    }
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
  function adoptSceneState(previous, next) {
    if (!previous || !next || previous === next) return 0;
    const sources = /* @__PURE__ */ new Map();
    for (const whale of previous.whales || []) {
      if (whale && whale.id !== void 0) sources.set(whale.id, whale);
    }
    let adopted = 0;
    for (const whale of next.whales || []) {
      const source = sources.get(whale.id);
      if (!source || source === whale) continue;
      for (const key of ["x", "y", "heading", "turn", "speed", "vx", "vy", "depth"]) {
        if (Number.isFinite(source[key])) whale[key] = source[key];
      }
      if (source._motion) {
        whale._motion = { ...source._motion };
        if (source._motion.dive) whale._motion.dive = { ...source._motion.dive };
      }
      const previousAnatomy = whaleSpecies(source.species), nextAnatomy = whaleSpecies(whale.species);
      if (previousAnatomy !== nextAnatomy && whale._motion) {
        whale._motion.cruise *= nextAnatomy.cruise / previousAnatomy.cruise;
        whale._motion.agility *= nextAnatomy.turnRate / previousAnatomy.turnRate;
      }
      motionGeometry(
        whale,
        next.width,
        next.height,
        next.whales.length,
        motionLimit(motionFinite(next.whaleSize, 1), motionWhaleSizeFloor, motionWhaleSizeCeiling)
      );
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
  function motionWrap(value, size2) {
    if (!(size2 > 0) || !Number.isFinite(value)) return value;
    const wrapped = value % size2;
    return wrapped < 0 ? wrapped + size2 : wrapped;
  }
  function motionTorusDelta(delta2, size2) {
    if (!(size2 > 0) || !Number.isFinite(delta2)) return delta2;
    const half = size2 * 0.5;
    if (delta2 > half) return delta2 - size2;
    if (delta2 < -half) return delta2 + size2;
    return delta2;
  }
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
  var motionContactRig = { before: null, after: null };
  function motionContactTrial(whale, x, y, heading, nodes) {
    whale.x = x;
    whale.y = y;
    whale.heading = heading;
    whale.rig.nodes.set(nodes);
    updateWhaleRig(whale);
  }
  function motionConstrainStep(whale, x, y, heading, obstacles, width, height, motionTick2) {
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
          motionContactTrial(
            whale,
            whale.x + hit.nx * (hit.depth + 1e-8),
            whale.y + hit.ny * (hit.depth + 1e-8),
            trialHeading,
            before
          );
          corrected = true;
        }
        if (!corrected) break;
      }
      if (Math.hypot(whale.x - x, whale.y - y) <= travel + 1e-8 && !motionWhaleBlocked(whale, obstacles)) {
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
          if (score > bestScore) {
            bestScore = score;
            best = { x: whale.x, y: whale.y, heading: trialHeading };
          }
        }
      }
      if (best) {
        motionContactTrial(whale, best.x, best.y, best.heading, before);
        slid = true;
      }
    }
    if (!slid) {
      const sample = (t) => {
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
    whale.vx = (whale.x - x) / motionTick2;
    whale.vy = (whale.y - y) / motionTick2;
    whale.speed = Math.hypot(whale.vx, whale.vy);
    whale.turn = (whale.heading - heading) / motionTick2;
    return true;
  }
  function motionFoldWhale(whale, width, height) {
    const dx = motionWrap(whale.x, width) - whale.x;
    const dy = motionWrap(whale.y, height) - whale.y;
    motionShiftWhale(whale, dx, dy);
  }
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
          if (squared < bestSquared) {
            bestSquared = squared;
            bestX = x;
            bestY = y;
          }
        }
      }
    }
    return { distance: Math.sqrt(bestSquared), x: bestX, y: bestY };
  }
  function motionCruiseDepth(whale, index, age) {
    const state = whale._motion;
    if (!Number.isFinite(state.cruiseBase)) {
      state.cruiseBase = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5);
      state.depthSeed = (motionSeed(whale, index) ^ 1013904242) >>> 0;
      state.depthFrom = state.cruiseBase;
      state.depthTarget = state.cruiseBase;
      state.depthStartedAt = state.age;
      state.depthDuration = 0;
      state.depthDirection = 1;
    }
    if (age >= state.depthStartedAt + state.depthDuration) {
      state.depthFrom = state.depthTarget;
      state.depthSeed = Math.imul(state.depthSeed, 1664525) + 1013904223 >>> 0;
      const excursion = 0.14 + state.depthSeed / 4294967296 * 0.1;
      state.depthDirection *= -1;
      state.depthTarget = motionLimit(state.cruiseBase + state.depthDirection * excursion, 0.1, 2.5);
      state.depthStartedAt += state.depthDuration;
      state.depthSeed = Math.imul(state.depthSeed, 1664525) + 1013904223 >>> 0;
      state.depthDuration = 20 + state.depthSeed / 4294967296 * 18;
    }
    const u = motionLimit((age - state.depthStartedAt) / state.depthDuration, 0, 1);
    whale.depth = state.depthFrom + (state.depthTarget - state.depthFrom) * u * u * (3 - 2 * u);
  }
  function motionIntegrate(scene, speed, motionTick2) {
    const whales = scene.whales, width = scene.width, height = scene.height;
    const size2 = motionLimit(motionFinite(scene.whaleSize, 1), motionWhaleSizeFloor, motionWhaleSizeCeiling);
    for (let i = 0; i < whales.length; i++) {
      const whale = whales[i], previousLength = whale.length;
      motionCruiseDepth(whale, i, whale._motion.age + motionTick2 * speed);
      motionGeometry(whale, width, height, whales.length, size2);
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
    for (let i = 0; i < whales.length; i++) {
      const a = whales[i];
      for (let j = i + 1; j < whales.length; j++) {
        const b = whales[j];
        const dx = motionTorusDelta(b.x - a.x, width), dy = motionTorusDelta(b.y - a.y, height);
        const distance = Math.hypot(dx, dy);
        const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
        const relativeSpeedSquared = dvx * dvx + dvy * dvy;
        const intercept = relativeSpeedSquared > 1e-3 ? motionLimit(-(dx * dvx + dy * dvy) / relativeSpeedSquared, 0, 2.6 / Math.max(0.3, speed)) : 0;
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
        const sideSign = side > clearance * 0.3 ? -1 : 1;
        const awayX = contact.distance > 0.01 ? contact.x / contact.distance : normalX * sideSign;
        const awayY = contact.distance > 0.01 ? contact.y / contact.distance : normalY * sideSign;
        pushX += awayX * bodyThreat * 3;
        pushY += awayY * bodyThreat * 3;
        if (intercept > 0.05) {
          pushX += normalX * sideSign * bodyThreat * 4.5;
          pushY += normalY * sideSign * bodyThreat * 4.5;
        }
        forces[i].x += pushX;
        forces[i].y += pushY;
        forces[j].x -= pushX;
        forces[j].y -= pushY;
        forces[i].caution = Math.max(forces[i].caution, bodyThreat);
        forces[j].caution = Math.max(forces[j].caution, bodyThreat);
      }
    }
    for (let i = 0; i < whales.length; i++) {
      const whale = whales[i], state = whale._motion, force = forces[i];
      const startX = whale.x, startY = whale.y, startHeading = whale.heading;
      const anatomy = whaleSpecies(whale.species);
      const activityKind = whale.activity?.kind;
      const activityPace = activityKind === "running" ? 1.35 : activityKind === "waiting" ? 0.32 : activityKind === "idle" ? 0.62 : 1;
      const travelTick = motionTick2 * speed;
      state.age += travelTick;
      motionPrepareDive(whale, i, scene.diveSeed, anatomy, travelTick, activityKind === "waiting");
      const bearingHold = motionDiveBearingHold(state.dive, state.age);
      if (state.age >= state.targetDue || Math.hypot(state.targetX - whale.x, state.targetY - whale.y) < Math.max(8, whale.length * 0.14)) {
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
      const nearSeam = Math.min(whale.x, width - whale.x, whale.y, height - whale.y) < whale.length * 0.6 + motionHullReach(whale);
      let seamBrake = 0;
      if (obstacles && obstacles.length) {
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
              const cruise2 = state.cruise * environmentSpeed * speed * activityPace;
              const safePace = Math.max(cruise2 * 0.15, gap / 2.8);
              seamBrake = Math.max(seamBrake, 1 - motionLimit(safePace / Math.max(1, cruise2), 0.15, 1));
            }
          }
          const depth = hit.depth;
          const push = depth >= 0 ? 0.9 + 5.4 * Math.min(1.6, depth / Math.max(24, whale.bodyRadius)) : 0.9 * (1 + depth / band);
          force.x += hit.nx * push;
          force.y += hit.ny * push;
          const tangentX = -hit.ny, tangentY = hit.nx;
          const side = Math.sign(forwardX * tangentX + forwardY * tangentY) || state.routeDirection || 1;
          const steer = depth >= 0 ? 1.2 : 0.9 * (1 + depth / band);
          force.x += tangentX * side * steer;
          force.y += tangentY * side * steer;
          caution = Math.max(caution, depth >= 0 ? Math.min(1, depth / Math.max(24, whale.bodyRadius)) : (1 + depth / band) * 0.5);
        }
        if (caution > 0) force.caution = Math.max(force.caution, caution * 0.55);
      }
      let desiredX = dx / targetDistance * 1.5 + forwardX * 0.85 + Math.cos(whale.heading + state.wander) * 0.35 + force.x;
      let desiredY = dy / targetDistance * 1.5 + forwardY * 0.85 + Math.sin(whale.heading + state.wander) * 0.35 + force.y;
      const turnLimit = state.agility * Math.sqrt(speed);
      const cruise = state.cruise * environmentSpeed * speed * activityPace;
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
      whale.turn += (requestedTurn - whale.turn) * (1 - Math.exp(-motionTick2 * turnResponse));
      whale.turn = motionLimit(whale.turn, -turnLimit, turnLimit);
      whale.heading += whale.turn * motionTick2;
      const targetSpeed = cruise * (1 - force.caution * 0.3) * (1 - seamBrake) * (1 - 0.12 * Math.abs(whale.turn) / Math.max(0.01, turnLimit));
      whale.speed += (targetSpeed - whale.speed) * (1 - Math.exp(-motionTick2 * (0.8 + seamBrake * 3.2)));
      whale.vx = Math.cos(whale.heading) * whale.speed;
      whale.vy = Math.sin(whale.heading) * whale.speed;
      whale.x += whale.vx * motionTick2;
      whale.y += whale.vy * motionTick2;
      if (!motionConstrainStep(whale, startX, startY, startHeading, obstacles, width, height, motionTick2)) updateWhaleRig(whale);
      if (obstacles && obstacles.length) motionPushOut(whale, obstacles, width, height);
      motionFoldWhale(whale, width, height);
      const effort = whale.speed / Math.max(1, state.cruise * environmentSpeed);
      const active = Math.PI * 4 / anatomy.beat, rest = active * anatomy.glide / (1 - anatomy.glide);
      const gait = (state.age + whale.phase * 1.7) % (active + rest);
      const easeStroke = (value) => {
        const t = motionLimit(value, 0, 1);
        return t * t * (3 - 2 * t);
      };
      const envelope = gait < active ? easeStroke(gait / 1.1) * easeStroke((active - gait) / 1.1) : 0;
      const activityStroke = activityKind === "running" ? 0.35 + envelope * 0.65 : envelope * (activityKind === "waiting" ? 0.35 : activityKind === "idle" ? 0.6 : 1);
      state.stroke += (activityStroke - state.stroke) * (1 - Math.exp(-travelTick * 2.2));
      state.wave += travelTick * anatomy.beat * (0.7 + 0.3 * Math.min(1.4, Math.sqrt(effort))) * (0.08 + 0.92 * state.stroke);
      motionStepDive(whale);
    }
    scene.time += motionTick2;
  }
  function motionDiveBearingHold(dive, age) {
    if (Number.isFinite(dive.returnStartedAt)) return 1;
    if (dive.startedAt === null) {
      return Number.isFinite(dive.bearingReleaseAt) ? 1 - diveSmoothstep((age - dive.bearingReleaseAt) / 0.6) : 0;
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
  function motionDiveSeed(whale, index, sceneSeed) {
    const supplied = motionFinite(whale.diveSeed, motionFinite(sceneSeed, 0)) >>> 0;
    let seed = (motionSeed(whale, index) ^ supplied ^ 2447445413) >>> 0;
    seed = Math.imul(seed ^ seed >>> 16, 2246822507);
    seed = Math.imul(seed ^ seed >>> 13, 3266489909);
    return (seed ^ seed >>> 16) >>> 0;
  }
  function motionPrepareDive(whale, index, sceneSeed, anatomy, dt, waiting) {
    const state = whale._motion;
    if (!state.dive) {
      const dive2 = state.dive = {
        seed: motionDiveSeed(whale, index, sceneSeed),
        activity: 0,
        nextDecision: 0,
        startedAt: null,
        entry: 0,
        under: 0,
        exit: 0,
        decisions: 0,
        skipped: 0,
        dives: 0,
        completed: 0,
        splashSerial: 0,
        splashKind: "dive",
        splashStrength: 0,
        contactStage: 0
      };
      dive2.activity = 0.32 + motionRandom(dive2) * 0.36;
      dive2.nextDecision = Math.max(6, state.age - dt) + 2 + motionRandom(dive2) * 16;
    }
    const dive = state.dive;
    const surfacePace = motionLimit(22 / anatomy.cruise, 0.75, 1.3);
    if (waiting && dive.startedAt !== null && !Number.isFinite(dive.returnStartedAt)) {
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
    const endedAt = Number.isFinite(dive.returnStartedAt) ? dive.returnStartedAt + dive.exit : dive.startedAt + dive.entry + dive.under + dive.exit;
    if (dive.startedAt !== null && state.age >= endedAt) {
      dive.startedAt = null;
      dive.returnStartedAt = null;
      dive.bearingReleaseAt = endedAt;
      dive.completed++;
      dive.nextDecision = endedAt + (10 + motionRandom(dive) * 16) * surfacePace;
    }
    if (waiting && dive.startedAt === null) dive.nextDecision = Math.max(dive.nextDecision, state.age);
    if (!waiting && dive.startedAt === null && state.age >= dive.nextDecision) {
      dive.decisions++;
      if (motionRandom(dive) < dive.activity) {
        dive.startedAt = dive.nextDecision;
        dive.dives++;
        dive.contactStage = 0;
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
      if (returning || elapsed >= (isTail ? dive.entry * 0.46 : dive.entry + dive.under)) {
        const height = motionDiveContactHeight(whale, isTail ? DIVE_TAIL_CONTACT : DIVE_NOSE_CONTACT);
        if (isTail ? height >= DIVE_WATERLINE : height <= DIVE_WATERLINE) {
          dive.splashSerial++;
          dive.splashKind = isTail ? "dive" : "surface";
          dive.splashStrength = isTail ? 0.95 : 0.9;
          dive.contactStage++;
        }
      }
    }
  }
  var DIVE_TAIL_CONTACT = Object.freeze({
    x: -1.05,
    y: 0.01,
    z: 0,
    nx: 0,
    ny: -1,
    nz: 0,
    part: "fluke"
  });
  var DIVE_NOSE_CONTACT = Object.freeze({
    x: 1.04,
    y: -0.08,
    z: 0,
    nx: 0,
    ny: -1,
    nz: 0,
    part: "body"
  });
  var motionDiveContactPose = {};
  var motionDiveContactOut = {};
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
  function divePose(elapsed, timing) {
    if (!Number.isFinite(elapsed) || !timing) return diveLevel();
    const { entry, under, exit } = timing;
    if (![entry, under, exit].every((value) => Number.isFinite(value) && value > 0) || elapsed <= 0 || elapsed >= entry + under + exit) return diveLevel();
    let t = elapsed;
    if (t < entry) {
      const u2 = t / entry;
      const submergence2 = diveSmoothstep(u2);
      const pitch2 = u2 < 0.38 ? 0.5 * diveSmoothstep(u2 / 0.38) : 0.5 + 0.22 * diveSmoothstep((u2 - 0.38) / 0.62);
      const depth2 = 0.12 * diveSmoothstep((u2 - 0.2) / 0.35) + 1.08 * diveSmoothstep((u2 - 0.55) / 0.45);
      const tailKick = u2 < 0.46 ? -0.55 * diveSmoothstep((u2 - 0.18) / 0.28) : u2 < 0.68 ? -0.55 + 1.05 * diveSmoothstep((u2 - 0.46) / 0.22) : 0.5 * (1 - diveSmoothstep((u2 - 0.68) / 0.24));
      const arch2 = 0.13 * diveSmoothstep(u2 / 0.35) * (1 - diveSmoothstep((u2 - 0.65) / 0.35));
      return { submergence: submergence2, pitch: pitch2, noseFirst: false, depth: depth2, tailKick, arch: arch2 };
    }
    t -= entry;
    if (t < under) {
      return {
        submergence: 1,
        pitch: 0.72 * (1 - diveSmoothstep(t / under)),
        noseFirst: false,
        depth: 1.2,
        tailKick: 0,
        arch: 0
      };
    }
    t -= under;
    const u = t / exit;
    const pitch = u < 0.22 ? -0.58 * diveSmoothstep(u / 0.22) : u < 0.48 ? -0.58 : -0.58 * (1 - diveSmoothstep((u - 0.48) / 0.52));
    const depth = u < 0.24 ? 1.2 - 0.58 * diveSmoothstep(u / 0.24) : u < 0.48 ? 0.62 - 0.04 * diveSmoothstep((u - 0.24) / 0.24) : u < 0.76 ? 0.58 - 0.68 * diveSmoothstep((u - 0.48) / 0.28) : -0.1 * (1 - diveSmoothstep((u - 0.76) / 0.24));
    const arch = 0;
    const submergence = u < 0.65 ? 1 - 0.8 * diveSmoothstep(u / 0.65) : 0.2 * (1 - diveSmoothstep((u - 0.65) / 0.35));
    return { submergence, pitch, noseFirst: submergence > 0, depth, tailKick: 0, arch };
  }
  function stepScene(scene, dt, speed = 1, metrics = null, integrationTick = motionTick) {
    if (!Number.isFinite(dt) || dt <= 0) return scene;
    speed = motionLimit(motionFinite(speed, 1), 0, 3);
    if (speed === 0) return scene;
    if (!(scene.width > 0 && scene.height > 0) || scene.whales.some((whale) => !whale._motion)) {
      resizeScene(scene, scene.width || 1600, scene.height || 900);
    }
    scene.accumulator = motionFinite(scene.accumulator, 0) + Math.min(dt, 0.25);
    while (scene.accumulator + 1e-10 >= integrationTick) {
      const started = metrics?.begin();
      motionIntegrate(scene, speed, integrationTick);
      metrics?.end("motionStep", started);
      scene.accumulator = Math.max(0, scene.accumulator - integrationTick);
    }
    return scene;
  }
  function whalePose(whale, elapsed, width, height, speed, out = {}) {
    width = Math.max(1, motionFinite(width, 1));
    height = Math.max(1, motionFinite(height, 1));
    const phase = motionFinite(whale.phase, 0), state = whale._motion;
    if (state) motionEnsureDive(state);
    const age = state ? state.age : motionFinite(elapsed, 0) * motionFinite(speed, 1);
    const heading = motionFinite(whale.heading, 0), turn2 = motionFinite(whale.turn, 0);
    const depth = motionLimit(motionFinite(whale.depth, 0.5), 0, 2.5);
    const focal = motionLimit(width * 0.95, 520, 1800);
    const yaw = 0, pitch = Math.PI / 2, roll = heading;
    const cy = 1, sy = 0, cp = 0, sp = 1;
    const length = motionFinite(whale.length, Math.min(width * 0.3, height * 0.53));
    const scale = length * (1 + depth) / 2.24;
    Object.assign(out, {
      x: motionFinite(whale.x, width * 0.5),
      y: motionFinite(whale.y, height * 0.5),
      scale,
      focal,
      cameraZ: focal * depth,
      near: focal * 0.12,
      yaw,
      pitch,
      roll,
      heading,
      length,
      turn: turn2,
      wave: state ? state.wave : age * 1.8 + phase,
      submergence: state ? state.submergence : 0,
      divePitch: state ? state.pitch : 0,
      diveDepth: state ? state.depth : 0,
      diveKick: state ? state.tailKick : 0,
      diveArch: state ? state.arch : 0,
      noseFirst: state ? state.noseFirst : false,
      cy,
      sy,
      cp,
      sp,
      cr: Math.cos(roll),
      sr: Math.sin(roll)
    });
    return writeWhaleRigPose(whale, out);
  }

  // src/shading.js
  var GLYPH_INK_LIGHT_LEVELS = 32;
  var GLYPH_INK_DEPTH_LEVELS = 16;
  var GLYPH_INK_NEAR_DEPTH = 0.14;
  var GLYPH_INK_FAR_DEPTH = 1.35;
  var RAINBOW_COLOR_STOPS = Object.freeze([
    [[87, 42, 40], [158, 94, 83], [225, 192, 181]],
    [[80, 57, 29], [154, 121, 68], [225, 207, 167]],
    [[51, 66, 33], [110, 135, 80], [196, 216, 175]],
    [[25, 68, 63], [64, 137, 125], [170, 218, 204]],
    [[32, 62, 88], [76, 127, 158], [169, 207, 226]],
    [[48, 55, 83], [109, 116, 153], [199, 202, 224]],
    [[69, 44, 87], [130, 99, 158], [209, 190, 227]],
    [[87, 40, 65], [160, 88, 129], [231, 183, 209]]
  ].map((stops) => Object.freeze(stops.map((stop) => Object.freeze(stop)))));
  function rainbowColorStops(index) {
    return Number.isInteger(index) && index >= 0 && index < RAINBOW_COLOR_STOPS.length ? RAINBOW_COLOR_STOPS[index] : null;
  }
  var GLYPH_INK_PALETTES = (() => {
    const ramps = {
      ocean: [[38, 63, 88], [94, 119, 141], [187, 205, 218]],
      azure: [[32, 62, 88], [76, 127, 158], [169, 207, 226]],
      indigo: [[48, 55, 83], [109, 116, 153], [199, 202, 224]],
      ...Object.fromEntries(RAINBOW_COLOR_STOPS.map((stops, index) => [`rainbow:${index}`, stops]))
    };
    const palettes = {};
    for (const [name, [shadow, mid, highlight]] of Object.entries(ramps)) {
      const palette = [];
      for (let distance = 0; distance < GLYPH_INK_DEPTH_LEVELS; distance++) {
        const depth = distance / (GLYPH_INK_DEPTH_LEVELS - 1);
        const haze = 0.34 * depth * depth * (3 - 2 * depth);
        for (let shade = 0; shade < GLYPH_INK_LIGHT_LEVELS; shade++) {
          const light = shade / (GLYPH_INK_LIGHT_LEVELS - 1);
          const unlit = 1 - light;
          const channels = shadow.map((start, channel) => {
            const ink = unlit * unlit * start + 2 * unlit * light * mid[channel] + light * light * highlight[channel];
            return Math.round(ink + (255 - ink) * haze);
          });
          palette.push(`rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`);
        }
      }
      palettes[name] = Object.freeze(palette);
    }
    return Object.freeze(palettes);
  })();
  function createInkPalette(name, colorIndex) {
    if (name === "rainbow" && rainbowColorStops(colorIndex)) return GLYPH_INK_PALETTES[`rainbow:${colorIndex}`];
    return name === "azure" ? GLYPH_INK_PALETTES.azure : name === "indigo" ? GLYPH_INK_PALETTES.indigo : GLYPH_INK_PALETTES.ocean;
  }
  function glyphInkIndex(light, depth) {
    if (typeof light !== "number" || light !== light) light = 0.5;
    if (typeof depth !== "number" || depth !== depth) depth = GLYPH_INK_NEAR_DEPTH;
    const shade = light <= 0 ? 0 : light >= 1 ? GLYPH_INK_LIGHT_LEVELS - 1 : Math.round(light * (GLYPH_INK_LIGHT_LEVELS - 1));
    const distance = depth <= GLYPH_INK_NEAR_DEPTH ? 0 : depth >= GLYPH_INK_FAR_DEPTH ? GLYPH_INK_DEPTH_LEVELS - 1 : Math.round((depth - GLYPH_INK_NEAR_DEPTH) * (GLYPH_INK_DEPTH_LEVELS - 1) / (GLYPH_INK_FAR_DEPTH - GLYPH_INK_NEAR_DEPTH));
    return distance * GLYPH_INK_LIGHT_LEVELS + shade;
  }
  function surfaceInkTone(elevation, upness, sideFacing, material = "skin", seed = 0.5) {
    const raised = Math.max(0, Math.min(1.25, elevation / 0.235));
    const crown = Math.max(0, Math.min(1, upness));
    const aspect = Math.max(-1, Math.min(1, sideFacing));
    const relief = raised * 0.82 + crown * 0.18;
    let tone = 0.86 - relief * 0.66 + aspect * 0.025 + (seed - 0.5) * 0.025;
    if (material === "fin") tone += 0.02 + Math.max(0, Math.min(1, -elevation / 0.25)) * 0.04;
    else if (material === "pleat") tone -= 0.035;
    else if (material === "eye") tone = Math.min(tone, 0.18);
    return Math.max(0.14, Math.min(0.9, tone));
  }

  // src/model.js
  var FIELDS = Object.freeze({
    enabled: { kind: "boolean", default: true },
    resourceMode: { kind: "enum", values: ["standard", "economy"], default: "standard" },
    count: { kind: "number", min: 1, max: 8, step: 1, default: 3 },
    species: { kind: "enum", values: ["mixed", ...SPECIES_IDS], default: "mixed" },
    renderStyle: { kind: "enum", values: ["glyphs", "cells"], default: "glyphs" },
    fillMode: { kind: "enum", values: ["custom", "ascii"], default: "custom" },
    text: { kind: "string", max: 40, default: "探索未至之境" },
    speed: { kind: "number", min: 0.3, max: 2, step: 0.05, default: 0.65 },
    opacity: { kind: "number", min: 0.04, max: 0.9, step: 0.01, default: 0.6 },
    glyphSize: { kind: "number", min: 4, max: 16, step: 1, default: 11 },
    whaleSize: { kind: "number", min: 0.55, max: 1.55, step: 0.05, default: 1 },
    color: { kind: "enum", values: ["ocean", "azure", "indigo", "rainbow"], default: "ocean" },
    activity: { kind: "boolean", default: true },
    quietCenter: { kind: "boolean", default: true },
    leftInset: { kind: "number", min: 0, max: 500, step: 1, default: 280 },
    readingEffect: { kind: "enum", values: ["none", "glow", "blur", "frost"], default: "frost" },
    glass: { kind: "boolean", default: true },
    glassStrength: { kind: "number", min: 0, max: 1, step: 0.05, default: 0.55 },
    // Folded into `glass` in 0.11.0: every content box, the composer included, is
    // frosted by the same option. Kept as a hidden field so old profile entries
    // still validate, and so a 0.10.0 config that only enabled the composer is
    // migrated below instead of silently losing its effect.
    composerGlass: { kind: "boolean", default: false, hidden: true },
    composerAvoid: { kind: "boolean", default: false },
    spout: { kind: "boolean", default: true },
    ripples: { kind: "boolean", default: true },
    wind: { kind: "boolean", default: true },
    clouds: { kind: "boolean", default: true },
    rain: { kind: "boolean", default: false },
    rainIntensity: { kind: "number", min: 0, max: 1, step: 0.01, default: 0.45 },
    // Opt-in reading guard, off by default. When on, a scroll burst hides the
    // decorative layer and freezes the school until the page goes quiet, so the
    // soft text mask can never trail behind moving text. When off the whales keep
    // swimming and the mask refreshes on the ordinary 120ms measure budget.
    pauseOnScroll: { kind: "boolean", default: false }
  });
  var DEFAULTS = Object.freeze(Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.default])));
  var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  var mix = (a, b, t) => a + (b - a) * t;
  var smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  var fract = (n) => n - Math.floor(n);
  var noise = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  function normalizeConfig(value = {}) {
    const config = Object.fromEntries(Object.entries(FIELDS).map(([key, f]) => {
      let v = value[key];
      if (f.kind === "number") {
        v = typeof v === "number" && Number.isFinite(v) ? clamp(v, f.min, f.max) : f.default;
        if (f.step === 1) v = Math.round(v);
      } else if (f.kind === "boolean") v = typeof v === "boolean" ? v : f.default;
      else if (f.kind === "enum") v = f.values.includes(v) ? v : f.default;
      else v = typeof v === "string" ? v.slice(0, f.max).replace(/[\uD800-\uDBFF]$/u, "") : f.default;
      return [key, v];
    }));
    if (config.composerGlass === true && value && !("glass" in value)) {
      config.glass = true;
      config.composerGlass = false;
    }
    if (config.glass && config.composerAvoid) config.composerAvoid = false;
    return config;
  }
  function configSignature(value) {
    return JSON.stringify(normalizeConfig(value));
  }
  function glyphSequence(text = DEFAULTS.text) {
    const characters = text.replace(/\s/gu, "") || DEFAULTS.text;
    return typeof Intl.Segmenter === "function" ? Array.from(new Intl.Segmenter(void 0, { granularity: "grapheme" }).segment(characters), (item) => item.segment) : Array.from(characters);
  }
  function bodyRadius(x, anatomy) {
    const profile = anatomy.profile;
    for (let i = 1; i < profile.length; i++) {
      if (x <= profile[i][0]) {
        const [a, ra] = profile[i - 1], [b, rb] = profile[i], span = b - a;
        const slope = (rb - ra) / span;
        const previous = i > 1 ? (ra - profile[i - 2][1]) / (a - profile[i - 2][0]) : slope;
        const next = i + 1 < profile.length ? (profile[i + 1][1] - rb) / (profile[i + 1][0] - b) : slope;
        const ma = previous * slope > 0 ? 2 * previous * slope / (previous + slope) : 0;
        const mb = next * slope > 0 ? 2 * next * slope / (next + slope) : 0;
        const t = clamp((x - a) / span, 0, 1), t2 = t * t, t3 = t2 * t;
        return Math.max(0, (2 * t3 - 3 * t2 + 1) * ra + (t3 - 2 * t2 + t) * span * ma + (-2 * t3 + 3 * t2) * rb + (t3 - t2) * span * mb);
      }
    }
    return profile[profile.length - 1][1];
  }
  function bodySurface(anatomy) {
    return (u, angle) => {
      const x = mix(-1, 1.04, u), radius = bodyRadius(x, anatomy);
      const pleat = anatomy.pleats && x > -0.02 && Math.cos(angle) > 0.15 ? 1 + 0.012 * Math.cos(angle * 36) : 1;
      return { x, y: radius * anatomy.height * Math.cos(angle) * pleat, z: radius * Math.sin(angle) * pleat };
    };
  }
  function flukeSurface(anatomy, side) {
    const { span, tipX, leadingX, trailingX, notch, width } = anatomy.fluke;
    return (u, angle) => {
      u = clamp(u, 0, 1);
      angle *= -side;
      const leading = mix(leadingX, tipX, u * u) + 0.04 * Math.sin(Math.PI * u);
      const trailing = trailingX + notch * (1 - u) ** 6 + (tipX - trailingX) * u ** 1.5;
      return {
        x: mix(leading, trailing, (1 + Math.cos(angle)) * 0.5),
        y: 0.01 + width * (0.25 + 0.75 * Math.sin(Math.PI * u)) * Math.sin(angle),
        z: side * mix(0.012, span, u)
      };
    };
  }
  function surfaceParticle(surface, u, angle) {
    const p = surface(u, angle), epsilon = 1e-4;
    const a = surface(u + epsilon, angle), b = surface(u - epsilon, angle);
    const c = surface(u, angle + epsilon), d = surface(u, angle - epsilon);
    const ax = a.x - b.x, ay = a.y - b.y, az = a.z - b.z;
    const bx = c.x - d.x, by = c.y - d.y, bz = c.z - d.z;
    let nx = az * by - ay * bz, ny = ax * bz - az * bx, nz = ay * bx - ax * by;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    return { ...p, nx, ny, nz };
  }
  function bladeSurface(start, end, width, thickness, reference) {
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
    const length = Math.hypot(dx, dy, dz), ax = dx / length, ay = dy / length, az = dz / length;
    let bx = ay * reference[2] - az * reference[1];
    let by = az * reference[0] - ax * reference[2];
    let bz = ax * reference[1] - ay * reference[0];
    const crossLength = Math.hypot(bx, by, bz);
    bx /= crossLength;
    by /= crossLength;
    bz /= crossLength;
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    return (u, angle) => {
      const taper = Math.sin(Math.PI * clamp(u, 0, 1)) ** 0.7;
      const broad = width * taper * Math.cos(angle), thin = thickness * taper * Math.sin(angle);
      return {
        x: start[0] + dx * u + bx * broad + cx * thin,
        y: start[1] + dy * u + by * broad + cy * thin,
        z: start[2] + dz * u + bz * broad + cz * thin
      };
    };
  }
  function whaleColorOrder(seed) {
    const colors = Array.from({ length: 8 }, (_, index) => index);
    let state = seed;
    for (let i = colors.length - 1; i > 0; i--) {
      state = Math.imul(state, 1664525) + 1013904223 >>> 0;
      const j = Math.floor(state / 4294967296 * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    return colors;
  }
  function createScene(count, text = DEFAULTS.text, species = DEFAULTS.species, whaleSize = DEFAULTS.whaleSize, colorSeed = 0) {
    const alphabet = glyphSequence(text);
    count = clamp(Math.round(count), 1, 8);
    colorSeed = typeof colorSeed === "number" && Number.isFinite(colorSeed) ? colorSeed >>> 0 : 0;
    const colorOrder = whaleColorOrder(colorSeed);
    const size2 = clamp(
      typeof whaleSize === "number" && Number.isFinite(whaleSize) ? whaleSize : DEFAULTS.whaleSize,
      FIELDS.whaleSize.min,
      FIELDS.whaleSize.max
    );
    const total = Math.min(8e3, Math.round(count * 2200 * Math.max(0.36, size2 * size2)));
    const depthOrder = Array.from({ length: count }, (_, index) => index);
    let depthSeed = (colorSeed ^ 1779033703) >>> 0;
    for (let i = count - 1; i > 0; i--) {
      depthSeed = Math.imul(depthSeed, 1664525) + 1013904223 >>> 0;
      const j = Math.floor(depthSeed / 4294967296 * (i + 1));
      [depthOrder[i], depthOrder[j]] = [depthOrder[j], depthOrder[i]];
    }
    const whales = Array.from({ length: count }, (_, id) => ({
      id,
      colorIndex: colorOrder[id],
      species: species === "mixed" || !WHALE_SPECIES[species] ? SPECIES_IDS[id % SPECIES_IDS.length] : species,
      depth: count === 1 ? 0.16 : 0.16 + 0.89 * depthOrder[id] / (count - 1),
      phase: noise(id + 80) * Math.PI * 2
    }));
    const particles = [], triangles = [], decals = [];
    for (const whale of whales) {
      const anatomy = whaleSpecies(whale.species), surface = bodySurface(anatomy);
      const budget = Math.floor(total / count);
      const addSurface = (part, surfaceFn, allocation, material = "skin") => {
        const start = particles.length;
        const around = Math.max(8, Math.round(Math.sqrt(allocation / 2.5)));
        const rings = Math.max(2, Math.floor(allocation / around)), number = rings * around;
        for (let ring = 0; ring < rings; ring++) for (let col = 0; col < around; col++) {
          const seed = noise(particles.length + 900);
          const u = (ring + 1e-3) / (rings - 1 + 2e-3);
          const angle = Math.PI * 2 * col / around;
          const p = surfaceParticle(surfaceFn, u, angle);
          const pleat = anatomy.pleats && part === "body" && p.x > 0.02 && p.y > 0.04 && Math.cos(angle * 36) > 0.5;
          particles.push({
            id: particles.length,
            whale: whale.id,
            part,
            ...p,
            seed,
            material: pleat ? "pleat" : material
          });
        }
        for (let ring = 0; ring < rings - 1; ring++) for (let col = 0; col < around; col++) {
          const a = start + ring * around + col, b = start + ring * around + (col + 1) % around;
          const c = a + around, d = b + around;
          if (c < start + number && d < start + number) triangles.push(a, b, c, b, d, c);
        }
      };
      const finCount = Math.floor(budget * (whale.species === "humpback" ? 0.085 : 0.045));
      const flukeCount = Math.floor(budget * 0.055), dorsalCount = anatomy.dorsal ? Math.max(24, Math.floor(budget * 0.02)) : 0;
      const mouthCount = 12;
      addSurface("body", surface, budget - finCount * 2 - flukeCount * 2 - dorsalCount - mouthCount - 2);
      for (const side of [-1, 1]) {
        const { root, tip, width, thickness } = anatomy.flipper;
        addSurface("fin", bladeSurface([root[0], root[1], side * root[2]], [tip[0], tip[1], side * tip[2]], width, thickness, [0, 1, 0]), finCount, "fin");
        addSurface("fluke", flukeSurface(anatomy, side), flukeCount, "fin");
        const x = whale.species === "sperm" ? 0.4 : 0.77, y = 0.015, radius = bodyRadius(x, anatomy);
        decals.push(particles.length);
        particles.push({
          id: particles.length,
          whale: whale.id,
          part: "eye",
          x,
          y,
          z: side * (radius * Math.sqrt(1 - (y / (radius * anatomy.height)) ** 2) + 4e-3),
          nx: 0,
          ny: 0,
          nz: side,
          seed: noise(whale.id + side + 45),
          material: "eye"
        });
      }
      if (anatomy.dorsal) {
        const { root, tip, width } = anatomy.dorsal;
        addSurface("dorsal", bladeSurface(root, tip, width, 0.014, [0, 0, 1]), dorsalCount, "fin");
      }
      for (let i = 0; i < mouthCount; i++) {
        const x = mix(0.64, 1.02, (Math.floor(i / 2) + 0.5) / (mouthCount / 2)), side = i % 2 ? 1 : -1;
        const p = surfaceParticle(surface, (x + 1) / 2.04, side * Math.acos(0.36));
        decals.push(particles.length);
        particles.push({
          id: particles.length,
          whale: whale.id,
          part: "mouth",
          ...p,
          z: p.z + side * 3e-3,
          seed: noise(i + 340),
          material: "mouth"
        });
      }
    }
    for (const p of particles) p.glyph = alphabet[p.id % alphabet.length];
    const scene = { whales, particles, triangles: new Uint16Array(triangles), decals, time: 0, accumulator: 0, width: 0, height: 0, whaleSize: size2, colorSeed };
    resizeScene(scene, 1600, 900);
    return scene;
  }
  function transformParticle(p, pose, out = {}) {
    deformWhaleParticle(p, pose, out);
    const { x, y, z, nx, ny, nz } = out;
    out.elevation = -y;
    const rx = pose.cy * x + pose.sy * z, rz = -pose.sy * x + pose.cy * z;
    const ry = pose.cp * y - pose.sp * rz, depth = pose.sp * y + pose.cp * rz;
    const rnx = pose.cy * nx + pose.sy * nz, rnz = -pose.sy * nx + pose.cy * nz;
    const rny = pose.cp * ny - pose.sp * rnz, normalZ = pose.sp * ny + pose.cp * rnz;
    const normalX = pose.cr * rnx - pose.sr * rny, normalY = pose.sr * rnx + pose.cr * rny;
    const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
    out.x = (pose.cr * rx - pose.sr * ry) * pose.scale;
    out.y = (pose.sr * rx + pose.cr * ry) * pose.scale;
    out.z = depth * pose.scale;
    out.nx = normalX / normalLength;
    out.ny = normalY / normalLength;
    out.nz = normalZ / normalLength;
    return out;
  }
  function projectParticle(p, pose, out = {}) {
    transformParticle(p, pose, out);
    const cameraDistance = pose.focal + pose.cameraZ + out.z;
    const depth = Math.max(pose.near, cameraDistance), perspective = pose.focal / depth;
    const rayLength = Math.hypot(out.x, out.y, depth);
    const facing = -(out.nx * out.x + out.ny * out.y + out.nz * depth) / rayLength;
    const tone = surfaceInkTone(out.elevation, -out.nz, -0.6 * out.nx - 0.8 * out.ny, p.material, p.seed);
    out.x = pose.x + out.x * perspective;
    out.y = pose.y + out.y * perspective;
    out.z = depth;
    out.perspective = perspective;
    out.light = tone;
    out.visibility = cameraDistance <= pose.near ? 0 : smooth((facing + 0.04) / 0.26);
    const sub = Number.isFinite(pose.submergence) ? pose.submergence : 0;
    if (Number.isFinite(pose.diveDepth)) {
      const wet = smooth((-out.elevation - DIVE_WATERLINE) / 0.18);
      const engagement = Number.isFinite(pose.diveEngagement) ? pose.diveEngagement : smooth(Math.max(
        sub * 8,
        Math.abs(pose.diveDepth) * 4,
        Math.abs(Number.isFinite(pose.divePitch) ? pose.divePitch : 0) * 3,
        Math.abs(Number.isFinite(pose.diveKick) ? pose.diveKick : 0) * 2
      ));
      if (engagement > 0) out.visibility *= 1 - engagement * wet;
    } else {
      const lead = Math.min(1, Math.max(0, (p.x + 1.2) / 2.24));
      const noseFirst = pose.noseFirst === true;
      const gate = 0.35 + 0.65 * (noseFirst ? lead : 1 - lead);
      let u = sub > 0 ? (gate - sub) / gate : 1;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      out.visibility *= u * u * (3 - 2 * u);
    }
    return out;
  }
  function createDepthGrid(width, height, glyphSize, metrics = {}) {
    const naturalWidth = Math.ceil(Math.max(5, glyphSize, metrics.width || 0) + 2);
    const naturalHeight = Math.ceil(Math.max(5, glyphSize * 1.2, metrics.height || 0) + 2);
    const cellWidth = metrics.square ? Math.max(naturalWidth, naturalHeight) : naturalWidth;
    const cellHeight = metrics.square ? cellWidth : naturalHeight;
    const columns = Math.max(1, Math.ceil(width / cellWidth)), rows = Math.max(1, Math.ceil(height / cellHeight));
    const count = columns * rows;
    const centersX = new Float64Array(count), centersY = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      centersX[i] = (i % columns + 0.5) * cellWidth;
      centersY[i] = (Math.floor(i / columns) + 0.5) * cellHeight;
    }
    return {
      width,
      height,
      cellWidth,
      cellHeight,
      columns,
      rows,
      centersX,
      centersY,
      owners: new Int32Array(count),
      depths: new Float64Array(count),
      lights: new Float32Array(count),
      coverage: new Float32Array(count),
      visibility: new Float32Array(count),
      sampleDepths: new Float64Array(count * 5),
      sampleOwners: new Int32Array(count * 5),
      sampleLights: new Float32Array(count * 5),
      sampleVisibility: new Float32Array(count * 5)
    };
  }
  var CELL_SAMPLES = [0.5, 0.5, 0.2, 0.2, 0.8, 0.2, 0.2, 0.8, 0.8, 0.8];
  function resolveDepthGrid(projected, grid, triangles, decals = []) {
    grid.owners.fill(-1);
    grid.depths.fill(Infinity);
    grid.coverage.fill(0);
    grid.visibility.fill(0);
    for (const p of projected) {
      p.cell = -1;
      p.surfaceVisibility = 0;
    }
    if (triangles?.length) {
      grid.sampleDepths.fill(Infinity);
      grid.sampleOwners.fill(-1);
      for (let triangle = 0; triangle < triangles.length; triangle += 3) {
        const ia = triangles[triangle], ib = triangles[triangle + 1], ic = triangles[triangle + 2];
        const a = projected[ia], b = projected[ib], c = projected[ic];
        if (Math.max(a.visibility, b.visibility, c.visibility) < 0.05) continue;
        const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        if (Math.abs(denominator) < 1e-4) continue;
        const left = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x) / grid.cellWidth));
        const right = Math.min(grid.columns - 1, Math.floor(Math.max(a.x, b.x, c.x) / grid.cellWidth));
        const top = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y) / grid.cellHeight));
        const bottom = Math.min(grid.rows - 1, Math.floor(Math.max(a.y, b.y, c.y) / grid.cellHeight));
        for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
          const cell = row * grid.columns + col;
          for (let sample = 0; sample < 5; sample++) {
            const x = (col + CELL_SAMPLES[sample * 2]) * grid.cellWidth;
            const y = (row + CELL_SAMPLES[sample * 2 + 1]) * grid.cellHeight;
            const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
            const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
            const w = 1 - u - v;
            if (Math.min(u, v, w) < -1e-6) continue;
            const visible = a.visibility * u + b.visibility * v + c.visibility * w;
            if (visible < 0.05) continue;
            const depth = a.z * u + b.z * v + c.z * w, index = cell * 5 + sample;
            if (depth >= grid.sampleDepths[index]) continue;
            grid.sampleDepths[index] = depth;
            grid.sampleOwners[index] = u >= v && u >= w ? ia : v >= w ? ib : ic;
            grid.sampleLights[index] = a.light * u + b.light * v + c.light * w;
            grid.sampleVisibility[index] = visible;
          }
        }
      }
      for (let cell = 0; cell < grid.owners.length; cell++) {
        let hits = 0, light = 0, visible = 0, selected = -1;
        for (let sample = 0; sample < 5; sample++) {
          const index = cell * 5 + sample;
          if (grid.sampleOwners[index] < 0) continue;
          hits++;
          light += grid.sampleLights[index];
          visible += grid.sampleVisibility[index];
          if (sample === 0 || selected < 0) selected = index;
        }
        if (!hits) continue;
        grid.owners[cell] = grid.sampleOwners[selected];
        grid.depths[cell] = grid.sampleDepths[selected];
        grid.lights[cell] = light / hits;
        grid.coverage[cell] = hits / 5;
        grid.visibility[cell] = visible / hits;
      }
    }
    const pointIndices = triangles?.length ? decals : projected.keys();
    for (const i of pointIndices) {
      const p = projected[i];
      if (p.visibility < 0.05 || p.x < 0 || p.x >= grid.width || p.y < 0 || p.y >= grid.height) continue;
      const cell = Math.floor(p.y / grid.cellHeight) * grid.columns + Math.floor(p.x / grid.cellWidth);
      if (p.z > grid.depths[cell] + (triangles?.length ? 0.75 : 0)) continue;
      grid.owners[cell] = i;
      grid.depths[cell] = p.z;
      grid.lights[cell] = p.light ?? 0.75;
      grid.coverage[cell] = 1;
      grid.visibility[cell] = p.visibility;
    }
    for (let cell = 0; cell < grid.owners.length; cell++) {
      const index = grid.owners[cell];
      if (index < 0) continue;
      const p = projected[index];
      p.cell = cell;
      p.surfaceVisibility = grid.visibility[cell];
      p.drawX = grid.centersX[cell];
      p.drawY = grid.centersY[cell];
    }
  }
  function rasterShiftedTriangles(projected, grid, triangles, particles, whaleId, ox, oy, touched) {
    for (let triangle = 0; triangle < triangles.length; triangle += 3) {
      const ia = triangles[triangle], ib = triangles[triangle + 1], ic = triangles[triangle + 2];
      if (particles[ia].whale !== whaleId) continue;
      const a = projected[ia], b = projected[ib], c = projected[ic];
      if (!a || !b || !c || Math.max(a.visibility, b.visibility, c.visibility) < 0.05) continue;
      const ax = a.x + ox, ay = a.y + oy, bx = b.x + ox, by = b.y + oy, cx = c.x + ox, cy = c.y + oy;
      const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(denominator) < 1e-4) continue;
      const left = Math.max(0, Math.floor(Math.min(ax, bx, cx) / grid.cellWidth));
      const right = Math.min(grid.columns - 1, Math.floor(Math.max(ax, bx, cx) / grid.cellWidth));
      const top = Math.max(0, Math.floor(Math.min(ay, by, cy) / grid.cellHeight));
      const bottom = Math.min(grid.rows - 1, Math.floor(Math.max(ay, by, cy) / grid.cellHeight));
      if (left > right || top > bottom) continue;
      for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
        const cell = row * grid.columns + col;
        let wrote = false;
        for (let sample = 0; sample < 5; sample++) {
          const x = (col + CELL_SAMPLES[sample * 2]) * grid.cellWidth;
          const y = (row + CELL_SAMPLES[sample * 2 + 1]) * grid.cellHeight;
          const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
          const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
          const w = 1 - u - v;
          if (Math.min(u, v, w) < -1e-6) continue;
          const visible = a.visibility * u + b.visibility * v + c.visibility * w;
          if (visible < 0.05) continue;
          const depth = a.z * u + b.z * v + c.z * w, index = cell * 5 + sample;
          if (depth >= grid.sampleDepths[index]) continue;
          grid.sampleDepths[index] = depth;
          grid.sampleOwners[index] = u >= v && u >= w ? ia : v >= w ? ib : ic;
          grid.sampleLights[index] = a.light * u + b.light * v + c.light * w;
          grid.sampleVisibility[index] = visible;
          wrote = true;
        }
        if (wrote) touched.add(cell);
      }
    }
  }
  function repaintWrappedCells(grid, touched) {
    for (const cell of touched) {
      let hits = 0, light = 0, visible = 0, selected = -1;
      for (let sample = 0; sample < 5; sample++) {
        const index = cell * 5 + sample;
        if (grid.sampleOwners[index] < 0) continue;
        hits++;
        light += grid.sampleLights[index];
        visible += grid.sampleVisibility[index];
        if (sample === 0 || selected < 0) selected = index;
      }
      if (!hits) continue;
      grid.owners[cell] = grid.sampleOwners[selected];
      grid.depths[cell] = grid.sampleDepths[selected];
      grid.lights[cell] = light / hits;
      grid.coverage[cell] = hits / 5;
      grid.visibility[cell] = visible / hits;
    }
  }
  function stampWrappedPoint(projected, grid, index, ox, oy) {
    const p = projected[index];
    if (!p || p.visibility < 0.05) return;
    const x = p.x + ox, y = p.y + oy;
    if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;
    const cell = Math.floor(y / grid.cellHeight) * grid.columns + Math.floor(x / grid.cellWidth);
    if (p.z > grid.depths[cell] + 0.75) return;
    grid.owners[cell] = index;
    grid.depths[cell] = p.z;
    grid.lights[cell] = p.light ?? 0.75;
    grid.coverage[cell] = 1;
    grid.visibility[cell] = p.visibility;
  }
  function stampSeaWraps(scene, projected, grid) {
    const width = grid?.width, height = grid?.height;
    const triangles = scene?.triangles, particles = scene?.particles;
    if (!(width > 0) || !(height > 0) || !triangles?.length || !particles?.length) return;
    const touched = /* @__PURE__ */ new Set();
    const shifts = [];
    for (const whale of scene.whales || []) {
      const reach = Math.max(48, motionFiniteLength(whale) * 0.9);
      const xShifts = whale.x - reach < 0 ? [width] : whale.x + reach > width ? [-width] : [];
      const yShifts = whale.y - reach < 0 ? [height] : whale.y + reach > height ? [-height] : [];
      for (const ox of xShifts) shifts.push([whale.id, ox, 0]);
      for (const oy of yShifts) shifts.push([whale.id, 0, oy]);
      for (const ox of xShifts) for (const oy of yShifts) shifts.push([whale.id, ox, oy]);
    }
    if (!shifts.length) return;
    for (const [whaleId, ox, oy] of shifts) {
      rasterShiftedTriangles(projected, grid, triangles, particles, whaleId, ox, oy, touched);
    }
    repaintWrappedCells(grid, touched);
    const decals = scene.decals || [];
    for (const index of decals) {
      const whaleId = particles[index]?.whale;
      for (const [id, ox, oy] of shifts) {
        if (id !== whaleId) continue;
        stampWrappedPoint(projected, grid, index, ox, oy);
      }
    }
  }
  function motionFiniteLength(whale) {
    const length = whale && whale.length;
    return typeof length === "number" && Number.isFinite(length) ? length : 0;
  }
  function glyphOpacity(opacity, light, visibility, fade) {
    return clamp(opacity * (0.9 + 0.1 * light) * visibility * fade, 0, 1);
  }
  function fitCanvas(width, height, dpr) {
    const ratio = Math.min(2, Math.max(0.1, dpr || 1), Math.sqrt(12e6 / Math.max(1, width * height)));
    return { ratio, width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) };
  }
  function edgeAttenuation(distance, span) {
    const outer = span * 0.14;
    const feather = Math.max(1, span * 0.1);
    return 1 - smooth((outer - distance) / feather);
  }
  function attenuation(x, y, width, height, quietCenter) {
    const side = Math.min(width, height);
    const vertical = edgeAttenuation(y, height) * edgeAttenuation(height - y, height);
    const horizontal = edgeAttenuation(x, side) * edgeAttenuation(width - x, side);
    const central = quietCenter ? 1 - 0.25 * Math.exp(-(((x / width - 0.5) / 0.29) ** 2)) * smooth(y / height / 0.18) : 1;
    return clamp(vertical * horizontal * central, 0, 1);
  }

  // src/presets.js
  var PRESETS = Object.freeze({
    default: Object.freeze({ count: 3, speed: 0.65, opacity: 0.6, color: "ocean", wind: true, clouds: true, ripples: true, spout: true, rain: false, rainIntensity: 0.45 }),
    rainy: Object.freeze({ count: 3, speed: 0.55, opacity: 0.55, color: "ocean", wind: true, clouds: true, ripples: true, spout: false, rain: true, rainIntensity: 0.35 }),
    minimal: Object.freeze({ count: 1, speed: 0.4, opacity: 0.35, color: "ocean", wind: false, clouds: false, ripples: false, spout: false, rain: false, rainIntensity: 0.45 }),
    night: Object.freeze({ count: 3, speed: 0.5, opacity: 0.45, color: "indigo", wind: true, clouds: true, ripples: true, spout: true, rain: false, rainIntensity: 0.45 })
  });
  function applyPreset(draft, id) {
    if (!Object.hasOwn(PRESETS, id)) throw new RangeError(`Unknown scene: ${id}`);
    return { ...draft, ...PRESETS[id] };
  }
  function matchPreset(draft) {
    const values = { ...draft };
    for (const key of Object.keys(PRESETS.default)) {
      if (FIELDS[key].kind !== "number" || values[key] === void 0) continue;
      if (values[key] === "" || !Number.isFinite(Number(values[key]))) return "custom";
      values[key] = Number(values[key]);
    }
    const config = normalizeConfig(values);
    return Object.entries(PRESETS).find(([, scene]) => Object.entries(scene).every(([key, value]) => {
      const field = FIELDS[key];
      return field.kind === "number" ? Math.round((config[key] - field.min) / field.step) === Math.round((value - field.min) / field.step) : config[key] === value;
    }))?.[0] ?? "custom";
  }

  // src/config-editor.js
  var exclusiveConfig = { glass: "composerAvoid", composerAvoid: "glass" };
  function changeConfigDraft(draft, key, value) {
    const next = { ...draft, [key]: value };
    const opposite = exclusiveConfig[key];
    if (opposite && value === true) next[opposite] = false;
    return next;
  }
  function configEditorState(base, draft, revision) {
    const dirty = Object.entries(FIELDS).some(([key, field]) => field.kind === "number" ? draft[key] === "" || Number(draft[key]) !== base[key] : draft[key] !== base[key]);
    const editor = {
      draft: Object.freeze({ ...draft }),
      dirty,
      change(key, value) {
        return configEditorState(base, changeConfigDraft(draft, key, value), revision);
      },
      applyPreset(id) {
        return configEditorState(base, applyPreset(draft, id), revision);
      },
      reset() {
        return configEditorState(base, { ...DEFAULTS }, revision);
      },
      async save(form) {
        const values = { ...draft };
        for (const [key, field] of Object.entries(FIELDS)) {
          if (field.kind !== "number") continue;
          const value = Number(values[key]);
          if (values[key] === "" || !Number.isFinite(value) || value < field.min || value > field.max || field.step === 1 && !Number.isInteger(value)) return { editor, notice: "invalid" };
          values[key] = value;
        }
        const ops = Object.keys(FIELDS).filter((key) => values[key] !== base[key]).map((key) => ({ op: "set", path: [key], value: values[key] }));
        if (!ops.length) return { editor, notice: "" };
        try {
          const latest = form.getSnapshot();
          const saved = normalizeConfig(latest.value);
          const unchanged = latest.status === "ready" && Object.keys(FIELDS).every((key) => saved[key] === base[key]);
          if (await form.mutate(ops, unchanged ? latest.revision : revision)) {
            return { editor: createConfigEditor(form.getSnapshot()), notice: "saved" };
          }
          return { editor, notice: "conflict" };
        } catch {
          return { editor, notice: "failed" };
        }
      }
    };
    return Object.freeze(editor);
  }
  function createConfigEditor(snapshot) {
    const base = normalizeConfig(snapshot.value);
    return configEditorState(base, { ...base }, snapshot.revision);
  }

  // src/resource-policy.js
  var POLICIES = Object.freeze({
    standard: Object.freeze({
      scheduler: "raf",
      drawIntervalMs: 1e3 / 30,
      motionTick: 1 / 60,
      rainHz: 60,
      swimMultiplier: 1
    }),
    economy: Object.freeze({
      scheduler: "timer",
      drawIntervalMs: 1e3 / 15,
      motionTick: 1 / 30,
      rainHz: 15,
      swimMultiplier: 0.75
    })
  });
  function resourcePolicy(mode) {
    return POLICIES[mode] || POLICIES.standard;
  }

  // src/glass.js
  var GLASS_CONTENT_MIN_WIDTH = 40;
  var GLASS_CONTENT_MIN_HEIGHT = 24;
  var GLASS_CONTENT_FEATHER = 10;
  var GLASS_CONTENT_MAX = 16;
  var GLASS_CONTENT_EDGE_TOLERANCE = 2;
  var GLASS_CONTENT_NEST_INSET = 6;
  var GLASS_CONTENT_CREST_SCALE = 0.22;
  var GLASS_CONTENT_SHADE_SCALE = 0.45;
  var GLASS_CONTENT_MIST_BASE = 0.3;
  var GLASS_CONTENT_MIST_RANGE = 0.06;
  var glassClamp = (value, low, high) => value < low ? low : value > high ? high : value;
  function glassContentPanes({ canvas, boxes, max = GLASS_CONTENT_MAX } = {}) {
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
      clipped.push({
        x,
        y,
        width,
        height,
        radius: glassClamp(Number.isFinite(Number(box.radius)) ? Number(box.radius) : 0, 0, Math.min(width, height) / 2),
        feather: GLASS_CONTENT_FEATHER
      });
    }
    const unique = [];
    for (const pane of clipped) {
      const duplicate = unique.some((other) => Math.abs(pane.x - other.x) <= GLASS_CONTENT_EDGE_TOLERANCE && Math.abs(pane.y - other.y) <= GLASS_CONTENT_EDGE_TOLERANCE && Math.abs(pane.x + pane.width - (other.x + other.width)) <= GLASS_CONTENT_EDGE_TOLERANCE && Math.abs(pane.y + pane.height - (other.y + other.height)) <= GLASS_CONTENT_EDGE_TOLERANCE);
      if (!duplicate) unique.push(pane);
    }
    let kept = unique;
    if (unique.length > limit) {
      kept = unique.map((pane, index) => ({ pane, index })).sort((a, b) => b.pane.width * b.pane.height - a.pane.width * a.pane.height || a.index - b.index).slice(0, limit).sort((a, b) => a.index - b.index).map((entry) => entry.pane);
    }
    for (const pane of kept) {
      pane.nested = kept.some((other) => other !== pane && pane.x >= other.x + GLASS_CONTENT_NEST_INSET && pane.y >= other.y + GLASS_CONTENT_NEST_INSET && pane.x + pane.width <= other.x + other.width - GLASS_CONTENT_NEST_INSET && pane.y + pane.height <= other.y + other.height - GLASS_CONTENT_NEST_INSET);
    }
    return kept;
  }
  function glassRoundedSubpath(ctx, rect) {
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
  function glassClipExterior(ctx, panes, width, height) {
    for (const pane of panes) {
      ctx.beginPath();
      glassRoundedSubpath(ctx, { x: 0, y: 0, width, height, radius: 0 });
      glassRoundedSubpath(ctx, pane);
      ctx.clip("evenodd");
    }
  }
  function glassRoundedPath(ctx, rect) {
    ctx.beginPath();
    glassRoundedSubpath(ctx, rect);
  }
  function glassTone(strength = 0.55, {
    dark = false,
    reducedTransparency = false,
    enabled = true,
    crestScale = 1,
    compact = false
  } = {}) {
    const s = glassClamp(Number.isFinite(strength) ? strength : 0.55, 0, 1);
    if (!enabled || reducedTransparency) return { mode: "clear", strength: s, feather: compact ? 12 : 26 };
    return {
      mode: "frost",
      strength: s,
      scale: Math.round(3 + 4 * s),
      blur: 8 + 12 * s,
      mist: 0.24 + 0.06 * s,
      veil: dark ? 0.045 + 5e-3 * s : 0.033 + 2e-3 * s,
      tint: dark ? "20, 21, 24" : "255, 255, 255",
      silhouette: dark ? "120, 135, 158" : "160, 178, 200",
      crest: `rgba(255, 255, 255, ${(dark ? 0.06 + 0.05 * s : 0.52 + 0.34 * s) * crestScale})`,
      shade: dark ? `rgba(0, 0, 0, ${0.14 + 0.16 * s})` : `rgba(30, 43, 58, ${0.045 + 0.05 * s})`,
      crestHeight: compact ? Math.min(18, 8 + 4 * s) : 22 + 10 * s,
      shadeHeight: compact ? Math.min(18, 10 + 4 * s) : 20 + 12 * s,
      feather: compact ? 12 + 4 * s : 26 + 12 * s
    };
  }
  function glassContentTone(strength = 0.55, options = {}) {
    const tone = glassTone(strength, { ...options, crestScale: GLASS_CONTENT_CREST_SCALE, compact: true });
    if (tone.mode !== "frost") return tone;
    const s = tone.strength;
    const dark = Boolean(options.dark);
    return {
      ...tone,
      mist: GLASS_CONTENT_MIST_BASE + GLASS_CONTENT_MIST_RANGE * s,
      blur: 9 + 12 * s,
      shade: dark ? `rgba(0, 0, 0, ${(0.14 + 0.16 * s) * GLASS_CONTENT_SHADE_SCALE})` : `rgba(30, 43, 58, ${(0.045 + 0.05 * s) * GLASS_CONTENT_SHADE_SCALE})`
    };
  }
  function glassSidebarTone(strength = 0.55, options = {}) {
    const tone = glassContentTone(strength, options);
    if (tone.mode !== "frost") return tone;
    return {
      ...tone,
      blur: 20 + 12 * tone.strength,
      mist: 0.12 + 0.04 * tone.strength,
      veil: 0.025,
      crest: "rgba(255, 255, 255, 0)",
      shade: "rgba(0, 0, 0, 0)"
    };
  }
  function glassSeaFactor(strength = 0.55) {
    const s = glassClamp(Number.isFinite(strength) ? strength : 0.55, 0, 1);
    return glassClamp(Math.round(4 + 2 * s), 4, 6);
  }
  function glassSeaBuffer(width, height, { factor = 4, blur = 12 } = {}) {
    const sourceWidth = Math.max(1, Math.floor(Number.isFinite(width) ? width : 1));
    const sourceHeight = Math.max(1, Math.floor(Number.isFinite(height) ? height : 1));
    const f = glassClamp(Number.isFinite(factor) ? Math.round(factor) : 4, 2, 8);
    const blurPx = Math.max(0, Number.isFinite(blur) ? blur : 0);
    const blurRadius = blurPx / f;
    const pad = Math.max(2, Math.ceil(blurRadius * 3) + 2);
    return {
      factor: f,
      pad,
      blurRadius,
      width: Math.ceil(sourceWidth / f) + pad * 2,
      height: Math.ceil(sourceHeight / f) + pad * 2
    };
  }

  // src/reading-layout.js
  function readingExpandedRect(canvas, card, margin) {
    const x = Math.max(0, card.left - canvas.left - margin);
    const y = Math.max(0, card.top - canvas.top - margin);
    const right = Math.min(canvas.width, card.left - canvas.left + card.width + margin);
    const bottom = Math.min(canvas.height, card.top - canvas.top + card.height + margin);
    return right - x > 0 && bottom - y > 0 ? { x, y, width: right - x, height: bottom - y } : null;
  }
  function createReadingLayout(snapshot, config, material = {}) {
    const { canvas, boxes = [], sidebars = [], composer = null } = snapshot;
    const contentPanes = config.glass ? glassContentPanes({ canvas, boxes, max: 16 }) : [];
    const sidebarPanes = config.glass ? glassContentPanes({ canvas, boxes: sidebars, max: 4 }) : [];
    const panes = [...contentPanes, ...sidebarPanes];
    const tone = config.glass ? glassContentTone(config.glassStrength, material) : null;
    const sidebarTone = config.glass ? glassSidebarTone(config.glassStrength, material) : null;
    const avoidRect = config.composerAvoid && composer ? readingExpandedRect(canvas, composer, 8) : null;
    const fade = !avoidRect ? null : (x, y) => x > avoidRect.x && x < avoidRect.x + avoidRect.width && y > avoidRect.y && y < avoidRect.y + avoidRect.height ? 0 : 1;
    return {
      panes,
      contentPanes,
      sidebarPanes,
      tone,
      sidebarTone,
      fade,
      sceneryFade(x, y) {
        return attenuation(x, y, canvas.width, canvas.height, config.quietCenter) * (fade ? fade(x, y) : 1);
      },
      obstacles(largestRadius) {
        if (!config.composerAvoid || !composer) return [];
        const radius = Number.isFinite(largestRadius) ? largestRadius : 0;
        const obstacle = readingExpandedRect(canvas, composer, Math.max(26, 22 + 0.35 * radius));
        return obstacle && obstacle.width >= 1 && obstacle.height >= 1 ? [obstacle] : [];
      }
    };
  }
  function demoReadingSnapshot(card, width, height) {
    const canvas = { left: 0, top: 0, width, height };
    const composer = card && width > 0 && height > 0 && card.width * width >= 1 && card.height * height >= 1 ? {
      left: card.x * width,
      top: card.y * height,
      width: card.width * width,
      height: card.height * height,
      radius: Number.isFinite(card.radius) ? card.radius : 0
    } : null;
    return { canvas, boxes: composer ? [composer] : [], composer };
  }

  // src/surface.js
  var ASCII_RAMP = ".:-=+*ox%#@";
  var surfaceClamp = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
  var surfacePalettes = /* @__PURE__ */ new Map();
  function surfaceKey(particle) {
    const along = Math.round((particle.x + 1.2) * 28);
    const across = Math.round(Math.atan2(particle.z, particle.y) * 10);
    return (Math.imul(along, 73856093) ^ Math.imul(across, 19349663) ^ Math.imul(particle.whale + 1, 83492791)) >>> 0;
  }
  function surfaceGlyph(particle, light, coverage, mode) {
    if (mode !== "ascii") return particle.glyph;
    if (coverage < 0.6) return coverage < 0.3 ? "." : ":";
    if (particle.part === "eye") return "o";
    const density = surfaceClamp(1 - light);
    const index = Math.round(density * (ASCII_RAMP.length - 1));
    return ASCII_RAMP[index];
  }
  function createCellPalette(name = "ocean", colorIndex) {
    const rainbow = name === "rainbow" ? rainbowColorStops(colorIndex) : null;
    name = rainbow ? `rainbow:${colorIndex}` : name === "azure" || name === "indigo" ? name : "ocean";
    if (surfacePalettes.has(name)) return surfacePalettes.get(name);
    const stops = {
      ocean: [[25, 47, 66], [99, 128, 146], [219, 231, 236]],
      azure: [[21, 55, 73], [83, 138, 160], [210, 234, 241]],
      indigo: [[38, 43, 68], [114, 123, 155], [225, 228, 241]]
    };
    const [shadow, mid, highlight] = rainbow || stops[name];
    const variations = [[0, 0, 0], [-5, 4, 5], [7, 3, -6], [3, -3, 6]];
    const palette = [];
    for (const variation of variations) for (let depth = 0; depth < 16; depth++) for (let shade = 0; shade < 32; shade++) {
      const t = shade / 31, unlit = 1 - t, haze = 0.3 * (depth / 15) ** 1.4;
      const rgb = shadow.map((start, channel) => {
        const value = unlit * unlit * start + 2 * t * unlit * mid[channel] + t * t * highlight[channel] + variation[channel];
        return Math.round(Math.max(0, Math.min(255, value + (247 - value) * haze)));
      });
      palette.push(Object.freeze({ background: `rgb(${rgb.join(", ")})`, luminance: rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 }));
    }
    Object.freeze(palette);
    surfacePalettes.set(name, palette);
    return palette;
  }
  function surfaceDepthOpacity(pose) {
    const depth = pose?.focal > 0 && Number.isFinite(pose.cameraZ) ? pose.cameraZ / pose.focal : 0.14;
    const t = Math.max(0, Math.min(1, (depth - 0.14) / 1.21));
    return 1 - 0.38 * t * t * (3 - 2 * t);
  }
  function createWhalePainter(scene, config) {
    const ascii = config.fillMode === "ascii", tiles = config.renderStyle === "cells";
    const font = ascii ? `600 ${config.glyphSize}px Consolas, "Cascadia Mono", "Courier New", monospace` : `600 ${config.glyphSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
    const alphabet = ascii ? Array.from(ASCII_RAMP) : Array.from(new Set(scene.particles.map((p) => p.glyph)));
    const palette = { ink: createInkPalette(config.color), cells: createCellPalette(config.color) };
    const whalePalettes = config.color === "rainbow" ? (scene.whales || []).map((whale) => ({
      ink: createInkPalette(config.color, whale.colorIndex),
      cells: createCellPalette(config.color, whale.colorIndex)
    })) : null;
    const textDark = "#122635", textLight = "#f2f6fa";
    function paint(target, grid, poses, width, height, ratio = 1, fade = null, dark = false) {
      const opacity = config.opacity, quietCenter = config.quietCenter;
      const depthOpacities = poses.map(surfaceDepthOpacity);
      target.font = font;
      target.textAlign = "center";
      target.textBaseline = "middle";
      let currentFill = "";
      const useFill = (value) => {
        if (value !== currentFill) {
          target.fillStyle = value;
          currentFill = value;
        }
      };
      for (let cell = 0; cell < grid.owners.length; cell++) {
        const owner = grid.owners[cell];
        if (owner < 0) continue;
        const particle = scene.particles[owner], pose = poses[particle.whale];
        const x = grid.centersX[cell], y = grid.centersY[cell], coverage = grid.coverage[cell], light = grid.lights[cell];
        let alpha = glyphOpacity(opacity, light, grid.visibility[cell], attenuation(x, y, width, height, quietCenter)) * (0.3 + coverage * 0.7) * depthOpacities[particle.whale];
        if (fade) alpha *= fade(x, y);
        if (alpha < 0.01) continue;
        const inkLight = grid.atmosphereLights ? grid.atmosphereLights[cell] : light;
        const shade = glyphInkIndex(inkLight, pose.cameraZ / pose.focal);
        const solid = tiles && coverage >= 0.6 && grid.sampleOwners[cell * 5] >= 0;
        const colors = whalePalettes?.[particle.whale] || palette;
        const material = colors.cells[shade + surfaceKey(particle) % 4 * 512];
        if (solid) {
          const gap = 1 / ratio;
          const left = Math.round((x - grid.cellWidth / 2) * ratio) / ratio + gap / 2;
          const top = Math.round((y - grid.cellHeight / 2) * ratio) / ratio + gap / 2;
          const right = Math.round((x + grid.cellWidth / 2) * ratio) / ratio - gap / 2;
          const bottom = Math.round((y + grid.cellHeight / 2) * ratio) / ratio - gap / 2;
          useFill(material.background);
          target.globalAlpha = alpha;
          target.fillRect(left, top, right - left, bottom - top);
        }
        if (solid) {
          const under = dark ? 31 : 250;
          const luminance = material.luminance * alpha + under * (1 - alpha);
          useFill(luminance < 145 ? textLight : textDark);
          target.globalAlpha = Math.min(1, alpha * 1.2);
        } else {
          useFill(colors.ink[shade]);
          target.globalAlpha = alpha;
        }
        target.fillText(
          surfaceGlyph(particle, light, coverage, config.fillMode),
          Math.round(x * ratio) / ratio,
          Math.round(y * ratio) / ratio,
          grid.cellWidth - 2
        );
      }
      target.globalAlpha = 1;
    }
    return { font, alphabet, square: tiles || ascii, paint };
  }

  // src/wake.js
  var WAKE_MAX_PACKETS = 96;
  var WAKE_MAX_GLYPHS = 1200;
  var finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  var clamp2 = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
  var smooth2 = (value) => {
    const t = clamp2(value);
    return t * t * (3 - 2 * t);
  };
  var wrap = (value, span) => (value % span + span) % span;
  var delta = (value, span) => value - Math.round(value / span) * span;
  var turn = (value) => Math.atan2(Math.sin(value), Math.cos(value));
  function identity(whale, index) {
    return Number.isFinite(whale.id) || typeof whale.id === "string" ? whale.id : -1 - index;
  }
  function seedAt(key, sequence) {
    const text = String(key);
    let hash2 = 2166136261;
    for (let i = 0; i < text.length; i++) hash2 = Math.imul(hash2 ^ text.charCodeAt(i), 16777619);
    hash2 = Math.imul(hash2 ^ sequence, 1274126177);
    return ((hash2 ^ hash2 >>> 16) >>> 0) / 4294967296;
  }
  function trailingFrame(whale) {
    const nodes = whale.rig?.nodes;
    if (nodes && nodes.length >= 4) {
      const end = nodes.length - 2, x = nodes[end], y = nodes[end + 1];
      const dx = nodes[end - 2] - x, dy = nodes[end - 1] - y;
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(dx) && Number.isFinite(dy) && Math.hypot(dx, dy) > 1e-3) return { x, y, angle: Math.atan2(dy, dx) };
    }
    const angle = finite(whale.heading), length = Math.max(0, finite(whale.length));
    return {
      x: whale.x - Math.cos(angle) * length * 0.54,
      y: whale.y - Math.sin(angle) * length * 0.54,
      angle
    };
  }
  function createWakeField() {
    return { packets: [], tracks: /* @__PURE__ */ new Map(), width: 0, height: 0 };
  }
  function resetWakeField(field) {
    if (!field || typeof field !== "object") return field;
    if (Array.isArray(field.packets)) field.packets.length = 0;
    else field.packets = [];
    if (field.tracks instanceof Map) field.tracks.clear();
    else field.tracks = /* @__PURE__ */ new Map();
    field.width = field.height = 0;
    return field;
  }
  function stepWake(field, scene, elapsed, options = {}) {
    const dt = finite(elapsed);
    if (!field || typeof field !== "object" || !(dt > 0)) return field;
    if (!Array.isArray(field.packets) || !(field.tracks instanceof Map)) resetWakeField(field);
    const width = finite(scene?.width), height = finite(scene?.height);
    if (width > 0 && height > 0 && field.width > 0 && (field.width !== width || field.height !== height)) resetWakeField(field);
    for (let i = field.packets.length - 1; i >= 0; i--) {
      const packet = field.packets[i];
      if (!packet || !Number.isFinite(packet.age) || !Number.isFinite(packet.life) || !Number.isFinite(packet.x) || !Number.isFinite(packet.y) || (packet.age += dt) >= packet.life) field.packets.splice(i, 1);
    }
    if (!(width > 0 && height > 0)) {
      field.tracks.clear();
      return field;
    }
    field.width = width;
    field.height = height;
    const limit = Math.floor(clamp2(finite(options?.maxWakePackets, WAKE_MAX_PACKETS), 0, WAKE_MAX_PACKETS));
    while (field.packets.length > limit) field.packets.shift();
    const whales = Array.isArray(scene?.whales) ? scene.whales : [];
    const live = /* @__PURE__ */ new Set();
    for (let i = 0; i < whales.length; i++) {
      const whale = whales[i];
      if (!whale || !Number.isFinite(whale.x) || !Number.isFinite(whale.y)) continue;
      const key = identity(whale, i), tail = trailingFrame(whale), motion = whale._motion;
      live.add(key);
      const previous = field.tracks.get(key);
      const radius = clamp2(finite(whale.bodyRadius, finite(whale.length, 120) * 0.08), 4, 90);
      const current = {
        x: whale.x,
        y: whale.y,
        tailX: tail.x,
        tailY: tail.y,
        angle: tail.angle,
        radius,
        distance: 0,
        sequence: previous?.sequence ?? 0
      };
      field.tracks.set(key, current);
      const submergence = clamp2(finite(motion?.submergence));
      const diving = motion?.dive && Number.isFinite(motion.dive.startedAt);
      const resized = previous && Math.abs(previous.radius - radius) > Math.max(0.5, previous.radius * 0.05);
      if (!previous || dt > 0.5 || diving || submergence >= 0.12 || resized) continue;
      const dx = delta(whale.x - previous.x, width), dy = delta(whale.y - previous.y, height);
      const distance = Math.hypot(dx, dy);
      const tailDX = delta(tail.x - previous.tailX, width), tailDY = delta(tail.y - previous.tailY, height);
      const pace = Math.max(1, Math.abs(finite(whale.speed)), Math.abs(finite(motion?.cruise)));
      if (distance > Math.max(3, pace * dt * 2.5) || Math.hypot(tailDX, tailDY) > Math.max(6, distance * 4 + radius * 0.3)) continue;
      if (distance < 1e-4) {
        current.distance = previous.distance;
        continue;
      }
      const speed = distance / dt;
      if (speed < 0.5) continue;
      const spacing = clamp2(radius * 0.65, 10, 24), total = previous.distance + distance;
      const count = Math.floor(total / spacing);
      current.distance = total % spacing;
      const strength = (1 - smooth2(submergence / 0.12)) * (0.28 + 0.72 * clamp2(speed / Math.max(12, radius * 0.8)));
      for (let emitted = Math.max(0, count - 4); emitted < count && limit > 0; emitted++) {
        const t = clamp2((spacing * (emitted + 1) - previous.distance) / distance);
        const seed = seedAt(key, ++current.sequence);
        while (field.packets.length >= limit) field.packets.shift();
        field.packets.push({
          x: wrap(previous.tailX + tailDX * t, width),
          y: wrap(previous.tailY + tailDY * t, height),
          angle: previous.angle + turn(tail.angle - previous.angle) * t,
          age: dt * (1 - t),
          life: 5.8 + seed * 1.4,
          radius,
          span: spacing * 2.4,
          speed,
          strength,
          seed
        });
      }
    }
    for (const key of field.tracks.keys()) if (!live.has(key)) field.tracks.delete(key);
    return field;
  }
  function visitWakePoints(field, options, paint) {
    const packets = field?.packets;
    if (!Array.isArray(packets) || typeof paint !== "function") return 0;
    const width = finite(options?.width, field.width), height = finite(options?.height, field.height);
    if (!(width > 0 && height > 0)) return 0;
    const cell = Math.max(2, (finite(options?.cellWidth, 11) + finite(options?.cellHeight, 13)) * 0.5);
    const limit = Math.floor(clamp2(finite(options?.maxWakeGlyphs, WAKE_MAX_GLYPHS), 0, WAKE_MAX_GLYPHS));
    let drawn = 0;
    const emit = (x, y, glyph, alpha, light) => {
      if (drawn < limit && paint(wrap(x, width), wrap(y, height), glyph, alpha, light)) drawn++;
    };
    for (let p = Math.min(packets.length, WAKE_MAX_PACKETS) - 1; p >= 0 && drawn < limit; p--) {
      const packet = packets[p];
      if (!packet || ![
        packet.x,
        packet.y,
        packet.angle,
        packet.age,
        packet.life,
        packet.radius,
        packet.span,
        packet.speed,
        packet.strength,
        packet.seed
      ].every(Number.isFinite)) continue;
      const progress = clamp2(packet.age / Math.max(1e-3, packet.life));
      const alpha = clamp2(packet.strength) * (1 - progress) ** 1.5 * (0.35 + 0.65 * smooth2(packet.age / 0.25));
      if (!(alpha > 0.015)) continue;
      const fx = Math.cos(packet.angle), fy = Math.sin(packet.angle), nx = -fy, ny = fx;
      const spread = packet.age * (packet.radius * 0.28 + packet.speed * 0.14);
      const samples = Math.floor(clamp2(Math.ceil(packet.span / (cell * 0.8)), 4, 12));
      for (const side of [-1, 1]) for (let i = 0; i < samples && drawn < limit; i++) {
        if ((i + Math.floor(packet.seed * 17)) % 7 === 0) continue;
        const u = i / (samples - 1), along = (0.5 - u) * packet.span;
        const lateral = side * (packet.radius * (0.26 + 0.4 * u) + spread + Math.sin(u * Math.PI) * packet.radius * 0.18);
        const tangentX = -fx * packet.span + nx * side * packet.radius * (0.4 + Math.cos(u * Math.PI) * 0.18 * Math.PI);
        const tangentY = -fy * packet.span + ny * side * packet.radius * (0.4 + Math.cos(u * Math.PI) * 0.18 * Math.PI);
        const glyph = Math.abs(tangentY) < Math.abs(tangentX) * 0.45 ? i % 3 === 0 ? "~" : "-" : Math.abs(tangentX) < Math.abs(tangentY) * 0.35 ? ":" : tangentX * tangentY > 0 ? "\\" : "/";
        emit(
          packet.x + fx * along + nx * lateral,
          packet.y + fy * along + ny * lateral,
          glyph,
          alpha * (0.55 + 0.3 * Math.sin(u * Math.PI)),
          0.28 + packet.seed * 0.1
        );
      }
      for (let i = 0; i < 2 && drawn < limit; i++) {
        const along = -packet.span * (0.15 + i * 0.24);
        const lateral = (packet.seed - 0.5) * packet.radius * 0.35;
        emit(
          packet.x + fx * along + nx * lateral,
          packet.y + fy * along + ny * lateral,
          i ? "'" : ".",
          alpha * 0.24,
          0.46
        );
      }
    }
    return drawn;
  }

  // src/water.js
  var WATER_BEAT = Math.PI * 2;
  var WATER_ACTIVE_STROKE = 0.42;
  var WATER_MAX_RIPPLES = 16;
  var WATER_MIN_LIFE = 2.8;
  var WATER_LIFE_RANGE = 1;
  var WATER_TAIL_FACTOR = 0.54;
  var WATER_MIN_END_RADIUS = 34;
  var WATER_MAX_END_RADIUS = 120;
  var WATER_MIN_START_RADIUS = 3;
  var WATER_MIN_RING_POINTS = 12;
  var WATER_MAX_RING_POINTS = 180;
  var WATER_SPLASH_SECONDS = 0.3;
  var WATER_RIPPLE_DEPTH = 0.16;
  var WATER_SPLASH_GLYPHS = ["'", "·", ","];
  var WATER_DASH_PERIOD = 7;
  var WATER_DASH_GAP = 3;
  var waterFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  var waterClamp = (value, low, high) => value < low ? low : value > high ? high : value;
  function waterHash(a, b, salt = 0) {
    let hash2 = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
    hash2 = Math.imul(hash2 ^ hash2 >>> 13, 1274126177);
    return ((hash2 ^ hash2 >>> 16) >>> 0) / 4294967296;
  }
  function waterKeySeed(index, beat) {
    return waterHash(index + 1, beat);
  }
  function waterWhaleKey(whale, index) {
    const id = whale.id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
    if (typeof id === "string" && id) return id;
    return -1 - index;
  }
  function waterTailPoint(whale) {
    const nodes = whale.rig && whale.rig.nodes;
    if (nodes && nodes.length >= 4) {
      const x = nodes[nodes.length - 2], y = nodes[nodes.length - 1];
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
    const length = Math.max(0, waterFinite(whale.length, 0));
    const heading = waterFinite(whale.heading, 0);
    return {
      x: waterFinite(whale.x, 0) - Math.cos(heading) * length * WATER_TAIL_FACTOR,
      y: waterFinite(whale.y, 0) - Math.sin(heading) * length * WATER_TAIL_FACTOR
    };
  }
  function waterHeadPoint(whale) {
    const nodes = whale.rig && whale.rig.nodes;
    if (nodes && nodes.length >= 2 && Number.isFinite(nodes[0]) && Number.isFinite(nodes[1])) {
      return { x: nodes[0], y: nodes[1] };
    }
    const reach = Math.max(0, waterFinite(whale.length, 0)) * (1.04 / 2.24);
    const heading = waterFinite(whale.heading, 0);
    return {
      x: waterFinite(whale.x, 0) + Math.cos(heading) * reach,
      y: waterFinite(whale.y, 0) + Math.sin(heading) * reach
    };
  }
  var waterImpactPose = {};
  var waterImpactProjected = {};
  function waterImpactPoint(whale, kind, scene) {
    if (!(scene.width > 0 && scene.height > 0)) return null;
    whalePose(whale, scene.time, scene.width, scene.height, 1, waterImpactPose);
    projectParticle(
      kind === "surface" ? DIVE_NOSE_CONTACT : DIVE_TAIL_CONTACT,
      waterImpactPose,
      waterImpactProjected
    );
    return Number.isFinite(waterImpactProjected.x) && Number.isFinite(waterImpactProjected.y) ? waterImpactProjected : null;
  }
  function waterSpawnRipple(ripples, whale, stroke, index, beat, impact = null, point = null) {
    const bodyRadius2 = Math.max(1, waterFinite(whale.bodyRadius, 10));
    const tail = point || (impact === "surface" ? waterHeadPoint(whale) : waterTailPoint(whale));
    const seed = waterKeySeed(index, beat);
    const strength = waterClamp(stroke, 0, 1);
    const endRadius = waterClamp(
      bodyRadius2 * (1.9 + 0.9 * strength),
      WATER_MIN_END_RADIUS,
      WATER_MAX_END_RADIUS
    );
    ripples.push({
      x: tail.x,
      y: tail.y,
      age: 0,
      life: WATER_MIN_LIFE + WATER_LIFE_RANGE * seed,
      startRadius: Math.min(Math.max(WATER_MIN_START_RADIUS, bodyRadius2 * 0.22), endRadius * 0.5),
      endRadius,
      strength,
      seed
    });
    if (impact) {
      const ripple = ripples[ripples.length - 1];
      ripple.kind = impact;
      ripple.heading = waterFinite(whale.heading, 0);
      ripple.aspect = impact === "surface" ? 0.68 : 0.76;
      ripple.endRadius = waterClamp(bodyRadius2 * (impact === "surface" ? 3.8 : 3), 42, 160);
      ripple.startRadius = Math.min(
        ripple.endRadius * 0.7,
        Math.max(8, bodyRadius2 * (impact === "surface" ? 1.25 : 0.95))
      );
      ripple.life = (impact === "surface" ? 4.1 : 3.3) + seed * 0.5;
    }
  }
  function waterRippleRadius(ripple) {
    const life = Math.max(1e-3, waterFinite(ripple && ripple.life, WATER_MIN_LIFE));
    const age = waterClamp(waterFinite(ripple && ripple.age, 0), 0, life);
    const start = Math.max(0, waterFinite(ripple && ripple.startRadius, WATER_MIN_START_RADIUS));
    const end = Math.max(start, waterFinite(ripple && ripple.endRadius, start));
    const progress = age / life;
    const impact = ripple && (ripple.kind === "surface" || ripple.kind === "dive");
    const growth = impact ? 0.35 * (1 - Math.exp(-age * 8)) + 0.65 * (1 - (1 - progress) ** 1.8) : 1 - (1 - progress) ** 1.8;
    return progress >= 1 ? end : start + (end - start) * growth;
  }
  function createWaterField() {
    return { ripples: [], beats: /* @__PURE__ */ new Map(), wake: createWakeField() };
  }
  function resetWaterField(field) {
    if (!field || typeof field !== "object") return field;
    if (Array.isArray(field.ripples)) field.ripples.length = 0;
    else field.ripples = [];
    if (field.beats instanceof Map) field.beats.clear();
    else field.beats = /* @__PURE__ */ new Map();
    if (field.wake) resetWakeField(field.wake);
    else field.wake = createWakeField();
    return field;
  }
  function stepWater(field, scene, delta2, options = {}) {
    if (!field || typeof field !== "object") return field;
    if (!Array.isArray(field.ripples)) field.ripples = [];
    if (!(field.beats instanceof Map)) field.beats = /* @__PURE__ */ new Map();
    const ripples = field.ripples, beats = field.beats;
    const step = waterFinite(delta2, 0);
    const settings = options && typeof options === "object" ? options : {};
    const maxRipples = Math.max(0, Math.floor(waterFinite(settings.maxRipples, WATER_MAX_RIPPLES)));
    if (!field.wake) field.wake = createWakeField();
    stepWake(field.wake, scene, step, settings);
    if (step > 0) {
      for (let i = 0; i < ripples.length; i++) {
        const ripple = ripples[i];
        if (ripple && typeof ripple === "object") ripple.age = waterFinite(ripple.age, 0) + step;
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const ripple = ripples[i];
      const age = waterFinite(ripple && ripple.age, 0);
      const life = waterFinite(ripple && ripple.life, WATER_MIN_LIFE);
      const centred = Boolean(ripple) && typeof ripple === "object" && Number.isFinite(waterFinite(ripple.x, NaN)) && Number.isFinite(waterFinite(ripple.y, NaN));
      if (!centred || !(age < life)) ripples.splice(i, 1);
    }
    if (!(step > 0)) return field;
    const whales = scene && Array.isArray(scene.whales) ? scene.whales : [];
    for (let i = 0; i < whales.length; i++) {
      const whale = whales[i];
      if (!whale || typeof whale !== "object") continue;
      const key = waterWhaleKey(whale, i);
      const motion = whale._motion;
      if (!motion || typeof motion !== "object" || !Number.isFinite(motion.wave)) {
        beats.delete(key);
        continue;
      }
      const beat = Math.floor(motion.wave / WATER_BEAT);
      const dive = motion.dive;
      const splashSerial = Math.max(0, Math.floor(waterFinite(dive && dive.splashSerial, 0)));
      const previous = beats.get(key);
      if (!previous) {
        beats.set(key, { beat, age: 0, splashSerial });
        continue;
      }
      previous.age = waterFinite(previous.age, 0) + step;
      const previousSplash = waterFinite(previous.splashSerial, splashSerial);
      previous.splashSerial = splashSerial;
      if (splashSerial > previousSplash && dive && (dive.splashKind === "dive" || dive.splashKind === "surface") && maxRipples > 0) {
        while (ripples.length >= maxRipples) {
          const ordinary = ripples.findIndex((ripple) => !ripple.kind);
          ripples.splice(ordinary < 0 ? 0 : ordinary, 1);
        }
        waterSpawnRipple(
          ripples,
          whale,
          waterClamp(waterFinite(dive.splashStrength, 1), 0, 1),
          i,
          splashSerial,
          dive.splashKind,
          waterImpactPoint(whale, dive.splashKind, scene)
        );
      }
      const previousBeat = waterFinite(previous.beat, beat);
      if (beat === previousBeat) continue;
      if (beat < previousBeat) {
        previous.beat = beat;
        previous.age = 0;
        continue;
      }
      previous.beat = beat;
      previous.age = 0;
      const stroke = waterClamp(waterFinite(motion.stroke, 0), 0, 1);
      const submergence = waterClamp(waterFinite(motion.submergence, 0), 0, 1);
      const deliberate = dive && dive.startedAt !== null && Number.isFinite(dive.startedAt);
      if (deliberate || submergence > 0.12 || stroke < WATER_ACTIVE_STROKE || ripples.length >= maxRipples) continue;
      waterSpawnRipple(ripples, whale, stroke, i, beat);
    }
    if (beats.size > whales.length + 8) {
      const live = /* @__PURE__ */ new Set();
      for (let i = 0; i < whales.length; i++) {
        const whale = whales[i];
        if (whale && typeof whale === "object") live.add(waterWhaleKey(whale, i));
      }
      for (const key of beats.keys()) if (!live.has(key)) beats.delete(key);
    }
    return field;
  }
  function drawWater(target, field, options = {}) {
    if (!target || typeof target.fillText !== "function") return 0;
    const ripples = field && Array.isArray(field.ripples) ? field.ripples : [];
    if (!ripples.length && !field?.wake?.packets?.length) return 0;
    const settings = options && typeof options === "object" ? options : {};
    const width = waterFinite(settings.width, 0);
    const height = waterFinite(settings.height, 0);
    const cellWidth = Math.max(1, waterFinite(settings.cellWidth, 11));
    const cellHeight = Math.max(1, waterFinite(settings.cellHeight, 13));
    const ratio = Math.max(0.01, waterFinite(settings.ratio, 1));
    const opacity = waterClamp(waterFinite(settings.opacity, 0.5), 0, 1);
    if (!(width > 0) || !(height > 0) || !(opacity > 0)) return 0;
    const palette = settings.palette && typeof settings.palette.length === "number" && settings.palette.length > 0 ? settings.palette : createInkPalette("ocean");
    const fade = typeof settings.fade === "function" ? settings.fade : null;
    const columns = Math.max(1, Math.ceil(width / cellWidth));
    const rows = Math.max(1, Math.ceil(height / cellHeight));
    const snap = (value) => Math.round(value * ratio) / ratio;
    if (typeof settings.font === "string" && settings.font) target.font = settings.font;
    target.textAlign = "center";
    target.textBaseline = "middle";
    let currentFill = null;
    let drawn = 0;
    const paintPoint = (x, y, glyph, alpha, light, seen) => {
      if (!(alpha > 0)) return;
      const col = Math.floor(x / cellWidth), row = Math.floor(y / cellHeight);
      if (col < 0 || col >= columns || row < 0 || row >= rows) return;
      const key = row * columns + col;
      if (seen.has(key)) return;
      seen.add(key);
      const centreX = snap((col + 0.5) * cellWidth);
      const centreY = snap((row + 0.5) * cellHeight);
      let visibility = 1;
      if (fade) {
        visibility = waterClamp(waterFinite(fade(centreX, centreY), 0), 0, 1);
        if (!(visibility > 0)) return;
      }
      const value = Math.min(opacity, alpha * visibility);
      if (!(value > 0.01)) return;
      const shade = glyphInkIndex(light, WATER_RIPPLE_DEPTH);
      const fill = palette[shade < palette.length ? shade : palette.length - 1];
      if (fill !== currentFill) {
        target.fillStyle = fill;
        currentFill = fill;
      }
      target.globalAlpha = value;
      target.fillText(glyph, centreX, centreY, Math.max(1, cellWidth * 1.1));
      drawn++;
      return true;
    };
    for (let r = 0; r < ripples.length; r++) {
      const ripple = ripples[r];
      if (!ripple || typeof ripple !== "object") continue;
      const x = waterFinite(ripple.x, NaN), y = waterFinite(ripple.y, NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const life = Math.max(1e-3, waterFinite(ripple.life, WATER_MIN_LIFE));
      const age = waterClamp(waterFinite(ripple.age, 0), 0, life);
      const progress = age / life;
      const strength = waterClamp(waterFinite(ripple.strength, 0.5), 0, 1);
      const seed = waterClamp(waterFinite(ripple.seed, 0.5), 0, 1);
      const radius = waterRippleRadius(ripple);
      const impact = ripple.kind === "surface" || ripple.kind === "dive";
      const bow = ripple.kind === "surface";
      const axis = impact ? waterFinite(ripple.heading, 0) + Math.PI / 2 : 0;
      const aspect = impact ? waterClamp(waterFinite(ripple.aspect, 1), 0.4, 1) : 1;
      const axisCos = Math.cos(axis), axisSin = Math.sin(axis);
      const ageFade = (1 - progress) ** 1.5;
      if (!(ageFade > 0)) continue;
      const impulse = impact ? 1 - waterClamp(age / 0.85, 0, 1) : 0;
      const light = waterClamp(0.4 + 0.1 * strength - 0.25 * impulse, 0, 1);
      const outerAlpha = opacity * (0.7 + 0.25 * strength) * ageFade;
      const seen = /* @__PURE__ */ new Set();
      const spacing = Math.max(4, (cellWidth + cellHeight) * 0.45);
      for (let ring = 0; ring < 2; ring++) {
        const ringRadius = ring === 0 ? radius : radius * 0.7;
        if (ring === 1 && (ringRadius < 6 || ageFade < 0.3)) continue;
        const count = Math.max(WATER_MIN_RING_POINTS, Math.min(
          WATER_MAX_RING_POINTS,
          Math.ceil(Math.PI * 2 * ringRadius / spacing)
        ));
        const dashOffset = Math.floor(seed * 97) + ring * 31;
        for (let i = 0; i < count; i++) {
          if ((i + dashOffset) % WATER_DASH_PERIOD < WATER_DASH_GAP) continue;
          const angle = (i + 0.5) / count * Math.PI * 2 + (waterHash(i, ring + 7, dashOffset) - 0.5) * 0.14;
          const wobble = (waterHash(i, ring + 11, dashOffset) - 0.5) * cellWidth * 0.5;
          const pointRadius = ringRadius + wobble;
          const pointLight = waterClamp(light + (waterHash(i, ring + 17, dashOffset) - 0.5) * 0.1 + (ring === 0 ? 0.05 : -0.05), 0, 1);
          const pick2 = waterHash(i, ring + 23, dashOffset);
          const angleCos = Math.cos(angle), angleSin = Math.sin(angle);
          if (bow && angleSin > 0.65) continue;
          const tangentX = -angleSin * axisCos - angleCos * aspect * axisSin;
          const tangentY = -angleSin * axisSin + angleCos * aspect * axisCos;
          const horizontal = Math.abs(tangentX) / Math.hypot(tangentX, tangentY) > 0.82;
          const glyph = impact && impulse > 0.15 && ring === 0 ? horizontal ? "~" : ":" : ring === 0 ? horizontal ? pick2 < 0.75 ? "~" : "·" : pick2 < 0.72 ? "·" : pick2 < 0.9 ? "˙" : "'" : pick2 < 0.7 ? "·" : "˙";
          const localX = angleCos * pointRadius;
          const localY = angleSin * pointRadius * aspect;
          paintPoint(
            x + localX * axisCos - localY * axisSin,
            y + localX * axisSin + localY * axisCos,
            glyph,
            ring === 0 ? outerAlpha : outerAlpha * 0.5,
            pointLight,
            seen
          );
        }
      }
      const splashLife = impact ? 0.5 : WATER_SPLASH_SECONDS;
      if (age < splashLife) {
        const splashFade = 1 - age / splashLife;
        const drops = (impact ? 7 : 3) + Math.floor(seed * 2);
        const startRadius = Math.max(
          WATER_MIN_START_RADIUS,
          waterFinite(ripple.startRadius, WATER_MIN_START_RADIUS)
        );
        for (let s = 0; s < drops; s++) {
          const angle = bow ? waterFinite(ripple.heading, 0) + (s / Math.max(1, drops - 1) - 0.5) * Math.PI * 1.2 : seed * Math.PI * 2 + s / drops * Math.PI * 2 + (waterHash(s, 5, Math.round(seed * 1024)) - 0.5) * 0.8;
          const spread = startRadius + (cellWidth + 3) * (0.4 + (1 - splashFade) * 1.1);
          paintPoint(
            x + Math.cos(angle) * spread,
            y + Math.sin(angle) * spread,
            WATER_SPLASH_GLYPHS[s % WATER_SPLASH_GLYPHS.length],
            opacity * 0.85 * splashFade,
            waterClamp(light + 0.08, 0, 1),
            seen
          );
        }
      }
    }
    const wakeCells = /* @__PURE__ */ new Set();
    visitWakePoints(field?.wake, settings, (x, y, glyph, alpha, light) => paintPoint(x, y, glyph, opacity * 0.9 * alpha, light, wakeCells));
    target.globalAlpha = 1;
    return drawn;
  }

  // src/atmosphere.js
  var ATMOS_MAX_WIND = 192;
  var ATMOS_CLOUD_TEXELS = 8192;
  var ATMOS_MASK_TILES = 6144;
  var ATMOS_MASK_PIXELS = 2097152;
  var ATMOS_MASK_LEVELS = 32;
  var atmosCloudBuffers = /* @__PURE__ */ new WeakMap();
  var atmosFinite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  var atmosClamp = (value, lo = 0, hi = 1) => value < lo ? lo : value > hi ? hi : value;
  var atmosSmooth = (value) => {
    const t = atmosClamp(value);
    return t * t * (3 - 2 * t);
  };
  var atmosWrap = (value) => value - Math.floor(value);
  var atmosDelta = (value) => value - Math.round(value);
  function atmosHash(a, b = 0, salt = 0) {
    let value = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967296;
  }
  function createAtmosphereField(options = {}) {
    const seed = atmosFinite(options.seed, 0) >>> 0;
    const clouds = Array.from({ length: 3 }, (_, i) => {
      const key = i + 11;
      return {
        u: atmosHash(key, seed, 1),
        v: atmosHash(key, seed, 2),
        rx: 0.18 + 0.075 * atmosHash(key, seed, 3),
        ry: 0.14 + 0.07 * atmosHash(key, seed, 4),
        phase: atmosHash(key, seed, 5) * Math.PI * 2,
        lobes: Array.from({ length: 4 }, (_2, lobe) => ({
          x: (atmosHash(key, seed, 10 + lobe) - 0.5) * 0.9,
          y: (atmosHash(key, seed, 20 + lobe) - 0.5) * 0.8,
          radius: 0.5 + 0.25 * atmosHash(key, seed, 30 + lobe)
        }))
      };
    });
    const gusts = Array.from({ length: 12 }, (_, i) => ({
      u: atmosHash(i + 1, seed, 71),
      v: atmosHash(i + 1, seed, 72),
      life: 9 + 7 * atmosHash(i + 1, seed, 73),
      phase: 17 * atmosHash(i + 1, seed, 74),
      length: 0.055 + 0.055 * atmosHash(i + 1, seed, 75),
      bend: (atmosHash(i + 1, seed, 76) - 0.5) * 0.8
    }));
    return {
      seed,
      time: 0,
      width: Math.max(0, atmosFinite(options.width, 0)),
      height: Math.max(0, atmosFinite(options.height, 0)),
      clouds,
      gusts
    };
  }
  function resizeAtmosphereField(field, width, height) {
    if (!field) return field;
    field.width = Math.max(0, atmosFinite(width, 0));
    field.height = Math.max(0, atmosFinite(height, 0));
    return field;
  }
  function stepAtmosphere(field, delta2, metrics = null) {
    if (field && Number.isFinite(delta2) && delta2 > 0) {
      const started = metrics?.begin();
      field.time += delta2;
      metrics?.end("atmosphereUpdate", started);
    }
    return field;
  }
  function atmosphereWindAt(field, x = 0, y = 0, out = {}) {
    const width = Math.max(1, atmosFinite(field?.width, 1));
    const height = Math.max(1, atmosFinite(field?.height, 1));
    const time = atmosFinite(field?.time, 0), seed = atmosFinite(field?.seed, 0);
    const phase = atmosHash(seed, 17, 91) * Math.PI * 2;
    const u = atmosFinite(x, 0) / width, v = atmosFinite(y, 0) / height;
    const angle = -0.14 + 0.15 * Math.sin(time * 0.065 + phase) + 0.045 * Math.sin(Math.PI * 2 * v + time * 0.09 + phase);
    const strength = 0.86 + 0.14 * Math.sin(time * 0.21 + phase + Math.PI * 2 * u);
    const speed = Math.min(width, height) * 0.027 * strength;
    out.x = Math.cos(angle) * speed;
    out.y = Math.sin(angle) * speed;
    return out;
  }
  function atmosphereCloudAt(field, x, y) {
    if (!field || !(field.width > 0 && field.height > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const time = atmosFinite(field.time, 0);
    const u = x / field.width, v = y / field.height;
    let remaining = 1;
    for (const cloud of field.clouds || []) {
      const dx = atmosDelta(u - cloud.u - time * 9e-4) / cloud.rx;
      const dy = atmosDelta(v - cloud.v + time * 16e-5) / cloud.ry;
      if (Math.abs(dx) > 2.2 || Math.abs(dy) > 2.2) continue;
      let density = 0;
      for (const lobe of cloud.lobes) {
        const lx = (dx - lobe.x) / lobe.radius, ly = (dy - lobe.y) / lobe.radius;
        density += Math.exp(-(lx * lx + ly * ly) * 1.6) * 0.42;
      }
      remaining *= 1 - atmosSmooth((density - 0.1) / 0.87) * 0.82;
    }
    return atmosClamp(1 - remaining);
  }
  function shadeAtmosphere(field, grid, options = {}) {
    if (!grid || !grid.lights) return;
    if (!options.clouds) {
      if (grid.atmosphereLights) grid.atmosphereLights.set(grid.lights);
      return;
    }
    if (grid.atmosphereLights?.length !== grid.lights.length) {
      grid.atmosphereLights = new Float32Array(grid.lights.length);
    }
    grid.atmosphereLights.set(grid.lights);
    for (let cell = 0; cell < grid.owners.length; cell++) {
      if (grid.owners[cell] < 0) continue;
      grid.atmosphereLights[cell] = Math.max(0, grid.lights[cell] - 0.1 * atmosphereCloudAt(field, grid.centersX[cell], grid.centersY[cell]));
    }
  }
  function atmosRasterSize(width, height, budget, minimum = 1) {
    const scale = Math.max(minimum, width / 192, height / 128, Math.sqrt(width * height / budget));
    return { columns: Math.max(1, Math.floor(width / scale)), rows: Math.max(1, Math.floor(height / scale)) };
  }
  function atmosCloudBuffer(target, field, width, height, ink) {
    if (typeof target.drawImage !== "function") return null;
    let buffer = atmosCloudBuffers.get(field);
    if (!buffer) {
      try {
        const document2 = target.canvas?.ownerDocument || globalThis.document;
        const canvas2 = document2?.createElement ? document2.createElement("canvas") : typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : null;
        const context2 = canvas2?.getContext("2d");
        if (!context2 || typeof context2.fillRect !== "function") return null;
        buffer = { canvas: canvas2, context: context2 };
        atmosCloudBuffers.set(field, buffer);
      } catch {
        return null;
      }
    }
    const { columns, rows } = atmosRasterSize(width, height, ATMOS_CLOUD_TEXELS);
    if (buffer.time === field.time && buffer.width === width && buffer.height === height && buffer.fieldWidth === field.width && buffer.fieldHeight === field.height && buffer.ink === ink) return buffer;
    const { canvas, context } = buffer;
    if (canvas.width !== columns) canvas.width = columns;
    if (canvas.height !== rows) canvas.height = rows;
    context.clearRect(0, 0, columns, rows);
    context.fillStyle = ink;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const shadow = atmosphereCloudAt(field, (col + 0.5) * width / columns, (row + 0.5) * height / rows);
      if (!(shadow > 1e-3)) continue;
      context.globalAlpha = shadow;
      context.fillRect(col, row, 1, 1);
    }
    context.globalAlpha = 1;
    Object.assign(buffer, { time: field.time, width, height, fieldWidth: field.width, fieldHeight: field.height, ink });
    return buffer;
  }
  function atmosMaskRuns(buffer, fade, width, height, pixelsX, pixelsY, columns, rows) {
    const cached = buffer.maskRuns;
    if (cached && cached.fade === fade && cached.width === width && cached.height === height && cached.pixelsX === pixelsX && cached.pixelsY === pixelsY && cached.columns === columns && cached.rows === rows) return cached.runs;
    const runs = [];
    for (let row = 0; row < rows; row++) {
      const top = Math.floor(row * pixelsY / rows), bottom = Math.floor((row + 1) * pixelsY / rows);
      let start = 0, previous = 0;
      for (let col = 0; col <= columns; col++) {
        let rank2 = 0;
        if (col < columns) {
          const left = Math.floor(col * pixelsX / columns), right = Math.floor((col + 1) * pixelsX / columns);
          let mask = 1;
          for (let iy = 0; iy < 3 && mask > 0; iy++) for (let ix = 0; ix < 3 && mask > 0; ix++) {
            mask = Math.min(mask, atmosClamp(atmosFinite(fade(
              (left + (right - left) * ix / 2) * width / pixelsX,
              (top + (bottom - top) * iy / 2) * height / pixelsY
            ), 0)));
          }
          rank2 = Math.floor(mask * ATMOS_MASK_LEVELS);
        }
        if (rank2 !== previous) {
          if (previous > 0) {
            const left = Math.floor(start * pixelsX / columns), right = Math.floor(col * pixelsX / columns);
            runs.push(left, top, right - left, bottom - top, previous / ATMOS_MASK_LEVELS);
          }
          start = col;
          previous = rank2;
        }
      }
    }
    buffer.maskRuns = { fade, width, height, pixelsX, pixelsY, columns, rows, runs };
    return runs;
  }
  function atmosDrawClouds(target, field, width, height, opacity, palette, dark, fade) {
    const buffer = atmosCloudBuffer(
      target,
      field,
      width,
      height,
      dark ? "rgb(2, 8, 16)" : palette[glyphInkIndex(0.1, 0.16)]
    );
    if (!buffer) return 0;
    let source = buffer.canvas;
    if (fade) {
      if (!buffer.maskCanvas) {
        try {
          const document2 = target.canvas?.ownerDocument || globalThis.document;
          buffer.maskCanvas = document2?.createElement ? document2.createElement("canvas") : typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : null;
          buffer.maskContext = buffer.maskCanvas?.getContext("2d");
        } catch {
          return 0;
        }
        if (!buffer.maskContext) return 0;
      }
      const canvas = buffer.maskCanvas, context = buffer.maskContext;
      const scale = Math.min(1, 4096 / width, 4096 / height, Math.sqrt(ATMOS_MASK_PIXELS / (width * height)));
      const pixelsX = Math.max(1, Math.floor(width * scale)), pixelsY = Math.max(1, Math.floor(height * scale));
      if (canvas.width !== pixelsX) canvas.width = pixelsX;
      if (canvas.height !== pixelsY) canvas.height = pixelsY;
      context.clearRect(0, 0, pixelsX, pixelsY);
      const size2 = atmosRasterSize(width, height, ATMOS_MASK_TILES, 8);
      const columns = Math.min(pixelsX, size2.columns), rows = Math.min(pixelsY, size2.rows);
      const runs = atmosMaskRuns(buffer, fade, width, height, pixelsX, pixelsY, columns, rows);
      if (!runs.length) {
        context.globalAlpha = 1;
        return 0;
      }
      context.fillStyle = "#fff";
      for (let i = 0; i < runs.length; i += 5) {
        context.globalAlpha = runs[i + 4];
        context.fillRect(runs[i], runs[i + 1], runs[i + 2], runs[i + 3]);
      }
      context.globalAlpha = 1;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.globalCompositeOperation = "source-in";
      context.drawImage(buffer.canvas, 0, 0, pixelsX, pixelsY);
      context.globalCompositeOperation = "source-over";
      source = canvas;
    }
    const smoothing = target.imageSmoothingEnabled, quality = target.imageSmoothingQuality;
    target.imageSmoothingEnabled = !fade;
    target.imageSmoothingQuality = "high";
    target.globalAlpha = opacity * (dark ? 0.78 : 0.42);
    target.drawImage(source, 0, 0, width, height);
    target.imageSmoothingEnabled = smoothing;
    target.imageSmoothingQuality = quality;
    return 1;
  }
  function drawAtmosphere(target, field, options = {}) {
    const result = { wind: 0, clouds: 0 };
    if (!target || typeof target.fillText !== "function" || !field) return result;
    const width = atmosFinite(options.width, field.width), height = atmosFinite(options.height, field.height);
    const opacity = atmosClamp(atmosFinite(options.opacity, 0.6));
    if (!(width > 0 && height > 0 && opacity > 0)) return result;
    const ratio = Math.max(0.1, atmosFinite(options.ratio, 1));
    const cellWidth = Math.max(5, atmosFinite(options.cellWidth, 11));
    const cellHeight = Math.max(5, atmosFinite(options.cellHeight, 13));
    const palette = options.palette || createInkPalette("ocean");
    const fade = typeof options.fade === "function" ? options.fade : null;
    const time = atmosFinite(field.time, 0);
    target.font = `600 ${Math.max(9, Math.min(13, cellHeight * 0.92))}px Consolas, "Cascadia Mono", monospace`;
    target.textAlign = "center";
    target.textBaseline = "middle";
    let fill = null;
    const paint = (glyph, x, y, alpha, light, kind) => {
      x = Math.round(x * ratio) / ratio;
      y = Math.round(y * ratio) / ratio;
      if (!(x >= 0 && x < width && y >= 0 && y < height)) return;
      const mask = fade ? atmosClamp(atmosFinite(fade(x, y), 0)) : 1;
      alpha *= mask;
      if (!(alpha > 6e-3)) return;
      const ink = palette[glyphInkIndex(light, 0.16)];
      if (ink !== fill) {
        target.fillStyle = ink;
        fill = ink;
      }
      target.globalAlpha = Math.min(opacity * 0.24, alpha);
      target.fillText(glyph, x, y, cellWidth);
      result[kind]++;
    };
    if (options.clouds) result.clouds = atmosDrawClouds(
      target,
      field,
      width,
      height,
      opacity,
      palette,
      options.dark,
      fade
    );
    if (options.wind) {
      const size2 = Math.min(width, height), breeze = {};
      for (let i = 0; i < field.gusts.length && result.wind < ATMOS_MAX_WIND; i++) {
        const gust = field.gusts[i];
        const clock = time + gust.phase, cycle = Math.floor(clock / gust.life), age = clock - cycle * gust.life;
        const envelope = atmosSmooth(age / (gust.life * 0.22)) * atmosSmooth((gust.life - age) / (gust.life * 0.28));
        if (envelope < 0.02) continue;
        const anchorX = atmosWrap(gust.u + atmosHash(i, cycle, field.seed) * 0.25) * width;
        const anchorY = atmosWrap(gust.v + atmosHash(i, cycle, field.seed + 1) * 0.2) * height;
        atmosphereWindAt(field, anchorX, anchorY, breeze);
        const speed = Math.hypot(breeze.x, breeze.y) || 1;
        const fx = breeze.x / speed, fy = breeze.y / speed, nx = -fy, ny = fx;
        const length = Math.max(cellWidth * 4, size2 * gust.length);
        const count = Math.min(16, Math.max(4, Math.ceil(length / (cellWidth * 0.85))));
        for (let j = 0; j < count && result.wind < ATMOS_MAX_WIND; j++) {
          const u = j / (count - 1), along = length * (u - 0.5) + speed * age;
          const bend = Math.sin(u * Math.PI) * size2 * gust.bend * 0.025;
          const x = atmosWrap((anchorX + fx * along + nx * bend) / width) * width;
          const y = atmosWrap((anchorY + fy * along + ny * bend) / height) * height;
          const feather = Math.sin(Math.PI * (0.08 + 0.84 * u));
          const shadow = options.clouds ? atmosphereCloudAt(field, x, y) : 0;
          paint(
            j % 4 === 1 ? "~" : "-",
            x,
            y,
            opacity * 0.24 * envelope * feather,
            0.4 - shadow * 0.1,
            "wind"
          );
        }
      }
    }
    target.globalAlpha = 1;
    return result;
  }

  // src/activity.js
  var unavailable = Object.freeze({ currentSession: "unavailable", liveStatus: "unavailable", jobs: "unavailable" });
  var EMPTY_ACTIVITY = Object.freeze({ scope: null, entities: Object.freeze([]), availability: unavailable });
  var unknownJobs = Object.freeze({ rows: Object.freeze({}) });
  var emptyJobs = Object.freeze({ ...unknownJobs, available: false });
  var rank = (entity) => entity.kind === "waiting" ? 0 : entity.kind === "failed" ? 1 : entity.kind === "completed" ? 2 : entity.kind === "running" ? 3 : 4;
  var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  var sessionKind = (row, status) => status?.pendingInteraction ? "waiting" : (status?.running ?? row?.running) === true ? "running" : typeof status?.running === "boolean" ? "idle" : "unavailable";
  function currentSessionId(list) {
    return Object.values(list?.byId ?? {}).find((row) => (row?.retainedBy?.mainView ?? 0) > 0)?.id ?? null;
  }
  function readActivitySnapshot(list, statuses, jobs = emptyJobs) {
    const scope = currentSessionId(list);
    if (!scope) return EMPTY_ACTIVITY;
    const rows = new Map(Object.entries(list?.byId ?? {}));
    for (const [parentId, projection] of Object.entries(list?.projectionsBySession ?? {})) {
      for (const entry of projection?.values?.subagentCatalog ?? []) {
        if (!record(entry) || entry.mode === "external" || typeof entry.id !== "string") continue;
        if (!rows.has(entry.id)) rows.set(entry.id, { id: entry.id, parentId, origin: "subagent", displayTitle: entry.label });
      }
    }
    const related = /* @__PURE__ */ new Set([scope]);
    for (let pass = 0; pass < rows.size; pass++) {
      let added = false;
      for (const [id, row] of rows) if (related.has(row?.parentId) && !related.has(id)) {
        related.add(id);
        added = true;
      }
      if (!added) break;
    }
    const entities = [];
    for (const [id, row] of rows) {
      if (!record(row) || typeof id !== "string") continue;
      if (!related.has(id)) continue;
      const status = statuses?.get?.(id);
      const kind = sessionKind(row, status);
      entities.push({
        key: `session:${id}`,
        type: row.origin === "subagent" || row.parentId ? "subagent" : "session",
        label: String(row.displayTitle ?? row.title ?? "").trim(),
        kind,
        primary: id === scope,
        waitingAvailable: record(status)
      });
    }
    const jobRows = record(jobs?.rows) && Object.hasOwn(jobs.rows, scope) && Array.isArray(jobs.rows[scope]) ? jobs.rows[scope] : null;
    const jobsAvailability = jobs?.available === false ? "unavailable" : jobRows ? "available" : "unknown";
    const seen = /* @__PURE__ */ new Set();
    for (const job of jobsAvailability === "available" ? jobRows : []) {
      if (!record(job) || typeof job.id !== "string" && typeof job.id !== "number") continue;
      const key = `job:${job.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const kind = job.status === "running" || job.status === "stopping" ? "running" : job.status === "completed" ? "completed" : job.status === "failed" ? "failed" : ["killed", "cancelled", "stopped"].includes(job.status) ? "idle" : "unavailable";
      entities.push({ key, type: "job", label: String(job.label ?? "").trim(), kind, primary: false });
    }
    return { scope, entities, availability: {
      currentSession: "available",
      liveStatus: typeof statuses?.get === "function" ? "available" : "unavailable",
      jobs: jobsAvailability
    } };
  }
  function createActivityTracker({ onChange } = {}) {
    let snapshot = EMPTY_ACTIVITY, scope = null, seats = [], now = 0;
    let dirty = true, appliedWhales = null, appliedEnabled = null, nextExpiry = Infinity;
    const runningJobs = /* @__PURE__ */ new Set(), terminal = /* @__PURE__ */ new Map();
    let previousKinds = /* @__PURE__ */ new Map(), transitions = [], serial = 0, published = "";
    function publish(entities, badges, overflow, enabled) {
      const value = {
        scope: enabled ? scope : null,
        enabled,
        availability: snapshot.availability ?? unavailable,
        entities,
        seats: badges,
        overflow
      };
      const signature = JSON.stringify(value);
      if (signature === published && !transitions.length) return;
      published = signature;
      const freezeRows = (rows) => Object.freeze(rows.map((row) => row ? Object.freeze({ ...row }) : null));
      onChange?.(Object.freeze({
        ...value,
        availability: Object.freeze({ ...value.availability }),
        entities: freezeRows(entities),
        seats: freezeRows(badges),
        overflow: freezeRows(overflow),
        transitions: freezeRows(transitions)
      }));
      transitions = [];
    }
    function update(next = EMPTY_ACTIVITY) {
      const changedScope = next.scope !== scope;
      if (changedScope) {
        scope = next.scope;
        seats = [];
        runningJobs.clear();
        terminal.clear();
        previousKinds.clear();
        transitions = [];
      }
      snapshot = next;
      dirty = true;
      const present = /* @__PURE__ */ new Set();
      for (const entity of snapshot.entities) {
        if (!changedScope && entity.kind === "waiting" && previousKinds.get(entity.key) !== "waiting") {
          transitions.push({ ...entity, event: ++serial });
        }
        if (entity.type !== "job") continue;
        present.add(entity.key);
        if (entity.kind === "running") {
          runningJobs.add(entity.key);
          terminal.delete(entity.key);
        } else if (runningJobs.delete(entity.key) && (entity.kind === "completed" || entity.kind === "failed")) {
          terminal.set(entity.key, { ...entity, until: now + 6 });
          transitions.push({ ...entity, event: ++serial });
        } else if (terminal.has(entity.key)) {
          terminal.set(entity.key, { ...terminal.get(entity.key), label: entity.label });
        }
      }
      previousKinds = new Map(snapshot.entities.map((entity) => [entity.key, entity.kind]));
      for (const key of runningJobs) if (!present.has(key)) runningJobs.delete(key);
      for (const key of terminal.keys()) if (!present.has(key)) terminal.delete(key);
    }
    function apply(whales, time, enabled = true) {
      now = time;
      if (!dirty && appliedWhales === whales && appliedEnabled === enabled && now + 1e-9 < nextExpiry) return;
      dirty = false;
      appliedWhales = whales;
      appliedEnabled = enabled;
      if (!enabled || !scope) {
        for (const whale of whales) delete whale.activity;
        transitions = [];
        nextExpiry = Infinity;
        if (!enabled) {
          runningJobs.clear();
          terminal.clear();
          previousKinds.clear();
        }
        publish([], [], [], enabled);
        return;
      }
      for (const [key, entity] of terminal) if (entity.until <= now + 1e-9) terminal.delete(key);
      nextExpiry = Infinity;
      for (const entity of terminal.values()) nextExpiry = Math.min(nextExpiry, entity.until);
      const candidates = snapshot.entities.filter((entity) => entity.type !== "job" || !["completed", "failed"].includes(entity.kind));
      candidates.push(...terminal.values());
      const primary = candidates.find((entity) => entity.primary);
      const rest = candidates.filter((entity) => !entity.primary).sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key));
      const chosen = primary ? [primary, ...rest.slice(0, Math.max(0, whales.length - 1))] : rest.slice(0, whales.length);
      const wanted = new Map(chosen.map((entity) => [entity.key, entity]));
      seats = whales.map((_, index) => index === 0 && primary ? primary.key : seats[index] !== primary?.key && wanted.has(seats[index]) ? seats[index] : null);
      const seated = new Set(seats.filter(Boolean));
      for (const entity of chosen) if (!seated.has(entity.key)) {
        const index = seats.indexOf(null);
        if (index < 0) break;
        seats[index] = entity.key;
        seated.add(entity.key);
      }
      const overflow = candidates.filter((entity) => !seated.has(entity.key));
      const urgent = overflow.sort((a, b) => rank(a) - rank(b))[0];
      for (let i = 0; i < whales.length; i++) {
        const entity = wanted.get(seats[i]);
        if (!entity) {
          delete whales[i].activity;
          continue;
        }
        whales[i].activity = i === 0 && overflow.length ? {
          ...entity,
          overflow: overflow.length,
          ...urgent && rank(urgent) < rank(entity) ? { kind: urgent.kind, attention: urgent.label } : {}
        } : entity;
      }
      publish(
        candidates.map(({ until, ...entity }) => entity),
        whales.map((whale) => whale.activity ?? null),
        overflow.map(({ until, ...entity }) => entity),
        enabled
      );
    }
    return { update, apply };
  }
  function createJobsBridge() {
    let service = null, scope = null, release = null, unsubscribe = null, snapshot = emptyJobs;
    const listeners = /* @__PURE__ */ new Set();
    const publish = () => {
      snapshot = scope && service ? service.state.getSnapshot() ?? unknownJobs : emptyJobs;
      for (const listener of listeners) listener();
    };
    function connect() {
      release?.();
      unsubscribe?.();
      release = unsubscribe = null;
      if (scope && service) {
        unsubscribe = service.state.subscribe(publish);
        release = service.watchRows(scope);
      }
      publish();
    }
    function watch(next) {
      if (next === scope) return;
      scope = next;
      connect();
    }
    function attach(next) {
      service = next;
      connect();
      return () => {
        if (service !== next) return;
        release?.();
        unsubscribe?.();
        release = unsubscribe = null;
        service = null;
        publish();
      };
    }
    return {
      attach,
      watch,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot: () => snapshot
    };
  }
  function drawActivityBadges(ink, whales, width, height, { dark = false, opacity = 1, fade = () => 1 } = {}) {
    ink.save();
    ink.font = "600 13px system-ui, sans-serif";
    ink.textAlign = "center";
    ink.textBaseline = "middle";
    for (const whale of whales) {
      const activity = whale.activity;
      if (!activity) continue;
      const quiet = activity.kind === "idle" || activity.kind === "unavailable";
      if (quiet && !activity.overflow) continue;
      const symbol = quiet ? "" : activity.kind === "waiting" ? "!" : activity.kind === "failed" ? "×" : activity.kind === "completed" ? "✓" : "···";
      const label = quiet || activity.kind === "running" ? "" : ` ${Array.from(activity.attention ?? activity.label).slice(0, 18).join("")}`;
      const text = `${symbol}${label}${activity.overflow ? ` +${activity.overflow}` : ""}`.trim();
      ink.fillStyle = activity.kind === "waiting" ? dark ? "#ffd27d" : "#875000" : activity.kind === "failed" ? dark ? "#ffaaaa" : "#a82b36" : activity.kind === "completed" ? dark ? "#9ee6c5" : "#17654e" : dark ? "#a9c6d6" : "#42667a";
      for (const ox of [-width, 0, width]) for (const oy of [-height, 0, height]) {
        const x = whale.x + ox, y = whale.y + oy - whale.bodyRadius - 16;
        if (x < 0 || x > width || y < 8 || y > height - 8) continue;
        ink.globalAlpha = opacity * fade(x, y);
        ink.fillText(text, x, y, 180);
      }
    }
    ink.restore();
  }

  // src/rain.js
  var MAX_DROPS = 320;
  var MAX_IMPACTS = 160;
  var RESPONSE = 0.26;
  var storage = /* @__PURE__ */ new WeakMap();
  var finite2 = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  var clamp3 = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  var size = (value) => clamp3(finite2(value), 0, 1e7);
  function hash(id, seed, salt) {
    let value = Math.imul(id | 0, 374761393) ^ Math.imul(seed | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
    value = Math.imul(value ^ value >>> 13, 1274126177);
    return ((value ^ value >>> 16) >>> 0) / 4294967296;
  }
  function createRainField({ seed = 0, width = 0, height = 0, intensity = 0 } = {}) {
    const field = {
      seed: finite2(seed) >>> 0,
      width: size(width),
      height: size(height),
      intensity: clamp3(finite2(intensity)),
      time: 0,
      drops: [],
      impacts: []
    };
    storage.set(field, {
      dropPool: Array.from({ length: MAX_DROPS }, () => ({})),
      impactPool: Array.from({ length: MAX_IMPACTS }, () => ({})),
      credit: 0,
      nextId: 0,
      width: field.width,
      height: field.height,
      wind: { x: 0, y: 0 },
      segments: new Float64Array(32)
    });
    return field;
  }
  function resizeRainField(field, width, height) {
    const state = storage.get(field);
    if (!state) return field;
    field.width = size(width);
    field.height = size(height);
    if (!(field.width > 0 && field.height > 0)) return field;
    const sx = state.width > 0 ? field.width / state.width : 1;
    const sy = state.height > 0 ? field.height / state.height : 1;
    for (const drop of field.drops) {
      drop.x *= sx;
      drop.y *= sy;
      drop.landY *= sy;
      drop.vx *= sx;
      drop.vy *= sy;
      drop.speed *= sy;
    }
    for (const impact of field.impacts) {
      impact.x *= sx;
      impact.y *= sy;
    }
    state.width = field.width;
    state.height = field.height;
    return field;
  }
  function resetRainField(field) {
    const state = storage.get(field);
    if (!state) return field;
    for (const drop of field.drops) state.dropPool.push(drop);
    for (const impact of field.impacts) state.impactPool.push(impact);
    field.drops.length = 0;
    field.impacts.length = 0;
    field.intensity = 0;
    field.time = 0;
    state.credit = 0;
    state.nextId = 0;
    return field;
  }
  function velocity(state, drop, options, dt = 0, initialize = false) {
    const vector = state.wind;
    vector.x = 0;
    vector.y = 0;
    if (options.wind && options.atmosphere) atmosphereWindAt(options.atmosphere, drop.x, drop.y, vector);
    const side = clamp3(finite2(vector.x) * 3.2, -drop.speed * 0.8, drop.speed * 0.8);
    const down = Math.max(drop.speed * 0.5, drop.speed + finite2(vector.y) * 3.2);
    const normal = drop.speed / Math.hypot(side, down);
    const targetX = side * normal, targetY = down * normal;
    if (initialize) {
      drop.vx = targetX;
      drop.vy = targetY;
      return;
    }
    const blend = 1 - Math.exp(-dt / RESPONSE);
    const vx = drop.vx + (targetX - drop.vx) * blend, vy = drop.vy + (targetY - drop.vy) * blend;
    const speed = drop.speed / Math.hypot(vx, vy);
    drop.vx = vx * speed;
    drop.vy = vy * speed;
  }
  function impactAt(field, state, drop, x, age) {
    if (!state.impactPool.length) return;
    const impact = state.impactPool.pop();
    impact.dropId = drop.id;
    impact.x = x;
    impact.y = drop.landY;
    impact.age = age;
    impact.life = 0.48 + drop.variation * 0.32;
    impact.energy = drop.energy;
    impact.scale = drop.scale;
    impact.radius = (3.5 + 6 * drop.energy) * drop.scale;
    impact.shape = drop.variation * Math.PI * 2;
    if (age < impact.life) field.impacts.push(impact);
    else state.impactPool.push(impact);
  }
  function moveDrop(field, state, drop, dt, options, feedback = true) {
    velocity(state, drop, options, dt);
    const remaining = Math.max(0, (drop.landY - drop.y) / drop.vy);
    if (remaining <= dt) {
      if (feedback) impactAt(field, state, drop, drop.x + drop.vx * remaining, dt - remaining);
      return false;
    }
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    drop.age += dt;
    return true;
  }
  function spawn(field, state, options, age) {
    if (!state.dropPool.length) return;
    const drop = state.dropPool.pop(), id = state.nextId++;
    const u = hash(id, field.seed, 1), v = hash(id, field.seed, 2);
    drop.id = id;
    drop.variation = hash(id, field.seed, 3);
    drop.scale = 0.68 + v * 0.48;
    drop.energy = (0.24 + 0.76 * field.intensity) * (0.8 + drop.variation * 0.2);
    drop.speed = (260 + drop.variation * 100) * drop.scale;
    drop.life = 0.38 + hash(id, field.seed, 4) * 0.32;
    drop.landY = v * field.height;
    drop.x = u * field.width;
    drop.y = drop.landY;
    velocity(state, drop, options, 0, true);
    drop.x -= drop.vx * drop.life;
    drop.y -= drop.vy * drop.life;
    drop.age = 0;
    if (moveDrop(field, state, drop, age, options)) field.drops.push(drop);
    else state.dropPool.push(drop);
  }
  function advance(field, state, dt, options, target, emit) {
    field.time += dt;
    const before = field.intensity, decay = Math.exp(-dt / RESPONSE);
    field.intensity = target + (before - target) * decay;
    if (target === 0 && field.intensity < 2e-3) field.intensity = 0;
    let live = 0;
    for (const impact of field.impacts) {
      impact.age += dt;
      if (impact.age < impact.life) field.impacts[live++] = impact;
      else state.impactPool.push(impact);
    }
    field.impacts.length = live;
    live = 0;
    for (const drop of field.drops) {
      if (moveDrop(field, state, drop, dt, options, emit)) field.drops[live++] = drop;
      else state.dropPool.push(drop);
    }
    field.drops.length = live;
    if (!emit) {
      state.credit = 0;
      return;
    }
    const rate = Math.min(260, 180 * Math.sqrt(field.width * field.height / (960 * 600)));
    const amount = field.intensity === 0 ? 0 : rate * (target * dt + (before - target) * RESPONSE * (1 - decay));
    const previous = state.credit, total = previous + Math.max(0, amount), count = Math.floor(total);
    state.credit = total - count;
    for (let i = 1; i <= count && i <= MAX_DROPS; i++) {
      const age = amount > 0 ? dt * (1 - (i - previous) / amount) : 0;
      spawn(field, state, options, Math.max(0, age));
    }
  }
  function stepRain(field, delta2, { enabled = false, intensity = 0.45, wind = true, atmosphere, metrics = null, integrationHz = 60 } = {}) {
    const state = storage.get(field);
    if (!state || !(Number.isFinite(delta2) && delta2 > 0 && field.width > 0 && field.height > 0)) return field;
    const started = metrics?.begin();
    const target = enabled ? clamp3(finite2(intensity, 0.45)) : 0, options = { wind, atmosphere };
    if (delta2 > 2) {
      const stepStarted = metrics?.begin();
      advance(field, state, delta2 - 2, options, target, false);
      metrics?.end("rainStep", stepStarted);
    }
    const window2 = Math.min(delta2, 2), steps = Math.max(1, Math.ceil(window2 * integrationHz - (integrationHz === 60 ? 0 : 1e-10))), dt = window2 / steps;
    for (let i = 0; i < steps; i++) {
      const stepStarted = metrics?.begin();
      advance(field, state, dt, options, target, true);
      metrics?.end("rainStep", stepStarted);
    }
    metrics?.end("rainUpdate", started);
    return field;
  }
  function maskAt(segments, count, fade, width, height, thickness) {
    let mask = 1;
    const pad = thickness * 0.5;
    for (let i = 0; i < count * 4; i += 4) {
      const x = segments[i], y = segments[i + 1], dx = segments[i + 2] - x, dy = segments[i + 3] - y;
      const length = Math.hypot(dx, dy), steps = Math.max(1, Math.min(32, Math.ceil(length)));
      const nx = length > 0 ? -dy / length * pad : pad, ny = length > 0 ? dx / length * pad : 0;
      for (let j = 0; j <= steps; j++) {
        const px = x + dx * j / steps, py = y + dy * j / steps;
        if (px - pad < 0 || py - pad < 0 || px + pad > width || py + pad > height) return 0;
        if (fade) {
          mask = Math.min(
            mask,
            clamp3(finite2(fade(px, py))),
            clamp3(finite2(fade(px + nx, py + ny))),
            clamp3(finite2(fade(px - nx, py - ny)))
          );
          if (mask <= 0) return 0;
        }
      }
    }
    return mask;
  }
  function strokeSegments(target, segments, count) {
    target.beginPath();
    for (let i = 0; i < count * 4; i += 4) {
      target.moveTo(segments[i], segments[i + 1]);
      target.lineTo(segments[i + 2], segments[i + 3]);
    }
    target.stroke();
  }
  function rainPresence(opacity) {
    return Math.min(0.83, 0.48 + 0.52 * opacity);
  }
  function drawRain(target, field, options = {}) {
    const result = { drops: 0, impacts: 0, glyphs: 0 }, state = storage.get(field);
    if (!state || !target || typeof target.beginPath !== "function" || typeof target.moveTo !== "function" || typeof target.lineTo !== "function" || typeof target.stroke !== "function") return result;
    const width = size(options.width ?? field.width), height = size(options.height ?? field.height);
    const opacity = clamp3(finite2(options.opacity, 0.6));
    if (!(width > 0 && height > 0 && field.width > 0 && field.height > 0 && opacity > 0)) return result;
    const phase = options.phase, reduced = !!options.reduced;
    const sx = width / field.width, sy = height / field.height, ratio = clamp3(finite2(options.ratio, 1), 0.1, 8);
    const cellHeight = clamp3(finite2(options.cellHeight, 13), 5, 32), cellWidth = clamp3(finite2(options.cellWidth, 11), 5, 32);
    const palette = options.palette || createInkPalette("ocean"), segments = state.segments;
    const fade = typeof options.fade === "function" ? options.fade : null;
    const alpha = target.globalAlpha, ink = target.strokeStyle, lineWidth = target.lineWidth;
    const lineCap = target.lineCap, lineJoin = target.lineJoin;
    try {
      target.lineCap = "butt";
      target.lineJoin = "round";
      if (!phase || phase === "surface") for (const impact of field.impacts) {
        if (reduced && impact.dropId % 4) continue;
        const progress = clamp3(impact.age / impact.life);
        const envelope = Math.min(1, impact.age / 0.035) * (1 - progress) ** 1.7;
        const radius = (1 + impact.radius * (1 - (1 - progress) ** 1.6)) * cellWidth / 11;
        const x = impact.x * sx, y = impact.y * sy;
        let count = 0;
        for (let arc = 0; arc < 3; arc++) for (let part = 0; part < 2; part++) {
          const a = impact.shape + arc * Math.PI * 2 / 3 + part * 0.35, b = a + 0.35, i = count++ * 4;
          segments[i] = x + Math.cos(a) * radius;
          segments[i + 1] = y + Math.sin(a) * radius * 0.42;
          segments[i + 2] = x + Math.cos(b) * radius;
          segments[i + 3] = y + Math.sin(b) * radius * 0.42;
        }
        if (impact.age < 0.16 && !reduced) {
          const lift = Math.sin(impact.age / 0.16 * Math.PI) * (1 + impact.energy * 3) * impact.scale;
          for (let side = -1; side <= 1; side += 2) {
            const i = count++ * 4;
            segments[i] = x + side * radius * 0.3;
            segments[i + 1] = y - lift;
            segments[i + 2] = x + side * (radius * 0.3 + 1);
            segments[i + 3] = y - lift - 1.3;
          }
        }
        target.lineWidth = Math.max(1, 1.1 / ratio) * impact.scale;
        const mask = maskAt(segments, count, fade, width, height, target.lineWidth);
        const amount = rainPresence(opacity) * (options.dark ? 0.72 : 0.68) * envelope * mask * (reduced ? 0.55 : 1);
        if (!(amount > 1e-3)) continue;
        target.globalAlpha = amount;
        target.strokeStyle = palette[glyphInkIndex(options.dark ? 0.72 : 0.2, 0.16)];
        strokeSegments(target, segments, count);
        result.impacts++;
      }
      if (!phase || phase === "fall") for (const drop of field.drops) {
        if (reduced && drop.id % 4) continue;
        const x = drop.x * sx, y = drop.y * sy;
        const length = cellHeight * (0.55 + drop.scale * 0.35) * (reduced ? 0.65 : 1);
        const speed = Math.hypot(drop.vx * sx, drop.vy * sy) || 1;
        segments[0] = x;
        segments[1] = y;
        segments[2] = x - drop.vx * sx / speed * length;
        segments[3] = y - drop.vy * sy / speed * length;
        target.lineWidth = Math.max(1, 1.05 / ratio) * drop.scale;
        const mask = maskAt(segments, 1, fade, width, height, target.lineWidth);
        const amount = rainPresence(opacity) * (options.dark ? 0.66 : 0.62) * Math.min(1, drop.age / 0.055) * (0.65 + 0.35 * drop.energy) * mask * (reduced ? 0.5 : 1);
        if (!(amount > 1e-3)) continue;
        target.globalAlpha = amount;
        target.strokeStyle = palette[glyphInkIndex(options.dark ? 0.76 : 0.16, 0.16)];
        strokeSegments(target, segments, 1);
        result.drops++;
      }
    } finally {
      target.globalAlpha = alpha;
      target.strokeStyle = ink;
      target.lineWidth = lineWidth;
      target.lineCap = lineCap;
      target.lineJoin = lineJoin;
    }
    return result;
  }

  // src/simulation.js
  var sceneConfigKeys = Object.freeze(["count", "text", "species", "whaleSize"]);
  function sceneConfigChanged(previous = {}, next = {}) {
    return sceneConfigKeys.some((key) => previous[key] !== next[key]);
  }
  function createWhaleSimulation(initialConfig, { seed = 0, metrics = null, onActivityChange } = {}) {
    let disposed = false;
    let activityTime = 0;
    let config = { ...initialConfig };
    let scene = createScene(config.count, config.text, config.species, config.whaleSize, seed);
    scene.diveSeed = seed;
    const water = createWaterField();
    const atmosphere = createAtmosphereField({ seed });
    const rain = createRainField({ seed });
    let activityVersion = 0;
    const activity = createActivityTracker({ onChange(value) {
      activityVersion++;
      onActivityChange?.(value);
    } });
    return {
      get scene() {
        return scene;
      },
      water,
      atmosphere,
      rain,
      update(next) {
        if (disposed) return false;
        const rebuild = sceneConfigChanged(config, next);
        if (rebuild) {
          const previous = scene;
          scene = createScene(next.count, next.text, next.species, next.whaleSize, previous.colorSeed);
          scene.diveSeed = seed;
          resizeScene(
            scene,
            previous.width > 0 ? previous.width : 1600,
            previous.height > 0 ? previous.height : 900
          );
          adoptSceneState(previous, scene);
          scene.time = previous.time;
          scene.accumulator = previous.accumulator;
        }
        if (rebuild || config.ripples !== next.ripples) resetWaterField(water);
        config = { ...next };
        activity.apply(scene.whales, activityTime, config.activity);
        return rebuild;
      },
      setActivity(snapshot) {
        if (disposed) return false;
        const before = activityVersion;
        activity.update(snapshot);
        activity.apply(scene.whales, activityTime, config.activity);
        return before !== activityVersion;
      },
      resize(width, height) {
        if (disposed) return;
        resizeScene(scene, width, height);
        resizeAtmosphereField(atmosphere, width, height);
        resizeRainField(rain, width, height);
        if (width > 0 && height > 0) resetWaterField(water);
      },
      setObstacles(obstacles) {
        if (!disposed) setSceneObstacles(scene, obstacles);
      },
      advance(delta2) {
        if (disposed) return 0;
        const started = metrics?.begin();
        const before = scene.time;
        activity.apply(scene.whales, activityTime, config.activity);
        const policy = resourcePolicy(config.resourceMode);
        stepScene(scene, delta2, config.speed * policy.swimMultiplier, metrics, policy.motionTick);
        const elapsed = scene.time - before;
        activityTime += elapsed;
        activity.apply(scene.whales, activityTime, config.activity);
        if (config.ripples) {
          const waterStarted = metrics?.begin();
          stepWater(water, scene, elapsed);
          metrics?.end("waterUpdate", waterStarted);
        }
        stepAtmosphere(atmosphere, elapsed, metrics);
        stepRain(rain, elapsed, {
          enabled: config.rain,
          intensity: config.rainIntensity,
          wind: config.wind,
          atmosphere,
          metrics,
          integrationHz: policy.rainHz
        });
        metrics?.end("advance", started);
        return elapsed;
      },
      dispose() {
        disposed = true;
        resetWaterField(water);
        resetRainField(rain);
        scene = null;
      }
    };
  }

  // src/spout.js
  var SPOUT_LIMIT = 3;
  var SPOUT_PHASES = /* @__PURE__ */ new Set(["jet", "bush", "droplets"]);
  var SPOUT_MARK = Object.freeze({
    blue: Object.freeze({ x: 0.62, y: -0.12, z: 0, basis: "screen" }),
    humpback: Object.freeze({ x: 0.56, y: -0.14, z: 0, basis: "screen" }),
    fin: Object.freeze({ x: 0.6, y: -0.1, z: 0, basis: "screen" }),
    bowhead: Object.freeze({ x: 0.5, y: -0.16, z: 0, basis: "lateral" }),
    sperm: Object.freeze({ x: 0.88, y: -0.08, z: 0.06, basis: "body" })
  });
  var SPOUT_STAMPS = Object.freeze({
    blue: {
      basis: "screen",
      jet: { anchor: { row: 1, col: 2 }, rows: ["  *  ", "* * *", "  *  "] },
      bush: { anchor: { row: 2, col: 2 }, rows: [" . . ", ". * .", "* * *", ". * .", " . . "] },
      droplets: { anchor: { row: 2, col: 2 }, rows: [".   .", "  .  ", ". . .", "  .  ", ".   ."] }
    },
    humpback: {
      basis: "screen",
      jet: { anchor: { row: 1, col: 4 }, rows: ["  .*.*.  ", "   ***   ", "  .*.*.  "] },
      bush: { anchor: { row: 2, col: 4 }, rows: ["  .  *  .", " . o  o .", "*   *   *", " . o  o .", "  .  *  ."] },
      droplets: { anchor: { row: 2, col: 4 }, rows: [".   .   .", "  .   .  ", ".   .   .", "    .    ", ".   .   ."] }
    },
    bowhead: {
      basis: "lateral",
      jet: { anchor: { row: 1, col: 5 }, rows: ["  .     .  ", "     *     ", "  '     '  "] },
      bush: { anchor: { row: 2, col: 5 }, rows: [".    .    .", "  '     '  ", "    * *    ", "  '     '  ", ".    .    ."] },
      droplets: { anchor: { row: 2, col: 5 }, rows: [".         .", "  .     .  ", "     .     ", "  .     .  ", ".         ."] }
    },
    fin: {
      basis: "screen",
      unverified: true,
      jet: { anchor: { row: 0, col: 1 }, rows: [" * "] },
      bush: { anchor: { row: 1, col: 1 }, rows: [" . ", "* *", " . "] },
      droplets: { anchor: { row: 0, col: 1 }, rows: [" . "] }
    },
    sperm: {
      basis: "body",
      jet: { anchor: { row: 0, col: 0 }, rows: ["* .", " ' ", "  o"] },
      bush: { anchor: { row: 0, col: 0 }, rows: ["* ..", " '~ ", " o. ", "  . "] },
      droplets: { anchor: { row: 0, col: 0 }, rows: ["* .", " . ", "  ."] }
    }
  });
  function spoutAge(ageMs) {
    if (typeof ageMs !== "number" || !Number.isFinite(ageMs) || ageMs < 0 || ageMs >= 1500) return null;
    const alpha = ageMs < 700 ? 1 : (1500 - ageMs) / 800;
    const phase = ageMs < 220 ? "jet" : ageMs < 700 ? "bush" : "droplets";
    return { phase, alpha };
  }
  function spoutFrame(species, phase) {
    if (!SPOUT_PHASES.has(phase)) return null;
    const speciesStamps = SPOUT_STAMPS[species];
    const stamp = speciesStamps && speciesStamps[phase];
    if (!stamp) return null;
    const frame = {
      rows: stamp.rows.slice(),
      anchor: { row: stamp.anchor.row, col: stamp.anchor.col },
      basis: speciesStamps.basis
    };
    if (speciesStamps.unverified) frame.unverified = true;
    return frame;
  }
  function spoutBlit(ink, frame, place) {
    if (!ink) return;
    const savedAlpha = ink.globalAlpha;
    const savedFill = ink.fillStyle;
    const savedAlign = ink.textAlign;
    const savedBaseline = ink.textBaseline;
    const savedFont = ink.font;
    try {
      if (!frame || !place || !Array.isArray(frame.rows)) return;
      const anchor = frame.anchor || { row: 0, col: 0 };
      const acrossX = Number.isFinite(place.acrossX) ? place.acrossX : 0;
      const acrossY = Number.isFinite(place.acrossY) ? place.acrossY : 0;
      const alongX = Number.isFinite(place.alongX) ? place.alongX : 0;
      const alongY = Number.isFinite(place.alongY) ? place.alongY : 0;
      const alphaAt = typeof place.alphaAt === "function" ? place.alphaAt : null;
      if (!alphaAt && !(place.alpha >= 0.04)) return;
      if (place.fillStyle != null) ink.fillStyle = place.fillStyle;
      if (place.font != null) ink.font = place.font;
      ink.textAlign = "center";
      ink.textBaseline = "middle";
      for (let row = 0; row < frame.rows.length; row++) {
        const line = frame.rows[row];
        if (typeof line !== "string") continue;
        for (let col = 0; col < line.length; col++) {
          const glyph = line[col];
          if (glyph === " ") continue;
          const dx = col - anchor.col;
          const dy = row - anchor.row;
          const x = place.anchorX + dx * acrossX + dy * alongX;
          const y = place.anchorY + dx * acrossY + dy * alongY;
          const glyphAlpha = alphaAt ? alphaAt(x, y) : place.alpha;
          if (!(glyphAlpha >= 0.04)) continue;
          ink.globalAlpha = glyphAlpha;
          ink.fillText(glyph, x, y);
        }
      }
    } finally {
      ink.globalAlpha = savedAlpha;
      ink.fillStyle = savedFill;
      ink.textAlign = savedAlign;
      ink.textBaseline = savedBaseline;
      ink.font = savedFont;
    }
  }
  function spoutParticle(x, y, z) {
    return { x, y, z, nx: 0, ny: -1, nz: 0, part: "body", material: "skin", seed: 0 };
  }
  function spoutPoseReady(pose) {
    return Boolean(pose) && Number.isFinite(pose.scale) && pose.spine != null && Number(pose.spine.length) > 0;
  }
  function spoutProjected(particle, pose) {
    try {
      const point = projectParticle(particle, pose);
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      return point;
    } catch {
      return null;
    }
  }
  function spoutCellLength(grid) {
    return Math.hypot(grid.cellWidth, grid.cellHeight) / Math.SQRT2;
  }
  function spoutScreenAxes(grid) {
    return { acrossX: grid.cellWidth, acrossY: 0, alongX: 0, alongY: grid.cellHeight };
  }
  function spoutNormalizeCell(dx, dy, cell) {
    const length = Math.hypot(dx, dy);
    if (!(length > 0) || !Number.isFinite(length)) return null;
    return { x: dx / length * cell, y: dy / length * cell };
  }
  function spoutAxes(mark, pose, origin, grid) {
    const screen = spoutScreenAxes(grid);
    if (mark.basis === "screen") return screen;
    const cell = spoutCellLength(grid);
    if (!(cell > 0)) return screen;
    if (mark.basis === "lateral") {
      const side = spoutProjected(spoutParticle(mark.x, mark.y, mark.z + 0.12), pose);
      if (!side) return screen;
      const across = spoutNormalizeCell(side.x - origin.x, side.y - origin.y, cell);
      if (!across) return screen;
      return { acrossX: across.x, acrossY: across.y, alongX: -across.y, alongY: across.x };
    }
    if (mark.basis === "body") {
      const forward = spoutProjected(spoutParticle(mark.x + 0.08, mark.y, mark.z), pose);
      const side = spoutProjected(spoutParticle(mark.x, mark.y, mark.z + 0.06), pose);
      if (!forward || !side) return screen;
      const along = spoutNormalizeCell(forward.x - origin.x, forward.y - origin.y, cell);
      const across = spoutNormalizeCell(side.x - origin.x, side.y - origin.y, cell);
      if (!along || !across) return screen;
      return { acrossX: across.x, acrossY: across.y, alongX: along.x, alongY: along.y };
    }
    return screen;
  }
  var SPOUT_FIRST_MIN = 2800;
  var SPOUT_FIRST_SPAN = 7e3;
  var SPOUT_GAP_MIN = 11e3;
  var SPOUT_GAP_SPAN = 16e3;
  var SPOUT_DIVE_RETRY = 2400;
  function spoutUnit(rng) {
    rng.state = Math.imul(rng.state, 1664525) + 1013904223 >>> 0;
    return rng.state / 4294967296;
  }
  function attachSpout(canvas, read) {
    let bursts = [];
    let nextAt = [];
    let seenScene;
    let detached = false;
    const rng = { state: 1831565813 };
    function spoutGap(first) {
      return first ? SPOUT_FIRST_MIN + spoutUnit(rng) * SPOUT_FIRST_SPAN : SPOUT_GAP_MIN + spoutUnit(rng) * SPOUT_GAP_SPAN;
    }
    function spoutResetSchedule(state) {
      const whales = state.scene && state.scene.whales || [];
      const now = Number.isFinite(state.now) ? state.now : 0;
      nextAt = whales.map((_, index) => now + spoutGap(true) + index * 900);
    }
    function spoutAdoptScene(state) {
      if (state.scene !== seenScene) {
        seenScene = state.scene;
        bursts.length = 0;
        nextAt = [];
      }
    }
    function spoutConsider(state) {
      if (!state || state.enabled !== true || state.reduced || state.hidden) return;
      if (!Number.isFinite(state.now)) return;
      const whales = state.scene && state.scene.whales;
      if (!whales || !whales.length) return;
      if (nextAt.length !== whales.length) spoutResetSchedule(state);
      for (let id = 0; id < whales.length; id++) {
        if (state.now < nextAt[id]) continue;
        const submergence = whales[id]._motion && whales[id]._motion.submergence;
        if (Number.isFinite(submergence) && submergence > 0.4) {
          nextAt[id] = state.now + SPOUT_DIVE_RETRY;
          continue;
        }
        const had = bursts.some((burst) => burst.whaleId === id);
        spoutPushBurst(state, id);
        const has = bursts.some((burst) => burst.whaleId === id);
        nextAt[id] = state.now + (!had && has ? spoutGap(false) : SPOUT_DIVE_RETRY);
      }
    }
    function spoutDropExpired(now) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        if (!spoutAge(now - bursts[i].born)) bursts.splice(i, 1);
      }
    }
    function spoutPushBurst(state, whaleId) {
      const whale = state.scene && state.scene.whales && state.scene.whales[whaleId];
      if (!whale) return;
      const mark = SPOUT_MARK[whale.species];
      if (!mark) return;
      const pose = state.poses && state.poses[whaleId];
      if (!spoutPoseReady(pose)) return;
      const grid = state.grid;
      if (!grid || !(grid.cellWidth > 0) || !(grid.cellHeight > 0)) return;
      if (!Number.isFinite(state.now)) return;
      const origin = spoutProjected(spoutParticle(mark.x, mark.y, mark.z), pose);
      if (!origin) return;
      const axes = spoutAxes(mark, pose, origin, grid);
      spoutDropExpired(state.now);
      if (bursts.some((burst) => burst.whaleId === whaleId)) return;
      if (bursts.length >= SPOUT_LIMIT) bursts.shift();
      bursts.push({
        whaleId,
        species: whale.species,
        born: state.now,
        anchorX: origin.x,
        anchorY: origin.y,
        acrossX: axes.acrossX,
        acrossY: axes.acrossY,
        alongX: axes.alongX,
        alongY: axes.alongY
      });
    }
    function paint(ink, fade) {
      if (detached) return;
      let state;
      try {
        state = read();
      } catch {
        return;
      }
      if (!state || state.enabled !== true || state.reduced) {
        bursts.length = 0;
        nextAt = [];
        return;
      }
      spoutAdoptScene(state);
      spoutConsider(state);
      spoutDropExpired(state.now);
      if (!ink || !bursts.length) return;
      const opacity = Number.isFinite(state.opacity) ? state.opacity : 0;
      const mist = Math.min(1, 0.62 + 0.38 * opacity);
      const fillStyle = state.dark ? "#e7f6f8" : "#2f5964";
      const font = `600 ${state.glyphSize}px Consolas, "Cascadia Mono", "Courier New", monospace`;
      for (const burst of bursts) {
        const aged = spoutAge(state.now - burst.born);
        if (!aged) continue;
        const frame = spoutFrame(burst.species, aged.phase);
        if (!frame) continue;
        spoutBlit(ink, frame, {
          anchorX: burst.anchorX,
          anchorY: burst.anchorY,
          acrossX: burst.acrossX,
          acrossY: burst.acrossY,
          alongX: burst.alongX,
          alongY: burst.alongY,
          fillStyle,
          font,
          alphaAt(x, y) {
            const veil = attenuation(x, y, state.width, state.height, state.quietCenter);
            const edge = typeof fade === "function" ? fade(x, y) : 1;
            const whale = state.scene && state.scene.whales && state.scene.whales[burst.whaleId];
            const submergence = whale && whale._motion ? whale._motion.submergence : void 0;
            const surfaced = Number.isFinite(submergence) && submergence > 0 ? 1 - submergence : 1;
            return aged.alpha * mist * veil * edge * surfaced;
          }
        });
      }
    }
    function detach() {
      if (detached) return;
      detached = true;
      bursts.length = 0;
      nextAt = [];
    }
    return { paint, detach };
  }

  // src/foreground.js
  var MEDIA_TAGS = /* @__PURE__ */ new Set(["IMG", "VIDEO", "IFRAME", "OBJECT", "EMBED", "CANVAS"]);
  var MAX_VISIT = 6e3;
  var MAX_STYLE = 512;
  var MAX_REGIONS = 128;
  function rectOf(element) {
    try {
      const rect = element?.getBoundingClientRect();
      return rect && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0 ? rect : null;
    } catch {
      return null;
    }
  }
  function intersection(a, b) {
    const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
    const right = Math.min(a.left + a.width, b.left + b.width), bottom = Math.min(a.top + a.height, b.top + b.height);
    return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
  }
  function radiusOf(style, rect) {
    const values = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"].map((key) => style[key] || style.borderRadius || "0").map((value) => {
      const length = parseFloat(value);
      return Number.isFinite(length) ? Math.max(0, String(value).includes("%") ? length * Math.min(rect.width, rect.height) / 100 : length) : 0;
    });
    return Math.min(...values, rect.width / 2, rect.height / 2);
  }
  function measureForeground(root, canvasRect, canvas) {
    const rootRect = rectOf(root), clip = rootRect && intersection(rootRect, canvasRect);
    const regions = [];
    if (!clip) return { regions, clip: null };
    const styles = /* @__PURE__ */ new Map();
    let reads = 0;
    const styleOf = (element) => {
      if (styles.has(element)) return styles.get(element);
      if (reads++ >= MAX_STYLE) return null;
      let style = null;
      try {
        style = getComputedStyle(element);
      } catch {
      }
      styles.set(element, style);
      return style;
    };
    const visible = (element) => {
      for (let ancestor = element, depth = 0; ancestor && depth < 64; ancestor = ancestor.parentElement, depth++) {
        if (ancestor.hidden || ancestor.isConnected === false) return false;
        const style = styleOf(ancestor);
        if (!style || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden" || Number(style.opacity) === 0) return false;
        if (ancestor === root) return true;
      }
      return false;
    };
    const queue = [root];
    for (let index = 0; index < queue.length && index < MAX_VISIT && regions.length < MAX_REGIONS; index++) {
      const element = queue[index];
      if (!element || element === canvas || element.hidden || element.isConnected === false || element.style?.display === "none") continue;
      const tag = String(element.tagName || "").toUpperCase();
      if (MEDIA_TAGS.has(tag)) {
        const rect = rectOf(element);
        if (rect && intersection(rect, clip) && visible(element)) {
          regions.push({
            x: rect.left - canvasRect.left,
            y: rect.top - canvasRect.top,
            width: rect.width,
            height: rect.height,
            radius: radiusOf(styleOf(element), rect),
            element
          });
        }
        continue;
      }
      if (element.children) for (const child of element.children) {
        if (queue.length >= MAX_VISIT) break;
        queue.push(child);
      }
    }
    return { regions, clip: {
      x: clip.left - canvasRect.left,
      y: clip.top - canvasRect.top,
      width: clip.width,
      height: clip.height,
      radius: 0
    } };
  }
  function observeForeground(canvas, invalidate) {
    let root = null, resized = /* @__PURE__ */ new Set();
    const events = ["load", "loadedmetadata", "error"];
    let resizeObserver = new ResizeObserver(invalidate);
    const mutationObserver = new MutationObserver((records) => {
      if (!records || records.some((record2) => record2.target !== canvas)) invalidate();
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
          if (root) mutationObserver.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["src", "srcset", "sizes", "width", "height", "class", "style", "hidden", "open", "poster"]
          });
        }
        const next = new Set(root ? [root, ...regions.map((region) => region.element)] : []);
        const removed = [...resized].filter((element) => !next.has(element));
        if (removed.length && typeof resizeObserver.unobserve !== "function") {
          resizeObserver.disconnect();
          resizeObserver = new ResizeObserver(invalidate);
          resized.clear();
        } else for (const element of removed) {
          resizeObserver.unobserve(element);
          resized.delete(element);
        }
        for (const element of next) if (!resized.has(element)) {
          resizeObserver.observe(element);
          resized.add(element);
        }
      },
      dispose() {
        detachRoot();
        resizeObserver.disconnect();
        resized.clear();
        root = null;
      }
    };
  }
  function clearForeground(target, foreground, width, height) {
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

  // src/reading-protection.js
  function readingEffectTone(effect = "frost", strength = 0.55, options = {}) {
    if (effect === "none") return { mode: "none" };
    const base = glassContentTone(strength, options);
    if (effect === "glow" || options.reducedTransparency) return { ...base, mode: "glow" };
    const frost = effect !== "blur";
    return {
      ...base,
      mode: frost ? "frost" : "blur",
      blur: frost ? 16 + 6 * base.strength : 8 + 4 * base.strength,
      mist: frost ? 0.24 : 0.3,
      veil: frost ? 0.025 : 0
    };
  }
  var MAX_NODES = 6e3;
  var MAX_LINES = 1200;
  var SKIP_TEXT = 'script,style,noscript,svg,[aria-hidden="true"]';
  var intersects = (a, b) => a && b && a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
  var boundsOf = (element) => {
    try {
      return element?.getBoundingClientRect();
    } catch {
      return null;
    }
  };
  var intersect = (a, b) => {
    if (!intersects(a, b)) return null;
    const left = Math.max(a.left, b.left), top = Math.max(a.top, b.top);
    return {
      left,
      top,
      width: Math.min(a.left + a.width, b.left + b.width) - left,
      height: Math.min(a.top + a.height, b.top + b.height) - top
    };
  };
  function collectRightbarSurfaces(canvasRect) {
    const surfaces = [];
    for (const root of document.querySelectorAll("[data-rightbar-col]")) {
      const queue = [...root.children || []];
      if (!queue.length) queue.push(root);
      for (let i = 0; i < queue.length && i < 80; i++) {
        const element = queue[i], rect = boundsOf(element);
        if (element.hidden || element.isConnected === false || element.getAttribute?.("aria-hidden") === "true") continue;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
        if (element.hasAttribute?.("data-sidebar-right-panel") && !element.hasAttribute("data-sidebar-right-open")) {
          for (const floating of element.querySelectorAll("[data-dockkit-float]")) queue.push(floating);
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
  function measureReadingText(roots, canvasRect) {
    if (typeof document.createTreeWalker !== "function" || typeof document.createRange !== "function") return [];
    const groups = [], seen = /* @__PURE__ */ new Set(), styles = /* @__PURE__ */ new Map();
    const styleOf = (element) => {
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
      while (text = walker.nextNode()) {
        if (++visited > MAX_NODES || regions.length >= MAX_LINES) {
          overflow = true;
          break;
        }
        if (!text.textContent?.trim()) continue;
        const parent = text.parentElement;
        if (!parent || parent.closest?.(SKIP_TEXT) || !intersects(boundsOf(parent), clip)) continue;
        let visible = true, textClip = clip;
        for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
          const style = styleOf(ancestor);
          if (ancestor.hidden || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity) === 0) {
            visible = false;
            break;
          }
          const x = /hidden|clip|auto|scroll/.test(style.overflowX || style.overflow || "");
          const y = /hidden|clip|auto|scroll/.test(style.overflowY || style.overflow || "");
          if (x || y) {
            const rect = boundsOf(ancestor);
            if (rect) textClip = intersect(textClip, {
              left: x ? rect.left : textClip.left,
              top: y ? rect.top : textClip.top,
              width: x ? rect.width : textClip.width,
              height: y ? rect.height : textClip.height
            });
            if (!textClip) {
              visible = false;
              break;
            }
          }
          if (ancestor === root) break;
        }
        if (!visible) continue;
        range.selectNodeContents(text);
        for (const line of range.getClientRects()) {
          const rect = intersect({
            left: line.left - 3,
            top: line.top - 2,
            width: line.width + 6,
            height: line.height + 4
          }, textClip);
          if (rect && line.width > 0 && line.height > 0) regions.push({
            x: rect.left - canvasRect.left,
            y: rect.top - canvasRect.top,
            width: rect.width,
            height: rect.height,
            radius: 3
          });
          if (regions.length >= MAX_LINES) {
            overflow = true;
            break;
          }
        }
        if (overflow) break;
      }
      for (const input of root.querySelectorAll?.('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),textarea') || []) {
        const rect = intersect(boundsOf(input), clip);
        const style = styleOf(input);
        if (rect && style.visibility !== "hidden" && Number(style.opacity) !== 0) regions.push({
          x: rect.left - canvasRect.left,
          y: rect.top - canvasRect.top,
          width: rect.width,
          height: rect.height,
          radius: 4
        });
      }
      const localClip = {
        x: clip.left - canvasRect.left,
        y: clip.top - canvasRect.top,
        width: clip.width,
        height: clip.height,
        radius: 0
      };
      groups.push({ clip: localClip, regions: overflow ? [localClip] : regions });
    }
    return groups;
  }
  function createReadingProtection() {
    let mask = null, key = "", replacement = null, replacementInk = null;
    function clear() {
      mask = replacement = replacementInk = null;
      key = "";
    }
    function setRegions(groups, canvasRect, effect = "glow") {
      if (effect === "none") {
        clear();
        return;
      }
      const nextKey = JSON.stringify([canvasRect.width, canvasRect.height, effect, groups]);
      if (nextKey === key) return;
      key = nextKey;
      if (!groups.some((group) => group.regions.length)) {
        mask = null;
        return;
      }
      mask ??= document.createElement("canvas");
      mask.width = Math.max(1, Math.ceil(canvasRect.width));
      mask.height = Math.max(1, Math.ceil(canvasRect.height));
      const target = mask.getContext("2d");
      if (!target) {
        mask = null;
        return;
      }
      const through = effect !== "glow", padding = through ? 5 : 0;
      target.fillStyle = "#000";
      target.shadowColor = "#000";
      target.shadowBlur = through ? 12 : 8;
      for (const { clip, regions } of groups) {
        if (!regions.length) continue;
        target.save();
        target.beginPath();
        glassRoundedSubpath(target, clip);
        target.clip();
        target.beginPath();
        for (const region of regions) glassRoundedSubpath(target, {
          x: region.x - padding,
          y: region.y - padding,
          width: region.width + padding * 2,
          height: region.height + padding * 2,
          radius: through ? 7 : region.radius
        });
        target.fill();
        target.restore();
      }
    }
    return {
      get active() {
        return Boolean(mask);
      },
      measure(roots, canvasRect, effect = "glow") {
        if (effect === "none") {
          clear();
          return;
        }
        setRegions(measureReadingText(roots, canvasRect), canvasRect, effect);
      },
      setRegions,
      paint(target, width, height, { material = { mode: "glow" }, source = null, sourceRect = null, underlay = null } = {}) {
        if (!mask || material.mode === "none") return;
        target.save();
        target.globalAlpha = 1;
        target.globalCompositeOperation = "destination-out";
        target.drawImage(mask, 0, 0, width, height);
        target.restore();
        const through = material.mode !== "glow" && source && sourceRect;
        if (!through && !underlay) return;
        if (!replacement) {
          replacement = document.createElement("canvas");
          replacementInk = replacement.getContext("2d");
        }
        if (!replacementInk) return;
        if (replacement.width !== mask.width || replacement.height !== mask.height) {
          replacement.width = mask.width;
          replacement.height = mask.height;
        }
        const ink = replacementInk;
        ink.clearRect(0, 0, replacement.width, replacement.height);
        ink.save();
        if (underlay) {
          ink.fillStyle = underlay;
          ink.fillRect(0, 0, width, height);
        }
        if (through) {
          ink.imageSmoothingEnabled = true;
          ink.imageSmoothingQuality = "high";
          ink.globalAlpha = material.mist;
          ink.drawImage(source, ...sourceRect, 0, 0, width, height);
          ink.globalAlpha = 1;
          if (material.veil) {
            ink.fillStyle = `rgba(${material.tint}, ${material.veil})`;
            ink.fillRect(0, 0, width, height);
          }
        }
        ink.globalCompositeOperation = "destination-in";
        ink.drawImage(mask, 0, 0, width, height);
        ink.restore();
        target.save();
        target.globalAlpha = 1;
        target.drawImage(replacement, 0, 0, width, height);
        target.restore();
      },
      dispose: clear
    };
  }

  // src/engine.js
  var SCROLL_SELECTOR = "[data-conversation-scroll]";
  var COMPOSER_CARD_SELECTOR = "[data-composer-card]";
  var COMPOSER_SEAT_SELECTOR = "[data-composer-seat]";
  var COMPOSER_RADIUS = 18;
  var MEASURE_INTERVAL = 120;
  var CONTENT_MAX_SCAN = 600;
  var CONTENT_MAX_VISIT = 6e3;
  var CONTENT_MIN_AREA = 960;
  var CONTENT_MAX_WIDTH_RATIO = 0.95;
  var CONTENT_MAX_HEIGHT_RATIO = 0.9;
  var CONTENT_MIN_ALPHA = 0.9;
  var CONTENT_SKIP_TAGS = /* @__PURE__ */ new Set([
    "SVG",
    "PATH",
    "G",
    "CIRCLE",
    "RECT",
    "LINE",
    "POLYLINE",
    "POLYGON",
    "CODE",
    "KBD",
    "SAMP",
    "VAR",
    "IMG",
    "PICTURE",
    "VIDEO",
    "AUDIO",
    "CANVAS",
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "OPTION",
    "LABEL",
    "TIME",
    "BR",
    "HR",
    "WBR",
    "STRONG",
    "EM",
    "B",
    "I",
    "U",
    "S",
    "SMALL",
    "SUB",
    "SUP",
    "MARK",
    "A"
  ]);
  var CONTENT_LEAF_TAGS = /* @__PURE__ */ new Set(["PRE", "P", "H1", "H2", "H3", "H4", "H5", "H6"]);
  var DEMO_CARD_BODY_DARK = "rgba(24, 26, 31, 0.96)";
  var DEMO_CARD_BODY_LIGHT = "rgba(252, 253, 254, 0.96)";
  var DEMO_LINE_DARK = "rgba(203, 217, 231, 0.34)";
  var DEMO_LINE_LIGHT = "rgba(45, 66, 88, 0.32)";
  var DEMO_LINE_INSET = 14;
  var DEMO_LINE_HEIGHT = 7;
  var METRIC_KEYS = Object.freeze(["glyphSize", "fillMode", "renderStyle"]);
  var PALETTE_KEYS = Object.freeze(["color"]);
  var GLASS_KEYS = Object.freeze(["glass", "glassStrength", "readingEffect"]);
  var COMPOSER_KEYS = Object.freeze(["composerGlass", "composerAvoid"]);
  var LIVE_KEYS = Object.freeze(["resourceMode", "enabled", "speed", "opacity", "quietCenter", "leftInset", "spout", "ripples", "wind", "clouds", "rain", "rainIntensity", "activity", "pauseOnScroll"]);
  var anyChanged = (keys, previous, next) => keys.some((key) => previous[key] !== next[key]);
  var noChange = (changes) => !changes.scene && !changes.metrics && !changes.palette && !changes.glass && !changes.composer && !changes.live;
  function diffWhaleConfig(previous, next) {
    const before = previous || {}, after = next || {};
    return {
      scene: sceneConfigChanged(before, after),
      metrics: anyChanged(METRIC_KEYS, before, after),
      palette: anyChanged(PALETTE_KEYS, before, after),
      glass: anyChanged(GLASS_KEYS, before, after),
      composer: anyChanged(COMPOSER_KEYS, before, after),
      live: anyChanged(LIVE_KEYS, before, after)
    };
  }
  function rectOf2(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
  }
  function pick(selector, canvasRect) {
    let best = null, bestArea = 0;
    for (const element of document.querySelectorAll(selector)) {
      const rect = rectOf2(element);
      if (!rect) continue;
      const overlap = Math.max(0, Math.min(rect.left + rect.width, canvasRect.left + canvasRect.width) - Math.max(rect.left, canvasRect.left));
      const area = overlap * Math.min(rect.height, canvasRect.height);
      if (area > bestArea) {
        bestArea = area;
        best = { element, rect };
      }
    }
    return best;
  }
  function colorAlpha(value) {
    const text = String(value || "").trim();
    const modern = text.match(/^(?:color|lab|lch|oklab|oklch|hwb|hsla?)\(([^)]+)\)$/i);
    if (modern) {
      const alpha = modern[1].split("/")[1]?.trim() ?? "1";
      const number = parseFloat(alpha);
      return Number.isFinite(number) ? Math.max(0, Math.min(1, alpha.endsWith("%") ? number / 100 : number)) : null;
    }
    const match = text.match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1].split(/[,/ ]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) return null;
    return parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1;
  }
  function isContentMaterial(style) {
    if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const alpha = colorAlpha(style.backgroundColor);
    if (alpha >= CONTENT_MIN_ALPHA) return true;
    return alpha > 0 && [style.backdropFilter, style.webkitBackdropFilter].some((value) => typeof value === "string" && Number(value.match(/\bblur\(\s*([\d.]+)px\s*\)/i)?.[1]) > 0);
  }
  function hasContentMaterial(element, style, readStyle) {
    if (Number(style.opacity) === 0) return false;
    if (isContentMaterial(style)) return true;
    for (const pseudo of ["::before", "::after"]) {
      const material = readStyle(element, pseudo);
      if (!material || !material.content || material.content === "none" || material.content === "normal" || material.position !== "absolute") continue;
      if (!["top", "right", "bottom", "left"].every((side) => parseFloat(material[side]) === 0)) continue;
      if (isContentMaterial(material)) return true;
    }
    return false;
  }
  function cornerRadius(style) {
    const values = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius
    ].map((value) => parseFloat(value)).filter((value) => Number.isFinite(value) && value >= 0);
    if (values.length) return Math.min(...values);
    const shorthand = parseFloat(style.borderRadius);
    return Number.isFinite(shorthand) && shorthand >= 0 ? shorthand : null;
  }
  function composerRadius(element) {
    try {
      const radius = cornerRadius(getComputedStyle(element));
      return radius === null ? COMPOSER_RADIUS : radius;
    } catch {
      return COMPOSER_RADIUS;
    }
  }
  function collectContentBoxes(canvasRect, composerHit) {
    const boxes = [];
    const scroller = pick(SCROLL_SELECTOR, canvasRect);
    if (scroller) {
      const queue = [scroller.element];
      let visited = 0, styled = 0;
      const readStyle = (element, pseudo) => {
        if (styled >= CONTENT_MAX_SCAN) return null;
        styled++;
        try {
          return getComputedStyle(element, pseudo);
        } catch {
          return null;
        }
      };
      while (queue.length && visited < CONTENT_MAX_VISIT && styled < CONTENT_MAX_SCAN) {
        const element = queue.shift();
        visited++;
        if (!element || element.hidden || typeof element.hasAttribute === "function" && element.hasAttribute("hidden")) continue;
        const tag = typeof element.tagName === "string" ? element.tagName.toUpperCase() : "";
        if (CONTENT_SKIP_TAGS.has(tag)) continue;
        if (element.style?.display === "none") continue;
        if (element.style?.display === "contents" || element.dataset?.slot !== void 0) {
          if (element.children) for (const child of element.children) queue.push(child);
          continue;
        }
        let rect;
        try {
          rect = element.getBoundingClientRect();
        } catch {
          continue;
        }
        if (!(rect.width > 0) || !(rect.height > 0)) {
          let style2;
          try {
            style2 = getComputedStyle(element);
          } catch {
            continue;
          }
          if (style2.display !== "none" && style2.visibility !== "hidden" && !CONTENT_LEAF_TAGS.has(tag) && element.children) {
            for (const child of element.children) queue.push(child);
          }
          continue;
        }
        if (rect.left + rect.width < canvasRect.left || rect.left > canvasRect.left + canvasRect.width) continue;
        if (rect.top + rect.height < canvasRect.top || rect.top > canvasRect.top + canvasRect.height) continue;
        if (!CONTENT_LEAF_TAGS.has(tag) && element.children) {
          for (const child of element.children) queue.push(child);
        }
        if (element === scroller.element) continue;
        const clippedWidth = Math.min(rect.left + rect.width, canvasRect.left + canvasRect.width) - Math.max(rect.left, canvasRect.left);
        const clippedHeight = Math.min(rect.top + rect.height, canvasRect.top + canvasRect.height) - Math.max(rect.top, canvasRect.top);
        if (clippedWidth >= canvasRect.width * CONTENT_MAX_WIDTH_RATIO && clippedHeight >= canvasRect.height * CONTENT_MAX_HEIGHT_RATIO) continue;
        const area = rect.width * rect.height;
        if (!(area >= CONTENT_MIN_AREA) || rect.width < 32 || rect.height < 24) continue;
        const style = readStyle(element);
        if (!style || style.position === "fixed") continue;
        if (style.visibility === "hidden" || style.display === "none") continue;
        const radius = cornerRadius(style);
        if (!(radius > 0)) continue;
        if (rect.width < 40 && !(rect.height >= 36 && radius >= 16)) continue;
        if (!hasContentMaterial(element, style, readStyle)) continue;
        const width = Math.max(40, rect.width);
        const left = rect.left - (width - rect.width) / 2;
        boxes.push({ left, top: rect.top, width, height: rect.height, radius });
      }
    }
    if (composerHit) {
      boxes.push({
        left: composerHit.rect.left,
        top: composerHit.rect.top,
        width: composerHit.rect.width,
        height: composerHit.rect.height,
        radius: composerRadius(composerHit.element)
      });
    }
    return boxes;
  }
  function normalizeLayerConfig(value) {
    const config = normalizeConfig(value);
    if (value && typeof value.speed === "number" && value.speed <= 0) config.speed = 0;
    return config;
  }
  function createWhaleLayer(canvas, initialConfig, options = {}) {
    const ink = canvas.getContext("2d");
    if (!ink) return { update() {
    }, setActivity() {
    }, dispose() {
    } };
    const config = normalizeLayerConfig(initialConfig);
    const demo = options.demoCard || null;
    const readingProtection = createReadingProtection();
    const metrics = options.metrics || null;
    const scenerySeed = options.seed ?? Math.floor(Math.random() * 4294967296) >>> 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const simulation = createWhaleSimulation(config, { seed: scenerySeed, metrics, onActivityChange: options.onActivityChange });
    let scene = simulation.scene;
    const { water, atmosphere, rain } = simulation;
    let sceneryPalette = createInkPalette(config.color);
    let poses = scene.whales.map(() => ({}));
    let projected = scene.particles.map((_, particleIndex) => ({ particleIndex }));
    let painter = createWhalePainter(scene, config);
    ink.font = painter.font;
    let glyphMetrics = measureGlyphs();
    let width = 0, height = 0, ratio = 1, grid = null;
    let offsetX = 0, offsetY = 0;
    const viewport = options.viewport;
    let sea = null, seaInk = null, blurredSea = null, blurredSeaInk = null;
    let seaFactor = 0, seaPad = 0, seaBlurRadius = 0, blurSupport = false;
    let panes = [], tone = null, readingLayout = null, foreground = null, sidebarForegrounds = [];
    let scheduled = null, refreshRaf = 0, refreshCause = null;
    let previous = null, lastPaint = -Infinity, measuredAt = -Infinity, disposed = false;
    let readingTextDirty = true, readingRoots = [], scrolling = false, scrollTimer = 0;
    const originalOpacity = canvas.style?.opacity ?? "", originalTransition = canvas.style?.transition ?? "";
    const SCROLL_IDLE_MS = 140;
    const spout = attachSpout(canvas, () => ({
      enabled: config.spout,
      reduced: reduced.matches || config.speed === 0,
      hidden: document.hidden,
      opacity: config.opacity,
      quietCenter: config.quietCenter,
      glyphSize: config.glyphSize,
      dark: document.body.hasAttribute("data-ds-dark-theme"),
      scene,
      poses,
      grid,
      width,
      height,
      now: performance.now()
    }));
    function measureGlyphs() {
      ink.font = painter.font;
      const measured = { width: config.glyphSize, height: config.glyphSize * 1.2, square: painter.square };
      for (const glyph of painter.alphabet) {
        const inkMetrics = ink.measureText(glyph);
        measured.width = Math.max(measured.width, inkMetrics.width, (inkMetrics.actualBoundingBoxLeft || 0) + (inkMetrics.actualBoundingBoxRight || 0));
        measured.height = Math.max(measured.height, (inkMetrics.actualBoundingBoxAscent || 0) + (inkMetrics.actualBoundingBoxDescent || 0));
      }
      return measured;
    }
    function seaBuffers(material) {
      const factor = glassSeaFactor(material.strength);
      const buffer = glassSeaBuffer(width, height, { factor, blur: material.blur });
      try {
        if (!sea) {
          sea = document.createElement("canvas");
          seaInk = sea.getContext("2d");
          blurredSea = document.createElement("canvas");
          blurredSeaInk = blurredSea.getContext("2d");
          if (!seaInk || !blurredSeaInk) {
            sea = seaInk = blurredSea = blurredSeaInk = null;
            return false;
          }
          seaInk.filter = "blur(1px)";
          blurSupport = seaInk.filter === "blur(1px)";
          seaInk.filter = "none";
        }
      } catch {
        sea = seaInk = blurredSea = blurredSeaInk = null;
        return false;
      }
      if (sea.width !== buffer.width || sea.height !== buffer.height) {
        sea.width = buffer.width;
        sea.height = buffer.height;
      }
      if (blurredSea.width !== buffer.width || blurredSea.height !== buffer.height) {
        blurredSea.width = buffer.width;
        blurredSea.height = buffer.height;
      }
      seaFactor = buffer.factor;
      seaPad = buffer.pad;
      seaBlurRadius = buffer.blurRadius;
      return true;
    }
    function paintBlurredSea(material) {
      const dark = document.body.hasAttribute("data-ds-dark-theme");
      seaInk.setTransform(1, 0, 0, 1, 0, 0);
      seaInk.clearRect(0, 0, sea.width, sea.height);
      seaInk.setTransform(1 / seaFactor, 0, 0, 1 / seaFactor, seaPad, seaPad);
      drawAtmosphere(seaInk, atmosphere, {
        width,
        height,
        cellWidth: grid.cellWidth,
        cellHeight: grid.cellHeight,
        palette: sceneryPalette,
        opacity: config.opacity,
        wind: config.wind,
        clouds: config.clouds,
        dark
      });
      const rainScenery = {
        width,
        height,
        palette: sceneryPalette,
        dark,
        reduced: reduced.matches,
        opacity: config.opacity * (reduced.matches ? config.rain ? config.rainIntensity : 0 : 1)
      };
      drawRain(seaInk, rain, { ...rainScenery, phase: "surface" });
      if (config.renderStyle !== "cells") paintSeaSilhouette(seaInk, material);
      const savedQuietCenter = config.quietCenter;
      config.quietCenter = false;
      painter.paint(seaInk, grid, poses, width, height, 1, null, dark);
      config.quietCenter = savedQuietCenter;
      drawRain(seaInk, rain, { ...rainScenery, phase: "fall" });
      blurredSeaInk.setTransform(1, 0, 0, 1, 0, 0);
      blurredSeaInk.clearRect(0, 0, blurredSea.width, blurredSea.height);
      blurredSeaInk.filter = blurSupport ? `blur(${Math.max(0.4, seaBlurRadius).toFixed(2)}px)` : "none";
      blurredSeaInk.drawImage(sea, 0, 0);
      blurredSeaInk.filter = "none";
    }
    function paintSeaSilhouette(target, material) {
      target.fillStyle = `rgb(${material.silhouette})`;
      target.globalAlpha = 0.9;
      const over = grid.cellWidth * 0.22;
      for (let cell = 0; cell < grid.owners.length; cell++) {
        if (grid.owners[cell] < 0 || grid.visibility[cell] < 0.05) continue;
        const x = grid.centersX[cell], y = grid.centersY[cell];
        target.fillRect(
          x - grid.cellWidth / 2 - over,
          y - grid.cellHeight / 2 - over,
          grid.cellWidth + over * 2,
          grid.cellHeight + over * 2
        );
      }
      target.globalAlpha = 1;
    }
    function paintGlyphs(target, fade = null) {
      painter.paint(target, grid, poses, width, height, ratio, fade, document.body.hasAttribute("data-ds-dark-theme"));
    }
    function applySceneObstacles() {
      if (!scene) return;
      let largest = 0;
      for (const whale of scene.whales) largest = Math.max(largest, Number(whale.bodyRadius) || 0);
      simulation.setObstacles(readingLayout ? readingLayout.obstacles(largest) : []);
    }
    function demoCardRect() {
      if (!demo || !width || !height) return null;
      return demoReadingSnapshot(demo, width, height).composer;
    }
    function applyReadingSnapshot(snapshot) {
      readingLayout = createReadingLayout(snapshot, config, {
        dark: document.body.hasAttribute("data-ds-dark-theme"),
        reducedTransparency: reducedTransparency.matches
      });
      ({ panes, tone } = readingLayout);
      applySceneObstacles();
    }
    function measure() {
      if (!metrics) return measureContent();
      const started = metrics.begin();
      try {
        return measureContent();
      } finally {
        metrics.end("layout", started, demo ? "demo" : "dom");
      }
    }
    function measureContent() {
      measuredAt = performance.now();
      panes = [];
      tone = null;
      readingLayout = null;
      foreground = null;
      sidebarForegrounds = [];
      if (!width || !height || !scene || disposed) return;
      if (demo) {
        applyReadingSnapshot(demoReadingSnapshot(demo, width, height));
        const card = demoCardRect();
        const groups = card && config.glass && config.readingEffect !== "none" ? [{
          clip: { x: card.left, y: card.top, width: card.width, height: card.height, radius: card.radius },
          regions: demoTextRegions(card)
        }] : [];
        readingProtection.setRegions(groups, { width, height }, config.readingEffect);
        return;
      }
      const canvasRect = rectOf2(canvas);
      if (!canvasRect) return;
      const scroller = pick(SCROLL_SELECTOR, canvasRect)?.element;
      const cardHit = pick(COMPOSER_CARD_SELECTOR, canvasRect);
      const composer = cardHit || pick(COMPOSER_SEAT_SELECTOR, canvasRect);
      const sidebars = collectRightbarSurfaces(canvasRect);
      sidebarForegrounds = sidebars.map((panel) => measureForeground(panel.element, canvasRect, canvas));
      readingRoots = [scroller, composer?.element, ...sidebars.map((panel) => panel.element)].filter(Boolean);
      if (readingTextDirty) {
        if (config.readingEffect === "none") readingProtection.dispose();
        else readingProtection.measure(readingRoots, canvasRect, config.readingEffect);
        readingTextDirty = false;
      }
      foreground = measureForeground(scroller, canvasRect, canvas);
      foregroundObserver?.update(scroller, foreground.regions);
      if (!config.glass && !config.composerAvoid) {
        applyReadingSnapshot({ canvas: canvasRect, boxes: [] });
        return;
      }
      applyReadingSnapshot({
        canvas: canvasRect,
        boxes: config.glass ? collectContentBoxes(canvasRect, cardHit) : [],
        sidebars: config.glass ? sidebars : [],
        composer: composer ? composer.rect : null
      });
    }
    function draw(cause = "sync") {
      if (disposed || !config.enabled || document.hidden || scrolling || !width || !height || !scene || !grid) return;
      if (!metrics) return drawContent();
      const started = metrics.begin();
      drawContent();
      metrics.end("draw", started, cause);
    }
    function drawContent() {
      if (performance.now() - measuredAt > MEASURE_INTERVAL) measure();
      if (viewport) {
        ink.setTransform(1, 0, 0, 1, 0, 0);
        ink.clearRect(0, 0, canvas.width, canvas.height);
        ink.setTransform(ratio, 0, 0, ratio, offsetX, offsetY);
      } else {
        ink.setTransform(ratio, 0, 0, ratio, 0, 0);
        ink.clearRect(0, 0, width, height);
      }
      for (let i = 0; i < scene.whales.length; i++) whalePose(scene.whales[i], scene.time, width, height, config.speed, poses[i]);
      for (let i = 0; i < scene.particles.length; i++) projectParticle(scene.particles[i], poses[scene.particles[i].whale], projected[i]);
      resolveDepthGrid(projected, grid, scene.triangles, scene.decals);
      stampSeaWraps(scene, projected, grid);
      shadeAtmosphere(atmosphere, grid, config);
      ink.save();
      glassClipExterior(ink, panes, width, height);
      const fade = readingLayout?.fade ?? null;
      const sceneryFade = readingLayout ? readingLayout.sceneryFade : (x, y) => attenuation(x, y, width, height, config.quietCenter);
      const scenery = {
        width,
        height,
        ratio,
        font: painter.font,
        palette: sceneryPalette,
        cellWidth: grid.cellWidth,
        cellHeight: grid.cellHeight,
        opacity: config.opacity,
        fade: sceneryFade
      };
      drawAtmosphere(ink, atmosphere, {
        ...scenery,
        wind: config.wind,
        clouds: config.clouds,
        dark: document.body.hasAttribute("data-ds-dark-theme")
      });
      if (config.ripples) drawWater(ink, water, scenery);
      const rainScenery = {
        ...scenery,
        dark: document.body.hasAttribute("data-ds-dark-theme"),
        reduced: reduced.matches,
        opacity: config.opacity * (reduced.matches ? config.rain ? config.rainIntensity : 0 : 1)
      };
      drawRain(ink, rain, { ...rainScenery, phase: "surface" });
      paintGlyphs(ink, fade);
      drawRain(ink, rain, { ...rainScenery, phase: "fall" });
      const spoutStarted = metrics?.begin();
      spout.paint(ink, fade);
      metrics?.end("spoutUpdate", spoutStarted);
      if (config.activity) drawActivityBadges(ink, scene.whales, width, height, {
        dark: document.body.hasAttribute("data-ds-dark-theme"),
        opacity: config.opacity,
        fade: sceneryFade
      });
      ink.restore();
      const readingMaterial = readingEffectTone(config.readingEffect, config.glassStrength, {
        dark: document.body.hasAttribute("data-ds-dark-theme"),
        reducedTransparency: reducedTransparency.matches
      });
      const seaReady = prepareBlurredSea(readingMaterial);
      const readingOptions = {
        material: readingMaterial,
        source: seaReady ? blurredSea : null,
        sourceRect: [seaPad, seaPad, width / seaFactor, height / seaFactor]
      };
      if (demo && (config.glass || config.composerAvoid)) {
        const card = demoCardRect();
        if (card) {
          paintDemoCardBody(card);
          paintGlassMaterial(seaReady);
          if (config.readingEffect !== "none") readingProtection.paint(ink, width, height, {
            ...readingOptions,
            underlay: document.body.hasAttribute("data-ds-dark-theme") ? DEMO_CARD_BODY_DARK : DEMO_CARD_BODY_LIGHT
          });
          paintDemoCardText(card);
        }
        return;
      }
      paintGlassMaterial(seaReady);
      if (config.readingEffect !== "none") readingProtection.paint(ink, width, height, readingOptions);
      clearForeground(ink, foreground, width, height);
      for (const media of sidebarForegrounds) clearForeground(ink, media, width, height);
    }
    function paintPaneSeaUnion(list, material) {
      if (!list.length) return;
      ink.save();
      ink.beginPath();
      for (const pane of list) glassRoundedSubpath(ink, pane);
      ink.clip();
      ink.imageSmoothingEnabled = true;
      ink.imageSmoothingQuality = "high";
      ink.globalAlpha = material.mist;
      ink.drawImage(blurredSea, seaPad, seaPad, width / seaFactor, height / seaFactor, 0, 0, width, height);
      ink.globalAlpha = 1;
      ink.restore();
    }
    function paintPaneSurface(panel, material) {
      ink.save();
      glassRoundedPath(ink, panel);
      ink.clip();
      ink.fillStyle = `rgba(${material.tint}, ${material.veil})`;
      ink.fillRect(panel.x, panel.y, panel.width, panel.height);
      const crestHeight = Math.min(material.crestHeight, panel.height * 0.2);
      const crest = ink.createLinearGradient(0, panel.y, 0, panel.y + crestHeight);
      crest.addColorStop(0, material.crest);
      crest.addColorStop(1, "rgba(255, 255, 255, 0)");
      ink.fillStyle = crest;
      ink.fillRect(
        panel.x + panel.radius * 0.6,
        panel.y + 1,
        Math.max(0, panel.width - panel.radius * 1.2),
        crestHeight
      );
      const shade = ink.createLinearGradient(0, panel.y + panel.height - material.shadeHeight, 0, panel.y + panel.height);
      shade.addColorStop(0, "rgba(0, 0, 0, 0)");
      shade.addColorStop(1, material.shade);
      ink.fillStyle = shade;
      ink.fillRect(panel.x, panel.y + panel.height - material.shadeHeight, panel.width, material.shadeHeight);
      ink.restore();
    }
    function prepareBlurredSea(readingMaterial) {
      const materials = [];
      if (tone?.mode === "frost" && panes.length) {
        materials.push(tone);
        if (readingLayout.sidebarPanes.length) materials.push(readingLayout.sidebarTone);
      }
      if (readingProtection.active && readingMaterial.mode !== "none" && readingMaterial.mode !== "glow") materials.push(readingMaterial);
      if (!materials.length) return false;
      const shared = { ...materials[0], blur: Math.max(...materials.map((material) => material.blur)) };
      if (!seaBuffers(shared)) return false;
      paintBlurredSea(shared);
      return true;
    }
    function paintGlassMaterial(seaReady) {
      if (!seaReady || !tone || tone.mode !== "frost" || !panes.length) return;
      const { contentPanes, sidebarPanes, sidebarTone } = readingLayout;
      ink.save();
      glassClipExterior(ink, sidebarPanes, width, height);
      paintPaneSeaUnion(contentPanes, tone);
      for (const pane of contentPanes) paintPaneSurface(pane, tone);
      ink.restore();
      paintPaneSeaUnion(sidebarPanes, sidebarTone);
      for (const pane of sidebarPanes) {
        paintPaneSurface(pane, sidebarTone);
        ink.save();
        glassRoundedPath(ink, pane);
        ink.clip();
        const edge = ink.createLinearGradient(pane.x, 0, pane.x + 18, 0);
        edge.addColorStop(0, document.body.hasAttribute("data-ds-dark-theme") ? "rgba(205, 222, 245, 0.12)" : "rgba(255, 255, 255, 0.34)");
        edge.addColorStop(1, "rgba(255, 255, 255, 0)");
        ink.fillStyle = edge;
        ink.fillRect(pane.x, pane.y, Math.min(18, pane.width), pane.height);
        ink.restore();
      }
    }
    function paintDemoCardBody(card) {
      glassRoundedPath(ink, { x: card.left, y: card.top, width: card.width, height: card.height, radius: card.radius });
      ink.fillStyle = document.body.hasAttribute("data-ds-dark-theme") ? DEMO_CARD_BODY_DARK : DEMO_CARD_BODY_LIGHT;
      ink.fill();
    }
    function demoTextRegions(card) {
      const inner = Math.max(0, card.height - DEMO_LINE_INSET * 2);
      const count = Math.min(4, Math.floor(inner / DEMO_LINE_HEIGHT));
      if (count < 1 || !(card.width > DEMO_LINE_INSET * 2 + 2)) return [];
      const step = count > 1 ? (inner - DEMO_LINE_HEIGHT) / (count - 1) : 0;
      return Array.from({ length: count }, (_, line) => ({
        x: card.left + DEMO_LINE_INSET,
        y: card.top + DEMO_LINE_INSET + step * line,
        width: (card.width - DEMO_LINE_INSET * 2) * (line === count - 1 ? 0.7 : 1),
        height: DEMO_LINE_HEIGHT,
        radius: DEMO_LINE_HEIGHT / 2
      }));
    }
    function paintDemoCardText(card) {
      ink.fillStyle = document.body.hasAttribute("data-ds-dark-theme") ? DEMO_LINE_DARK : DEMO_LINE_LIGHT;
      for (const line of demoTextRegions(card)) {
        glassRoundedPath(ink, line);
        ink.fill();
      }
    }
    function canAnimate() {
      return !disposed && config.enabled && config.speed > 0 && !scrolling && !document.hidden && !reduced.matches && width > 0 && height > 0 && scene;
    }
    function cancelContinuous() {
      if (scheduled?.kind === "raf") cancelAnimationFrame(scheduled.handle);
      else if (scheduled?.kind === "timer") clearTimeout(scheduled.handle);
      scheduled = null;
      previous = null;
    }
    function cancelRefresh() {
      cancelAnimationFrame(refreshRaf);
      refreshRaf = 0;
      refreshCause = null;
    }
    function scheduleContinuous() {
      if (scheduled || !canAnimate()) return;
      const policy = resourcePolicy(config.resourceMode);
      if (policy.scheduler === "timer") {
        if (previous === null) previous = performance.now();
        scheduled = { kind: "timer", handle: setTimeout(() => frame(performance.now()), policy.drawIntervalMs) };
      } else scheduled = { kind: "raf", handle: requestAnimationFrame(frame) };
    }
    function frame(now) {
      const started = metrics?.begin();
      const kind = scheduled?.kind;
      scheduled = null;
      try {
        if (!canAnimate()) return;
        if (previous !== null) simulation.advance(Math.min(0.1, (now - previous) / 1e3));
        previous = now;
        if (now - lastPaint >= resourcePolicy(config.resourceMode).drawIntervalMs - 1e-7) {
          draw("animation");
          lastPaint = now;
        }
        scheduleContinuous();
      } finally {
        metrics?.end("wakeup", started, kind);
      }
    }
    function requestRefresh(cause, immediate = false) {
      if (disposed || !config.enabled || scrolling || document.hidden || !width || !height) return;
      refreshCause = cause;
      if (refreshRaf) return;
      if (immediate) {
        draw(cause);
        lastPaint = performance.now();
        refreshCause = null;
      }
      refreshRaf = requestAnimationFrame(() => {
        refreshRaf = 0;
        const started = metrics?.begin();
        const cause2 = refreshCause;
        refreshCause = null;
        try {
          if (cause2) {
            draw(cause2);
            lastPaint = performance.now();
          }
        } finally {
          metrics?.end("refreshWakeup", started, cause2);
        }
      });
    }
    function sync() {
      cancelContinuous();
      cancelRefresh();
      if (document.hidden || !config.enabled) {
        clearTimeout(scrollTimer);
        scrollTimer = 0;
        scrolling = false;
        revealLayer();
      }
      lastPaint = -Infinity;
      measuredAt = -Infinity;
      readingTextDirty = true;
      observeScene(!disposed && config.enabled && !scrolling && !document.hidden);
      if (!disposed && config.enabled && !scrolling && !document.hidden && width && height) {
        draw();
        scheduleContinuous();
      }
    }
    function update(nextConfig) {
      if (disposed) return;
      const next = normalizeLayerConfig(nextConfig);
      const changes = diffWhaleConfig(config, next);
      if (noChange(changes)) return;
      const schedulerChanged = config.resourceMode !== next.resourceMode || config.enabled !== next.enabled || config.speed === 0 !== (next.speed === 0);
      if (schedulerChanged) {
        cancelContinuous();
        cancelRefresh();
      }
      const sceneRebuilt = simulation.update(next);
      Object.assign(config, next);
      if (config.readingEffect === "none") readingProtection.dispose();
      const wasPaused = scrolling && !config.pauseOnScroll;
      if (wasPaused) leaveScrollPause();
      observeScene(config.enabled && !scrolling && !document.hidden);
      if (sceneRebuilt) {
        scene = simulation.scene;
        poses = scene.whales.map(() => ({}));
        projected = scene.particles.map((_, particleIndex) => ({ particleIndex }));
        applySceneObstacles();
      }
      if (sceneRebuilt || changes.metrics) {
        painter = createWhalePainter(scene, config);
        glyphMetrics = measureGlyphs();
        if (width && height) grid = createDepthGrid(width, height, config.glyphSize, glyphMetrics);
      } else if (changes.palette) {
        painter = createWhalePainter(scene, config);
      }
      if (changes.glass || changes.composer) {
        measuredAt = -Infinity;
        readingTextDirty = true;
        if (config.enabled && !document.hidden && !scrolling && width && height) measure();
      }
      if (changes.palette) sceneryPalette = createInkPalette(config.color);
      if (viewport) resize();
      lastPaint = -Infinity;
      if (!scrolling && !document.hidden && width && height) {
        scheduleContinuous();
        draw("config");
        lastPaint = performance.now();
      }
      if (!config.enabled) {
        cancelContinuous();
        cancelRefresh();
        leaveScrollPause();
      }
      if (wasPaused) revealLayer();
    }
    function finishScroll() {
      scrollTimer = 0;
      if (disposed) return;
      leaveScrollPause();
      sync();
      revealLayer();
    }
    function leaveScrollPause() {
      clearTimeout(scrollTimer);
      scrollTimer = 0;
      scrolling = false;
    }
    function revealLayer() {
      if (canvas.style) {
        canvas.style.transition = reduced.matches ? "none" : "opacity 120ms ease-out";
        canvas.style.opacity = originalOpacity;
      }
    }
    function onScroll(event) {
      if (demo || disposed || !config.enabled || document.hidden || event?.ctrlKey) return;
      const target = event?.target;
      if (target && target !== document && target !== document.body && target !== document.documentElement && !readingRoots.some((root) => root === target || root.contains?.(target))) return;
      readingTextDirty = true;
      if (!config.pauseOnScroll) {
        if (!canAnimate()) onForegroundChange();
        return;
      }
      measuredAt = -Infinity;
      if (!scrolling) {
        scrolling = true;
        observeScene(false);
        cancelContinuous();
        cancelRefresh();
        if (canvas.style) {
          canvas.style.transition = "none";
          canvas.style.opacity = "0";
        }
      }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const started = metrics?.begin();
        try {
          finishScroll();
        } finally {
          metrics?.end("scrollWakeup", started);
        }
      }, SCROLL_IDLE_MS);
    }
    function onForegroundChange() {
      measuredAt = -Infinity;
      readingTextDirty = true;
      requestRefresh("foreground");
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const displayWidth = Math.floor(rect.width), displayHeight = Math.floor(rect.height);
      const source = viewport?.();
      const visible = displayWidth > 0 && displayHeight > 0;
      const nextWidth = visible ? Math.max(1, Math.floor(source?.width ?? displayWidth)) : 0;
      const nextHeight = visible ? Math.max(1, Math.floor(source?.height ?? displayHeight)) : 0;
      const pixels = fitCanvas(displayWidth, displayHeight, window.devicePixelRatio);
      const scale = viewport && visible ? Math.min(displayWidth / nextWidth, displayHeight / nextHeight) : 1;
      const nextRatio = pixels.ratio * scale;
      const nextOffsetX = viewport ? (displayWidth - nextWidth * scale) * pixels.ratio / 2 : 0;
      const nextOffsetY = viewport ? (displayHeight - nextHeight * scale) * pixels.ratio / 2 : 0;
      if (width === nextWidth && height === nextHeight && canvas.width === pixels.width && canvas.height === pixels.height && ratio === nextRatio && offsetX === nextOffsetX && offsetY === nextOffsetY) return;
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio;
      offsetX = nextOffsetX;
      offsetY = nextOffsetY;
      canvas.width = pixels.width;
      canvas.height = pixels.height;
      ink.setTransform(ratio, 0, 0, ratio, offsetX, offsetY);
      grid = createDepthGrid(width, height, config.glyphSize, glyphMetrics);
      simulation.resize(width, height);
      measuredAt = -Infinity;
      sync();
    }
    const observer = new ResizeObserver(resize);
    const themeObserver = new MutationObserver(sync);
    let foregroundObserver = null, observing = false;
    const readingObserver = demo ? null : new MutationObserver((records) => {
      if (!records || records.some((record2) => record2.target !== canvas)) onForegroundChange();
    });
    function observeScene(active) {
      if (observing === active) return;
      observing = active;
      if (active) {
        foregroundObserver = demo ? null : observeForeground(canvas, onForegroundChange);
        readingObserver?.observe(document.body, {
          childList: true,
          characterData: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style", "hidden"]
        });
        observer.observe(canvas);
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
      } else {
        observer.disconnect();
        foregroundObserver?.dispose();
        foregroundObserver = null;
        readingObserver?.disconnect();
        themeObserver.disconnect();
      }
    }
    observeScene(config.enabled && !document.hidden);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    reducedTransparency.addEventListener("change", sync);
    window.addEventListener("resize", resize);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("wheel", onScroll, { capture: true, passive: true });
    document.addEventListener("touchmove", onScroll, { capture: true, passive: true });
    document.fonts?.addEventListener("loadingdone", onForegroundChange);
    document.addEventListener("transitionend", onForegroundChange, true);
    document.addEventListener("animationend", onForegroundChange, true);
    resize();
    function dispose() {
      spout.detach();
      simulation.dispose();
      disposed = true;
      cancelContinuous();
      cancelRefresh();
      observeScene(false);
      readingProtection?.dispose();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      reducedTransparency.removeEventListener("change", sync);
      window.removeEventListener("resize", resize);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("wheel", onScroll, true);
      document.removeEventListener("touchmove", onScroll, true);
      document.fonts?.removeEventListener("loadingdone", onForegroundChange);
      document.removeEventListener("transitionend", onForegroundChange, true);
      document.removeEventListener("animationend", onForegroundChange, true);
      clearTimeout(scrollTimer);
      scrollTimer = 0;
      readingRoots = [];
      if (canvas.style) {
        canvas.style.opacity = originalOpacity;
        canvas.style.transition = originalTransition;
      }
      grid = null;
      scene = previous = null;
      painter = null;
      poses = [];
      projected = [];
      sea = seaInk = blurredSea = blurredSeaInk = null;
      seaFactor = 0;
      seaPad = 0;
      panes = [];
      tone = null;
      readingLayout = null;
      foreground = null;
      sidebarForegrounds = [];
      canvas.width = canvas.height = 1;
    }
    function setActivity(snapshot) {
      if (disposed) return;
      if (simulation.setActivity(snapshot)) requestRefresh("activity", true);
    }
    return { update, setActivity, dispose };
  }

  // src/activity-ui.js
  function createActivityAnnouncer({ announce, schedule = setTimeout, cancel = clearTimeout, delay = 120 }) {
    let scope = null, timer = null, lastEvent = 0, serial = 0;
    const pending = /* @__PURE__ */ new Map();
    function clear() {
      if (timer !== null) cancel(timer);
      timer = null;
      pending.clear();
      lastEvent = 0;
      announce({ serial: ++serial, entities: [] });
    }
    function update(presentation) {
      const nextScope = presentation.enabled ? presentation.scope : null;
      if (nextScope !== scope) {
        clear();
        scope = nextScope;
      }
      if (!scope) return;
      const current = new Map(presentation.entities.map((entity) => [entity.key, entity]));
      for (const [key, entity] of pending) if (current.has(entity.key)) {
        pending.set(key, { ...entity, label: current.get(entity.key).label });
      }
      for (const entity of presentation.transitions) {
        if (entity.event <= lastEvent) continue;
        lastEvent = entity.event;
        pending.set(`${entity.key}:${entity.kind}`, entity);
      }
      if (pending.size && timer === null) timer = schedule(() => {
        timer = null;
        const entities = [...pending.values()];
        pending.clear();
        announce({ serial: ++serial, entities });
      }, delay);
    }
    return { update, dispose() {
      clear();
      scope = null;
    } };
  }
  function createLegendPreference(form) {
    let dismissed = false;
    return {
      get seen() {
        if (dismissed) return true;
        try {
          const snapshot = form.getSnapshot();
          return snapshot.status === "ready" && snapshot.value?.legendSeen === true;
        } catch {
          return false;
        }
      },
      async dismiss() {
        dismissed = true;
        try {
          const snapshot = form.getSnapshot();
          if (snapshot.status !== "ready" || !snapshot.writable) return false;
          if (snapshot.value?.legendSeen === true) return true;
          if (typeof form.set === "function") return await form.set("legendSeen", true);
          return await form.mutate([{ op: "set", path: ["legendSeen"], value: true }], snapshot.revision);
        } catch {
          return false;
        }
      }
    };
  }

  // src/settings.js
  function previewConfigOf(draft) {
    return normalizeConfig({ ...draft, enabled: true, quietCenter: false });
  }
  function readout(field, value) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) return "";
    return field.step === 1 ? String(Math.round(number)) : number.toFixed(2);
  }
  function trackFill(ratio) {
    const safe = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
    return `${(safe * 100).toFixed(1)}%`;
  }
  function registerWhales(ctx, React, dictionaries) {
    const h = React.createElement;
    const form = ctx.configForms.get("ascii-whale-background");
    const formSubscribe = (callback) => form.subscribe(callback);
    const formSnapshot = () => form.getSnapshot();
    const localeSubscribe = (callback) => ctx.locale.subscribe(callback);
    const localeSnapshot = () => ctx.locale.getSnapshot();
    ctx.effect(() => ctx.locale.register("asciiWhales", "en", dictionaries.en));
    ctx.effect(() => ctx.locale.register("asciiWhales", "zh", dictionaries.zh));
    const t = ctx.locale.bind("asciiWhales");
    const useForm = () => React.useSyncExternalStore(formSubscribe, formSnapshot, formSnapshot);
    const jobs = createJobsBridge();
    const labelOf = (entity) => entity.label || t(entity.type === "job" ? "activityJob" : entity.type === "subagent" ? "activitySubagent" : "activitySession");
    const statusOf = (entity) => t({
      running: "activityRunning",
      waiting: "activityWaiting",
      idle: "activityIdle",
      completed: "activityCompleted",
      failed: "activityFailed",
      unavailable: "activityUnavailable"
    }[entity.kind]);
    function Legend({ onClose }) {
      const returnFocus = React.useRef(null);
      React.useEffect(() => {
        returnFocus.current = document.activeElement;
      }, []);
      function close() {
        const result = onClose();
        if (returnFocus.current?.isConnected) returnFocus.current.focus();
        return result;
      }
      return h(
        "section",
        { className: "aw-legend", "aria-label": t("activityLegend") },
        h("h3", null, t("activityLegend")),
        h("ul", null, ...[
          ["···", "activityRunning"],
          ["!", "activityWaiting"],
          ["", "activityIdle"],
          ["✓", "activityCompleted"],
          ["×", "activityFailed"],
          ["?", "activityUnavailable"]
        ].map(([symbol, key]) => h("li", { key }, symbol && h("span", { "aria-hidden": true }, `${symbol} `), t(key)))),
        h("p", null, t("activityLegendNote")),
        h("button", {
          type: "button",
          onClick: close,
          onFocus: (event) => {
            if (event.relatedTarget?.isConnected) returnFocus.current = event.relatedTarget;
          }
        }, t("activityLegendClose"))
      );
    }
    ctx.inject?.(["jobs"], (child) => child.effect(() => jobs.attach(child.jobs)));
    function Canvas({ config, activity = EMPTY_ACTIVITY, onActivityChange }) {
      const ref = React.useRef(null);
      const configRef = React.useRef(config);
      const activityRef = React.useRef(activity);
      const layer = React.useRef(null);
      React.useEffect(() => {
        const instance = createWhaleLayer(ref.current, configRef.current, { onActivityChange });
        instance.setActivity(activityRef.current);
        layer.current = instance;
        return () => {
          instance.dispose();
          layer.current = null;
        };
      }, []);
      React.useEffect(() => {
        configRef.current = config;
        layer.current?.update(config);
      }, [config]);
      React.useEffect(() => {
        activityRef.current = activity;
        layer.current?.setActivity(activity);
      }, [activity]);
      return h("canvas", { ref, "aria-hidden": true, style: { display: "block", width: "100%", height: "100%" } });
    }
    function LivePreview({ draft }) {
      const [paused, setPaused] = React.useState(false);
      const pauseRef = React.useRef(false);
      const ref = React.useRef(null);
      const latest = React.useRef(draft);
      const layer = React.useRef(null);
      const frame = React.useRef(0);
      React.useEffect(() => {
        const instance = createWhaleLayer(ref.current, previewConfigOf(latest.current), {
          // Use the conversation's viewport before fitting the whole image into
          // this card. Shrinking only the whale made an 11px glyph look enormous.
          viewport: () => {
            const style = getComputedStyle(ref.current);
            const sidebar = parseFloat(style.getPropertyValue("--dsh-windows-sidebar-width"));
            const clearance = parseFloat(style.getPropertyValue("--dsh-frame-top-clearance")) || 0;
            return {
              width: Math.max(1, window.innerWidth - (Number.isFinite(sidebar) ? sidebar : latest.current.leftInset)),
              height: Math.max(1, window.innerHeight - clearance)
            };
          },
          demoCard: { x: 0.58, y: 0.76, width: 0.35, height: 0.18, radius: 14 }
        });
        layer.current = instance;
        return () => {
          if (frame.current) cancelAnimationFrame(frame.current);
          frame.current = 0;
          instance.dispose();
          layer.current = null;
        };
      }, []);
      const apply = React.useCallback(() => {
        frame.current = 0;
        const config = previewConfigOf(latest.current);
        if (pauseRef.current) config.speed = 0;
        layer.current?.update(config);
      }, []);
      const schedule = React.useCallback(() => {
        if (!frame.current) frame.current = requestAnimationFrame(apply);
      }, [apply]);
      React.useEffect(() => {
        latest.current = draft;
        pauseRef.current = paused;
        schedule();
      }, [draft, paused, schedule]);
      return h(
        "section",
        { className: "aw-preview", "aria-label": t("stylePreview") },
        h(
          "div",
          { className: "aw-preview-toolbar" },
          h("div", null, h("h3", null, t("previewTitle")), h("p", null, t("previewSubtitle"))),
          h("button", {
            type: "button",
            className: "aw-preview-pause",
            "aria-pressed": paused,
            onClick: () => setPaused((value) => !value)
          }, t(paused ? "previewPlay" : "previewPause"))
        ),
        h(
          "div",
          { className: "aw-preview-card" },
          h("canvas", { ref, role: "img", "aria-label": t("stylePreview") })
        ),
        h("p", { className: "aw-preview-note" }, t("stylePreviewNote"))
      );
    }
    function Overlay(props) {
      const panelId = props.usePanelInfo((s) => s.activePanelId);
      const language = React.useSyncExternalStore(localeSubscribe, localeSnapshot, localeSnapshot);
      const [presentation, setPresentation] = React.useState(null);
      const [announcement, setAnnouncement] = React.useState({ serial: 0, entities: [] });
      const legendPreference = React.useMemo(() => createLegendPreference(form), []);
      const [legendDismissed, setLegendDismissed] = React.useState(false);
      const announcer = React.useMemo(() => createActivityAnnouncer({ announce: setAnnouncement }), []);
      const receiveActivity = React.useCallback((value) => {
        setPresentation(value);
        announcer.update(value);
      }, [announcer]);
      React.useEffect(() => () => announcer.dispose(), [announcer]);
      const snapshot = useForm();
      const signature = snapshot.status === "ready" ? configSignature(snapshot.value) : "";
      const config = React.useMemo(() => normalizeConfig(snapshot.value ?? {}), [signature]);
      const list = props.useSessions?.((state) => state);
      const statuses = props.useSessionStatus?.((state) => state);
      const jobSnapshot = React.useSyncExternalStore(jobs.subscribe, jobs.getSnapshot, jobs.getSnapshot);
      const nextActivity = React.useMemo(() => {
        const value = readActivitySnapshot(list, statuses, jobSnapshot);
        return { ...value, entities: value.entities.map((entity) => ({ ...entity, label: labelOf(entity) })) };
      }, [list, statuses, jobSnapshot, language]);
      const activityKey = JSON.stringify(nextActivity);
      const activity = React.useMemo(() => nextActivity, [activityKey]);
      const scope = currentSessionId(list);
      const visible = snapshot.status === "ready" && config.enabled && (panelId === null || panelId === "conversation");
      React.useEffect(() => {
        jobs.watch(visible && config.activity ? scope : null);
        return () => jobs.watch(null);
      }, [visible, config.activity, scope]);
      React.useEffect(() => {
        if (!visible || !config.activity) announcer.update({ enabled: false, scope: null });
      }, [visible, config.activity, scope, announcer]);
      if (!visible) return null;
      const current = config.activity && presentation?.enabled && presentation.scope === activity.scope ? presentation : null;
      return h(
        "div",
        { className: "aw-overlay", style: {
          position: "absolute",
          left: "var(--dsh-windows-sidebar-width, var(--ascii-whale-inset, 280px))",
          top: "var(--dsh-frame-top-clearance, 0px)",
          right: 0,
          bottom: 0,
          "--ascii-whale-inset": `${config.leftInset}px`,
          pointerEvents: "none",
          overflow: "hidden"
        } },
        h("style", null, ACTIVITY_CSS),
        h(
          "div",
          { "aria-hidden": true, style: { position: "absolute", inset: 0 } },
          h(Canvas, { config, activity: config.activity ? activity : EMPTY_ACTIVITY, onActivityChange: receiveActivity })
        ),
        config.activity && h(
          "aside",
          { className: "aw-activity" },
          !legendDismissed && !legendPreference.seen && h(Legend, { onClose: () => {
            setLegendDismissed(true);
            return legendPreference.dismiss();
          } }),
          current && h(
            "details",
            { className: "aw-activity-summary" },
            h("summary", null, t("activitySummary")),
            h(
              "section",
              { "aria-label": t("activitySummary") },
              current.availability.currentSession === "unavailable" && h("p", null, t("activityScopeUnavailable")),
              current.availability.liveStatus === "unavailable" && h("p", null, t("activityWaitingUnavailable")),
              current.availability.jobs === "unavailable" && h("p", null, t("activityJobsUnavailable")),
              current.availability.jobs === "unknown" && h("p", null, t("activityJobsUnknown")),
              h("p", null, t("activityOverflow"), " ", current.overflow.length),
              h("ul", null, ...current.entities.map((entity) => h(
                "li",
                { key: entity.key },
                labelOf(entity),
                " · ",
                statusOf(entity),
                entity.waitingAvailable === false && h("span", null, " · ", t("activityWaitingUnavailable"))
              )))
            )
          )
        ),
        h(
          "div",
          { className: "aw-sr-only", "aria-live": "polite", "aria-atomic": true, "aria-label": t("activityAnnouncements") },
          config.activity && h(
            "span",
            { key: announcement.serial },
            announcement.entities.map((entity) => `${labelOf(entity)} · ${statusOf(entity)}`).join("; ")
          )
        )
      );
    }
    function Settings() {
      const snapshot = useForm();
      React.useSyncExternalStore(localeSubscribe, localeSnapshot, localeSnapshot);
      const [editor, setEditor] = React.useState(() => snapshot.status === "ready" ? createConfigEditor(snapshot) : null);
      const [saving, setSaving] = React.useState(false);
      const [notice, setNotice] = React.useState("");
      const [showLegend, setShowLegend] = React.useState(false);
      const dirty = editor?.dirty ?? false;
      React.useEffect(() => {
        if (snapshot.status === "ready" && !dirty) setEditor(createConfigEditor(snapshot));
      }, [snapshot, dirty]);
      const prefix = React.useId();
      const viewportRef = React.useRef(null);
      React.useEffect(() => {
        const root = viewportRef.current;
        if (!root) return;
        const fit = () => {
          const top = Math.max(0, root.getBoundingClientRect().top);
          root.style.setProperty("--aw-height", `${Math.max(200, window.innerHeight - top - 12)}px`);
        };
        fit();
        window.addEventListener("resize", fit);
        const observer = new ResizeObserver(fit);
        if (root.parentElement) observer.observe(root.parentElement);
        return () => {
          observer.disconnect();
          window.removeEventListener("resize", fit);
        };
      }, [snapshot.status, !!editor]);
      if (snapshot.status !== "ready" || !editor) return h("p", { role: "status" }, t(snapshot.status === "loading" ? "loading" : "unavailable"));
      const disabled = !snapshot.writable || saving;
      function update(key, value) {
        setEditor((current) => current.change(key, value));
        setNotice("");
      }
      async function save(event) {
        event.preventDefault();
        if (disabled || !dirty) return;
        setSaving(true);
        setNotice("");
        try {
          const result = await editor.save(form);
          setEditor(result.editor);
          setNotice(result.notice);
        } finally {
          setSaving(false);
        }
      }
      function discard() {
        setEditor(createConfigEditor(form.getSnapshot()));
        setNotice("");
      }
      function formatValue(key, field, value) {
        if (key === "opacity" || key === "rainIntensity") return `${Math.round(Number(value) * 100)}%`;
        if (key === "whaleSize" || key === "speed") return `${readout(field, value)}×`;
        if (key === "glyphSize" || key === "leftInset") return `${readout(field, value)} px`;
        return readout(field, value);
      }
      function renderField(key) {
        const field = FIELDS[key], value = editor.draft[key];
        const id = `${prefix}-${key}`, hint = `${id}-hint`, label = `${id}-label`;
        const off = disabled || key === "text" && editor.draft.fillMode === "ascii" || key === "rainIntensity" && !editor.draft.rain || key === "glassStrength" && !editor.draft.glass && !["blur", "frost"].includes(editor.draft.readingEffect);
        const common = { id, disabled: off, "aria-describedby": hint };
        const title = field.kind === "enum" ? h("span", { id: label, className: "aw-label" }, t(key)) : h("label", { id: label, htmlFor: id }, t(key));
        let control, output = null;
        if (field.kind === "boolean") {
          control = h("button", {
            ...common,
            type: "button",
            role: "switch",
            "aria-checked": value,
            "aria-labelledby": label,
            className: "aw-switch",
            onClick: () => update(key, !value)
          }, h("span", { className: "aw-switch-knob", "aria-hidden": true }));
        } else if (field.kind === "enum" && (key === "species" || key === "color")) {
          control = h(
            "select",
            {
              ...common,
              className: "aw-select",
              "aria-labelledby": label,
              value,
              onChange: (event) => update(key, event.target.value)
            },
            ...field.values.map((option) => h("option", { key: option, value: option }, t(option)))
          );
        } else if (field.kind === "enum") {
          control = h(
            "div",
            { id, role: "group", className: "aw-segments", "aria-labelledby": label, "aria-describedby": hint },
            ...field.values.map((option) => h("button", {
              key: option,
              type: "button",
              disabled: off,
              "aria-pressed": value === option,
              className: "aw-segment",
              onClick: () => update(key, option)
            }, t(option)))
          );
        } else if (field.kind === "string") {
          control = h("input", {
            ...common,
            className: "aw-text",
            type: "text",
            value,
            maxLength: field.max,
            onChange: (event) => update(key, event.target.value)
          });
        } else if (key === "leftInset") {
          control = h(
            "div",
            { className: "aw-pixel-input" },
            h("input", {
              ...common,
              type: "number",
              value,
              min: field.min,
              max: field.max,
              step: field.step,
              inputMode: "numeric",
              onChange: (event) => update(key, event.target.value === "" ? "" : Number(event.target.value))
            }),
            h("span", { "aria-hidden": true }, "px")
          );
        } else {
          const number = value === "" || !Number.isFinite(Number(value)) ? field.default : Number(value);
          output = h("output", { htmlFor: id, className: "aw-readout" }, formatValue(key, field, value));
          control = h(
            "div",
            { className: "aw-number" },
            h("input", {
              ...common,
              type: "range",
              className: "aw-slider",
              min: field.min,
              max: field.max,
              step: field.step,
              value: number,
              "aria-valuetext": formatValue(key, field, number),
              style: { "--aw-pct": trackFill((number - field.min) / (field.max - field.min || 1)) },
              onChange: (event) => update(key, Number(event.target.value))
            }),
            h(
              "div",
              { className: "aw-scale", "aria-hidden": true },
              h("span", null, formatValue(key, field, field.min)),
              h("span", null, formatValue(key, field, field.max))
            )
          );
        }
        return h(
          "div",
          { className: `aw-row aw-row--${field.kind}`, key, "data-aw-field": key },
          h(
            "div",
            { className: "aw-copy" },
            h("div", { className: "aw-row-heading" }, title, output),
            h("p", { id: hint }, t(`${key}Hint`))
          ),
          control
        );
      }
      const groups = [
        { id: "appearance", fields: ["renderStyle", "fillMode", "color", "opacity", "glyphSize"] },
        { id: "school", fields: ["species", "count", "whaleSize", "speed", "spout"] },
        { id: "reading", fields: ["readingEffect", "glass", "glassStrength", "quietCenter", "composerAvoid"] },
        { id: "sea", fields: ["wind", "clouds", "ripples", "rain", "rainIntensity"] },
        { id: "layout", fields: ["leftInset", "pauseOnScroll"] }
      ];
      return h(
        "form",
        { ref: viewportRef, className: "aw-settings", onSubmit: save },
        h("style", null, SETTINGS_CSS),
        h(
          "header",
          { className: "aw-header" },
          h("div", null, h("h2", null, t("title")), h("p", { className: "aw-purpose" }, t("purpose"))),
          h("div", { className: "aw-master" }, renderField("enabled"))
        ),
        !snapshot.writable && h("p", { role: "status", className: "aw-notice" }, t("readOnly")),
        h(LivePreview, { draft: editor.draft }),
        h(
          "div",
          { className: "aw-options", role: "region", "aria-label": t("settingsOptions"), tabIndex: 0 },
          h(
            "div",
            { className: "aw-primary aw-group" },
            h(
              "div",
              { className: "aw-row" },
              h(
                "div",
                { className: "aw-copy" },
                h("label", { htmlFor: `${prefix}-preset` }, t("scenePreset")),
                h("p", { id: `${prefix}-preset-hint` }, t("presetDescription"))
              ),
              h(
                "select",
                {
                  id: `${prefix}-preset`,
                  className: "aw-select",
                  disabled,
                  value: matchPreset(editor.draft),
                  "aria-describedby": `${prefix}-preset-hint`,
                  onChange: (event) => {
                    setEditor((current) => current.applyPreset(event.target.value));
                    setNotice("");
                  }
                },
                h("option", { value: "custom", disabled: true }, t("preset_custom")),
                ...Object.keys(PRESETS).map((id) => h("option", { key: id, value: id }, t(`preset_${id}`)))
              )
            ),
            renderField("resourceMode"),
            renderField("text"),
            renderField("activity"),
            h("button", {
              type: "button",
              "aria-expanded": showLegend,
              onClick: () => setShowLegend((value) => !value)
            }, t("activityLegendOpen")),
            showLegend && h(Legend, { onClose: () => setShowLegend(false) })
          ),
          h(
            "details",
            { className: "aw-advanced" },
            h("summary", null, t("advancedGroup")),
            h("div", { className: "aw-advanced-body aw-groups" }, ...groups.map((group) => h(
              "fieldset",
              { className: "aw-group", key: group.id },
              h("legend", null, t(`${group.id}Group`)),
              h("p", { className: "aw-group-note" }, t(`${group.id}Description`)),
              ...group.fields.map(renderField)
            )))
          ),
          notice && h("p", { className: "aw-notice", role: notice === "saved" ? "status" : "alert", "aria-live": "polite" }, t(notice))
        ),
        h(
          "footer",
          { className: "aw-actions" },
          h("div", { className: "aw-save-state", role: "status", "aria-live": "polite" }, t(dirty ? "unsavedDraft" : "savedDraft")),
          h(
            "div",
            { className: "aw-action-buttons" },
            h("button", { type: "button", disabled, onClick: () => {
              setEditor((e) => e.reset());
              setNotice("");
            } }, t("reset")),
            h("button", { type: "button", disabled: saving, onClick: discard }, t("discard")),
            h("button", { type: "submit", disabled: disabled || !dirty, className: "aw-save" }, t(saving ? "saving" : "save"))
          )
        )
      );
    }
    function SidebarIcon({ size: size2 }) {
      return h(
        "svg",
        { width: size2, height: size2, viewBox: "0 0 36 36", fill: "none", "aria-hidden": true },
        h(
          "g",
          { transform: "rotate(40 18 18)", fill: "currentColor" },
          h("path", { d: "M14.7 12.8C11.8 13.7 9.3 15.7 9 18.5C11.8 18.4 14.4 16.9 15.9 14.7L14.7 12.8ZM21.3 12.8C24.2 13.7 26.7 15.7 27 18.5C24.2 18.4 21.6 16.9 20.1 14.7L21.3 12.8Z" }),
          h("path", { d: "M18 6.5C14.9 6.5 13.2 9 13.2 12.2C13.2 17.1 15.5 20.7 16.5 23.6L16.6 24.9C14.9 24.1 12.6 24.1 11 24.9C11.7 27.6 14.6 28.9 17.3 28.2L18 27.1L18.7 28.2C21.4 28.9 24.3 27.6 25 24.9C23.4 24.1 21.1 24.1 19.4 24.9L19.5 23.6C20.5 20.7 22.8 17.1 22.8 12.2C22.8 9 21.1 6.5 18 6.5Z" })
        )
      );
    }
    function SettingsPanel() {
      return h("div", { style: {
        flex: "1 1 0",
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        overflow: "hidden",
        padding: "16px clamp(16px, 3vw, 40px) 0",
        boxSizing: "border-box"
      } }, h(Settings));
    }
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: "ascii-whales",
      order: 5,
      label: () => t("title")
    }, SidebarIcon));
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: "ascii-whales"
    }, SettingsPanel));
    ctx.slots.inject("shell.overlay", () => ctx.slots.register({
      name: "shell.overlay",
      id: "ascii-whale-background",
      order: -100
    }, Overlay));
    ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
      name: "plugins.bundle.config",
      key: "@local/dsh-ascii-ocean"
    }, Settings));
  }
  var ACTIVITY_CSS = `
.aw-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.aw-activity{position:absolute;right:16px;top:12px;max-width:min(360px,calc(100% - 32px));max-height:calc(100% - 24px);overflow:auto;color:var(--dsw-alias-label-primary,#1d2633);font:13px/1.5 system-ui,sans-serif}
.aw-activity-summary,.aw-legend{pointer-events:auto;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#c9d2de);border-radius:12px;padding:12px;margin-bottom:8px;overflow-wrap:anywhere}
.aw-activity-summary summary{cursor:pointer}.aw-legend h3{font-size:14px;margin:0 0 8px}.aw-legend ul,.aw-activity-summary ul{padding-left:20px;margin:8px 0}.aw-legend p{margin:8px 0}
.aw-legend button,.aw-activity-summary button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;min-height:36px;padding:4px 10px;cursor:pointer}
.aw-overlay :focus-visible{outline:3px solid #007aff;outline-offset:3px}
body[data-ds-dark-theme] .aw-activity{color:var(--dsw-alias-label-primary,#edf1f7)}
body[data-ds-dark-theme] .aw-activity-summary,body[data-ds-dark-theme] .aw-activity .aw-legend{background:var(--dsw-alias-bg-layer-1,#242c36)}
`;
  var SETTINGS_CSS = `
.aw-settings{--aw-accent:#007aff;--aw-ink:var(--dsw-alias-label-primary,#1d2633);--aw-muted:var(--dsw-alias-label-secondary,#647184);--aw-surface:var(--dsw-alias-bg-layer-1,#fff);--aw-line:var(--dsw-alias-border-l1,#e3e7ed);--aw-rail:rgba(120,135,155,.22);--aw-inset:rgba(120,135,155,.09);color:var(--aw-ink);font:inherit;width:100%;max-width:1280px;min-width:0;margin-inline:auto;padding:8px 0 24px;container-type:inline-size;box-sizing:border-box}
.aw-settings *{box-sizing:border-box}
/* The form owns a bounded viewport; only options scroll, never the canvas. */
.aw-settings{display:flex;flex-direction:column;height:var(--aw-height,calc(100dvh - 120px));overflow:hidden;min-height:200px;padding-bottom:0}
.aw-settings .aw-header,.aw-settings .aw-preview,.aw-settings .aw-actions{flex-shrink:0}
.aw-settings .aw-header{margin-bottom:12px}
.aw-settings .aw-preview{margin-bottom:14px;padding:12px 16px}
.aw-settings .aw-preview-card canvas{height:clamp(64px,calc(var(--aw-height,700px) * .28),300px)}
.aw-settings .aw-preview-note{margin-top:6px}
.aw-settings .aw-options{flex:1 1 0;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;scrollbar-gutter:stable;padding:3px 8px 8px 3px;scroll-padding-block:12px}
.aw-settings .aw-actions{position:static;margin-top:0;padding-block:10px}
.aw-settings .aw-header{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:24px}
.aw-settings h2{font-size:24px;line-height:1.25;font-weight:650;letter-spacing:-.025em;margin:0 0 8px}
.aw-settings .aw-purpose{font-size:13px;line-height:1.6;color:var(--aw-muted);margin:0;max-width:680px}
.aw-settings .aw-master{flex:0 0 220px}
.aw-settings .aw-master .aw-row{border:0;padding:0}
.aw-settings .aw-master .aw-copy p{font-size:11px}
.aw-settings input,.aw-settings select,.aw-settings button{font:inherit;color:var(--aw-ink)}
.aw-settings button{cursor:pointer}
.aw-settings :disabled{opacity:.45;cursor:default}
.aw-settings :focus-visible{outline:3px solid var(--aw-accent);outline-offset:3px}
.aw-settings .aw-preview{display:block;min-width:0;margin:0 0 24px;padding:18px;border:1px solid var(--aw-line);border-radius:22px;background:var(--aw-surface);box-shadow:0 3px 16px rgba(25,45,65,.035)}
.aw-settings .aw-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
.aw-settings .aw-preview h3{font-size:15px;line-height:1.4;font-weight:600;margin:0 0 3px}
.aw-settings .aw-preview-toolbar p{font-size:12px;line-height:1.4;color:var(--aw-muted);margin:0}
.aw-settings .aw-preview-pause{flex-shrink:0;font-size:12px;font-weight:500;min-height:36px;padding:7px 14px;border:1px solid var(--aw-line);border-radius:999px;background:var(--aw-inset)}
.aw-settings .aw-preview-card{overflow:hidden;isolation:isolate;border-radius:14px;background:var(--aw-surface);border:1px solid var(--aw-line)}
.aw-settings .aw-preview-card canvas{display:block;width:100%;height:clamp(320px,50vh,560px)}
.aw-settings .aw-preview-note{font-size:12px;line-height:1.6;color:var(--aw-muted);margin:12px 2px 0}
.aw-settings .aw-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:20px}
.aw-settings .aw-group{min-width:0;margin:0;padding:0 22px 10px;border:1px solid var(--aw-line);border-radius:20px;background:var(--aw-surface)}
.aw-settings .aw-group legend{float:left;width:100%;padding:20px 0 0;font-size:17px;line-height:1.4;font-weight:650;letter-spacing:-.015em}
.aw-settings .aw-group-note{clear:both;color:var(--aw-muted);font-size:12px;line-height:1.5;padding:5px 0 14px;margin:0;border-bottom:1px solid var(--aw-line)}
.aw-settings .aw-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px;min-width:0;padding:15px 0;border-bottom:1px solid var(--aw-line)}
.aw-settings .aw-row:last-child{border-bottom:0}
.aw-settings .aw-copy{min-width:0;flex:1 1 100%}
.aw-settings .aw-row--boolean{flex-wrap:nowrap;min-height:76px}
.aw-settings .aw-row--boolean .aw-copy{flex:1 1 0}
.aw-settings .aw-row-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.aw-settings label,.aw-settings .aw-label{font-size:13px;line-height:1.45;font-weight:550}
.aw-settings .aw-copy p{font-size:12px;line-height:1.5;color:var(--aw-muted);margin:5px 0 0;overflow-wrap:break-word}
.aw-settings .aw-readout{flex-shrink:0;font-size:12px;font-weight:600;line-height:1.4;font-variant-numeric:tabular-nums;color:var(--aw-accent);background:rgba(0,122,255,.07);border-radius:6px;padding:2px 7px;white-space:nowrap}
.aw-settings .aw-text,.aw-settings .aw-select{width:100%;min-width:0;min-height:40px;padding:9px 12px;border:1px solid var(--aw-line);border-radius:10px;background:var(--aw-inset);font-size:13px;line-height:1.4}
.aw-settings .aw-select{cursor:pointer;color-scheme:light}
.aw-settings .aw-select option{color:#1d2633;background:#fff}
.aw-settings .aw-segments{display:flex;flex:1 1 100%;min-width:0;padding:3px;gap:3px;border-radius:11px;background:var(--aw-inset)}
.aw-settings .aw-segment{flex:1 1 0;min-width:0;min-height:36px;padding:7px 4px;background:transparent;border:1px solid transparent;border-radius:8px;font-size:12px;line-height:1.35;text-align:center;overflow-wrap:normal;word-break:normal;hyphens:none;letter-spacing:-.01em;color:var(--aw-muted)}
.aw-settings .aw-segment[aria-pressed=true]{background:var(--aw-surface);color:var(--aw-ink);font-weight:600;border-color:var(--aw-line);box-shadow:0 1px 3px rgba(20,40,60,.08)}
.aw-settings .aw-number{width:100%;min-width:0}
.aw-settings input[type=range]{-webkit-appearance:none;appearance:none;display:block;width:100%;height:32px;margin:0;padding:0;background:transparent;border:0;border-radius:999px;cursor:pointer;accent-color:var(--aw-accent);touch-action:pan-y}
.aw-settings input[type=range]::-webkit-slider-runnable-track{height:5px;border-radius:999px;background:linear-gradient(to right,var(--aw-accent) 0 var(--aw-pct,0%),var(--aw-rail) var(--aw-pct,0%) 100%)}
.aw-settings input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;margin-top:-8.5px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.06);box-shadow:0 1px 4px rgba(20,35,50,.22),0 2px 8px rgba(20,35,50,.06)}
.aw-settings input[type=range]::-moz-range-track{height:5px;border-radius:999px;background:var(--aw-rail)}
.aw-settings input[type=range]::-moz-range-progress{height:5px;border-radius:999px;background:var(--aw-accent)}
.aw-settings input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.06);box-shadow:0 1px 4px rgba(20,35,50,.22)}
.aw-settings .aw-scale{display:flex;justify-content:space-between;gap:12px;font-size:10px;line-height:1.4;color:var(--aw-muted);font-variant-numeric:tabular-nums}
.aw-settings .aw-switch{position:relative;flex:0 0 48px;width:48px;height:44px;min-height:44px;padding:0;border:0;border-radius:14px;background:transparent}
.aw-settings .aw-switch::before{content:'';position:absolute;inset:8px 0;border-radius:999px;background:var(--aw-rail)}
.aw-settings .aw-switch-knob{position:absolute;top:10px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15)}
.aw-settings .aw-switch[aria-checked=true]::before{background:var(--aw-accent)}
.aw-settings .aw-switch[aria-checked=true] .aw-switch-knob{transform:translateX(20px)}
.aw-settings .aw-advanced{margin-top:20px;border:1px solid var(--aw-line);border-radius:16px;background:var(--aw-surface)}
.aw-settings .aw-advanced summary{padding:16px 22px;font-size:13px;font-weight:550;cursor:pointer}
.aw-settings .aw-advanced-body{padding:0 12px 12px}
.aw-settings .aw-pixel-input{display:flex;align-items:center;gap:8px;flex:0 0 116px;color:var(--aw-muted);font-size:12px}
.aw-settings .aw-pixel-input input{min-width:0;width:84px;padding:8px;border:1px solid var(--aw-line);border-radius:8px;background:var(--aw-inset);font-variant-numeric:tabular-nums}
.aw-settings .aw-actions{position:sticky;bottom:0;z-index:4;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-top:20px;padding:14px 0;background:var(--aw-surface);border-top:1px solid var(--aw-line)}
.aw-settings .aw-save-state{font-size:12px;line-height:1.4;color:var(--aw-muted)}
.aw-settings .aw-primary{padding-bottom:0}
.aw-settings .aw-action-buttons{display:flex;flex-wrap:wrap;gap:8px}
.aw-settings .aw-action-buttons button{min-height:38px;padding:8px 14px;font-size:12px;font-weight:500;line-height:1.4;border:1px solid var(--aw-line);border-radius:10px;background:var(--aw-inset)}
.aw-settings .aw-action-buttons .aw-save{color:#fff;border-color:var(--aw-accent);background:var(--aw-accent);padding-inline:22px}
.aw-settings .aw-notice{font-size:13px;line-height:1.5;padding:12px 14px;border-radius:10px;background:var(--aw-inset)}
body[data-ds-dark-theme] .aw-settings{--aw-accent:#0a84ff;--aw-inset:rgba(160,175,195,.10);--aw-rail:rgba(160,175,195,.27)}
body[data-ds-dark-theme] .aw-settings .aw-select{color-scheme:dark}
body[data-ds-dark-theme] .aw-settings .aw-select option{color:#e8edf5;background:#242c36}
@media(hover:hover) and (pointer:fine){
.aw-settings .aw-segment:not(:disabled):hover{color:var(--aw-ink);background:var(--aw-surface)}
.aw-settings .aw-action-buttons button:not(:disabled):hover,.aw-settings .aw-preview-pause:hover{filter:brightness(.96)}
}
@media(prefers-reduced-motion:no-preference){
.aw-settings .aw-switch-knob{transition:transform 160ms cubic-bezier(.23,1,.32,1)}
.aw-settings .aw-switch::before{transition:background-color 160ms ease}
}
@media(max-height:600px){.aw-settings .aw-actions{position:static}}
@media(prefers-contrast:more){.aw-settings{--aw-line:currentColor}.aw-settings .aw-copy p,.aw-settings .aw-scale{color:var(--aw-ink)}}
@container(max-width:760px){
.aw-settings .aw-header{align-items:flex-start;flex-direction:column;gap:16px}
.aw-settings .aw-master{flex:auto;width:100%}
.aw-settings .aw-groups{grid-template-columns:minmax(0,1fr);gap:16px}
.aw-settings .aw-preview-card canvas{height:clamp(280px,45vh,420px)}
}
@container(max-width:440px){
.aw-settings .aw-preview{padding:12px;border-radius:16px}
.aw-settings .aw-preview-card canvas{height:280px}
.aw-settings .aw-group{padding-inline:16px}
.aw-settings .aw-actions{align-items:flex-start}
.aw-settings .aw-action-buttons{width:100%}
.aw-settings .aw-action-buttons button{flex:1 1 auto;padding-inline:10px}
.aw-settings .aw-segment{font-size:11px;padding-inline:3px}
.aw-settings .aw-preview-toolbar{gap:8px}
.aw-settings .aw-preview-pause{padding-inline:10px}
.aw-settings .aw-advanced .aw-row{flex-wrap:wrap}
.aw-settings .aw-advanced .aw-copy{flex-basis:100%}
}
.aw-settings .aw-header{margin-bottom:12px}
.aw-settings .aw-preview{margin-bottom:14px;padding:12px 16px}
.aw-settings .aw-preview-card canvas{height:clamp(64px,calc(var(--aw-height,700px) * .28),300px)}
.aw-settings .aw-preview-note{margin-top:6px}
.aw-settings .aw-actions{position:static;margin-top:0;padding-block:10px}
@media(max-height:760px){
.aw-settings .aw-purpose,.aw-settings .aw-preview-note,.aw-settings .aw-preview-toolbar p{display:none}
.aw-settings .aw-header h2{font-size:19px;margin:0}
.aw-settings .aw-master .aw-copy p{display:none}
.aw-settings .aw-preview-toolbar{margin-bottom:6px}
.aw-settings .aw-preview{padding:8px 12px;margin-bottom:8px}
.aw-settings .aw-preview-card canvas{height:clamp(56px,calc(var(--aw-height,500px) * .22),150px)}
.aw-settings .aw-actions{gap:6px;padding-block:6px}
.aw-settings .aw-action-buttons{margin-left:auto}
}
@container(max-width:760px){
.aw-settings .aw-header{flex-direction:row;align-items:center;gap:12px}
.aw-settings .aw-master{width:auto;flex:0 1 190px}
}
`;

  // locale/en.json
  var en_default = {
    meta: {
      title: "Glyph whales",
      description: "Five species of text whales cruise, beat their flukes up and down, and glide behind the conversation."
    },
    ui: {
      title: "Glyph whales",
      purpose: "Make a sea of text whales your conversation background. Preview it, adjust the scene, then save to apply.",
      settingsOptions: "Whale settings options",
      previewTitle: "Scene preview",
      previewSubtitle: "See your draft as you adjust the settings below",
      previewPause: "Pause preview",
      previewPlay: "Resume preview",
      appearanceGroup: "Appearance & text",
      appearanceDescription: "Choose the characters, colors and contrast.",
      schoolGroup: "Whales & movement",
      schoolDescription: "Set the species, count, size and swimming pace.",
      readingGroup: "Reading & glass",
      readingDescription: "Text effects and card glass are independent. Both can be turned off.",
      seaGroup: "Sea & weather",
      seaDescription: "Choose wind, clouds, swimming wakes and rain.",
      advancedGroup: "Advanced settings",
      layoutGroup: "Layout & scrolling",
      layoutDescription: "Adjust browser spacing and scrolling behavior.",
      scenePreset: "Scene preset",
      presetDescription: "Adjust count, speed, opacity, color and sea effects in the draft. Keeps your text and reading preferences. Save to apply. Default scene differs from restoring all defaults.",
      preset_custom: "Custom",
      preset_default: "Default",
      preset_rainy: "Rainy",
      preset_minimal: "Minimal",
      preset_night: "Night voyage",
      unsavedDraft: "Unsaved changes, shown in the preview only",
      savedDraft: "Changes preview immediately. Save to apply to the background.",
      none: "Off",
      enabled: "Show whales",
      enabledHint: "Visible on the conversation page. Stops on other pages.",
      count: "Whale count",
      countHint: "1 to 8 whales with different sizes and depths.",
      text: "Whale body text",
      textHint: "Repeats these characters to form each whale. Spaces are ignored. Leave blank to use 探索未至之境 (the default phrase, “explore the uncharted”). Up to 40 characters.",
      resourceMode: "Resource mode",
      resourceModeHint: "Economy uses fewer animation updates and drifts at 75% of your saved swimming speed. Keeps scene settings and task updates. Reduced motion takes priority.",
      standard: "Standard",
      economy: "Economy",
      speed: "Swimming speed",
      speedHint: "0.3 to 2. Default 0.65. Scales cruising, turning and tail beats, with glides between strokes.",
      opacity: "Background opacity",
      opacityHint: "0.04 to 0.9. Default 0.6. Higher values make the body text clearer.",
      glyphSize: "Character size",
      glyphSizeHint: "4 to 16. Default 11. Characters occupy separate, fixed grid cells.",
      whaleSize: "Whale size",
      whaleSizeHint: "0.55 to 1.55. Default 1. Changes body length only, not swimming speed; larger whales cover more cells.",
      color: "Whale colors",
      colorHint: "Choose a shared palette, or give each whale its own stable random color. Applies to glyphs and colored cells.",
      ocean: "Ocean",
      azure: "Azure",
      indigo: "Indigo",
      rainbow: "Random color per whale",
      activity: "Follow task activity",
      activityHint: "Whales swim more actively while the current session and its subagents work. They slow down and show ! when waiting for a question, approval or plan review. A finished background task shows ✓; a failed one shows ×. Turn off for decoration only.",
      quietCenter: "Quieter reading area",
      quietCenterHint: "Fades whale bodies in the center. The bottom input area always fades out.",
      leftInset: "Browser left inset",
      leftInsetHint: "0 to 500 pixels. Default 280. Desktop follows the sidebar automatically. In a browser, adjust this to match its width.",
      readingEffect: "Text edge effect",
      readingEffectHint: "Choose Off, Glow, Soft blur or Frosted glass around text. Independent of card glass.",
      glow: "Glow",
      blur: "Soft blur",
      frost: "Frosted glass",
      glass: "Frosted content boxes",
      glassHint: "Frost content cards, the input box and the right sidebar. Independent of text effects. Enabling this turns input-box avoidance off.",
      glassStrength: "Glass strength",
      glassStrengthHint: "0 to 1. Default 0.55. Higher values make the glass thicker and blurrier, so less of the whale shows through.",
      composerGlass: "Frosted input box (folded into content boxes)",
      composerGlassHint: "The separate 0.10.0 input-box switch; since 0.11.0 it is part of the frosted content boxes. Kept only to read old configs.",
      composerAvoid: "Whales avoid the input box",
      composerAvoidHint: "Whales treat the input box as an obstacle and swim around it instead of crossing it. Use either this or the frosted content boxes, not both.",
      spout: "Random spout",
      spoutHint: "On by default. Each whale occasionally lets out a round puff from its blowhole. The puff stays where it started and fades. The whale stays quiet while submerged, and the puff does not become a fountain.",
      wind: "Wind on the sea",
      windHint: "Sparse aligned surface strokes drift with the breeze, appearing and fading gently. On by default.",
      clouds: "Passing cloud shadows",
      cloudsHint: "Soft, slow-moving cloud shadows cross the sea and slightly shade whale ink while respecting reading areas. On by default.",
      rain: "Rain over the sea",
      rainHint: "Fine rain makes small splashes and spreading ripples. Its direction follows the sea breeze. Off by default; turning wind off gradually returns the rain to vertical.",
      rainIntensity: "Rain intensity",
      rainIntensityHint: "0 to 1. Default 0.45. Smoothly changes rain density, impacts and ripples. Zero stops the rain; switching rain off keeps this value. Rain ripples are independent of swimming wakes.",
      pauseOnScroll: "Pause rendering while scrolling",
      pauseOnScrollHint: "Off by default: the school keeps swimming while you scroll and the text mask follows the new positions. When on, scrolling hides the decorative layer at once and freezes the simulation; about 140 ms after the last scroll it measures once and fades back in, so a soft mask can never lag behind moving text.",
      ripples: "Swimming wakes and splashes",
      ripplesHint: "Swimming and gliding leave an ASCII wake that spreads and fades along the trail. Strong tail strokes add a brief splash. Submerged whales stop making new wakes.",
      save: "Save",
      saving: "Saving…",
      reset: "Restore all defaults",
      discard: "Reload saved values",
      loading: "Loading whale settings…",
      unavailable: "Whale settings are unavailable.",
      readOnly: "These settings are read-only.",
      saved: "Whale settings saved.",
      invalid: "Enter numbers within the listed ranges. Count, size, and inset must be whole numbers.",
      conflict: "Settings changed elsewhere, or the save was refused. Your edits are preserved. Reload saved values before editing again.",
      failed: "Could not save. Your edits are preserved and can be retried.",
      species: "Whale species",
      speciesHint: "Mixed groups cycle through blue, humpback, sperm, fin and bowhead whales. Or choose one species.",
      renderStyle: "Drawing style",
      renderStyleHint: "Glyphs draws letters only. Colored cells add shaded backgrounds inside the whale, with soft glyph-only edges.",
      glyphs: "Glyphs only",
      cells: "Colored cells",
      fillMode: "Fill content",
      fillModeHint: "Custom text keeps your original characters. ASCII selects symbols by density and shading. Either works with colored cells.",
      custom: "Custom text",
      ascii: "ASCII characters",
      stylePreview: "Live whale preview of the current draft",
      stylePreviewNote: "The preview scales the conversation background uniformly, keeping characters and whales in proportion. Changes appear live; save to apply them. The card at the lower right demonstrates glass and avoidance.",
      mixed: "Mixed group",
      blue: "Blue",
      humpback: "Humpback",
      sperm: "Sperm",
      fin: "Fin",
      bowhead: "Bowhead",
      activityLegend: "Task state legend",
      activityLegendOpen: "Show task state legend",
      activityLegendClose: "Close legend",
      activityLegendNote: "Idle does not mean success. Results appear only after an observed background task finishes or fails. Cancelled, stopped and missing tasks do not imply success. Whales do not replace the host task history or answer for you.",
      activitySummary: "Current task states",
      activityAnnouncements: "New task updates",
      activityRunning: "Running",
      activityWaiting: "Waiting for you",
      activityIdle: "Idle or stopped this turn",
      activityCompleted: "Background task completed",
      activityFailed: "Background task failed",
      activityUnavailable: "State unavailable",
      activityScopeUnavailable: "Current session state is unavailable.",
      activityWaitingUnavailable: "Waiting information is unavailable.",
      activityJobsUnavailable: "Background task states are unavailable.",
      activityJobsUnknown: "Current background tasks are unknown.",
      activityOverflow: "Tasks without their own whale",
      activitySession: "Session",
      activitySubagent: "Subagent",
      activityJob: "Background task"
    }
  };

  // locale/zh.json
  var zh_default = {
    meta: {
      title: "文字蓝鲸",
      description: "由你的文字组成五种鲸鱼，从海面正上方看它们缓缓巡游、上下摆尾与滑行。"
    },
    ui: {
      title: "文字蓝鲸",
      purpose: "让文字鲸群成为对话背景。先看效果，再调整外观、鲸群与海面；保存后应用。",
      settingsOptions: "鲸鱼设置选项",
      previewTitle: "效果预览",
      previewSubtitle: "调整下方设置，即时查看当前草稿",
      previewPause: "暂停预览",
      previewPlay: "继续预览",
      appearanceGroup: "外观与文字",
      appearanceDescription: "选择字符、色调与画面的浓淡。",
      schoolGroup: "鲸群与游动",
      schoolDescription: "调整鲸类、数量、大小和游动节奏。",
      readingGroup: "阅读与玻璃",
      readingDescription: "文字效果与卡片玻璃分别控制，均可关闭。",
      seaGroup: "海面与天气",
      seaDescription: "按喜好开关风纹、云影、尾流和雨水。",
      advancedGroup: "高级设置",
      layoutGroup: "布局与滚动",
      layoutDescription: "调整浏览器留白与滚动暂退。",
      scenePreset: "场景预设",
      presetDescription: "一次调整鲸数、游速、浓度、配色和海面效果，仅改草稿。保留文字与阅读偏好，保存后应用。默认场景与恢复全部默认值不同。",
      preset_custom: "自定义",
      preset_default: "默认",
      preset_rainy: "雨天",
      preset_minimal: "极简",
      preset_night: "夜航",
      unsavedDraft: "有未保存的调整，仅在预览中显示",
      savedDraft: "调整会即时预览，保存后应用到背景",
      none: "关闭",
      enabled: "显示鲸鱼",
      enabledHint: "仅在对话页面显示，切换到其他页面时停止。",
      count: "鲸鱼数量",
      countHint: "1 至 8 条，大小与远近各有不同。",
      text: "鱼身文字",
      textHint: "重复使用这些字组成鲸鱼；留空使用探索未至之境。忽略空白，最多 40 个字符。",
      resourceMode: "资源档位",
      resourceModeHint: "省资源档减少动画更新，以已保存游速的 75% 慢漂移。保留场景设置，任务提示及时更新。系统减少动态效果优先。",
      standard: "标准",
      economy: "省资源",
      speed: "游动速度",
      speedHint: "0.3 至 2，默认 0.65。巡游、转弯与摆尾同步放缓，摆尾之间有自然滑行。",
      opacity: "背景浓度",
      opacityHint: "0.04 至 0.9，默认 0.6。数值越高，鱼身文字越清楚。",
      glyphSize: "字符大小",
      glyphSizeHint: "4 至 16，默认 11。文字按固定字格排列，不互相叠压。",
      whaleSize: "鲸鱼大小",
      whaleSizeHint: "0.55 至 1.55，默认 1。只改鲸体长度，不改游速与摆尾节奏；鲸体越大，占用的字格越多。",
      color: "鲸鱼配色",
      colorHint: "选择统一色调，或为每条鲸鱼随机分配一种固定颜色。适用于字符与彩色字格。",
      ocean: "深海蓝",
      azure: "晴空蓝",
      indigo: "靛蓝",
      rainbow: "每条随机配色",
      activity: "跟随任务状态",
      activityHint: "当前会话与子代理工作时加强巡游；等待提问、审批或计划审阅时慢游并显示 !；后台任务完成显示 ✓，失败显示 ×。关闭后只作装饰。",
      quietCenter: "减淡阅读区域",
      quietCenterHint: "降低中央鲸体的浓度。底部输入区始终保持淡出。",
      leftInset: "浏览器左侧留白",
      leftInsetHint: "0 至 500 像素，默认 280。桌面版自动跟随左侧栏；浏览器版按侧栏宽度手动调整。",
      readingEffect: "文字边缘效果",
      readingEffectHint: "选择关闭、微光、柔和模糊或毛玻璃；只作用于文字附近，与卡片玻璃独立。",
      glow: "微光",
      blur: "柔和模糊",
      frost: "毛玻璃",
      glass: "内容框毛玻璃",
      glassHint: "为内容卡片、输入框和右侧栏添加磨砂玻璃。与文字边缘效果独立；开启后会关闭输入框避让。",
      glassStrength: "玻璃强度",
      glassStrengthHint: "0 至 1，默认 0.55。数值越大玻璃更厚、磨砂更重，透出的鲸影也更淡。",
      composerGlass: "输入框毛玻璃（已并入内容框毛玻璃）",
      composerGlassHint: "0.10.0 的独立输入框开关；0.11.0 起并入「内容框毛玻璃」，此字段仅用于兼容旧配置。",
      composerAvoid: "鱼群避让输入框",
      composerAvoidHint: "鲸鱼把输入框当作障碍物绕开，不再从框内穿过。与「内容框毛玻璃」二选一。",
      spout: "随机喷水",
      spoutHint: "默认开启。鲸鱼隔一会儿从喷气孔鼓出一小团圆雾，停在原地散掉。潜入水下时不吐，也不会连成喷泉。",
      wind: "海面风纹",
      windHint: "少量同向的短波纹随风掠过海面，缓缓出现和散去。默认开启。",
      clouds: "掠海云影",
      cloudsHint: "云层投下柔和、缓慢漂移的云影，轻微压暗鲸体颜色，并让开阅读区域。默认开启。",
      rain: "海上落雨",
      rainHint: "细雨落海时带出小水花与扩散涟漪，方向随海面风纹缓慢偏转。默认关闭；关闭风纹后逐渐回到直雨。",
      rainIntensity: "雨量",
      rainIntensityHint: "0 至 1，默认 0.45。由疏雨到密雨，雨丝、落点与水纹平滑变化；0 为停雨，开关关闭时保留此数值。雨水纹不受游动尾流开关影响。",
      pauseOnScroll: "滚动时暂停渲染",
      pauseOnScrollHint: "默认关闭，滚动时鲸群继续巡游，文字遮罩随位置刷新。开启后滚动即刻隐去装饰层并暂停仿真，停手约 140 毫秒后按新位置测量一次再淡入恢复，可避免柔边遮罩跟不上移动中的文字。",
      ripples: "游动尾流与水花",
      ripplesHint: "游过后留下逐渐展开、消散的 ASCII 尾流，滑行也有；用力拍尾时带少量碎水。潜入水下后停止生成新尾流。",
      save: "保存",
      saving: "保存中…",
      reset: "恢复全部默认值",
      discard: "重新载入已保存值",
      loading: "正在读取蓝鲸设置…",
      unavailable: "蓝鲸设置暂不可用。",
      readOnly: "当前设置为只读。",
      saved: "蓝鲸设置已保存。",
      invalid: "请在标出的范围内填写数字，数量、大小和留白须为整数。",
      conflict: "设置已在别处更新，或本次保存未获接受。你的修改已保留。重新载入已保存值后再修改。",
      failed: "未能保存。你的修改已保留，可以重试。",
      species: "鲸鱼种类",
      speciesHint: "混合鲸群依次包含蓝鲸、座头鲸、抹香鲸、长须鲸和弓头鲸；也可只显示一种。",
      renderStyle: "渲染样式",
      renderStyleHint: "纯字符只绘文字；彩色字格为鲸体内部铺设深浅底色，轮廓边缘保留柔和字符。",
      glyphs: "纯字符",
      cells: "彩色字格",
      fillMode: "填充内容",
      fillModeHint: "自定义文字按原文填充；ASCII 按明暗选择疏密不同的符号。两种内容均可搭配彩色字格。",
      custom: "自定义文字",
      ascii: "ASCII 字符",
      stylePreview: "当前草稿的实时鲸鱼预览",
      stylePreviewNote: "预览按对话背景等比缩放，文字与鲸体使用相同比例。调整即时可见，保存后应用到背景。右下角卡片用于观察毛玻璃与避让效果。",
      mixed: "混合鲸群",
      blue: "蓝鲸",
      humpback: "座头鲸",
      sperm: "抹香鲸",
      fin: "长须鲸",
      bowhead: "弓头鲸",
      activityLegend: "任务状态图例",
      activityLegendOpen: "查看任务状态图例",
      activityLegendClose: "关闭图例",
      activityLegendNote: "空闲不等于成功。只有已观察到运行的后台任务转为完成或失败时才显示结果。取消、停止和消失不表示成功。鲸群不替代宿主任务记录，也不会代你回答或审批。",
      activitySummary: "当前任务状态",
      activityAnnouncements: "任务新变化",
      activityRunning: "运行中",
      activityWaiting: "等待你处理",
      activityIdle: "空闲或本轮停止",
      activityCompleted: "后台任务完成",
      activityFailed: "后台任务失败",
      activityUnavailable: "状态不可用",
      activityScopeUnavailable: "当前会话状态不可用。",
      activityWaitingUnavailable: "等待信息不可用。",
      activityJobsUnavailable: "后台任务状态不可用。",
      activityJobsUnknown: "当前后台任务名单未知。",
      activityOverflow: "未单独分配鲸鱼的任务数",
      activitySession: "会话",
      activitySubagent: "子代理",
      activityJob: "后台任务"
    }
  };

  // src/browser-entry.js
  window.__ModuleLoader__.load({
    id: "@local/dsh-ascii-ocean",
    factory(require2) {
      const React = require2("react");
      return {
        inject: ["slots", "locale", "configForms"],
        apply(ctx) {
          registerWhales(ctx, React, { en: en_default.ui, zh: zh_default.ui });
        }
      };
    }
  });
})();
