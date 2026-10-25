import test from 'node:test';
import assert from 'node:assert/strict';
import { readActivitySnapshot, drawActivityBadges } from '../src/activity.js';

test('unseated idle tasks still have an equivalent visible count without a success symbol', () => {
  const calls = [];
  const ink = { save() {}, restore() {}, fillText: value => calls.push(value) };
  drawActivityBadges(ink, [{ x: 200, y: 100, bodyRadius: 20,
    activity: { kind: 'idle', label: 'Session', overflow: 2 } }], 800, 600);
  assert.deepEqual(calls, ['+2']);
});
import { createWhaleSimulation } from '../src/simulation.js';
import { normalizeConfig } from '../src/model.js';

const list = { byId: {
  main: { id: 'main', running: true, retainedBy: { mainView: 1 } },
  child: { id: 'child', parentId: 'main' },
  unrelated: { id: 'unrelated', running: true },
} };

test('missing sources preserve known running facts without inventing idle or another current session', () => {
  const snapshot = readActivitySnapshot(list, undefined, undefined);
  assert.deepEqual(snapshot.entities.map(e => [e.key, e.kind]), [
    ['session:main', 'running'], ['session:child', 'unavailable'],
  ]);
  assert.equal(snapshot.availability.liveStatus, 'unavailable');
  assert.equal(snapshot.availability.jobs, 'unavailable');
  assert.equal(snapshot.entities[0].waitingAvailable, false);
  const emptyJobs = readActivitySnapshot(list, new Map([['main', { running: false }]]), { rows: { main: [] } });
  assert.equal(emptyJobs.entities[0].kind, 'idle');
  assert.equal(emptyJobs.availability.jobs, 'available');
  const unknown = readActivitySnapshot({ byId: { unrelated: list.byId.unrelated } });
  assert.equal(unknown.scope, null);
  assert.deepEqual(unknown.entities, []);
});

test('attached job rosters with absent session keys are unknown while explicit empty and detached remain distinct', () => {
  const statuses = new Map([['main', { running: true, pendingInteraction: { kind: 'question' } }]]);
  const absent = readActivitySnapshot(list, statuses, { rows: {} });
  assert.equal(absent.availability.jobs, 'unknown');
  assert.equal(absent.entities[0].kind, 'waiting');
  assert.equal(absent.availability.liveStatus, 'available');
  assert.equal(readActivitySnapshot(list, statuses, { rows: { main: [] } }).availability.jobs, 'available');
  assert.equal(readActivitySnapshot(list, statuses, { rows: {}, available: false }).availability.jobs, 'unavailable');
  for (const rows of [{ other: [] }, { main: null }, { main: {} }]) {
    assert.equal(readActivitySnapshot(list, statuses, { rows }).availability.jobs, 'unknown');
  }
});

const session = { key: 'session:main', type: 'session', primary: true, label: 'Main', kind: 'idle' };
const job = (kind, label = 'Build') => ({ key: 'job:build', type: 'job', label, kind });
const snapshot = (...entities) => ({ scope: 'main', entities: [session, ...entities] });

test('stopped jobs remain queryable without results and unavailable jobs cannot fabricate a transition', () => {
  const changes = [];
  const simulation = createWhaleSimulation(normalizeConfig({ count: 1 }), { seed: 42,
    onActivityChange: value => changes.push(value) });
  simulation.setActivity(readActivitySnapshot(list, new Map(), { rows: { main: [{ id: 'build', status: 'running' }] } }));
  simulation.setActivity(readActivitySnapshot(list, new Map(), { rows: { main: [{ id: 'build', status: 'killed' }] } }));
  assert.equal(changes.at(-1).entities.find(e => e.key === 'job:build')?.kind, 'idle');
  assert.deepEqual(changes.at(-1).transitions, []);
  simulation.setActivity(readActivitySnapshot(list, new Map(), { rows: { main: [{ id: 'build', status: 'running' }] } }));
  simulation.setActivity(readActivitySnapshot(list, new Map(), { available: false, rows: { main: [{ id: 'build', status: 'completed' }] } }));
  assert.equal(changes.at(-1).entities.some(e => e.key === 'job:build'), false);
  assert.deepEqual(changes.at(-1).transitions, []);
  simulation.dispose();
});

test('the simulation publishes one immutable semantic presentation for badges, overflow and transitions', () => {
  const changes = [];
  const simulation = createWhaleSimulation(normalizeConfig({ count: 1 }), { seed: 42,
    onActivityChange: value => changes.push(value) });
  simulation.resize(1000, 700);
  simulation.setActivity(snapshot(job('completed', 'History')));
  assert.equal(changes.at(-1)?.entities.some(e => e.label === 'History'), false);
  assert.deepEqual(changes.at(-1)?.transitions, []);
  simulation.setActivity(snapshot(job('running')));
  simulation.setActivity(snapshot(job('completed')));
  const result = changes.at(-1);
  assert.equal(result.entities.length, 2);
  assert.equal(result.overflow.length, 1);
  assert.equal(result.seats[0].kind, simulation.scene.whales[0].activity.kind);
  assert.equal(result.seats[0].kind, 'completed');
  assert.deepEqual(result.transitions.map(e => [e.key, e.kind]), [['job:build', 'completed']]);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.entities) && Object.isFrozen(result.entities[0]));
  const count = changes.length;
  for (let i = 0; i < 300; i++) simulation.advance(1 / 60);
  assert.equal(changes.length, count, 'movement never notifies React');
  simulation.setActivity(snapshot(job('completed', 'Renamed')));
  assert.equal(changes.at(-1).entities.find(e => e.type === 'job').label, 'Renamed');
  assert.deepEqual(changes.at(-1).transitions, []);
  for (let i = 0; i < 62; i++) simulation.advance(1 / 60);
  assert.ok(changes.at(-1).entities.every(e => e.type !== 'job'), 'six simulation seconds expire both representations');
  simulation.dispose();
});
