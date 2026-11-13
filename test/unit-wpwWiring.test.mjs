import assert from 'assert'
import wpw from 'w-playwright'
import { setupE2e } from './tools/e2eHelpers.mjs'
import { launchChromium } from './tools/e2eLib.mjs'


//unit-wpwWiring: 本套件測試之瀏覽器啟動點經w-playwright(規則帳本R17; 對應w-playwright帳本R-PW-WIRING)
//以wpw.setBrowserTypeForTest之替身收啟動選項: 斷言替身確被呼叫(依賴樹有兩份w-playwright時替身只作用於測試所引用之一份, 未斷言即可能空過)、
//選項含守門(args恰一個--disable-features且為最後一個元素、含AutofillAiWalletPrivatePasses)、只啟動無頭(headless shell), 不啟動真Chrome、Edge或完整Chromium
//W1、W2為替身(不啟動瀏覽器); W3以next()走真路徑(真啟動headless shell一次, 不觸發登入嘗試)
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

})
