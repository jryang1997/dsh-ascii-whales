import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigEditor, changeConfigDraft } from '../src/config-editor.js';
import { DEFAULTS, normalizeConfig } from '../src/model.js';

test('scene failures and conflicts preserve the entire draft and require explicit reload to adopt external values', async () => {
  for (const outcome of ['conflict', 'failed']) {
    const form = memoryForm({ ...DEFAULTS, text: '旧鲸', glass: false, composerAvoid: true });
    const editor = createConfigEditor(form.getSnapshot()).change('text', '待保存鲸').change('pauseOnScroll', true)
      .change('futurePreference', 'keep').applyPreset('night');
    form.replace({ revision: 9, value: { ...DEFAULTS, text: '外部鲸', count: 6 } });
    const result = await editor.save(outcome === 'failed' ? { ...form, mutate: async () => { throw new Error('offline'); } } : form);
    assert.equal(result.notice, outcome);
    assert.equal(result.editor, editor);
    assert.equal(result.editor.dirty, true);
    assert.equal(result.editor.draft.futurePreference, 'keep');
    assert.equal(result.editor.draft.text, '待保存鲸');
    assert.equal(result.editor.draft.color, 'indigo');
    assert.equal(result.editor.draft.pauseOnScroll, true);
    assert.equal(result.editor.draft.composerAvoid, true);
    assert.equal(form.getSnapshot().value.text, '外部鲸');
    assert.equal(form.getSnapshot().revision, 9);
    const reload = createConfigEditor(form.getSnapshot());
    assert.equal(reload.draft.text, '外部鲸');
    assert.equal(reload.draft.count, 6);
    assert.equal(reload.dirty, false);
  }
});

test('old configurations keep their scene values and migration while default scene differs from reset all', () => {
  const editor = createConfigEditor({ value: { count: 7, speed: 1.25, opacity: 0.72, text: '旧鲸',
    glass: false, composerAvoid: true, pauseOnScroll: true, color: 'azure', species: 'fin' }, revision: 3 });
  assert.equal(editor.draft.count, 7);
  assert.equal(editor.draft.speed, 1.25);
  assert.equal(editor.draft.opacity, 0.72);
  assert.equal(editor.draft.color, 'azure');
  assert.equal(editor.dirty, false);
  const scene = editor.applyPreset('default');
  assert.equal(scene.draft.count, 3);
  assert.equal(scene.draft.text, '旧鲸');
  assert.equal(scene.draft.species, 'fin');
  assert.equal(scene.draft.pauseOnScroll, true);
  assert.equal(scene.draft.composerAvoid, true);
  assert.equal(scene.draft.glass, false);
  assert.deepEqual(editor.reset().draft, DEFAULTS);
  assert.notDeepEqual(scene.draft, editor.reset().draft);
  const legacy = createConfigEditor({ value: { composerGlass: true, count: 5 }, revision: 1 });
  assert.equal(legacy.applyPreset('minimal').draft.glass, true);
  assert.equal(legacy.applyPreset('minimal').draft.composerGlass, false);
});

function memoryForm(value = {}, revision = 1) {
  let snapshot = { status: 'ready', writable: true, value, revision };
  const writes = [];
  return {
    writes,
    getSnapshot: () => snapshot,
    replace(next) { snapshot = { ...snapshot, ...next }; },
    async mutate(ops, expectedRevision) {
      writes.push({ ops, revision: expectedRevision });
      if (expectedRevision !== snapshot.revision) return false;
      const value = { ...snapshot.value };
      for (const operation of ops) value[operation.path[0]] = operation.value;
      snapshot = { ...snapshot, value, revision: snapshot.revision + 1 };
      return true;
    },
  };
}

test('choosing a scene updates only the draft, saves one difference set and adopts the saved revision', async () => {
  const form = memoryForm({ ...DEFAULTS, text: '我的鲸', glass: false, composerAvoid: true });
  const draft = createConfigEditor(form.getSnapshot()).change('text', '新鲸').applyPreset('rainy');
  assert.equal(draft.draft.text, '新鲸');
  assert.equal(draft.draft.composerAvoid, true);
  assert.equal(draft.draft.glass, false);
  assert.equal(draft.draft.rain, true);
  assert.equal(draft.dirty, true);
  assert.equal(form.getSnapshot().value.rain, false);
  assert.equal(form.writes.length, 0);
  const result = await draft.save(form);
  assert.equal(result.notice, 'saved');
  assert.equal(result.editor.dirty, false);
  assert.deepEqual(form.writes, [{ revision: 1, ops: [
    { op: 'set', path: ['text'], value: '新鲸' },
    { op: 'set', path: ['speed'], value: 0.55 },
    { op: 'set', path: ['opacity'], value: 0.55 },
    { op: 'set', path: ['spout'], value: false },
    { op: 'set', path: ['rain'], value: true },
    { op: 'set', path: ['rainIntensity'], value: 0.35 },
  ] }]);
  await result.editor.applyPreset('minimal').save(form);
  assert.equal(form.writes[1].revision, 2);
});

