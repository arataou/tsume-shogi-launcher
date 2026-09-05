# 诘将棋练习启动器

一个面向 5 / 7 / 9 手诘将棋的 Windows 便携式练习程序。界面只保留诘将棋训练、题库、应手引擎、统计和成就，不依赖 Shogi Explorer 或 ShogiHome。

## 功能

- 内置 1084 道题：精选集 457 题，扩展练习集 627 题；
- 攻方任意合法王手即可继续，不比较用户着法和题库首着，不要求引擎证明整题为诘；
- YaneuraOu 常驻提供快速玉方应手，异常时使用题库回退应手；
- 自动检查合法走法、王手、打入、二歩、升变和玉方自王手；
- 可选严格手数、悔棋、重开、跳过、提示、答案、标记题/错题重刷；
- 训练记录、连续天数、最快成绩、成就，以及今日 / 本周 / 本月统计；
- 暖木色和风棋盘、外沿坐标、标准星位、统一的棋子与持駒牌面；
- 完全离线运行，不包含剪贴板导入、KIF 导入或普通棋局复盘。

## 使用

推荐下载 Releases 中的 `ShogiExplorer-Tsume-Full.zip`，解压后进入 `ShogiExplorer-Tsume`：

1. 双击 TsumeLauncher.exe；
2. 也可以使用 Start.bat 启动独立窗口。

训练记录、设置、统计和成就保存在电脑本地的 `%LOCALAPPDATA%\TsumeLauncher\training-data.json`。EXE 每次启动都会读取同一份文件，不受随机本地端口或浏览器站点数据影响；题库不会写入该文件。本版本不迁移旧浏览器站点记录。

源码仓库不提交约 163 MB 的 `TsumeLauncher.exe`，该文件随 Windows Release 压缩包发布；这样可以避开 GitHub 普通文件的 100 MB 限制。只克隆源码时需要先按下方说明重新发布宿主程序，`Start.bat` 只负责启动已发布的独立窗口。

## 项目结构

    src/
      TsumeLauncherHost/       独立窗口宿主源码（自动启动本地服务）
    outputs/
      ShogiExplorer-Tsume/
        TsumeLauncher.html       页面和视觉样式
        launcher.js              训练状态、规则和统计
        puzzle-data.js           内置题库
        server.ps1               本地服务与引擎桥
        TsumeLauncher.exe        Windows 独立窗口宿主（Release 附件）
        engines/                 YaneuraOu、shtsume 和授权说明

## 重新打包

在仓库根目录运行：

    powershell -ExecutionPolicy Bypass -File .\build-release.ps1

脚本会把 outputs/ShogiExplorer-Tsume 打成 outputs/ShogiExplorer-Tsume-Full.zip。压缩包是发行物，不建议作为日常 Git 提交的一部分。

## GitHub 发布建议

源码、题库、说明文档和运行时文件可以跟随版本提交；最终 ZIP 作为 GitHub Release 附件。这样既方便跟进 HTML/JS/题库版本，也避免每次提交都重新携带大型发行包。

## 开发流程

分支、提交、多窗口协作、版本更新节奏和发布验收门槛见 [DEVELOPMENT.md](DEVELOPMENT.md)。当前维护批次继续使用 `v0.1.0`，不会因为单个修复或重新打包立即升版本。

## 第三方组件

- [YaneuraOu](https://github.com/yaneurao/YaneuraOu)：GPLv3，随包附带对应说明；
- shtsume：随包附带题源/引擎说明；
- 棋题数据来源、筛选记录和 Android 迁移规划见 outputs 下的开发文档。
