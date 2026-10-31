# 资源比较报告模板 / Resource comparison report template

结论 / Verdict: **未证实 / Inconclusive**.

本模板没有测量数字。完成最终构建的完整采样与独立瓶颈剖析后再填入允许指标。Keep this verdict until repeated measurements, both status endpoints, and an independent limiter profile support a narrower claim.

| 项目 / Item | 待填内容 / Required evidence |
| --- | --- |
| 构建 / Build | Git commit, source hash, fixture bundle hash, dirty state |
| 表面 / Environment | Controlled Chrome fixture or actual DSH, browser version, headless state, viewport, DPR, visibility |
| 条件 / Conditions | Same seed, normalized visual config, content hash and planned events for OFF, standard and economy |
| 轮次 / Repetition | All rounds, balanced order, 30-second warmup, 60-second samples, five rounds for benchmark review |
| 工作 / Work | Each round, median and range for wakeups, real integration, draw, layout and synchronous time |
| CPU | Each round, median and range, process scope, denominator, missing queries and background-load limitations |
| 响应 / Status latency | Both text and Canvas endpoints, ordinary, burst, paused and reduced-motion cases |
| 瓶颈 / Limiter | Separate unreported profile, hotspot-to-source mapping and load-generator scope |
| 异常 / Failure | Invalid units, missing groups, process-tree changes and all retained errors |
| 压力 / Stress | Separate eight-whale and rain configuration, never pooled with default config |

GPU utilization / GPU 利用率: **未测 / Unmeasured**.

Energy and battery endurance / 能耗与续航: **未测 / Unmeasured**. Do not derive endurance from CPU utilization.

Actual installed DSH / 实际已安装宿主: **未测 / Unmeasured**.

Screen reader / 实际读屏: **未测 / Unmeasured**.

Visible-window pointer, visual protection and long swimming / 可见窗口指针、阅读保护观感和长时游动: **未测 / Unmeasured**.

只分享审阅后的工具白名单报告。Share only the reviewed generated public report. Keep raw environment, process inventory, local paths, and Chrome profiles local. Do not link them from a Git-tracked public report.

完整复跑 / Full reproduction:

```sh
node scripts/measurement.mjs --headless --conditions off,standard,economy --rounds 5 --warmup-ms 30000 --sample-ms 60000 --out .scratch/full-three-condition-new
```

[中文方法](./measurement.zh.md) · [English method](./measurement.en.md) · [当前证据状态 / Current status](./resource-report-status.md).
