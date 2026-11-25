//e2e共用實作之單一橋接: 專案一律經此引用w-package-tools-e2e與w-playwright, 不各自手寫
import wpw from 'w-playwright'
export { default as registerCleanupHooks } from 'w-package-tools-e2e/src/registerCleanupHooks.mjs'
export { default as pollUntil } from 'w-package-tools-e2e/src/pollUntil.mjs'


/**
 * 首次取得Playwright受管瀏覽器(headless shell)之時限預算(毫秒), ensureE2eBrowser之逾時與其所在before之時限(此值加60000)皆取自本值
 *
 * 取值依據:
 * 1. 取得內容: Windows上為headless shell加ffmpeg加winldd三項, 解開後約300 MB, 下載之壓縮量約百MB級; 本機(網路快)實測持鎖者約15秒、等候安裝鎖者約17至30秒, 慢網路下可數分鐘
 * 2. w-playwright自身測試(api-autoInstall)對同一操作(空目錄真下載)給600000毫秒, 為單一行程自己下載之時限
 * 3. mocha --parallel下數個檔各在自己之worker首次啟動, Playwright之安裝鎖使只有一個worker下載, 其餘等候者須先等持鎖者下載完成再各自做一次已安裝之檢查,
 *    故預算取單次下載時限之1.5倍: 900000(15分鐘)
 * 4. 逾本預算即由ensureChromium結束安裝子行程樹並reject, 測試明確失敗而不無限等待
 * 已知取捨: 等候者另受Playwright自身之安裝鎖重試上限約束(20次指數退避, 約8分鐘; 其原始碼註解寫10分鐘), 持鎖者之下載超過此時間(極慢網路)時,
 * 等候者以安裝子行程離開碼1失敗, 不會等滿本預算
 * w-playwright目前未匯出建議之安裝預算; 其匯出後改取該值
 */
const PW_INSTALL_BUDGET_MS = 900000


//pmEnsure, ensureE2eBrowser之同程序記憶(Promise); 非逾時之失敗時清除, 使下次呼叫可重試
let pmEnsure = null


//reAnsi, 終端機顏色控制碼(Playwright之Downloading行在標題與from之間帶淡色碼), 以ESC字元(27)組出, 不把控制字元寫進正則字面
let reAnsi = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')


//isTimeout, 是否為ensureChromium之逾時失敗(w-playwright固定詞彙: code為E_INSTALL且訊息含timed out); 認不出時視為非逾時(只是多重試, 不會誤記憶)
let isTimeout = (err) => {
    return Boolean(err) && err.code === 'E_INSTALL' && /timed out/.test(String(err.message))
}


//doEnsure, 取得之本體(ensureE2eBrowser記憶其Promise)
let doEnsure = async () => {
    let t0 = Date.now()
    let downloads = 0
    let tail = '' //安裝子行程輸出之尾段, 失敗時印出供診斷
    console.log(`[e2e-browser] pid=${process.pid} 開始取得受管瀏覽器(預算${PW_INSTALL_BUDGET_MS}ms)`)
    try {
        let r = await wpw.ensureChromium({
            timeout: PW_INSTALL_BUDGET_MS,
            funLog: (label, safe, detail) => {
                if (label !== 'install-output') {
                    return
                }
                let s = String(detail).replace(reAnsi, '')
                tail = (tail + s).slice(-2000)
                for (let m of s.matchAll(/Downloading (.+?) from /g)) {
                    downloads++
                    console.log(`[e2e-browser] pid=${process.pid} 真下載: ${m[1]}`)
                }
            },
        })
        let ms = Date.now() - t0
        console.log(`[e2e-browser] pid=${process.pid} 瀏覽器已備妥(${r.kind}), 耗時${ms}ms, 本行程之安裝子行程真下載${downloads}項`)
        return { kind: r.kind, ms, downloads }
    }
    catch (err) {
        console.log(`[e2e-browser] pid=${process.pid} 取得失敗(code=${err && err.code}), 耗時${Date.now() - t0}ms, 安裝子行程輸出尾段:\n${tail}`)
        throw err
    }
}


/**
 * 集中取得Playwright受管瀏覽器(headless shell), 同一行程只執行一次(同行程並行呼叫共用同一Promise)
 *
 * 呼叫w-playwright之ensureChromium({ timeout: PW_INSTALL_BUDGET_MS }), 已安裝者Playwright不重複下載, 只做檢查;
 * mocha --parallel下各worker各自呼叫一次, 跨行程之安裝鎖由Playwright負責, 至多一個行程真下載;
 * 輸出[e2e-browser]行: 開始一行、每項真下載(Playwright輸出Downloading)一行、完成一行(含耗時與真下載項數)、失敗一行(含輸出尾段), 供事後以輸出點算真下載次數;
 * Playwright於環境變數npm_config_loglevel為silent、error、warn時不印Downloading, 此時項數恆為0, 須改以瀏覽器目錄內產物核對;
 * 失敗之處置: 逾時於同行程內記憶(其後之檔於before立即以同一錯誤失敗, 不各再等滿預算); 其他失敗(離線、安裝鎖等候逾時等)不記憶, 下次呼叫重試;
 * 啟動(launchChromium)一律不安裝, 呼叫端須先經本函數(setupE2e之獨立before), 缺瀏覽器時啟動立即失敗而不在短時限之hook內隱式下載
 *
 * @returns {Promise} 回傳Promise, resolve回傳{ kind, ms, downloads }, reject回傳w-playwright之E_INSTALL錯誤(含逾時)
 */
function ensureE2eBrowser() {
    if (pmEnsure === null) {
        pmEnsure = doEnsure()
        pmEnsure.catch((err) => {
            if (!isTimeout(err)) {
                pmEnsure = null
            }
        })
    }
    return pmEnsure
}


/**
 * 啟動Chromium之單一出口(本套件測試唯一之啟動點), 一律經w-playwright, 不直接使用playwright或playwright-core
 *
 * w-playwright於每次啟動之命令列恰給一個--disable-features(Playwright預設清單加AutofillAiWalletPrivatePasses加呼叫端自給者),
 * 使Chromium系瀏覽器不因啟動而對目前Windows使用者累計錯誤密碼次數; 本套件測試只用無頭(headless shell), 不啟動真Chrome、Edge或完整Chromium;
 * autoInstall為false: 啟動不安裝, 缺Playwright受管之瀏覽器時w-playwright拋E_BROWSER_MISSING; 瀏覽器由ensureE2eBrowser集中取得(時限對齊安裝預算),
 * 不讓安裝隱式發生在每案例beforeEach之短時限內; Linux缺系統相依時不自動安裝(installDeps預設關)
 *
 * @param {Object} [opt={}] 輸入chromium.launch之設定物件，原樣傳入w-playwright，預設{}
 * @returns {Promise} 回傳Promise，resolve回傳Browser，reject回傳帶code之Error
 */
async function launchChromium(opt = {}) {
    return wpw.launchChromium({ ...opt, autoInstall: false })
}


export {
    PW_INSTALL_BUDGET_MS,
    ensureE2eBrowser,
    launchChromium
}
