import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivityAnnouncer } from '../src/activity-ui.js';

function clock() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    schedule(callback, delay) { timers.set(++id, { callback, due: now + delay }); return id; },
    cancel: key => timers.delete(key),
    advance(ms) {
      now += ms;
      for (const [key, timer] of timers) if (timer.due <= now) { timers.delete(key); timer.callback(); }
    },
    get pending() { return timers.size; },
  };
}
const entity = (event, label = `Task ${event}`) => ({ event, key: `job:${event}`, kind: 'failed', label });
const presentation = (transitions, entities = transitions, scope = 'main') => ({ enabled: true, scope, entities, transitions });

test('continuous task bursts have a fixed announcement deadline and latest names without replay', () => {
  const time = clock(), batches = [];
  const announcer = createActivityAnnouncer({ announce: value => batches.push(value),
    schedule: time.schedule, cancel: time.cancel });
  announcer.update(presentation([entity(1)]));
  for (let event = 2; event <= 6; event++) {
    time.advance(20);
    announcer.update(presentation([entity(event)]));
  }
  announcer.update(presentation([], [entity(1, 'Renamed')]));
  assert.equal(batches.filter(batch => batch.entities.length).length, 0);
  time.advance(20);
  const spoken = batches.filter(batch => batch.entities.length);
  assert.equal(spoken.length, 1);
  assert.deepEqual(spoken[0].entities.map(row => row.label), ['Renamed', 'Task 2', 'Task 3', 'Task 4', 'Task 5', 'Task 6']);
  announcer.update(presentation([entity(6)])); time.advance(120);
  assert.equal(batches.filter(batch => batch.entities.length).length, 1);
  announcer.dispose();
});

test('scope changes, off and disposal release pending announcement timers', () => {
  for (const action of ['scope', 'off', 'dispose']) {
    const time = clock(), batches = [];
    const announcer = createActivityAnnouncer({ announce: value => batches.push(value),
      schedule: time.schedule, cancel: time.cancel });
    announcer.update(presentation([entity(1)]));
    assert.equal(time.pending, 1);
    if (action === 'scope') announcer.update(presentation([], [], 'other'));
    if (action === 'off') announcer.update({ enabled: false, scope: null });
    if (action === 'dispose') announcer.dispose();
    assert.equal(time.pending, 0);
    time.advance(500);
    assert.equal(batches.some(batch => batch.entities.length), false);
  }
});
