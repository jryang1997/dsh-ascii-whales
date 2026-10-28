# DSH 插件共享脚手架研究

状态：研究结论已落地；kit MVP 存在于本地 ../dsh-plugin-kit，whale 已接入，dictate 迁移等待 kit 的 GitHub 仓库与 tag。日期 2026-10-25。
范围：`dsh-ascii-whales`（本仓库）与 `C:\Users\Jerry\Desktop\dsh_voice\dsh-hold-to-dictate`。两仓库只读核对；whale 工作区当时有未提交修改，未触碰。
配套研究：[听写聚集彩蛋](./DICTATION-GATHER.md)（事件桥与鲸群表现侧）。
原始证据在本地 `.scratch/research/scaffold/findings.md`（未随仓库发布）；本文只保留结论与可复核的行号。

## 结论

1. **用户点名的三个对象要分开看，直觉对、对象不对。** `project-check` 真实存在但只在 whale；`screenshots.json` 两边同形却**没有任何代码消费**；`scripts/ui-validation` 两边都不存在——whale 里真正存在的是 `.scratch/ui-validation/` 下两个**已被 git 跟踪**的 Chrome 脚本（提交 `92a06e3`），Chrome 路径硬编码在 `browser-sticky-check.mjs:18`。重复的是职责，不是同名文件。
2. **真正可抽的重复约 600–700 行**：检查策略、runner、产物一致性、浏览器截图、review/probe、文档与 CI 模板。两仓库实现方式不同（whale：pnpm + esbuild + `node:test`；dictate：npm + 无构建 + 纯脚本测试），所以 kit 必须把差异做成配置，而不是把任一边的实现当作标准。
3. **推荐：独立 npm 包 `@jryang1997/dsh-plugin-kit`**（devDependency、精确版本、零运行时依赖），新插件脚手架内嵌为 `dsh-plugin-kit init`；**不合并仓库**。
4. **迁移顺序：whale 先、dictate 后。** whale 工具链已接近目标形态且承载 85% 工具代码；dictate 迁移时顺带补 Node pin、pnpm、锁文件和双平台 CI。
5. **工作量：MVP ≈ 5.25 人日**（已能实现"第三个插件一天起盘"），完整版（含 Chrome UI 捕获、review/probe）≈ 10 人日。
6. **顺带发现一个需要决定的历史遗留**：whale 的 Release tarball 里打进了 `tests/ scripts/ preview/ .node-version pnpm-workspace.yaml`，却**没有**打进 README 引用的 22 个 `docs/images/*`。采用 kit 后 pack check 第一天就会报红，必须先定 tarball 策略。

## 1. 现状核对

### 1.1 用户点名的三个对象

| 对象 | whale | dictate | 结论 |
| --- | --- | --- | --- |
| `scripts/ui-validation` | `scripts/` 下不存在。存在 `.scratch/ui-validation/build-settings.mjs`（20 行）与 `browser-sticky-check.mjs`（191 行），**已被 git 跟踪**，但 `.scratch/` 在 `.gitignore` 中；断言是 whale 专属 DOM，Chrome 路径硬编码 | 无 `scripts/` 目录，无截图脚本；README 声称截图来自无头浏览器（`README.en.md:219`），但产出脚本未入库 | 两边都没有可复用的 ui-validation 入口；whale 的那些脚本正是应该抽走的东西 |
| `project-check` | `scripts/project-check.mjs` 58 行：发现文件、`node --check`、跑 `node --test`；策略测试 `tests/project-check.test.js` 72 行 | 无文件；等价逻辑是 `package.json:64-65` 两行显式链（7 个测试文件 + 3 个 `node --check`） | 只有 whale 有 runner，dictate 的链会在新增文件时过期 |
| `screenshots.json` | 8 行数组、6 个路径；唯一引用是 `package.json:46` 把它打进包 | 8 行数组、6 个路径；唯一提及是历史 CHANGELOG | 同形、零消费者、无校验、无生成器 |

### 1.2 两仓库形态对照

