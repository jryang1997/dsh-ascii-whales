# 复跑三条件资源比较

此入口在同一受控模拟对话上运行正式渲染器。默认比较 OFF、standard 和 economy。OFF 只省略插件工作，保留相同内容、样式、Canvas 元素和事件调度器。它不访问实际 DSH，不发起模型请求，不安装插件。

## 运行完整比较

使用项目指定的 Node 24.19.0 和 pnpm 11.28.5。在当前工作树执行依赖安装、构建和验证。

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm preview
pnpm verify
node scripts/measurement.mjs --headless --conditions off,standard,economy --rounds 5 --warmup-ms 30000 --sample-ms 60000 --out .scratch/full-three-condition-new
```

默认值是三轮，每单元预热 30 秒、采样 60 秒。三场景、三条件共 27 个单元，至少 40.5 分钟。benchmark-checklist 使用五轮，共 45 个单元，至少 67.5 分钟。运行前停止其他构建和测试，记录实际电源与后台负载。所有轮次都保留，不挑选最好结果。

历史两条件入口仍可运行 `--conditions off,standard`。三条件是默认最终协议。只接受包含 OFF 和 standard 的两项或三项唯一合法名称。`--rounds`、时长和条件列表均经过校验。短于完整协议必须带 `--smoke`。

每个场景的条件顺序逐轮旋转。前三轮为 OFF→standard→economy、standard→economy→OFF、economy→OFF→standard。三轮时每个条件占据每个位置一次。五轮时每个位置出现次数差至多一次。配对键是场景与轮次，比较完整二元组或三元组，不假定相邻两条就是配对。

## 检查短冒烟

```sh
node scripts/measurement.mjs --smoke --headless --conditions off,standard,economy --warmup-ms 1000 --sample-ms 2000 --rounds 1 --out .scratch/three-condition-smoke-new
```

冒烟只验证工具执行、事件表、真实工作、像素和文件协议。报告标为 smoke，完整比较保持未测，不能从短样本宣称 CPU 或资源收益。默认 Chrome 保留 GPU 配置，`--headless` 显式记录无窗口条件。页面 `visible` 不等于有可见窗口或通过指针验收。

参数 `--chrome PATH` 选择已有浏览器。`--out` 只允许当前工作树 `.scratch` 内的新目录。`--config PATH` 读取并规范化 JSON，三条件共用全部视觉参数，仅运行时档位由条件决定。`--power-mode TEXT` 与 `--background-load TEXT` 保存本地操作员说明。八头鲸和落雨压力组使用独立配置、独立完整运行，不与默认组混算。

## 固定输入与真实工作

种子固定为 20261025，逻辑视口 1280 × 800、DPR 1。初始化生成相同的 60 张卡片和输入区。静止阅读无内容事件。追加场景每 250 毫秒追加固定批次的模拟文本。滚动场景每 50 毫秒移动 6 CSS 像素，到底按相同规则回绕。

预热和正式阶段分别从固定事件序号开始。正式阶段只重置观察器，不重建鲸群或清空预热内容。每单元保存计划及实际事件时间、文本长度、滚动位置和最终内容散列。每个场景、轮次的所有条件必须具有相同内容散列、计划事件、配置、种子、视口和采样时长。

[工作注册表](../src/work-metrics.js) 在执行位置记录以下次数和同步耗时。

| 指标 | 实际含义 |
| --- | --- |
| wakeup | 持续 RAF 或 timer 回调，另存真实调度通道次数 |
| refreshWakeup | 状态或布局的单次 RAF 回调 |
| scrollWakeup | 滚动静默定时器回调 |
| advance | 仿真推进执行体 |
| motionStep | 真实物理积分循环，standard 每步 1/60 秒，economy 每步 1/30 秒 |
| waterUpdate、atmosphereUpdate | 实际水面与大气更新 |
| rainUpdate、rainStep | 实际降雨更新与内部推进 |
| spoutUpdate | 绘制时的喷气处理，包括禁用检查 |
| draw | 完成的正式绘制，保留 animation、activity、config 等原因 |
| layout | 几何、文字与阅读保护测量 |

所有注册项必须存在。OFF 必须全部零工作，活动条件必须实际执行调度、内部积分、绘制与布局。economy 必须实际使用 timer，standard 使用 RAF。稳定 animation 绘制分别受 15 Hz 和 30 Hz 预算校验，必要状态和布局绘制另计。预算不是设备帧率。绘制时间表记录完成时刻及耗时，调度间隔用二者相减得到绘制起点。

计时来自 `performance.now()`，观察器默认最多保存 10000 条 draw/layout 事件。截断、计数倒退、终点不一致、错误、隐藏页面、无绘制像素、事件缺失和输入分歧会失败。包含关系中的执行毫秒不能相加当总开销。零毫秒可能来自时钟分辨率，不能视为未做工作。

## 分别验证状态终点

正式采样外，对每个活动条件探测普通事件、50 次突发合并和暂停事件，并分别覆盖减少动态效果开关。原始探测保存事件送达、DOM 文本提交和正式 Canvas 绘制完成时间。文本与 Canvas 两个终点都必须在 250 毫秒内完成，不能只选较快的一端。

该文本终点是夹具 `onActivityChange` 的同步 `textContent` 提交，不能代替已安装 DSH 的 React 提交或读屏发声。正式产物测试另从宿主订阅输入检查摘要、Canvas、模式切换、任务身份、六秒截止时间、草稿冲突及图例偏好。滚动暂退、隐藏和卸载沿用真实调度夹具。真实 DSH、可见窗口指针、阅读保护观感和实际读屏仍分别验收。

## 保存环境和 CPU 口径

CDP `SystemInfo.getProcessInfo` 保存隔离 Chrome 进程树的 CPU 前后累计值。单核百分比是 CPU 时间差除以包围采样的实际墙钟时长，再乘 100。整机百分比再除以逻辑处理器数。进程树变动、累计值倒退或查询缺失时保留 `null` 和原因。

CPU 包含 browser、renderer、GPU、utility 进程及夹具、采样和 CDP 开销，不是插件独占 CPU。GPU 进程 CPU 不是 GPU 利用率。浏览器 Layout、Style、Script、Task 等指标保留前后值和增量。系统原始 tick、内存、浏览器版本、加速 featureStatus、启动参数、视口、DPR、可见性与系统偏好保存在本地环境包。

Windows 的电源方案和进程清单只留在本地原始环境中，用于识别背景负载，不上传或写入 Git。前台 RAF 探测不冒充物理刷新率。GPU 利用率、功率、电池能耗和续航均未测，字段保持 `null`。工具不将占用率换算为省电比例。

## 分开剖析和正式运行

```sh
node scripts/measurement.mjs --limiter-probe --smoke --headless --conditions off,standard,economy --rounds 1 --warmup-ms 1000 --sample-ms 5000 --out .scratch/unreported-limiter-probe-new
```

`--limiter-probe` 只允许与 `--smoke` 一起使用。它在采样阶段保存独立的 `*-unreported.cpuprofile`，清单标为 limiter-probe，公开报告不输出其性能数字。剖析会干扰计时。将热点映射到源码后，再单独运行无 profiler 的完整比较。缺少独立瓶颈证据、CPU 无法归属或差异被轮次范围覆盖时，结论保持未证实。

## 打开结果并准备分享

本地输出包含 manifest、environment、每单元 initialization、warmup、sample、status-latency、PNG、Chrome 日志和 summary。schemaVersion 2 区分三条件协议。校验所有预期场景、条件、轮次，缺失组也明确列出。失败保留已完成样本与错误，不能把局部结果写成完整比较。

`report-public.json` 和 `report-public.md` 从原始允许指标生成每轮、组中位数和范围。白名单排除本地路径、原始文本、进程 PID、进程清单、用户电源说明和任意错误正文。分享前仍需审阅文件。其他原始文件和 Chrome profile 保持私有，不在公开文档中链接。

入口始终保持资源收益结论为 inconclusive。完整采样通过只表示受控比较数据齐全，不代表 G2-08 已通过。维护者还需结合独立剖析、实际工作量、执行时间、重复 CPU、双终点响应和真实宿主证据作判断。参阅[中英文报告模板](./resource-report-template.md)及[本地交付状态](./resource-report-status.md)。
