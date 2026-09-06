诘将棋本地题库
================

本目录内的 mate5.sfen、mate7.sfen、mate9.sfen 是随包附带的 SFEN 题面，精选题在前、扩展题在后；
每行是一道题，不依赖 KIF。启动器实际读取根目录的 puzzle-data.js，里面同时包含局面和解答；
只修改这些 SFEN 文件不会自动改变启动器题库，扩充题库时需要重新生成带解答的 puzzle-data.js。

精选题源：tokuhirom/tanuki-tsume-shogi（MIT 许可）。该项目的公开题库经过规则校验、
唯一解/无駒余り检查和多样性过滤。
项目地址：https://github.com/tokuhirom/tanuki-tsume-shogi
在线版：https://tokuhirom.github.io/tanuki-tsume-shogi/
精选集：5 手 296 题、7 手 132 题、9 手 29 题，共 457 题。
扩展练习集：5 手 0 题、7 手 86 题、9 手 541 题，共 627 题。
全部合计 1084 题。扩展集在页面中单独标记，默认不冒充精选集。
授权文本见本目录的 TANUKI-LICENSE.txt。

扩展练习集来自同一项目公开仓库的生成数据，去除了与精选集重复的局面，用于增加 7/9 手练习量。
YaneuraOu 公开的超大诘将棋 SFEN 题库（5/7/9 手分类）只作为未来扩展来源：
官方说明：https://yaneuraou.yaneu.com/2020/12/25/christmas-present/
公开下载：https://drive.google.com/file/d/1nJbFFaQeOx3gFafiVIR_oDIcG8iCOHf4/view?usp=sharing

完整公开题源约 500 万道题；如需继续扩展，需先筛选、验证，再重新生成带解答的 puzzle-data.js。
对应 meta.tsv 列为：题目编号、评分、质量标记、哈希、集合类型、来源。
不提供 KIF、剪贴板导入和普通棋局复盘入口，启动器只保留诘将棋训练。当前已确认服务启动阶段会预热常驻 YaneuraOu；不预先计算题面局面的应手结果，用户合法王手后再按最新局面正式请求玉方应手。
