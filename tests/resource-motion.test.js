import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, whalePose, projectParticle } from '../src/model.js';
import { createWhaleSimulation } from '../src/simulation.js';

const obstacle = { x: 450, y: 650, width: 700, height: 150 };

test('economy reciprocal avoidance turns two head-on whales onto distinct passing paths', () => {
  const simulation = createWhaleSimulation(normalizeConfig({ resourceMode: 'economy', count: 2, speed: 2 }), { seed: 42 });
  simulation.resize(1400, 900);
  const [a, b] = simulation.scene.whales;
  Object.assign(a, { x: 450, y: 450, heading: 0, turn: 0, speed: 60, vx: 60, vy: 0 });
  Object.assign(b, { x: 950, y: 450, heading: Math.PI, turn: 0, speed: 60, vx: -60, vy: 0 });
  Object.assign(a._motion, { targetX: 1250, targetY: 450, targetDue: 100 });
  Object.assign(b._motion, { targetX: 150, targetY: 450, targetDue: 100 });
  let closest = Infinity;
  for (let i = 0; i < 12 * 15; i++) {
    simulation.advance(1 / 15);
    closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
  }
  assert.ok(closest > 120, `closest approach ${closest}`);
  assert.ok(Math.abs(a.y - b.y) > 80, 'whales pass on different sides');
  simulation.dispose();
});
const angle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

test('coarse economy motion keeps projected whales outside the composer and dives remain continuous', () => {
  for (const [count, speed, whaleSize] of [[3, 2, 1.55], [8, 0.3, 0.55]]) {
    const config = normalizeConfig({ resourceMode: 'economy', count, speed, whaleSize, rain: true });
    const simulation = createWhaleSimulation(config, { seed: 1592594996 });
    simulation.resize(1600, 900);
    simulation.setObstacles([obstacle]);
    let submerged = false, surfaced = false, starts = 0;
    for (let frame = 0; frame < 180 * 15; frame++) {
      const before = simulation.scene.whales.map(w => ({ x: w.x, y: w.y, heading: w.heading, sub: w._motion.submergence }));
      simulation.advance(1 / 15);
      for (const [id, whale] of simulation.scene.whales.entries()) {
        const previous = before[id];
        assert.ok([whale.x, whale.y, whale.speed, whale.heading, ...whale.rig.nodes].every(Number.isFinite));
        assert.ok(whale.x >= 0 && whale.x <= 1600 && whale.y >= 0 && whale.y <= 900);
        assert.ok(Math.abs(angle(whale.heading, previous.heading)) <= whale._motion.agility * Math.sqrt(speed * 0.75) / 15 + 1e-8);
        assert.ok(Math.abs(whale._motion.submergence - previous.sub) < 0.13, 'coarse steps do not jump through dive poses');
        submerged ||= whale._motion.submergence > 0.95;
        surfaced ||= submerged && whale._motion.submergence === 0;
        starts += whale._motion.dive?.dives ?? 0;
      }
      if (frame % 15) continue;
      const scene = simulation.scene;
      const poses = scene.whales.map(w => whalePose(w, scene.time, 1600, 900, speed));
      for (const p of scene.particles) {
        const point = projectParticle(p, poses[p.whale]);
        if (point.visibility < 0.05) continue;
        assert.ok(!(point.x > obstacle.x && point.x < obstacle.x + obstacle.width
          && point.y > obstacle.y && point.y < obstacle.y + obstacle.height), `composer intrusion at frame ${frame}`);
      }
    }
    assert.ok(starts > 0 && submerged && surfaced, 'real independent dives execute and return');
    simulation.dispose();
  }
});