| 维度 | whale | dictate |
| --- | --- | --- |
| 包与分发 | `@local/dsh-ascii-ocean` 0.14.0，private，GitHub Release tarball | `@jryang1997/dsh-hold-to-dictate` 2.7.0，npm 发布 + GitHub 安装 |
| 客户端产物 | esbuild 生成 `client.js`，两份产物做 staleness 检查 | 手写单文件 `client.js`，ADR 明确不引入构建 |
| 工具链 | pnpm 11.28.5、`.node-version` 24.19.0、锁文件 | npm、无 `.node-version`、无锁文件（`.gitignore` 忽略） |
| 测试 | 42 个 `tests/*.test.js`（7,839 行）+ 389 行 helpers + 自定义 runner | 7 个 `tests/*.test.mjs`（2,276 行）+ 手写 `failures[]` 链 |
| CI | ubuntu + windows，pnpm，`pnpm verify`，`git diff --exit-code` | ubuntu，npm，Node 20，SHA 固定 actions，`npm run check` |
| 运行时依赖 | `@deepseek-ai/schemastery` | 无 |
| 开发文档 | `AGENTS.md` + 3 篇 `docs/agents/*`（139 行）+ `GLOSSARY.md` | `AGENTS.md` + 3 篇 `docs/agents/*`（59 行）+ `CONTEXT.md` + 5 篇 ADR |

### 1.3 真正重复的职责（按可提取价值排序）

| # | 职责 | whale | dictate | 现状 |
| --- | --- | --- | --- | --- |
| 1 | `files` 白名单与真实 pack 一致 | `tests/model.test.js`（约 23 行，按 manifest 意图查） | `tests/package.test.mjs:29-47`（真实 `npm pack --dry-run`） | 职责同、dictate 更硬，应合并成一种实现 |
| 2 | README 引用必须随包发出 | **缺失，且当前违规**（22 个 `docs/images/*` 引用，`files` 无 `docs/images/`） | `tests/package.test.mjs:23-42` | dictate 有、whale 缺 |
| 3 | 开发工具不得进发布包 | **缺失，且当前违规**（`package.json:37-57` 含 `scripts/ tests/ preview/ .node-version pnpm-workspace.yaml`） | `tests/package.test.mjs:57-59` | dictate 有、whale 缺 |
| 4 | 图标约束 | `tests/model.test.js`（约 8 行，SVG/尺寸/字节/内容） | `tests/package.test.mjs:50-56`（PNG/≤64 KiB） | 同职责、声明渠道不同，配置化 |
| 5 | locale 字典键对齐 | `tests/locale.test.js` + `tests/model.test.js`（约 14 行，JSON 为源） | `tests/locales.test.mjs:47-78`（从 `client.js` 抽内联字典） | 同职责、源不同，配置化 |
| 6 | locale `meta.title/description` | `tests/model.test.js`（约 6 行） | `tests/locales.test.mjs:68-78`（约 11 行） | 可完全共用 |
| 7 | 语法检查 | `scripts/project-check.mjs:9-28,43-46` | `package.json:65`（3 个硬编码文件） | 合并成发现式检查 |
| 8 | 测试发现与执行 | `scripts/project-check.mjs:39-53`（拒绝空套件） | `package.json:64`（显式链） | 合并；runner 要同时跑 `node:test` 与纯脚本 |
| 9 | 生成物 staleness | `scripts/browser-build.mjs:19-30` + `project-check` + `tests/browser-build.test.js` | 无（无构建） | 只 whale 需要，做成可选 helper |
| 10 | 截图清单 | `screenshots.json`，零消费者 | `screenshots.json`，零消费者 | 给 schema + 校验 + 捕获写入 |
| 11 | 浏览器 UI 验证/截图 | `.scratch/ui-validation/`（已跟踪、硬编码 Chrome） | 无（README 声称有） | kit 做统一捕获 + 各仓库写断言模块 |
| 12 | review 快照 / 读取探针 | `scripts/review-snapshot.mjs` 132 行、`scripts/read-probe.mjs` 56 行 | 无 | 通用 agent 工作流，可移植 |
| 13 | CI 模板 | 36 行，win + linux | 25 行，ubuntu；actions SHA 固定 | 生成默认模板，不覆盖仓库哲学 |
| 14 | 图标/README/CHANGELOG/AGENTS 模板 | 各一份 | 各一份（内容不同） | 只做脚手架模板，不做运行时校验 |

