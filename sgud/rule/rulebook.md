# 規則帳本

本檔為套件設計與開發階段之規則帳本,為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.

> 狀態:**定案(2026-10-14 run02,依主控複審 `C:\opensrcOper\dnow\20261014042249\review\run01-複審.md` 之裁示)**.方案 C(原生 fetch);B1–B4 本輪修(R7、R10–R12);除錯輸出移除(R13);建置腳本依 dspec〈自有套件之發布與建置腳本〉(R14;2026-11-02 撤共用設定檔);另案事項見 R15;測試埠一律由作業系統配發(`listen(0)`)見 R16(2026-11-05 ul309b);Chromium 系瀏覽器之啟動一律經 w-playwright 見 R17(2026-11-13 pm-uil).各條「修前」為 2026-10-14 實測(審計第 1 次),「測試」欄為對應測試檔與案例編號.全盤產物:`./tmp/w-ui-loginout-全盤.md`.

## 軸

| 軸 | 成員(由系統推導) | 來源 |
|---|---|---|
| 使用方式 | U1 瀏覽器 `<script>` 載 UMD(全域 `window['w-ui-loginout']`);U2 打包工具引用 `w-ui-loginout/src/WUiLoginout.mjs`(下游三者皆此);U3 打包工具引用套件名(`main`);U4 Node `require(main)`(只載入);U5 Node `import` src(只載入);U6 AMD(不承諾) | `package.json` main、README、下游 `src/App.vue` |
| 對外 API | parseUrl、getTokenFromUrl、getToken、getValue、getUrl、getApi、login、detect、logout | `src/WUiLoginout.mjs` 回傳物件 |
| 網路函式 | getApi、login(經 getApi 或 urlForVerify)、logout、detect | 同上 |
| 模式 | 開發(`location.href` 含 `localhost`,wsemi `isDev`)/ 正式 | `node_modules/wsemi/src/isDev.mjs` |
| token 來源 | URL `?token=` 優先,其次 localStorage `${site}:userToken`;開發模式缺 token 用 defToken | `src/WUiLoginout.mjs` getToken、login core |

## 單一擁有者

| 事項 | 擁有者 |
|---|---|
| 發 GET 請求 | `src/httpGet.mjs` 之 `httpGet`(R5);其他處不得直接呼叫 fetch/axios |
| localStorage 鍵格式 `${site}:userToken` | 公開契約(下游 w-web-task `src/components/Rail.vue` 直接寫入),不可改 |
| 對外錯誤物件 `{text, msg}` | login/logout/detect 之 core;非預期例外之包裝(R10) |
| 進行中之 detect | 實例內單一變數(R12);detect 重複呼叫、停止函數、logout 皆經它 |
| 建置腳本 | `toolg/gDistRollup.mjs`(R14);依 dspec〈自有套件之發布與建置腳本〉,選項寫於本檔;測試以副本並指定 cwd 執行之 |

## R1 src 之所有裸引用皆已宣告且可解析

- **規則**:`src/*.mjs` 之每個裸引用,其套件名須列於 `package.json` 之 `dependencies`(或 `peerDependencies`);唯一例外為自有套件已自帶之相依(全域規範 §7),須列於下方「刻意不套」並寫明由誰提供.
- **理由**:未宣告之引用只在使用端剛好有該套件(hoist)時可解析;webpack 對之為建置錯誤,rollup 只警告並當 external,UMD 因而依賴不存在之全域.
- **盤點指令**:Grep `^import .* from '([^./][^']*)'` 於 `src/`,取套件名(`@scope/name` 或第一段),對照 `package.json` 之 dependencies;解析以 `node --input-type=module -e "import('<spec>')"` 於 repo 根驗證.
- **站點全集(修前 2026-10-14,12 項)**:`axios`(未套:未宣告、不可解析);`lodash-es/get.js`(刻意不套:由 wsemi ^1.9.16 之 dependencies 提供,§7);`wsemi/src/` 下 isDev、isestr、ispint、iseobj、isp0int、isfun、ispm、cint、delay、pmConvertResolve(已套).修後:移除 axios,新增相對引用 `./httpGet.mjs`(相對引用須指向存在之檔案).
- **測試**:`test/unit-imports.test.mjs`(靜態掃描 + 解析;修前因 axios 紅).

## R2 建置零「could not be resolved」與零「No name was provided for external module」

- **規則**:以 `toolg/gDistRollup.mjs` 之設定建置時,rollup 警告不得含 UNRESOLVED_IMPORT 與 MISSING_GLOBAL_NAME.刻意 external 者須同時列於 `external` 與 `globals`.
- **盤點指令**:`npx mocha test/unit-build.test.mjs --timeout 180000`(以副本並指定 cwd 執行 `toolg/gDistRollup.mjs`,副本在 `test/_tmp/unit-build/build/`,取其 stderr 之 rollup 警告).
- **修前**:2 則(皆 axios);另有環境提示 `caniuse-lite is outdated`(lockfile 釘 1.0.30001504,另案 R15)不屬本條.
- **測試**:`test/unit-build.test.mjs`(after 刪除 `test/_tmp/unit-build/`).

