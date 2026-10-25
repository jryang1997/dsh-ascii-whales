import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS } from '../src/model.js';
import { settingsForm, nodes, text, fieldRow } from './helpers/settings-form-harness.js';

const control = (tree, key, predicate) => nodes(fieldRow(tree, key)).find(predicate);
const input = (tree, key) => control(tree, key, node => node.type === 'input' || node.type === 'select');
const choice = (tree, key, label) => control(tree, key, node => node.type === 'button' && text(node) === label);
const switchOf = (tree, key) => control(tree, key, node => node.props.role === 'switch');

test('the scroll pause sits in the advanced settings, off by default, and saves on its own', async () => {
  const ui = settingsForm();
  let root = ui.render();
  const advanced = nodes(root).find(node => node.type === 'details');
  assert.ok(nodes(advanced).some(node => node.props['data-aw-field'] === 'leftInset'));
  assert.ok(nodes(advanced).some(node => node.props['data-aw-field'] === 'pauseOnScroll'),
    'the rendering pause belongs under 高级设置, not a main group');
  assert.equal(switchOf(root, 'pauseOnScroll').props['aria-checked'], false, 'default off: scrolling keeps rendering');
  const groups = nodes(root).find(node => node.props.className === 'aw-groups');
  assert.equal(nodes(groups).some(node => node.props['data-aw-field'] === 'pauseOnScroll'), false);

  switchOf(root, 'pauseOnScroll').props.onClick();
  root = ui.render();
  assert.equal(switchOf(root, 'pauseOnScroll').props['aria-checked'], true);
  assert.equal(nodes(root).find(node => node.type?.name === 'LivePreview').props.draft.pauseOnScroll, true);
  assert.equal(ui.form.getSnapshot().value.pauseOnScroll, undefined, 'a draft does not touch the saved background');
  await root.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(ui.writes, [[{ op: 'set', path: ['pauseOnScroll'], value: true }]]);
});

test('settings put the live preview above grouped fields and expose every visible field exactly once', () => {
  const root = settingsForm().render(), all = nodes(root);
  const fields = all.filter(node => node.props['data-aw-field']).map(node => node.props['data-aw-field']);
  assert.deepEqual([...fields].sort(), Object.entries(FIELDS).filter(([, field]) => !field.hidden).map(([key]) => key).sort());
  assert.equal(new Set(fields).size, fields.length);
  assert.equal(all.filter(node => node.type === 'fieldset').length, 4);
  const children = root.props.children;
  assert.ok(children.findIndex(node => node?.type?.name === 'LivePreview') < children.findIndex(node => node?.props?.className === 'aw-options'));
  const options = children.find(node => node?.props?.className === 'aw-options');
  assert.equal(options.props.tabIndex, 0);
  assert.equal(nodes(options).filter(node => node.type === 'fieldset').length, 4);
  assert.equal(nodes(options).some(node => node.type?.name === 'LivePreview'), false);
  assert.equal(nodes(options).some(node => node.type === 'footer'), false);
  assert.equal(all.find(node => node.type === 'details').props.open, undefined, 'advanced settings start folded');
});

test('only continuous numeric choices use ranges; booleans and enum choices retain native keyboard semantics', () => {
  const root = settingsForm().render();
  for (const [key, field] of Object.entries(FIELDS)) {
    if (field.hidden) continue;
    const row = fieldRow(root, key), ranges = nodes(row).filter(n => n.type === 'input' && n.props.type === 'range');
    assert.equal(ranges.length, field.kind === 'number' && key !== 'leftInset' ? 1 : 0, key);
    if (field.kind === 'boolean') assert.equal(nodes(row).filter(n => n.props.role === 'switch').length, 1, key);
    if (field.kind === 'enum' && !['species', 'color'].includes(key)) {
      const buttons = nodes(row).filter(n => n.type === 'button');
      assert.equal(buttons.length, field.values.length);
      assert.ok(buttons.every(n => n.props.type === 'button' && n.props.tabIndex !== -1));
    }
  }
  assert.equal(input(root, 'leftInset').props.type, 'number');
  assert.equal(input(root, 'species').type, 'select');
  assert.equal(input(root, 'opacity').props['aria-valuetext'], '60%');
});

test('clicking Off previews a draft and saves only the changed setting without toggling card glass', async () => {
  const ui = settingsForm({ value: { readingEffect: 'frost', glass: true } });
  choice(ui.render(), 'readingEffect', '关闭').props.onClick();
  let root = ui.render();
  assert.equal(choice(root, 'readingEffect', '关闭').props['aria-pressed'], true);
  const preview = nodes(root).find(node => node.type?.name === 'LivePreview');
  assert.equal(preview.props.draft.readingEffect, 'none');
  assert.equal(ui.form.getSnapshot().value.readingEffect, 'frost');
  assert.equal(control(root, 'glass', n => n.props.role === 'switch').props['aria-checked'], true);
  await root.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(ui.writes, [[{ op: 'set', path: ['readingEffect'], value: 'none' }]]);
  root = ui.render();
  assert.equal(nodes(root).find(n => n.props.type === 'submit').props.disabled, true);
});

test('dependency controls update immediately without losing the saved custom text', () => {
  const ui = settingsForm({ value: { text: '我的鲸', rain: false, glass: false, readingEffect: 'none' } });
  let root = ui.render();
  assert.equal(input(root, 'rainIntensity').props.disabled, true);
  control(root, 'rain', n => n.props.role === 'switch').props.onClick();
  root = ui.render();
  assert.equal(input(root, 'rainIntensity').props.disabled, false);
  assert.equal(input(root, 'glassStrength').props.disabled, true);
  choice(root, 'readingEffect', '毛玻璃').props.onClick();
  root = ui.render();
  assert.equal(input(root, 'glassStrength').props.disabled, false, 'text glass can use strength with card glass off');
  choice(root, 'fillMode', 'ASCII 字符').props.onClick();
  root = ui.render();
  assert.equal(input(root, 'text').props.disabled, true);
  assert.equal(input(root, 'text').props.value, '我的鲸');
  choice(root, 'fillMode', '自定义文字').props.onClick();
  assert.equal(input(ui.render(), 'text').props.value, '我的鲸');
});

test('read-only settings disable all editable controls and English labels translate the new choices', () => {
  const root = settingsForm({ writable: false, language: 'en' }).render();
  for (const row of nodes(root).filter(n => n.props['data-aw-field'])) {
    for (const n of nodes(row).filter(n => ['button', 'input', 'select'].includes(n.type))) assert.equal(n.props.disabled, true);
  }
  assert.equal(choice(root, 'readingEffect', 'Off').props.disabled, true);
  assert.ok(nodes(root).some(n => n.type === 'legend' && text(n) === 'Appearance & text'));
});
