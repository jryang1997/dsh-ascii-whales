import { FIELDS, normalizeConfig, configSignature } from './model.js';
import { createConfigEditor } from './config-editor.js';
import { createWhaleLayer } from './engine.js';
import { EMPTY_ACTIVITY, currentSessionId, readActivitySnapshot, createJobsBridge } from './activity.js';

/** The preview always shows the school, whatever the saved switches say. */
function previewConfigOf(draft) {
  // quietCenter:false matches the static sample's convention (surface.js): the
  // preview is small, so fading its centre would hide exactly what is on trial.
  return normalizeConfig({ ...draft, enabled: true, quietCenter: false });
}

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
  const jobs = createJobsBridge();
  // Jobs are optional: absent services keep the original decorative background.
  ctx.inject?.(['jobs'], child => child.effect(() => jobs.attach(child.jobs)));

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
  function Canvas({ config, activity = EMPTY_ACTIVITY }) {
    const ref = React.useRef(null);
    const configRef = React.useRef(config);
    const activityRef = React.useRef(activity);
    const layer = React.useRef(null);
    React.useEffect(() => {
      const instance = createWhaleLayer(ref.current, configRef.current);
      instance.setActivity(activityRef.current);
      layer.current = instance;
      return () => { instance.dispose(); layer.current = null; };
      // Mount-only on purpose: this effect owns the canvas, not the config.
    }, []);
    React.useEffect(() => {
      configRef.current = config;
      layer.current?.update(config);
    }, [config]);
    React.useEffect(() => {
      activityRef.current = activity;
      layer.current?.setActivity(activity);
    }, [activity]);
    return h('canvas', { ref, 'aria-hidden': true, style: { display: 'block', width: '100%', height: '100%' } });
  }

  /**
   * The live twin of the background: one layer, mounted once, that keeps
   * swimming on its own while the draft changes around it.
   *
   * Drag events arrive faster than the renderer needs them, and a scene-key
   * change rebuilds the school, so draft updates are coalesced into one
   * animation frame which then reads the latest draft. The injected demo card
   * stands in for a DSH content card: the settings page has no conversation DOM
   * to measure, yet the glass and avoidance options need a card to act on.
   */
  function LivePreview({ draft }) {
    const ref = React.useRef(null);
    const latest = React.useRef(draft);
    const layer = React.useRef(null);
    const frame = React.useRef(0);
    React.useEffect(() => {
      const instance = createWhaleLayer(ref.current, previewConfigOf(latest.current), {
        // Use the conversation's viewport before fitting the whole image into
        // this card. Shrinking only the whale made an 11px glyph look enormous.
        viewport: () => {
          const style = getComputedStyle(ref.current);
          const sidebar = parseFloat(style.getPropertyValue('--dsh-windows-sidebar-width'));
          const clearance = parseFloat(style.getPropertyValue('--dsh-frame-top-clearance')) || 0;
          return {
            width: Math.max(1, window.innerWidth - (Number.isFinite(sidebar) ? sidebar : latest.current.leftInset)),
            height: Math.max(1, window.innerHeight - clearance),
          };
        },
        demoCard: { x: 0.58, y: 0.76, width: 0.35, height: 0.18, radius: 14 },
      });
      layer.current = instance;
      return () => {
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = 0;
        instance.dispose();
        layer.current = null;
      };
      // Mount-only on purpose: this effect owns the canvas, not the draft.
    }, []);
    const apply = React.useCallback(() => {
      frame.current = 0;
      layer.current?.update(previewConfigOf(latest.current));
    }, []);
    const schedule = React.useCallback(() => {
      if (!frame.current) frame.current = requestAnimationFrame(apply);
    }, [apply]);
    React.useEffect(() => { latest.current = draft; schedule(); }, [draft, schedule]);
    return h('aside', { className: 'aw-preview' },
      h('div', { className: 'aw-preview-card' },
        h('canvas', { ref, role: 'img', 'aria-label': t('stylePreview') })),
      h('p', null, t('stylePreviewNote')));
  }

  function Overlay(props) {
    const panelId = props.usePanelInfo(s => s.activePanelId);
    const snapshot = useForm();
    // Compare content, not references: an unchanged settings document must keep
    // the very same config object, so the update effect does not even fire.
    const signature = snapshot.status === 'ready' ? configSignature(snapshot.value) : '';
    const config = React.useMemo(() => normalizeConfig(snapshot.value ?? {}), [signature]);
    const list = props.useSessions?.(state => state);
    const statuses = props.useSessionStatus?.(state => state);
    const jobSnapshot = React.useSyncExternalStore(jobs.subscribe, jobs.getSnapshot, jobs.getSnapshot);
    const nextActivity = React.useMemo(() => readActivitySnapshot(list, statuses, jobSnapshot), [list, statuses, jobSnapshot]);
    const activityKey = JSON.stringify(nextActivity);
    const activity = React.useMemo(() => nextActivity, [activityKey]);
    const scope = currentSessionId(list);
    const visible = snapshot.status === 'ready' && config.enabled && (panelId === null || panelId === 'conversation');
    React.useEffect(() => {
      jobs.watch(visible && config.activity ? scope : null);
      return () => jobs.watch(null);
    }, [visible, config.activity, scope]);
    if (!visible) return null;
    return h('div', { 'aria-hidden': true, style: {
      position: 'absolute', left: 'var(--dsh-windows-sidebar-width, var(--ascii-whale-inset, 280px))',
      top: 'var(--dsh-frame-top-clearance, 0px)', right: 0, bottom: 0,
      '--ascii-whale-inset': `${config.leftInset}px`, pointerEvents: 'none', overflow: 'hidden',
    } }, h(Canvas, { config, activity }));
  }

  function Settings() {
    const snapshot = useForm();
    React.useSyncExternalStore(localeSubscribe, localeSnapshot, localeSnapshot);
    const [editor, setEditor] = React.useState(() => snapshot.status === 'ready' ? createConfigEditor(snapshot) : null);
    const [saving, setSaving] = React.useState(false);
    const [notice, setNotice] = React.useState('');
    const dirty = editor?.dirty ?? false;
    React.useEffect(() => {
      if (snapshot.status === 'ready' && !dirty) setEditor(createConfigEditor(snapshot));
    }, [snapshot, dirty]);
    const prefix = React.useId();
    if (snapshot.status !== 'ready' || !editor) return h('p', { role: 'status' }, t(snapshot.status === 'loading' ? 'loading' : 'unavailable'));
    const disabled = !snapshot.writable || saving;
    // The editor owns draft rules and the revision-aware persistence protocol.
    function update(key, value) {
      setEditor(current => current.change(key, value));
      setNotice('');
    }
    async function save(event) {
      event.preventDefault();
      if (disabled || !dirty) return;
      setSaving(true);
      setNotice('');
      try {
        const result = await editor.save(form);
        setEditor(result.editor);
        setNotice(result.notice);
      } finally { setSaving(false); }
    }
    function discard() { setEditor(createConfigEditor(form.getSnapshot())); setNotice(''); }
    // Two columns: the sticky live preview on the left, the scrolling fields on
    // the right. The whole fields column (read-only notice, rows, actions and
    // the save notice) moves as one block; only the preview stays put.
    return h('form', { className: 'aw-settings', onSubmit: save },
      h('style', null, SETTINGS_CSS),
      h('h2', null, t('title')),
      h('p', { className: 'aw-purpose' }, t('purpose')),
      h('div', { className: 'aw-layout' },
        h(LivePreview, { draft: editor.draft }),
        h('div', { className: 'aw-fields' },
          !snapshot.writable && h('p', { role: 'status' }, t('readOnly')),
          // Hidden fields stay in FIELDS for Host schema compatibility (an old profile
          // may still carry composerGlass) but must not render a row of their own.
          ...Object.entries(FIELDS).filter(([, field]) => field.hidden !== true).map(([key, field]) => {
            const id = `${prefix}-${key}`, hint = `${id}-hint`, value = editor.draft[key];
            const off = disabled || (key === 'text' && editor.draft.fillMode === 'ascii')
              || (key === 'rainIntensity' && !editor.draft.rain);
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
                  h('output', { htmlFor: id, className: 'aw-readout' }, key === 'rainIntensity'
                    ? `${Math.round(number * 100)}%` : readout(field, value))),
                h('input', {
                  ...common, type: 'range', className: 'aw-slider', min: field.min, max: field.max, step: field.step,
                  value: number, 'aria-valuetext': key === 'rainIntensity' ? `${Math.round(number * 100)}%` : undefined,
                  style: { '--aw-pct': trackFill((number - field.min) / (field.max - field.min || 1)) },
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
            h('button', { type: 'button', disabled, onClick: () => { setEditor(e => e.reset()); setNotice(''); } }, t('reset')),
            h('button', { type: 'button', disabled: saving, onClick: discard }, t('discard'))),
          notice && h('p', { role: notice === 'saved' ? 'status' : 'alert', 'aria-live': 'polite' }, t(notice)))));
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'ascii-whale-background', order: -100,
  }, Overlay));
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config', key: '@local/dsh-ascii-ocean',
  }, Settings));
}

