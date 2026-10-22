import { FIELDS, DEFAULTS, normalizeConfig, configSignature } from './model.js';
import { createWhaleLayer } from './engine.js';
import { drawWhaleSample } from './surface.js';

/** Slider readouts follow the field's own step: whole-number fields show integers. */
function readout(field, value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '';
  return field.step === 1 ? String(Math.round(number)) : number.toFixed(2);
}

/** Filled part of a native range track, handed to CSS as a gradient stop. */
function trackFill(ratio) {
  const safe = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return `${(safe * 100).toFixed(1)}%`;
}

/** Index of the current option; a stale value falls back to the first option. */
function optionIndex(field, value) {
  const index = field.values.indexOf(value);
  return index < 0 ? 0 : index;
}

export function registerWhales(ctx, React, dictionaries) {
  const h = React.createElement;
  const form = ctx.configForms.get('ascii-whale-background');
  const formSubscribe = callback => form.subscribe(callback);
  const formSnapshot = () => form.getSnapshot();
  const localeSubscribe = callback => ctx.locale.subscribe(callback);
  const localeSnapshot = () => ctx.locale.getSnapshot();
  ctx.effect(() => ctx.locale.register('asciiWhales', 'en', dictionaries.en));
  ctx.effect(() => ctx.locale.register('asciiWhales', 'zh', dictionaries.zh));
  const t = ctx.locale.bind('asciiWhales');
  const useForm = () => React.useSyncExternalStore(formSubscribe, formSnapshot, formSnapshot);

  /**
   * The canvas mounts exactly once and later changes are pushed through update().
   *
   * DSH re-reads the whole settings document on every settings write — choosing a
   * model in the composer saves the default model there too — and every config
   * form receives a freshly decoded `value` object even when nothing changed.
   * Re-creating the scene then would snap each whale back to its starting layout.
   * So the layer lives for as long as the canvas node and only the update effect
   * reacts to configuration changes.
   */
  function Canvas({ config }) {
    const ref = React.useRef(null);
    const configRef = React.useRef(config);
    const layer = React.useRef(null);
    React.useEffect(() => {
      const instance = createWhaleLayer(ref.current, configRef.current);
      layer.current = instance;
      return () => { instance.dispose(); layer.current = null; };
      // Mount-only on purpose: this effect owns the canvas, not the config.
    }, []);
    React.useEffect(() => {
      configRef.current = config;
      layer.current?.update(config);
    }, [config]);
    return h('canvas', { ref, 'aria-hidden': true, style: { display: 'block', width: '100%', height: '100%' } });
  }

  /**
   * A static sample of the draft. Drag events arrive faster than the renderer
   * needs them, so redraws are coalesced into one animation frame and that frame
   * reads the latest draft; the theme observer keeps the sample in step with
   * DSH switching between light and dark.
   */
  function StylePreview({ draft }) {
    const ref = React.useRef(null);
    const latest = React.useRef(draft);
    const frame = React.useRef(0);
    const draw = React.useCallback(() => {
      frame.current = 0;
      const canvas = ref.current;
      if (!canvas) return;
      drawWhaleSample(canvas, normalizeConfig(latest.current), {
        ratio: Math.min(2, window.devicePixelRatio || 1),
        dark: document.body.hasAttribute('data-ds-dark-theme'),
      });
    }, []);
    const schedule = React.useCallback(() => {
      if (!frame.current) frame.current = requestAnimationFrame(draw);
    }, [draw]);
    React.useEffect(() => { latest.current = draft; schedule(); }, [draft, schedule]);
    React.useEffect(() => {
      const observer = new ResizeObserver(schedule);
      const themeObserver = new MutationObserver(schedule);
      observer.observe(ref.current);
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
      schedule();
      return () => {
        observer.disconnect();
        themeObserver.disconnect();
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = 0;
      };
    }, [schedule]);
    return h('div', { className: 'aw-style-preview' },
      h('canvas', { ref, role: 'img', 'aria-label': t('stylePreview') }),
      h('p', null, t('stylePreviewNote')));
  }

  function Overlay(props) {
    const panelId = props.usePanelInfo(s => s.activePanelId);
    const snapshot = useForm();
    // Compare content, not references: an unchanged settings document must keep
    // the very same config object, so the update effect does not even fire.
    const signature = snapshot.status === 'ready' ? configSignature(snapshot.value) : '';
    const config = React.useMemo(() => normalizeConfig(snapshot.value ?? {}), [signature]);
    if (snapshot.status !== 'ready' || !config.enabled || (panelId !== null && panelId !== 'conversation')) return null;
    return h('div', { 'aria-hidden': true, style: {
      position: 'absolute', left: 'var(--dsh-windows-sidebar-width, var(--ascii-whale-inset, 280px))',
      top: 'var(--dsh-frame-top-clearance, 0px)', right: 0, bottom: 0,
      '--ascii-whale-inset': `${config.leftInset}px`, pointerEvents: 'none', overflow: 'hidden',
    } }, h(Canvas, { config }));
  }

  function editorFrom(snapshot) {
    const base = normalizeConfig(snapshot.value);
    return { base, draft: { ...base }, revision: snapshot.revision };
  }
  const isDirty = editor => editor && Object.entries(FIELDS).some(([key, field]) => {
    const value = editor.draft[key];
    return field.kind === 'number' ? value === '' || Number(value) !== editor.base[key] : value !== editor.base[key];
  });

  function Settings() {
    const snapshot = useForm();
    React.useSyncExternalStore(localeSubscribe, localeSnapshot, localeSnapshot);
    const [editor, setEditor] = React.useState(() => snapshot.status === 'ready' ? editorFrom(snapshot) : null);
    const [saving, setSaving] = React.useState(false);
    const [notice, setNotice] = React.useState('');
    const dirty = isDirty(editor);
    React.useEffect(() => {
      if (snapshot.status === 'ready' && !dirty) setEditor(editorFrom(snapshot));
    }, [snapshot, dirty]);
    const prefix = React.useId();
    if (snapshot.status !== 'ready' || !editor) return h('p', { role: 'status' }, t(snapshot.status === 'loading' ? 'loading' : 'unavailable'));
    const disabled = !snapshot.writable || saving;
    // The content glass and the input-box avoidance are alternatives: glass already
    // blurs what is behind every box, so avoiding the input box as well would only
    // squeeze the school for no visual gain. Turning one on turns the other off in
    // the same draft, and the save below submits both keys through the ordinary ops
    // path (only the keys that really changed).
    const EXCLUSIVE = { glass: 'composerAvoid', composerAvoid: 'glass' };
    function update(key, value) {
      setEditor(current => {
        const draft = { ...current.draft, [key]: value };
        const opposite = EXCLUSIVE[key];
        if (opposite && value === true) draft[opposite] = false;
        return { ...current, draft };
      });
      setNotice('');
    }
    async function save(event) {
      event.preventDefault();
      if (disabled || !dirty) return;
      const values = { ...editor.draft };
      for (const [key, f] of Object.entries(FIELDS)) {
        if (f.kind === 'number') {
          const value = Number(values[key]);
          if (values[key] === '' || !Number.isFinite(value) || value < f.min || value > f.max || (f.step === 1 && !Number.isInteger(value))) {
            setNotice('invalid');
            return;
          }
          values[key] = value;
        }
      }
      const ops = Object.keys(FIELDS).filter(k => values[k] !== editor.base[k]).map(k => ({ op: 'set', path: [k], value: values[k] }));
      if (!ops.length) return;
      setSaving(true);
      setNotice('');
      try {
        if (await form.mutate(ops, editor.revision)) {
          setEditor(editorFrom(form.getSnapshot()));
          setNotice('saved');
        } else setNotice('conflict');
      } catch { setNotice('failed'); }
      finally { setSaving(false); }
    }
    function discard() { setEditor(editorFrom(form.getSnapshot())); setNotice(''); }
    return h('form', { className: 'aw-settings', onSubmit: save },
      h('style', null, SETTINGS_CSS),
      h('h2', null, t('title')),
      h('p', { className: 'aw-purpose' }, t('purpose')),
      h(StylePreview, { draft: editor.draft }),
      !snapshot.writable && h('p', { role: 'status' }, t('readOnly')),
      // Hidden fields stay in FIELDS for Host schema compatibility (an old profile
      // may still carry composerGlass) but must not render a row of their own.
      ...Object.entries(FIELDS).filter(([, field]) => field.hidden !== true).map(([key, field]) => {
        const id = `${prefix}-${key}`, hint = `${id}-hint`, value = editor.draft[key];
        const off = disabled || (key === 'text' && editor.draft.fillMode === 'ascii');
        const common = { id, disabled: off, 'aria-describedby': hint };
        let control;
        if (field.kind === 'boolean') {
          control = h('button', {
            ...common, type: 'button', role: 'switch', 'aria-checked': value, 'aria-label': t(key),
            className: 'aw-switch', onClick: () => update(key, !value),
          }, h('span', { className: 'aw-switch-knob' }));
        } else if (field.kind === 'enum') {
          // Segmented slider: one native range over the option indexes, with the
          // option names under the track. A native range keeps arrow keys, Home,
          // End and screen-reader semantics without any custom key handling.
          const index = optionIndex(field, value), current = field.values[index];
          const last = field.values.length - 1;
          control = h('div', { className: 'aw-control aw-segments', style: { '--aw-stops': String(field.values.length) } },
            h('input', {
              ...common, type: 'range', className: 'aw-slider', min: 0, max: last, step: 1, value: index,
              'aria-valuetext': t(current), style: { '--aw-pct': trackFill(last ? index / last : 0) },
              onChange: event => update(key, field.values[Number(event.target.value)] ?? current),
            }),
            h('div', { className: 'aw-ticks' }, ...field.values.map((option, position) => h('button', {
              key: option, type: 'button', disabled: off, className: 'aw-tick', tabIndex: -1,
              'aria-pressed': position === index, onClick: () => update(key, option),
            }, t(option)))));
        } else if (field.kind === 'string') {
          control = h('input', {
            ...common, className: 'aw-text', type: 'text', value, maxLength: field.max,
            onChange: event => update(key, event.target.value),
          });
        } else {
          const number = value === '' || !Number.isFinite(Number(value)) ? field.default : Number(value);
          control = h('div', { className: 'aw-control aw-number' },
            h('div', { className: 'aw-number-head' },
              h('output', { htmlFor: id, className: 'aw-readout' }, readout(field, value))),
            h('input', {
              ...common, type: 'range', className: 'aw-slider', min: field.min, max: field.max, step: field.step,
              value: number, style: { '--aw-pct': trackFill((number - field.min) / (field.max - field.min || 1)) },
              onChange: event => update(key, Number(event.target.value)),
            }),
            h('div', { className: 'aw-scale', 'aria-hidden': 'true' },
              h('span', null, readout(field, field.min)), h('span', null, readout(field, field.max))));
        }
        return h('div', { className: 'aw-row', key },
          h('div', { className: 'aw-copy' }, h('label', { htmlFor: id }, t(key)), h('p', { id: hint }, t(`${key}Hint`))), control);
      }),
      h('div', { className: 'aw-actions' },
        h('button', { type: 'submit', disabled: disabled || !dirty, className: 'aw-save' }, t(saving ? 'saving' : 'save')),
        h('button', { type: 'button', disabled, onClick: () => { setEditor(e => ({ ...e, draft: { ...DEFAULTS } })); setNotice(''); } }, t('reset')),
        h('button', { type: 'button', disabled: saving, onClick: discard }, t('discard'))),
      notice && h('p', { role: notice === 'saved' ? 'status' : 'alert', 'aria-live': 'polite' }, t(notice)));
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'ascii-whale-background', order: -100,
  }, Overlay));
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config', key: '@local/dsh-ascii-ocean',
  }, Settings));
}

