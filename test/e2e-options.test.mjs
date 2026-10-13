import assert from 'assert'
import { setupE2e, readEvents, waitEvent, evsOf } from './tools/e2eHelpers.mjs'


//e2e-options: 由src之opt鍵與公開函式全列舉(反向覆蓋)補齊之案例
//斷言對應規則帳本(CLAUDE_rulebook.md)測試清單之P2–P8
describe('e2e-options', function() {

    let port = 8433
    let env = setupE2e({ name: 'e2e-options', port })

    let tpl = '{token}|{origin}|{originNoPort}|{base}|{baseNoPort}'

    it('P2 公開函式: getUrl之五種佔位符、parseUrl、getTokenFromUrl、getToken(URL優先於LS)、getValue', async function() {
        let cfg = {
            login: false,
            wopt: { params: { x: tpl } },
            calls: [
                { fn: 'getUrl', args: ['x'] },
                { fn: 'getUrl', args: ['noSuchKey'] },
                { fn: 'parseUrl' },
                { fn: 'getTokenFromUrl' },
                { fn: 'getToken' },
                { fn: 'getValue', args: ['site'] },
                { fn: 'getValue', args: ['x'] },
            ],
        }
        let { page } = await env.openApp({ search: '?token=urlv&a=1', preLS: 'lsv', cfg })
        await waitEvent(page, 'call.getValue', { count: 2 })
        let evs = await readEvents(page)
        let o = `http://127.0.0.1:${port}`
        let gu = evsOf(evs, 'call.getUrl')
        assert.strictEqual(gu[0].arg, `urlv|${o}|http://127.0.0.1|${o}/app/|http://127.0.0.1/app/`)
        assert.strictEqual(gu[1].arg, '')
        assert.deepStrictEqual(evsOf(evs, 'call.parseUrl')[0].arg, { token: 'urlv', a: '1' })
        assert.strictEqual(evsOf(evs, 'call.getTokenFromUrl')[0].arg, 'urlv')
        assert.strictEqual(evsOf(evs, 'call.getToken')[0].arg, 'urlv')
        assert.deepStrictEqual(evsOf(evs, 'call.getValue').map((v) => v.arg), ['probe', tpl])
    })

    it('P2b getToken: URL無token時取LS', async function() {
        let { page } = await env.openApp({ preLS: 'lsv', cfg: { login: false, calls: [{ fn: 'getToken' }] } })
        await waitEvent(page, 'call.getToken')
        assert.strictEqual(evsOf(await readEvents(page), 'call.getToken')[0].arg, 'lsv')
    })

    it('P2c getApi: 成功resolve回應本文, 500時reject字串(不含網址)', async function() {
        let { page } = await env.openApp({ cfg: { login: false, calls: [{ fn: 'getApi', args: ['getUserByToken?token=good'] }] } })
        await waitEvent(page, 'call.getApi.resolve')
        assert.deepStrictEqual(evsOf(await readEvents(page), 'call.getApi.resolve')[0].arg, { state: 'success', msg: { id: 'u1', name: 'User u1', token: 'good' } })

        env.srv.setMode({ verify: 'e500' })
        let r2 = await env.openApp({ cfg: { login: false, calls: [{ fn: 'getApi', args: ['getUserByToken?token=good'] }] } })
        await waitEvent(r2.page, 'call.getApi.reject')
        assert.strictEqual(evsOf(await readEvents(r2.page), 'call.getApi.reject')[0].arg, 'Error: Request failed with status code 500')
    })

    it('P3 keyGlobal自訂: 參數存於自訂鍵, getValue由其讀取, 不寫預設鍵', async function() {
        let cfg = {
            login: false,
            wopt: { keyGlobal: '__kg__', params: { x: 'v' } },
            calls: [{ fn: 'getValue', args: ['x'] }],
            dumpGlobal: ['__kg__', '___params___'],
        }
        let { page } = await env.openApp({ cfg })
        await waitEvent(page, 'global.___params___')
        let evs = await readEvents(page)
        assert.deepStrictEqual(evsOf(evs, 'global.__kg__')[0].arg, ['base', 'baseNoPort', 'origin', 'originNoPort', 'site', 'x'])
        assert.strictEqual(evsOf(evs, 'global.___params___')[0].arg, '[undefined]')
        assert.strictEqual(evsOf(evs, 'call.getValue')[0].arg, 'v')
    })

    it('P4 timeWaitAnimation: 驗證請求於延遲後才送出(預設0則立即)', async function() {
        let delayOf = () => {
            let lg = env.srv.getLog()
            let tPage = lg.find((v) => v.path === '/app/').t
            let tVerify = lg.find((v) => v.path === '/app/api/getUserByToken').t
            return tVerify - tPage
        }

        let { page } = await env.openApp({ token: 'good', cfg: { wopt: { timeWaitAnimation: 1500 } } })
        await waitEvent(page, 'login.return')
        let d1 = delayOf()
        assert.ok(d1 >= 1400, `d1=${d1}`)

        env.srv.clearLog()
        let r2 = await env.openApp({ token: 'good' })
        await waitEvent(r2.page, 'login.return')
        let d0 = delayOf()
        assert.ok(d0 < 1000, `d0=${d0}`)
    })

    it('P5 defToken自訂: 開發模式無token時送出自訂值', async function() {
        let { page } = await env.openApp({ host: 'localhost', cfg: { wopt: { defToken: 'mydef' } } })
        await waitEvent(page, 'login.return')
        let reqs = env.srv.getLog().filter((v) => v.path === '/app/api/getUserByToken')
        assert.deepStrictEqual(reqs.map((v) => v.query.token), ['mydef'])
        assert.strictEqual(evsOf(await readEvents(page), 'loginSuccess')[0].arg.token, 'mydef')
    })

    it('P6 apiName、apiNameForVerify自訂: 驗證請求路徑改變', async function() {
        let { page } = await env.openApp({ token: 'good', cfg: { wopt: { apiName: 'myapi', apiNameForVerify: 'whoami' } } })
        await waitEvent(page, 'login.return')
        let paths = env.srv.getLog().map((v) => v.path)
        assert.ok(paths.includes('/app/myapi/whoami'))
        assert.ok(!paths.includes('/app/api/getUserByToken'))
        assert.strictEqual(evsOf(await readEvents(page), 'loginSuccess').length, 1)
    })

    it('P7 retry自訂為0: detect檢查失敗只請求1次即procLogout', async function() {
        env.srv.setMode({ checkToken: 'e401' })
        let cfg = { wopt: { retry: 0, params: { checkToken: '{origin}/sso/api/checkToken?token={token}' } }, detect: { timePeriod: 200 } }
        let { page } = await env.openApp({ token: 'good', cfg })
        await waitEvent(page, 'detect.procLogout')
        let reqs = env.srv.getLog().filter((v) => v.path === '/sso/api/checkToken')
        assert.strictEqual(reqs.length, 1)
    })

    it('P8 回呼回傳promise時被await: 後續回呼於其完成後才呼叫', async function() {
        let cfg = {
            wopt: { params: { logOut: '{origin}/sso/api/logout?token={token}' } },
            async: ['afterGetUser', 'logout.procLogout'],
            asyncMs: 300,
        }
        let { page } = await env.openApp({ token: 'good', cfg })
        await waitEvent(page, 'login.return')
        await page.locator('#btnLogout').click()
        await waitEvent(page, 'logout.return')
        let names = (await readEvents(page)).map((v) => v.ev)
        let idx = (n) => names.indexOf(n)
        assert.ok(idx('afterGetUser') < idx('afterGetUser.done') && idx('afterGetUser.done') < idx('afterLogin'), names.join(','))
        assert.ok(idx('afterLogin') < idx('loginSuccess'))
        assert.ok(idx('logout.procLogout') < idx('logout.procLogout.done') && idx('logout.procLogout.done') < idx('afterLogout'), names.join(','))
        assert.ok(idx('afterLogout') < idx('logoutSuccess'))
    })

})
