# 听写联动规格（鲸群聚集 + 声浪）

状态：2026-10-25 会话共识已确认；本地实现与验证完成，未发布。
范围：跨两个插件仓库——本仓库（鲸群表现侧）与 `dsh-hold-to-dictate`（触发侧）。
研究依据：[DICTATION-GATHER.md](../research/DICTATION-GATHER.md)；契约 ADR 在 dictate 仓库 `docs/adr/0006-dictation-service.md`。

## 1. 目标行为

安装了两个插件时：按住输入框说话，鲸群游到输入框上缘外静止"倾听"，海面随声音大小出现不规则起伏；说完（转写完成）后鲸群散开，海面归于平静。只装 whale 的鲸鱼背景不受影响。

三个名词：

- **听写联动**：总开关，控制本功能。设置项标为「听写联动」，英文 "Dictation echo"。
- **听写聚集**：鲸群到输入框上缘外聚集并静止的行为。
- **声浪**：声音驱动的海面不规则起伏。

## 2. 开关

- `src/model.js` 新增 `dictationEcho`，boolean，默认 `true`。
- 放在设置页「鲸群与游动」组，紧跟 `activity`，但**不与「跟随任务状态」绑定**。
- 只受总开关 `enabled`、`pauseOnScroll`、页面隐藏等既有条件约束。
- dictate 未安装时服务缺失：开关仍可见、可保存，旁注提示需要 `dsh-hold-to-dictate`。提示由模块级桥接的"服务存在"状态驱动，不阻塞设置页。
- 关闭后：不聚集、无声浪，鲸群与海面完全回到当前行为。

## 3. 桥接契约（生产者 dictate，消费者 whale）

- 生产者 `apply(ctx)` 内无条件 `ctx.provide('dictation', face)`；提供前用 `ctx.get('dictation') === undefined` 守卫，遇到外来实现只记一次日志。
- 服务名 `dictation`，`schema: 1`；face：`{ schema, getSnapshot(), subscribe(listener), level() }`。
- 快照：`{ schema, seq, phase, since, sessionId, locked, cancelArmed, polishing, pending, code }`；`phase ∈ idle|listening|recording|processing|done|error`。
- 映射：`arm → listening`、`recording → recording`、`transcribing → processing`、`complete → done`、`notice → idle`、`failed → error`、卸载/其余 → idle。
- 不携带 DOM、输入框矩形、音频、转写文本、麦克风权限状态；对象冻结、变化之间引用稳定。
- 消费者用 `ctx.inject(['dictation'], child => child.effect(...))` 可选挂载；**不得**加入 whale 的模块级硬 inject。提供方卸载时消费者重置为 idle 并清理。
- 降级：生产者每次发布同时派发 `document` 上的 `dsh:dictation` CustomEvent；消费者仅在服务缺失时监听该事件。主通道可用时不走降级。
- 几何由 whale 自己测量 `[data-composer-card]`/退回 `[data-composer-seat]`，快照不带矩形。

详细契约与失败模式见研究文档 §3–§4 与 dictate ADR。

## 4. 听写聚集

触发：契约相位 `recording`（真正开始录音）才启动；普通点击/按住预备（`listening`）不触发。释放（`done`/idle/error/notice）后散开。

- 入场 1.8 秒从容接近；短录音允许只靠近一部分，不瞬移。离场 0.8 秒。
- 站位：输入框卡片上缘外的弧形，按鲸鱼当前 x 顺序发槽，头朝向输入框；一行放不下就按需加行（最多四行）；仍放不下则返回 null，不聚集。
- 带高：净空 = 躯干最大半宽 + ±3.5px 呼吸 + 16px；上界 `max(24, 0.12H)`；`composerAvoid` 开启时再加避让矩形外扩量。
- 运动：远处 1.2–1.5× 巡游速靠近，进带后降到约 0.14×；抑制新下潜并把进行中的潜回浮；冻结深度漂移；划水压到尾纹阈值以下；engage 期间不重抽路线/不加 wander/不提交屏幕外目标；释放时补一次新航点散开。
- "静止"定义：进带 6 秒后速度 ≤ 0.2× 有效巡游速度、中心偏差 ≤ 0.5× 体长、朝向水平 ±25°、无新下潜、无新尾纹、躯干不重叠。
- 减动态：不聚集（帧循环不跑），只允许一次静态重绘。
- 内容卡片/前景媒体压住聚集带：v1 接受并记入观察项；前景媒体区域必须作为 blocker，不把带排进会被 clearRect 抹掉的区域。
- 长会话、多行输入框、1–8 头、窄窗、画布过小等按研究文档 §4 的边界表处理。

## 5. 声浪

触发：契约相位 `recording` 期间，消费 face.`level()`（RMS，0..1，未钳制）。`processing` 起自然衰减，`done` 时已平静。

- 形态：以输入框为声源，向外扩散的不规则环形/弧形波前；音量决定强度、数量与最大半径。
- 映射固定、无新设置项：RMS 归一化后钳制 0..1，起音约 80ms、释音约 400ms；静音 0.3–0.5 秒内归于平静；最大半径按画布高度钳制，避免覆盖整屏。
- 只由「听写联动」控制，**不依赖**「游动尾流与水花」开关；与风纹/云影/雨共存，绘制在既有水面层内。
- 阅读区与 `quietCenter` 遮罩照旧生效；不新增 DOM 测量、不增加持续绘制次数。
- 减动态：不推进、不绘制声浪。
- 绘制预算：字符级绘制，单帧点数有上限；具体上限在实现中定常量并用测试锁定。

## 6. 验收

1. 单测（whale）：状态归一化、聚集几何、声浪场/映射、engage 缓动、会话过滤、服务缺失与卸载清理、硬 inject 不变。
2. 集成（whale）：1–8 头在三种窗口下进带、静止定义、释放散开、抑制下潜/尾纹、多行与 composerAvoid 边界、减动态不启动循环；既有运动/玻璃/活动测试不回归。
3. 生产者（dictate）：provide 契约、映射全表、卸载补 idle、重复守卫、level 仅在 recording 有值、DOM 降级事件。
4. 生成物：`pnpm build`、`pnpm preview`、`pnpm verify` 全绿；dictate `npm run check` 全绿。
5. 真实 DSH：profile 临时 link 本地 dictate（备份并还原），CDP + 假麦克风自动完成按住录音的聚集/声浪截图与 GIF；`done` 后用状态注入 + 单测覆盖；真实 done 由用户手动听写一次确认。
6. 浏览器证据分三类记录：逻辑/命令流、指针交互、视觉；独立预览不能替代运行中 DSH。

## 7. 授权与发布

- 本轮只做本地改动：不 push、不发 Release、不发布 npm；完成后交 diff 给用户审。
- profile 临时改动仅限把 dictate 依赖指向本地仓库，验收后还原。
- 规格先落本地 `docs/specs/`，授权 push 后再同步 GitHub Issue 与阻塞关系。
- whale 发布包策略后续按共识改为"只发运行时文件 + docs/images"；不在本规格内执行。

## 8. 实施顺序

1. 生产者桥接（dictate）+ 测试。
2. 消费者桥接与状态通道（whale：model/settings/engine/simulation）。
3. 聚集几何模块 + 运动分支 + 集成测试。
4. 声浪模块 + 绘制接线 + 测试。
5. 预览测试入口 + 调参。
6. 生成物、verify、真实 DSH 截图/GIF。
7. README/CHANGELOG/GLOSSARY 收尾；规格与 ADR 回填。