### 1.4 行数账

| 桶 | whale | dictate |
| --- | --- | --- |
| 全部开发脚本 | 6 文件 / 321 行 | 0 |
| 全部测试 | 7,839 行 + 389 行 helpers | 2,276 行 |
| 通用脚手架（估） | 约 900 行，可抽 500–600 | 约 280 行，可抽 140–180 |
| 只能留在本仓库 | 约 7,900 行渲染/运动/玻璃/活动测试、构建入口、预览页 | 约 2,100 行 render/live/plan/polish/glossary 测试 |

### 1.5 必须做成配置的差异

1. **构建 vs 无构建**：whale 需要产物 producer 与 `--check`；dictate 的 ADR 禁止构建。
2. **locale 源**：whale 以 JSON 文件为字典；dictate 的字典内联在 `client.js`，`locale/*.json` 只放 meta。
3. **版本落点**：`package.json` + CHANGELOG 标题（whale）vs `package.json` + `client.js` 里的 `VERSION` 常量（dictate）。
4. **图标渠道**：`exports["./icon"]` + SVG vs manifest `icon` 字段 + PNG。
5. **测试风格**：`node:test` vs 手写断言脚本；runner 两种都要能跑。
6. **CI 哲学**：tag vs SHA 固定 actions；kit 生成默认模板但不强制。

## 2. DSH 打包规则（kit 要校验的硬约束）

规则从本机安装构建解包源码核对（`.scratch/asar-all/`，对应 2026-10-23 的 app.asar），不是上游书面规范；kit 需要记录 `dshRulesVersion` 并在 DSH 升级后重核。

| 规则 | 证据 | 对 kit 的含义 |
| --- | --- | --- |
| `dsh.bundle.patch` 是包内相对路径，可为字符串或数组 | `dsh-app-boot__lib__index.js:510-531` | 两种都接受，校验文件存在 |
| `dsh.client` 要求 `platform: "web"`，可选 `inject/external/immediately`；声明它必须导出 `./client` | `dsh-client-modules__lib__index.js:40-69,732-738` | 校验声明形状与 `exports["./client"]` |
| 插件显示名/描述来自 `locale/en.json` 优先，再扫同目录 `locale/*.json`；`meta.title/description` 可缺省回退包名 | `dsh-app-boot__lib__index.js:2168-2198,2216-2239` | 要求 `locale/en.json`，校验 meta 键对齐 |
| 图标：manifest `icon` 相对路径，或导出 `<specifier>/icon`；SVG/PNG/JPEG/WebP；≤ 256 KiB | `dsh-app-boot__lib__index.js:2076-2111` | 两种声明都支持；仓库可再收紧（dictate 用 64 KiB） |
| 安装目标是一个包说明符，安装期脚本不属于契约 | whale `tests/model.test.js` 禁止 install 钩子；dictate 无依赖 | kit 自身零运行时依赖、无 postinstall |

## 3. 方案选择

| 选项 | 关键约束 | 维护成本 | 结论 |
| --- | --- | --- | --- |
| A. 发布 npm devDependency `@jryang1997/dsh-plugin-kit` | 两仓库独立、工具不进发布包、双平台 CI、可版本化 | 中：多一个公开包 | **推荐** |
| B. `git+https` devDependency 固定 tag | 同 A，但无 npm 发布 | 低发布成本、中：tag 可变、CI 拉取更慢 | 备选（不想发 npm 时） |
| C. 模板 repo + 同步脚本 | 仓库保持纯净 | 高：N 份副本漂移 | 只作为 init 模板的投递方式 |
| D. pnpm workspace / monorepo | 会合并两个公开仓库的身份、标签、发布通道、issue tracker | 低运行成本、高迁移成本 | **否决** |
| E. vendored 脚本 + 哈希校验 | 可离线 | 高：每修一次要同步每个仓库 | 离线场景的最后选择 |

