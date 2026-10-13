import fs from 'fs'
import path from 'path'
import buildUmd from './buildUmd.mjs'
import startFakeServer from './fakeServer.mjs'
import { launchChromium, registerCleanupHooks } from './e2eLib.mjs'


//keyLS, fixture頁之site為probe, localStorage鍵格式為公開契約(R6), 測試直接寫字串以確保格式未變
let keyLS = 'probe:userToken'


/**
 * 建立e2e檔之共用環境: before建置UMD至test/_tmp/<案名>/build並啟動假伺服器, after關閉伺服器並刪除test/_tmp/<案名>;
 * beforeEach/afterEach每案例一個全新瀏覽器
 *
 * @param {Object} opt 輸入設定物件
 * @param {String} opt.name 輸入案名(test/_tmp下之資料夾名)
 * @param {Integer} opt.port 輸入假伺服器埠號
 * @returns {Object} 回傳環境物件{srv,browser,url,openApp}, srv與browser於hook執行後才有值
 */
function setupE2e({ name, port }) {
    let fdTmp = path.resolve('./test/_tmp', name)
    let env = {
        srv: null,
        browser: null,
    }

    let rmTmp = () => {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    }

    before(async function() {
        this.timeout(180000)
        rmTmp()
        let { fp } = await buildUmd(path.join(fdTmp, 'build'))
        env.srv = await startFakeServer({ port, fpUmd: fp })
    })

    after(async function() {
        if (env.srv) {
            await env.srv.close()
            env.srv = null
        }
        rmTmp()
    })

    //備援: 中斷時同步刪除暫存
    registerCleanupHooks(rmTmp)

    beforeEach(async function() {
        env.srv.resetMode()
        env.srv.clearLog()
        env.browser = await launchChromium({ headless: true })
    })

    afterEach(async function() {
        if (env.browser) {
            await env.browser.close()
            env.browser = null
        }
    })

    //url, 主機host決定模式: 127.0.0.1為正式模式, localhost為開發模式(wsemi isDev以href含localhost判定)
    env.url = (o = {}) => {
        let { host = '127.0.0.1', token = null, search = null, cfg = {} } = o
        let q = token === null ? '' : `?token=${encodeURIComponent(token)}`
        if (search !== null) {
            q = search //直接指定查詢字串
        }
        return `http://${host}:${port}/app/${q}#${encodeURIComponent(JSON.stringify(cfg))}`
    }

    //openApp, 開新頁面(可先於同源空白頁預置localStorage)後導航進fixture頁
    env.openApp = async (o = {}) => {
        let { host = '127.0.0.1', preLS = null } = o
        let context = await env.browser.newContext()
        let page = await context.newPage()
        let consoleMsgs = []
        let pageErrors = []
        page.on('console', (m) => {
            consoleMsgs.push(`${m.type()}: ${m.text()}`)
        })
        page.on('pageerror', (e) => {
            pageErrors.push(String(e))
        })
        if (preLS !== null) {
            //前置(非act): 於同源空白頁預置localStorage
            await page.goto(`http://${host}:${port}/blank`)
            await page.evaluate(([k, v]) => {
                localStorage.setItem(k, v)
            }, [keyLS, preLS])
        }
        await page.goto(env.url(o))
        return { context, page, consoleMsgs, pageErrors }
    }

    return env
}


/**
 * 讀取fixture頁#ev之事件列
 *
 * @param {Object} page 輸入Playwright頁面
 * @returns {Promise} 回傳Promise，resolve為事件物件陣列[{ev,t,arg}]
 */
async function readEvents(page) {
    let s = await page.locator('#ev').textContent()
    return s.split('\n').filter((v) => v !== '').map((v) => JSON.parse(v))
}


/**
 * 等待fixture頁出現指定事件(判斷函數為同步)
 *
 * @param {Object} page 輸入Playwright頁面
 * @param {String} name 輸入事件名稱
 * @param {Object} [opt={}] 輸入設定物件
 * @param {Integer} [opt.timeout=15000] 輸入逾時毫秒數
 * @param {Integer} [opt.count=1] 輸入需達到之出現次數
 * @returns {Promise} 回傳Promise
 */
async function waitEvent(page, name, opt = {}) {
    let { timeout = 15000, count = 1 } = opt
    await page.waitForFunction(([name, count]) => {
        let s = document.getElementById('ev').textContent
        let n = s.split('\n').filter((v) => v.indexOf(`{"ev":"${name}",`) === 0).length
        return n >= count
    }, [name, count], { timeout })
}


/**
 * 取指定名稱之事件
 *
 * @param {Array} evs 輸入事件陣列
 * @param {String} name 輸入事件名稱
 * @returns {Array} 回傳事件陣列
 */
function evsOf(evs, name) {
    return evs.filter((v) => v.ev === name)
}


/**
 * 讀取localStorage之token
 *
 * @param {Object} page 輸入Playwright頁面
 * @returns {Promise} 回傳Promise，resolve為字串或null
 */
async function getLSToken(page) {
    return page.evaluate((k) => {
        return localStorage.getItem(k)
    }, keyLS)
}


/**
 * 等待固定時間(只用於負向觀察窗: 斷言某段時間內「沒有」事件發生)
 *
 * @param {Integer} ms 輸入毫秒數
 * @returns {Promise} 回傳Promise
 */
function observeWindow(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}


export {
    keyLS,
    setupE2e,
    readEvents,
    waitEvent,
    evsOf,
    getLSToken,
    observeWindow
}
