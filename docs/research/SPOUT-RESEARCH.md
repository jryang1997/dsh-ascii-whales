# 点击时的 ASCII 喷气

检索于 2026-10-22。只写这份笔记，不改实现。喷气（blow / spout）指鲸露出水面时看见的那团雾。下面把已打开的原文、由此作出的画法，和没读到的部分分开。

## 事实

### 喷出来的不是水枪

[NOAA Ocean Service 的海洋误解页](https://oceanservice.noaa.gov/ocean/myths/)写明，鲸不是把肺里的水喷出去。喷气孔（blowhole）像鼻孔，喷的是呼出的气。雾里有一部分是头顶带起的海水，有一部分是黏液，其余是肺里较暖的空气遇冷后凝成的水汽。该页页脚写着 Last updated 09/23/26。

[Apprill 等 2017，mSystems，PMC5634792](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5634792/)采样的是座头鲸呼出的气，并把 blow 定义为 exhaled breath condensate。引言写，呼气里的黏液和水分遇到较冷的外界空气后凝成可见的雾团。讨论还写，雾里可以混进停留在上呼吸道的海水，所以它不是一团纯肺气，也不是从肺里射出的液柱。一次换气是短促的一股，不是循环喷泉。

### 五种鲸的气孔和喷柱轮廓

[NOAA Fisheries 抹香鲸物种页](https://www.fisheries.noaa.gov/species/sperm-whale)的 Appearance 段写，抹香鲸是现存鲸类里唯一把单个喷气孔不对称放在头顶左侧的种类。这一页没有写喷柱角度或高度。

轮廓差别来自已打开的 NOAA 技术报告文本：[Leatherwood、Caldwell、Winn，1976 年 8 月，西雅图，NOAA Technical Report NMFS Circular](https://archive.org/details/whalesdolphinspo00leat)，《Whales, dolphins, and porpoises of the western North Atlantic》。读的是 [djvu 文本流](https://archive.org/stream/whalesdolphinspo00leat/whalesdolphinspo00leat_djvu.txt)。文中写，风会改变任何物种喷柱的形状和停留时间，单一特征很少够用来认种。高度是该指南里的现场描述，不是可直接写进动画的常数。

| 对象 | 该指南实际写的 |
| --- | --- |
| 须鲸与齿鲸 | 须鲸外表可凭成对喷气孔与齿鲸分开。齿鲸只有一个喷气孔。 |
| 弓头鲸，以及同段里的露脊鲸 | 两个分得很开的喷气孔把气向上喷成很宽的 V，从正前或正后看是两股清楚的柱。理想条件下许多别的须鲸也能看出这一点，但在弓头鲸和露脊鲸上最稳定，可作为主要识别特征。 |
| 蓝鲸 | 喷柱高，文中写到大约 30 英尺（9.1 m），细、竖直，不像座头鲸那样蓬松。换气方式随游速和当时的活动变化。 |
| 座头鲸 | 约 8 到 10 英尺（2.4 到 3.1 m），相对高度偏宽，被写成气球形。另一处写通常不到 10 英尺，宽大于高。风会很快把形状吹散。觅食时习惯在一次长潜后吹 4 到 8 下，间隔 15 到 30 秒。这是一串呼吸，不是连续水柱。 |
| 抹香鲸 | 单孔靠近头的前部并偏到左侧。喷柱斜着向前，而且朝向鲸的左侧。蓬松，通常不到 8 英尺（2.4 m），「以很斜的角度从头部向前、向左」。识别表写：从吻端左侧斜向前喷。没有给出可复用的度数。 |

本轮打开的 [蓝鲸](https://www.fisheries.noaa.gov/species/blue-whale)、[座头鲸](https://www.fisheries.noaa.gov/species/humpback-whale)、[长须鲸](https://www.fisheries.noaa.gov/species/fin-whale)、[弓头鲸](https://www.fisheries.noaa.gov/species/bowhead-whale) NOAA 物种页，Appearance 段都没有喷柱轮廓。长须鲸页只确认 V 形的是头，不是喷柱。因此「四种须鲸都是灌木状 V 形喷柱」与上面这份 NOAA 指南不符。蓝鲸是细高竖直柱，座头鲸是矮而宽的气球形，只有弓头鲸在该指南里稳定地呈宽 V。长须鲸的喷柱轮廓，这两处都没写。

[WHALE-REFERENCES.md](./WHALE-REFERENCES.md) 记录的是俯视体型和尾拍，没有喷气孔站位，也没有喷柱角度。本仓库 [species.js](../../src/species.js) 第 2 行说明模型 x 从尾缘到吻端，y 是深度。背鳍根的 y 为负，例如蓝鲸 `dorsal.root` 的 y 是 -0.064。没有喷气孔这个部位。[model.js](../../src/model.js) 第 198–201 行把眼睛放在抹香鲸 x=0.4、其余物种 x=0.77，那是眼，不是喷气孔。

### 字为什么会像水

[libcaca 的 `caca/dither.c`](https://github.com/cacalabs/libcaca/blob/main/caca/dither.c) 在 2026-10-22 从 `main` 的原始文件读到的 ASCII 字形表是：

```c
static uint32_t ascii_glyphs[] =
{
    ' ', '.', ':', ';', 't', '%', 'S', 'X', '@', '8', '?'
};
```

非全彩路径用亮度选下标，`ch = lum * dchmax / 0x1000`，再取 `glyphs[ch]`。暗像素落到空格和点，亮像素落到 `%SX@`。源码没有写「按墨水像素数排序」这句注释，表本身就是从空到密。

本仓库已经用同一原则画身体，方向相反。[ASCII-RENDER-NOTES.md](./ASCII-RENDER-NOTES.md) 记录上游鲨鱼密度串 `:;t%SX8#@`，亮皮用稀字，暗皮用密字。[SOURCE-NOTES.md](./SOURCE-NOTES.md) 第 92 行写本插件 ASCII 密度串 `.:-=+*ox%#@`，明暗决定疏密。密字块读成实体。雾如果也用 `@#%`，会读成第二块身体。

文本模式里随年龄换字、并受重力拉下去的实现，读的是 [asciimatics 1.13.1 的 `particles.py`](https://github.com/peterbrittain/asciimatics/blob/1.13.1/asciimatics/particles.py)。粒子按存活时间在字符表上线性前进：

```python
return particle.chars[
    (len(particle.chars) - 1) * particle.time // particle.life_time]
```

`PalmExplosion._explode` 每步把 `dy` 加上 0.2。雨滴按速度从空格、反引号和反斜线里取一个稀字符。落到字上时生成 `Splash`，寿命 3 帧，字符是 v，然后结束。这是一次短溅，不是循环喷泉。

液滴撞上液面时，可读成水的阶段来自两份已打开的原文，不是鲸的生理。

[Worthington，1908，*A Study of Splashes*](https://archive.org/details/studyofsplashes00wortrich) 写，下落的滴先在周围顶起一个小杯或坑（crater），坑壁变高，边缘射出细流（jets）。坑随后塌下，再弹起一根中心液柱（central column / rebounding column）。书里还把周围一圈较小的射流称为 coronet。他没有把这根中心柱叫做 Worthington jet。

[Deegan、Brunet、Eggers，arXiv:0806.3050](https://arxiv.org/abs/0806.3050) 描述的是 crown splash。读的是 [ar5iv HTML](https://ar5iv.labs.arxiv.org/html/0806.3050)。摘要写，液滴打在薄液层上会发出一层或多层片状射流，再碎成二次液滴。正文把冠形的过程写成：光滑的柱状薄片先向外、向上射出，边缘被表面张力收成一圈，圈上长出波纹，波峰再捏成射流并断开成液滴。文中把液滴数目归到 Rayleigh-Plateau 不稳定性。这份 HTML 里若干实验数字是乱的，这里不引用那些数字。

鲸的喷气用得上的只是这几个可看的阶段：孔口先出一股短射流，再铺成灌木或冠，边缘掉下稀液滴，液滴下落，然后消失。不要把冠形飞溅或中心液柱的循环当成鲸的呼吸。

### 点击不能落在整张画布上

[SOURCE-NOTES.md](./SOURCE-NOTES.md) 第 76 行记录，鲸鱼画布注册在 `shell.overlay`，容器是 `.BynINW_overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}`，画在正文上面。第 41 行记录正俯视：模型 x 为纵向、y 为高度、z 为横向，相机映射到屏幕 x 和 -z，高度 y 只进入深度。heading 只在海面内转向。第 148–151 行记录输入座位在画布下面。

本轮又从解包文件核对了这两条 CSS。`.scratch/asar/dsh-client-ui-layout__lib__client.js` 里的规则是：

```text
.BynINW_overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}.BynINW_overlayLayer>*{pointer-events:auto}
```

叠层自己不接指针，但它的直接子元素会被这条规则重新打开。`.scratch/asar/dsh-client-ui-conversation__lib__client.js` 里，对话处于 active 时座位是 `z-index:7;position:sticky;bottom:0`。打开触发菜单时座位升到 `z-index:9`，仍低于 20。画布盖在输入框上面。

插件自己把这扇门又关上了。[settings.js](../../src/settings.js) 第 112–116 行和打包后的 [client.js](../../client.js) 第 2300–2304 行，Overlay 根节点的内联样式都是 `pointerEvents: 'none'`。根节点盖住侧栏以右、顶栏以下的整列对话，包括输入框。内联 `none` 压过 `.overlayLayer > *` 的 `auto`，所以现在的点击能落到底下的界面。

CSS 的 `pointer-events: none` 只让该元素自己不成为目标。后代如果写成 `auto`，仍然收得到事件。因此把整张 canvas 改成 `pointer-events: auto`，会把这一列里的链接、正文选择和输入框点击都吃掉。

## 推断

正俯视时，须鲸那股竖直雾柱指向摄像机，屏幕上几乎没有沿 heading 的位移。它应该在喷气孔周围短暂铺开，再变稀、下落、消失。弓头鲸从前往后看的宽 V，到俯视里更像中线两侧的两瓣，而不是沿游向的一束。蓝鲸用更小的半径，座头鲸用更宽的一团。长须鲸没有读到轮廓，先做成较小的竖直团，不要画成 V。

抹香鲸的斜向前、向左，在俯视里才有一小段屏幕位移：起点比须鲸更靠前，并且偏到鲸的左侧，再沿 heading 和身体左侧偏一小步。仍然是短雾，不是长水枪。

喷气孔站位现在不在模型里。不要改 [species.js](../../src/species.js) 里已有的体型记录。站位另作一张按物种 id 查的表，并标明是画法参数。眼睛的 x 不能拿来当喷气孔。

推荐的交互是在 `document` 的冒泡阶段听 `click`。不调用 `preventDefault`，也不 `stopPropagation`。因为叠层是 `pointer-events: none`，事件目标已经是底下的真实控件。目标若是 `input`、`textarea`、`select`、`button`、`a`、`label`、`summary`、`contenteditable`，或 `role` 为 `button`、`slider`、`textbox`，或者落在 `[data-composer-card]` 里，就什么都不做。其余点击把 `clientX/clientY` 通过画布矩形换算成字格，只命中鲸体字格才喷。点在空海水上不产生状态。

不推荐整张画布 `pointer-events: auto`。也不把「只在选项打开时放一个跟随鲸体的 `auto` 热点」当默认。热点在技术上能接到事件，但鲸游过按钮或输入框时仍会挡住那一块。

可测的纯函数建议做成 `stepSpout(state, tick, random)`，随机数来自带种子的序列。状态只走 `idle → jet → bush → droplets → gone`，到 `gone` 就停，不循环。原点是该鲸的喷气孔，不是点击点。方向用上面的俯视规则，不把须鲸的雾沿 heading 射出去。字符随年龄和竖直速度变：刚出来用星号和 o，下落变慢后用点、撇号和反引号，最后变成空格。不要用身体密度串末端的 @#% 。测试对固定种子快照两三帧字符串。选项默认关，关闭时现有鲸群的帧与现在一致。若现有减少动效路径会冻住画面，这一模式下不要启动多帧喷气。

## 未验证

- 没有打开到一份给出抹香鲸喷柱度数的原文。Leatherwood 只写 obliquely、sharp angle。不要写 45 度这类数。
- 长须鲸喷柱是高柱还是灌木，本轮打开的 NOAA 物种页和 Leatherwood 长须章节都没有这句。
- [Smithsonian 座头鲸喷气页](https://ocean.si.edu/ocean-life/marine-mammals/humpback-whale-spout) 的 `web_fetch` 返回接口 HTTP 404，直接 GET 返回 403。页内句子没有读到。
- 挪威极地研究所的长须鲸页同样是接口 404 和 GET 403，没有读到。
- Reeves 1983 的粒子系统论文，ACM 页接口 404、直接 GET 403。全文没读，不能把该文的生成规则写进来。
- 没有打开一份正文里定义 “Worthington jet” 这个词的现代论文。这里只用 Worthington 1908 里已经读到的中心液柱。
- 喷气孔在本仓库模型坐标系里的 x、z 没有生物学标定。任何小数站位都是画法参数。
- 减少动效时点击应否完全静音，没有在本轮重跑现有测试，只是顺着已有冻住画面的行为推的。

## 实现约束

- 只新增喷气模块和它的测试。不改 `surface.js`、`glass.js`、输入框避让、`species.js` 的现有记录，也不改 `feat/reef-ripples` 工作树。不把 `ascii-sharks-reference` 收进仓库。
- 新选项默认关闭。关闭时不挂会改变现有帧的逻辑。
- 不把整张画布或 Overlay 根设为 `pointer-events: auto`。点击走文档冒泡，不拦截默认行为。
- 点在表单控件、链接或 `[data-composer-card]` 上时忽略。点在空海水上忽略。命中的是鲸体字格，喷气从该鲸喷气孔发出。
- 一次点击只走完 `idle → jet → bush → droplets → gone`。用带种子的随机数，测试快照字符串。字符留在空格、点、撇号、反引号、`~`、`-`、`*`、`o`、`O` 这一端。
- 俯视下须鲸雾从喷气孔向四周铺开。抹香鲸只加一小段向前、向左的偏移。不要做成沿游向的长喷泉。
