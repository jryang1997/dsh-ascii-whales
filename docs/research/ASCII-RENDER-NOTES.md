# ASCII 实体格渲染核对

依据本地 ascii-sharks 参考源码，固定提交 `c521e24a787e6d4cc460d4cf2b9815f25e4fe453`。以下是研究与建议；不改现有 0.7.0 的俯视、五物种及磨砂阅读区。

## 已证实的源码机制

- 字格不是正方形。宽度随视口计算并限制在 8–13，高度为宽度乘 1.45 后取整；字符居中，字号由格高计算。[renderer.ts:347–352][size]、[416–418][font]
- 每格检测中心及四个子样本；中心命中且覆盖率至少 0.6 才作实体格。实体先铺留缝底色再画字符；边缘只画浅字符，不铺块。[renderer.ts:708–743][cover]、[768–811][paint]。上游画布不透明、黑底，实体用 RGB 色阶，不靠透明度模拟深浅。[renderer.ts:320–395][backdrop]
- 圆背明暗来自到二维脊柱的横向距离、横向朝向及部位标记，背鳍、眼睛、鳍、斑纹另有处理。这里没有三维网格法线或物理材质着色器。[renderer.ts:514–610][shade]
- 底块 RGB 由部位亮度、整条鱼的 depth 系数及物种 tint 决定，并非逐格随机彩虹。depth 实际设为 size，小鱼先画，大鱼覆盖，非逐像素深度测试。[renderer.ts:761–802][paint]、[world.ts:145–178][depth]
- 密度串是 `:;t%SX8#@`，亮皮稀、暗皮密，另有鳍、脊、斑纹字符。前景通常为深色，偶尔彩色或白色；彩色闪烁发生在字符。[renderer.ts:28–44][ramp]、[780–811][paint]
- 字符键由沿身位置、横向位置和鱼 ID 哈希生成，密度档有确定性扰动，纹理随身体走；但另有按屏幕格和时间变化的亮度扰动、错峰换色，不能称为完全静态。缩放字格也会改变键。[renderer.ts:727–736][cover]、[764–797][paint]；[math.ts:24–32][hash]
- 上游小鱼的群游参数在 [species.ts:1–54][species]；鲨鱼轮廓和 tint 在 [renderer.ts:58–95][shape]。

## 对照、推断与限制

现有清晰鲸体只绘字符，明暗通过字色及透明度表现；磨砂区另从深度格生成模糊轮廓。[engine.js:78–98、125–170、232–248](../../src/engine.js#L78)、[shading.js:63–74](../../src/shading.js#L63)。因此，铺底格能填满字符笔画之间的空隙，让连续色调更容易表达实体感，这是机制推断。本次未取得截图原图，不能确认其版本、参数、格子形状或每块颜色来源，不能把描述当测量。

本地文件树及固定提交[根目录][tree]未见 LICENSE、LICENCE、COPYING；[package.json][pkg]无 license 字段，[README][readme]无许可说明。再分发许可未确认，不复制源码或素材。

## 供调用方决定的原创实现建议

- 设置拆成“实体底格”开关及“自定义文字／ASCII 密度”模式，组合独立；推荐旧配置默认保持原观感，切换模式保留原文。
- 复用现有覆盖、深度、身体高度和材质结果，先画底格再画字符。密度模式独立选字，自定义模式只用原文字符，不按明暗换字或混入 ASCII。用自选字符集和原创配色，不照搬上游表。
- 现有 [model.js:41–45](../../src/model.js#L41)会剔除空白，不能宣称逐字保留；严格字面保留应另行明确空白语义。稳定扰动绑定身体位置，避免每帧随机换字。
- 灰度应控制颜色，透明度控制整体可见性；避免把灰度、深度和浓度反复相乘。前景需按最终合成底色选对比，底格关闭时重选；深色底块配深色字会丢字。保留现有玻璃羽化、低分辨率轮廓模糊及减少透明效果流程，不让新底格穿透阅读区。尺寸、色阶及浓度需真实 DSH 验收，本研究不指定未经验证数值。

[size]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/renderer.ts#L347-L352
[font]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/renderer.ts#L416-L418
[backdrop]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/renderer.ts#L320-L395
[cover]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/renderer.ts#L708-L743
[paint]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/renderer.ts#L749-L811
[shade]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/renderer.ts#L514-L610
[depth]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/world.ts#L145-L178
[ramp]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/renderer.ts#L28-L44
[hash]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/math.ts#L24-L32
[species]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/species.ts#L1-L54
[shape]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/src/renderer.ts#L58-L95
[tree]: https://github.com/stackedlol/ascii-sharks/tree/c521e24a787e6d4cc460d4cf2b9815f25e4fe453
[pkg]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/package.json
[readme]: https://github.com/stackedlol/ascii-sharks/blob/c521e24a787e6d4cc460d4cf2b9815f25e4fe453/README.md
