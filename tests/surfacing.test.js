import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, projectParticle } from '../src/model.js';
import { divePose } from '../src/motion.js';
import { whaleSpecies } from '../src/species.js';

const timing = { entry: 3, under: 2, exit: 3 };
const overhead = { x: 800, y: 450, scale: 220, focal: 900, cameraZ: 400, near: 108,
  cy: 1, sy: 0, cp: 0, sp: 1, cr: 1, sr: 0, wave: 0, stroke: 0, turn: 0 };

// Use the actual mesh, including high backs and dorsal fins. A single nose
// probe can pass while the first readable silhouette still looks like a back.
for (const species of ['blue', 'humpback', 'sperm', 'fin', 'bowhead']) {
  test(`${species} has a readable head-led surfacing interval before its back and tail`, () => {
    const scene = createScene(1, '鲸', species);
    let headOnly = 0;
    const first = { head: null, back: null, tail: null };
    for (let i = 0; i <= 120; i++) {
      const u = i / 120, action = divePose(5 + timing.exit * u, timing);
      const pose = { ...overhead, anatomy: whaleSpecies(species), submergence: action.submergence,
        divePitch: action.pitch, diveDepth: action.depth, diveKick: action.tailKick, diveArch: action.arch };
      const visible = { head: 0, back: 0, tail: 0 };
      for (const particle of scene.particles) {
        if (projectParticle(particle, pose).visibility < 0.5) continue;
        const region = particle.x > 0.55 && particle.part === 'body' ? 'head'
          : particle.x >= -0.25 && particle.x <= 0.25
            && (particle.part === 'body' || particle.part === 'dorsal') ? 'back'
            : particle.x < -0.8 ? 'tail' : null;
        if (region) visible[region]++;
      }
      for (const region of Object.keys(first)) {
        if (visible[region] >= 12 && first[region] === null) first[region] = u;
      }
      if (visible.head >= 12 && visible.back < 12 && visible.tail < 12) headOnly++;
      assert.ok(visible.head >= 12 || (visible.back < 12 && visible.tail < 12),
        `back or tail becomes readable before the head at ${u}`);
    }
    assert.ok(headOnly / 120 >= 0.16,
      `head-only interval is ${(headOnly / 120 * timing.exit).toFixed(3)}s; the silhouette needs time to read`);
    assert.ok(first.head < first.back && first.back < first.tail,
      `expected head, back, then tail; got ${JSON.stringify(first)}`);
  });
}
