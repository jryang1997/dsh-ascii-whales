import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_ACTIVITY, readActivitySnapshot, createActivityTracker, createJobsBridge, drawActivityBadges } from '../src/activity.js';
import { normalizeConfig } from '../src/model.js';
import { createWhaleSimulation } from '../src/simulation.js';

const primary = (kind = 'idle') => ({ key: 'session:main', type: 'session', primary: true, kind, label: '当前会话' });
const entity = (key, kind = 'running', type = 'subagent') => ({ key, type, primary: false, kind, label: key });
const snapshot = (...entities) => ({ scope: 'main', entities: [primary(), ...entities] });
const whales = count => Array.from({ length: count }, () => ({}));

function fixture() {
  return { byId: {
    main: { id: 'main', displayTitle: '当前', running: true, retainedBy: { mainView: 1 } },
    child: { id: 'child', parentId: 'main', origin: 'subagent', running: true },
    other: { id: 'other', running: true },
    old: { id: 'old', running: false },
  }, projectionsBySession: {
    child: { values: { subagentCatalog: [{ id: 'nested', mode: 'continuable', label: '嵌套代理' },
      { id: 'external', mode: 'external' }] } },
  } };
}

test('root snapshots prioritize real pending interactions and include unopened descendants and visible jobs', () => {
  const list = fixture();
  const statuses = new Map([['main', { running: true, pendingInteraction: { kind: 'question' } }],
    ['nested', { running: true }], ['other', { running: false }]]);
  const activity = readActivitySnapshot(list, statuses, { rows: { main: [
    { id: 'build', label: '构建', status: 'running' }, { id: 'build', status: 'running' },
    { id: 'result', status: 'failed' }, { id: null, status: 'running' },
  ], other: [{ id: 'unrelated', status: 'running' }] } });
  assert.equal(activity.scope, 'main');
  assert.equal(activity.entities[0].kind, 'waiting');
  assert.equal(activity.entities.find(e => e.key === 'session:nested').type, 'subagent');
  assert.equal(activity.entities.find(e => e.key === 'session:nested').kind, 'running');
  assert.equal(activity.entities.filter(e => e.key === 'job:build').length, 1);
  assert.equal(activity.entities.find(e => e.key === 'job:result').kind, 'failed');
  for (const id of ['session:other', 'session:old', 'session:external', 'job:unrelated']) {
    assert.equal(activity.entities.some(e => e.key === id), false, id);
  }
  assert.equal(readActivitySnapshot({ byId: {} }, statuses), EMPTY_ACTIVITY);
  assert.equal(readActivitySnapshot(undefined), EMPTY_ACTIVITY);
});

test('entity seats survive list reorder, higher priority arrivals, count and scene changes', () => {
  const tracker = createActivityTracker(), school = whales(3);
  tracker.update(snapshot(entity('agent:a'), entity('agent:b'))); tracker.apply(school, 0);
  assert.deepEqual(school.map(w => w.activity.key), ['session:main', 'agent:a', 'agent:b']);
  tracker.update(snapshot(entity('agent:b'), entity('agent:a'))); tracker.apply(school, 1);
  assert.deepEqual(school.map(w => w.activity.key), ['session:main', 'agent:a', 'agent:b']);
  tracker.update(snapshot(entity('agent:b', 'idle'), entity('agent:a'), entity('agent:c', 'waiting')));
  tracker.apply(school, 2);
  assert.deepEqual(school.map(w => w.activity.key), ['session:main', 'agent:a', 'agent:c']);
  const replacement = whales(3); tracker.apply(replacement, 2);
  assert.deepEqual(replacement, school);
  tracker.apply(replacement, 3, false); assert.ok(replacement.every(w => !w.activity));
  tracker.apply(replacement, 3, true); assert.equal(replacement[2].activity.kind, 'waiting');
});