const SETTINGS_CSS = `
.aw-settings{color:var(--dsw-alias-label-primary);font:inherit;width:100%;max-width:1280px;min-width:0;container-type:inline-size;padding:4px 0 24px}
.aw-settings h2{font-size:18px;font-weight:600;margin:0 0 8px}
.aw-settings .aw-purpose{color:var(--dsw-alias-label-secondary);line-height:1.6;margin:0 0 20px}
/* Two columns: a live preview that stays in view while the fields scroll. The
   host plugin page is the scroll container and none of the ancestors between it
   and this form clips, so sticky works. align-items:flex-start is load-bearing:
   a stretched aside would fill the whole row and sticky would have nowhere to
   travel inside its own column. */
.aw-settings .aw-layout{display:flex;gap:24px;align-items:flex-start}
.aw-settings .aw-preview{position:sticky;top:16px;flex:0 0 58%;min-width:0}
.aw-settings .aw-preview-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;margin:0 0 8px;background:var(--dsw-alias-bg-layer-1)}
.aw-settings .aw-preview-card canvas{display:block;width:100%;height:clamp(260px,48vh,480px)}
.aw-settings .aw-preview p{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0}
.aw-settings .aw-fields{flex:1 1 0;min-width:0}
.aw-settings .aw-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 20px;padding:14px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.aw-settings .aw-copy{min-width:0;flex:1 1 200px}
.aw-settings label{font-weight:500}
.aw-settings .aw-copy p{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);margin:5px 0 0}
.aw-settings input,.aw-settings select,.aw-settings button{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:7px 10px}
.aw-settings input[type=text]{box-sizing:border-box;flex:1 1 160px;width:100%;min-width:0;max-width:320px}
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
/* The settings region can be narrow even on a wide screen with sidebars. */
@container(max-width:760px){
.aw-settings .aw-layout{display:block}
.aw-settings .aw-preview{position:static;flex:none}
.aw-settings .aw-preview-card canvas{height:280px}
}
@container(max-width:440px){
.aw-settings .aw-row{gap:8px 12px;align-items:flex-start}
.aw-settings .aw-copy{flex:1 1 100%}
.aw-settings .aw-control,.aw-settings input[type=text]{flex:1 1 100%;max-width:none}
.aw-settings .aw-number-head{justify-content:flex-start}
.aw-settings .aw-tick{font-size:10px}
}
@media(max-width:540px){
.aw-settings .aw-row{gap:8px 12px;align-items:flex-start}
.aw-settings .aw-copy{flex:1 1 100%}
.aw-settings .aw-control,.aw-settings input[type=text]{flex:1 1 100%;max-width:none}
.aw-settings .aw-number-head{justify-content:flex-start}
.aw-settings .aw-tick{font-size:10px}
}
`;
