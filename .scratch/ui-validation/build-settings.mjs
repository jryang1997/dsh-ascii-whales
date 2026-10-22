import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const react = await readFile(new URL('react.production.min.js', import.meta.url), 'utf8');
const dom = await readFile(new URL('react-dom.production.min.js', import.meta.url), 'utf8');
const client = await readFile(new URL('client.js', root), 'utf8');
const dictionary = JSON.parse(await readFile(new URL('locale/zh.json', root), 'utf8')).ui;
// The body mimics the host plugin page (.fO69Vq_page): the page itself is the
// scroll container (height:100vh; overflow:auto; centered flex column), with a
// detail head above the config slot. That is what makes position:sticky inside
// the form measurable against a real scrolling ancestor, not the viewport.
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>设置集成验证</title><style>html,body{margin:0;padding:0}body{font:14px/1.6 "Microsoft YaHei",sans-serif;--dsw-alias-label-primary:#233d50;--dsw-alias-label-secondary:#637a8b;--dsw-alias-bg-layer-1:#fff;--dsw-alias-border-l1:#dbe5eb;--dsw-alias-brand-primary:#2f6a9a;--dsw-alias-bg-base:#fff;background:#f4f7fa}.pm-page{height:100vh;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:0 32px 48px;box-sizing:border-box}.pm-head{flex:0 0 auto;width:100%;max-width:1060px;height:120px;box-sizing:border-box;display:flex;align-items:center;border-bottom:1px solid #dbe5eb;color:#233d50;font-size:20px;font-weight:600}.pm-head small{margin-left:12px;font-size:12px;font-weight:400;color:#637a8b}#settings-root{width:100%;max-width:1060px}</style><div class="pm-page"><div class="pm-head">插件详情<small>@local/dsh-ascii-ocean · 文字蓝鲸</small></div><div id="settings-root"></div></div><script>${react}</script><script>${dom}</script><script>
const listeners=new Set();let snapshot={status:'ready',writable:true,revision:1,value:JSON.parse(localStorage.getItem('whale-settings-test')||'null')||{text:'深海🐋',opacity:0.7,color:'indigo',glass:true}};
const form={getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},async mutate(ops,revision){if(revision!==snapshot.revision)return false;const value={...snapshot.value};for(const op of ops)value[op.path[0]]=op.value;snapshot={...snapshot,value,revision:revision+1};localStorage.setItem('whale-settings-test',JSON.stringify(value));for(const callback of listeners)callback();return true;}};
const words=${JSON.stringify(dictionary)};let Settings;
const ctx={configForms:{get:()=>form},effect:fn=>fn(),locale:{subscribe:()=>()=>{},getSnapshot:()=>1,register:()=>{},bind:()=>key=>words[key]||key},slots:{inject:(name,fn)=>fn(),register:(slot,Component)=>{if(slot.name==='plugins.bundle.config')Settings=Component;return()=>{};}}};
window.__ModuleLoader__={load:module=>{const plugin=module.factory(name=>{if(name==='react')return React;throw Error(name);});plugin.apply(ctx);ReactDOM.createRoot(document.getElementById('settings-root')).render(React.createElement(Settings));}};
window.__settingsTest={snapshot:()=>snapshot};
</script><script>${client}</script></html>`;
await writeFile(new URL('settings.html', import.meta.url), html);
console.log('Built an isolated real-React harness around the generated plugin settings.');
