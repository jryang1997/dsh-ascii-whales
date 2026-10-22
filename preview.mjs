import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
const names = ['species.js', 'rig.js', 'shading.js', 'reef.js', 'water.js', 'motion.js', 'model.js', 'surface.js', 'glass.js', 'engine.js'];
const strip = text => text.replace(/^import .*;\r?\n/gm, '').replace(/^export \{.*\} from .*;\r?\n/gm, '').replace(/^export /gm, '');
const source = (await Promise.all(names.map(name => readFile(new URL(name, root), 'utf8')))).map(strip).join('\n');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>文字鲸鱼 · 彩色字格与 ASCII</title>
<style>
:root{font:14px/1.7 "Microsoft YaHei",sans-serif;color:#234357;background:#f3f6f8}*{box-sizing:border-box}body{margin:0;padding:32px 20px}main{max-width:1180px;margin:auto}h1{font-size:26px;margin:0 0 10px}h2{font-size:18px;margin:0 0 6px}p{color:#627987;margin:0 0 18px}.comparisons{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card,section{background:#fff;border:1px solid #dbe5eb;border-radius:12px;padding:20px}.card canvas{display:block;width:100%;height:270px}.card p{font-size:12px;margin:0}.card h2{font-size:16px}section{margin-top:22px}label{display:inline-flex;align-items:center;gap:7px;margin:0 16px 12px 0}select,input,button{font:inherit;color:inherit;border:1px solid #c7d6df;border-radius:6px;padding:5px 8px;background:#fff}input[type=text]{width:180px}button{cursor:pointer}.stage{position:relative;isolation:isolate;height:650px}.stage canvas{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none}.reading{display:none;position:absolute;left:25%;right:25%;top:0;bottom:0;padding:25px;z-index:1;overflow:hidden}.reading h3{font-size:18px;margin:8px 0}.reading p{color:#29475a;margin:0 0 20px}.stage.glass-demo .reading{display:block}.hint{font-size:12px;margin:12px 0 0}#status{font-size:12px;color:#627987}body.dark{background:#171d25;color:#d1dfeb}body.dark .card,body.dark section{background:#202730;border-color:#384654}body.dark select,body.dark input,body.dark button{background:#293342;color:#d1dfeb;border-color:#45576a}body.dark .reading p{color:#d1dfeb}body.dark output{color:#9fc3dd}
/* DSH-shaped composer: seat at the bottom, card centred. The plugin canvas sits
   above it, exactly like the shell overlay, so the frosted pane is drawn on top. */
.composer-seat{position:absolute;left:0;right:0;bottom:0;z-index:2;display:flex;justify-content:center;padding:10px 18px 16px;background:linear-gradient(to top,rgba(243,246,248,.94),rgba(243,246,248,0))}
.composer-card{width:min(100%,620px);min-height:120px;padding:18px 22px;border-radius:24px;background:#fff;border:1px solid #dbe5eb;box-shadow:0 8px 28px rgba(35,62,86,.10);color:#8a9baa;font-size:14px}
.composer-note{display:block;margin-top:8px;font-size:12px;color:#a8b6c2}
body.dark .composer-seat{background:linear-gradient(to top,rgba(23,29,37,.94),rgba(23,29,37,0))}
body.dark .composer-card{background:#202730;border-color:#384654;color:#93a8ba;box-shadow:0 8px 28px rgba(0,0,0,.35)}
body.dark .composer-note{color:#6f8494}
input[type=range]{width:150px;padding:0;border:0;background:transparent;accent-color:#2f6a9a;vertical-align:middle;cursor:pointer}label.slider{gap:6px}output{display:inline-block;min-width:3.1em;font-weight:600;font-variant-numeric:tabular-nums;color:#2f6a9a}
@media(max-width:700px){body{padding:18px 10px}.comparisons{grid-template-columns:1fr}.card,section{padding:14px}.stage{height:500px}.reading{left:15%;right:15%;padding:15px}input[type=range]{width:118px}label{margin-right:10px}.composer-seat{padding:8px 10px 10px}.composer-card{min-height:96px;padding:14px 16px;border-radius:20px}}
</style><main><h1>彩色字格与 ASCII 鲸鱼</h1><p>字格底色与字符来源可以自由搭配。下面四张使用同一只蓝鲸、同一鲸体大小和浓度，仅切换渲染选项；拖动下方的“鲸鱼大小”滑杆，四张会一起变大变小。</p>
<div class="comparisons">
<article class="card"><h2>纯字符 · 自定义文字</h2><canvas data-style="glyphs" data-fill="custom" aria-label="纯字符自定义文字"></canvas><p>保留原来的轻盈观感，只绘制你填写的字符。</p></article>
<article class="card"><h2>彩色字格 · 自定义文字</h2><canvas data-style="cells" data-fill="custom" aria-label="彩色字格自定义文字"></canvas><p>文字仍是原文，格子底色显示背部、侧身和鳍尾的深浅。</p></article>
<article class="card"><h2>纯字符 · ASCII</h2><canvas data-style="glyphs" data-fill="ascii" aria-label="纯字符ASCII"></canvas><p>按明暗选择疏密不同的符号，使用等宽字体。</p></article>
<article class="card"><h2>彩色字格 · ASCII</h2><canvas data-style="cells" data-fill="ascii" aria-label="彩色字格ASCII"></canvas><p>先绘深浅底格，再叠加 ASCII 字符，接近参考截图的构成。</p></article>
</div><section><h2>巡游与阅读区预览</h2><p>先查看鲸鱼，再开启磨砂阅读区比较。所有数值项都是滑杆：拖动数量、大小和速度会直接更新同一层鲸鱼，不会让鱼群回到起点。输入框毛玻璃会在输入框位置盖一块与阅读区同材质的磨砂玻璃；鱼群避让会把输入框当成障碍绕开。两项互斥，打开一项会自动关掉另一项。礁石是每次加载随机一次的固定石群，鲸鱼会绕开；水波只在鲸鱼主动甩尾时从尾鳍散开。实际插件保存设置后生效。</p>
<div class="controls"><label>渲染样式<select id="renderStyle"><option value="glyphs">纯字符</option><option value="cells" selected>彩色字格</option></select></label><label>填充内容<select id="fillMode"><option value="custom">自定义文字</option><option value="ascii" selected>ASCII</option></select></label><label>鱼身文字<input id="text" type="text" value="探索未至之境" maxlength="40"></label><label>鲸类<select id="species"><option value="mixed">混合鲸群</option><option value="blue">蓝鲸</option><option value="humpback">座头鲸</option><option value="sperm">抹香鲸</option><option value="fin">长须鲸</option><option value="bowhead">弓头鲸</option></select></label><label class="slider">数量<input id="count" type="range" min="1" max="8" step="1" value="3"><output id="countOut" for="count">3</output></label><label class="slider">鲸鱼大小<input id="whaleSize" type="range" min="0.55" max="1.55" step="0.05" value="1"><output id="whaleSizeOut" for="whaleSize">1.00</output></label><label class="slider">速度<input id="speed" type="range" min="0.3" max="2" step="0.05" value="0.65"><output id="speedOut" for="speed">0.65</output></label><label><input id="glass" type="checkbox" checked>磨砂阅读区</label><label><input id="dark" type="checkbox">深色背景</label><label><input id="composerGlass" type="checkbox">输入框毛玻璃</label><label><input id="composerAvoid" type="checkbox">鱼群避让输入框</label><label><input id="reefs" type="checkbox" checked>礁石</label><label><input id="ripples" type="checkbox" checked>甩尾水波</label><button id="pause" type="button">暂停</button> <span id="status" role="status"></span></div>
<div class="stage" id="stage" data-conversation-scroll><div class="reading" data-chat-flow><h3>鲸鱼从文字旁经过</h3><p>这是一段用于预览的阅读文字。彩色格子和字符在阅读区边缘一起淡出，玻璃内保留柔和的鲸影。</p><p>自定义文字与 ASCII 可以随时切换，原来的鱼身文字会保留。关闭彩色底格，鲸体恢复为纯字符。</p><p>五种鲸类沿用各自的体型和沉稳的上下摆尾；调整鲸鱼大小只改体长，不改游速与摆尾节奏。</p></div><div class="composer-seat" data-composer-seat><div class="composer-card" data-composer-card>给鲸鱼发一条消息，按 Enter 发送<span class="composer-note">预览用假输入框：座位 [data-composer-seat] 与卡片 [data-composer-card] 的结构和实际 DSH 一致</span></div></div><canvas id="live" aria-label="鲸鱼巡游动态预览"></canvas></div>
<p class="hint">使用插件的正式渲染器：控件变化只调用 update()，不重建画布；暂停冻结最后一帧，恢复后从原地继续。系统减少动态效果时显示静态姿态，页面在后台时暂停。</p>
<p class="hint">鲸鱼大小只改体长：0.55 约半身，1.00 默认，1.55 最大。输入框两项互斥：开“毛玻璃”会关“避让”，反之亦然。礁石只生成 2–3 处、避开阅读栏；水波跟随鲸鱼的主动摆尾节奏，滑行时安静。独立预览不替代实际 DSH 窗口的最终观感。</p></section><p class="hint">原版字格研究见 ASCII-RENDER-NOTES.md，鲸类图片依据见 WHALE-REFERENCES.md。</p></main>
<script>
${source}
const el=id=>document.getElementById(id);
const samples=Array.from(document.querySelectorAll('.card canvas'));
const clampValue=(value,min,max)=>Math.max(min,Math.min(max,value));
const readNumber=(id,min,max,fallback)=>{const value=Number(el(id).value);return Number.isFinite(value)?clampValue(value,min,max):fallback;};
const twoDigits=value=>Number(value).toFixed(2);
let layer=null,paused=false,sampleFrame=0;

/** One config object per change; only its content is handed to the live layer. */
function readConfig(){
  return {...DEFAULTS,
    species:el('species').value,
    renderStyle:el('renderStyle').value,
    fillMode:el('fillMode').value,
    text:el('text').value,
    count:Math.round(readNumber('count',1,8,3)),
    whaleSize:readNumber('whaleSize',0.55,1.55,1),
    // The layer accepts an explicit speed 0 as "frozen": it keeps repainting the
    // same static frame, so pause never blanks or restarts the school. The
    // settings page can never send 0 (its slider floor is 0.3).
    speed:paused?0:readNumber('speed',0.3,2,0.65),
    opacity:0.8,
    glass:el('glass').checked,
    quietCenter:false,
    composerGlass:el('composerGlass').checked,
    composerAvoid:el('composerAvoid').checked,
    reefs:el('reefs').checked,
    ripples:el('ripples').checked,
  };
}

function syncDom(config){
  const dark=el('dark').checked;
  document.body.classList.toggle('dark',dark);
  document.body.toggleAttribute('data-ds-dark-theme',dark);
  el('stage').classList.toggle('glass-demo',config.glass);
  el('text').disabled=el('fillMode').value==='ascii';
  el('countOut').value=String(config.count);
  el('whaleSizeOut').value=twoDigits(config.whaleSize);
  el('speedOut').value=twoDigits(el('speed').value);
  el('pause').textContent=paused?'播放':'暂停';
  el('status').textContent=paused?'已暂停'
    :config.composerGlass?'输入框毛玻璃开'
    :config.composerAvoid?'鱼群避让开'
    :!config.reefs&&!config.ripples?'仅鲸鱼巡游'
    :'礁石、甩尾水波与滑行';
}

function drawSamples(){
  const dark=el('dark').checked,size=readNumber('whaleSize',0.55,1.55,1),ratio=Math.min(2,devicePixelRatio||1);
  for(const canvas of samples)drawWhaleSample(canvas,{...DEFAULTS,species:'blue',renderStyle:canvas.dataset.style,
    fillMode:canvas.dataset.fill,text:'探索未至之境',glyphSize:9,opacity:0.85,whaleSize:size},{height:270,ratio,dark});
}
/** Drag events outpace the four samples, so their redraw rides one frame. */
function scheduleSamples(){if(sampleFrame)return;sampleFrame=requestAnimationFrame(()=>{sampleFrame=0;drawSamples();});}

/** Controls only push a config into the existing layer; the canvas never remounts. */
function apply(){const config=readConfig();syncDom(config);if(layer)layer.update(config);}
function boot(){layer=createWhaleLayer(el('live'),readConfig());}
function disposeLayer(){if(layer){layer.dispose();layer=null;}}

const controls=['renderStyle','fillMode','text','species','count','whaleSize','speed','glass','reefs','ripples'];
for(const id of controls){el(id).addEventListener('input',apply);el(id).addEventListener('change',apply);}
el('whaleSize').addEventListener('input',scheduleSamples);
el('dark').addEventListener('change',()=>{apply();scheduleSamples();});
el('pause').addEventListener('click',()=>{paused=!paused;apply();});
/** The two input-box options are alternatives, exactly like the settings page. */
const EXCLUSIVE={composerGlass:'composerAvoid',composerAvoid:'composerGlass'};
for(const id of ['composerGlass','composerAvoid']){
  el(id).addEventListener('change',()=>{
    const opposite=EXCLUSIVE[id];
    if(opposite&&el(id).checked)el(opposite).checked=false;
    apply();
  });
}

const sampleObserver=new ResizeObserver(()=>scheduleSamples());
for(const canvas of samples)sampleObserver.observe(canvas);
syncDom(readConfig());
drawSamples();
boot();

window.__previewTest={
  config:()=>readConfig(),
  apply,
  size:value=>{el('whaleSize').value=String(value);apply();drawSamples();},
  layerAlive:()=>Boolean(layer),
  /** Toggle one input-box option; the other switches off, like the settings page. */
  composer(which,on){
    const id=which==='glass'?'composerGlass':'composerAvoid';
    el(id).checked=Boolean(on);
    if(on)el(EXCLUSIVE[id]).checked=false;
    apply();
  },
  /** Toggle the reef field or the tail ripples without touching the school. */
  scenery(reefs,ripples){
    if(reefs!==undefined)el('reefs').checked=Boolean(reefs);
    if(ripples!==undefined)el('ripples').checked=Boolean(ripples);
    apply();
  },
};
window.addEventListener('pagehide',()=>{disposeLayer();sampleObserver.disconnect();if(sampleFrame)cancelAnimationFrame(sampleFrame);sampleFrame=0;});
window.addEventListener('pageshow',event=>{if(event.persisted){for(const canvas of samples)sampleObserver.observe(canvas);drawSamples();boot();}});
document.documentElement.dataset.previewReady='true';
</script></html>`;
await writeFile(new URL('whale-preview.html', root), html, 'utf8');
console.log('Built four-style comparison and a live preview that updates one whale layer.');
