# 复跑受控浏览器资源测量

此入口使用正式 `createWhaleLayer` 渲染器，对固定的模拟对话进行配对测量。维护者可以复跑相同内容、配置和事件表，并检查实际工作计数。测量表面是本地文件夹具，不是实际 DSH。工具不会发起模型请求、安装插件或改变 DSH 配置。

## 执行完整基线

在当前 worktree 根目录使用项目指定的 Node 和锁定依赖。先运行 `pnpm install --frozen-lockfile`、`pnpm build`、`pnpm preview` 和 `pnpm verify`。

```sh
node scripts/measurement.mjs
```

Windows 本机的明确入口如下。

```sh
'C:/Users/Jerry/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node.exe' scripts/measurement.mjs
```

默认每个单元预热 30 秒，采样 60 秒。静止阅读、追加文本和滚动各测三轮关闭与标准条件，共 18 个单元，至少需要 27 分钟。相邻两条件配对，第二轮反转条件顺序。初始化、前台 RAF 间隔探测与截图均在正式采样区间之外。所有轮次都保留。完整基线应在其他实现或构建任务结束后执行。

浏览器默认使用已安装的 Chrome，并保留正常 GPU 配置。每次运行建立独立 profile，只连接工具创建的空白页面。工具恢复该窗口为前台，并检查采样期间页面保持可见。结束时先通过 `Browser.close` 关闭浏览器，再等待退出；必要时仅终止该 PID 拥有的进程树。

## 执行短冒烟

```sh
node scripts/measurement.mjs --smoke --warmup-ms 1000 --sample-ms 2000 --rounds 1
```

缩短时长或轮数必须带 `--smoke`。输出标记为 `smoke`，完整基线标为 `NOT YET MEASURED`。冒烟只确认浏览器、采样、正式绘制、事件表和输出协议能工作，不构成 CPU、流畅性或资源收益结论。

可选参数如下。

| 参数 | 含义 |
| --- | --- |
| `--chrome PATH` | 使用已有 Chrome 可执行文件。不会下载浏览器。 |
| `--out .scratch/new-directory` | 在本 worktree 的 `.scratch` 下新建目录。拒绝覆盖已有目录。 |
| `--config PATH` | 读取一个 JSON 配置对象，按正式规则规范化。两条件共用同一配置。插件须启用，由独立 OFF 条件负责关闭。 |
| `--headless` | 显式使用无窗口 Chrome。记录此条件，不与有窗口结果混用。默认不开启。 |
| `--power-mode TEXT` | 保存操作员观察到的电源模式，不能冒充自动查询。 |
| `--background-load TEXT` | 保存操作员观察到的后台负载。 |

可以用 `--config` 独立执行八头鲸加落雨的压力组。不同配置需要分别完整配对。不能拿一个构建的标准档与另一个构建的后续档位计算收益。

## 输入与采样协议

固定种子为 20261025，逻辑视口为 1280 × 800，DPR 为 1。正式渲染器使用显式种子；夹具为独立页面中的其他随机调用提供相同种子。默认配置取当前正式 `DEFAULTS`。初始化生成相同的 60 张文本卡片和输入区。OFF 只省略插件挂载，仍保留全部宿主内容、CSS、Canvas 元素和同一事件调度器。

每阶段从固定事件序号开始。追加场景每 250 毫秒追加一批固定文本，标记为模拟生成。滚动场景每 50 毫秒推进 6 CSS 像素，到底后按相同规则回到顶部。事件采用相对于阶段起点的绝对期限，保存计划时间、实际执行时间、文本长度和实际滚动位置。预热继续产生对应场景的工作；正式阶段仅重置观察器和事件序号，不重建鲸群或清空内容。配对结束检查内容散列与计划事件表一致。

正式采样保存起点、每秒一次和终点的原始快照。终点单独保存完整绘制与布局时间表。每项结果携带环境、规范化配置、种子、Git HEAD、工作区状态、源码与生成文件的 SHA-256、夹具 bundle 散列。源码散列同时覆盖测量入口、CDP 适配器与校验协议，脏工作区也能追溯。采样结果写入独立文件后不再修改。

## 计数位置与 API

`createWorkMetrics()` 提供 `begin()`、`end(name, started, cause)`、`reset()` 和不可变 `snapshot()`。注册表 `WORK_METRICS` 定义计数项。通过 `createWhaleLayer(canvas, config, { metrics, seed })` 显式注入观察器，通过 `createWhaleSimulation(config, { metrics, seed })` 传入同一对象。无观察器时不获取额外观测时钟、不存储时间表，也不添加调度。

