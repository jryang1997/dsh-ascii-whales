import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeConfig } from '../src/model.js';
import { createWhaleSimulation } from '../src/simulation.js';
import { atmosphereWindAt, createAtmosphereField, stepAtmosphere } from '../src/atmosphere.js';
import { createArtifactPair } from './helpers/artifact-render-harness.js';

const config = extra => normalizeConfig({ count: 1, speed: 1, rain: true, ripples: false, ...extra });
const advance = (simulation, seconds) => {
  for (let frame = 0; frame < seconds * 60; frame++) simulation.advance(1 / 60);
};

test('rain follows simulation time and live edits retain the school and weather history', () => {
  const initial = config(), simulation = createWhaleSimulation(initial, { seed: 42 });
  simulation.resize(960, 600);
  advance(simulation, 3);
  const scene = simulation.scene, rain = simulation.rain;
  assert.ok(rain.time > 0 && rain.intensity > 0.4);
  assert.equal(simulation.water.ripples.length, 0, 'rain advances independently of whale wakes');
  const before = structuredClone(rain);
  assert.equal(simulation.update({ ...initial, speed: 0 }), false);
  simulation.advance(1);
  assert.deepEqual(rain, before, 'shared pause freezes the weather, including intensity transitions');
  simulation.update({ ...initial, rainIntensity: 0.9 });
  assert.equal(simulation.scene, scene);
  assert.equal(simulation.rain, rain);
  assert.deepEqual(rain, before, 'a slider edit does not reroll rain or impact history');
  advance(simulation, 2);
  assert.ok(rain.intensity > 0.85);
  simulation.update({ ...initial, rain: false, rainIntensity: 0.9 });
  advance(simulation, 6);
  assert.ok(rain.intensity < 0.001);
  assert.equal(simulation.scene, scene);
  simulation.dispose();
  assert.equal(simulation.scene, null);
  assert.equal(rain.intensity, 0);
});

test('shared breeze is deterministic, smooth, periodic across sea edges and changes direction over time', () => {
  const weather = createAtmosphereField({ width: 960, height: 600, seed: 42 });
  const out = {};
  assert.equal(atmosphereWindAt(weather, 200, 300, out), out);
  const first = { ...out }, angle = value => Math.atan2(value.y, value.x);
  const same = createAtmosphereField({ width: 960, height: 600, seed: 42 });
  assert.deepEqual(atmosphereWindAt(same, 200, 300), first);
  for (const [a, b] of [[[0, 300], [960, 300]], [[400, 0], [400, 600]]]) {
    const one = atmosphereWindAt(weather, ...a), two = atmosphereWindAt(weather, ...b);
    assert.ok(Math.hypot(one.x - two.x, one.y - two.y) < 1e-9);
  }
  stepAtmosphere(weather, 1 / 60);
  const next = atmosphereWindAt(weather, 200, 300);
  assert.ok(Math.hypot(first.x - next.x, first.y - next.y) < 0.02);
  stepAtmosphere(weather, 30);
  assert.ok(Math.abs(angle(atmosphereWindAt(weather, 200, 300)) - angle(first)) > 0.05);
});

test('built plugin and preview paint identical rain through intensity, wind and on/off changes', async t => {
  const root = new URL('../', import.meta.url);
  const [client, previewHtml] = await Promise.all(['client.js', 'preview/whale-preview.html']
    .map(name => readFile(new URL(name, root), 'utf8')));
  const pair = createArtifactPair({ client, previewHtml }, { count: 1, rain: false,
    // The squared sea strokes its own cell lattice; this check accounts for
    // rain strokes alone, so the base surface stays off in both entries.
    glass: false, wind: false, clouds: false, ripples: false, seaGrid: false });
  t.after(() => pair.dispose());
  const check = () => {
    const frames = pair.snapshots();
    assert.deepEqual(frames.host, frames.preview);
    assert.deepEqual(pair.configs().host, pair.configs().preview);
    return frames.host.commands.filter(command => command.op === 'stroke');
  };
  assert.equal(check().length, 0);
  pair.update({ rain: true, rainIntensity: 0.8 });
  pair.advance(180);
  assert.ok(check().length > 10, 'actual rain strokes reach both public canvases');
  pair.update({ wind: true, rainIntensity: 0.2 });
  pair.advance(90);
  assert.ok(check().length > 0);
  pair.update({ rain: false });
  pair.advance(600);
  assert.equal(check().length, 0, 'rain and remaining impact ripples settle after switching off');
  assert.equal(pair.config().rainIntensity, 0.2, 'the switch retains the selected rain amount');
  pair.update({ rain: true });
  pair.advance(120);
  pair.pause();
  const paused = pair.snapshots();
  pair.advance(60);
  assert.deepEqual(pair.snapshots(), paused, 'reduced motion freezes rain in the actual built entries');
  assert.ok(pair.retainedCanvases());
});
