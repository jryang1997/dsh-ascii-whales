import test from 'node:test';
import assert from 'node:assert/strict';
import { Config } from '../index.js';
import { createLegendPreference } from '../src/activity-ui.js';
import { FIELDS, DEFAULTS, normalizeConfig } from '../src/model.js';

test('host schema persists legend acknowledgment independently of visual configuration', () => {
  assert.equal(Config({}).legendSeen.get(), false);
  assert.equal(Config({ legendSeen: true }).legendSeen.get(), true);
  assert.equal(Config.dict.legendSeen.meta.hidden, true);
  assert.equal(Config.dict.legendSeen.meta.volatile, true);
  assert.equal('legendSeen' in FIELDS, false);
  assert.equal('legendSeen' in DEFAULTS, false);
  assert.equal('legendSeen' in normalizeConfig({ legendSeen: true }), false);
});

function preferenceForm({ writable = true, outcome = true, nativeSet = false } = {}) {
  let snapshot = { status: 'ready', writable, revision: 7, value: { count: 6, text: 'Saved' } };
  const writes = [];
  const form = {
    getSnapshot: () => snapshot,
    async mutate(ops, revision) {
      writes.push({ ops, revision });
      if (outcome instanceof Error) throw outcome;
      if (!outcome || revision !== snapshot.revision) return false;
      snapshot = { ...snapshot, revision: revision + 1, value: { ...snapshot.value } };
      for (const op of ops) snapshot.value[op.path[0]] = op.value;
      return true;
    },
  };
  if (nativeSet) form.set = async (key, value) => form.mutate([{ op: 'set', path: [key], value }], snapshot.revision);
  return { form, writes };
}

test('explicit legend dismissal writes only the host preference and survives a new mount', async () => {
  for (const nativeSet of [false, true]) {
    const { form, writes } = preferenceForm({ nativeSet });
    const preference = createLegendPreference(form);
    assert.equal(preference.seen, false);
    assert.equal(await preference.dismiss(), true);
    assert.deepEqual(writes, [{ revision: 7, ops: [{ op: 'set', path: ['legendSeen'], value: true }] }]);
    assert.equal(form.getSnapshot().value.count, 6);
    assert.equal(form.getSnapshot().value.text, 'Saved');
    assert.equal(createLegendPreference(form).seen, true);
  }
});

test('failed, read-only and unavailable preference writes dismiss only this mount and never throw', async () => {
  const cases = [preferenceForm({ writable: false }), preferenceForm({ outcome: false }),
    preferenceForm({ outcome: new Error('offline') }), preferenceForm({ nativeSet: true, outcome: new Error('offline') }),
    { form: { getSnapshot: () => ({ status: 'loading' }) }, writes: [] },
    { form: { getSnapshot() { throw new Error('unavailable'); } }, writes: [] }];
  for (const { form, writes } of cases) {
    const preference = createLegendPreference(form);
    assert.equal(preference.seen, false);
    assert.equal(await preference.dismiss(), false);
    assert.equal(preference.seen, true);
    assert.equal(createLegendPreference(form).seen, false, 'a new mount retries acknowledgment');
    assert.ok(writes.length <= 1);
  }
});
