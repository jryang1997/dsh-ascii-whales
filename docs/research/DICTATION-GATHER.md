# 听写时鲸群聚集（dictate × whales 彩蛋）研究

状态：研究结论与实现设计，未实现。日期 2026-10-25。
范围：触发侧 `dsh-hold-to-dictate`（`C:\Users\Jerry\Desktop\dsh_voice\dsh-hold-to-dictate`）与表现侧本仓库。
原始证据在本地 `.scratch/research/bridge/findings.md`、`.scratch/research/motion/findings.md`（未随仓库发布）；运动原型只存在于 `.scratch/research/motion/proto/`，不是产品代码。
配套研究：[DSH 插件共享脚手架](./PLUGIN-KIT-RESEARCH.md)。

## 结论

1. **可以实现。** 应拆成两件独立交付：**事件桥**（小，生产者 + 消费者合计约 60–100 行）与**鲸群聚集行为**（复杂度 M，主要风险在既有运动不变量与观感调参）。
2. **不要复用任务状态通道。** whale 现有的 `activity` 通道读的是主机会话/子代理/后台任务实体（`src/activity.js`），复用 `setActivity` 会制造假座位、假徽记并触发状态播报语义。听写是每帧 UI 状态，需要一条平行的新通道；"现成的"是传输机制（cordis 服务注入）与鲸鱼层的挂载模式，不是这条状态本身。
3. **桥接推荐 cordis 服务注入**：dictate 在 `apply(ctx)` 里 `ctx.provide('dictation', face)`；whale 用 `ctx.inject(['dictation'], child => ...)` 可选挂载。另一端缺失时纤维停用、不报错、不阻塞；卸载/HMR 自动解绑再重绑。DOM `CustomEvent` 只作为降级通道。**不要**把 `dictation` 加进 whale 的硬 inject 列表（会让整个鲸鱼插件在 dictate 未装时一起停用）。
4. **视觉硬约束**：鲸鱼画布注册在 `shell.overlay`（z-index 20），画在输入框座位（z-index 7）之上；默认玻璃下输入框卡片本身就是插件画的一块磨砂面板，卡片内锐利字格被 even-odd 裁掉（`src/engine.js:524-525`、`src/glass.js:125-132`、`docs/research/SOURCE-NOTES.md:149-153`）。所以鲸鱼**不能"游进输入框"**：聚集带只能落在卡片上缘之外的锐利水面，空间不足时退到左右两侧或干脆不聚集。
5. **原型已验证机制可行**（8 个窗口/数量场景）：没有新下潜、没有逐帧跳变、释放正常，多数场景鲸鱼能进带。同时暴露三个真实风险：转向速率不足（默认 180° 掉头要 14–18 秒）、目标方位必须用环形最短差、朝向没转平时长身体会扫进卡片；多行槽还会被互斥推挤。
6. **当前安装状态不一样**：whale 是 `link:` 到本工作区（改完 `pnpm build` 即生效），dictate 安装的是 **2.6.0**，本地仓库已是 **2.7.0**。新功能要真正看到，必须先把 dictate 侧改动发布/重装进 profile。

## 1. 触发侧现状

dictate 是单文件客户端插件（`client.js` 3,533 行），通过 `window.__ModuleLoader__.load` 注册，硬注入 `['slots','locale','remote']`，在 `remote.speech` 出现后才把组件挂到 `conversation.input.overlay`（`client.js:3459-3461, 3505-3527`）。

| 事实 | 位置 | 对桥接的意义 |
| --- | --- | --- |
| 相位是组件内 React state，唯一发布口是 `show(patchValues)` | `client.js:2348-2392`；`patch` 在 `2335` | 生产者只需包一层 `show`/派生快照，不改状态机 |
| 相位值：`idle / recording / transcribing / complete / notice / failed` | `client.js:2177-2183, 2705, 2818, 2866, 2894, 2918-2923, 2585, 2443` | 映射到契约相位（见 §3.3） |
| 按住未达阈值时 `view.arm` 非空 | `client.js:2179, 2411-2416, 2988` | 可映射为 `listening`（"准备听"），让鲸群提前半秒动身 |
| 插件卸载/overlay 卸载没有统一的全局事件 | 组件生命周期 | 生产者要在 effect 清理与 service disposer 里补发 `idle` |
| 语音依赖 `remote.speech`；主机关闭语音插件时 overlay 不挂载 | `client.js:3502-3528` | 服务应在 `apply` 内**无条件** provide（初始 idle），不能写在 `remote.speech` 分支里 |

