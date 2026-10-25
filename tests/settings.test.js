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
  const advanced = all.find(node => node.type === 'details');
  assert.ok(advanced);
  const foldedFields = nodes(advanced).filter(node => node.props['data-aw-field']).map(node => node.props['data-aw-field']);
  const mainFields = ['enabled', 'text', 'activity'];
  assert.deepEqual(foldedFields.sort(), Object.entries(FIELDS)
    .filter(([key, field]) => !field.hidden && !mainFields.includes(key)).map(([key]) => key).sort());
  for (const key of mainFields) assert.ok(fieldRow(root, key));
  const children = root.props.children;
  assert.ok(children.findIndex(node => node?.type?.name === 'LivePreview') < children.findIndex(node => node?.props?.className === 'aw-options'));
  const options = children.find(node => node?.props?.className === 'aw-options');
  assert.equal(options.props.tabIndex, 0);
  assert.equal(nodes(advanced).some(n => n.props.id === 'aw-test-preset'), false, 'scene picker stays outside advanced');
  assert.ok(nodes(advanced).some(n => n.type === 'summary'));
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

test('choosing scenes previews a protected draft, derives custom after an owned edit, saves and reloads', async () => {
  const ui = settingsForm({ value: { text: '保留鲸', count: 7, speed: 1.2, glass: false, composerAvoid: true } });
  const preset = root => nodes(root).find(node => node.type === 'select' && node.props.id === 'aw-test-preset');
  let root = ui.render();
  assert.ok(preset(root), 'scene picker is a native select');
  assert.equal(preset(root).props.value, 'custom');
  assert.deepEqual(nodes(preset(root)).filter(n => n.type === 'option').map(n => text(n)), ['自定义', '默认', '雨天', '极简', '夜航']);
  preset(root).props.onChange({ target: { value: 'rainy' } });
  root = ui.render();
  assert.equal(preset(root).props.value, 'rainy');
  assert.equal(input(root, 'text').props.value, '保留鲸');
  assert.equal(switchOf(root, 'composerAvoid').props['aria-checked'], true);
  assert.equal(ui.form.getSnapshot().value.count, 7);
  assert.equal(ui.writes.length, 0);
  const preview = nodes(root).find(n => n.type?.name === 'LivePreview');
  assert.equal(preview.props.draft.rain, true);
  assert.equal(preview.props.draft.speed, 0.55);
  input(root, 'text').props.onChange({ target: { value: '新文字' } });
  root = ui.render();
  assert.equal(preset(root).props.value, 'rainy');
  input(root, 'speed').props.onChange({ target: { value: '0.8' } });
  root = ui.render();
  assert.equal(preset(root).props.value, 'custom');
  await root.props.onSubmit({ preventDefault() {} });
  root = ui.render();
  assert.equal(ui.form.getSnapshot().value.speed, 0.8);
  assert.equal(ui.form.getSnapshot().value.text, '新文字');
  assert.equal(ui.form.getSnapshot().value.composerAvoid, true);
  assert.ok(ui.writes.flat().every(op => !['preset', 'composerAvoid', 'glass'].includes(op.path[0])));
  assert.equal(nodes(root).find(n => n.props.type === 'submit').props.disabled, true);
  preset(root).props.onChange({ target: { value: 'night' } });
  root = ui.render();
  nodes(root).find(n => n.type === 'button' && text(n) === '重新载入已保存值').props.onClick();
  root = ui.render();
  assert.equal(preset(root).props.value, 'custom');
  assert.equal(input(root, 'speed').props.value, 0.8);
  assert.equal(ui.writes.length, 1);
});

test('scene save errors preserve the whole visible draft and do not automatically retry', async () => {
  for (const outcome of ['conflict', 'failed']) {
    const ui = settingsForm({ value: { count: 7, text: '保留鲸', glass: false, composerAvoid: true } });
    let root = ui.render();
    input(root, 'text').props.onChange({ target: { value: '新鲸' } });
    root = ui.render();
    nodes(root).find(n => n.type === 'select' && n.props.id === 'aw-test-preset')
      .props.onChange({ target: { value: 'rainy' } });
    root = ui.render();
    const draft = nodes(root).find(n => n.type?.name === 'LivePreview').props.draft;
    let attempts = 0;
    ui.form.mutate = async () => {
      attempts++;
      if (outcome === 'failed') throw new Error('offline');
      return false;
    };
    await root.props.onSubmit({ preventDefault() {} });
    root = ui.render();
    assert.equal(attempts, 1);
    assert.deepEqual(nodes(root).find(n => n.type?.name === 'LivePreview').props.draft, draft);
    assert.equal(input(root, 'text').props.value, '新鲸');
    assert.equal(ui.form.getSnapshot().value.count, 7);
    assert.ok(nodes(root).some(n => n.props.role === 'alert' && text(n).includes('修改已保留')));
    assert.equal(nodes(root).find(n => n.props.type === 'submit').props.disabled, false);
    nodes(root).find(n => n.type === 'button' && text(n) === '重新载入已保存值').props.onClick();
    root = ui.render();
    assert.equal(input(root, 'count').props.value, 7);
    assert.equal(input(root, 'text').props.value, '保留鲸');
    assert.equal(attempts, 1);
  }
});

test('scene picker and all draft controls remain disabled until explicit save settles', async () => {
  const ui = settingsForm();
  let root = ui.render();
  const picker = nodes(root).find(n => n.type === 'select' && n.props.id === 'aw-test-preset');
  assert.ok(nodes(root).some(n => n.type === 'label' && n.props.htmlFor === picker.props.id));
  assert.ok(nodes(root).some(n => n.props.id === picker.props['aria-describedby'] && text(n).includes('仅改草稿')));
  picker.props.onChange({ target: { value: 'minimal' } });
  root = ui.render();
  let finish;
  ui.form.mutate = () => new Promise(resolve => { finish = resolve; });
  const saving = root.props.onSubmit({ preventDefault() {} });
  root = ui.render();
  assert.equal(nodes(root).find(n => n.type === 'select' && n.props.id === 'aw-test-preset').props.disabled, true);
  for (const row of nodes(root).filter(n => n.props['data-aw-field'])) {
    assert.ok(nodes(row).filter(n => ['button', 'input', 'select'].includes(n.type)).every(n => n.props.disabled));
  }
  finish(false);
  await saving;
  root = ui.render();
  assert.equal(nodes(root).find(n => n.type === 'select' && n.props.id === 'aw-test-preset').props.disabled, false);
  assert.equal(input(root, 'count').props.value, 1);
});

test('read-only settings disable all editable controls and English labels translate the new choices', () => {
  const root = settingsForm({ writable: false, language: 'en' }).render();
  for (const row of nodes(root).filter(n => n.props['data-aw-field'])) {
    for (const n of nodes(row).filter(n => ['button', 'input', 'select'].includes(n.type))) assert.equal(n.props.disabled, true);
  }
  assert.equal(choice(root, 'readingEffect', 'Off').props.disabled, true);
  const preset = nodes(root).find(n => n.type === 'select' && n.props.id === 'aw-test-preset');
  assert.equal(preset.props.disabled, true);
  assert.deepEqual(nodes(preset).filter(n => n.type === 'option').map(n => text(n)), ['Custom', 'Default', 'Rainy', 'Minimal', 'Night voyage']);
  assert.ok(nodes(root).some(n => n.type === 'legend' && text(n) === 'Appearance & text'));
});
