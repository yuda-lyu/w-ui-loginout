# 狀態(現況)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本;只記現況,不寫過程(過程見 `sgud/exp/experience.md`).藍圖見 `sgud/rule/rulebook.md`.

## 最近一次驗證

- 2026-11-02 ul267:`npm test`(`quiet-run --lock`)66 passing(改前 65,新增 unit-build B0);依 dspec〈自有套件之發布與建置腳本〉實跑 `cleanFolder` → jsdoc → `gDistRollup`,`dist/w-ui-loginout.umd.js` 與 `.map` 與改前逐 byte 相同,`docs/` 只有 jsdoc 產生時間不同.
- 套件版本 `package.json` 為 1.0.36(本輪未動).

## 功能現況

| 功能 | 狀態 | 規則帳本 | 測試檔 |
|---|---|---|---|
| src 裸引用皆宣告且可解析、無除錯輸出 | 已做 | R1、R13 | `test/unit-imports.test.mjs` |
| 發 GET 請求單一出口 `src/httpGet.mjs`(原生 fetch,語意對齊原 axios 用法) | 已做 | R5 | `test/api-httpGet.test.mjs` |
| login / logout / detect 之行為、錯誤物件 `{text, msg}`、回呼拋錯處置 | 已做 | R4、R6、R7、R10、R11 | `test/e2e-login.test.mjs`、`test/e2e-logout.test.mjs`、`test/e2e-detect.test.mjs` |
| detect 生命週期(停止函數、取代、logout 時停止) | 已做 | R12 | `test/e2e-detect.test.mjs`、`test/e2e-logout.test.mjs` |
| 公開函式與 opt 鍵(getUrl、keyGlobal、timeWaitAnimation、defToken、apiName、retry 等) | 已做 | — | `test/e2e-options.test.mjs` |
| README 與 JSDoc 與實作一致 | 已做 | R9 | `test/unit-docs.test.mjs` |
| 建置:`toolg/gDistRollup.mjs` 依 dspec 標準寫法(`'./src'`、`'./dist'`,選項寫於本檔);UMD 自足、無未解析引用 | 已做 | R2、R3、R14 | `test/unit-build.test.mjs`(副本並指定 cwd 執行 toolg 腳本) |

## 已知缺口與待辦

- R15 另案:讀完 `?token=` 不清網址;`params` 值非字串時 `getUrl` 拋 TypeError;caniuse-lite 更新;wsemi `isDev()` 之 `if (location)` 防護無效(主控記為 wsemi 另案).
- 只測 Chromium;Firefox/Safari 未測.
- 受版控之 `dist/` 與 `docs/` 由發布流程重產.
