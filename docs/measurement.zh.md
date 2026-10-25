# 受控浏览器资源测量

[完整三条件协议](./measurement-protocol.zh.md)说明运行方式、真实工作指标、输入配对、环境与 CPU 口径、独立瓶颈剖析及隐私边界。当前入口默认 OFF、standard、economy，每场景三轮。五轮完整命令如下。

```sh
node scripts/measurement.mjs --headless --conditions off,standard,economy --rounds 5 --warmup-ms 30000 --sample-ms 60000 --out .scratch/full-three-condition-new
```

历史两条件基线用 `--conditions off,standard` 重新运行。旧构建基线只用于工具历史验证，不与当前 economy 计算收益。短冒烟必须带 `--smoke`，不能作为完整资源收益证据。

测量使用固定模拟对话及正式渲染器，不是实际 DSH。报告分开记录逻辑、真实指针、视觉、读屏及性能证据。GPU 利用率与能耗保持未测。

[English method](./measurement.en.md)提供英文复跑说明。[中英文报告模板](./resource-report-template.md)及[交付状态](./resource-report-status.md)记录公开材料和尚未测量的验收。原始环境与浏览器 profile 只留本地，分享使用工具生成的白名单聚合报告。
