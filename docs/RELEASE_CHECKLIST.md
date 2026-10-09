# 发布清单

## 发布前

- 检查工作区，排除真实资料库、账号信息、个人缓存、游戏与书籍原文件。
- 同步 package.json、package-lock.json、README 和 CHANGELOG 的版本。
- 检查第三方依赖许可和媒体素材的分发授权；代码许可不替代媒体授权。
- 运行 `npm run test:reader`、`npm run build` 和隔离界面测试。
- 打包前正常关闭此前运行的 release/win-unpacked 程序，避免文件占用。

## Windows x64 打包

```powershell
npm ci
npm run dist
npx electron-builder --prepackaged release/win-unpacked --win nsis portable --x64 --publish never
node scripts/finalize-release.cjs
```

`npm run dist` 会构建前端、生成目录版，再写入 Windows 图标与版本信息。上述流程只构建一次目录版，安装版和便携版复用该目录。

完整压缩 `release/win-unpacked` 文件夹（保留顶层 win-unpacked），生成 `Reverie Vault Green 0.4.0 x64.zip`。对三种发布包生成 SHA256SUMS.txt，不混入旧版文件。

## 检查

- 实际目录版可启动，显示正确图标及 0.4.0 版本，离开开屏后进入主界面。
- app.asar 包含新阅读引擎、阅读引擎许可、开屏视频与海报，不包含用户数据。
- 开屏可自动结束、跳过、重播，减少动态效果和视频故障不会阻塞主界面。
- 小说目录、字号、续读和漫画适宽、长图、页内续读正常。
- 记录尚未实测的内容，不把自动测试通过等同于所有真实游戏或第三方服务可用。

## GitHub

- 中文提交本次改动，先检查远程更新，再正常推送，不强制覆盖历史。
- 在同一提交上建立 v0.4.0 标签。
- 发布安装版、便携版、绿色 ZIP 和 SHA256SUMS.txt。
- 发布说明列出主要变化、升级注意事项和未签名提示。
- 发布后核对标签、附件名称与大小，并确认 README 下载入口可用。