## 2. 传输层：为什么是服务注入

本机安装构建（2026-10-23 解包）核对到的事实：

- 两个插件都是**静态 web 客户端插件**（profile bundle → `dsh.client` 启动清单 → `__ModuleLoader__`），拿到完整 cordis ctx；动态包 Guard 只约束运行时创建的 dynamic package。
- `ctx.provide(name, value)` 是 fiber effect：卸载自动注销并通知依赖方；同名二次 provide 抛错（`service "x" has been registered at <fiber>`）。
- 依赖方 `ctx.inject(['x'], cb)` 在服务缺失时**停用（park）而不报错**，服务出现后自动激活；提供方卸载时依赖纤维卸载、清理 effect，重新 provide 后重新执行 `apply`。没有 `required:false` 语法，可选性靠"子纤维 + 运行时 ctx.inject"实现。
- 宿主没有可复用的客户端事件总线（构建中无 `CustomEvent/BroadcastChannel/EventTarget` 客户端用法；`ctx.emit` 对 dynamic package 被 Guard 拒绝，且不属于对外契约）。`dsh.client.inject` 只影响模块到达/预取，**不决定插件激活顺序**；`immediately: true` 在本构建中被解析但无人读取。
- 产品内已有同类先例：whale 对 `jobs` 的可选注入（`src/settings.js:37-39`、`src/activity.js:116-139`）；client runner 自己用 `ctx.provide('cordisInspect')`、`ctx.provide('dynamicCordisRunner')` 向动态包发布能力。

方案对比（详见 bridge findings 的 A–F 矩阵）：

| 方案 | 缺失另一端 | 生命周期 | 结论 |
| --- | --- | --- | --- |
| **cordis 服务 + 可选子纤维** | 子纤维停用，无错误 | 框架托管，自动卸载/重载 | **主方案** |
| DOM `CustomEvent` | 永不触发，无错误 | 需自己处理卸载与陈旧状态 | **降级方案** |
| `window.__dictation` 全局单例 | undefined | 无归属，易残留 | 不推荐 |
| 宿主事件总线 | — | — | 不存在 |
| `ctx.emit` 自定义事件（静态） | 无人监听 | 无回放 | 不推荐（非契约、dynamic 禁用） |

## 3. 桥接契约

### 3.1 服务与接口

- 服务名：**`dictation`**（能力名而非插件名，未来原生听写可复用；当前构建中未被占用）。生产者先查 `ctx.get('dictation') === undefined` 再提供，遇到外来实现只记一次日志、不抛错。
- `schema: 1`。
- face：`{ schema, getSnapshot(), subscribe(listener), level() }`。前三个与 `locale`/`jobs.state` 同形，消费者可直接 `React.useSyncExternalStore`；`level()` 是 0–1 的拉取式音量，只在 `recording` 时有意义，供鲸鱼逐帧读取，避免 20–60Hz 的 React 通知。

### 3.2 快照（只含语义，不含 DOM/隐私）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schema` | 1 | 契约版本 |
| `seq` | number | 单调递增，去重/排序用 |
| `phase` | `idle|listening|recording|processing|done|error` | 见映射 |
| `since` | number | 相位开始的 epoch ms；消费方自己算时长 |
| `sessionId` | string \| null | 该 take 所属会话；未挂载为 null |
| `locked` | boolean | 免提录音中 |
| `cancelArmed` | boolean | 此时松手会丢弃 |
| `polishing` | boolean | processing 中的 AI 润色阶段 |
| `pending` | boolean | 有保留待插入文本（**不带文本本身**） |
| `code` | string \| null | error/notice 的稳定代码 |

硬约束：快照可 JSON 序列化；**不含** DOM/rect、音频、麦克风权限、转写文本；对象冻结且两次变化之间引用稳定（uSES 要求）。

### 3.3 状态映射（dictate → 契约）

| dictate 内部 | 契约相位 | 附加标志 |
| --- | --- | --- |
| `view.arm !== null` | `listening` | — |
| `view.phase === 'recording'` | `recording` | `locked`、`cancelArmed` |
| `view.phase === 'transcribing'` | `processing` | `polishing` |
| `view.phase === 'complete'` | `done` | — |
| `view.phase === 'notice'` | `idle` | `code` |
| `view.phase === 'failed'` | `error` | `code` |
| 其余 / 组件卸载 / 插件卸载 | `idle` | `sessionId: null` |

