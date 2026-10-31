# 工程验证与审查

## 修改与验证

使用 `.node-version` 指定的 Node 版本，以及 `package.json` 的 `packageManager` 指定的 pnpm 版本。
执行 `pnpm install --frozen-lockfile` 安装依赖。项目只维护 pnpm 锁文件。
esbuild 从对应平台的 optional dependency 取得二进制，安装策略不运行它的 postinstall。

日常验证运行 `pnpm verify`，由 devDependency `@jryang1997/dsh-plugin-kit` 执行，配置在 `package.json` 的 `dshPluginKit` 键：先做清单、locale、README、版本与语法五项静态检查，再以 `--check` 比较两份生成产物（不重建）、检查真实 `npm pack` 的发布内容与 `docs/images/` 引用、校验 `screenshots.json`，最后发现并运行测试。
测试发现覆盖根目录与 `src/`、`tests/`、`scripts/`、`preview/` 的 `*.test.js`/`*.test.mjs`，跳过隐藏目录与 `node_modules/`；不会扫描仓库中的 `.scratch/`、`.agents/`、参考项目或依赖。新增测试放入这些目录即可被执行，`tests/helpers/` 的适配器参与语法检查。
`pnpm check` 跑上述静态检查，`pnpm test` 只运行测试。kit 以 v1.0.0 tag 的 GitHub tarball 固定引用（`https://codeload.github.com/jryang1997/dsh-plugin-kit/tar.gz/refs/tags/v1.0.0`），CI 可直接安装。本机对 github.com 的 git 访问受限，因此不使用 `git+https` 说明符；升级 kit 时同时改 URL 中的 tag 与锁文件。

修改浏览器实现后，先运行 `pnpm build` 和 `pnpm preview` 更新 `client.js` 与 `preview/whale-preview.html`，再运行 `pnpm verify`。构建入口位于 `scripts/build.mjs` 和 `scripts/preview.mjs`。
验证命令本身不重建产物：发现过期就失败，使漏提交生成文件在本地与 CI 都能被发现。
GitHub Actions 在 Windows 与 Linux 使用锁定依赖运行同一条验证命令，不安装插件、不发布 Release。

## 准备审查

运行 `pnpm --silent review:snapshot --base <ref>`，取得 JSON 审查清单（委托给 kit 的 `review` 命令）。
工具固定基线及 merge-base，列出相关提交、已跟踪改动和所有未忽略的新增文件，并记录当前文件散列；删除文件也保留条目。
清单只写到 stdout，按需要把输出保存在系统临时目录，供两个审查代理共用。不要把凭证文件放入清单。

派单时同时说明需求来源、本轮范围及验收条件。
已生成文件通过生成入口、行为测试和一致性检查覆盖；人工审查重点看实现源码。
复审应明确本轮修复涉及的文件和原发现，不用整份历史差异替代增量范围。
清单不是文件快照。审查过程中有写入时，重新生成清单并核对散列后再交付结论。

## 子代理读取预检

第一次使用某个子代理执行路径时，先派一个小任务，用该代理自己的原生文件工具读取 `AGENTS.md` 和 `src/engine.js` 前十行。
得到成功回报后再在同一执行路径批量派任务。回报应区分直接读取成功、调用方转述与未核实信息。
读取拒绝时保留工具错误，暂停依赖该读取的任务；查明对应权限或执行路径配置后再继续，不换 shell 绕过拒绝。

`pnpm --silent agent:probe` 可补查文件存在性、命令进程的读取能力和 SHA-256，不输出正文（委托给 kit 的 `probe` 命令，默认查 `AGENTS.md` 与 `src/engine.js`）。
显式文件及其他仓库使用方式见 `pnpm --silent agent:probe -- --root <dir> <paths...>`。
该命令只证明运行它的进程可以读取文件，不能替代子代理原生工具的读取预检，也不修复权限。

## 浏览器验收

浏览器操作先读取当前 `ego-browser skill`，再核对所用 Page、当前 URL、viewport 和窗口状态。
窗口最小化、页面隐藏或目标已失效时，先恢复并重新读取页面状态，再进行指针操作或截图。
按工具返回的 target/window 信息操作，不猜 target 标识。逻辑测试可在无需可见窗口时单独执行。
当前宿主没有可用浏览器技能或认证通道时，把该项如实记为未测，不伪造点击、截图或宿主证据；真实宿主验收的待办、阻塞条件与证据矩阵见 [host-acceptance.md](./host-acceptance.md)。

分别记录三种证据，缺少任一项就如实标为未测：

| 证据 | 可以证明 | 不能替代 |
| --- | --- | --- |
| 逻辑与命令流 | 配置处理、状态接续、Canvas 实际绘制命令及产物一致性 | 真实指针命中、字体栅格和画面观感 |
| 指针交互 | 真实点击、拖动、键盘、遮挡和焦点行为 | 长时游动和最终视觉质量 |
| 视觉验收 | 字形、玻璃效果、遮罩、主题与动态观感 | 全部逻辑边缘情况和跨设备性能 |

模拟页面事件只计入逻辑证据。窗口不可见导致指针验证失败时，不把事件处理成功写成点击验收通过。
实际 DSH 验收还需确认正在使用的插件来源和构建；打开独立预览不等于更新当前 DSH 窗口。
性能数字须有单独测量，不能由测试运行耗时推断设备帧率。

## GitHub 同步

同步前运行 `pnpm verify`，检查完整工作区清单和未跟踪文件，保留任务之外的用户修改。
同步采用普通提交与非强制推送；若远端已前进，先检查差异并整合，不覆盖远端历史。
推送后核对 GitHub 上的提交 SHA 与 Verify 两个平台的结论。失败时读取对应日志并修复后重新验证。
提交同步、插件安装及 Release 发布是不同操作，按当前用户授权范围执行。
