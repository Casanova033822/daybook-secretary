[繁體中文](README.md) · **简体中文** · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center">
  <img src="assets/icon.png" alt="日序图标" width="88">
</p>

<h1 align="center">日序 · Daybook</h1>

<p align="center">我做了一个简单的 Windows 桌面日程与待办工具<br>不用登录，也不需要网络，数据只会留在你的电脑</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64">
  <img src="https://img.shields.io/badge/Offline-ready-39845B" alt="离线可用">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8B5CF6" alt="MIT License"></a>
</p>

![日序主界面：日程、完成状态与深浅色切换](docs/images/daybook-overview.png)

## 下载安装

1. 到 [下载页面](https://github.com/Casanova033822/daybook-secretary/releases/latest)，下载 **`Daybook-Setup-版本.exe`**
2. 打开安装文件，跟着提示完成安装，就可以开始用了

支持 **Windows x64**，目前在 Windows 11 x64 上测试，不需要 Node.js 或账号，安装后就能完全离线使用

> 安装文件尚未签名，Windows 可能会显示安全警告，请只从本项目 Releases 下载

## 主要功能

- 日／周／月日程、待办事项与重复安排
- 开始／结束提醒，搭配桌面卡片与提示音
- 迷你窗口、置顶与系统托盘后台运行
- 深浅色模式、14 种语言，偏好设置会自动保存

## 如何使用

1. **新增事项**：直接输入名称，也可以从常用事项里选一个
2. **安排时间**：选好开始和结束时间，需要的话再加提醒或重复安排，时间还没确定也能先存成待办
3. **查看与完成**：用日／周／月视图看日程，做完就勾选左边的方框，要修改时点击铅笔就好
4. **调整成习惯的样子**：到「偏好设置」管理常用事项、语言和默认提醒，深浅色可以在「新增事项」上方直接切换

**想收到提醒，记得让日序保持运行** 关闭窗口后它会留在系统托盘，完全退出程序或关机就不会提醒

<p align="center">
  <img src="docs/images/daybook-reminder2.png" alt="日序桌面提醒卡片" width="502">
</p>

## 隐私

我不会收集你的日程，也没有广告、遥测或云同步，数据只保存在本机而且没有加密，重要内容记得自己备份

更多内容可以看[安全与隐私（繁体中文）](SECURITY.md)，第三方组件的许可证整理在[这里](THIRD_PARTY_NOTICES.md)

遇到问题或有想法，欢迎[告诉我](https://github.com/Casanova033822/daybook-secretary/issues)

<details>
<summary>从源代码运行（开发者）</summary>

需要 Windows x64、Git 与 Node.js 24.x

```powershell
git clone https://github.com/Casanova033822/daybook-secretary.git
cd daybook-secretary
npm ci
npm run build
npm start
```

开发用 `npm run dev`，打包用 `npm run dist`，其他细节可以看[发布流程（繁体中文）](RELEASING.md)

</details>
