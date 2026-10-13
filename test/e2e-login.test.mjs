import assert from 'assert'
import { setupE2e, readEvents, waitEvent, evsOf, getLSToken, observeWindow } from './tools/e2eHelpers.mjs'


//e2e-login: 使用者帶?token=導航進使用端頁(只載入建出之UMD), 頁面載入即呼叫login(同下游App.vue)
//斷言對應規則帳本(CLAUDE_rulebook.md)之R4、R5、R6、R10、R11、R13; 編號見帳本之測試清單
describe('e2e-login', function() {

    let env = setupE2e({ name: 'e2e-login', port: 8430 })

    //verifyReqs, 驗證請求(預設路徑/app/api/getUserByToken)
    let verifyReqs = () => {
        return env.srv.getLog().filter((v) => v.path === '/app/api/getUserByToken')
    }

    it('L1 URL帶token: 登入成功, loginSuccess收到{token,user}, LS寫入token, 驗證請求帶Accept', async function() {
        let { page, consoleMsgs, pageErrors } = await env.openApp({ token: 'good' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)

        //R4: 只載UMD即可登入; 下游依賴之data.token、data.user不變
        let ls = evsOf(evs, 'loginSuccess')
        assert.strictEqual(ls.length, 1)
        assert.deepStrictEqual(ls[0].arg, { token: 'good', user: { id: 'u1', name: 'User u1', token: 'good' } })
        assert.strictEqual(evsOf(evs, 'loginError').length, 0)
        assert.deepStrictEqual(evsOf(evs, 'afterGetUser')[0].arg, { id: 'u1', name: 'User u1', token: 'good' })
        assert.deepStrictEqual(evsOf(evs, 'login.return')[0].arg, { state: true, data: { token: 'good', user: { id: 'u1', name: 'User u1', token: 'good' } } })
        assert.strictEqual(await page.locator('#state').textContent(), 'login:success')

        //R6: LS鍵格式不變
        assert.strictEqual(await getLSToken(page), 'good')

        //R5①: 只發一個GET, Accept同原axios
        let reqs = verifyReqs()
        assert.strictEqual(reqs.length, 1)
        assert.deepStrictEqual(reqs[0].query, { token: 'good' })
        assert.strictEqual(reqs[0].accept, 'application/json, text/plain, */*')

        //R13: 無除錯輸出
        assert.deepStrictEqual(consoleMsgs, [])
        assert.deepStrictEqual(pageErrors, [])
    })

    it('L2 正式模式無token: loginError{text:登入時無效令牌}, 不送驗證請求', async function() {
        let { page } = await env.openApp({})
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'loginError')[0].arg, { text: '登入時無效令牌', msg: 'invalid token' })
        assert.strictEqual(verifyReqs().length, 0)
        assert.strictEqual(await getLSToken(page), '')
    })

    it('L2-dev 開發模式(localhost)無token: 改用defToken sys驗證', async function() {
        let { page } = await env.openApp({ host: 'localhost' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.strictEqual(evsOf(evs, 'loginSuccess')[0].arg.token, 'sys')
        assert.deepStrictEqual(verifyReqs().map((v) => v.query.token), ['sys'])
    })

    it('L3 LS有token且URL無: 以LS之token登入', async function() {
        let { page } = await env.openApp({ preLS: 'lsgood' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.strictEqual(evsOf(evs, 'loginSuccess')[0].arg.token, 'lsgood')
        assert.strictEqual(await getLSToken(page), 'lsgood')
    })

    it('L4 伺服器回state=error: loginError{text:登入時驗證失敗, msg:伺服器之msg}, LS清空', async function() {
        let { page } = await env.openApp({ token: 'bad' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'loginError')[0].arg, { text: '登入時驗證失敗', msg: 'token expired' })
        assert.strictEqual(await getLSToken(page), '')
    })

    it('L5 驗證API回500: loginError{text:登入時無法連線}, msg為字串且不含網址', async function() {
        env.srv.setMode({ verify: 'e500' })
        let { page } = await env.openApp({ token: 'good' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        let e = evsOf(evs, 'loginError')[0].arg

        //R5⑤、R10(L2: login之連線錯誤msg為字串)
        assert.deepStrictEqual(e, { text: '登入時無法連線', msg: 'Error: Request failed with status code 500' })

        //R5⑦: 不含網址與token
        assert.ok(!e.msg.includes('token') && !e.msg.includes('/app/') && !e.msg.includes('8430'))
        assert.strictEqual(await getLSToken(page), '')
    })

    it('L6 驗證API網路錯誤: loginError{text:登入時無法連線, msg:Error: Network Error}', async function() {
        env.srv.setMode({ verify: 'neterr' })
        let { page } = await env.openApp({ token: 'good' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'loginError')[0].arg, { text: '登入時無法連線', msg: 'Error: Network Error' })
    })

    it('L7 驗證API回HTML: loginError{text:登入時無法取得使用者資訊}, 且無除錯輸出', async function() {
        env.srv.setMode({ verify: 'html' })
        let { page, consoleMsgs } = await env.openApp({ token: 'good' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'loginError')[0].arg, { text: '登入時無法取得使用者資訊', msg: 'invalid user' })

        //R13: 修前此路徑印console.log('data', ...)
        assert.deepStrictEqual(consoleMsgs, [])
    })

    it('L8 驗證API回空使用者: loginError{text:登入時無法取得使用者資訊}', async function() {
        env.srv.setMode({ verify: 'nouser' })
        let { page } = await env.openApp({ token: 'good' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'loginError')[0].arg, { text: '登入時無法取得使用者資訊', msg: 'invalid user' })
    })

    it('L9-dev 開發模式?token=error: loginError{text:登入時無效令牌}, 不送驗證請求', async function() {
        let { page } = await env.openApp({ host: 'localhost', token: 'error' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'loginError')[0].arg, { text: '登入時無效令牌', msg: 'invalid token' })
        assert.strictEqual(verifyReqs().length, 0)
    })

    it('L9 正式模式?token=error: 視為一般token送驗證', async function() {
        let { page } = await env.openApp({ token: 'error' })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.strictEqual(evsOf(evs, 'loginSuccess')[0].arg.token, 'error')
        assert.strictEqual(verifyReqs().length, 1)
    })

    it('L10 urlForVerify: 改打指定網址驗證', async function() {
        let { page } = await env.openApp({ token: 'good', cfg: { wopt: { urlForVerify: '/sso/api/getUserByToken' } } })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)
        assert.strictEqual(evsOf(evs, 'loginSuccess')[0].arg.user.id, 'u2')
        let reqs = env.srv.getLog().filter((v) => v.path === '/sso/api/getUserByToken')
        assert.strictEqual(reqs.length, 1)
        assert.strictEqual(verifyReqs().length, 0)
    })

    it('L-hang 驗證請求不回應: 觀察窗內不呼叫任何結果回呼(不設逾時)', async function() {
        env.srv.setMode({ verify: 'hang' })
        let { page } = await env.openApp({ token: 'good' })

        //R5⑧: 負向觀察窗
        await observeWindow(6000)
        let evs = await readEvents(page)
        for (let name of ['afterLogin', 'loginSuccess', 'loginError', 'login.return', 'login.reject']) {
            assert.strictEqual(evsOf(evs, name).length, 0, name)
        }
        assert.strictEqual(await page.locator('#state').textContent(), 'loading')
        assert.strictEqual(verifyReqs().length, 1)
    })

    it('B2-L afterGetUser拋錯: 流程失敗, loginError收到{text:登入時發生例外, msg:原錯誤}, LS清空', async function() {
        let { page } = await env.openApp({ token: 'good', cfg: { throwIn: ['afterGetUser'] } })
        await waitEvent(page, 'login.return')
        let evs = await readEvents(page)

        //R10、R11①
        let e = evsOf(evs, 'loginError')[0].arg
        assert.strictEqual(e.text, '登入時發生例外')
        assert.strictEqual(e.msg.__error, 'Error')
        assert.strictEqual(e.msg.message, 'boom-afterGetUser')
        assert.deepStrictEqual(evsOf(evs, 'afterLogin')[0].arg.state, false)
        assert.strictEqual(evsOf(evs, 'afterLogin')[0].arg.data.text, '登入時發生例外')
        assert.strictEqual(evsOf(evs, 'loginSuccess').length, 0)
        assert.strictEqual(await getLSToken(page), '')
    })

    it('B3-L loginSuccess拋錯: login()以原錯誤reject, LS已寫入token', async function() {
        let { page } = await env.openApp({ token: 'good', cfg: { throwIn: ['loginSuccess'] } })
        await waitEvent(page, 'login.reject')
        let evs = await readEvents(page)

        //R11②: 結束通知之拋錯不吞, 狀態變更已完成
        let r = evsOf(evs, 'login.reject')[0].arg
        assert.strictEqual(r.__error, 'Error')
        assert.strictEqual(r.message, 'boom-loginSuccess')
        assert.strictEqual(evsOf(evs, 'login.return').length, 0)
        assert.strictEqual(await getLSToken(page), 'good')
    })

})
