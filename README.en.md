# codex-550c-boot

[中文](README.md)

Unofficial 550C boot animation adapter for an independent **Windows Codex desktop copy**, derived from [dsh-550c-boot](https://github.com/yannicksong0106/dsh-550c-boot). Animation and original HTML: **Voidpoket**. Upstream plugin engineering: **Ziyang Song**. See [NOTICE.md](NOTICE.md).

Requirements: Windows 10/11, official Microsoft Store Codex installation, Node.js 22+ on PATH, and several GiB of free space. No npm dependencies are needed.

Run `Install.cmd`, then `Launch.cmd`. The animation runs inside the copied application's startup page. Click or press Esc to skip. Local application files and profiles live under ignored `.local/`; sign in separately. The official Store installation is preserved.

The modified executable's original signature becomes invalid. `Disable-Animation.cmd` restores original bytes and signature. Do not disable OS security protections to run a rejected copy.

Use `Check-Upgrade.cmd` and `Upgrade.cmd` after updating the official app. Candidate builds are tested before switching. `Rollback-Upgrade.cmd` restores the previous application; `Rollback-Upgrade-With-Profile.cmd` also restores the old profile while preserving the current one. `Recover-Upgrade.cmd` handles interrupted upgrades. Save work before maintenance commands.

```sh
npm run build
npm run preview
npm test
npm run verify
npm run release
```

Reuse the generated `dist/boot.js` with the overlay shown in `dist/preview.html`, or customize `src/boot-wrapper.js` and rebuild. Preserve MIT notices and upstream credits. Releases contain source and generated animation only, never OpenAI application binaries, extracted startup HTML, profiles, backups or logs.

This is not an official OpenAI plugin. Future startup, CSP or integrity format changes may require manual adaptation. Authentication, chats and all plugins are not comprehensively verified. See [compatibility](docs/COMPATIBILITY.md) and [development](docs/DEVELOPMENT.md).