test('one whale summarizes hidden attention, running work and job failures', () => {
  const tracker = createActivityTracker(), school = whales(1);
  tracker.update(snapshot(entity('child', 'waiting'))); tracker.apply(school, 0);
  assert.equal(school[0].activity.kind, 'waiting');
  assert.equal(school[0].activity.attention, 'child');
  assert.equal(school[0].activity.overflow, 1);
  tracker.update(snapshot(entity('job:build', 'running', 'job'))); tracker.apply(school, 1);
  assert.equal(school[0].activity.kind, 'running');
  tracker.update(snapshot(entity('job:build', 'failed', 'job'))); tracker.apply(school, 2);
  assert.equal(school[0].activity.kind, 'failed');
  assert.equal(school[0].activity.attention, 'job:build');
});

test('only observed job transitions show a bounded result and inactive agents never imply success', () => {
  const tracker = createActivityTracker(), school = whales(3);
  const old = entity('job:old', 'completed', 'job');
  tracker.update(snapshot(old, entity('agent:a'))); tracker.apply(school, 10);
  assert.equal(school.some(w => w.activity?.key === old.key), false);
  tracker.update(snapshot(old, entity('agent:a', 'idle'), entity('job:live', 'running', 'job'))); tracker.apply(school, 11);
  assert.equal(school.find(w => w.activity?.key === 'agent:a').activity.kind, 'idle');
  tracker.update(snapshot(old, entity('job:live', 'completed', 'job'))); tracker.apply(school, 12);
  assert.equal(school.find(w => w.activity?.key === 'job:live').activity.kind, 'completed');
  tracker.apply(school, 17.1);
  assert.equal(school.some(w => w.activity?.key === 'job:live'), false);
  tracker.update(snapshot(old, entity('job:live', 'completed', 'job'))); tracker.apply(school, 18);
  assert.equal(school.some(w => w.activity?.key === 'job:live'), false, 'unrelated store updates do not replay old results');
  tracker.update({ scope: 'new', entities: [entity('new:agent', 'waiting')] }); tracker.apply(school, 19);
  assert.equal(school.some(w => w.activity?.key === 'session:main'), false);
});

test('one running primary whale still surfaces completed and failed job reminders', () => {
  for (const result of ['completed', 'failed']) {
    const tracker = createActivityTracker(), school = whales(1);
    tracker.update({ scope: 'main', entities: [primary('running'), entity('job:build', 'running', 'job')] });
    tracker.apply(school, 1);
    tracker.update({ scope: 'main', entities: [primary('running'), entity('job:build', result, 'job')] });
    tracker.apply(school, 2);
    assert.equal(school[0].activity.kind, result);
    assert.equal(school[0].activity.attention, 'job:build');
    tracker.apply(school, 7.1);
    assert.equal(school[0].activity.kind, 'running');
  }
});

test('job reminder deadlines survive body reconstruction after a long-running scene', () => {
  const config = normalizeConfig({ count: 2, speed: 1 });
  const simulation = createWhaleSimulation(config, { seed: 42 }); simulation.resize(1400, 850);
  for (let i = 0; i < 12 * 60; i++) simulation.advance(1 / 60);
  simulation.setActivity(snapshot(entity('job:build', 'running', 'job')));
  simulation.setActivity(snapshot(entity('job:build', 'completed', 'job')));
  assert.ok(simulation.scene.whales.some(w => w.activity?.kind === 'completed'));
  simulation.update({ ...config, text: '重建鲸体' });
  for (let i = 0; i < 5 * 60; i++) simulation.advance(1 / 60);
  assert.ok(simulation.scene.whales.some(w => w.activity?.kind === 'completed'), 'keeps the original reminder until its deadline');
  simulation.update({ ...config, species: 'humpback', whaleSize: 1.1 });
  for (let i = 0; i < 2 * 60; i++) simulation.advance(1 / 60);
  assert.ok(simulation.scene.whales.every(w => w.activity?.kind !== 'completed'), 'body changes never extend the deadline');
  simulation.dispose();
});