鲸鱼侧只消费 `phase/schema/seq/since/sessionId` 也能工作；未知字段忽略，未知相位当 `idle`。

### 3.4 会话过滤与几何

- 会话：whale 的图层是页面级 `shell.overlay`，听写是会话级。消费方只在 `sessionId === null || sessionId === 当前会话` 时反应（当前会话沿用 `src/activity.js:10-12` 的 `currentSessionId`）。
- 几何：**快照不携带输入框矩形**。whale 已在 `src/engine.js:18-23,465-505` 自行测量 `[data-composer-card]`（缺省退回 `[data-composer-seat]`）并换算到画布坐标；再传一份视口坐标只会引入第二套几何与陈旧问题。

### 3.5 生命周期与失败模式

| 情况 | 结果 |
| --- | --- |
| whale 有、dictate 未装/禁用 | 子纤维不激活，鲸鱼与今天完全一致，无报错、无 audit 行（子纤维不是启动条目） |
| dictate 有、whale 未装 | 服务无人读取，成本仅一个 store 条目 |
| dictate 卸载/HMR | 服务注销 → whale 子纤维卸载并重置为 idle；新包加载后重新 provide → 重新挂载 |
| whale 卸载/HMR | 订阅与 effect 清理，dictate 不受影响；所有 attach 必须幂等 |
| 旧 dictate（无服务）+ 新 whale | 无服务 → 不反应 |
| 新 dictate + 旧 whale | 服务无人读，无副作用 |
| 重复 provide | 第二个抛错；生产者必须用 `ctx.get` 守卫 |

## 4. 两端改动

### 4.1 生产者（dictate，约 60–80 行）

1. 模块级 `createDictationBridge()`：IDLE 常量、`getSnapshot/subscribe/level`、`update(fields)`（相位变化时刷新 `since`）、`idle()`、`bindLevel(fn)`、`dispose()`。
2. `apply(ctx)` 内无条件 `ctx.effect(() => { const dispose = ctx.provide('dictation', face); return () => { bridge.idle(); dispose(); } })`，并加重复 provide 守卫。
3. `HoldToTalk` 里从现有 `view` 派生契约快照，用 effect 在相位/标志变化时 `update`；在掌管理器的 effect 里 `bindLevel(() => state.level)`；卸载时 `bridge.idle()`。
4. 测试（沿用 dictate 的纯脚本风格）：provide 契约、相位映射全表、卸载补 idle、重复守卫、`level` 只在 recording 有值。

### 4.2 消费者（whale，约 30–50 行 + 引擎一条通道）

1. `src/activity.js` 旁新增同形的 `createDictationBridge()`（attach/subscribe/getSnapshot/level；可选 DOM 事件兜底）。
2. `registerWhales` 里 `ctx.inject?.(['dictation'], child => child.effect(() => bridge.attach(child.dictation)))`；**硬 inject 列表保持 `['slots','locale','configForms']` 不变**。
3. `Overlay` 用 `useSyncExternalStore` 读快照、按会话过滤，作为 prop 传给 `Canvas`；`Canvas` 用 effect 调 `layer.setDictation(state)`。
4. `src/engine.js` 增加 `setDictation(snapshot)`（与 `setActivity` 同构，状态变化时单次重绘），measure 时把画布坐标 anchor 下发给仿真；`dispose` 清理。
5. 测试：服务缺失时不改变渲染、硬 inject 不被污染、attach→dispose→reattach 幂等、引擎收到状态序列、会话过滤生效。

## 5. 鲸群聚集行为设计

### 5.1 接入点

| 关注点 | 位置 |
| --- | --- |
| 帧循环 | `src/engine.js:711-720`：减动态/隐藏/滚动暂停时直接返回；30fps 绘制节流 |
| 仿真推进 | `src/simulation.js:58-70`：先 `activity.apply` 再 `stepScene` |
| 运动积分 | `src/motion.js:728-910`；60Hz 固定子步 `1121-1135` |
| 每鲸状态 | `src/motion.js:442-461,492-536`（`whale._motion`） |
| 输入框测量 | `src/engine.js:465-505`；障碍策略 `src/reading-layout.js:14-39` |
| 活动通道（不要复用） | `src/settings.js:960-965` → `src/simulation.js:45-49` → `src/activity.js:78-111` |

