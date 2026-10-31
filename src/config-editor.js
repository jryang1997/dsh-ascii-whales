import { FIELDS, DEFAULTS, normalizeConfig } from './model.js';
import { applyPreset } from './presets.js';

const exclusiveConfig = { glass: 'composerAvoid', composerAvoid: 'glass' };

/** Editing uses last-enabled-wins; loading saved data keeps normalization policy. */
export function changeConfigDraft(draft, key, value) {
  const next = { ...draft, [key]: value };
  const opposite = exclusiveConfig[key];
  if (opposite && value === true) next[opposite] = false;
  return next;
}

function configEditorState(base, draft, revision) {
  const dirty = Object.entries(FIELDS).some(([key, field]) => field.kind === 'number'
    ? draft[key] === '' || Number(draft[key]) !== base[key] : draft[key] !== base[key]);
  const editor = {
    draft: Object.freeze({ ...draft }), dirty,
    change(key, value) { return configEditorState(base, changeConfigDraft(draft, key, value), revision); },
    applyPreset(id) { return configEditorState(base, applyPreset(draft, id), revision); },
    reset() { return configEditorState(base, { ...DEFAULTS }, revision); },
    async save(form) {
      const values = { ...draft };
      for (const [key, field] of Object.entries(FIELDS)) {
        if (field.kind !== 'number') continue;
        const value = Number(values[key]);
        if (values[key] === '' || !Number.isFinite(value) || value < field.min || value > field.max
          || (field.step === 1 && !Number.isInteger(value))) return { editor, notice: 'invalid' };
        values[key] = value;
      }
      const ops = Object.keys(FIELDS).filter(key => values[key] !== base[key])
        .map(key => ({ op: 'set', path: [key], value: values[key] }));
      if (!ops.length) return { editor, notice: '' };
      try {
        const latest = form.getSnapshot();
        const saved = normalizeConfig(latest.value);
        const unchanged = latest.status === 'ready' && Object.keys(FIELDS).every(key => saved[key] === base[key]);
        if (await form.mutate(ops, unchanged ? latest.revision : revision)) {
          return { editor: createConfigEditor(form.getSnapshot()), notice: 'saved' };
        }
        return { editor, notice: 'conflict' };
      } catch { return { editor, notice: 'failed' }; }
    },
  };
  return Object.freeze(editor);
}

/** Draft state hides the saved baseline, revision and persistence protocol. */
export function createConfigEditor(snapshot) {
  const base = normalizeConfig(snapshot.value);
  return configEditorState(base, { ...base }, snapshot.revision);
}
