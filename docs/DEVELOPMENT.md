# 开发与复用

`vendor/` 固定上游来源和许可，`src/boot-wrapper.js` 提供 Codex 挂载与退出逻辑，`src/compatibility.mjs` 提供页面与资源校验。
`tools/` 构建动画、生成局部资源补丁、管理原始备份并审核发布包。`scripts/windows/` 管理本机应用副本的安装、升级、启动、回滚和恢复。

修改 wrapper 后运行 build、test、verify。预览使用自己编写的演示页，不包含从 Codex 解包的专有 HTML。补丁在使用者电脑上读取其当前版本页面，保留原模块和 CSP，只加入动画容器及单个脚本哈希许可。

不直接覆盖 Store 安装。复制后同时更新资源包及副本程序中的资源包头 SHA256 记录；这会使副本签名失效。原始可执行文件和资源包先备份，并保留完整哈希基线。

升级先验证官方源、生成候选并使用临时配置测试。切换使用目录快照及记录；出错时恢复，进程中断时使用 Recover-Upgrade。目录操作并非跨文件事务，复杂磁盘损坏仍可能需要人工恢复。

Node 内置模块完成构建和测试，无需安装第三方包。CI 运行 Node 22/24，Windows/Linux 的源码测试；真实桌面安装仅支持 Windows。ZIP 打包当前使用 Windows .NET。

发布前用 npm run release，它只复制审核白名单内容。禁止加入 OpenAI 应用文件、真实账户数据或机器路径。Git 的 ignore 只是辅助，发布审核和白名单才是分发边界。