## R3 UMD 自足

- **規則**:`dist/w-ui-loginout.umd.js` 之 UMD 標頭不得帶外部模組參數(CJS 分支為 `module.exports=e()`,不得有 `require(`),瀏覽器只載本檔即可完成全部功能.
- **修前**:未套,`dist/w-ui-loginout.umd.js:6` 為 `e(require("axios"))` / `define(["axios"],e)` / `e(t.axios)`.受版控之 `dist/` 由發布流程重產,測試只驗由現行 src 建出之產物.
- **測試**:`test/unit-build.test.mjs` 檢查標頭;R4 之 e2e 只載本檔.

## R4 每種承諾之使用方式皆可載入並完成對外功能

- **規則**:U1 只載 UMD 即可完成 login/logout/detect/getApi;U2、U3 於無 axios 之使用端可建置;U4、U5 於 Node 可載入(呼叫需瀏覽器全域,屬合約外,README 載明).
- **修前(2026-10-14 實測)**:U1 只載 UMD 時凡網路功能皆失敗(login 誤報「登入時無法連線」且不送請求);U2/U3 無 axios 時 webpack `Module not found`;U4/U5 `Cannot find module 'axios'`.
- **測試**:`test/e2e-login.test.mjs`、`test/e2e-logout.test.mjs`、`test/e2e-detect.test.mjs`、`test/e2e-options.test.mjs`(fixture 使用端頁 `test/pages/app.html` 只載建出之 UMD);`test/unit-build.test.mjs` 涵蓋 U4、U5 之載入;U2/U3 以 R1(引用皆宣告)保證,另於 `./tmp/` 以 webpack 模擬使用端驗證(交付報告附紀錄).

## R5 發 GET 請求只有一個出口,語意對齊原 axios 用法(Q1 方案 C、Q2 一般 Error)

- **規則**:`src/httpGet.mjs` 之 `httpGet(url)` 為唯一出口;①method GET、標頭 `Accept: application/json, text/plain, */*`;②只有 2xx 為成功;③本文可 `JSON.parse` 者為解析結果,否則為原字串(空字串維持空字串);④成功 resolve `{ data, status, statusText, headers }`,headers 為小寫鍵之一般物件;⑤非 2xx 以一般 `Error` reject,message `Request failed with status code <N>`,並帶 `status` 與 `response`(形狀同④);⑥網路錯誤(含網址無法解析)以一般 `Error` reject,message `Network Error`,不附原始錯誤;⑦錯誤 message 與屬性不得含請求網址(網址帶 `?token=`);⑧不設逾時.
- **理由**:①–⑥ 對齊現行 axios 之可觀察行為(下游只讀 `data.token`、`data.user`,錯誤只 console.log);⑦ 同下游 w-web-perm `src/fetchJson.mjs` 之教訓(fetch 之例外訊息含網址);⑧ 下游 api、perm 之 e2e 以 `page.route` 攔截不回應拍「連線中」.
- **修前**:三個呼叫點各自呼叫 axios(getApiCore、detect 之 checkTokenCore、logout core).
- **行為變更(修後)**:login 連線錯誤之 msg 字串前綴由 `AxiosError:` 變為 `Error:`;logout/detect 之連線錯誤 msg 不再是 AxiosError(無 isAxiosError/code/config/request,改為帶 status/response 之一般 Error);procLogout(logout)、procCheckToken 收到之回應無 config/request.
- **測試**:`test/api-httpGet.test.mjs`(H1–H9,Node 直打假伺服器);e2e 之 L5、L6、O1–O3、D1、D5、L-hang.

## R6 localStorage 鍵格式為公開契約

- **規則**:鍵為 `${site}:userToken`;login 成功寫入、失敗寫空字串;logout 一律寫空字串;detect 只讀.
- **理由**:下游 w-web-task 之登出直接寫 `'wtask:userToken'`.
- **站點全集**:getToken、login core(讀)、login then/catch(寫)、detect core(讀)、logout(寫),修前 6 處手寫同一字串;修後收斂為實例內單一函式 `keyToken()`(格式不變,同一規則不再手寫多處).
- **測試**:e2e 各案例斷言 LS 值(鍵名以字串 `probe:userToken` 直接寫在測試,確保格式未變).

## R7 網路函式於請求前檢查網址設定(對稱)

- **規則**:logout 與 detect 對自 `opt.params` 取得之網址皆須於請求前檢查;為空即不發請求並以 `{text, msg}` 報錯.
- **修前**:logout 已套(`無法取得登出用設定資訊`);detect 未套——未設 checkToken 時對目前頁面輪詢、HTML 當成功、永不登出(2026-10-14 實測).
- **定案(B1,Q3)**:detect 於啟動時取 `getUrl('checkToken')`,為空即不啟動輪詢、不呼叫任何回呼,`detect()` 以 `{text:'無法取得驗證令牌用設定資訊', msg:'invalid urlCheckToken'}` reject(文字與 logout 之「無法取得登出用設定資訊」對稱);檢查在取代既有偵測之前(R12),故設定錯誤之呼叫不影響進行中之偵測.
- **測試**:e2e-detect D4.