test('editing both entry points uses last-enabled-wins while legacy loading keeps glass priority', () => {
  const saved = { ...DEFAULTS, glass: true, composerAvoid: true };
  assert.equal(normalizeConfig(saved).composerAvoid, false);
  const editor = createConfigEditor({ value: saved, revision: 1 }).change('composerAvoid', true);
  const preview = changeConfigDraft(normalizeConfig(saved), 'composerAvoid', true);
  assert.deepEqual(editor.draft, preview);
  assert.equal(editor.draft.glass, false);
  assert.equal(editor.change('glass', true).draft.composerAvoid, false);
});

test('reading effect choices preview in the draft and save independently of content glass', async () => {
  assert.equal(normalizeConfig({ count: 5 }).readingEffect, 'frost', 'old configurations receive the new frosted default');
  assert.equal(normalizeConfig({ readingEffect: 'invalid' }).readingEffect, 'frost');
  assert.equal(normalizeConfig({ readingEffect: 'none' }).readingEffect, 'none');
  for (const mode of ['none', 'glow', 'blur', 'frost']) {
    const form = memoryForm({ ...DEFAULTS, glass: false, readingEffect: 'glow' });
    const editor = createConfigEditor(form.getSnapshot()).change('readingEffect', mode);
    assert.equal(editor.draft.readingEffect, mode);
    assert.equal(form.getSnapshot().value.readingEffect, 'glow', 'a draft does not change the running background');
    assert.equal(editor.draft.glass, false);
    await editor.save(form);
    assert.equal(form.getSnapshot().value.readingEffect, mode);
    assert.equal(form.getSnapshot().value.glass, false);
  }
});

test('save submits only changed normalized values and adopts the resulting revision', async () => {
  const form = memoryForm({ ...DEFAULTS });
  const initial = createConfigEditor(form.getSnapshot());
  assert.equal(initial.dirty, false);
  const { editor, notice } = await initial.change('count', '4').save(form);
  assert.equal(notice, 'saved');
  assert.equal(editor.dirty, false);
  assert.equal(editor.draft.count, 4);
  assert.deepEqual(form.writes, [{ ops: [{ op: 'set', path: ['count'], value: 4 }], revision: 1 }]);
  await editor.change('speed', 1).save(form);
  assert.equal(form.writes[1].revision, 2);
});

test('invalid numeric drafts never reach persistence and unchanged drafts produce no writes', async () => {
  const form = memoryForm(DEFAULTS), editor = createConfigEditor(form.getSnapshot());
  for (const value of ['', NaN, Infinity, 0, 9, 1.2]) {
    const invalid = editor.change('count', value);
    const result = await invalid.save(form);
    assert.equal(result.notice, 'invalid');
    assert.equal(result.editor, invalid);
  }
  assert.equal((await editor.save(form)).notice, '');
  assert.equal((await editor.change('count', String(DEFAULTS.count)).save(form)).notice, '');
  assert.equal(form.writes.length, 0);
});

test('a revision conflict preserves the original draft until the user explicitly reloads', async () => {
  const form = memoryForm(DEFAULTS), editor = createConfigEditor(form.getSnapshot()).change('text', '我的鲸');
  form.replace({ revision: 2, value: { ...DEFAULTS, speed: 1.5 } });
  const result = await editor.save(form);
  assert.equal(result.notice, 'conflict');
  assert.equal(result.editor, editor);
  assert.equal(result.editor.draft.text, '我的鲸');
  assert.equal(result.editor.dirty, true);
  assert.equal(createConfigEditor(form.getSnapshot()).draft.speed, 1.5);
});

test('failed persistence retains the draft and reset remains an unsaved change', async () => {
  const form = memoryForm({ ...DEFAULTS, count: 7 });
  const editor = createConfigEditor(form.getSnapshot()).change('text', '鲸');
  const result = await editor.save({ ...form, mutate: async () => { throw new Error('offline'); } });
  assert.equal(result.notice, 'failed');
  assert.equal(result.editor, editor);
  const reset = editor.reset();
  assert.deepEqual(reset.draft, DEFAULTS);
  assert.equal(reset.dirty, true);
  assert.equal(form.getSnapshot().value.count, 7);
});
