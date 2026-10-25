import { FIELDS, normalizeConfig, configSignature } from './model.js';
import { createConfigEditor } from './config-editor.js';
import { PRESETS, matchPreset } from './presets.js';
import { createWhaleLayer } from './engine.js';
import { EMPTY_ACTIVITY, currentSessionId, readActivitySnapshot, createJobsBridge } from './activity.js';
import { createActivityAnnouncer, createLegendPreference } from './activity-ui.js';

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
  const legendPreference = createLegendPreference(globalThis.window?.location?.origin ?? null);
  const labelOf = entity => entity.label || t(entity.type === 'job' ? 'activityJob' : entity.type === 'subagent' ? 'activitySubagent' : 'activitySession');
  const statusOf = entity => t({ running: 'activityRunning', waiting: 'activityWaiting', idle: 'activityIdle',
    completed: 'activityCompleted', failed: 'activityFailed', unavailable: 'activityUnavailable' }[entity.kind]);
  function Legend({ onClose }) {
    const returnFocus = React.useRef(null);
    React.useEffect(() => { returnFocus.current = document.activeElement; }, []);
    function close() {
      onClose();
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    }
    return h('section', { className: 'aw-legend', 'aria-label': t('activityLegend') },
      h('h3', null, t('activityLegend')),
      h('ul', null, ...[['···', 'activityRunning'], ['!', 'activityWaiting'], ['', 'activityIdle'],
        ['✓', 'activityCompleted'], ['×', 'activityFailed'], ['?', 'activityUnavailable']].map(([symbol, key]) =>
        h('li', { key }, symbol && h('span', { 'aria-hidden': true }, `${symbol} `), t(key)))),
      h('p', null, t('activityLegendNote')),
      h('button', { type: 'button', onClick: close,
        onFocus: event => { if (event.relatedTarget?.isConnected) returnFocus.current = event.relatedTarget; } }, t('activityLegendClose')));
  }
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
  function Canvas({ config, activity = EMPTY_ACTIVITY, onActivityChange }) {
    const ref = React.useRef(null);
    const configRef = React.useRef(config);
    const activityRef = React.useRef(activity);
    const layer = React.useRef(null);
    React.useEffect(() => {
      const instance = createWhaleLayer(ref.current, configRef.current, { onActivityChange });
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
    const [paused, setPaused] = React.useState(false);
    const pauseRef = React.useRef(false);
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
      const config = previewConfigOf(latest.current);
      if (pauseRef.current) config.speed = 0;
      layer.current?.update(config);
    }, []);
    const schedule = React.useCallback(() => {
      if (!frame.current) frame.current = requestAnimationFrame(apply);
    }, [apply]);
    React.useEffect(() => {
      latest.current = draft;
      pauseRef.current = paused;
      schedule();
    }, [draft, paused, schedule]);
    return h('section', { className: 'aw-preview', 'aria-label': t('stylePreview') },
      h('div', { className: 'aw-preview-toolbar' },
        h('div', null, h('h3', null, t('previewTitle')), h('p', null, t('previewSubtitle'))),
        h('button', { type: 'button', className: 'aw-preview-pause', 'aria-pressed': paused,
          onClick: () => setPaused(value => !value) }, t(paused ? 'previewPlay' : 'previewPause'))),
      h('div', { className: 'aw-preview-card' },
        h('canvas', { ref, role: 'img', 'aria-label': t('stylePreview') })),
      h('p', { className: 'aw-preview-note' }, t('stylePreviewNote')));
  }

  function Overlay(props) {
    const panelId = props.usePanelInfo(s => s.activePanelId);
    const language = React.useSyncExternalStore(localeSubscribe, localeSnapshot, localeSnapshot);
    const [presentation, setPresentation] = React.useState(null);
    const [announcement, setAnnouncement] = React.useState({ serial: 0, entities: [] });
    const [legendOpen, setLegendOpen] = React.useState(() => !legendPreference.seen);
    const announcer = React.useMemo(() => createActivityAnnouncer({ announce: setAnnouncement }), []);
    const receiveActivity = React.useCallback(value => {
      setPresentation(value);
      announcer.update(value);
    }, [announcer]);
    React.useEffect(() => () => announcer.dispose(), [announcer]);
    const snapshot = useForm();
    // Compare content, not references: an unchanged settings document must keep
    // the very same config object, so the update effect does not even fire.
    const signature = snapshot.status === 'ready' ? configSignature(snapshot.value) : '';
    const config = React.useMemo(() => normalizeConfig(snapshot.value ?? {}), [signature]);
    const list = props.useSessions?.(state => state);
    const statuses = props.useSessionStatus?.(state => state);
    const jobSnapshot = React.useSyncExternalStore(jobs.subscribe, jobs.getSnapshot, jobs.getSnapshot);
    const nextActivity = React.useMemo(() => {
      const value = readActivitySnapshot(list, statuses, jobSnapshot);
      return { ...value, entities: value.entities.map(entity => ({ ...entity, label: labelOf(entity) })) };
    }, [list, statuses, jobSnapshot, language]);
    const activityKey = JSON.stringify(nextActivity);
    const activity = React.useMemo(() => nextActivity, [activityKey]);
    const scope = currentSessionId(list);
    const visible = snapshot.status === 'ready' && config.enabled && (panelId === null || panelId === 'conversation');
    React.useEffect(() => {
      jobs.watch(visible && config.activity ? scope : null);
      return () => jobs.watch(null);
    }, [visible, config.activity, scope]);
    React.useEffect(() => {
      if (!visible || !config.activity) announcer.update({ enabled: false, scope: null });
    }, [visible, config.activity, scope, announcer]);
    if (!visible) return null;
    const current = config.activity && presentation?.enabled && presentation.scope === activity.scope ? presentation : null;
    return h('div', { className: 'aw-overlay', style: {
      position: 'absolute', left: 'var(--dsh-windows-sidebar-width, var(--ascii-whale-inset, 280px))',
      top: 'var(--dsh-frame-top-clearance, 0px)', right: 0, bottom: 0,
      '--ascii-whale-inset': `${config.leftInset}px`, pointerEvents: 'none', overflow: 'hidden',
    } },
    h('style', null, ACTIVITY_CSS),
    h('div', { 'aria-hidden': true, style: { position: 'absolute', inset: 0 } },
      h(Canvas, { config, activity: config.activity ? activity : EMPTY_ACTIVITY, onActivityChange: receiveActivity })),
    config.activity && h('aside', { className: 'aw-activity' },
      legendOpen && h(Legend, { onClose: () => { legendPreference.dismiss(); setLegendOpen(false); } }),
      current && h('details', { className: 'aw-activity-summary' },
        h('summary', null, t('activitySummary')),
        h('section', { 'aria-label': t('activitySummary') },
          current.availability.currentSession === 'unavailable' && h('p', null, t('activityScopeUnavailable')),
          current.availability.liveStatus === 'unavailable' && h('p', null, t('activityWaitingUnavailable')),
          current.availability.jobs === 'unavailable' && h('p', null, t('activityJobsUnavailable')),
          h('p', null, t('activityOverflow'), ' ', current.overflow.length),
          h('ul', null, ...current.entities.map(entity => h('li', { key: entity.key },
            labelOf(entity), ' · ', statusOf(entity),
            entity.waitingAvailable === false && h('span', null, ' · ', t('activityWaitingUnavailable')))))))),
    h('div', { className: 'aw-sr-only', 'aria-live': 'polite', 'aria-atomic': true, 'aria-label': t('activityAnnouncements') },
      config.activity && h('span', { key: announcement.serial },
        announcement.entities.map(entity => `${labelOf(entity)} · ${statusOf(entity)}`).join('; '))));
  }

  function Settings() {
    const snapshot = useForm();
    React.useSyncExternalStore(localeSubscribe, localeSnapshot, localeSnapshot);
    const [editor, setEditor] = React.useState(() => snapshot.status === 'ready' ? createConfigEditor(snapshot) : null);
    const [saving, setSaving] = React.useState(false);
    const [notice, setNotice] = React.useState('');
    const [showLegend, setShowLegend] = React.useState(false);
    const dirty = editor?.dirty ?? false;
    React.useEffect(() => {
      if (snapshot.status === 'ready' && !dirty) setEditor(createConfigEditor(snapshot));
    }, [snapshot, dirty]);
    const prefix = React.useId();
    const viewportRef = React.useRef(null);
    React.useEffect(() => {
      const root = viewportRef.current;
      if (!root) return;
      const fit = () => {
        const top = Math.max(0, root.getBoundingClientRect().top);
        root.style.setProperty('--aw-height', `${Math.max(200, window.innerHeight - top - 12)}px`);
      };
      fit();
      window.addEventListener('resize', fit);
      const observer = new ResizeObserver(fit);
      if (root.parentElement) observer.observe(root.parentElement);
      return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
    }, [snapshot.status, !!editor]);
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
    function formatValue(key, field, value) {
      if (key === 'opacity' || key === 'rainIntensity') return `${Math.round(Number(value) * 100)}%`;
      if (key === 'whaleSize' || key === 'speed') return `${readout(field, value)}×`;
      if (key === 'glyphSize' || key === 'leftInset') return `${readout(field, value)} px`;
      return readout(field, value);
    }
    function renderField(key) {
      const field = FIELDS[key], value = editor.draft[key];
      const id = `${prefix}-${key}`, hint = `${id}-hint`, label = `${id}-label`;
      const off = disabled || (key === 'text' && editor.draft.fillMode === 'ascii')
        || (key === 'rainIntensity' && !editor.draft.rain)
        || (key === 'glassStrength' && !editor.draft.glass && !['blur', 'frost'].includes(editor.draft.readingEffect));
      const common = { id, disabled: off, 'aria-describedby': hint };
      const title = field.kind === 'enum'
        ? h('span', { id: label, className: 'aw-label' }, t(key))
        : h('label', { id: label, htmlFor: id }, t(key));
      let control, output = null;
      if (field.kind === 'boolean') {
        control = h('button', {
          ...common, type: 'button', role: 'switch', 'aria-checked': value, 'aria-labelledby': label,
          className: 'aw-switch', onClick: () => update(key, !value),
        }, h('span', { className: 'aw-switch-knob', 'aria-hidden': true }));
      } else if (field.kind === 'enum' && (key === 'species' || key === 'color')) {
        control = h('select', { ...common, className: 'aw-select', 'aria-labelledby': label, value,
          onChange: event => update(key, event.target.value) },
        ...field.values.map(option => h('option', { key: option, value: option }, t(option))));
      } else if (field.kind === 'enum') {
        control = h('div', { id, role: 'group', className: 'aw-segments', 'aria-labelledby': label, 'aria-describedby': hint },
          ...field.values.map(option => h('button', {
            key: option, type: 'button', disabled: off, 'aria-pressed': value === option,
            className: 'aw-segment', onClick: () => update(key, option),
          }, t(option))));
      } else if (field.kind === 'string') {
        control = h('input', { ...common, className: 'aw-text', type: 'text', value, maxLength: field.max,
          onChange: event => update(key, event.target.value) });
      } else if (key === 'leftInset') {
        control = h('div', { className: 'aw-pixel-input' }, h('input', { ...common, type: 'number', value,
          min: field.min, max: field.max, step: field.step, inputMode: 'numeric',
          onChange: event => update(key, event.target.value === '' ? '' : Number(event.target.value)) }),
        h('span', { 'aria-hidden': true }, 'px'));
      } else {
        const number = value === '' || !Number.isFinite(Number(value)) ? field.default : Number(value);
        output = h('output', { htmlFor: id, className: 'aw-readout' }, formatValue(key, field, value));
        control = h('div', { className: 'aw-number' },
          h('input', { ...common, type: 'range', className: 'aw-slider', min: field.min, max: field.max, step: field.step,
            value: number, 'aria-valuetext': formatValue(key, field, number),
            style: { '--aw-pct': trackFill((number - field.min) / (field.max - field.min || 1)) },
            onChange: event => update(key, Number(event.target.value)) }),
          h('div', { className: 'aw-scale', 'aria-hidden': true },
            h('span', null, formatValue(key, field, field.min)), h('span', null, formatValue(key, field, field.max))));
      }
      return h('div', { className: `aw-row aw-row--${field.kind}`, key, 'data-aw-field': key },
        h('div', { className: 'aw-copy' }, h('div', { className: 'aw-row-heading' }, title, output),
          h('p', { id: hint }, t(`${key}Hint`))), control);
    }
    const groups = [
      { id: 'appearance', fields: ['renderStyle', 'fillMode', 'color', 'opacity', 'glyphSize'] },
      { id: 'school', fields: ['species', 'count', 'whaleSize', 'speed', 'spout'] },
      { id: 'reading', fields: ['readingEffect', 'glass', 'glassStrength', 'quietCenter', 'composerAvoid'] },
      { id: 'sea', fields: ['wind', 'clouds', 'ripples', 'rain', 'rainIntensity'] },
      { id: 'layout', fields: ['leftInset', 'pauseOnScroll'] },
    ];
    return h('form', { ref: viewportRef, className: 'aw-settings', onSubmit: save },
      h('style', null, SETTINGS_CSS),
      h('header', { className: 'aw-header' },
        h('div', null, h('h2', null, t('title')), h('p', { className: 'aw-purpose' }, t('purpose'))),
        h('div', { className: 'aw-master' }, renderField('enabled'))),
      !snapshot.writable && h('p', { role: 'status', className: 'aw-notice' }, t('readOnly')),
      h(LivePreview, { draft: editor.draft }),
      h('div', { className: 'aw-options', role: 'region', 'aria-label': t('settingsOptions'), tabIndex: 0 },
      h('div', { className: 'aw-primary aw-group' },
        h('div', { className: 'aw-row' },
          h('div', { className: 'aw-copy' }, h('label', { htmlFor: `${prefix}-preset` }, t('scenePreset')),
            h('p', { id: `${prefix}-preset-hint` }, t('presetDescription'))),
          h('select', { id: `${prefix}-preset`, className: 'aw-select', disabled, value: matchPreset(editor.draft),
            'aria-describedby': `${prefix}-preset-hint`, onChange: event => {
              setEditor(current => current.applyPreset(event.target.value));
              setNotice('');
            } }, h('option', { value: 'custom', disabled: true }, t('preset_custom')),
          ...Object.keys(PRESETS).map(id => h('option', { key: id, value: id }, t(`preset_${id}`))))),
        renderField('text'), renderField('activity'),
        h('button', { type: 'button', 'aria-expanded': showLegend,
          onClick: () => setShowLegend(value => !value) }, t('activityLegendOpen')),
        showLegend && h(Legend, { onClose: () => setShowLegend(false) })),
      h('details', { className: 'aw-advanced' }, h('summary', null, t('advancedGroup')),
        h('div', { className: 'aw-advanced-body aw-groups' }, ...groups.map(group => h('fieldset', { className: 'aw-group', key: group.id },
          h('legend', null, t(`${group.id}Group`)),
          h('p', { className: 'aw-group-note' }, t(`${group.id}Description`)),
          ...group.fields.map(renderField))))),
      notice && h('p', { className: 'aw-notice', role: notice === 'saved' ? 'status' : 'alert', 'aria-live': 'polite' }, t(notice))),
      h('footer', { className: 'aw-actions' },
        h('div', { className: 'aw-save-state', role: 'status', 'aria-live': 'polite' }, t(dirty ? 'unsavedDraft' : 'savedDraft')),
        h('div', { className: 'aw-action-buttons' },
          h('button', { type: 'button', disabled, onClick: () => { setEditor(e => e.reset()); setNotice(''); } }, t('reset')),
          h('button', { type: 'button', disabled: saving, onClick: discard }, t('discard')),
          h('button', { type: 'submit', disabled: disabled || !dirty, className: 'aw-save' }, t(saving ? 'saving' : 'save')))));
  }

  // The sidebar owns navigation, labels, tooltips and collapsed-rail buttons.
  // Both entry points render the same editor and save through the same form.
  function SidebarIcon({ size }) {
    return h('svg', { width: size, height: size, viewBox: '0 0 36 36', fill: 'none', 'aria-hidden': true },
      h('g', { transform: 'rotate(40 18 18)', fill: 'currentColor' },
        h('path', { d: 'M14.7 12.8C11.8 13.7 9.3 15.7 9 18.5C11.8 18.4 14.4 16.9 15.9 14.7L14.7 12.8ZM21.3 12.8C24.2 13.7 26.7 15.7 27 18.5C24.2 18.4 21.6 16.9 20.1 14.7L21.3 12.8Z' }),
        h('path', { d: 'M18 6.5C14.9 6.5 13.2 9 13.2 12.2C13.2 17.1 15.5 20.7 16.5 23.6L16.6 24.9C14.9 24.1 12.6 24.1 11 24.9C11.7 27.6 14.6 28.9 17.3 28.2L18 27.1L18.7 28.2C21.4 28.9 24.3 27.6 25 24.9C23.4 24.1 21.1 24.1 19.4 24.9L19.5 23.6C20.5 20.7 22.8 17.1 22.8 12.2C22.8 9 21.1 6.5 18 6.5Z' })));
  }

  function SettingsPanel() {
    return h('div', { style: { flex: '1 1 0', minWidth: 0, minHeight: 0, height: '100%',
      overflow: 'hidden', padding: '16px clamp(16px, 3vw, 40px) 0', boxSizing: 'border-box' } }, h(Settings));
  }

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: 'ascii-whales', order: 5, label: () => t('title'),
  }, SidebarIcon));
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: 'ascii-whales',
  }, SettingsPanel));
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'ascii-whale-background', order: -100,
  }, Overlay));
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config', key: '@local/dsh-ascii-ocean',
  }, Settings));
}

