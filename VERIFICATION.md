# 驗收方式與限制

測試只使用獨立產生的假資料。測試截圖、資料庫、錯誤日誌與個別使用者的操作紀錄不納入公開原始碼。

## 自動驗收

| 指令 | 範圍 |
| --- | --- |
| npm test | 分鐘輸入、跨日、重複、單次修改／刪除、完成、提醒去重／重試／補發、安全 URL 政策 |
| npm run build | React 與 Electron TypeScript、Vite 正式建置 |
| npm run test:desktop | 真實介面輸入、常用事項、各檢視、完成、提醒小卡、迷你模式、資料與視窗位置保存 |
| node tests/layout.mjs | 1180／850px 寬度、字體備援、欄位對齊、橫向時間、跨日及完成樣式 |
| node tests/readability.mjs | 中英德阿語、深淺色、14–16px 字級、說明文字至少 4.5:1 對比、850／1180px 無橫向溢出、固定設定操作區、主題切換鈕位置與鍵盤操作 |
| node tests/appearance.mjs | 14 種語言與旗幟、即時主題同步、設定草稿、RTL、重新啟動保存、儲存失敗保留原設定、離線資源 |
| node tests/delete-row.mjs | 編輯／垃圾桶順序、直接刪除單次、不影響其他日期、失敗保留資料 |
| node tests/editor-review.mjs | 提醒開啟另一筆編輯時的草稿隔離、非同步儲存競態、自訂提醒逐字輸入 |
| node tests/release-regressions.mjs | 待辦略過隱藏提醒驗證、草稿保留、14 語言星期按鈕穩定、深淺色月曆關閉圖示與鍵盤操作、CSP |
| node tests/window-storage.mjs | 視窗偏好寫入失敗仍可收進系統匣及切換模式 |
| node tests/reminders.mjs | 開發版的真實分鐘排程、完整／迷你／背景、合併、完成／改期、重試與模擬喚醒 |
| npm run dist | Windows x64 NSIS、內附資源／授權、包內隱私掃描、Electron fuses、安裝檔 SHA-256 |
| npm run test:release | 加固後的執行檔、隔離資料、環境變數注入防護、文字輸入與 IPC、提醒與重新啟動保存 |
| node tests/installer.mjs | 僅 GitHub Actions 臨時 Windows 主機：真實 NSIS 安裝、已安裝程式測試、同版覆蓋安裝與解除安裝保留假資料 |
| npm run export:source | 公開檔案白名單、常見金鑰與當地使用者路徑檢查 |

打包測試以 Chromium CDP 連接測試用 renderer，不重新開啟已停用的 Node inspector。CDP 只在測試命令中啟用。tests/windows.mjs 保留作為舊版整合測試紀錄，不能用來測試停用 inspector 的正式版本。

乾淨環境驗收應在沒有 node_modules、dist、test-results 的匯出副本，重新安裝依賴、測試、建置與打包。通過表示來源不依賴原工作目錄的建置產物；不等於已測試所有 Windows 硬體與企業政策。

## 仍需人工確認

- 從 Release 下載並安裝；在沒有 Node.js 與 Noto Sans TC 的電腦驗證可啟動且文字清楚。
- 完整、迷你、縮小及收進系統匣時，真正的排程小卡出現且不搶鍵盤焦點。
- 喇叭確實發出提示音；播放完成回呼只證明軟體播放流程結束。
- 登出／登入 Windows 後背景自動啟動，以及關閉此偏好的效果。
- 真實睡眠、喚醒及時鐘變動後，當日漏掉提醒合併且不重複。
- 多螢幕、縮放比例、拔除螢幕後視窗可見且位置合理。
- 覆蓋更新保留既有資料；完全結束會停止提醒。

首次 GitHub Actions 執行與另一台實機驗收，應在完成後另行記錄。不要把模擬喚醒、同機乾淨副本或聲音回呼寫成已完成這些人工項目。