| 项目 | 实际执行位置 |
| --- | --- |
| `wakeup` | 正式引擎每次持续动画回调，包括提前退出的回调。 |
| `advance` | 仿真 `advance` 实际执行体，已经 dispose 的调用不计入。 |
| `motionStep` | `motion.js` 的固定 1/60 秒积分循环，每执行一次积分计一次。绝不由经过时间推算。 |
| `waterUpdate` | 仿真实际调用 `stepWater` 的执行时间，包括零步长下的清理检查。 |
| `atmosphereUpdate` | 大气时钟通过有效步长检查后实际更新的执行体。 |
| `rainUpdate`、`rainStep` | 降雨有效更新执行体，以及其内部每次 `advance`。关闭落雨时原实现仍维护降雨时钟，其真实工作照计。 |
| `spoutUpdate` | 正式绘制中的喷气更新与绘制调用，包括禁用检查。 |
| `draw` | 已完成的正式绘制，记录 animation、activity、config、foreground、sync 原因。未进入绘制的调用不计入。 |
| `layout` | 正式几何、文本和阅读保护测量过程。CDP 的实际浏览器 Layout 指标另列。 |

每项同时保存次数与同步执行毫秒数。绘制、布局和内部仿真存在包含关系，不能相加当总执行时间。`wakeup.durationMs` 是持续回调内的同步耗时，额外单次绘制需查看 draw 原因。时钟来自 `performance.now()`；时间表的 `atMs` 相对于观察器 reset。计时有观测开销，不是零成本探针。

观察器只保留最多 10000 条 draw/layout 事件，计数总量仍完整。发生截断时样本校验失败，不发布成功汇总。默认 60 秒采样无需提高此上限。计数测试通过半步和批量步长检查真实子步，并比较开启与关闭观察器的仿真、效果、正式绘制、阅读保护和卸载行为。

## CPU 与环境口径

浏览器级 CDP `SystemInfo.getProcessInfo` 在采样前后记录工具独立 Chrome 的进程类型、PID 和累计 `cpuTime`。CPU 秒数取同一进程树的累计差值。单核百分比为 CPU 秒数除以实际包围采样的墙钟秒数，再乘 100。整机归一化再除以逻辑处理器数。进程树变化、累计值倒退或接口缺失时，CPU 字段为 `null`，并保存原因，不填零。

CPU 包含该浏览器的 browser、renderer、GPU 和 utility 进程，也包含夹具事件、采样和 CDP 开销。它不是插件独占 CPU，更不是 GPU 利用率。前后查询存在边界耗时，原始查询与实际包围时长均保留。CDP `Performance.getMetrics` 另存 LayoutCount、LayoutDuration、RecalcStyleCount、RecalcStyleDuration、ScriptDuration 和 TaskDuration 的前后值及增量。

环境记录包含 OS、CPU 型号与逻辑处理器、CPU 原始系统 tick、内存、浏览器版本、GPU 设备和 Chrome featureStatus、启动参数、视口、DPR、页面可见性和动态效果偏好。Windows 下另存 `powercfg /getactivescheme` 和 `tasklist /FO CSV /NH` 的实际响应。系统 tick 和进程清单用于识别明显后台负载，不能将其他程序的工作归属给插件。Windows 不支持 Unix load average，明确记录为未测。

初始化前台 RAF 探测只记录浏览器实际回调间隔，不冒充物理刷新率。物理刷新率、Windows 有效电源滑杆状态、GPU 引擎利用率、功率和电池能耗均可能缺失，并明确列出。GPU 利用率与能耗始终为 `null`。不由 CPU 占用推算续航。此工具没有实际 DSH 宿主版本或插件安装来源的证据。

## 检查产物

工具打印 `.scratch/measurement-*` 输出路径，目录不会进入 Git。产物包括运行清单、环境、独立初始化与预热记录、每个采样单元、每个单元截图、Chrome 日志与汇总。每个采样单元保留原始快照、所有事件、错误、长任务、进程 CPU 前后值、浏览器指标前后值、配置和时间表。汇总给出每条件每场景的次数、毫秒、CPU 单核百分比、布局耗时与绘制间隔的中位数及范围。

缺少工作、页面隐藏、浏览器异常、计数倒退、时间表截断、事件缺失、配对内容不一致或持续时间严重偏离均返回非零状态。失败清单保留错误和已完成单元，不产生完整基线成功结论。CPU 等可选接口失败会留下明确未测字段与查询错误。检查 `manifest.status` 和 `manifest.cleanup.browserExited`，不能只看文件存在。

省资源条件明确为 `not-implemented` 且 `compared=false`，不会填零，也不输出三条件成功。当前汇总固定不发布收益结论。正式收益判断还需重复采样、范围、负载与瓶颈证据。真实 DSH 静止阅读、滚动、GPU、能耗和跨功能验收由父任务分别补测。
