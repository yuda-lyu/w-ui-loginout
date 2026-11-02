# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.

## 一、探測與建置(2026-10-14,審計第 1 次)

- **建置探測不可跑 `toolg/gDistRollup.mjs`**:它會清空並改寫受版控之 `dist/`.改用 `tmp/probe-build.mjs`(同設定,輸出至 `./tmp/...`,攔截 `console.warn` 取得 rollup 警告;`PROBE_SRC` 指定原型 src).rollup 之 JS API 未給 `onwarn` 時以 `console.warn` 印警告,攔截即可計數.
- **原型不必改 package.json**:把 src 複製到 `./tmp/<原型>/src/`,相依副本放 `./tmp/<原型>/node_modules/`;node-resolve 自原型 src 往上找,先命中原型之 node_modules,其餘(wsemi、lodash-es)落到 repo 之 node_modules.只複製 axios 本體時,其 Node 版相依(form-data 等)不存在,Node `import` 原型 src 會失敗——屬探測手段,不是方案缺陷.
- **瀏覽器版 axios 打包只需 axios 本體**:node-resolve `browser:true` 走 axios 之 `browser` 欄位,把 http adapter 與 Node 平台換成 null/browser 實作.
- **唯讀引用他 repo 之工具**:Playwright 以 `createRequire(import.meta.url)` 載入 `C:/opensrc/開源-JS-404-7-w-aggrid-vue/w-aggrid-vue/node_modules/playwright`;webpack 5.109.0 同 repo.
- **Node ESM 解析不吃 `NODE_PATH`**:要在 Node 驗「使用端有 axios 時 import src 可載入」,直接 import 下游已安裝之 `node_modules/w-ui-loginout/src/WUiLoginout.mjs`(唯讀).

## 二、本套件之行為事實

- **UMD 全域名含連字號**:`window['w-ui-loginout']`,不能寫 `window.wUiLoginout`.
- **開發/正式模式由主機名決定**:wsemi `isDev()` 判 `location.href` 含 `localhost`.同一案例用 `localhost` 為開發模式(缺 token 改用 defToken `sys`、`?token=error` 視為無效),用 `127.0.0.1` 為正式模式.測試要刻意兩者都跑,不可一律 127.0.0.1.
- **axios 不存在時之假象**:UMD 取 `globalThis.axios` 為 undefined,呼叫即 `TypeError: t is not a function`(壓縮後名稱);login 把它歸類為「登入時無法連線」且不送任何請求,看起來像伺服器不通.判斷是否真的連線失敗,要看假伺服器有沒有收到請求.
- **未設 checkToken 時 detect 不會報錯**:`getUrl('checkToken')` 回空字串,GET '' 打到目前頁面拿到 HTML 200,被當成功,永遠不登出.
- **detect 無停止介面**:回傳 null;logout 後 detect 仍會在下一輪觸發 procLogout('令牌已清除');呼叫兩次即雙重輪詢.
- **localStorage 鍵 `${site}:userToken` 是公開契約**:下游 w-web-task 之登出直接寫 `'wtask:userToken'`.

## 三、量測之雜訊與陷阱

- **socket 被假伺服器直接 destroy 時,Chromium 會自動重送 GET**:一次 axios 呼叫在伺服器端記到 3 筆.斷言「重試次數」要用 HTTP 錯誤狀態(如 401),不要用網路錯誤.
- **比對不同版本之結果要正規化**:測試頁 HTML 內含版本名(D4 情境回應本文就是頁面),壓縮後變數名也不同(`a.replace` vs `u.replace`),這兩類差異不是行為差異.
- **Bash 工具禁用 `cd`**:本輪開頭跑 `npm test` 時誤用一次;工作目錄本就是 repo 根.
- **改檔一律用 Edit/Write,不用 `sed -i`**:本輪曾以 `sed -i` 改 `./tmp/probe-build.mjs` 一次(全域規範 §12.2 違反).
- **比對計數直接貼腳本之 SUMMARY**:初稿把「只差測試頁內容」之 D4 先心算排除,又把 21 情境與 42 次執行混用,寫出 40/42、42/42 等錯數(實為 C 36/42、A 40/42).報告中之計數一律寫「N 次中 M 次完全一致 + 差異分類」,並以 `tmp/probe-compare.mjs` 之輸出為準.

## 四、run02 實作(2026-10-14)

