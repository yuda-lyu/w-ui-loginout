import assert from 'assert'
import { setupE2e, readEvents, waitEvent, evsOf, getLSToken, observeWindow } from './tools/e2eHelpers.mjs'


//e2e-logout: 登入後點使用端頁之「登出」鈕
//斷言對應規則帳本(CLAUDE_rulebook.md)之R5、R6、R7、R10、R11、R12
describe('e2e-logout', function() {

    let env = setupE2e({ name: 'e2e-logout', port: 8431 })

    let pLogOut = { logOut: '{origin}/sso/api/logout?token={token}', checkToken: '{origin}/sso/api/checkToken?token={token}' }

    let logoutReqs = () => {
        return env.srv.getLog().filter((v) => v.path === '/sso/api/logout')
    }

    let checkReqs = () => {
        return env.srv.getLog().filter((v) => v.path === '/sso/api/checkToken')
    }

    //loginThenLogout, 登入成功後點登出鈕(L3點擊), 等到登出結果
    let loginThenLogout = async (o = {}) => {
        let { page } = await env.openApp({ token: 'good', cfg: { wopt: { params: pLogOut }, ...o.cfg } })
        await waitEvent(page, 'login.return')
        if (o.beforeClick) {
            await o.beforeClick(page)
        }
        await page.locator('#btnLogout').click()
        await waitEvent(page, o.waitFor || 'logout.return')
        return page
    }

    it('O1 登出成功: procLogout收到回應{data,status,statusText,headers}, 回傳{state:true,data:{token}}, LS清空', async function() {
        let page = await loginThenLogout()
        let evs = await readEvents(page)

        //R5④: 回應形狀
        let res = evsOf(evs, 'logout.procLogout')[0].arg
        assert.deepStrictEqual(Object.keys(res).sort(), ['data', 'headers', 'status', 'statusText'])
        assert.strictEqual(res.status, 200)
        assert.strictEqual(res.statusText, 'OK')
        assert.deepStrictEqual(res.data, { state: 'success', msg: 'logout ok' })
        assert.ok(res.headers['content-type'].startsWith('application/json'))

        assert.deepStrictEqual(evsOf(evs, 'logout.return')[0].arg, { state: true, data: { token: 'good' } })
        assert.deepStrictEqual(evsOf(evs, 'logoutSuccess')[0].arg, { token: 'good' })
        assert.strictEqual(await page.locator('#state').textContent(), 'logout:success')

        //R6
        assert.strictEqual(await getLSToken(page), '')
        assert.deepStrictEqual(logoutReqs().map((v) => v.query.token), ['good'])
    })

    it('O2 登出API回500: logoutError{text:登出時遭遇錯誤, msg:Error(帶status與response)}, LS清空', async function() {
        env.srv.setMode({ logout: 'e500' })
        let page = await loginThenLogout()
        let evs = await readEvents(page)

        //R5⑤、R10(L2: logout之連線錯誤msg為Error物件)
        let e = evsOf(evs, 'logoutError')[0].arg
        assert.strictEqual(e.text, '登出時遭遇錯誤')
        assert.strictEqual(e.msg.__error, 'Error')
        assert.strictEqual(e.msg.isPlainError, true)
        assert.strictEqual(e.msg.message, 'Request failed with status code 500')
        assert.strictEqual(e.msg.status, 500)
        assert.strictEqual(e.msg.responseStatus, 500)
        assert.strictEqual(e.msg.responseData, 'Internal Server Error')
        assert.ok(!e.msg.message.includes('token'))
        assert.strictEqual(await getLSToken(page), '')
    })

    it('O3 登出API網路錯誤: logoutError{text:登出時遭遇錯誤, msg:Error(Network Error)}', async function() {
        env.srv.setMode({ logout: 'neterr' })
        let page = await loginThenLogout()
        let evs = await readEvents(page)
        let e = evsOf(evs, 'logoutError')[0].arg
        assert.strictEqual(e.text, '登出時遭遇錯誤')
        assert.strictEqual(e.msg.message, 'Network Error')
        assert.deepStrictEqual(e.msg.keys, [])
    })

    it('O4 未設logOut網址: logoutError{text:無法取得登出用設定資訊}, 不送登出請求', async function() {
        let page = await loginThenLogout({ cfg: { wopt: { params: {} } } })
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'logoutError')[0].arg, { text: '無法取得登出用設定資訊', msg: 'invalid urlLogOut' })
        assert.strictEqual(logoutReqs().length, 0)
        assert.strictEqual(await getLSToken(page), '')
    })

    it('O5 無token: logoutError{text:無法取得登出用token}', async function() {
        let { page } = await env.openApp({ cfg: { login: false, wopt: { params: pLogOut } } })
        await page.locator('#btnLogout').click()
        await waitEvent(page, 'logout.return')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'logoutError')[0].arg, { text: '無法取得登出用token', msg: 'invalid token' })
        assert.strictEqual(logoutReqs().length, 0)
    })

    it('O6 procLogout回false: logoutError{text:登出失敗, msg:回應}', async function() {
        let page = await loginThenLogout({ cfg: { ret: { 'logout.procLogout': false } } })
        let evs = await readEvents(page)
        let e = evsOf(evs, 'logoutError')[0].arg
        assert.strictEqual(e.text, '登出失敗')
        assert.strictEqual(e.msg.status, 200)
        assert.deepStrictEqual(e.msg.data, { state: 'success', msg: 'logout ok' })
    })

    it('O7 不給procLogout: 登出成功', async function() {
        let page = await loginThenLogout({ cfg: { omit: ['procLogout'] } })
        let evs = await readEvents(page)
        assert.strictEqual(evsOf(evs, 'logout.procLogout').length, 0)
        assert.deepStrictEqual(evsOf(evs, 'logout.return')[0].arg, { state: true, data: { token: 'good' } })
    })

    it('B2-O procLogout拋錯: 流程失敗, logoutError{text:登出時發生例外, msg:原錯誤}, LS清空', async function() {
        let page = await loginThenLogout({ cfg: { throwIn: ['logout.procLogout'] } })
        let evs = await readEvents(page)

        //R10、R11①
        let e = evsOf(evs, 'logoutError')[0].arg
        assert.strictEqual(e.text, '登出時發生例外')
        assert.strictEqual(e.msg.__error, 'Error')
        assert.strictEqual(e.msg.message, 'boom-logout.procLogout')
        assert.strictEqual(evsOf(evs, 'logout.return')[0].arg.state, false)
        assert.strictEqual(await getLSToken(page), '')
    })

    it('B2-O2 流程中之非預期例外(params.logOut非字串使getUrl拋錯): logoutError{text:登出時發生例外, msg:原錯誤}', async function() {
        let page = await loginThenLogout({ cfg: { wopt: { params: { logOut: 123 } } } })
        let e = evsOf(await readEvents(page), 'logoutError')[0].arg

        //R10: 非預期例外(非回呼來源)亦包成{text,msg}
        assert.strictEqual(e.text, '登出時發生例外')
        assert.strictEqual(e.msg.__error, 'TypeError')
        assert.strictEqual(logoutReqs().length, 0)
        assert.strictEqual(await getLSToken(page), '')
    })

    it('B3-O logoutSuccess拋錯: logout()以原錯誤reject, LS已清空', async function() {
        let page = await loginThenLogout({ cfg: { throwIn: ['logoutSuccess'] }, waitFor: 'logout.reject' })
        let evs = await readEvents(page)

        //R11②
        let r = evsOf(evs, 'logout.reject')[0].arg
        assert.strictEqual(r.__error, 'Error')
        assert.strictEqual(r.message, 'boom-logoutSuccess')
        assert.strictEqual(evsOf(evs, 'logout.return').length, 0)
        assert.strictEqual(await getLSToken(page), '')
    })

    it('B4-O 偵測中登出: 登出後不再有checkToken請求與detect回呼', async function() {
        let page = await loginThenLogout({
            cfg: { detect: { timePeriod: 200 } },
            beforeClick: async (page) => {
                //等偵測至少完成一輪
                await waitEvent(page, 'detect.procCheckToken')
            },
        })
        let nAfterLogout = checkReqs().length

        //R12③: 負向觀察窗(5個週期)
        await observeWindow(1000)
        let evs = await readEvents(page)
        assert.strictEqual(evsOf(evs, 'detect.procLogout').length, 0)
        assert.strictEqual(checkReqs().length, nAfterLogout)
        assert.deepStrictEqual(evsOf(evs, 'logout.return')[0].arg, { state: true, data: { token: 'good' } })
    })

})