## R8 對外錯誤一律 `{text, msg}`(B2,Q4)

見 R10(定案條文).本條保留編號供對照.

## R9 文件與實作一致

- **規則**:README 與 JSDoc 範例之網址鍵置於 `opt.params`;`opt.params` 型別為 Object;`opt.retry` 載明只用於 detect;README 瀏覽器段載明全域名 `window['w-ui-loginout']` 與「只需載入本檔」;載明 Node 只保證可載入;「dev source code」連結指向本 repo;JSDoc 載明 detect 回傳停止函數(R12)、錯誤物件 `{text, msg}` 與 msg 型別(R10、L2)、回呼拋錯之處置(R11).
- **修前**:皆未套(README 與 JSDoc 範例把鍵寫在 opt 頂層;JSDoc `opt.params` 寫 String;README 連到 w-cluster,實測 404).
- **測試**:`test/unit-docs.test.mjs`(靜態比對 README 與 src 之 JSDoc).

## R10 對外錯誤一律 `{text, msg}`,非預期例外依流程包裝(B2,Q4)

- **規則**:交給 afterLogin/loginError(及 login 回傳之 data)、afterLogout/logoutError(及 logout 回傳之 data)、detect 之 procLogout、以及 `detect()` 之 reject 者,一律為 `{text, msg}`.本套件自行判定之錯誤沿用既有文字;流程中之非預期例外(含流程內回呼拋錯,R11)包成:login `{text:'登入時發生例外', msg:<原拋出值>}`、logout `{text:'登出時發生例外', msg:<原拋出值>}`、detect `{text:'驗證令牌時發生例外', msg:<原拋出值>}`.已是 `{text, msg}` 形狀(物件且 `text` 為字串、具 `msg` 屬性)者原樣傳遞.
- **msg 型別(L2,維持並文件化)**:login 之連線錯誤為字串(`err.toString()`,例 `Error: Request failed with status code 500`);logout、detect 之連線錯誤為 Error 物件(非 2xx 帶 status/response);非預期例外為原拋出值;其餘為字串代碼(`invalid token`、`invalid user`、`invalid urlLogOut`、`invalid urlCheckToken`)、伺服器之 msg(登入時驗證失敗)或回應物件(登出失敗、驗證令牌失敗).
- **不變(下游依賴)**:login 成功之 `data.token`、`data.user`;loginError 之 `{text, msg}` 形狀;localStorage 鍵.
- **修前**:afterGetUser、logout 之 procLogout 拋錯時 data 為原生 Error;procCheckToken 拋錯時 procLogout 收原生 Error;detect 啟動時之例外(如 params 值非字串)使 `detect()` reject 原生 Error.
- **測試**:e2e-login B2-L、e2e-logout B2-O、B2-O2、e2e-detect B2-D、B2-D2.

## R11 回呼拋錯之處置依「流程內 hook / 結束通知」二分(B3,Q4)

- **規則**:①流程內 hook——afterGetUser(login)、procLogout(logout)、procCheckToken(detect)——拋錯即該流程失敗,依 R10 包裝後走錯誤通道(login/logout 之 state=false 與 loginError/logoutError;detect 之 procLogout 並停止偵測).②結束通知——afterLogin、loginSuccess、loginError、afterLogout、logoutSuccess、logoutError、detect 之 procLogout——拋錯不吞:login()/logout() 以原拋出值 reject;detect 之 procLogout 於計時器內呼叫,其拋錯成為未處理之 promise rejection.結束通知被呼叫前,本套件之狀態變更已完成(login 已寫 LS、logout 已清 LS 並停止偵測、detect 已停止輪詢).
- **理由**:hook 之回傳值參與流程判定(afterGetUser 之後才算登入成功、procLogout/procCheckToken 回傳 falsy 即失敗),拋錯等同判定失敗;結束通知是交還控制權給呼叫端,吞掉會讓呼叫端之錯誤消失.修前之「不一致」即此二分,但 hook 之錯誤未包裝(R10)且未文件化.
- **修前**:結束通知已如②(2026-10-14 實測 X2:loginSuccess 拋錯則 login reject 且 LS 已寫);hook 拋錯時傳原生 Error.
- **測試**:e2e-login B3-L、e2e-logout B3-O、e2e-detect B3-D;hook 部分同 R10 之測試.

## R12 detect 之生命週期:有開始即有停止(B4,Q4)

