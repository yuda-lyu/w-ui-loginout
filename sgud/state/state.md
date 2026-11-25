# 狀態(現況)

本檔記當前已開發功能之最新狀態:各功能做到哪裡、對應之規則帳本條目與測試檔、已知缺口與待辦、最近一次驗證或發布之版本;只記現況,不寫過程(過程見 `sgud/exp/experience.md`).藍圖見 `sgud/rule/rulebook.md`.

## 最近一次驗證

- 2026-11-25 tul632(首次取得 Playwright 受管瀏覽器集中、時限對齊安裝預算,R18;只改測試端):`npm test`(`quiet-run --lock`,一般情境)90 passing／0 failing／0 pending(改前 81;新增 `unit-pwInstall` PI0–PI7 共 8 案、`unit-wpwWiring` W4 1 案);`npm pack` 發布包解開(複製 `node_modules`、不建連結)再跑全套 90 passing;**模擬未安裝**:`PLAYWRIGHT_BROWSERS_PATH` 指向 `./tmp/` 下空夾跑平行全套 90 passing,持鎖 worker 真下載 3 項(headless shell、FFmpeg、Winldd 各 1 次,耗時約 16.5 秒),其餘 4 個 worker 真下載 0 項、取得耗時 16.9–22.7 秒(等候安裝鎖);**修前紅(按比例縮小時限)**:同一空夾條件平行跑 4 個 e2e 檔 `--timeout 20000`,修前 35 passing／1 failing(`e2e-logout` 之 `"before each" hook` 逾時 20000ms,同檔其餘 10 案未跑),修後 46 passing／0 failing 且等候者取得耗時 22.4／29.4／38.4 秒皆超過 20 秒而不失敗(本機網路快,實際 180 秒不重現,此對照只證機制);新測試對 HEAD 之工具(鏡像根)紅:PI0–PI6、PO4、W4 皆紅;單點變異 16 項全數擊殺;獨立複審(sonnet,唯讀)9 條(中 2、低 7)已處置;eslint 0;private-guard CLEAN;`src/`、`dist/`、`docs/`、`toolg/`、`package.json`、標準圖(本套件無)0 改動;未動使用者層級之 `%LOCALAPPDATA%/ms-playwright`.
- 2026-11-13 pm-uil(瀏覽器啟動改經 w-playwright,R17):`npm test`(`quiet-run --lock`)81 passing／0 failing／0 pending(改前 73,新增 `unit-pwOnly` 5 案、`unit-wpwWiring` 3 案);啟動只用無頭(headless shell),會啟動瀏覽器的案例前後以 `badpw` 讀錯誤次數皆 0;R-PW-ONLY 盤點(`src`、`test`、`toolg`、`package.json`)0 命中;修前紅:靜態測試對 HEAD 副本 PO2、PO3、PO4 紅;變異:出口繞過 w-playwright 時 W1–W3 全紅、丟棄呼叫端選項時 W2 紅、加回 `playwright` 宣告／直接匯入／移除 `autoInstall` 時 PO2／PO1／PO4 紅(皆已還原);eslint 0 error;`dist/`、`docs/`、`src/`、`toolg/`、標準圖(本套件無)0 改動.
- 2026-11-05 ul309b:`npm test`(`quiet-run --lock`)73 passing(改前 66,新增 `unit-noFixedPorts` 7 案);測試埠一律 `listen(0)` 由作業系統配發(取代 ul309 之保留埠加行程表驗證,見 R16);以真實占用者占住舊埠 8430–8435(`127.0.0.1`、`0.0.0.0`、`::` 各一輪)跑全套皆 73 passing、占用者 PID 皆在且仍回應、被打到 0 次、遮蔽探測 0 次;同機兩份同跑 2 次皆全綠;連跑 6 次(含 2 次 CPU 全飽和)0 失敗;守護變異 20/20 擊殺;eslint 0 error;產品碼、`toolg/`、`dist/`、`docs/`、標準圖(本套件無)0 改動.
- 2026-11-02 ul267:`npm test`(`quiet-run --lock`)66 passing(改前 65,新增 unit-build B0);依 dspec〈自有套件之發布與建置腳本〉實跑 `cleanFolder` → jsdoc → `gDistRollup`,`dist/w-ui-loginout.umd.js` 與 `.map` 與改前逐 byte 相同,`docs/` 只有 jsdoc 產生時間不同.
- 套件版本 `package.json` 為 1.0.49(本輪未動);`package-lock.json` 之 `version` 由 `npm i` 自 1.0.48 同步為 1.0.49.

## 功能現況