### 5.2 状态模型

`scene.dictation = { state, active, engage, anchor }` 放在仿真层（不属于单头鲸，场景重建不丢）：

- `state`：`idle|listening|recording|processing`（`done/error` 按 idle 处理，可选一次短促庆祝留到 P1）。
- `active = state === 'listening' || state === 'recording' || state === 'processing'`。
- `engage` 在固定子步内按 `1/1.8s` 缓入、`1/0.8s` 缓出；反向切换在当前值上折返，不跳变。
- 不写进配置/FIELDS，不触发场景重建；未触发时所有新分支藏在 `engage > 0` 之后，保证既有确定性测试逐字节一致。

**映射建议**：`recording → listening`（聚集保持）；`processing → processing`（继续停留，让"说完游走"发生在结果落地前后都可调）；其余 idle → 0.8s 散开。`listening`（按住蓄势）可提前入场，但 v1 可先只认 `recording`，避免短按误触。

### 5.3 几何

全部纯函数放新模块 `src/dictation.js`（画布 CSS 像素，无 DOM）：

1. `anchor` = 卡片 `getBoundingClientRect()` 减画布 rect，四边裁进画布；卡片缺失/不在画布内 → 返回 null，不聚集。
2. 水平带：`spanL = max(16, card.left - 0.14*card.width)`，`spanR = min(W-16, card.left + 1.14*card.width)`——鲸群比卡片略宽，读起来是"围过来"而不是"排一行"。
3. 每头净空：`clear_i = hullReach_i + bobAlong + 16`，`bandY_i = card.top - clear_i`，夹到 `>= max(24, 0.12H)`；任何一头放不下 → null（不聚集，不硬塞）。
4. 槽位：按鲸鱼当前 x 排序从左到右发槽；槽距用既有互斥模型的 `personalSpace = 0.53*(len_a+len_b)`（`src/motion.js:761-765`）；一行放不下加第二行（交错 x，行高按跨行最近一对的 `sqrt(need² - dx²)` 抬升），最多两行；仍放不下则压缩/降级。
5. 朝向：水平 ±x，身体长轴平行卡片上缘；优先指向卡片中心，若需 >90° 掉头则保留当前 x 方向（避免跨屏大回转）。
6. 到位后冻结槽的 x，只跟随 y 与 ±3.5px 呼吸偏移，避免绕点转圈与左右追目标。

### 5.4 运动修改（只追加，未触发零差异）

- **速度**：远处 1.6–2× 巡游速，进带后降到 0.14×（默认配置约 2–4 px/s），仍走原 `targetSpeed` 平滑。
- **转向**：现 `turnLimit = agility * sqrt(speed)` 里的 `speed` 是配置倍率不是鲸速（`src/motion.js:857`），默认 180° 掉头要 14–18s。聚集期需 ×1.6–2（单测锁定只在 `engage>0` 生效），或坚持只发同侧槽位。
- **方位**：目标方向必须用环形最短差（`motionTorusDelta`），否则跨屏鲸鱼会朝另一侧直线游。
- **下潜**：沿用 `waiting` 路径，把条件扩成 `waiting || engage>0`（`src/motion.js:796,962-1000`）：进行中的一潜平滑回浮、不再抽新潜、不消耗随机数；释放后恢复正常 10–26s 再潜。
- **深度**：聚集期间跳过 `motionCruiseDepth` 漂移，避免体量呼吸破坏"静止"。
- **划水**：`activityStroke` 乘 `(1 - 0.55*engage)`，目标 <0.3；低于 `WATER_ACTIVE_STROKE = 0.42` 不再产生新尾纹（`src/water.js:13`）。
- **路线**：engage 期间不重抽 `motionTarget`、不加 wander 噪声、不执行"朝屏幕外保持"的提交规则；释放时补一次新航点散开。
- 与 activity 并存：聚集的 pace/朝向覆盖 activity pace，但徽记、座位、6 秒结果寿命完全不动。

### 5.5 "静止"的可测定义（进带 6 秒后）