- **規則**:①`detect(opt)` 啟動成功時 resolve 一個停止函數 `stop()`;呼叫後(可重複呼叫)不再發出新請求(已送出者照常完成,重試迴圈於下一次重試前即中止),進行中之一輪完成時也不再呼叫任何回呼.②同一實例同時只有一個偵測:再呼叫 `detect()` 時,先檢查新呼叫之設定(R7),通過才停止舊偵測並啟動新偵測;舊之停止函數不影響新偵測.③`logout()` 於開始時(發請求前)停止進行中之偵測,不論登出成敗.④偵測因失敗而呼叫 procLogout 前,先停止輪詢(同修前).⑤checkToken 網址於啟動時取一次、每輪讀 LS token(同修前).
- **修前**:detect 回傳 null,無停止介面;logout 不停 detect,登出成功後 detect 仍觸發 procLogout('令牌已清除')(實測 X4);呼叫兩次即雙重輪詢(實測 X5).
- **行為變更**:`detect()` 之 resolve 值由 null 改為函數;登出後不再收到 detect 之 procLogout;重複呼叫改為取代.下游未使用 detect/logout.
- **測試**:e2e-logout B4-O;e2e-detect B4-S、B4-R、B4-F(進行中之一輪於停止後完成不呼叫回呼).

## R13 src 不得殘留除錯輸出

- **規則**:`src/*.mjs` 不得有 `console.log/warn/error/info/debug` 呼叫(註解除外).
- **修前**:3 處(login 之 `console.log('site', site)`、`console.log('data', data)`;detect 之 ``console.log(`retry n=${n}`)``).
- **測試**:`test/unit-imports.test.mjs`(靜態掃描);e2e-login L7、e2e-detect D1 斷言頁面無 console 輸出.

## R14 建置腳本依 dspec〈自有套件之發布與建置腳本〉

- **規則**:`toolg/gDistRollup.mjs` 依 `C:/opensrcOper/dspec/自有套件之發布與建置腳本.md` 之標準寫法(`let fdSrc = './src'`、`let fdTar = './dist'`,相對 cwd;選項寫於本檔;不以腳本位置推導路徑、不抽共用設定檔、不另包檢查層);本套件為瀏覽器端工具,選項明給 `runin:'browser'`(Q7).測試要驗 dist 者,以副本並指定 cwd 執行 toolg 腳本(`test/tools/buildUmd.mjs`),不為測試改寫 toolg.
- **撤除紀錄(2026-11-02)**:2026-10-14 曾把選項抽至 `toolg/distRollupOpt.mjs`,供 gDistRollup 與測試共用(「建置設定單一來源」),屬自創寫法;依 dspec 已移除該檔,選項寫回 `gDistRollup.mjs`,測試改以副本並指定 cwd 執行.
- **測試**:`test/unit-build.test.mjs`(B0 離開碼 0 與 dist 檔名;B1 建置 log 不含 `invalid runin`).

## R15 另案(本輪不處理,記錄)

| 事項 | 說明 |
|---|---|
| 讀完 `?token=` 不清網址 | 下游 perm 以 referrer 政策補救(perm `spec/設計要點與取捨.md` ADR-023 相關段) |
| `params` 值非字串時 `getUrl` 拋 TypeError | 直接呼叫 getUrl 時拋出;在 logout、detect 流程內則依 R10 包裝 |
| caniuse-lite 更新(Q6) | lockfile 釘 1.0.30001504;另案 |
| wsemi `isDev()` 之 `if (location)` 防護無效 | 主控記為 wsemi 下一輪另案 |

## R16 測試埠:一律由作業系統配發(`listen(0)`),不用固定基準埠、不保留埠、不查行程表(2026-11-05 ul309b;規格 `C:/opensrcOper/dspec/e2e埠與多套件同跑.md` 本套件適用 E8,E4、E6)

- **規則**:
  1. **所有監聽都走 `listen(0)`**:本套件測試之監聽者(`test/tools/fakeServer.mjs` 之假伺服器、`api-httpGet` 之測試伺服器)都在測試行程內,`.listen(` 之第一個引數一律字面 `0`(後接逗號或右括號),實際埠取自 `server.address().port`;網址、斷言、期望值都由實際埠衍生.綁定位址維持原樣(`fakeServer` 不指定位址、`api-httpGet` 綁 `127.0.0.1`).`test/` 不得再有固定埠字面、`host:埠` 字面、埠命名(大小寫不拘)之數字指定或 `listen(<非 0>)`(`unit-noFixedPorts` PN-001–PN-004 守護;掃描 `test/` 含子夾〔不含 `_tmp`、`pics`〕之 `.mjs/.js/.cjs/.json/.html`,守護檔自身因樣本刻意含固定埠字樣而除外).
  2. **不使用**:固定基準埠表、`reserveE2ePorts` 保留與位移、`E2E_PORT_OFFSET`/`E2E_PORT_HOLD`、行程表驗證(`listenerPids`)、`selfCheck`/`/__self`(PN-005 守護無殘留).行程內監聽者由作業系統配發,不會撞到任何固定埠之占用者,不需換埠機制;行程表查詢在高負載下可能逾時(主控實測 12–25 秒)而判斷錯誤,故不用.
  3. **無人監聽之拒絕連線埠**(`api-httpGet` H6):於 H6 使用前才取得——`listen(0)` 取得一個埠後立刻關閉,再以 `net.connect` 確認為 `ECONNREFUSED` 才使用(連到他人或逾時者換下一個,最多 3 次,仍無則拋錯);不使用任何固定埠當「沒人監聽」.
  4. **網址與期望值取實際埠**:`env.port`(`setupE2e`)、`port`/`portRefused`(`api-httpGet`);斷言「不含埠」者(e2e-login L5)用 `String(env.port)`,不寫字面.
  5. **實際埠印入輸出(E6)**:每個會監聽之測試檔印一行 `[案名] [e2e-port] 實際埠 N(作業系統配發)`(`api-httpGet` 於 H6 另印拒絕連線埠一行;PN-006 守護).
  6. **絕不下殺(E4)**:本套件沒有任何依埠、依名稱、依命令列下殺占用者之程式;測試只關閉自己啟動之瀏覽器與假伺服器、並刪自己之 `test/_tmp/<案名>`.日後新增下殺須先改本條並附「他人占用時不殺」之真實占用者測試.
  7. **畫面含埠(E7)**:無.本套件無標準圖(`test/pics` 不存在),fixture 頁(`test/pages/app.html`)不顯示埠;斷言含埠者(e2e-options P2 之 `{origin}`/`{base}`)已取實際埠.
