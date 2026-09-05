# 诘将棋启动器：PC 接口契约与 UI 规划

更新时间：2026-09-05

这份文档用于约束 PC 版后续迭代，也作为 Android 版接入前的共同数据语言。当前不提前锁定 Android 的具体技术方案；先保证题目、棋局状态、引擎结果和训练记录可以独立演进。

## 一、当前 PC 程序边界

最终 PC 交付形态是一个可双击的 Windows x64 便携程序：

    TsumeLauncher.exe
      ├─ TsumeLauncher.html
      ├─ launcher.js
      ├─ puzzle-data.js
      ├─ server.ps1
      ├─ puzzles/
      └─ engines/
         ├─ yaneuraou/
         └─ shtsume/

本地程序负责三件事：

1. 启动一个随机本地端口的 localhost 服务；
2. 在专用窗口中加载训练页面，并隐藏浏览器菜单、开发者工具和状态栏；
3. 关闭窗口时结束本地服务及其引擎子进程。

Start.bat 作为唯一启动脚本，负责打开 TsumeLauncher.exe。本版本不再提供浏览器回退入口；如果缺少 WebView2 Runtime，程序应明确提示安装该运行时。

## 二、稳定数据接口

### 1. Puzzle

~~~json
{
  "id": 1,
  "mateLength": 5,
  "initial": {
    "pieces": [{ "owner": "attacker", "type": "R", "x": 1, "y": 1 }],
    "hands": { "attacker": {}, "defender": {} }
  },
  "solution": [],
  "quality": "validated",
  "score": 0,
  "hash": "局面哈希",
  "collection": "curated",
  "source": "题源标识"
}
~~~

solution 是当前兼容格式中的参考手顺。正常训练不使用它否定用户的合法王手，只用于题目手数、参考答案和应手引擎故障时的回退。未来多解题使用 solutionTree 替代或补充它，不破坏已有题目。

### 2. Move

~~~json
{
  "from": [file, rank],
  "to": [file, rank],
  "drop": "R",
  "promote": false
}
~~~

坐标统一为将棋九宫格坐标：file 和 rank 都是 1 到 9；页面显示的 1一、SFEN 的 1a 和内部数组坐标必须通过一个转换函数处理，不能在各模块中重复自行换算。

### 3. ProgressRecord

~~~json
{
  "attempts": 0,
  "wrong": 0,
  "solved": false,
  "marked": false,
  "skipped": 0,
  "seconds": 0,
  "bestSeconds": 0,
  "failed": 0,
  "hints": 0,
  "answerShown": 0,
  "engineFallbacks": 0,
  "lastPlayed": 0,
  "solvedAt": 0
}
~~~

记录主键使用 mateLength:id。以后做 PC/Android 同步时，不能用题目在数组中的序号作为主键。

## 三、引擎和规则接口

### 1. TsumeRules

规则模块应保持纯状态输入输出，不直接操作 DOM：

    validateAttack(position, move)
      -> { ok: true }
      -> { ok: false, message: string }

    applyMove(position, move, owner)
      -> nextPosition

    isKingAttacked(position, owner)
      -> boolean

    toSfen(position)
      -> string

当前 PC 页面已经先做棋子走法、吃子、打入、升变、攻方玉安全和“是否形成王手”的即时检查。下一步若需要单元测试，应把这些函数从 launcher.js 提取为无 UI 的 TsumeRules 模块。

### 2. EngineBridge

前端只依赖下面这个抽象，不直接依赖 YaneuraOu 或 shtsume 的命令行细节：

    health()
      -> { ok: boolean, responder: boolean, solver?: boolean, version: string }

    reply({ sfen })
      -> { ok: true, reply: string, engine: "yaneuraou", engineMs? }
      -> { ok: false, reason: string }

    solve({ sfen })                 // 可选的题源/诊断接口，不用于正常训练
      -> { ok: true, firstMove?, reply?: string | null, mateLength?, engineMs? }
      -> { ok: false, reason: string }

当前实现：

- GET /api/health
- GET /api/storage、POST /api/storage：读写本机训练记录文件；
- POST /api/engine/reply
- POST /api/engine/solve
- 服务端启动一个常驻 YaneuraOu worker，启动阶段完成 USI 握手和 NNUE 预热；
- 用户下出合法王手后，页面把当前局面发送给 /api/engine/reply，只消费玉方 bestmove；
- 不比较用户着法和引擎首着，不把引擎 reply 与题库主线比较，也不要求引擎证明整题为诘；
- 最后一手按题目手数完成，不再调用引擎做“最后一手证明”；
- YaneuraOu 不可用、无合法应手或接口异常时，页面透明回退到题库应手并记录回退次数；
- /api/engine/solve 仅保留为 shtsume 的辅助求解/诊断入口，正常训练不调用它，不暴露用户可调时限。

后续如果换成 YaneuraOu、长驻 USI worker 或 Android 本地引擎，只需要实现同一层 EngineBridge，页面训练状态不应跟着重写。

### 3. TrainingSession

建议把页面当前的隐含状态整理成以下接口：

    startPuzzle(puzzle, { countAttempt: boolean })
    submitAttack(move)
    receiveDefenderReply(move, source: "engine" | "fallback")
    undo()
    restart()
    mark()
    giveHint()
    showAnswer()
    finish(result: "solved" | "failed" | "skipped")