推荐 A 的理由：kit 只进 devDependencies，`node_modules/` 不会出现在 `files` 白名单；检查只写一次、两个仓库按配置跑；精确锁版本 + 锁文件保证 CI 可复现；`init` 让第三个插件不必复制粘贴。若用户不想新增公开包，用 B，代码结构完全一样，只改依赖说明符。

## 4. 推荐的 kit 设计

### 4.1 包边界

- **kit 管**：文件发现、语法门、测试执行（`node:test` + 纯脚本）、产物 staleness、manifest/pack/icon/locale/README/screenshots 检查、review 快照、读取探针、Chrome UI 捕获、脚手架模板。
- **仓库留**：构建入口（esbuild 配置、预览页模板）、所有行为测试与插件语义、locale 文案、icon 美术、README/CHANGELOG、ADR、`cordis.patch.yml` 的 id、运行时依赖。
- 包形态：ESM、零 dependencies、无 install/prepare 脚本、Node ≥ 20.19、`bin: dsh-plugin-kit`、`exports` 暴露 checks/runner/artifacts/harness/ui/review/probe/scaffold。

### 4.2 CLI（精简）

```text
dsh-plugin-kit check                      # 语法门
dsh-plugin-kit test                       # 发现并执行两种风格测试
dsh-plugin-kit verify                     # check → artifacts --check → pack → screenshots → test
dsh-plugin-kit artifacts [--check]        # 配置的产物 producer / 只比较
dsh-plugin-kit pack                       # npm pack --dry-run + 策略断言
dsh-plugin-kit screenshots check          # 清单/文件/引用校验
dsh-plugin-kit ui capture|validate        # 本地 Chrome 截图与断言（不进 CI 必需路径）
dsh-plugin-kit review --base <ref>        # 审查清单
dsh-plugin-kit probe <paths...>           # 读取探针
dsh-plugin-kit init [--matrix minimal|built|ui]
```

约束：`verify` 遇到第一个失败阶段即停；`--check` 永不重建产物（保留 whale 现有不变量）；退出码 0/1/2。

### 4.3 配置

一个 `package.json` 键，未写的项取安全默认：

```json
{
  "dshPluginKit": {
    "version": 1,
    "dshRulesVersion": "installed-2026-10-23",
    "sources": ["index.js", "client.js", "src/", "tests/", "scripts/", "preview/"],
    "tests": { "include": ["*.test.js", "*.test.mjs"], "runner": "auto" },
    "artifacts": [{ "file": "client.js", "produce": "scripts/build.mjs" }],
    "pack": { "forbid": ["tests/", "scripts/", "preview/", ".github/"], "require": ["locale/en.json"] },
    "icon": { "declaration": "exports|field", "budgetBytes": 262144 },
    "locale": { "required": ["en", "zh"], "metadata": ["title", "description"] },
    "readme": { "files": ["README.md", "README.en.md"], "parity": ["headings", "figures"] },
    "screenshots": { "manifest": "screenshots.json", "strict": false }
  }
}
```

### 4.4 `screenshots.json` v2

保留旧数组兼容（`["docs/images/a.png"]` 归一化为 `{file}`），新格式带 id/页面/视口/主题/语言/是否减动态/引用方。检查分错误与警告：文件存在、被引用的 README 真的引用它、发布包包含该资源；未列出的图片、重复项、未引用项默认警告（`--strict` 升为错误）。捕获命令只在用户显式传 `--write-manifest` 时改清单。

### 4.5 版本与升级

kit 单 `1.x`：major = 会改变既有校验结论或配置 schema；minor = 新检查（默认 warn）；patch = 修复。两个消费者精确锁版本，各自升级；允许 lag 一个 minor，不允许跨 major。`dshRulesVersion` 记录 DSH 规则核对的构建版本。