- **理由**:全套多套件同機同跑時,固定埠互撞.Windows 上 `::` 與 `127.0.0.1` 可同時監聽同一埠,固定埠 `listen` 成功不代表瀏覽器連得到自己(2026-11-05 實測:占用者綁 `127.0.0.1` 占住 8430,舊固定埠版 e2e-login 2 passing／13 failing 且占用者被打到 14 次;`::` 占用者則 `before` 即 EADDRINUSE).改由作業系統配發從根本不撞,也不必偵測占用與換埠.
- **盤點指令**:
  - (機械守護:`unit-noFixedPorts` PN-001)`Grep "\.listen\(" test/` → 每筆第一個引數皆為 `0`(`fakeServer.mjs`、`api-httpGet.test.mjs` 之 `getRefusedPort` 與測試伺服器;守護檔自身之說明與樣本除外).
  - `Grep "localhost:|127\.0\.0\.1:" test/` → 僅 `${env.port}`／`${port}`／`${portRefused}` 模板;`e2eHelpers.mjs` 之 `${host}:${env.port}`(host 為 `127.0.0.1` 或 `localhost`,即「模式軸」,與埠無關);守護檔自身之樣本除外.
  - `Grep "killPortListeners|taskkill|Stop-Process|process\.kill|\.kill\(|wmic|netstat|killOwn|reapShard|SIGKILL|SIGTERM" src/ toolg/ test/` → 0 命中(`sgud/` 內之說明字樣不計).
- **測試**:`test/unit-noFixedPorts.test.mjs` PN-000–PN-006(皆為原始碼靜態掃描,不開任何 socket,不斷言任何具體埠號,與機器上哪些埠被占用、作業系統配發範圍、負載無關);占用舊埠之整合實測、同機重複跑、高負載連跑與變異結果見交付報告 ul309b.

## R17 Chromium 系瀏覽器之啟動一律經 w-playwright(2026-11-13 pm-uil;對應 w-playwright 帳本 R-PW-ONLY、R-PW-WIRING)

- **規則**:
  1. **不直接依賴、不直接匯入 Playwright**:`src`、`test`、`toolg` 之 `.mjs`/`.js` 不得以靜態或動態 `import`、`require` 引用 `playwright`／`playwright-core`;`package.json` 不得宣告兩者(含 dev).`node_modules` 內之 `playwright`／`playwright-core` 只是 `w-playwright` 與 `w-package-tools-e2e` 之相依傳遞而來,非本套件宣告.
  2. **測試啟動瀏覽器之點只有一處**:`test/tools/e2eLib.mjs` 之 `launchChromium(opt)` = `wpw.launchChromium({ ...opt, autoInstall: true })`(`import wpw from 'w-playwright'`);`test/tools/e2eHelpers.mjs` 之 `setupE2e` 的 `beforeEach` 經它啟動.不得再深層引用 `w-package-tools-e2e` 之 `launchChromium`／`launchChromiumCore`／`launchBrowser`(其內直接使用 Playwright,繞過 w-playwright 之守門參數),不得自行 `chromium.launch(`.不改用 `launchBrowser`(多六個確定性渲染旗標,本套件無截圖不需).
  3. **只啟動無頭 headless shell**(`headless: true`,不給 `channel`／`executablePath`):不啟動真 Chrome、Edge 或完整 Chromium,故不觸發 Chromium 153 起「每個新根行程以錯誤密碼呼叫一次 `LogonUser`」之帳號鎖定風險;w-playwright 仍於每次啟動加入守門參數.設計 §5.2 之「會啟動真 Chrome／Edge／完整 Chromium 之測試檔每檔最多啟動一次」不適用本套件(headless shell 之共用屬效能、選做),維持每案例一個全新瀏覽器.
  4. **`w-playwright` 為 `devDependencies`(`^1.0.1`)**:`src` 與 `dist` 不引用它,故 `toolg/gDistRollup.mjs` 之 `external`／`globals` 不變(R14).
  5. **README 之 Testing 節**寫明:安裝帶入之 playwright-core、受管瀏覽器以 `ensureChromium()` 取得(不寫 `npx playwright install`)、離線用 `PLAYWRIGHT_BROWSERS_PATH`(載入前設定)、真 Chrome／Edge 須自行安裝、一律加入之守門參數與原因、`PWDEBUG`／`SELENIUM_REMOTE_URL` 不支援.
