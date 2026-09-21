# 發佈流程

## 發佈前

1. 在 Windows x64、Node.js 24.x 上跑完 `npm ci`、`npm test`、`npm run build`、`npm run test:desktop`、`node tests/layout.mjs`、`node tests/delete-row.mjs`、`node tests/editor-review.mjs`、`node tests/window-storage.mjs`
2. 執行 `npm audit --registry=https://registry.npmjs.org/` 並看過結果，確認 `package.json` 與 `package-lock.json` 的版本相同
3. 執行 `npm run dist`、`npm run test:release`，再完成 [VERIFICATION.md](VERIFICATION.md) 的人工驗收，appId `tw.daybook.secretary` 與產品名稱 `日序` 不要更換，避免更新時移動資料位置
4. 執行 `npm run export:source`，輸出的 `release/daybook-source-版本/` 只會包含允許公開的原始碼，不含個人行程、日誌、截圖、依賴或安裝檔，重新發佈時請使用新版本
5. 最後再看一次待提交原始碼與完整 Git 歷史，確認沒問題才推送，不要把整個工作目錄直接打包上傳

## Git 作者隱私

第一次 commit **之前**，先到 GitHub Settings → Emails 找到自己的 noreply 信箱，再設定這個儲存庫的 `git config user.email` 與公開用的 `git config user.name`，不要照抄範例或自己猜地址，commit 前也要用 `git var GIT_AUTHOR_IDENT` 確認作者資訊

用 `git diff --cached --name-only` 檢查待提交清單，不可以出現 `.env`、金鑰、SQLite、`.private`、`test-results`、快取或日誌，既有 Git 歷史也要另外掃描

## GitHub Releases

原始碼放 Git 儲存庫，安裝檔放在 **GitHub Releases 的附件**，不要把安裝檔 commit 進儲存庫，每次 Release 至少附上：

- `Daybook-Setup-版本.exe`
- `SHA256SUMS.txt`
- 版本變更、Windows x64 支援範圍、未簽章說明，以及人工驗收還沒涵蓋的項目

記得啟用 GitHub 私密漏洞回報與依賴安全通知，GitHub Actions 只負責測試、建置與保存 artifacts，不會自動發佈 Release，第一次推送後要到 GitHub 確認流程真的通過

`LICENSE` 使用 MIT，第三方授權聲明也要保留，未來如果取得簽章憑證，請放在 CI secrets，絕對不要把憑證、私鑰或密碼提交到原始碼