## 5. 迁移路径

| 阶段 | 对象 | 做什么 | 完成门槛 |
| --- | --- | --- | --- |
| 0 | 新 kit 仓库/包 | 移植 whale 的 runner/review/probe/产物检查 + dictate 的 pack/README/leak 检查；配置、fixtures、CLI、发 1.0.0 | kit 自身 CI 在 ubuntu+windows 绿；fixture 仓库全绿；`npm pack` 只含 `bin/ src/ README LICENSE` |
| 1 | whale | 加精确 devDep；`scripts/project-check.mjs` 变 5 行委托；`pnpm verify` 命令名不变；先修 tarball 策略 | `pnpm verify` 覆盖今天的全部检查 + pack/README 检查；CI 两平台 `git diff --exit-code` 绿 |
| 2 | dictate | 补 `.node-version`、`packageManager`、`pnpm-lock.yaml`；换 kit 检查；CI 改双平台 | `pnpm verify` 绿；`client.js` 字节不变；`npm pack` 策略过；7 个测试仍跑 |
| 3 | 第三个插件 | `pnpm dlx @jryang1997/dsh-plugin-kit init my-plugin`；装进 scratch DSH profile 验证加载 | 新仓库 `pnpm install && pnpm verify` 绿，真实 DSH 能加载，发布包只含运行时文件；首个绿灯 ≤ 1 个工作日 |
| 4 | 两仓库 | 接 `ui capture/validate` 与截图 v2（本地/发布前跑，不进 CI 必需） | README 图片可由文档化命令复现；截图清单进 CI |

迁移期间不改变：`docs/agents/engineering.md` 规定的 `pnpm install --frozen-lockfile` → `pnpm verify` 语义；验证不重建产物；浏览器验收的三类证据。kit 改动需要同步更新该文档。

## 6. 第三个插件一天起盘（脚手架内容）

`init` 生成：`index.js`、`client.js`（built 变体由 `src/browser-entry.js` 生成）、`cordis.patch.yml`、`package.json`（`dsh.bundle.patch` + `dsh.client` + 精选 `files` + kit 脚本 + `dshPluginKit`）、`locale/{en,zh}.json`、`icon.svg`、`README(.en).md`、`CHANGELOG.md`、`AGENTS.md` + `docs/agents/*`、`LICENSE`、`.node-version`、`.gitattributes`、`.gitignore`、`screenshots.json`、`docs/images/.gitkeep`、`tests/{manifest,locale,behavior}.test.*`、`.github/workflows/verify.yml`、可选 `preview/`。

脚手架必须自证：无 install/prepare 脚本；`files` 只含运行时资源与要发布的文档；`dsh.bundle.patch` 与 `dsh.client` 都在；图标在预算内；`locale/en.json` 有 meta；README 双语言互链；`verify` 在临时目录全绿。

## 7. 风险

| 风险 | 级别 | 缓解 |
| --- | --- | --- |
| kit 过度抽象，掩盖各插件自己的断言 | 高 | 只收通用策略；每个检查有 fixture；业务测试留在仓库 |
| whale 的 pack 检查第一天就红（历史 tarball 违规） | 高 | 先定 tarball 策略；新检查先 warn 一个版本再 blocking |
| dictate 的"无构建、零依赖"身份被稀释 | 中 | devDependency 而已；`CONTRIBUTING.md` 明确运行时依赖保持为空；kit 自身零依赖 |
| 新增公开 npm 包的发布与供应链成本 | 中 | 精确锁、无依赖、无脚本、provenance；或用 git tag 方案 |
| Chrome UI 捕获在 CI 不可移植 | 中 | 仅本地/发布前可选；`CHROME_PATH` 发现；不进 `verify` 必需链 |
| Windows/Linux 路径与 pack JSON 差异 | 中 | kit CI 双平台跑 fixtures；路径统一正斜杠；LF |
| DSH 升级改变打包规则 | 中 | `dshRulesVersion` + 规则 fixtures，升级后重核 |

