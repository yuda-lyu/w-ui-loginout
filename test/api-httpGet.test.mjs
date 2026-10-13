import assert from 'assert'
import http from 'http'
import path from 'path'
import { pathToFileURL } from 'url'
import { fdSrcAbs } from './tools/srcDir.mjs'


//api-httpGet: 以Node內建fetch直打本地假伺服器, 驗證httpGet之語意
//斷言對應規則帳本(CLAUDE_rulebook.md)之R5①–⑧
describe('api-httpGet', function() {

    let port = 8434
    let portRefused = 8435 //無人監聽之埠(8425–8449內)
    let base = `http://127.0.0.1:${port}`
    let server = null
    let sockets = new Set()
    let lastAccept = ''
    let httpGet = null

    before(async function() {
        let m = await import(pathToFileURL(path.join(fdSrcAbs(), 'httpGet.mjs')).href)
        httpGet = m.default
        server = http.createServer((req, res) => {
            let p = new URL(req.url, base).pathname
            lastAccept = req.headers.accept || ''
            if (p === '/json') {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Probe': 'A' })
                return res.end(JSON.stringify({ state: 'success', msg: { a: 1 } }))
            }
            if (p === '/text') {
                res.writeHead(200, { 'Content-Type': 'text/plain' })
                return res.end('hello')
            }
            if (p === '/empty') {
                res.writeHead(200, { 'Content-Type': 'text/plain' })
                return res.end('')
            }
            if (p === '/nocontent') {
                res.writeHead(204)
                return res.end()
            }
            if (p === '/e404') {
                res.writeHead(404, { 'Content-Type': 'application/json' })
                return res.end(JSON.stringify({ state: 'error', msg: 'not found' }))
            }
            if (p === '/e500') {
                res.writeHead(500, { 'Content-Type': 'text/plain' })
                return res.end('Internal Server Error')
            }
            if (p === '/redirect') {
                res.writeHead(302, { 'Location': '/json' })
                return res.end()
            }
            if (p === '/destroy') {
                return res.socket.destroy()
            }
            if (p === '/hang') {
                return //不回應
            }
            res.writeHead(404)
            res.end()
        })
        server.on('connection', (s) => {
            sockets.add(s)
            s.on('close', () => sockets.delete(s))
        })
        await new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(port, '127.0.0.1', resolve)
        })
    })

    after(async function() {
        for (let s of sockets) {
            s.destroy()
        }
        await new Promise((resolve) => server.close(resolve))
    })

    //noUrl, 錯誤之message與屬性不得含網址(R5⑦)
    let noUrl = (err, url) => {
        let s = JSON.stringify({ message: err.message, props: err })
        assert.ok(!s.includes(url) && !s.includes('token=') && !s.includes(String(port)), s)
    }

    it('H1 2xx之JSON: resolve{data(已解析),status,statusText,headers(小寫鍵)}', async function() {
        let r = await httpGet(`${base}/json?token=abc`)
        assert.deepStrictEqual(Object.keys(r).sort(), ['data', 'headers', 'status', 'statusText'])
        assert.deepStrictEqual(r.data, { state: 'success', msg: { a: 1 } })
        assert.strictEqual(r.status, 200)
        assert.strictEqual(r.statusText, 'OK')
        assert.strictEqual(r.headers['content-type'], 'application/json; charset=utf-8')
        assert.strictEqual(r.headers['x-probe'], 'A')
    })

    it('H2 非JSON本文: data為原字串', async function() {
        let r = await httpGet(`${base}/text`)
        assert.strictEqual(r.data, 'hello')
    })

    it('H3 空本文與204: data為空字串', async function() {
        assert.strictEqual((await httpGet(`${base}/empty`)).data, '')
        let r = await httpGet(`${base}/nocontent`)
        assert.strictEqual(r.status, 204)
        assert.strictEqual(r.data, '')
    })

    it('H4 只發GET且Accept同原axios', async function() {
        await httpGet(`${base}/text`)
        assert.strictEqual(lastAccept, 'application/json, text/plain, */*')
    })

    it('H5 非2xx: reject一般Error, message同axios格式, 帶status與response, 不含網址', async function() {
        let url = `${base}/e404?token=secret`
        let err = await httpGet(url).then(() => null, (e) => e)
        assert.ok(err instanceof Error)
        assert.strictEqual(err.constructor, Error)
        assert.strictEqual(err.name, 'Error')
        assert.strictEqual(err.message, 'Request failed with status code 404')
        assert.strictEqual(err.status, 404)
        assert.strictEqual(err.response.status, 404)
        assert.deepStrictEqual(err.response.data, { state: 'error', msg: 'not found' })
        assert.strictEqual(String(err), 'Error: Request failed with status code 404')
        noUrl({ message: err.message, status: err.status }, url)

        let err5 = await httpGet(`${base}/e500`).then(() => null, (e) => e)
        assert.strictEqual(err5.message, 'Request failed with status code 500')
        assert.strictEqual(err5.response.data, 'Internal Server Error')
    })

    it('H6 連線中斷、拒絕連線、網址無法解析: reject一般Error(Network Error), 不附原始錯誤、不含網址', async function() {
        let urls = [
            `${base}/destroy?token=secret`,
            `http://127.0.0.1:${portRefused}/x?token=secret`,
            'http://[bad?token=secret',
        ]
        for (let url of urls) {
            let err = await httpGet(url).then(() => null, (e) => e)
            assert.ok(err instanceof Error, url)
            assert.strictEqual(err.constructor, Error)
            assert.strictEqual(err.message, 'Network Error')
            assert.strictEqual(err.cause, undefined)
            assert.deepStrictEqual(Object.keys(err), [])
            noUrl(err, url)
        }
    })

    it('H7 轉址: 依瀏覽器預設跟隨至最終回應', async function() {
        let r = await httpGet(`${base}/redirect`)
        assert.strictEqual(r.status, 200)
        assert.deepStrictEqual(r.data, { state: 'success', msg: { a: 1 } })
    })

    it('H8 不設逾時: 伺服器不回應時於觀察窗內維持懸置', async function() {
        let settled = false
        let pm = httpGet(`${base}/hang`).then(() => {
            settled = true
        }, () => {
            settled = true
        })
        //負向觀察窗
        await new Promise((resolve) => setTimeout(resolve, 3000))
        assert.strictEqual(settled, false)

        //收尾: 斷線使其結束
        for (let s of sockets) {
            s.destroy()
        }
        await pm
    })

})
