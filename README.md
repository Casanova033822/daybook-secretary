**繁體中文** · [简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center">
  <img src="assets/icon.png" alt="日序圖示" width="88">
</p>

<h1 align="center">日序 · Daybook</h1>

<p align="center">我做了一個簡單的 Windows 桌面行程與待辦工具<br>不用登入，也不需要網路，資料只會留在你的電腦</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64">
  <img src="https://img.shields.io/badge/Offline-ready-39845B" alt="離線可用">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8B5CF6" alt="MIT License"></a>
</p>

![日序主畫面：行程、完成狀態與深淺色切換](docs/images/daybook-overview.png)

## 下載安裝

1. 到 [下載頁面](https://github.com/Casanova033822/daybook-secretary/releases/latest)，下載 **`Daybook-Setup-版本.exe`**
2. 打開安裝檔，照著畫面完成安裝，就可以開始用了

支援 **Windows x64**，目前以 Windows 11 x64 測試，不需要 Node.js 或帳號，安裝後就能完全離線使用

> 安裝檔尚未簽章，Windows 可能會顯示安全警告，請只從本專案 Releases 下載

## 主要功能

- 日／週／月行程、待辦事項與重複排程
- 開始／結束提醒，搭配桌面小卡與提示音
- 迷你視窗、置頂與系統匣背景執行
- 深淺色模式、14 種語言，偏好會自動記住

## 如何使用

1. **新增事項**：直接輸入名稱，也可以從常用事項裡挑一個
2. **安排時間**：選好開始與結束時間，需要的話再加提醒或重複排程，時間還沒決定也能先存成待辦
3. **查看與完成**：用日／週／月檢視看行程，做完就勾選左邊的方框，要修改時點鉛筆就好
4. **調整成習慣的樣子**：到「偏好設定」管理常用事項、語言和預設提醒，深淺色可以在「新增事項」上方直接切換

**想收到提醒，記得讓日序保持執行** 關閉視窗後它會留在系統匣，完全結束程式或關機就不會提醒

<p align="center">
  <img src="docs/images/daybook-reminder2.png" alt="日序桌面提醒小卡" width="502">
</p>

## 隱私

我不會收集你的行程，也沒有廣告、遙測或雲端同步，資料只存在本機而且沒有加密，重要內容記得自己備份

更多內容可以看[安全與隱私](SECURITY.md)，第三方套件的授權則整理在[這裡](THIRD_PARTY_NOTICES.md)

遇到問題或有想法，歡迎[告訴我](https://github.com/Casanova033822/daybook-secretary/issues)

<details>
<summary>從原始碼執行（開發者）</summary>

需要 Windows x64、Git 與 Node.js 24.x

```powershell
git clone https://github.com/Casanova033822/daybook-secretary.git
cd daybook-secretary
npm ci
npm run build
npm start
```

開發用 `npm run dev`，打包用 `npm run dist`，其他細節可以看[發布流程](RELEASING.md)

</details>
