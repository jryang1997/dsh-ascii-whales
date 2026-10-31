# 任务演示来源与第一组验收记录 / Task demo provenance

本记录对应 [GitHub #3](https://github.com/jryang1997/dsh-ascii-whales/issues/3)。**文案和模拟素材已准备，票据未完整验收。真实已安装 DSH 的状态录屏、真实宿主指针键盘和实际读屏证据仍缺失。**

The bilingual introduction and simulated assets are prepared. **Issue #3 is not fully accepted. The installed DSH status recording, actual host interaction evidence, and screen-reader evidence remain missing.** A standalone fixture cannot substitute for these requirements.

## 素材身份 / Asset identity

新增素材全部来自隔离 Chrome 中的文件夹具。夹具加载仓库正式 [client.js](../../client.js)，通过正式 Overlay、任务状态追踪器、图例和 Settings 组件渲染。没有另画徽记或仿制设置组件，也没有真实模型请求、用户对话、用户配置或已安装插件参与。

The new assets use the formal plugin artifact in an isolated file fixture. The fixture supplies simulated host stores and a local config form. The state badges, text summary, legend, presets, and editor come from the production components. No user conversation or installed-host content is captured.

- 本轮生成时的 HEAD 基线为合并提交 `336b41a10a150860fef501badb52708de7641a51` 之后的构建（含绘制节流修正）。实际正式客户端 SHA-256 为 `d962c6ed4e73f3c080acdaaf18042e9f2503314cfb484ad8db03623352c19965`。每张图顶部显示基线与客户端散列前缀，13 个当前源文件散列记录实际输入。
- 浏览器版本、源文件散列、React 输入与校验和、逐帧配置、图片散列和检查结果见[生成清单](../images/status-demo-manifest.json)。生成脚本记录执行时的 HEAD，并单独散列当前实际源码，不将未提交脚本冒充基线内容。
- 固定随机种子为 `20261025`，视口为 1280 × 1000，像素比为 1，浅色主题，系统减少动态效果开启。此配置用于静态状态演示，不证明游动、下潜或性能。图中的画布宽度受夹具布局约束，为右侧图例预留空间。
- 状态图关闭阅读减淡、毛玻璃、文字边缘效果、云影与风纹，浓度为 0.85，便于辨认徽记。设置图使用默认场景和既有阅读保护。每帧实际表单值随清单保存。
- React 18.3.1 的 MIT 许可发行文件仅用于本地夹具，不随新增媒体嵌入或发布。生成器从固定 URL 下载到临时工作目录，并核对固定 SHA-256；也可使用 `--react-dir` 提供同一校验和的本地副本。

The four GIF frames are still captures of successive simulated states, each held for 1.8 seconds. They are **not motion recordings**. The formal renderer remains static under reduced motion while state changes still redraw the badges. Build demo and Check demo are distinct background tasks. The session becomes idle after waiting; it never receives a success badge. Historical completed tasks are not injected as new results.

本轮在资源档位及审查修复完成后重新生成全部状态与设置素材，并核对当前源文件散列。2026-10-31 又按合并 1.0.0 后的构建（`336b41a`）整体重生成一次，清单中的源码散列已与当前文件一致。The assets were regenerated after resource-mode, the accepted review fixes and the 1.0.0 merge; their manifest records the current source hashes. 后续源码再次变化时，仍需按下方命令重新生成，不能沿用旧截图冒充新构建。

## 静态帧 / Still frames

无需播放动图即可查看四个状态。

| 状态 / State | 简体中文 | English |
| --- | --- | --- |
| 运行 / Running | [运行帧](../images/status-zh-running.png) | [Running frame](../images/status-en-running.png) |
| 等待 / Waiting | [等待帧](../images/status-zh-waiting.png) | [Waiting frame](../images/status-en-waiting.png) |
| 已观察完成 / Observed completion | [完成帧](../images/status-zh-completed.png) | [Completion frame](../images/status-en-completed.png) |
| 另一任务失败 / Separate task failure | [失败帧](../images/status-zh-failed.png) | [Failure frame](../images/status-en-failed.png) |
| 场景与初始隐藏图例 / Presets with legend hidden initially | [中文设置](../images/settings-zh.png) | [English settings](../images/settings-en.png) |
| 主动展开图例 / Explicitly opened legend | [中文图例](../images/settings-zh-legend.png) | [English legend](../images/settings-en-legend.png) |

中英文 README 自带静态文字图例。设置图来自同一个正式组件，保持现有英文界面名 Glyph whales；介绍对外名称为 ASCII Whales。旧 [巡游](../images/cruise.gif)、[下潜](../images/dive.gif)、[拍尾](../images/tail.gif)和[落雨](../images/rain.gif)素材、署名及安装说明保持原样。它们原有的真实 DSH 来源不构成本次新状态功能的宿主证据。

The README legends explain running, waiting, known idle, observed completion and failure, and unavailable or undetermined state without requiring animation. Missing capability does not imply idle. A stopped subagent does not imply success. Cancelling, stopping, disconnecting, or losing a task does not create a result badge.

## 复跑 / Reproduction

使用仓库固定的 Node 24.19.0 与 pnpm 11.28.5。PNG 生成需要 Chrome。GIF 打包需要 Python 与 Pillow；本次使用 Pillow 12.3.0。两步均只处理此仓库的模拟夹具，不连接 DSH，不安装插件，不修改用户配置。已有依赖时不必重复安装。

```sh
pnpm install --frozen-lockfile
node --test tests/status-demo.test.js
node scripts/status-demo.mjs
python scripts/status-demo-media.py --input .scratch/status-demo --output docs/images
```

Chrome 不在 Windows 默认位置时，传入 `--chrome PATH`。`--out DIRECTORY` 指定新的生成目录，随后将同一目录传给 Python 的 `--input`。离线运行可通过 `--react-dir PATH` 指定包含两个固定版本 UMD 文件的目录。生成过程保留临时 HTML、Chrome 日志与完整清单，均在被忽略的 `.scratch/` 内。仅打包脚本明确列出的 12 张模拟 PNG、两份 GIF 和媒体清单进入公开素材目录。

The generator verifies the formal text summary at every stage, checks both preset pickers, confirms that every visible field appears once and the legacy hidden field stays hidden, and checks save, reload, and legend controls. Preset changes use scripted change events. Save, reload, and legend-open use CDP mouse events in headless Chrome. Legend-close uses Enter on a programmatically focused button. These are **fixture checks**, not visible-window pointer or actual DSH acceptance.

The packaging script verifies all source PNG hashes and dimensions, then checks that each GIF contains exactly four frames with the documented duration. Source hashes let reviewers distinguish a new client build from the earlier integration baseline. Chrome, operating system, and font differences may change pixels on another machine.

## 验收分列 / Acceptance boundaries

| 验收项 / Acceptance | 本次证据 / Evidence | 仍缺失 / Missing |
| --- | --- | --- |
| G1-10 配置与双语集成 | 正式设置组件的双语场景、草稿不提前保存、保存保留文字、重新载入、图例初始隐藏和可重开、所有可见字段各一次、隐藏旧字段不展示；既有配置与冲突回归随项目验证运行 | 真实宿主中的同路径复查 |
| G1-11 介绍与状态素材 | 双语任务价值前置、静态图例、正式渲染器模拟四状态、两个独立后台结果、逐帧构建与条件记录 | **真实已安装 DSH 录屏**，需记录插件来源、构建、宿主版本、主题及条件 |
| G1-12 构建与证据 | 构建和预览一致性由 `pnpm verify` 检查；夹具逻辑与截图单列，不能据此宣布全部通过 | 真实宿主可见窗口的指针、键盘与视觉；实际浏览器加屏幕阅读器的版本、查询摘要、播报去重和焦点记录 |

本轮 `pnpm build`、`pnpm preview` 与 `pnpm verify`（合并 1.0.0 之后）均通过，完整测试为 478 项通过、0 项失败、63 个测试文件。13 个源文件散列与 12 张 PNG＋2 份 GIF 的媒体散列匹配；每份 GIF 的四帧、每帧 1800 毫秒和全部 PNG 的 1280 × 1000 尺寸通过打包校验。状态演示入口另用真实 React 18.3.1 和未修改的正式构建（client `d962c6ed`），在模拟宿主订阅送达后通过 MutationObserver 观测摘要提交，并在实际 Canvas 等待徽记绘制后记录同步命令完成。两档、减少动态效果开关、普通及突发事件交替五轮，共 40 次；本次观测中摘要提交最大 13.5 毫秒、Canvas 命令完成最大 3.5 毫秒。逐次结果保存在生成清单的 `reactStatusLatency`，仅表示该受控夹具满足 250 毫秒，不是资源收益或真实宿主验收。现有 GUI 返回 401 的边界由父级确认，真实 DSH 录屏、可见窗口指针与读屏仍未验证，不能据此更新为通过。

No CPU, GPU, energy, battery-life, or resource-saving result is claimed here. Final comparison data belongs to ticket 06. The reduced-motion fixture and test execution time are not performance measurements.