- **行為差異(測試端)**:原 `w-package-tools-e2e` 之 `launchChromium` 在 Linux 缺系統相依時會自動 `install-deps`;w-playwright 之 `installDeps` 預設關,本套件未開,故 Linux 缺相依時啟動失敗(`E_LAUNCH`)而不自動安裝.本套件測試在 Windows 執行,不受影響.
- **盤點指令**(命中數須為 0;先以 `rg … <w-playwright 套件根>/src` 確認指令對必命中之 `src/_pw.mjs` 有效):
  - `rg -n --glob '*.{mjs,js}' --glob '!**/node_modules/**' --glob '!**/dist/**' "(from\s+|import\(\s*|require\(\s*)['\"\`]playwright(-core)?['\"\`/]" src test toolg` → 0 命中.
  - `rg -n --glob '**/package.json' --glob '!**/node_modules/**' "\"playwright(-core)?\"\s*:" package.json` → 0 命中.
  - `rg -n "wpw\.(launchChromium|launchChromiumPersistent)\(" src test` → 僅 `test/tools/e2eLib.mjs` 一處(`test/unit-pwOnly.test.mjs` 自身之字串樣本不計).
- **測試**:`test/unit-pwOnly.test.mjs` PO0–PO4(靜態:盤點有效性、無直接匯入、package.json 宣告、啟動點全集、單一出口寫法);`test/unit-wpwWiring.test.mjs` W1–W3(以 `wpw.setBrowserTypeForTest` 替身收啟動選項:替身確被呼叫、`args` 恰一個 `--disable-features` 且為最後一個元素並含 `AutofillAiWalletPrivatePasses`、只啟動無頭;W3 以 `next()` 真啟動 headless shell 一次,接縫不用替身).變異:出口改為不經 w-playwright 時 W1–W3 皆轉紅;出口丟棄呼叫端選項時 W2 轉紅;`package.json` 加回 `playwright` 時 PO2 轉紅;移除 `autoInstall: true` 時 PO4 轉紅.

## 測試清單(由 R1–R14、R16、R17 衍生)

主機:正式模式 `127.0.0.1`,開發模式 `localhost`(標 dev 者).