- **fixture 頁之內嵌腳本不寫分號時,以 `(` 開頭之行會黏到上一行**:`btn.addEventListener(...)` 下一行寫 `(cfg.calls || []).forEach(...)`,被解析成 `addEventListener(...)(...)`,頁面拋 `TypeError ... is not a function`,所有 e2e 一起逾時.改為先指派變數再呼叫.全部 e2e 同時逾時時,先開除錯腳本看 pageerror(`tmp/run02/dbg-fixture.mjs`).
- **不得動 git 索引**:本輪曾為刪除佔位測試誤下 `git rm --cached`,索引因而多一筆 staged 刪除.以 `git add <檔>` 加回(檔案未變,索引即同 HEAD),再以 `git diff --cached --stat` 為空確認,之後只用 `rm` 刪工作目錄之檔.刪除受追蹤檔一律只動工作目錄.
- **修前紅要分兩層證**:①修前原樣(axios 不可解析):幾乎全紅,但紅因多半是 axios;②修前 + 可用 axios(`tmp/run02/headA`,原型 A 之作法):只剩斷言行為變更之案例為紅(B1、B2、B4、除錯輸出、錯誤格式、回應形狀),未變更之行為兩邊皆綠.②才證明各案例對其規則有分辨力.測試工具以環境變數 `WUL_FDSRC`、`WUL_README` 指向副本,不動工作樹.
- **mocha `--parallel` 下各檔獨立程序**:各 e2e 檔各自在 `before` 建 UMD 至 `test/_tmp/<檔名>/build`、各用一個固定埠(8430–8434),互不干擾;`after` 刪除自己之子資料夾,`test/_tmp/` 本身保留空目錄(已 gitignore).
- **`.editorconfig` 為 CRLF**:Write 工具寫出 LF;新增檔以 `tmp/run02/to-crlf.mjs` 轉 CRLF 後須重跑測試與 eslint.git 之 autocrlf 會於提交時正規化,行尾不影響版本庫內容.
- **建置設定單一來源**:`toolg/distRollupOpt.mjs` 由 `gDistRollup.mjs` 與 `test/tools/buildUmd.mjs` 共用;改建置設定只改這一處.(2026-11-02 依 dspec〈自有套件之發布與建置腳本〉撤,改回標準寫法)
- **報告中之案數以 mocha json 輸出逐檔計數**(`--reporter json --reporter-option output=<檔>`):本輪自檢曾把 e2e 案數心算成 48(實為 46),追加案例後亦須重算各檔行數與案數.
- **U3(打包工具引用 main)要用修後建出之 UMD 實測**:把建出之 UMD 放進模擬使用端套件之 `dist/`,入口 `import wui from 'w-ui-loginout'` 以 webpack 打包(`tmp/run02/downstream-sim.mjs main`),不以原型結果代表.

## 五、下游與生態系(2026-10-14 調查)

- 下游 w-web-api、w-web-perm、w-web-task 皆以 `import wui from 'w-ui-loginout/src/WUiLoginout.mjs'` 引用,只用 `wui(site,{timeWaitAnimation:2000,params:{}})` + `login`;loginSuccess 讀 `data.token`、`data.user`,loginError 只 console.log 後轉址;不用 detect/logout.
- 下游能解析 axios 是因 `w-serv-hapi → w-converhp → axios ^1.20.0` 傳遞帶入並 hoist;w-web-task 另自行宣告 axios(Node 端用).
- 下游 api、perm 之 e2e 以 `page.route('**/api/getUserByToken**', () => {})` 使請求懸置來拍「連線中」——HTTP 實作不可加預設逾時.
- 生態系先例:w-converhp client 把 axios 打包進 UMD;w-comor-hapi client 把 axios 列 external 並在 README 指示先載;w-web-api、w-web-perm 已改用 fetch(錯誤訊息不含網址,因網址帶 token).

## 六、測試以副本指定 cwd 執行 toolg 腳本(2026-11-02,ul267)

- **副本須含 `package.json`**:`rollupFile` 以 cwd 之 `package.json` 取版本與 banner,副本只有 `src`、`toolg` 時建置以 ENOENT 失敗.副本放 `test/_tmp/<案名>/build/`(repo 內),toolg 與 src 之裸引用由 repo 之 `node_modules` 往上解析,不必連結 `node_modules`.
- **舊 toolg 建出之 UMD 與副本建出者逐 byte 相同**(sha256 前 16 碼 `2accba90050f9fd6`);sourcemap 只有 `sources` 之相對路徑(`../` 層數)隨副本位置不同,`mappings`、`sourcesContent` 相同,不是行為差異,比對 dist 以 UMD 為準.
- **建置探測可直接用正式腳本**:前述「建置探測不可跑 `toolg/gDistRollup.mjs`」之替代手段,現可把 `src`、`toolg`、`package.json` 複製到 `./tmp/<名>/` 後以 cwd 指定執行,設定即為正式腳本本身,不必自抄一份.
