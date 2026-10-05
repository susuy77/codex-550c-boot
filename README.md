# codex-550c-boot

[English](README.en.md) · [许可与署名](NOTICE.md)

为 **Windows 上的 Codex 独立应用副本**添加 550C 启动动画。动画在应用内部播放，支持跳过、撤销、版本回退和升级兼容性检查。

这是基于 [dsh-550c-boot](https://github.com/yannicksong0106/dsh-550c-boot) 的社区移植，**不是 OpenAI 官方插件**。动画及原始 HTML 作者为 **Voidpoket**，上游插件工程作者为 **Ziyang Song**。本仓库不分发 Codex 的程序、资源包或账户数据。

仓库：[susuy77/codex-550c-boot](https://github.com/susuy77/codex-550c-boot) · [版本下载](https://github.com/susuy77/codex-550c-boot/releases)

## 快速使用

要求：Windows 10/11、已安装官方 Microsoft Store 版 Codex、PATH 中可用的 **Node.js 22+**。首次安装和每次升级需为应用副本及备份预留数 GiB 空间。无需 npm install，项目没有运行时依赖。

1. 从 Releases 下载源码 ZIP，或运行 `git clone https://github.com/susuy77/codex-550c-boot.git`，放到自己可写的文件夹。
2. 双击 `Install.cmd`。脚本读取官方安装，创建独立副本，并验证候选启动动画。
3. 成功后双击 `Launch.cmd`。动画结束后显示实际应用；点击或按 Esc 可跳过。

副本保存在 `.local/`，有自己的登录与数据目录。需要自行登录，原版数据不会自动迁入。原版 Store 安装保持原样。

**修改副本的官方数字签名会失效**，部分应用控制策略可能拒绝启动。不要关闭系统安全机制来强行运行。撤销动画会恢复副本中的原始程序字节和有效签名。

## 升级与回滚

| 入口 | 操作 |
|---|---|
| `Check-Upgrade.cmd` | 检查本机官方版本及启动结构是否兼容 |
| `Upgrade.cmd` | 官方 Store 版更新后，测试并升级副本；保留上一版 |
| `Disable-Animation.cmd` | 撤销当前版本动画，恢复其原始程序与资源 |
| `Enable-Animation.cmd` | 重新启用当前版本动画 |
| `Rollback-Upgrade.cmd` | 回退上一版程序，保留当前数据 |
| `Rollback-Upgrade-With-Profile.cmd` | 回退程序及升级前数据；当前数据另行保存 |
| `Recover-Upgrade.cmd` | 恢复在目录切换时中断的升级 |

这些操作会关闭副本，**请先保存工作**。升级工具仅读取本机已安装的官方版本，不自动下载官方更新。不要删除 `.local/backup` 和所需的历史快照。

## 先预览，再安装

```sh
npm run build
npm run preview
```

打开终端显示的本机地址，或直接打开 `dist/preview.html`。预览无需 Codex；结束后的占位文字不是实际应用界面。

## 开发和复用

```sh
npm run build
npm test
npm run verify
npm run release
```

- 只复用动画：构建后使用 `dist/boot.js`，配合 `dist/preview.html` 中的遮罩结构；遵守 MIT 并保留署名。
- 更换宿主文字、跳过或播放逻辑：修改 `src/boot-wrapper.js`，再构建。
- 调整适配规则：修改 `src/compatibility.mjs`，运行测试；不要把旧版本整页 HTML 套到新版本。
- 自定义本地数据目录：启动脚本前设置环境变量 `CODEX_550C_DATA_DIR`。该目录仅用于本机，不应提交。

目录结构、安装原理和维护方法见 [开发说明](docs/DEVELOPMENT.md)，兼容范围及验证边界见 [兼容性说明](docs/COMPATIBILITY.md)。

## 发布边界

Git 忽略 `.local/`、程序文件、账号配置、备份、日志和缓存。发布脚本采用源码白名单，附带 SHA256 清单。**不要将使用过的整个项目文件夹直接打包分享**；使用 `npm run release` 生成干净包。

未来 Codex 若改变启动入口、安全策略或资源校验机制，工具会拒绝自动处理，仍需人工适配。本项目不保证所有未来版本兼容，也不保证修改副本的全部登录、聊天及插件功能已验证。

MIT。上游许可及原作者署名见 `vendor/dsh-550c-boot/` 与 [NOTICE.md](NOTICE.md)。
