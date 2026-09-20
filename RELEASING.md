# 發佈流程

## 發佈前

1. 在 Windows x64、Node.js 24.x 上執行 `npm ci`、`npm test`、`npm run build`、`npm run test:desktop`、`node tests/layout.mjs`、`node tests/delete-row.mjs`、`node tests/editor-review.mjs`、`node tests/window-storage.mjs`。
2. 執行 `npm audit --registry=https://registry.npmjs.org/` 並審查結果。確認 `package.json` 與 `package-lock.json` 的版本一致。
3. 執行 `npm run dist`、`npm run test:release`，並完成 [VERIFICATION.md](VERIFICATION.md) 的人工驗收。保留 appId `tw.daybook.secretary` 與產品名稱 `日序`，避免更新時更換資料位置。
4. 執行 `npm run export:source`。輸出 `release/daybook-source-版本/` 是待公開原始碼白名單，不含個人行程、日誌、截圖、依賴或安裝成品。重新發佈時使用新版本；工具不會覆寫既有匯出資料夾。
5. 檢查待提交原始碼與完整 Git 歷史，再推送至本專案；不要把整個工作目錄打包上傳。`.gitignore` 無法清除已經提交的檔案或歷史。

## Git 作者隱私

第一次 commit **之前**，到 GitHub Settings → Emails 取得自己的 GitHub 提供的 noreply 信箱，並設定這個儲存庫的 `git config user.email` 與公開用的 `git config user.name`。不要直接使用範例帳號或隨意推測 noreply 地址。檢查 `git var GIT_AUTHOR_IDENT` 後才 commit；此指令包含作者資訊，不要把輸出貼到公開問題單。

檢查待提交清單 `git diff --cached --name-only`，不得含 `.env`、金鑰、SQLite、`.private`、`test-results`、快取或日誌。如有既有 Git 歷史，另外掃描歷史；忽略規則只影響未追蹤檔案。

## GitHub Releases

原始碼放 Git 儲存庫；安裝檔放 **GitHub Releases 的附件**，不要 commit 到儲存庫。安裝檔超過一般 Git 單檔的 100 MiB 限制。每次 Release 至少附上：

- `Daybook-Setup-版本.exe`
- `SHA256SUMS.txt`
- 版本變更、Windows x64 支援範圍、未簽章說明，以及人工驗收尚未涵蓋的項目。

啟用 GitHub 私密漏洞回報與依賴安全通知。內附 GitHub Actions 僅負責測試、建置與保存 artifacts，不會自動發佈 Release，權限限於讀取內容。首次推送後需確認工作流程在 GitHub 實際通過。

`LICENSE` 為 MIT；保留第三方授權聲明。若未來取得簽章憑證，使用 CI secrets 管理，絕不把憑證、私鑰或密碼提交到原始碼。