| 功能 | 狀態 | 規則帳本 | 測試檔 |
|---|---|---|---|
| src 裸引用皆宣告且可解析、無除錯輸出 | 已做 | R1、R13 | `test/unit-imports.test.mjs` |
| 發 GET 請求單一出口 `src/httpGet.mjs`(原生 fetch,語意對齊原 axios 用法) | 已做 | R5 | `test/api-httpGet.test.mjs` |
| login / logout / detect 之行為、錯誤物件 `{text, msg}`、回呼拋錯處置 | 已做 | R4、R6、R7、R10、R11 | `test/e2e-login.test.mjs`、`test/e2e-logout.test.mjs`、`test/e2e-detect.test.mjs` |
| detect 生命週期(停止函數、取代、logout 時停止) | 已做 | R12 | `test/e2e-detect.test.mjs`、`test/e2e-logout.test.mjs` |
| 公開函式與 opt 鍵(getUrl、keyGlobal、timeWaitAnimation、defToken、apiName、retry 等) | 已做 | — | `test/e2e-options.test.mjs` |
| README 與 JSDoc 與實作一致 | 已做 | R9 | `test/unit-docs.test.mjs` |
| 測試埠一律由作業系統配發:所有監聽都是 `listen(0)`,實際埠取自 `server.address().port`,網址與斷言由實際埠衍生,每個會監聽的測試檔印 `[案名] [e2e-port] 實際埠 N(作業系統配發)`;`api-httpGet` 之「拒絕連線埠」為 `listen(0)` 取埠後關閉並以連線確認 `ECONNREFUSED`;無固定基準埠、無保留埠、無行程表驗證、不下殺 | 已做 | R16 | `test/unit-noFixedPorts.test.mjs`(PN-000–PN-006,原始碼靜態掃描);`test/e2e-*.test.mjs` 經 `setupE2e`、`test/api-httpGet.test.mjs` 自行取得實際埠 |
| 測試之瀏覽器啟動一律經 w-playwright:單一出口 `test/tools/e2eLib.mjs` 之 `launchChromium(opt)` = `wpw.launchChromium({ ...opt, autoInstall: false })`(2026-11-25 起啟動不安裝,取得見下列 R18 列;devDependency `w-playwright` ^1.0.1,實裝版本見 `node_modules/w-playwright/package.json`);只啟動無頭(headless shell),不啟動真 Chrome／Edge／完整 Chromium;`src`、`toolg`、`package.json` 無直接 Playwright 匯入與宣告;README 有 Testing 節(安裝、`ensureChromium()`、離線、守門參數與原因) | 已做 | R17 | `test/unit-pwOnly.test.mjs`(PO0–PO4,靜態盤點)、`test/unit-wpwWiring.test.mjs`(W1–W3,`setBrowserTypeForTest` 接線與 `next()` 真路徑) |
| 首次取得 Playwright 受管瀏覽器:`test/tools/e2eLib.mjs` 匯出 `PW_INSTALL_BUDGET_MS`(900000)與同行程只做一次之 `ensureE2eBrowser()`(`wpw.ensureChromium({ timeout: PW_INSTALL_BUDGET_MS })`;逾時於同行程記憶、其他失敗重試;印 `[e2e-browser]` 開始／真下載／完成／失敗診斷行);`setupE2e` 之第一個 `before`(`ensureBrowser`:`this.timeout(PW_INSTALL_BUDGET_MS + 60000)` 後 `await ensureE2eBrowser()`)獨立於第二個 `before`(`buildAndServe`:建置、起假伺服器,仍 180000) | 已做 | R18 | `test/unit-pwInstall.test.mjs`(PI0–PI7)、`test/unit-wpwWiring.test.mjs`(W4)、`test/unit-pwOnly.test.mjs`(PO4);空瀏覽器目錄下平行全套之實跑見最近一次驗證 |
| 建置:`toolg/gDistRollup.mjs` 依 dspec 標準寫法(`'./src'`、`'./dist'`,選項寫於本檔);UMD 自足、無未解析引用 | 已做 | R2、R3、R14 | `test/unit-build.test.mjs`(副本並指定 cwd 執行 toolg 腳本) |

## 已知缺口與待辦

- R15 另案:讀完 `?token=` 不清網址;`params` 值非字串時 `getUrl` 拋 TypeError;caniuse-lite 更新;wsemi `isDev()` 之 `if (location)` 防護無效(主控記為 wsemi 另案).
- 只測 Chromium;Firefox/Safari 未測.
- 瀏覽器啟動(R17):①`node_modules/playwright` 仍由 `w-package-tools-e2e` 1.0.32 傳遞帶入,待其改版移除 `playwright` 後消失,屬該套件之遷移輪;②Linux 缺系統相依時不自動 `install-deps`(w-playwright 之 `installDeps` 預設關,原 `w-package-tools-e2e` 之 `launchChromium` 會自動裝),本套件測試在 Windows 執行故未受影響;③有頭與真 Chrome／Edge 本套件不用,故未驗.
- 首次取得瀏覽器(R18):①等候安裝鎖者受 Playwright 自身鎖重試上限約束(約 8 分鐘,讀自其原始碼,未以慢網路實測),持鎖者下載超過此時間時等候者以離開碼 1 失敗(不等滿 15 分鐘預算);②`ensureChromium` 每次會在瀏覽器目錄內取鎖並寫 `.links`(讀自 Playwright 原始碼,未實測唯讀目錄),故離線複製之瀏覽器目錄須可寫;③真下載計數依賴 Playwright 之 `Downloading` 輸出,`npm_config_loglevel` 為 `silent`／`error`／`warn` 時恆為 0,須以目錄產物核對;④W4 讀 mocha 內部欄位(`_beforeAll`、`hook.fn`、`hook.timeout()`,mocha 12.0.3 皆存在),結構改變時測試轉紅(不會空過);⑤w-playwright 尚未匯出建議之安裝預算常數,匯出後改取該值(已回饋,見 `sgud/feedback/feedback.md`);⑥只驗 Windows,Linux 之 `installDeps` 未開.
- 測試埠:未驗證「作業系統配發之埠是否可能與他人以特定位址綁定之同埠共存」(Windows 位址共存,僅機率問題,全部實測未見);未在非 Windows(POSIX)下實測;本套件無畫面含埠之流程、無標準圖.
- 受版控之 `dist/` 與 `docs/` 由發布流程重產.