| 檔案 | 編號 | 情境 | 斷言要點 | 規則 |
|---|---|---|---|---|
| unit-imports | I1 | src 裸引用皆宣告 | 套件名在 dependencies,或在「自有套件自帶」清單且提供者確實列為相依 | R1 |
| unit-imports | I2 | src 裸引用與相對引用皆可解析 | `import.meta.resolve` 成功、相對檔存在 | R1 |
| unit-imports | I3 | src 無除錯輸出 | 去除註解後無 `console.*(` | R13 |
| unit-build | B0 | 副本並指定 cwd 執行 `toolg/gDistRollup.mjs` | 離開碼 0、log 含 `transpiling: WUiLoginout.mjs`、dist 恰為 `w-ui-loginout.umd.js` 與 `.map` | R14 |
| unit-build | B1 | 同上之建置輸出 | 無 UNRESOLVED_IMPORT/MISSING_GLOBAL_NAME 警告、log 無 `invalid runin` | R2、R14 |
| unit-build | B2 | UMD 標頭 | `module.exports=x()` 無參數、標頭無 `require(` | R3 |
| unit-build | B3 | Node 載入 | `require` 建出之 UMD、`import` src 皆得 function | R4 |
| unit-build | P1 | 建構子 site 無效 | `wui('')`、`wui()` 拋 `invalid site` | — |
| unit-docs | DC1–DC4 | README/JSDoc | 範例鍵在 params、全域名、dev 連結、params 型別、detect 回傳、錯誤物件說明 | R9 |
| api-httpGet | H1–H9 | httpGet 語意 | 見 R5 ①–⑧ 逐點 | R5 |
| e2e-login | L1–L4、L7–L8、L10 | 成功與伺服器判定之失敗 | text 原文、`{token,user}`、LS、請求路徑與 Accept | R4、R6 |
| e2e-login | L2、L9(dev 與正式) | 缺 token、`?token=error` | defToken、不送請求 | R4 |
| e2e-login | L3 | LS 有 token | 成功 | R6 |
| e2e-login | L5、L6 | 500、網路錯誤 | msg 字串 `Error: ...`,不含網址 | R5、R10 |
| e2e-login | L-hang | 驗證請求不回應 | 觀察窗內無任何結果回呼 | R5⑧ |
| e2e-login | B2-L、B3-L | afterGetUser 拋錯 / loginSuccess 拋錯 | `{text:'登入時發生例外'}` / login() reject 原錯誤且 LS 已寫 | R10、R11 |
| e2e-logout | O1–O7 | 登出各路徑 | text 原文、procLogout 收到之回應形狀、LS 清空、請求數 | R5、R6、R7 |
| e2e-logout | B2-O、B3-O | procLogout 拋錯 / logoutSuccess 拋錯 | `{text:'登出時發生例外'}` / logout() reject 原錯誤且 LS 已清 | R10、R11 |
| e2e-logout | B2-O2 | 流程中非回呼之例外(params.logOut 非字串) | `{text:'登出時發生例外', msg:TypeError}` | R10 |
| e2e-logout | B4-O | 偵測中登出 | 登出後不再有 checkToken 請求與 detect 回呼 | R12③ |
| e2e-detect | D1–D3、D5 | 401(1+3 次)、LS 被清(他分頁登出)、procCheckToken 回 false、網路錯誤 | procLogout 參數、請求次數、失敗後停止 | R5、R12④ |
| e2e-detect | D4 | 未設 checkToken | detect() reject、無輪詢請求、無回呼 | R7 |
| e2e-detect | B2-D、B3-D | procCheckToken 拋錯 / procLogout 拋錯 | `{text:'驗證令牌時發生例外'}` / 未處理之 rejection | R10、R11 |
| e2e-detect | B2-D2 | 啟動時之例外(params.checkToken 非字串) | `detect()` reject `{text:'驗證令牌時發生例外', msg:TypeError}`、無請求 | R10 |
| e2e-detect | B4-S、B4-F、B4-R | 停止、停止時有進行中之一輪、重複呼叫 | 停止後無請求無回呼;取代語意 | R12 |
| e2e-options | P2–P8 | 公開函式與 opt 鍵 | getUrl 佔位符、parseUrl 等、keyGlobal、timeWaitAnimation、defToken、apiName/apiNameForVerify、retry、回呼 promise 之 await | — |
| unit-noFixedPorts | PN-000 | 掃描範圍、規則與註解遮罩自測 | 範圍含 `fakeServer.mjs`、`e2eHelpers.mjs`、`api-httpGet.test.mjs`、`pages/app.html` 等且 `.listen(` 站點 ≥ 2;各規則對已知正例必抓、已知反例不抓;註解內字樣不計,字串、正則、範本內之 `/*`、`//`、引號不使其後之程式被誤判為註解 | R16 |
| unit-noFixedPorts | PN-001 | 所有 `.listen(` | 第一個引數皆為字面 `0`(`0 + x`、`0 \|\| x`、`{port}`、變數、字串 `'0'` 皆違規) | R16 規則 1 |
| unit-noFixedPorts | PN-002、PN-003、PN-004 | 固定埠字面 | 無 `host:埠` 字面、無埠命名(大小寫不拘)之數字指定與範本運算式內之純數字、無引號包住之 4–5 位純數字字串與舊段 84xx 字面 | R16 規則 1、4 |
| unit-noFixedPorts | PN-005 | 舊機制殘留 | 無 `reserveE2ePorts`、`reserveTestPorts`、`reservePorts`、`listenReserved`、`verifyListening`、`TEST_PORTS`、`selfCheck`、`__self`、`listenerPids`、`describePortOwners`、`E2E_PORT_*`、`portChild`、`e2ePorts` 字樣;`e2ePorts.mjs`、`portChild.mjs`、`unit-e2ePorts.test.mjs` 不存在 | R16 規則 2 |
| unit-noFixedPorts | PN-006 | 會監聽之測試檔(呼叫 `.listen(` 或 `startFakeServer(`) | 皆印 `[案名] [e2e-port] 實際埠 N(作業系統配發)`(註解掉者不算) | R16 規則 5 |
| unit-pwOnly | PO0 | 盤點有效性(防空集合) | `src`、`test`、`toolg` 皆有掃描檔且總數 ≥ 10;正則對靜態 import、動態 import、require、`playwright/…` 深層、反引號寫法皆命中,對 `w-playwright`、`playwright-extra`、註解、一般字串不命中 | R17 規則 1 |
| unit-pwOnly | PO1 | 無直接匯入 | `src`、`test`、`toolg` 命中 0 | R17 規則 1 |
| unit-pwOnly | PO2 | package.json 宣告 | 四種依賴類別皆無 `playwright`／`playwright-core`;`devDependencies['w-playwright']` 為 `^1.0.1` 且不在 `dependencies`;實裝版本主版 1 且不低於 1.0.1 | R17 規則 1、4 |
| unit-pwOnly | PO3 | 啟動點全集 | `wpw.launchChromium(`／`launchChromiumPersistent(` 只在 `test/tools/e2eLib.mjs` 一處;無舊啟動路徑之深層匯入;無 `chromium.launch(` 等直接啟動 | R17 規則 2 |
| unit-pwOnly | PO4 | 單一出口寫法 | `e2eLib` 為 `wpw.launchChromium({ ...opt, autoInstall: true })`;`e2eHelpers` 經 `e2eLib` 啟動且只呼叫一次 | R17 規則 2 |
| unit-wpwWiring | W1 | `setupE2e` 的 `beforeEach` 經 w-playwright | 替身被呼叫 1 次、`env.browser` 為替身回傳者;選項無通道與執行檔、`headless:true`;`args` 恰一個 `--disable-features` 且為最後元素,含守門與 Playwright 預設功能;`ignoreDefaultArgs` 去掉預設那一串;`autoInstall` 不轉傳給 Playwright | R17 規則 2、3 |
| unit-wpwWiring | W2 | 出口原樣傳入呼叫端選項 | `timeout`、`args`(`--lang=en-US`)保留,呼叫端自給之 `--disable-features=Translate` 併入同一串且仍恰一串 | R17 規則 2 |
| unit-wpwWiring | W3 | `next()` 真路徑 | 合併後選項真啟動 headless shell,可 `newPage`/`setContent`/讀取,`version()` 有值;替身確被呼叫 1 次 | R17 規則 2、3 |
| (刻意不測) | — | login 內 `invalid site` | 只在竄改 `window[keyGlobal].site` 時可達 | — |

