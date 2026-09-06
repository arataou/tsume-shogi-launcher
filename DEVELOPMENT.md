# 开发、分支与发布流程

本项目采用“小目标、可回溯、阶段性发布”的开发方式。小变更优先走快速通道，完整功能、架构调整和发行物仍走完整流程。当前公开基线仍是 `v0.1.0`；修复一个问题、补充一份说明或重新打包，不自动产生新版本。

## 1. 开始前确认仓库事实

每个开发目标单独处理，开始时先完成一次仓库预检，再按任务规模选择流程：

1. 查看当前分支、`git status --short --branch`、`git worktree list --porcelain` 和相关文件状态，并执行 `git fetch origin`；
2. 只阅读与当前任务有关的 `README.md`、开发记录、接口规划或启动说明；涉及数据、架构、发布物或兼容性时再补读对应完整文档；
3. 明确本轮目标、验收方式和会影响的文件；
4. 涉及题目 ID、`progress` / `ProgressRecord` 或存档路径时，先确认数据兼容边界。

一个会话尽量只负责一个目标。目标完成后先验证、沉淀文档，再开始下一个目标。

## 1.1 小变更快速通道

适用于只改少量文件、不改变数据格式/API/整体架构，并且有明确针对性验收方式的小功能和小缺陷修复。自动推送、创建 PR 和合并 `main` 仍然是必做步骤；快速通道只减少不必要的前置阅读和本地分支往返。

1. 完成第 1 节的仓库预检，尤其是先刷新 `origin/main`；确认目标 worktree 目录不存在、目标分支没有被占用；
2. 从最新 `origin/main` 创建一个专用 worktree 和分支；主工作区保持只读，不在 PR 前把专用分支合并到本地 `main`；
3. 只修改本轮目标文件，执行针对性测试、`node --check` 或相关脚本检查；
4. 查看 `git diff --check` 和 staged diff，确认没有混入其他窗口或其他目标的改动；
5. 提交并推送专用分支，创建 PR；检查通过且 PR 可合并时，直接通过 PR 合并到远端 `main`；没有自动检查时，也必须确认 PR 状态为可合并后再合并；
6. 合并后执行 `git fetch origin`，核对远端提交、工作区和 worktree 状态，并向用户报告完整交付结果。

如果开发期间远端 `main` 前进，只在自己的分支上同步并重新运行相关检查。不要先合并本地 `main` 再创建 PR，也不要为了处理远端变化重复创建“交付 worktree”。

小变更不自动执行完整发行验收；只有用户要求重新打包、涉及宿主程序/引擎/发行物，或变更可能影响安装包时，才进入第 5 节的完整发布门槛。

## 2. 分支与多窗口协作

功能、修复和文档分别使用短生命周期分支：

- `feature/<主题>`：新增用户功能；
- `fix/<主题>`：缺陷修复；
- `docs/<主题>`：只改说明和规划；
- `build/<主题>`：构建、发布和打包流程调整。

完整功能或持续调试任务应在独立 worktree 中进行；小变更按第 1.1 节执行。创建 worktree 前必须先刷新远端引用：

```powershell
git fetch origin
git worktree add .\.worktrees\<task-slug> -b codex/<task-slug> origin/main
```

多个窗口同时开发时，必须为每个分支使用独立的 Git worktree 或独立的仓库副本。例如：

```powershell
git fetch origin
git worktree add .\.worktrees\<task-slug> -b fix/<主题> origin/main
```

仅仅创建不同分支、却让多个窗口共用同一个目录，不能保证不冲突：两个窗口仍可能同时修改同一份文件，甚至互相看到未提交的工作区变化。独立 worktree 能隔离工作区，但不能消除合并冲突；`launcher.js`、`TsumeLauncher.html` 和规划文档属于高概率共享文件，合并后仍需人工检查并重新测试。

推荐的并行顺序是：

1. 各窗口只处理已分配的目标和文件；
2. 每个窗口完成本地测试后提交自己的分支；
3. 通过 PR 一次只合并一个分支，先处理冲突，再运行必要回归；不在 PR 前重复做一次本地 `main` 合并；
4. 合并完成后再删除临时 worktree 和已完成分支，不删除仍有未提交改动的目录。

用户明确提出的小功能和范围明确的小缺陷修复，验证通过后自动推送分支、创建 Pull Request 并合并到 `main`。如果权限、冲突、检查失败或其他外部条件阻止该流程，应停在安全位置并说明原因；未经用户明确要求，不删除原始 worktree。

### 2.1 合并后同步实际运行目录

专用 worktree 只用于隔离开发，不能视为用户实际启动的目录已经更新。当前运行目录是：

```text
D:\个人开发软件\诘将棋启动器\outputs\ShogiExplorer-Tsume
```

