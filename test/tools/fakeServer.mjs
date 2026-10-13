import http from 'http'
import fs from 'fs'
import path from 'path'


//fpPageDef, fixture使用端頁
let fpPageDef = path.resolve('./test/pages/app.html')


/**
 * 啟動測試用假伺服器，提供fixture使用端頁、建出之UMD、登入驗證/檢查令牌/登出API，回應模式可切換，並記錄收到之請求
 *
 * 路由:
 *   /app/                 fixture使用端頁(只載入/lib/w-ui-loginout.umd.js)
 *   /blank                同源空白頁(供預置localStorage)
 *   /lib/w-ui-loginout.umd.js  建出之UMD
 *   /app/<apiName>/<apiNameForVerify>、/sso/api/getUserByToken  登入驗證(mode.verify)
 *   /sso/api/checkToken   檢查令牌(mode.checkToken)
 *   /sso/api/logout       登出(mode.logout)
 * 模式: ok、e500、e401、html、nouser、neterr(直接斷線)、hang(不回應)、slow(延遲後ok)
 *
 * @param {Object} opt 輸入設定物件
 * @param {Integer} opt.port 輸入埠號
 * @param {String} opt.fpUmd 輸入UMD檔路徑
 * @param {String} [opt.fpPage] 輸入fixture頁路徑，預設test/pages/app.html
 * @returns {Promise} 回傳Promise，resolve為{port,setMode,resetMode,getLog,clearLog,close}
 */
async function startFakeServer(opt = {}) {
    let { port, fpUmd, fpPage = fpPageDef } = opt

    let mode = {}
    let resetMode = () => {
        mode = {
            verify: 'ok',
            checkToken: 'ok',
            logout: 'ok',
            slowMs: 800,
        }
    }
    resetMode()

    let logs = []
    let sockets = new Set()

    let sendJson = (res, code, o) => {
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(o))
    }

    let sendBy = (res, m, okBody) => {
        if (m === 'ok') {
            return sendJson(res, 200, okBody)
        }
        if (m === 'slow') {
            setTimeout(() => {
                sendJson(res, 200, okBody)
            }, mode.slowMs)
            return
        }
        if (m === 'e500') {
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            return res.end('Internal Server Error')
        }
        if (m === 'e401') {
            return sendJson(res, 401, { state: 'error', msg: 'unauthorized' })
        }
        if (m === 'html') {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            return res.end('<!doctype html><html><body>spa fallback</body></html>')
        }
        if (m === 'nouser') {
            return sendJson(res, 200, { state: 'success', msg: {} })
        }
        if (m === 'neterr') {
            return res.socket.destroy()
        }
        if (m === 'hang') {
            return //不回應, 由close斷線
        }
        sendJson(res, 599, { unknownMode: m })
    }

    let server = http.createServer((req, res) => {
        let u = new URL(req.url, `http://${req.headers.host}`)
        let p = u.pathname
        let q = Object.fromEntries(u.searchParams)
        logs.push({
            t: Date.now(),
            path: p,
            query: q,
            accept: req.headers.accept || '',
        })

        if (p === '/app/' || p === '/app/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            return res.end(fs.readFileSync(fpPage))
        }
        if (p === '/blank') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            return res.end('<!doctype html><html><body>blank</body></html>')
        }
        if (p === '/lib/w-ui-loginout.umd.js') {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' })
            return res.end(fs.readFileSync(fpUmd))
        }
        if (p === '/sso/api/checkToken') {
            return sendBy(res, mode.checkToken, { state: 'success', msg: true })
        }
        if (p === '/sso/api/logout') {
            return sendBy(res, mode.logout, { state: 'success', msg: 'logout ok' })
        }
        if (p === '/sso/api/getUserByToken' || (p.startsWith('/app/') && p.split('/').length === 4)) {
            let token = q.token || ''
            if (mode.verify === 'ok' && token === 'bad') {
                return sendJson(res, 200, { state: 'error', msg: 'token expired' })
            }
            let id = p.startsWith('/sso/') ? 'u2' : 'u1'
            return sendBy(res, mode.verify, { state: 'success', msg: { id, name: `User ${id}`, token } })
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('not found')
    })

    server.on('connection', (s) => {
        sockets.add(s)
        s.on('close', () => {
            sockets.delete(s)
        })
    })

    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, resolve)
    })

    let close = () => {
        return new Promise((resolve) => {
            for (let s of sockets) {
                s.destroy()
            }
            server.close(() => {
                resolve()
            })
        })
    }

    return {
        port,
        setMode: (o) => {
            mode = { ...mode, ...o }
        },
        resetMode,
        getLog: () => {
            return logs.slice()
        },
        clearLog: () => {
            logs = []
        },
        close,
    }
}


export default startFakeServer