速度 ≤ 0.2×有效巡游速度；中心到目标 ≤ 0.5×体长且 y 偏差 ≤ `clear_i`；朝向与水平线夹角 ≤ 25°；`submergence = 0`、期间新增下潜 0；`state.stroke ≤ 0.3`、期间新增尾纹/水花 0；任意两头鲸鱼躯干采样点不重叠（互斥避让保持启用）。

### 5.6 视觉与边界

| 条件 | 行为 |
| --- | --- |
| 默认 `glass: true` | 卡片是磨砂面板；聚集带在卡片上缘外锐利区，卡内只有模糊剪影 |
| `glass: false, composerAvoid: true` | 无面板无雾；避让矩形外扩 `max(26, 22+0.35*largestRadius)`、转向带 `max(48, hullReach*2, length*0.14)`，带高要再加这一圈，否则避让力会把鲸鱼推走 |
| 两者都关 | 带可更贴卡片；鲸鱼会压在输入框 DOM 上（既有行为） |
| 减透明 | panes 仍裁锐利区 → 与默认同样的带高要求 |
| 内容卡片压住带 | v1：变成磨砂剪影并记入观察项；P1：用 `readingLayout.contentPanes` 抬高带 |
| 前景媒体压住带 | 该区域被 `clearRect` 整块抹除（`src/engine.js:566-569`、`src/foreground.js:112-123`）→ 必须当 blocker 或降级 |
| 输入框变多行 | 卡片 top 上移，120ms 测量内跟随；y 量化 2px 防抖，靠转向跟随，不瞬移、不重排槽位 |
| 鲸数 1/3/5/8 | 体长随密度自动缩放；8 头最挤，必须专门验收 |
| 画布过小/没有带上空间 | 返回 null，保持巡游，不 clamp 进卡片 |
| 设置页 LivePreview | 不接听写状态，demo 卡片路径不参与 |
| `quietCenter` 默认开 | 中央列墨量降到 75%，聚集带会比边缘淡约 25%，可接受 |
| 窗口缩放/长会话 | anchor 由 resize 后 measure 更新；长会话最后一张卡片可能与带重叠（P1 已知缺口） |

**减少动态效果**：帧循环根本不跑（`src/engine.js:713`），做聚集只能瞬移，等于把大幅位置跳变塞进"减动态"路径。建议**不聚集**，只允许一次静态重绘；听写自己的气泡已是功能提示。若产品坚持静态姿态，另立选项单独验收。

**资源档（未来 spec）**：聚集不增加测量/绘制次数，锚点复用现有 120ms measure，对 15fps/250ms 预算无新增依赖。

### 5.7 开关与命名

v1 建议**不加新配置项**：只受总开关 `enabled`、`pauseOnScroll`、页面隐藏等既有条件约束；不跟 `activity`（任务跟随）开关绑定——那会把"彩蛋"和任务播报混成一个开关。若需要可发现性，README 增加一节 + GIF，而不是设置页开关。术语建议在 GLOSSARY 增加「听写聚集」：听写进行时鲸群到输入框上缘外聚集并静止的行为。

## 6. 原型证据（只作机制证据）

方法：把 `src/motion.js`、`species.js`、`rig.js` 复制到 `.scratch/research/motion/proto/`，用字符串替换插入约 80 行临时聚集分支（engage、目标朝向、速度档、抑制下潜/重抽/深度/边缘提交、划水衰减、turnLimit ×1.9），用 tracked `createScene` 跑 12s 自由巡游 + 30s 聚集 + 10s 释放，覆盖 1160×860（1/3/5/8 头、118 与 218px 卡片）、1600×900（3）、390×844（8）、680×360（8）。

| 观察 | 结果 |
| --- | --- |
| 接入机制 | 8 场景全部没有新下潜、没有逐帧跳变（最短周期位移核对误差 0），零速度/帧切分语义未破坏，释放正常 |
| 转向速率 | 第一版把鲸鱼按 x 发到对侧槽位，未加转向增益时有鲸鱼 30s 仍在 450–630px 外；加 1.9× 增益 + 就近竖直走廊后收敛（多数场景最终 ≤56px） |
| 环形方位 | 直接用 `target.x - whale.x` 会造出约 480px 的假距离；改用 `motionTorusDelta` 后收敛 |
| 互斥推挤 | 行距被压缩时第二排被推开/交叉，采样到的最小中心距只有 0.02–0.34× personalSpace（含接近途中交叉）→ 验收必须断言"静止期躯干不重叠" |
| 朝向扫入 | 朝向未转平时 5 个躯干采样点大量落在卡片矩形内（按帧累计数百到数千点）→ 必须在进带前收平朝向 |

