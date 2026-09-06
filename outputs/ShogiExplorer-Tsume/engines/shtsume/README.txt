shtsume 本地引擎
================

本目录包含 shtsume v1.2.6 的 Win64 可执行文件及其运行时 DLL。
启动器通过上一级的 server.ps1 保留它作为题源/参考求解工具。
正常训练中的玉方快速应手由 engines\yaneuraou 目录里的常驻 YaneuraOu 提供。

使用方式：
- 不要直接双击 shtsume.exe；请双击上一级的 TsumeLauncher.exe；
- 正常训练不会调用本程序判断用户着法，也不会把它的首着当作正解标准；
- /api/engine/solve 仅保留给调试和题源验证使用，不由训练页面调用；
- 正常训练的应手引擎不可用时，页面使用题库应手回退；用户界面不提供思考时限调节。

来源：
https://github.com/hkijin/shtsume
https://github.com/hkijin/shtsume/releases

授权：
SHTSUME-LICENSE 是 shtsume 本体的授权文本。
libgcc_s_seh-1.dll、libstdc++-6.dll、libwinpthread-1.dll 是运行时依赖；
对应运行时授权文本位于 engines/runtime-licenses。
