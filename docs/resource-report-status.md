# #6 本地交付状态 / Local evidence status

2026-10-31 已在合并 1.0.0 后的构建（候选提交 `551fa13`，client `d962c6ed`）上重跑同一构建的三条件完整采样与独立剖析。**受控夹具内观察到 economy 的 CPU 和实际内部工作低于 standard；实际 DSH 资源收益仍未证实。** 正式宿主、真实指针与读屏验收未完成，Issue 保持开放。结果见[中文报告](./research/RESOURCE-COMPARISON.zh.md)、[English report](./research/RESOURCE-COMPARISON.en.md)及[原样机器生成公开 JSON](./research/resource-comparison-20261031.json)。

| 证据 | 状态及边界 |
| --- | --- |
| 三条件工具 | 默认三条件、三轮；最终完整批次实际使用五轮。按场景和轮次校验所有条件，不按数组邻接配对 |
| 真实工作 | OFF 全部插件工作为零，standard 实际 RAF，economy 实际 timer；真实积分、绘制、布局和全部注册指标入原始包。静置积分中位数 3600 → 1800 次，持续绘制 1584 → 709 次；追加文本的总绘制含前景刷新，不能当作持续绘制 |
| 短 Chrome 冒烟 | 已在隔离 headless Chrome 执行延长预算冒烟（30 秒采样、三场景三条件）与九单元短冒烟。保留全部原始样本、截图及状态探测。只证明执行与预算，不构成收益或 CPU 结论 |
| 渲染器状态探针 | 直接同步写入 DOM 镜像并观测 Canvas 完成，覆盖普通、突发、暂停及减少动态效果。镜像没有经过 React，不能证明正式 G2-04 文本提交预算。该批公开字段明确标记 rendererStatusProbe，formalReactCommitLatency 保持未测，不自动并入独立 React 观测 |
| 真实 React 隔离观测 | 已按合并后构建重生成来源清单并复核 40 次观察及探针实现。使用 React 18.3.1、未修改的正式客户端和模拟宿主订阅，两档、减少动态效果开关、普通及突发事件各五轮。React 摘要提交最大 6.1 ms，Canvas 命令完成最大 4.0 ms；仅该受控夹具内满足 250 ms。Canvas 端点不含 GPU 呈现，实际 DSH 与读屏仍未验证 |
| 正式产物集成 | 挂载设置覆盖场景保留 economy、个人文字与阅读偏好、legendSeen、重置、失败、版本冲突与主动载入；状态覆盖六秒寿命、身份接续和模式切换无重复播报 |
| 暂停与清理 | 沿用正式运行时夹具的隐藏、滚动暂退、减少动态效果、恢复及卸载验证。完整采样与独立诊断清单均记录 browserExited = true。逻辑成功不替代真实画面验收 |
| 最终完整采样 | 已完成 off、standard、economy × 三场景 × 五轮，共 45 个有效单元；每单元 30 秒预热、60 秒采样，采样于 2026-10-31 14:58–16:06 完成。45 份 cpuRaw 重算、15 组配对、2790 个快照、全部时间线及持续绘制预算通过；全程 visible、dropped = 0、浏览器错误和完整性问题均为 0。32 个来源哈希匹配当前文件；测量启动时唯一未提交文件是规格文档，不参与哈希清单。历史基线不参与本批比值 |
| 瓶颈剖析 | 已在合并后构建上重做独立、不计入正式 CPU 数字的九单元诊断，并解析九份 profile。热点位于云影采样、鲸体变形、深度字格解析、坐标变换及透明度衰减（静置 standard self time 约 483/448/369/205/170 ms）。可核实限制为主动调度节奏与绘制成本；未证明硬件 CPU 或 GPU 饱和 |
| 实际 DSH | 未测。当前 GUI `http://127.0.0.1:49621` 对无会话凭证的请求返回 401，且没有支持的代理认证通道；本任务不重复碰认证或弱化验收 |
| 指针、视觉与读屏 | 实际 DSH 未测。真实阅读保护、长名称、任务超额、深浅主题、长时间游动和至少一套读屏组合仍须实际证据 |
| GPU、功耗与物理刷新率 | GPU 利用率与能耗保留 null，功率收益、续航及物理刷新率未测。GPU 进程 CPU 不是 GPU 利用率，RAF 回调间隔不是显示器 Hz |

English status: The full same-build comparison has been rerun on 2026-10-31 on the build after the 1.0.0 merge (candidate `551fa13`, client `d962c6ed`): 45 valid samples, three conditions, three scenarios, five rotated rounds, 30-second warmup, and 60-second sampling. All raw CPU deltas, 15 paired triples, 2790 snapshots, timelines, budgets, and 32 source hashes were checked. Economy observed lower Chrome-tree CPU and less actual internal work in this controlled fixture. A separate nine-unit profile was analyzed and excluded from reported CPU. Independent mounted React evidence has 40 observations, with maxima of 6.1 ms for React commit and 4.0 ms for Canvas command completion. Actual DSH (current GUI returns 401), visible-pointer, reading-protection, and screen-reader acceptance remain unverified. GPU utilization, energy, power gain, battery life, and physical refresh rate remain unmeasured. Historical baseline results are not combined with this build.

公开 JSON 原样保留机器判定 inconclusive、formalReactCommitLatency 未测及 limiterProfile 未测说明；这些字段只适用于该批生成器聚合的证据，生成器未自动并入独立 React 与诊断批次。人工报告分别引用额外证据，不改写机器判定或补造 null，不宣布全部验收通过。公开报告保留白名单聚合、每轮数值、中位数、范围与证据限制，不链接本机 Chrome profile、原始进程清单或私有环境包。

模拟状态素材已按合并 1.0.0 后的构建（`173c793`，client `d962c6ed`，与测量构建只差文档提交）重新生成。12 张 PNG、两份四帧 GIF 及[来源清单](./images/status-demo-manifest.json)包含正式构建与源文件散列，打包使用现有 Pillow 并核对来源；13 个来源哈希全部匹配当前文件。页面与素材持续标明模拟，真实 DSH 录屏仍为 UNVERIFIED。复跑方法见[演示来源](./research/TASK-DEMO.md)。

本轮在合并构建上重跑了测量、构建与完整测试（478 项/63 文件）；撤销 2026-10-25 旧构建的数值作为当前比较，旧数据保留为历史公开 JSON。复查 22 项验收仍待真实宿主与读屏；复跑命令及结果判读见[中文方法](./measurement.zh.md)、[English method](./measurement.en.md)和[报告模板](./resource-report-template.md)。