**未验证**：建议的"槽位 + 到位冻结 x + 强朝向权重"完整组合没有在原型里跑过；上述常数是设计建议，不是实测观感参数。

## 7. 测试与验收

| 层 | 内容 |
| --- | --- |
| 桥接生产者（dictate） | provide 契约；映射全表；卸载补 idle；重复守卫；DOM 降级事件与 request 应答 |
| 桥接消费者（whale） | 服务缺失不改变渲染；硬 inject 仍为三项；attach→dispose→reattach 幂等；会话过滤；引擎收到状态序列 |
| 纯几何 `src/dictation.js` | 状态归一化；带在卡片上方并清空每头鲸的 body reach；无空间返回 null；槽位保持顺序且不需要整屏掉头；两行跨行间距达 personalSpace；bob 确定且有界；engage 单调可逆；朝向水平且不指进卡片 |
| 运动集成 | 离开巡游路线并减速进带；60 秒内躯干采样不进卡片/避让矩形；抑制新下潜并从进行中的下潜回浮；划水低于尾纹阈值；idle 后带新航点散开；快速来回切换不跳变不消耗额外随机；多行卡片上移；composerAvoid 带高抬升；1–8 头 × 三种窗口不重叠；减动态不启动循环；帧切分/零速度保持确定性 |
| 引擎 | `setDictation` 单帧重绘、不测字号不重建画布；resize/缺失输入框时 anchor 正确；状态变化不重建场景 |
| 真浏览器截图 | A 默认玻璃；B 8 头两行与窄屏；C 深色 + 减透明；D 玻璃关 + 避让开；E 多行输入框；F 长会话 + 内容/媒体遮挡；G 减动态逐像素一致；H 暂停/滚动暂退/缩放恢复。每张记录构建身份、主题、视口、DPR、配置；逻辑/指针/视觉三类证据分列 |

真实 DSH 验收（不能用独立预览代替）：安装两个插件后真实按住输入框录音 → 鲸群在 ~1–2s 内靠近、保持"静止"、松手后散开；禁用任一插件另一端无报错；HMR/reload 后能重连；DevTools 检查快照无文本/无 rect、`seq` 单调。

## 8. 实施顺序与工作量

| 步 | 内容 | 估时 |
| --- | --- | --- |
| 1 | dictate：`createDictationBridge` + apply provide + HoldToTalk 发布 + 测试；发布新版本（需授权） | 0.5–1 人日 |
| 2 | whale：`createDictationBridge` + Overlay/Canvas 接线 + `engine.setDictation` + 桥接测试 | 0.5 人日 |
| 3 | `src/dictation.js` 纯几何 + 单测 | 0.5 人日 |
| 4 | `src/motion.js` 聚集分支 + 集成测试（最重） | 1–1.5 人日 |
| 5 | 预览页测试入口 `__previewTest.dictation(state)` + 调参（入场时长/距离/bob/朝向） | 0.5 人日 |
| 6 | `pnpm build` + `pnpm preview` + `pnpm verify`；真浏览器 A–H 截图 + 真实 DSH 录屏/GIF | 0.5 人日 |
| 7 | 文档（本文件转设计纪要）、CHANGELOG、README 一节、GLOSSARY「听写聚集」 | 0.25 人日 |
| 合计 | 不含 dictate 发布等待 | **≈ 4–5 人日** |

发布编排：dictate 必须先进 profile（`dsh plugin` 更新或 pnpm 重装）才能做真实 DSH 验收；whale 是 `link:`，`pnpm build` 后刷新页面即可。二者都不改变插件运行时依赖。

## 9. 风险与开放项