test('the optional jobs bridge shares one roster, releases on session changes and follows no output', () => {
  let value = { rows: {} }, listener, subscriptions = 0, releases = 0, notified;
  const watched = [];
  const service = { state: { getSnapshot: () => value,
    subscribe(callback) { listener = callback; subscriptions++; return () => subscriptions--; } },
    watchRows(id) { watched.push(id); return () => releases++; } };
  const jobs = createJobsBridge();
  const unsubscribe = jobs.subscribe(() => { notified = jobs.getSnapshot(); });
  const detach = jobs.attach(service);
  assert.equal(subscriptions, 0, 'an unwatched jobs service has no active subscription');
  jobs.watch('main');
  jobs.watch('main'); assert.deepEqual(watched, ['main']);
  value = { rows: { main: [{ id: 'build', status: 'running' }] } }; listener();
  assert.equal(jobs.getSnapshot(), value); assert.equal(notified, value);
  jobs.watch('other'); assert.deepEqual(watched, ['main', 'other']); assert.equal(releases, 1);
  jobs.watch(null); assert.equal(releases, 2); assert.equal(subscriptions, 0);
  detach(); assert.equal(subscriptions, 0); assert.deepEqual(jobs.getSnapshot(), { rows: {}, available: false });
  unsubscribe();
});

test('an attached bridge without a roster remains unknown until explicit rows arrive or service detaches', () => {
  let value = null, listener;
  const service = { state: { getSnapshot: () => value,
    subscribe(callback) { listener = callback; return () => {}; } }, watchRows: () => () => {} };
  const jobs = createJobsBridge();
  const detach = jobs.attach(service);
  jobs.watch('main');
  const availability = () => readActivitySnapshot(fixture(), new Map(), jobs.getSnapshot()).availability.jobs;
  assert.equal(availability(), 'unknown');
  value = { rows: { main: [] } }; listener();
  assert.equal(availability(), 'available');
  value = { rows: {} }; listener();
  assert.equal(availability(), 'unknown');
  detach();
  assert.equal(availability(), 'unavailable');
});

test('state changes retain the real simulation and resume bindings after config rebuilds', () => {
  const config = normalizeConfig({ count: 3, color: 'rainbow' });
  const simulation = createWhaleSimulation(config, { seed: 42 }); simulation.resize(1400, 850);
  for (let i = 0; i < 60; i++) simulation.advance(1 / 60);
  const original = simulation.scene;
  const positions = original.whales.map(w => [w.x, w.y, w.heading, w.colorIndex]);
  simulation.setActivity(snapshot(entity('agent:a'), entity('job:build', 'running', 'job')));
  assert.equal(simulation.scene, original);
  assert.deepEqual(simulation.scene.whales.map(w => [w.x, w.y, w.heading, w.colorIndex]), positions);
  simulation.update({ ...config, text: '继续', whaleSize: 1.1 });
  assert.deepEqual(simulation.scene.whales.map(w => w.activity.key), ['session:main', 'agent:a', 'job:build']);
  assert.deepEqual(simulation.scene.whales.map(w => w.colorIndex), positions.map(p => p[3]));
  simulation.update({ ...config, activity: false });
  assert.ok(simulation.scene.whales.every(w => !w.activity));
  simulation.dispose(); simulation.setActivity(snapshot());
});

test('attention badges paint while submerged, respect clipping fade and do not mutate context state', () => {
  const draws = [], ink = { save() {}, restore() {}, fillText(...args) { draws.push({ args, alpha: this.globalAlpha }); } };
  drawActivityBadges(ink, [{ x: 200, y: 100, bodyRadius: 20, _motion: { submergence: 1 },
    activity: { kind: 'waiting', label: '需要审阅' } }], 800, 600, { opacity: 0.8, fade: () => 0.5 });
  assert.equal(draws.length, 1); assert.equal(draws[0].args[0], '! 需要审阅');
  assert.equal(draws[0].alpha, 0.4); assert.equal(draws[0].args[2], 64);
});