const ACTIVITY_CSS = `
.aw-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.aw-activity{position:absolute;right:16px;top:12px;max-width:min(360px,calc(100% - 32px));max-height:calc(100% - 24px);overflow:auto;color:var(--dsw-alias-label-primary,#1d2633);font:13px/1.5 system-ui,sans-serif}
.aw-activity-summary,.aw-legend{pointer-events:auto;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#c9d2de);border-radius:12px;padding:12px;margin-bottom:8px;overflow-wrap:anywhere}
.aw-activity-summary summary{cursor:pointer}.aw-legend h3{font-size:14px;margin:0 0 8px}.aw-legend ul,.aw-activity-summary ul{padding-left:20px;margin:8px 0}.aw-legend p{margin:8px 0}
.aw-legend button,.aw-activity-summary button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;min-height:36px;padding:4px 10px;cursor:pointer}
.aw-overlay :focus-visible{outline:3px solid #007aff;outline-offset:3px}
body[data-ds-dark-theme] .aw-activity{color:var(--dsw-alias-label-primary,#edf1f7)}
body[data-ds-dark-theme] .aw-activity-summary,body[data-ds-dark-theme] .aw-activity .aw-legend{background:var(--dsw-alias-bg-layer-1,#242c36)}
`;

const SETTINGS_CSS = `
.aw-settings{--aw-accent:#007aff;--aw-ink:var(--dsw-alias-label-primary,#1d2633);--aw-muted:var(--dsw-alias-label-secondary,#647184);--aw-surface:var(--dsw-alias-bg-layer-1,#fff);--aw-line:var(--dsw-alias-border-l1,#e3e7ed);--aw-rail:rgba(120,135,155,.22);--aw-inset:rgba(120,135,155,.09);color:var(--aw-ink);font:inherit;width:100%;max-width:1280px;min-width:0;margin-inline:auto;padding:8px 0 24px;container-type:inline-size;box-sizing:border-box}
.aw-settings *{box-sizing:border-box}
/* The form owns a bounded viewport; only options scroll, never the canvas. */
.aw-settings{display:flex;flex-direction:column;height:var(--aw-height,calc(100dvh - 120px));overflow:hidden;min-height:200px;padding-bottom:0}
.aw-settings .aw-header,.aw-settings .aw-preview,.aw-settings .aw-actions{flex-shrink:0}
.aw-settings .aw-header{margin-bottom:12px}
.aw-settings .aw-preview{margin-bottom:14px;padding:12px 16px}
.aw-settings .aw-preview-card canvas{height:clamp(64px,calc(var(--aw-height,700px) * .28),300px)}
.aw-settings .aw-preview-note{margin-top:6px}
.aw-settings .aw-options{flex:1 1 0;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;scrollbar-gutter:stable;padding:3px 8px 8px 3px;scroll-padding-block:12px}
.aw-settings .aw-actions{position:static;margin-top:0;padding-block:10px}
.aw-settings .aw-header{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:24px}
.aw-settings h2{font-size:24px;line-height:1.25;font-weight:650;letter-spacing:-.025em;margin:0 0 8px}
.aw-settings .aw-purpose{font-size:13px;line-height:1.6;color:var(--aw-muted);margin:0;max-width:680px}
.aw-settings .aw-master{flex:0 0 220px}
.aw-settings .aw-master .aw-row{border:0;padding:0}
.aw-settings .aw-master .aw-copy p{font-size:11px}
.aw-settings input,.aw-settings select,.aw-settings button{font:inherit;color:var(--aw-ink)}
.aw-settings button{cursor:pointer}
.aw-settings :disabled{opacity:.45;cursor:default}
.aw-settings :focus-visible{outline:3px solid var(--aw-accent);outline-offset:3px}
.aw-settings .aw-preview{display:block;min-width:0;margin:0 0 24px;padding:18px;border:1px solid var(--aw-line);border-radius:22px;background:var(--aw-surface);box-shadow:0 3px 16px rgba(25,45,65,.035)}
.aw-settings .aw-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
.aw-settings .aw-preview h3{font-size:15px;line-height:1.4;font-weight:600;margin:0 0 3px}
.aw-settings .aw-preview-toolbar p{font-size:12px;line-height:1.4;color:var(--aw-muted);margin:0}
.aw-settings .aw-preview-pause{flex-shrink:0;font-size:12px;font-weight:500;min-height:36px;padding:7px 14px;border:1px solid var(--aw-line);border-radius:999px;background:var(--aw-inset)}
.aw-settings .aw-preview-card{overflow:hidden;isolation:isolate;border-radius:14px;background:var(--aw-surface);border:1px solid var(--aw-line)}
.aw-settings .aw-preview-card canvas{display:block;width:100%;height:clamp(320px,50vh,560px)}
.aw-settings .aw-preview-note{font-size:12px;line-height:1.6;color:var(--aw-muted);margin:12px 2px 0}
.aw-settings .aw-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:20px}
.aw-settings .aw-group{min-width:0;margin:0;padding:0 22px 10px;border:1px solid var(--aw-line);border-radius:20px;background:var(--aw-surface)}
.aw-settings .aw-group legend{float:left;width:100%;padding:20px 0 0;font-size:17px;line-height:1.4;font-weight:650;letter-spacing:-.015em}
.aw-settings .aw-group-note{clear:both;color:var(--aw-muted);font-size:12px;line-height:1.5;padding:5px 0 14px;margin:0;border-bottom:1px solid var(--aw-line)}
.aw-settings .aw-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px;min-width:0;padding:15px 0;border-bottom:1px solid var(--aw-line)}
.aw-settings .aw-row:last-child{border-bottom:0}
.aw-settings .aw-copy{min-width:0;flex:1 1 100%}
.aw-settings .aw-row--boolean{flex-wrap:nowrap;min-height:76px}
.aw-settings .aw-row--boolean .aw-copy{flex:1 1 0}
.aw-settings .aw-row-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.aw-settings label,.aw-settings .aw-label{font-size:13px;line-height:1.45;font-weight:550}
.aw-settings .aw-copy p{font-size:12px;line-height:1.5;color:var(--aw-muted);margin:5px 0 0;overflow-wrap:break-word}
.aw-settings .aw-readout{flex-shrink:0;font-size:12px;font-weight:600;line-height:1.4;font-variant-numeric:tabular-nums;color:var(--aw-accent);background:rgba(0,122,255,.07);border-radius:6px;padding:2px 7px;white-space:nowrap}
.aw-settings .aw-text,.aw-settings .aw-select{width:100%;min-width:0;min-height:40px;padding:9px 12px;border:1px solid var(--aw-line);border-radius:10px;background:var(--aw-inset);font-size:13px;line-height:1.4}
.aw-settings .aw-select{cursor:pointer;color-scheme:light}
.aw-settings .aw-select option{color:#1d2633;background:#fff}
.aw-settings .aw-segments{display:flex;flex:1 1 100%;min-width:0;padding:3px;gap:3px;border-radius:11px;background:var(--aw-inset)}
.aw-settings .aw-segment{flex:1 1 0;min-width:0;min-height:36px;padding:7px 4px;background:transparent;border:1px solid transparent;border-radius:8px;font-size:12px;line-height:1.35;text-align:center;overflow-wrap:normal;word-break:normal;hyphens:none;letter-spacing:-.01em;color:var(--aw-muted)}
.aw-settings .aw-segment[aria-pressed=true]{background:var(--aw-surface);color:var(--aw-ink);font-weight:600;border-color:var(--aw-line);box-shadow:0 1px 3px rgba(20,40,60,.08)}
.aw-settings .aw-number{width:100%;min-width:0}
.aw-settings input[type=range]{-webkit-appearance:none;appearance:none;display:block;width:100%;height:32px;margin:0;padding:0;background:transparent;border:0;border-radius:999px;cursor:pointer;accent-color:var(--aw-accent);touch-action:pan-y}
.aw-settings input[type=range]::-webkit-slider-runnable-track{height:5px;border-radius:999px;background:linear-gradient(to right,var(--aw-accent) 0 var(--aw-pct,0%),var(--aw-rail) var(--aw-pct,0%) 100%)}
.aw-settings input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;margin-top:-8.5px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.06);box-shadow:0 1px 4px rgba(20,35,50,.22),0 2px 8px rgba(20,35,50,.06)}
.aw-settings input[type=range]::-moz-range-track{height:5px;border-radius:999px;background:var(--aw-rail)}
.aw-settings input[type=range]::-moz-range-progress{height:5px;border-radius:999px;background:var(--aw-accent)}
.aw-settings input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.06);box-shadow:0 1px 4px rgba(20,35,50,.22)}
.aw-settings .aw-scale{display:flex;justify-content:space-between;gap:12px;font-size:10px;line-height:1.4;color:var(--aw-muted);font-variant-numeric:tabular-nums}
.aw-settings .aw-switch{position:relative;flex:0 0 48px;width:48px;height:44px;min-height:44px;padding:0;border:0;border-radius:14px;background:transparent}
.aw-settings .aw-switch::before{content:'';position:absolute;inset:8px 0;border-radius:999px;background:var(--aw-rail)}
.aw-settings .aw-switch-knob{position:absolute;top:10px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15)}
.aw-settings .aw-switch[aria-checked=true]::before{background:var(--aw-accent)}
.aw-settings .aw-switch[aria-checked=true] .aw-switch-knob{transform:translateX(20px)}
.aw-settings .aw-advanced{margin-top:20px;border:1px solid var(--aw-line);border-radius:16px;background:var(--aw-surface)}
.aw-settings .aw-advanced summary{padding:16px 22px;font-size:13px;font-weight:550;cursor:pointer}
.aw-settings .aw-advanced-body{padding:0 12px 12px}
.aw-settings .aw-pixel-input{display:flex;align-items:center;gap:8px;flex:0 0 116px;color:var(--aw-muted);font-size:12px}
.aw-settings .aw-pixel-input input{min-width:0;width:84px;padding:8px;border:1px solid var(--aw-line);border-radius:8px;background:var(--aw-inset);font-variant-numeric:tabular-nums}
.aw-settings .aw-actions{position:sticky;bottom:0;z-index:4;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-top:20px;padding:14px 0;background:var(--aw-surface);border-top:1px solid var(--aw-line)}
.aw-settings .aw-save-state{font-size:12px;line-height:1.4;color:var(--aw-muted)}
.aw-settings .aw-primary{padding-bottom:0}
.aw-settings .aw-action-buttons{display:flex;flex-wrap:wrap;gap:8px}
.aw-settings .aw-action-buttons button{min-height:38px;padding:8px 14px;font-size:12px;font-weight:500;line-height:1.4;border:1px solid var(--aw-line);border-radius:10px;background:var(--aw-inset)}
.aw-settings .aw-action-buttons .aw-save{color:#fff;border-color:var(--aw-accent);background:var(--aw-accent);padding-inline:22px}
.aw-settings .aw-notice{font-size:13px;line-height:1.5;padding:12px 14px;border-radius:10px;background:var(--aw-inset)}
body[data-ds-dark-theme] .aw-settings{--aw-accent:#0a84ff;--aw-inset:rgba(160,175,195,.10);--aw-rail:rgba(160,175,195,.27)}
body[data-ds-dark-theme] .aw-settings .aw-select{color-scheme:dark}
body[data-ds-dark-theme] .aw-settings .aw-select option{color:#e8edf5;background:#242c36}
@media(hover:hover) and (pointer:fine){
.aw-settings .aw-segment:not(:disabled):hover{color:var(--aw-ink);background:var(--aw-surface)}
.aw-settings .aw-action-buttons button:not(:disabled):hover,.aw-settings .aw-preview-pause:hover{filter:brightness(.96)}
}
@media(prefers-reduced-motion:no-preference){
.aw-settings .aw-switch-knob{transition:transform 160ms cubic-bezier(.23,1,.32,1)}
.aw-settings .aw-switch::before{transition:background-color 160ms ease}
}
@media(max-height:600px){.aw-settings .aw-actions{position:static}}
@media(prefers-contrast:more){.aw-settings{--aw-line:currentColor}.aw-settings .aw-copy p,.aw-settings .aw-scale{color:var(--aw-ink)}}
@container(max-width:760px){
.aw-settings .aw-header{align-items:flex-start;flex-direction:column;gap:16px}
.aw-settings .aw-master{flex:auto;width:100%}
.aw-settings .aw-groups{grid-template-columns:minmax(0,1fr);gap:16px}
.aw-settings .aw-preview-card canvas{height:clamp(280px,45vh,420px)}
}
@container(max-width:440px){
.aw-settings .aw-preview{padding:12px;border-radius:16px}
.aw-settings .aw-preview-card canvas{height:280px}
.aw-settings .aw-group{padding-inline:16px}
.aw-settings .aw-actions{align-items:flex-start}
.aw-settings .aw-action-buttons{width:100%}
.aw-settings .aw-action-buttons button{flex:1 1 auto;padding-inline:10px}
.aw-settings .aw-segment{font-size:11px;padding-inline:3px}
.aw-settings .aw-preview-toolbar{gap:8px}
.aw-settings .aw-preview-pause{padding-inline:10px}
.aw-settings .aw-advanced .aw-row{flex-wrap:wrap}
.aw-settings .aw-advanced .aw-copy{flex-basis:100%}
}
.aw-settings .aw-header{margin-bottom:12px}
.aw-settings .aw-preview{margin-bottom:14px;padding:12px 16px}
.aw-settings .aw-preview-card canvas{height:clamp(64px,calc(var(--aw-height,700px) * .28),300px)}
.aw-settings .aw-preview-note{margin-top:6px}
.aw-settings .aw-actions{position:static;margin-top:0;padding-block:10px}
@media(max-height:760px){
.aw-settings .aw-purpose,.aw-settings .aw-preview-note,.aw-settings .aw-preview-toolbar p{display:none}
.aw-settings .aw-header h2{font-size:19px;margin:0}
.aw-settings .aw-master .aw-copy p{display:none}
.aw-settings .aw-preview-toolbar{margin-bottom:6px}
.aw-settings .aw-preview{padding:8px 12px;margin-bottom:8px}
.aw-settings .aw-preview-card canvas{height:clamp(56px,calc(var(--aw-height,500px) * .22),150px)}
.aw-settings .aw-actions{gap:6px;padding-block:6px}
.aw-settings .aw-action-buttons{margin-left:auto}
}
@container(max-width:760px){
.aw-settings .aw-header{flex-direction:row;align-items:center;gap:12px}
.aw-settings .aw-master{width:auto;flex:0 1 190px}
}
`;
