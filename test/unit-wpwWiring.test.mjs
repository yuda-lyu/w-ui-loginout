import assert from 'assert'
import wpw from 'w-playwright'
import { setupE2e } from './tools/e2eHelpers.mjs'
import { PW_INSTALL_BUDGET_MS, launchChromium } from './tools/e2eLib.mjs'


//unit-wpwWiring: 本套件測試之瀏覽器啟動點經w-playwright(規則帳本R17; 對應w-playwright帳本R-PW-WIRING)
//以wpw.setBrowserTypeForTest之替身收啟動選項: 斷言替身確被呼叫(依賴樹有兩份w-playwright時替身只作用於測試所引用之一份, 未斷言即可能空過)、
//選項含守門(args恰一個--disable-features且為最後一個元素、含AutofillAiWalletPrivatePasses)、只啟動無頭(headless shell), 不啟動真Chrome、Edge或完整Chromium
//W1、W2為替身(不啟動瀏覽器); W3以next()走真路徑(真啟動headless shell一次, 不觸發登入嘗試); W4核對取得瀏覽器之before接線(規則帳本R18)
describe('unit-wpwWiring', function() {

    let seen = []
    let stub = { close: async () => {} }
    let restore = null

    //須先於setupE2e註冊, 使替身在setupE2e之beforeEach啟動瀏覽器前已就位
    beforeEach(function() {
        seen.length = 0
        restore = wpw.setBrowserTypeForTest({
            launch: async (o) => {
                seen.push(o)
                return stub
            },
        })
    })

    afterEach(function() {
        if (restore) {
            restore()
            restore = null
        }
    })

    let env = setupE2e({ name: 'unit-wpwWiring' })

    //assertGuarded, 斷言替身收到之合併後選項含守門且只啟動無頭
    let assertGuarded = (o) => {
        //只啟動無頭(未給通道與執行檔, 即Playwright受管之headless shell)
        assert.strictEqual(o.headless, true)
        assert.strictEqual(o.channel, undefined)
        assert.strictEqual(o.executablePath, undefined)

        //args恰一個--disable-features, 且為最後一個元素, 含守門功能與Playwright預設功能
        assert.ok(Array.isArray(o.args))
        let idx = o.args.map((v, i) => (/^--disable-features=/i.test(v) ? i : -1)).filter((i) => i >= 0)
        assert.strictEqual(idx.length, 1, JSON.stringify(o.args))
        assert.strictEqual(idx[0], o.args.length - 1)
        let feats = o.args[idx[0]].slice('--disable-features='.length).split(',')
        assert.ok(feats.includes('AutofillAiWalletPrivatePasses'))
        let info = wpw.getPlaywrightInfo()
        for (let f of info.defaultDisableFeatures) {
            assert.ok(feats.includes(f), `缺Playwright預設功能: ${f}`)
        }

        //去掉Playwright預設之那一串(否則Chromium取最後一串, 兩串並存時以後者為準而前者失效)
        assert.ok(Array.isArray(o.ignoreDefaultArgs))
        assert.ok(o.ignoreDefaultArgs.some((v) => /^--disable-features=/i.test(v)))
    }

    it('W1 setupE2e之beforeEach經w-playwright啟動: 替身確被呼叫1次, env.browser為替身回傳者, 選項含守門', function() {
        //R17: 測試啟動瀏覽器之點(setupE2e的beforeEach)經w-playwright
        assert.strictEqual(seen.length, 1)
        assert.strictEqual(env.browser, stub)
        assertGuarded(seen[0])
        assert.strictEqual(seen[0].autoInstall, undefined, 'autoInstall為w-playwright自用鍵, 不轉傳給Playwright')
    })

    it('W2 e2eLib.launchChromium原樣傳入呼叫端選項, 呼叫端自給之--disable-features吸收進同一串', async function() {
        //R17: 單一出口保留原選項(args、timeout等), 守門與呼叫端自給者合併為恰一串
        let b = await launchChromium({ headless: true, timeout: 12345, args: ['--lang=en-US', '--disable-features=Translate'] })
        assert.strictEqual(b, stub)
        assert.strictEqual(seen.length, 2) //1次為beforeEach, 1次為本案
        let o = seen[1]
        assertGuarded(o)
        assert.strictEqual(o.timeout, 12345)
        assert.ok(o.args.includes('--lang=en-US'))
        assert.ok(o.args[o.args.length - 1].split(',').includes('Translate'))
    })

    it('W3 next()走真路徑: 合併後之選項真啟動headless shell並可使用(接縫不用替身), 選項含守門', async function() {
        this.timeout(120000)
        restore()
        let seenReal = []
        restore = wpw.setBrowserTypeForTest({
            launch: async (o, next) => {
                seenReal.push(o)
                return next()
            },
        })
        let b = await launchChromium({ headless: true })
        try {
            assert.strictEqual(seenReal.length, 1)
            assertGuarded(seenReal[0])
            let page = await b.newPage()
            await page.setContent('<div id="x">ok</div>')
            assert.strictEqual(await page.locator('#x').textContent(), 'ok')
            assert.ok(/^\d+\./.test(b.version()), b.version())
        }
        finally {
            await b.close()
        }
    })

    it('W4 setupE2e之取得瀏覽器before獨立於建置before: 排在建置before之前, 時限不短於安裝預算加60秒, 建置before時限仍為180000(安裝不與建置、起伺服器共用180秒)', function() {
        //R18: 首次安裝(下載數百MB)與建置UMD各有各的時限; 以執行後之hook實際時限(hook內this.timeout所設)與其函式本體核對
        let hooks = this.test.parent._beforeAll
        assert.ok(Array.isArray(hooks) && hooks.length === 2, `mocha內部之_beforeAll結構改變或before數量不是2(取得、建置): ${hooks && hooks.length}`)
        let [hEnsure, hBuild] = hooks
        //hook本體原始碼(去註解): 先設時限、再await取得; 時限若設在await之後, 計時器已以預設時限起算, 執行後讀到之hook時限仍為預期值而抓不到
        let strip = (fn) => String(fn).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
        let sEnsure = strip(hEnsure.fn)
        let iTimeout = sEnsure.search(/this\.timeout\(PW_INSTALL_BUDGET_MS\s*\+\s*60000\)/)
        let iAwait = sEnsure.search(/\bawait\s+ensureE2eBrowser\(\)/)
        assert.ok(iTimeout >= 0, `第一個before須以this.timeout(PW_INSTALL_BUDGET_MS + 60000)設時限: ${sEnsure}`)
        assert.ok(iAwait > iTimeout, `第一個before須於設時限之後await ensureE2eBrowser(): ${sEnsure}`)
        assert.ok(!/\bawait\b/.test(sEnsure.slice(0, iTimeout)), '設時限之前不得有await')
        assert.ok(!strip(hBuild.fn).includes('ensureE2eBrowser'), '取得不得併入建置before')
        assert.ok(hEnsure.timeout() >= PW_INSTALL_BUDGET_MS + 60000, `取得before之時限不足: ${hEnsure.timeout()}`)
        assert.strictEqual(hBuild.timeout(), 180000)
    })

})