## 8. 工作量（熟悉两仓库的一个人）

| 工作项 | 人日 |
| --- | --- |
| kit 骨架（包、配置、CLI、CI、publish dry-run） | 0.5 |
| 检查项 + fixtures + 测试 | 2.0 |
| runner（发现、语法门、两种测试执行、产物检查、verify 编排） | 0.75 |
| harness exports（module loader、host context、fake DOM） | 0.75 |
| review/probe 移植与测试 | 0.5 |
| Chrome UI 捕获与截图 v2 | 1.5 |
| 脚手架模板 + init + 验收 | 1.5 |
| whale 迁移 + tarball 修复 | 1.0 |
| dictate 迁移 | 0.75 |
| 第三个插件试跑与文档 | 0.75 |
| **MVP（不含 ui、review/probe）** | **≈ 5.25** |
| **完整** | **≈ 10.0** |

## 9. 需要用户决定

1. **是否接受第三个公开产物**：npm 发布（推荐）还是 `git+https` 固定 tag？这会决定阶段 0 的入口。
2. **whale tarball 策略**：改成"只发运行时文件 + `docs/images/`、排除 dev 目录"（推荐，需版本号与 Release），还是保持"仓库进包"的意图并补 `docs/images/`？
3. **Node 基线**：两仓库统一到 24.19.0（whale 现状）还是降到共享 LTS？统一才能单点维护。
4. **v1 范围**：是否包含 Chrome `ui` 捕获与 review/probe？建议 v1 含 checks + runner + artifacts + scaffold + review/probe，`ui` 放 v1.1。
5. **新插件文档布局**：`GLOSSARY.md` 单上下文（whale）还是 `CONTEXT.md` + ADR（dictate，建议公开插件用这套）？

## 10. 证据与未验证

- 本机两仓库、git 历史与 DSH 安装构建解包源码只读核对；未安装依赖、未发布 npm、未运行 Chrome、未改动任何 tracked 文件。
- DSH 打包规则来自安装构建解包（2026-10-23），不是上游书面规范，标为推断；kit 应用 `dshRulesVersion` 固定核对版本。
- 未验证：kit 在第三个真实插件上的启动耗时；whale tarball 修复后 DSH 安装行为；npm 包发布链路。
- 原始证据与逐行引用：`.scratch/research/scaffold/findings.md`（本地，未随仓库发布）。

## 实施记录（2026-10-25，已完成发布）

- kit 已公开：github.com/jryang1997/dsh-plugin-kit，tag v1.0.0（发布 commit fc47d51，Release 带 npm pack tarball 与 SHA256SUMS）；零运行时依赖，kit 自身 127 项测试通过；CLI 覆盖 check/test/verify/pack/screenshots/artifacts/review/probe/init。
- whale 已接入并发布 0.15.0：devDependency 固定为 v1.0.0 tag 的 codeload tarball；五类静态检查、真实 pack 检查、产物 --check 与测试发现都走 kit；重复的三个脚本和两份工具测试删除。发布包为运行文件 + locale + 图标 + README/CHANGELOG + docs/images + docs/research（66 文件），开发目录由 pack 检查拒绝。
- dictate 已迁移并发布 2.8.0：devDependency 同为 kit v1.0.0；改用 pnpm + 锁文件 + `.node-version` 24.19.0，CI 改为 ubuntu + windows 双平台；`pnpm verify` 的 8 项测试通过。
- 两仓库 CI 均已在 GitHub Actions 双平台通过；whale v0.15.0 与 dictate v2.8.0 均有 Release 资产。
- 环境限制：本机对 github.com 的 git 访问被阻断（api.github.com、codeload.github.com 正常），推送通过 GitHub API 重建提交，因此远端 SHA 与本地不同、内容一致；依赖使用 codeload tarball URL 而非 `git+https`。
- 未完成：Chrome `ui` 捕获（计划的 v1.1）；npm 注册继续暂缓；真实桌面窗口验收需重启 DSH 后确认。
