# Release Checklist

Use this checklist before publishing a new Reverie Vault release.

## Repository

- [ ] No game files are committed.
- [ ] No downloaded covers/backgrounds are committed.
- [ ] No `%APPDATA%\Reverie Vault` or legacy `%APPDATA%\gal-launcher` user data is committed.
- [ ] No personal one-off maintenance scripts are committed.
- [ ] `README.md` is up to date.
- [ ] `CHANGELOG.md` includes the new version.
- [ ] `package.json` and `package-lock.json` have the release version.
- [ ] `LICENSE` is present.
- [ ] `docs/DATA_SOURCES.md` is up to date.
- [ ] `docs/PRIVACY.md` is up to date.

## Build

Fast review build:

```powershell
Stop-Process -Name "Reverie Vault" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
npm run dist
```

`npm run dist` runs:

```text
npm run build && electron-builder --win dir
```

Review executable:

```text
release/win-unpacked/Reverie Vault.exe
```

Do not run `npm run dist:portable` for the normal review path. The portable build compresses the full Electron runtime into a single exe and is much slower.

## Manual QA

- [ ] App opens from `release/win-unpacked/Reverie Vault.exe`.
- [ ] Add game dialog works.
- [ ] Launching a game increments play count.
- [ ] Play time is recorded after the game exits.
- [ ] Metadata search works or fails gracefully.
- [ ] Cover picker works or fails gracefully.
- [ ] Backup export/import works.
- [ ] Cinema layout, collection view, and local shelf display correctly.

## Legal / Source Hygiene

- [ ] Third-party source integrations are documented.
- [ ] No third-party artwork is bundled in the repository.
- [ ] No scraped cache is bundled in releases.
- [ ] User-visible wording says the app does not provide game content.
- [ ] Community scraping sources are optional or conservative.

## GitHub Release

- [ ] Create a version tag, for example `v0.3.0`.
- [ ] Attach `Reverie Vault Setup 0.3.0.exe` for normal users.
- [ ] Zip `release/win-unpacked` as `Reverie Vault Green 0.3.0 x64.zip` for long-term portable use.
- [ ] Attach `Reverie Vault Portable 0.3.0.exe` when a single-file build is needed.
- [ ] Include a short changelog.
- [ ] Mention Windows support status.
- [ ] Tell users that Windows may show an "unknown publisher" warning because the app is unsigned.

## Recommended Public Release Text

```text
Reverie Vault v0.3.0

本版本统一使用 Cinema 沉浸式界面，并完善游戏、书架与音乐收藏体验。

普通用户请下载 Reverie Vault Setup 0.3.0.exe。免安装使用可下载 Reverie Vault Green 0.3.0 x64.zip，完整解压后运行 win-unpacked/Reverie Vault.exe。

这是一个本地 Galgame / 视觉小说启动器，不包含任何游戏本体、破解或下载资源。
如果 Windows 提示未知发布者，是因为当前版本尚未购买代码签名证书。
```
