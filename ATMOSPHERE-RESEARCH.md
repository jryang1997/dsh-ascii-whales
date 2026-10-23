# 俯瞰 ASCII 海面的风纹与云影

## 明确

- NOAA 对海面 surface slicks 的直接说明将它们描述为狭长、蜿蜒的光滑水面条带，并指出聚集物可抑制细小涟漪。内部波、锋面与 Langmuir cells 都可能造成这类结构。因此可以借用海面条带表现风的方向感，但不能把所有短弯痕都称为真实毛细波或断言只由风形成。[NOAA 原文](https://www.integratedecosystemassessment.noaa.gov/regions/hawaii/important-habitat-surface-slicks)
- NASA 的 ISS031-E-35310 照片说明明确记录低积云在大片太平洋海面投下长而深的阴影。该照片是低太阳高度角的具体案例，不能据此给本插件规定真实的云影速度、大小或软边宽度。[NASA 原图与说明](https://eol.jsc.nasa.gov/SearchPhotos/photo.pl?mission=ISS031&roll=E&frame=35310)
- Ken Perlin 的原始参考实现对固定空间梯度做平滑插值，支持连续场而非逐帧独立随机值的构造原则。本次实际实现使用固定软椭圆瓣组合，不直接复制 Perlin 算法。[Perlin 参考实现](https://mrl.cs.nyu.edu/~perlin/noise/)
- Canvas 官方指南建议缓存重复图元、减少绘制状态变化，并避免昂贵的模糊与不必要文字绘制。[MDN Canvas 性能指南](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- 当前绘制器已经有阅读区、输入框、毛玻璃面板的共用淡出遮罩。大气层应复用这些遮罩与同一动画时钟，而不添加新的 DOM 动画、计时器或全屏模糊。[engine.js](engine.js)

## 推测（设计选择，不可当物理依据）

采用一套克制的表现：

1. 风画在水面上。少量近似平行、轻微弯曲、断续的 `-` 与 `~` 组成小段纹理；一阵风的纹理整体漂移，前后淡入淡出。没有箭头、空中的螺旋风线或连续横贯全屏的横线。
2. 云只显示投影。宽阔、不规则、软边的暗色 ASCII 点阵缓慢经过海面，使用 `.`、`'`、`:` 的固定空间分布和连续透明度。没有白云图标、硬边椭圆或每帧重新洗牌的噪点。
3. 云影经过鲸鱼时只轻微压暗颜色，保持轮廓、位置和可见性。风纹比云影移动快，但这些速度差是视觉设计，不宣称为真实气象比例。
4. 所有时间来自现有场景时钟；暂停、隐藏页面与减少动态时不继续推进。调整字高、配色、鲸数和窗口尺寸不重新抽天气种子。
5. 首版工程预算：12 个风纹包，每包最多 16 个字符；云影约 2200 个候选格、实际最多 1100 个字符。没有额外 Canvas、逐像素读回或全屏滤镜。预算不是设备帧率实测值。

实现接口记录见 [atmosphere.js](atmosphere.js)。运行测试见 [atmosphere.test.js](atmosphere.test.js)。风纹与云影独立开关，默认开启。

## 未测

- 尚无真实手机硬件上的 GPU、帧预算或能耗记录，不能从桌面工具运行时间承诺手机帧率。
- 尚未在当前 DSH 窗口验证热加载。独立真实 Canvas 渲染器的两主题画面、暂停与正文遮罩已经检查；实际记录见 [QA 摘要](.scratch/ocean-atmosphere-20261022/qa-summary.json)，并保留 72 帧、10 倍时间的动图。
- NASA Flickr 与 Wikimedia 的抓取入口在本次请求返回 404；改用可访问的 NASA 原始照片说明补齐云影事实，没有把搜索摘要当作完整来源。
