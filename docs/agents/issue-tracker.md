# Issue tracker: GitHub

本仓库的任务和规格记录在 GitHub Issues，使用 `gh` CLI 操作。
仓库为 `jryang1997/dsh-ascii-whales`；在仓库内运行时，gh 从 Git 远程推断目标。

## 常用操作

- 创建：`gh issue create --title "..." --body-file <正文文件>`
- 读取：`gh issue view <number> --json number,title,body,labels,comments`
- 列表：`gh issue list --state open --json number,title,body,labels,comments`，按需添加标签或状态筛选。
- 评论：`gh issue comment <number> --body-file <正文文件>`
- 添加或移除标签：`gh issue edit <number> --add-label "..."` 或 `--remove-label "..."`
- 关闭：`gh issue close <number>`
- 子任务：gh 2.94+ 使用 `gh issue create --parent <parent> ...`，
  或 `gh issue edit <parent> --add-sub-issue <child>`。
  不支持子任务时，在子任务正文首行写 `Part of #<parent>`，并在父任务中添加任务清单。

多行正文先写入临时文件，再通过 --body-file 传入。
对外写入操作遵循当前会话的用户授权范围。

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub 的 Issues 和 PR 共用编号。编号类型不明时，先用
`gh pr view <number>` 判断，失败后再检查对应 Issue。

## 技能用语

技能要求“发布到问题跟踪器”时，指创建 GitHub Issue。
技能要求“获取相关任务”时，指读取对应 Issue 及评论。

## Wayfinding operations

- Map 是一个带 `wayfinder:map` 标签的 Issue，正文记录 Notes、Decisions-so-far 和 Fog。
- Child ticket 是 Map 的子任务，标签为 `wayfinder:<type>`，
  type 取 research、prototype、grilling 或 task；不支持子任务时使用上述父子链接约定。
- Blocking 使用 GitHub 原生依赖：
  `gh api --method POST repos/{owner}/{repo}/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`。
  数据库 ID 用 `gh api repos/{owner}/{repo}/issues/<n> --jq .id` 获取。
  不支持原生依赖时，在正文首行记录 `Blocked by: #<n>`。
- Frontier 按 Map 顺序选择没有未关闭阻塞项、也没有负责人的首个开放子任务。
  原生依赖用 `issue_dependencies_summary.blocked_by` 判断。
- Claim：`gh issue edit <n> --add-assignee @me`。
- Resolve：评论结果、关闭任务，再向 Map 的 Decisions-so-far 添加结论及链接。
