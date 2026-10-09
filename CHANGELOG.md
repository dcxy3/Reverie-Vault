# Changelog

## 0.4.0 — 2026-10-09

### 新增与优化

- 小说接入 Foliate 阅读引擎，支持 EPUB、MOBI、AZW3、FB2、TXT、Markdown；支持字号、目录、翻页与滚动模式。
- 扩展文本编码识别，改善常见中日韩文本乱码问题。
- PDF 接入 PDF.js 阅读组件与分段读取；漫画支持 CBZ/ZIP、图片及文件夹，自适应适宽并保存页内位置。
- 小说保存文本位置，漫画长图不再按屏幕高度硬切，重新打开可继续阅读。
- 书架支持改名并使用新名称搜索封面；横版封面增加“再次寻找”。
- 改善窗口化布局及资料、图片搜索流程。
- 新增本地视频开屏、结尾慢放浅推进和交叠淡入，支持跳过、重播与减少动态效果设置。
- 完善开屏异常回退、淡出期间跳过和键盘焦点控制，补充阅读器与开屏回归测试。

### 升级说明

- 提供 Windows x64 安装版、便携 EXE 和绿色 ZIP；资料库位置保持兼容，升级前建议导出备份。
- 电子书不支持 DRM；CBR/RAR 和 CB7/7z 漫画需先解压。
- 发布包未进行商业代码签名，请核对来源与 SHA256 校验文件。

## 0.3.0

这个版本将 Reverie Vault 的界面统一为 Cinema 沉浸式布局，并完善本地收藏管理体验。

### Changed

- 统一使用 Cinema 主题的沉浸式设计语言。
- 完善横版主视觉、收藏页和本地书架的展示与交互。
- 更新 README，使项目介绍、下载方式和发布流程适配 0.3.0。

### Notes

- 推荐普通用户使用安装版；长期免安装使用可选择绿色 ZIP。
- 审核和快速验证时使用 `npm run dist`，不要默认构建 portable 单文件。

## 0.2.3

侧栏视觉优化、主题重构、时长统计重写。

### Changed

- 优化侧栏按钮可视度与交互动效。
- 重构主题预设系统。
- 重写游玩时长统计，加入进程树追踪、崩溃恢复和看门狗保活。
- 修复 release workflow 手动触发时无法正确关联 tag 的问题。

## 0.2.2

封面搜索全面重构。

### Changed

- 增加代理可选、动态查询、竖版备选、降噪、重试和缓存感知。
- 优化多来源封面搜索的稳定性。

## 0.2.1

### Fixed

- VNDB 截图搜索改为仅下载全尺寸图片，跳过缩略图。
- 下载超时时间从 8 秒增加到 20 秒。
- 降低 VNDB 封面搜索相似度阈值，改善日文名命中但分数过低的问题。
- 扩充作品别名库，提高部分作品的封面搜索命中率。

## 0.2.0

### Added

- 重写 README，加入截图、功能表格、主题说明和社区文件。
- 添加 GitHub Issue / PR 模板和 Funding 配置。

## 0.1.0

Initial public release preparation.

### Added

- Local visual novel / galgame library.
- Steam-like cover wall.
- Immersive key visual launch page.
- Game launch support for `.exe`, `.bat`, `.cmd`, and `.lnk`.
- Play count and play time tracking.
- Metadata search and candidate picker.
- Cover/background candidate search.
- Bangumi rating lookup.
- Backup export/import.
- Windows build and portable release workflows.
- Public README, user guide, privacy notes, and data source notes.
