import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, DEFAULTS } from '../src/model.js';
import { createConfigEditor } from '../src/config-editor.js';
import { PRESETS, applyPreset } from '../src/presets.js';
import { settingsForm, fieldRow, nodes, text } from './helpers/settings-form-harness.js';

test('resource mode defaults independently and saves only the chosen draft difference', async () => {
  assert.equal(normalizeConfig({ speed: 0.3 }).resourceMode, 'standard');
  assert.equal(normalizeConfig({ resourceMode: 'invalid' }).resourceMode, 'standard');
  for (const language of ['zh', 'en']) {
    const ui = settingsForm({ value: { ...DEFAULTS, legendSeen: true }, language });
    let root = ui.render();
    const row = fieldRow(root, 'resourceMode');
    assert.ok(row, 'main settings expose the resource selector');
    assert.ok(!nodes(root).find(n => n.type === 'details' && n.props.className === 'aw-advanced').props.children.flatMap(nodes).includes(row));
    const buttons = nodes(row).filter(n => n.type === 'button');
    assert.equal(buttons.length, 2);
    assert.match(text(row), language === 'en' ? /Economy/ : /省资源/);
    buttons[1].props.onClick();
    root = ui.render();
    assert.equal(ui.form.getSnapshot().value.resourceMode, 'standard');
    await root.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(ui.writes, [[{ op: 'set', path: ['resourceMode'], value: 'economy' }]]);
    assert.equal(ui.form.getSnapshot().value.speed, 0.65);
    assert.equal(ui.form.getSnapshot().value.legendSeen, true);
  }
  const editor = createConfigEditor({ status: 'ready', revision: 1, writable: true,
    value: { ...DEFAULTS, resourceMode: 'economy', legendSeen: true } });
  for (const id of Object.keys(PRESETS)) {
    assert.equal(applyPreset(editor.draft, id).resourceMode, 'economy');
    assert.equal(editor.applyPreset(id).draft.resourceMode, 'economy');
  }
  assert.equal(editor.reset().draft.resourceMode, 'standard');
  const changed = editor.change('resourceMode', 'standard');
  for (const mutate of [async () => false, async () => { throw new Error('offline'); }]) {
    const result = await changed.save({ mutate });
    assert.equal(result.editor.draft.resourceMode, 'standard');
    assert.equal(result.editor.dirty, true);
  }
});