1. **既有运动测试极脆**：`motion.test.js:139-149`、`random-dive.test.js:115-132`、`dive-heading-safety.test.js:100-114` 用 `deepEqual(whales)` 比确定性；所有新逻辑必须挂在 `engage > 0` 之后，不引入 `Math.random`/`performance.now`。
2. **转向速率**：不加增益时跨屏掉头 14–18s，"1–2 秒围过来"不成立；加增益会碰既有转向阈值测试，需要单测锁定只对聚集生效。
3. **朝向扫入卡片**：带净空只按横向半宽算，管不了竖直体长；进场阶段必须用更强朝向权重或更高净空。
4. **多行/多鲸互斥**：接近途中可能交叉，验收必须看躯干而不是槽位。
5. **视觉遮挡**：默认玻璃下卡内看不到锐利鲸鱼；长会话内容卡片、前景媒体会吃掉聚集带（v1 接受并记录，P1 用 blocker 抬带）。
6. **服务名所有权**：`dictation` 若未来被原生插件占用，先到先得且第二个抛错；生产者已用 `ctx.get` 守卫，但仍有理论上的同时激活竞态。
7. **HMR/开关抖动**：attach/detach 可能重复，所有订阅与监听必须幂等、对称清理。
8. **隐私**：快照绝不能带转写文本/音频/麦克风状态；DOM 降级事件任何页面脚本都能监听，这条尤其重要。
9. **未验证**：真实 DSH 窗口中的观感与手势、DPR≠1、低端设备帧率、8 头 + 长会话 + 媒体的组合；原型常数全部需要真实浏览器调参。
10. **当前安装版本差**：profile 里 dictate 仍是 2.6.0（本地仓库 2.7.0），新桥接不可用，除非重装。

## 10. 需要用户决定

1. **默认行为与开关**：v1 不加开关（推荐，只受总开关与既有暂停条件约束），还是增加「听写联动」配置项默认开？后者要动 FIELDS、locale、设置页与测试。
2. **"说完游走"的时机**：`processing` 开始就散（更像"说完"），还是结果插入（`done`）后再散（掩盖转写延迟）？建议 `processing` 后停留 0.4–0.8s 再散。
3. **聚集形态**：卡片上缘一条带（默认）是否够"围过来"？是否要同时利用左右两侧窄条、或允许两行？
4. **授权**：修改 dictate 仓库并发布/重装进 profile 属于跨仓库写操作，需要明确授权；whale 侧提交/推送同样分开确认。
5. **与脚手架工作的顺序**：两件事独立；先做彩蛋还是先抽 kit，只影响排期与验证顺序。

## 11. 证据与未验证

- 触发侧行号引用自本地 dictation 仓库（2.7.0）当前 `client.js`；安装版本为 2.6.0，行号可能随版本漂移。
- 宿主 cordis 语义与启动顺序事实来自本机安装构建解包（`.scratch/asar-all/`、`.scratch/current-api/`，app.asar 2026-10-23），不是上游书面文档；升级 DSH 后需重核。
- 运动原型只验证接入机制与三个风险，不是性能、观感或最终参数证据；未改动任何 tracked 文件。
- 原始逐行证据：`.scratch/research/bridge/findings.md`、`.scratch/research/motion/findings.md`（本地，未随仓库发布）。

## 实施与验证（2026-10-25）

规格实现落在 [docs/specs/dictation-echo.zh.md](../specs/dictation-echo.zh.md)：鲸群侧新增 `src/dictation.js`（聚集几何与客户端桥）、`src/voice-sea.js`（声浪场与绘制），状态经 `src/simulation.js`、`src/motion.js`、`src/engine.js`、`src/settings.js` 串起；生产者侧在 `dsh-hold-to-dictate` 的 `client.js` 提供 `dictation` 服务。开关落为 `FIELDS.dictationEcho`，默认开启，独立于任务跟随。

验证结果：

- `pnpm verify` 全部 388 项通过（含新增 `tests/dictation.test.js` 12 项、`tests/dictation-motion.test.js` 7 项、`tests/voice-sea.test.js` 17 项、引擎接线 1 项）；生成客户端与预览产物一致。
- 真实 DSH（独立测试 profile：web shell + 官方语音输入 bundle + 本地两个插件）用 CDP 驱动按住输入框录音 25 秒：录音气泡正常，输入框上方聚集带的墨量从约 3.9k 像素升至约 16.8k，转写完成并散开后 9 秒回落到约 8.8k；控制台无错误。帧与报告在本地 `.scratch/echo-capture/`。
- 独立预览页用 `__previewTest.dictation(state, level)` 对照静音与高音量：高音量时输入框周围出现额外的 `~`/`·`/`;` 声浪字形，静音时没有；done 后声浪停止并散开。
- 未验证：真实桌面窗口（本轮测试跑在独立 web profile）、真实麦克风手势、hands-free、不同 DPR 与低端设备帧率；视口为 1440×900、场景为 8 头鲸。