每次 PR 合并到 `main` 后，若变更涉及启动器页面、训练逻辑、题库或运行说明，必须按以下顺序同步并确认：

1. 在根目录 worktree 检查 `git status --short --branch`，确认没有用户或其他窗口的未提交改动；
2. 确认 `outputs/ShogiExplorer-Tsume` 是当前仓库根目录下的目标目录，并从已合并的 `main` 安全 fast-forward；
3. 禁止用 `reset`、`clean`、`stash`、强制覆盖复制或删除来处理冲突。发现分叉、脏工作区、路径不一致或运行中的其他版本时，先停下并报告；
4. 同步后确认 `TsumeLauncher.html`、`launcher.js`、`puzzle-data.js`、`server.ps1`、`Start.bat`、`engines` 和 `puzzles` 仍存在，再运行 `node --check .\outputs\ShogiExplorer-Tsume\launcher.js` 和适用的启动/服务检查；
5. 普通源码同步不自动替换 `TsumeLauncher.exe` 或生成/覆盖 `ShogiExplorer-Tsume-Full.zip`。宿主从自身目录启动 `server.ps1`，页面和题库由该目录提供，因此前端源码更新后可以复用现有 EXE，但仍需做一次启动冒烟；如果改动宿主、服务、引擎或打包逻辑，必须走完整发布验收。

同步必须遵守以下兼容性约束：

- 不改变 `outputs/ShogiExplorer-Tsume` 内现有文件和目录的名称、相对路径及 `Start.bat` 入口；
- 不改变 `%LOCALAPPDATA%\TsumeLauncher\training-data.json`、`mateLength:id` 题目主键和已有 `progress` / `ProgressRecord` 字段；
- 新增 `settings` 或记录字段必须有默认值和归一化逻辑，读取旧 JSON 时保留未知字段，不能通过同步或启动清空用户训练记录；
- 发行物与源码分开验收：只有明确进入发布批次时，才重新构建宿主、替换 EXE、生成 ZIP，并从全新解压目录验证启动、记录读写和引擎回退。

## 3. 提交规范

一个提交应表达一个完整、可解释的变更，不把无关重排、版本号、二进制文件混在一起。建议使用以下前缀：

- `feat:` 新功能；
- `fix:` 缺陷修复；
- `docs:` 文档；
- `refactor:` 不改变外部行为的重构；
- `build:` 构建或发布流程。

提交前至少检查：

```powershell
node --check .\outputs\ShogiExplorer-Tsume\launcher.js
node --test .\tests\tsume-rules.test.js
git diff --check
```

确认改动只包含本轮目标后再提交。`TsumeLauncher.exe` 和 `ShogiExplorer-Tsume-Full.zip` 是 Release 产物，不进入 Git 源码历史。

## 4. 版本更新节奏

版本号按用户可感知的阶段性里程碑更新，而不是按提交次数更新：

- 仅修复小问题、调整文档、重构内部代码或重新打包：通常不升版本；
- 多个相关功能形成可完整验收的一批变化后，再考虑发布一个新版本；
- 新版本必须同时完成回归、生成完整便携包、更新 README / 使用说明 / 开发记录，并在 GitHub Release 中附上 ZIP；
- 当前这轮本地存档修复、单一入口清理和目标格选择修复继续属于 `v0.1.0` 的开发维护，不创建新版本号或标签。

后续若形成正式里程碑，版本号、变更摘要、压缩包和 Release 应在同一发布批次中更新，避免出现“代码刚提交就连续发版”的情况。

## 5. 发布前验收门槛

涉及页面逻辑时，检查 JavaScript 语法、棋盘交互、合法/非法目标格和记录读写；涉及本地服务时，检查 PowerShell 语法、`/api/health`、`/api/storage` 以及异常路径；涉及宿主时，用 Release 配置重新发布 Windows 单文件程序。

完整发布批次应执行：

1. JavaScript 语法检查；
2. PowerShell 解析检查；
3. 宿主程序 Release 发布；
4. 关闭正在运行的旧 EXE 后替换 `outputs/ShogiExplorer-Tsume/TsumeLauncher.exe`；
5. 运行 `build-release.ps1` 生成完整 ZIP；
6. 检查 ZIP 中存在 `TsumeLauncher.exe`、`Start.bat`、题库和引擎，且不存在已删除的浏览器入口；
7. 从干净解压目录实际启动并验证关键流程。

## 6. 会话交接与文档沉淀

阶段完成时，把最终有效的架构和取舍写入开发记录；当前结构性决定写入 `ARCHITECTURE.md`，重要取舍写入 `DECISIONS.md`，未完成事项写入 `TODO.md`。如果必须切换窗口但目标尚未完成，留下 Session Handoff，至少包含目标、已验证事实、已完成工作、剩余问题、下一步和相关文件。聊天内容只作为当前工作台，不作为唯一项目记录。