const SETTINGS_CSS = `
.aw-settings{color:var(--dsw-alias-label-primary);font:inherit;max-width:760px;padding:4px 0 24px}
.aw-settings h2{font-size:18px;font-weight:600;margin:0 0 8px}
.aw-settings .aw-purpose{color:var(--dsw-alias-label-secondary);line-height:1.6;margin:0 0 20px}
.aw-settings .aw-style-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;margin:0 0 8px;background:var(--dsw-alias-bg-layer-1)}
.aw-settings .aw-style-preview canvas{display:block;width:100%;height:220px}
.aw-settings .aw-style-preview p{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0;padding:0 14px 12px}
.aw-settings .aw-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 20px;padding:14px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.aw-settings .aw-copy{min-width:0;flex:1 1 200px}
.aw-settings label{font-weight:500}
.aw-settings .aw-copy p{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);margin:5px 0 0}
.aw-settings input,.aw-settings select,.aw-settings button{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:7px 10px}
.aw-settings input[type=text]{flex:1 1 160px;width:100%;min-width:0;max-width:320px}
.aw-settings button{cursor:pointer}
.aw-settings :disabled{opacity:.5;cursor:default}
.aw-settings :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px}
/* One flexible control column: it yields space first and never widens the row. */
.aw-settings .aw-control{flex:1 1 160px;min-width:160px;max-width:320px;display:flex;flex-direction:column;gap:5px}
.aw-settings .aw-switch{width:36px;height:22px;border-radius:12px;padding:2px;flex:0 0 auto}
.aw-settings .aw-switch-knob{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-secondary)}
.aw-settings .aw-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}
.aw-settings .aw-switch[aria-checked=true] .aw-switch-knob{transform:translateX(12px);background:var(--dsw-alias-bg-base)}
/* Slider track and thumb. The rail uses a translucent grey so it reads on both
   themes; the filled part takes the brand colour through --aw-pct. */
.aw-settings input[type=range]{-webkit-appearance:none;appearance:none;display:block;width:100%;min-width:0;height:22px;margin:0;padding:0;background:none;border:0;border-radius:6px;cursor:pointer;accent-color:var(--dsw-alias-brand-primary)}
.aw-settings input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:rgba(120,140,160,.35);background:linear-gradient(to right,var(--dsw-alias-brand-primary) 0 var(--aw-pct,0%),rgba(120,140,160,.35) var(--aw-pct,0%) 100%)}
.aw-settings input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;margin-top:-5px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);border:2px solid var(--dsw-alias-brand-primary);box-shadow:0 1px 2px rgba(0,0,0,.28)}
.aw-settings input[type=range]::-moz-range-track{height:6px;border-radius:999px;background:rgba(120,140,160,.35)}
.aw-settings input[type=range]::-moz-range-progress{height:6px;border-radius:999px;background:var(--dsw-alias-brand-primary)}
.aw-settings input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-bg-layer-1);border:2px solid var(--dsw-alias-brand-primary)}
.aw-settings input[type=range]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.aw-settings .aw-number-head{display:flex;align-items:baseline;justify-content:flex-end;min-height:18px}
.aw-settings .aw-readout{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.35;white-space:nowrap}
.aw-settings .aw-scale{display:flex;justify-content:space-between;gap:10px;font-size:11px;line-height:1.4;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.aw-settings .aw-scale span{white-space:nowrap}
/* Segmented slider: option names under the track double as jump buttons. */
.aw-settings .aw-ticks{display:grid;grid-template-columns:repeat(var(--aw-stops,2),minmax(0,1fr));gap:2px}
.aw-settings .aw-tick{font:inherit;font-size:11px;line-height:1.35;min-width:0;padding:3px 2px;border:0;border-radius:5px;background:none;color:var(--dsw-alias-label-secondary);text-align:center;overflow-wrap:anywhere}
.aw-settings .aw-tick[aria-pressed=true]{color:var(--dsw-alias-label-primary);font-weight:600;background:rgba(120,145,170,.16);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.aw-settings .aw-tick:disabled{cursor:default}
body[data-ds-dark-theme] .aw-settings input[type=range]::-webkit-slider-runnable-track{background:rgba(160,180,200,.32);background:linear-gradient(to right,var(--dsw-alias-brand-primary) 0 var(--aw-pct,0%),rgba(160,180,200,.32) var(--aw-pct,0%) 100%)}
body[data-ds-dark-theme] .aw-settings .aw-tick[aria-pressed=true]{background:rgba(120,160,200,.2);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,transparent)}
@media(prefers-reduced-motion:no-preference){
.aw-settings input[type=range]::-webkit-slider-thumb{transition:transform .12s ease}
.aw-settings input[type=range]:active::-webkit-slider-thumb{transform:scale(1.08)}
.aw-settings .aw-switch-knob{transition:transform .14s ease,background .14s ease}
.aw-settings .aw-tick{transition:color .12s ease,background .12s ease}
}
@media(max-width:540px){
.aw-settings .aw-row{gap:8px 12px;align-items:flex-start}
.aw-settings .aw-copy{flex:1 1 100%}
.aw-settings .aw-control,.aw-settings input[type=text]{flex:1 1 100%;max-width:none}
.aw-settings .aw-number-head{justify-content:flex-start}
.aw-settings .aw-tick{font-size:10px}
}
`;
