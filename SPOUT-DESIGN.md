# 点击喷水

底盘是印章方案，不是逐滴积分。交叉评审 25 对 21。嫁接两处：出生时把喷气孔像素钉死，同一头鲸这股没散完就拒绝再点；`model.test.js`、`update.test.js`、`package.json` 的登记按现有清单补上。

另一会话正在这个工作区改内容框毛玻璃，`engine.js`、`model.js`、locale、`model.test.js`、`update.test.js` 都有未提交改动。喷水只追加。不回滚，不重排他们的玻璃逻辑，不改 `glass.js`、`settings.js`、`preview.mjs`、`content-glass.test.js`。

## 调用

引擎只碰 `attachSpout`。`createWhaleLayer` 在拿到 2d context 之后挂一次。`getContext` 失败的空返回不挂。

```js
const spout = attachSpout(canvas, () => ({
  enabled: config.spout,
  reduced: reduced.matches,
  hidden: document.hidden,
  opacity: config.opacity,
  quietCenter: config.quietCenter,
  glyphSize: config.glyphSize,
  dark: document.body.hasAttribute('data-ds-dark-theme'),
  scene, poses, grid, width, height,
  now: performance.now(),
}));
```

`draw` 里现在的早退是：没有内容板、也没有避让矩形时，`paintGlyphs(ink)` 后直接 return。改成两条路都先画字、再 `spout.paint`，然后再决定要不要铺玻璃。淡出函数体保持原样。

```js
const openWater = !visiblePanes.length && !avoidRect;
const fade = openWater ? null : (x, y) => { /* 现有 avoidRect 与 glassEdgeFade */ };
paintGlyphs(ink, fade);
spout.paint(ink, fade);
if (openWater || !frosted || !visiblePanes.length) return;
```

`dispose` 第一行 `spout.detach()`。`LIVE_KEYS` 追加 `'spout'`。不进场景组，拨开关不重建鱼群。

## 状态

一股水雾是一条记录，不是一串布尔，也不是液滴数组。

```js
{ whaleId, species, born, anchorX, anchorY, acrossX, acrossY, alongX, alongY }
```

闭包里最多 3 条。同一 `whaleId` 还在，再点直接拒绝，不把 `born` 拨回现在。第四条挤掉最老的。`scene` 对象换了，全部丢掉，避免新鲸继承旧雾。

出生时用 `projectParticle` 算一次喷气孔，把屏幕锚点和两根格轴存下来。之后不跟鲸走。须鲸的雾不沿 heading 拉成水枪。

## 印章

字符只用空格 `.` `'` `` ` `` `~` `-` `*` `o` `O`。空格不画。

相位：0–160ms `jet`，160–420 `bush`，420–760 `droplets`。透明度从 160ms 的 1 线性降到 760ms 的 0。`spoutAge` 在超过 760ms 或透明度低于 0.04 时返回 null。

蓝鲸是俯视小圆斑，不是侧视那条高柱在屏幕上的长条。长须鲸没有原文，用更稀的小斑，`unverified: true`，不是 V。弓头鲸宽 V 沿身体左右。座头鲸扁气球。抹香鲸锚在左上角，向前偏左，短。

站位只在 `spout.js`：blue 0.62,-0.12,0；humpback 0.56,-0.14,0；fin 0.60,-0.10,0；bowhead 0.50,-0.16,0；sperm 0.88,-0.08,0.06。假粒子 `part: 'body'`。这些数是画法，不是测量。

## 点击

文档冒泡 `pointerdown`。不 `preventDefault`，不 `stopPropagation`，不改 `pointer-events`。目标是按钮、输入、多行、链接、下拉、label、summary、contenteditable、role 为 button/slider/textbox，或落在 `[data-composer-card]` 里，就不喷。空海水不喷。原点不是点击像素。

减弱动态：不出生，`paint` 清空，静止那一帧上也没有雾。隐藏标签页按 `now - born` 算，过期就是 null，回来不先闪一帧浓雾。

## 不做

不改 `surface.js` 的密度坡道，不改 `shading.js`，不改 `species.js`，不改 `motion.js`，不改礁石工作树，不手改 `client.js`。`client.js` 只由 `node build.mjs` 生成，`spout.js` 插在 `engine.js` 前面。
