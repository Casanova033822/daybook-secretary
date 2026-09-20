# 接續開發：日序 1.0.5

此儲存庫目前用於私人開發與跨裝置接續工作，尚未正式公開發布。

## 在新的 Windows 裝置開始

安裝 Git 與 Node.js 24.x，登入有權限存取此私人儲存庫的 GitHub 帳號後：

```powershell
git clone https://github.com/Casanova033822/daybook-secretary.git
cd daybook-secretary
npm ci
npm test
npm run build
npm start
```

互動開發使用 `npm run dev`。產生 Windows x64 安裝檔使用 `npm run dist`，驗證打包版本使用 `npm run test:release`。使用安裝版不需要 Node.js。

在第一次提交前，依 RELEASING.md 設定此裝置的 Git 作者名稱與 GitHub noreply 信箱。本機 Git 設定不會隨 clone 移轉。

## 已有功能與檢查

- 日／週／月行程、未排時間待辦、重複規則、單次修改與完成、直接刪除所選那一次。
- 完整／迷你視窗、系統匣背景執行、提醒小卡與提示音。
- 本機 SQLite、具輸入與來源驗證的 IPC、隔離 renderer、正式版網路限制及 Electron 安全開關。
- 1.0.5 修正編輯草稿混用、非同步儲存競態、自訂提醒輸入、提醒紀錄寫入失敗去重、大量歷史資料與視窗偏好儲存失敗等問題。
- 原開發機已通過 24 項單元／安全測試，以及桌面、刪除、編輯、視窗儲存失敗、版面、提醒和打包版本測試；乾淨來源重建亦已測試。GitHub Actions 與新裝置的結果應另外確認。

## 尚待完成

- Windows 安裝檔尚未簽章；沒有自動更新服務。
- 正式發布前依 VERIFICATION.md 完成人工安裝、實際聽見音效、登入啟動、真實睡眠喚醒與多螢幕驗收。
- 資料庫未加密，限制已記錄於 SECURITY.md；若要支援敏感資料，需另外設計金鑰、遷移與復原機制。
- 授權為 PolyForm Noncommercial 1.0.0，允許依條款進行非商業使用、修改與分享；未決定變更前保持此授權及第三方聲明。
- 簽章服務申請、身分驗證與費用尚未處理，憑證或金鑰不得提交至儲存庫。

## 資料與發布注意事項

此儲存庫只包含原始碼、必要素材、測試與文件，沒有個人行程資料庫、日誌、截圖或安裝檔。換裝置 clone 不會自動帶入原裝置的個人行程。

保留應用程式識別碼 `tw.daybook.secretary` 與產品名稱「日序」，避免更新時改變既有資料位置。詳細使用、建置及發布流程分別見 README.md、RELEASING.md、SECURITY.md 與 VERIFICATION.md。