## e2e 落地映射(對應全域技能 role-coder-for-test-e2e §3)

### 服務與 port

| 項目 | 值 |
|---|---|
| 後端 | 無產品後端;測試用假伺服器 `test/tools/fakeServer.mjs`,在測試行程內以 `listen(0)` 由作業系統配發埠(實際埠取自 `server.address().port`,`env.port`;`api-httpGet` 同,綁 `127.0.0.1`),無固定基準埠、不保留埠、不下殺(R16);mocha `--parallel` 下各檔獨立程序、各自配發 |
| 前端 | 無;fixture 使用端頁 `test/pages/app.html` 只載建出之 UMD(等同 README 之 UMD 用法),由網址 hash 傳入案例設定 |
| 建置 | 各檔 `before` 以 `test/tools/buildUmd.mjs` 把 `src`、`toolg`、`package.json` 複製到 `test/_tmp/<檔名>/build/`,spawn 指定 cwd 執行副本之 `toolg/gDistRollup.mjs`(UMD 在副本之 `dist/`),`after` 刪除 |
| e2e 執行 | `npm test`;單檔 `npx mocha test/e2e-login.test.mjs --timeout 180000` |
| 共用實作 | `w-package-tools-e2e` ^1.0.32(devDependency)之 `registerCleanupHooks`、`pollUntil`,與 `w-playwright` ^1.0.1(devDependency)之 `launchChromium`,皆經 `test/tools/e2eLib.mjs` 單一橋接(瀏覽器啟動一律經 w-playwright,見 R17) |
| 改動範圍 → 測試檔 | `src/` 改動:全部 `e2e-*`、`api-*`、`unit-*`;`test/tools/e2eLib.mjs`、`e2eHelpers.mjs` 改動:全部 `e2e-*` 與 `unit-wpwWiring`、`unit-pwOnly`;`package.json` 依賴改動:`unit-imports`、`unit-pwOnly`;`toolg/` 或 `README.md` 改動:`unit-build`、`unit-docs`;全套約 1–2 分鐘,改到共用基礎時直接跑全套 |
| 修前紅之驗證 | 測試工具讀環境變數 `WUL_FDSRC`(預設 `./src`)決定建置與掃描之 src 目錄;修前副本以 `git show HEAD:src/WUiLoginout.mjs` 取至 `./tmp/` 後指向之 |

### 契約映射

| 契約 | 本專案 | 偏離與依據 |
|---|---|---|
| C1 launch wrapper | `test/tools/e2eLib.mjs` 之 `launchChromium(opt)` = `wpw.launchChromium({ ...opt, autoInstall: true })` 單一出口(經 w-playwright,R17);呼叫端只給 `{ headless:true }` | 無截圖,不需確定性渲染旗標(故不用 `launchBrowser`);w-playwright 另於每次啟動加入守門參數 |
| C2 server lifecycle | 每檔 `before` 起假伺服器(`listen(0)` 作業系統配發埠)、`after` 關閉 + `registerCleanupHooks` | 行程內監聽者不用 `reserveE2ePorts`/`createServiceManager`(無子行程服務、無固定埠),規格 E8 允許改由作業系統配發,見 R16 |
| C3/C4/C5 | 不適用 | 無設定檔、無 DB、無登入態與語系 |
| C6–C9 截圖、紅框、遮罩、比對 | 不適用 | 本套件為純 API,無產品畫面;fixture 頁為測試鷹架,不設標準圖 |
| C10 輸入 | 不適用 | 無輸入欄;act 為導航(帶 `?token=`)與點擊 fixture 頁之登出鈕 |
| C11 偵測等待 | `page.waitForFunction`(同步判斷函式)/ 測試行程端輪詢假伺服器請求紀錄 | |
| C13 regen | 不適用 | 無標準圖 |
| C14 端點 | 正式模式用 `127.0.0.1`;開發模式案例刻意用 `localhost` | wsemi `isDev()` 以 href 含 `localhost` 判定,主機名即受測之模式軸 |

### 已知缺口 / 待辦

- 修前之 `test/all.test.mjs` 為佔位(`assert.strict.deepEqual(1, 1)`),run02 移除.
- 只測 Chromium;Firefox/Safari 未測(fetch 之同源憑證與簡單請求語意跨引擎一致,列已知限制).
