import { registerWhales } from '../../src/settings.js';
import zh from '../../locale/zh.json' with { type: 'json' };
import en from '../../locale/en.json' with { type: 'json' };

// Host hook adapter for form logic only. It does not mount Canvas effects and
// cannot prove DOM layout, real pointer input or font/visual quality.
export function settingsForm({ value = {}, writable = true, language = 'zh' } = {}) {
  let snapshot = { status: 'ready', revision: 1, writable, value };
  const hooks = [], writes = [], slots = new Map();
  let cursor = 0;
  const form = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    async mutate(ops, revision) {
      assertRevision(revision);
      writes.push(ops);
      snapshot = { ...snapshot, revision: revision + 1, value: { ...snapshot.value } };
      for (const op of ops) snapshot.value[op.path[0]] = op.value;
      return true;
    },
  };
  function assertRevision(revision) { if (revision !== snapshot.revision) throw new Error('Unexpected form revision'); }
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useEffect() {}, useId: () => 'aw-test',
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const dictionary = (language === 'en' ? en : zh).ui;
  registerWhales({ configForms: { get: () => form }, effect: callback => callback(),
    locale: { register() {}, bind: () => key => dictionary[key] ?? key,
      getSnapshot: () => language, subscribe: () => () => {} },
    slots: { inject: (_name, callback) => callback(), register: (slot, view) => slots.set(slot.name, view) },
  }, React, { en: en.ui, zh: zh.ui });
  return { writes, form, render() { cursor = 0; return slots.get('plugins.bundle.config')(); } };
}

export function nodes(root) {
  if (!root || typeof root !== 'object') return [];
  return [root, ...(root.props.children || []).flatMap(nodes)];
}
export function text(root) {
  if (root == null || typeof root === 'boolean') return '';
  if (typeof root !== 'object') return String(root);
  return (root.props.children || []).map(text).join('');
}
export const fieldRow = (root, key) => nodes(root).find(node => node.props['data-aw-field'] === key);
