import assert from 'assert'
import { setupE2e, readEvents, waitEvent, evsOf, getLSToken, observeWindow } from './tools/e2eHelpers.mjs'
import { pollUntil } from './tools/e2eLib.mjs'


//e2e-detect: 登入成功後使用端頁啟動detect(輪詢檢查令牌)
//斷言對應規則帳本(CLAUDE_rulebook.md)之R5、R7、R10、R11、R12、R13
describe('e2e-detect', function() {

    let env = setupE2e({ name: 'e2e-detect', port: 8432 })

    let pAll = { logOut: '{origin}/sso/api/logout?token={token}', checkToken: '{origin}/sso/api/checkToken?token={token}' }

    let checkReqs = () => {
        return env.srv.getLog().filter((v) => v.path === '/sso/api/checkToken')
    }

    //openDetect, 登入後啟動偵測, 等偵測已啟動
    let openDetect = async (o = {}) => {
        let cfg = { wopt: { params: pAll }, detect: { timePeriod: 200 }, ...o.cfg }
        let r = await env.openApp({ token: 'good', cfg })
        await waitEvent(r.page, 'detect.started', { count: cfg.detect.twice ? 2 : 1 })
        return r
    }

    it('D1 輪詢中伺服器改回401: 1+retry(3)次失敗後procLogout{text:驗證令牌時遭遇錯誤, msg:Error 401}, 之後停止輪詢, 無除錯輸出', async function() {
        let { page, consoleMsgs } = await openDetect()
        await waitEvent(page, 'detect.procCheckToken', { count: 2 })
        let nOk = checkReqs().length
        env.srv.setMode({ checkToken: 'e401' })
        await waitEvent(page, 'detect.procLogout')
        let evs = await readEvents(page)

        //R5⑤、R10(L2: detect之連線錯誤msg為Error物件)
        let e = evsOf(evs, 'detect.procLogout')[0].arg
        assert.strictEqual(e.text, '驗證令牌時遭遇錯誤')
        assert.strictEqual(e.msg.isPlainError, true)
        assert.strictEqual(e.msg.message, 'Request failed with status code 401')
        assert.strictEqual(e.msg.status, 401)

        //預設retry=3: 失敗之一輪共4次請求
        let nFail = checkReqs().length - nOk
        assert.ok(nFail === 4 || nFail === 5, `nFail=${nFail}`) //切換模式時可能有一輪已在途

        //R12④: 失敗即停止
        let n1 = checkReqs().length
        await observeWindow(1000)
        assert.strictEqual(checkReqs().length, n1)
        assert.strictEqual(evsOf(await readEvents(page), 'detect.procLogout').length, 1)

        //R13: 修前重試時印console.log(`retry n=...`); 只允許瀏覽器自身之資源載入錯誤
        assert.deepStrictEqual(consoleMsgs.filter((v) => !v.includes('Failed to load resource')), [])
    })

    it('D2 他分頁登出(LS被清): procLogout{text:令牌已清除}', async function() {
        let { page, context } = await openDetect()
        await waitEvent(page, 'detect.procCheckToken')

        //使用者於同站另一分頁點登出
        let page2 = await context.newPage()
        await page2.goto(env.url({ cfg: { login: false, wopt: { params: pAll } } }))
        await page2.locator('#btnLogout').click()
        await waitEvent(page2, 'logout.return')
        assert.strictEqual(await getLSToken(page2), '')

        await waitEvent(page, 'detect.procLogout')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'detect.procLogout')[0].arg, { text: '令牌已清除', msg: 'invalid token' })
    })

    it('D3 procCheckToken回false: procLogout{text:驗證令牌失敗, msg:回應}', async function() {
        let { page } = await openDetect({ cfg: { ret: { 'detect.procCheckToken': false } } })
        await waitEvent(page, 'detect.procLogout')
        let evs = await readEvents(page)
        let e = evsOf(evs, 'detect.procLogout')[0].arg
        assert.strictEqual(e.text, '驗證令牌失敗')
        assert.strictEqual(e.msg.status, 200)
        assert.deepStrictEqual(e.msg.data, { state: 'success', msg: true })
    })

    it('D4 未設checkToken網址: detect()以{text:無法取得驗證令牌用設定資訊}reject, 不輪詢、不呼叫回呼', async function() {
        let { page } = await env.openApp({ token: 'good', cfg: { wopt: { params: { logOut: pAll.logOut } }, detect: { timePeriod: 150 } } })
        await waitEvent(page, 'detect.reject')
        let evs = await readEvents(page)

        //R7(B1)
        assert.deepStrictEqual(evsOf(evs, 'detect.reject')[0].arg, { text: '無法取得驗證令牌用設定資訊', msg: 'invalid urlCheckToken' })
        assert.strictEqual(evsOf(evs, 'detect.started').length, 0)

        //負向觀察窗: 修前會對目前頁面輪詢
        await observeWindow(1000)
        let evs2 = await readEvents(page)
        assert.strictEqual(evsOf(evs2, 'detect.procCheckToken').length, 0)
        assert.strictEqual(evsOf(evs2, 'detect.procLogout').length, 0)
        let pageReqs = env.srv.getLog().filter((v) => v.path === '/app/')
        assert.strictEqual(pageReqs.length, 1) //只有導航那一次
    })

    it('D5 checkToken網路錯誤: procLogout{text:驗證令牌時遭遇錯誤, msg:Error(Network Error)}', async function() {
        let { page } = await openDetect()
        await waitEvent(page, 'detect.procCheckToken')
        env.srv.setMode({ checkToken: 'neterr' })
        await waitEvent(page, 'detect.procLogout')
        let e = evsOf(await readEvents(page), 'detect.procLogout')[0].arg
        assert.strictEqual(e.text, '驗證令牌時遭遇錯誤')
        assert.strictEqual(e.msg.message, 'Network Error')
    })

    it('B2-D procCheckToken拋錯: procLogout{text:驗證令牌時發生例外, msg:原錯誤}, 停止輪詢', async function() {
        let { page } = await openDetect({ cfg: { throwIn: ['detect.procCheckToken'] } })
        await waitEvent(page, 'detect.procLogout')
        let evs = await readEvents(page)

        //R10、R11①
        let e = evsOf(evs, 'detect.procLogout')[0].arg
        assert.strictEqual(e.text, '驗證令牌時發生例外')
        assert.strictEqual(e.msg.__error, 'Error')
        assert.strictEqual(e.msg.message, 'boom-detect.procCheckToken')
        let n1 = checkReqs().length
        await observeWindow(800)
        assert.strictEqual(checkReqs().length, n1)
    })

    it('B2-D2 啟動時之非預期例外(params.checkToken非字串使getUrl拋錯): detect()以{text:驗證令牌時發生例外, msg:原錯誤}reject', async function() {
        let { page } = await env.openApp({ token: 'good', cfg: { wopt: { params: { checkToken: 123 } }, detect: { timePeriod: 150 } } })
        await waitEvent(page, 'detect.reject')
        let e = evsOf(await readEvents(page), 'detect.reject')[0].arg

        //R10: 非預期例外(非回呼來源)亦包成{text,msg}
        assert.strictEqual(e.text, '驗證令牌時發生例外')
        assert.strictEqual(e.msg.__error, 'TypeError')
        await observeWindow(600)
        assert.strictEqual(checkReqs().length, 0)
    })

    it('B3-D procLogout拋錯: 不吞, 成為未處理之rejection; 輪詢已停止', async function() {
        let { page } = await openDetect({ cfg: { ret: { 'detect.procCheckToken': false }, throwIn: ['detect.procLogout'] } })
        await waitEvent(page, 'unhandledrejection')
        let evs = await readEvents(page)

        //R11②
        let r = evsOf(evs, 'unhandledrejection')[0].arg
        assert.strictEqual(r.__error, 'Error')
        assert.strictEqual(r.message, 'boom-detect.procLogout')
        let n1 = checkReqs().length
        await observeWindow(800)
        assert.strictEqual(checkReqs().length, n1)
    })

    it('B4-S 停止: detect resolve停止函數, 點停止後不再發請求、不呼叫回呼', async function() {
        let { page } = await openDetect()
        let evs = await readEvents(page)

        //R12①
        assert.strictEqual(evsOf(evs, 'detect.started')[0].arg, 'function')
        await waitEvent(page, 'detect.procCheckToken', { count: 2 })
        await page.locator('#btnStopDetect').click()
        await waitEvent(page, 'detect.stopLast')
        let n1 = checkReqs().length
        let c1 = evsOf(await readEvents(page), 'detect.procCheckToken').length

        //負向觀察窗(5個週期)
        await observeWindow(1000)
        let evs2 = await readEvents(page)
        assert.strictEqual(checkReqs().length, n1)
        assert.strictEqual(evsOf(evs2, 'detect.procCheckToken').length, c1)
        assert.strictEqual(evsOf(evs2, 'detect.procLogout').length, 0)
    })

    it('B4-F 停止時有進行中之一輪: 該輪完成後不呼叫回呼', async function() {
        env.srv.setMode({ checkToken: 'slow', slowMs: 1500 })
        let { page } = await openDetect({ cfg: { detect: { timePeriod: 300 } } })

        //等第一輪請求送出(伺服器延遲1.5秒才回應)後停止
        await pollUntil('第一輪checkToken請求已送出', () => checkReqs().length >= 1, { timeout: 10000, interval: 50 })
        await page.locator('#btnStopDetect').click()
        await waitEvent(page, 'detect.stopLast')

        //R12①: 在途之請求於停止後完成, 不得呼叫procCheckToken
        await observeWindow(2500)
        let evs = await readEvents(page)
        assert.strictEqual(evsOf(evs, 'detect.procCheckToken').length, 0)
        assert.strictEqual(evsOf(evs, 'detect.procLogout').length, 0)
    })

    it('B4-R 重複呼叫: 後一次取代前一次; 前一次之停止函數不影響, 後一次之停止函數停止全部', async function() {
        let { page } = await openDetect({ cfg: { detect: { timePeriod: 250, twice: true } } })

        //R12②: 只有一個偵測在跑(修前兩個並行, 請求數加倍)
        let n0 = checkReqs().length
        await observeWindow(1300)
        let nRun = checkReqs().length - n0
        assert.ok(nRun <= 7, `nRun=${nRun}`) //單一偵測約5次, 雙重約10次

        //前一次之停止函數不影響新偵測
        await page.locator('#btnStopFirst').click()
        await waitEvent(page, 'detect.stopFirst')
        let n1 = checkReqs().length
        await observeWindow(800)
        assert.ok(checkReqs().length > n1, '前一次之停止函數不應停止新偵測')

        //後一次之停止函數停止全部
        await page.locator('#btnStopDetect').click()
        await waitEvent(page, 'detect.stopLast')
        let n2 = checkReqs().length
        await observeWindow(1000)
        assert.strictEqual(checkReqs().length, n2)
    })

})