对外只发布状态变化，不让 UI 直接修改棋盘：

    puzzleChanged
    positionChanged
    feedbackChanged
    engineStateChanged
    progressChanged
    achievementsChanged

现在为了保持便携版简单，这些接口仍集中在 launcher.js 中；接口名称和语义先固定，后续拆文件不会改变用户数据格式。

## 四、PC 本地 HTTP 合同

只保留本地程序需要的最小接口：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | / | 返回训练页面 |
| GET | /TsumeLauncher.html | 页面直达入口 |
| GET | /puzzle-data.js | 返回内置题库 |
| GET | /launcher.js | 返回训练逻辑 |
| GET | /api/health | 检查本地服务和引擎 |
| GET | /api/storage | 读取本机训练记录 |
| POST | /api/storage | 原子写入本机训练记录 |
| POST | /api/engine/reply | 根据用户刚下出的王手，快速返回玉方应手 |
| POST | /api/engine/solve | 可选的 shtsume 题源/诊断主变，不由训练页面调用 |

训练记录文件固定保存到 Windows 用户本地目录 `%LOCALAPPDATA%\TsumeLauncher\training-data.json`。文件内容沿用现有 progress、ProgressRecord 和题目主键结构，不把题库、引擎或远程账号数据写入其中。不为剪贴板、KIF、普通棋局复盘或远程账号同步预留复杂入口；今后真要加入同步，应单独增加版本化的数据导入导出接口，不能让本地训练接口直接承担云同步。

## 五、当前 UI 已完成和建议继续精细的地方

### 已完成的核心体验

- 默认进入诘将棋，不显示普通棋局功能；
- 5/7/9 手、精选/扩展/全部题库切换；按顺序刷题为默认模式，也支持随机刷题、上一题和下一题；
- 暖木色和风训练主题、深色棋盘边框、实体棋子和统一牌面持駒；
- 合法走法和王手即时拦截；
- 常驻 YaneuraOu 启动预热、应手中/就绪/回退状态、自动玉方应手和安全回退；
- 任意合法王手都可进入应手流程；引擎不承担正解首着比较或整题证明；
- 题目头部显示当前进度，等待玉方时锁定棋盘并给出明确反馈；
- 悔一步、重新开始、严格手数、错题/标记重刷；
- 提示只显示当前一手；答案进入标准将棋手顺格式的参考棋谱回放，可从题面初始局面用“< / >”逐手推演；成り选项贴在目标棋子上方；
- 成功时在棋盘区域内显示不阻塞操作的通关庆祝卡，不再使用失败弹窗，失败后自动重开；
- 计时、最快成绩、连续天数、进度和成就。
- 统计页提供今日、本周、本月的完成、练习、错误、重开、完成率和平均用时；
- 棋盘坐标放在外沿，加入四个标准星位，棋子字体优先回退到本机明朝/思源宋体类字体；

### P0：PC 版完成前还值得做（非阻塞）

当前版本已经补上预热状态、当前进度文字、非法着法分类、窄屏持駒牌、暖木棋盘和周期统计；剩下的精细项可以在实际使用一轮后按感受调整：

1. 在棋盘下方增加轻量的“正在等待玉方”动效；
2. 引擎失败时提供“重试一次”按钮，但默认继续训练；
3. 记录最近一次实际引擎分支，答案页标注“题库参考手顺 / 本次引擎手顺”；
4. 视窗口高度把当前进度文字升级成小型完成进度环，避免增加桌面信息密度。

### P1：增加动力但不改变核心范围

- 每日任务完成条和每周目标；
- 按手数、难度分和完成状态筛选；
- 成就分成“速度、坚持、手数、错题回收”四条成长线；
- 个人最好成绩与最近五次成绩；
- 可选音效、系统通知和深色主题；
- 训练记录导出/导入 JSON；
- 最近做过的题和连续失败提醒。

### P2：等题库模型升级后再做

- 多个正解和多个玉方应手分支；
- 解答树浏览；
- 题目标签、作者和解说；
- 引擎复核报告；
- PC 与 Android 的同步；
- 在线排行榜或账号体系。

## 六、Android 迁移边界

Android 版先复用以下稳定内容：

- Puzzle、Move、ProgressRecord 数据语义；
- TsumeRules 的无 UI 规则测试；
- EngineBridge 的抽象，而不是 Windows PowerShell 进程细节；
- 成就条件、严格手数和训练结果枚举。

Android 不直接缩放 PC 页面，应该重新设计首页、题库页、解题页、统计页和设置页。具体采用 Compose、Flutter、Kotlin Multiplatform、Room/DataStore 或其他方案，等 PC 版验收后再结合目标 Android 版本、同步方式和引擎部署成本讨论。

同步也延后决定。届时需要先在 PC 版补上版本化的记录导出/导入，再决定是文件同步、局域网同步还是云端同步；没有明确同步方案前，不把账号系统和联网依赖塞进 PC 版。

## 七、开发约束

- 正常训练只消费引擎返回的玉方应手，不比较题库线性正解、引擎首着或引擎主变；
- 不提供用户可调引擎时限；快速节点预算属于服务端内部实现细节；
- 没有王手的着法即时拦截，不让引擎承担明显的 UI 规则提示；
- 引擎不可用时允许透明回退，但要记录回退次数；
- 题库数据、训练记录和界面样式分离；
- 新增功能优先通过接口和事件接入，不直接修改多个 UI 回调；
- Android 迁移前先补齐规则单元测试和数据版本号。
