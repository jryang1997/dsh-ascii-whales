import test from 'node:test';
import assert from 'node:assert/strict';
import { readActivitySnapshot, createActivityTracker } from '../src/activity.js';
import { createDemoScenario } from '../scripts/status-demo-scenario.mjs';

test('the simulated demo shows running, waiting and distinct observed job results without declaring idle successful', () => {
  const scenario = createDemoScenario('en');
  let presentation;
  const tracker = createActivityTracker({ onChange: value => { presentation = value; } });
  const whales = [{}, {}, {}];
  const show = stage => {
    const state = scenario.advance(stage);
    tracker.update(readActivitySnapshot(state.sessions, state.statuses, state.jobs));
    tracker.apply(whales, 0, true);
    return presentation;
  };
  assert.ok(show('running').entities.every(row => row.kind === 'running'));
  assert.equal(show('waiting').entities.find(row => row.primary).kind, 'waiting');
  const completed = show('completed').entities.find(row => row.kind === 'completed');
  assert.equal(completed.label, 'Build demo');
  const final = show('failed');
  const failed = final.entities.find(row => row.kind === 'failed');
  assert.equal(failed.label, 'Check demo');
  assert.notEqual(completed.key, failed.key);
  assert.equal(final.entities.find(row => row.primary).kind, 'idle');
  assert.throws(() => createDemoScenario('en').advance('completed'), /order/i);
});
