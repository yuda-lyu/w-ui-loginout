import assert from 'assert'
import fs from 'fs'
import path from 'path'
import wpw from 'w-playwright'


//unit-pwInstall: Playwright受管瀏覽器之取得集中於共用工具, 時限對齊安裝預算(規則帳本R18; 取得之before接線見unit-wpwWiring W4)
//ensureE2eBrowser之同程序記憶為模組狀態: 每案以查詢字串匯入全新之e2eLib實例(記憶彼此獨立, 且不污染同worker內其他檔所用之實例);
//wpw為套件單例(兩個e2eLib實例共用同一個wpw物件), 以暫換wpw.ensureChromium/wpw.launchChromium為替身, finally還原
//替身只換w-playwright之公開函數, 不啟動瀏覽器、不下載; 真實取得由全套於空瀏覽器目錄下之平行實跑驗證(作法見規則帳本R18)


let seq = 0


//freshLib, 匯入全新之e2eLib實例(記憶獨立)
let freshLib = async () => {
    seq++
    return import(`./tools/e2eLib.mjs?pwInstall=${seq}`)
}


//withStub, 暫換wpw[name]為替身, 回傳還原函數
let withStub = (name, fn) => {
    let orig = wpw[name]
    wpw[name] = fn
    return () => {
        wpw[name] = orig
    }
}


//capLog, 暫收console.log之輸出, 回傳{ lines, restore }
let capLog = () => {
    let orig = console.log
    let lines = []
    console.log = (...a) => {
        lines.push(a.join(' '))
    }
    let restore = () => {
        console.log = orig
    }
    return { lines, restore }
}


//listFiles, 遞迴列出.mjs檔(排除node_modules、dist、_tmp)
let listFiles = (fd, out = []) => {
    for (let ent of fs.readdirSync(fd, { withFileTypes: true })) {
        if (['node_modules', 'dist', '_tmp'].includes(ent.name)) {
            continue
        }
        let fp = path.join(fd, ent.name)
        if (ent.isDirectory()) {
            listFiles(fp, out)
        }
        else if (/\.mjs$/.test(ent.name)) {
            out.push(fp)
        }
    }
    return out
}


let toRel = (fp) => {
    return path.relative('.', fp).split(path.sep).join('/')
}


describe('unit-pwInstall', function() {

    it('PI0 測試接縫自測: 每個全新e2eLib實例之記憶彼此獨立, 且都經同一個wpw(替身看得到各實例之呼叫)', async function() {
        let n = 0
        let restore = withStub('ensureChromium', async () => {
            n++
            return { kind: 'headless-shell' }
        })
        let cap = capLog()
        try {
            let a = await freshLib()
            let b = await freshLib()
            assert.notStrictEqual(a, b)
            await a.ensureE2eBrowser()
            assert.strictEqual(n, 1)
            await b.ensureE2eBrowser() //另一實例有自己之記憶, 故仍呼叫替身
            assert.strictEqual(n, 2)
        }
        finally {
            cap.restore()
            restore()
        }
    })

    it('PI1 ensureE2eBrowser以安裝預算為逾時呼叫w-playwright之ensureChromium(預設種類即headless shell); 預算不短於單次下載之600000毫秒', async function() {
        //時限對齊安裝預算: 逾時鍵為PW_INSTALL_BUDGET_MS, 不得缺(缺則ensureChromium預設0=不限, 無限等待)或另寫字面
        let seen = []
        let restore = withStub('ensureChromium', async (opt) => {
            seen.push(opt)
            return { kind: 'headless-shell' }
        })
        let cap = capLog()
        try {
            let lib = await freshLib()
            let r = await lib.ensureE2eBrowser()
            assert.strictEqual(seen.length, 1)
            assert.strictEqual(typeof lib.PW_INSTALL_BUDGET_MS, 'number')
            assert.ok(Number.isFinite(lib.PW_INSTALL_BUDGET_MS) && lib.PW_INSTALL_BUDGET_MS >= 600000, `預算過短: ${lib.PW_INSTALL_BUDGET_MS}`)
            assert.strictEqual(seen[0].timeout, lib.PW_INSTALL_BUDGET_MS)
            assert.ok(seen[0].kind === undefined || seen[0].kind === 'headless-shell', '本套件只用無頭, 只取得headless shell')
            assert.strictEqual(r.kind, 'headless-shell')
            assert.strictEqual(typeof r.ms, 'number')
        }
        finally {
            cap.restore()
            restore()
        }
    })

    it('PI2 同程序只取得一次: 並行呼叫與完成後再呼叫皆共用同一次ensureChromium', async function() {
        let n = 0
        let release = null
        let gate = new Promise((resolve) => {
            release = resolve
        })
        let restore = withStub('ensureChromium', async () => {
            n++
            await gate //持續到本案放行, 使並行呼叫確實重疊
            return { kind: 'headless-shell' }
        })
        let cap = capLog()
        try {
            let lib = await freshLib()
            let ps = [1, 2, 3, 4, 5].map(() => lib.ensureE2eBrowser())
            assert.strictEqual(n, 1, '並行呼叫應只觸發一次ensureChromium')
            assert.ok(ps.every((p) => p === ps[0]), '並行呼叫應共用同一個Promise')
            release()
            await Promise.all(ps)
            await lib.ensureE2eBrowser()
            assert.strictEqual(n, 1, '完成後再呼叫不得重做')
        }
        finally {
            release()
            cap.restore()
            restore()
        }
    })

    it('PI3 取得失敗不記憶: 該次reject原錯誤, 下次呼叫重試; 成功後不再重做', async function() {
        let n = 0
        let err = Object.assign(new Error('browser installation failed with exit code 1'), { code: 'E_INSTALL' })
        let restore = withStub('ensureChromium', async (opt) => {
            n++
            if (n === 1) {
                opt.funLog('install-output', { kind: 'headless-shell' }, 'ELOCKED: lock held by another process\n')
                throw err
            }
            return { kind: 'headless-shell' }
        })
        let cap = capLog()
        try {
            let lib = await freshLib()
            let e1 = null
            try {
                await lib.ensureE2eBrowser()
            }
            catch (e) {
                e1 = e
            }
            assert.strictEqual(e1, err, '失敗須原樣reject(含code), 不吞、不改寫')
            //失敗須印一行診斷(code與安裝子行程輸出尾段), 否則長時間等待後只剩一句離開碼
            let failLine = cap.lines.find((v) => v.includes('[e2e-browser]') && v.includes('取得失敗'))
            assert.ok(failLine && failLine.includes('code=E_INSTALL') && failLine.includes('ELOCKED'), cap.lines.join('\n'))
            await lib.ensureE2eBrowser()
            assert.strictEqual(n, 2, '非逾時之失敗(如離線、等候安裝鎖逾時)後下次呼叫須重試')
            await lib.ensureE2eBrowser()
            assert.strictEqual(n, 2, '成功後不再重做')
        }
        finally {
            cap.restore()
            restore()
        }
    })

    it('PI4 真下載可由輸出點算: install-output內每個Downloading行計一項並印[e2e-browser]一行, 進度與其他標籤之輸出不計', async function() {
        //驗收「安裝恰1次」之證據機制: 全套於空瀏覽器目錄下, 全部worker輸出中各項Downloading只出現一次
        let restore = withStub('ensureChromium', async (opt) => {
            opt.funLog('install-output', { kind: 'headless-shell' }, 'Downloading Chromium Headless Shell 1.0.0 (playwright build v1) from https://example.invalid/a.zip\n')
            opt.funLog('install-output', { kind: 'headless-shell' }, '|■■■■■■■■| 10% of 100 MiB\n')
            opt.funLog('install-output', { kind: 'headless-shell' }, 'Chromium Headless Shell 1.0.0 (playwright build v1) downloaded to C:\\x\n')
            opt.funLog('install-error', { kind: 'headless-shell' }, 'Downloading not-counted from here')
            //Playwright之Downloading行在標題與from之間帶淡色控制碼(實跑所見), 標題不得帶入控制碼
            opt.funLog('install-output', { kind: 'headless-shell' }, 'Downloading FFmpeg 9 (playwright build v2)\u001b[2m from https://example.invalid/b.zip\u001b[22m\nDownloading Winldd 7 (playwright build v3) from https://example.invalid/c.zip\n')
            return { kind: 'headless-shell' }
        })
        let cap = capLog()
        let r = null
        try {
            let lib = await freshLib()
            r = await lib.ensureE2eBrowser()
        }
        finally {
            cap.restore()
            restore()
        }
        assert.strictEqual(r.downloads, 3)
        let dl = cap.lines.filter((v) => v.includes('[e2e-browser]') && v.includes('真下載: '))
        assert.strictEqual(dl.length, 3, cap.lines.join('\n'))
        assert.ok(dl[0].includes('Chromium Headless Shell 1.0.0 (playwright build v1)'))
        assert.ok(dl[1].includes('FFmpeg 9'))
        assert.ok(dl[2].includes('Winldd 7'))
        assert.ok(dl.every((v) => !v.includes('example.invalid')), '網址不印')
        assert.ok(dl.every((v) => !v.includes('\u001b')), '標題不帶終端機控制碼')
        assert.ok(dl[1].endsWith('FFmpeg 9 (playwright build v2)'), dl[1])
        let done = cap.lines.filter((v) => v.includes('[e2e-browser]') && v.includes('瀏覽器已備妥'))
        assert.strictEqual(done.length, 1)
        assert.ok(done[0].includes('真下載3項'))
    })

    it('PI5 launchChromium啟動不安裝: 明給autoInstall: false, 其餘選項原樣傳入(取得由ensureE2eBrowser集中, 不在每案例beforeEach之短時限內隱式下載)', async function() {
        let seen = []
        let restore = withStub('launchChromium', async (o) => {
            seen.push(o)
            return { close: async () => {} }
        })
        try {
            let lib = await freshLib()
            await lib.launchChromium({ headless: true, timeout: 777 })
            await lib.launchChromium({ headless: true, autoInstall: true }) //呼叫端想開安裝亦不得生效
        }
        finally {
            restore()
        }
        assert.strictEqual(seen.length, 2)
        assert.strictEqual(seen[0].autoInstall, false)
        assert.strictEqual(seen[0].headless, true)
        assert.strictEqual(seen[0].timeout, 777)
        assert.strictEqual(seen[1].autoInstall, false)
    })

    it('PI6 站點全集(靜態): test內wpw.ensureChromium(只有e2eLib一處; 無autoInstall: true之寫法; 用到launchChromium之測試檔皆經setupE2e取得; e2eHelpers恰一處呼叫ensureE2eBrowser', function() {
        let files = []
        for (let fd of ['./src', './test', './toolg']) {
            files.push(...listFiles(fd))
        }
        assert.ok(files.length >= 10, `掃描檔數過少: ${files.length}`)
        let reEnsure = /\bwpw\.ensureChromium\(/
        let reAutoOn = /autoInstall\s*:\s*true/
        let ensures = []
        let autoOn = []
        let launchers = []
        for (let fp of files) {
            let rel = toRel(fp)
            if (rel === 'test/unit-pwInstall.test.mjs') {
                continue
            }
            let c = fs.readFileSync(fp, 'utf8')
            if (reEnsure.test(c)) {
                ensures.push(rel)
            }
            if (reAutoOn.test(c)) {
                autoOn.push(rel)
            }
            if (/^test\/[^/]+\.test\.mjs$/.test(rel) && /\bawait\s+launchChromium\(/.test(c)) {
                launchers.push({ rel, viaSetup: /\bsetupE2e\(/.test(c) })
            }
        }
        assert.deepStrictEqual(ensures, ['test/tools/e2eLib.mjs'])
        assert.deepStrictEqual(autoOn, [], '啟動與取得皆不得以autoInstall: true隱式安裝')
        //至少一個直接用launchChromium之測試檔(unit-wpwWiring W2、W3), 且皆經setupE2e(其獨立before先取得瀏覽器)
        assert.ok(launchers.length >= 1, '盤點失效: 找不到直接呼叫launchChromium之測試檔')
        assert.deepStrictEqual(launchers.filter((v) => !v.viaSetup), [], '直接啟動瀏覽器之測試檔須經setupE2e(其獨立before先取得瀏覽器)')
        //e2eHelpers去註解後: 恰一處呼叫ensureE2eBrowser(), 且該處為await(漏await則安裝尚在進行時後續before與beforeEach已開始啟動)
        let h = fs.readFileSync('./test/tools/e2eHelpers.mjs', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
        assert.strictEqual(h.match(/\bensureE2eBrowser\(/g).length, 1)
        assert.strictEqual(h.match(/\bawait\s+ensureE2eBrowser\(\)/g).length, 1)
    })

    it('PI7 逾時失敗於同行程內記憶: 其後之呼叫立即以同一錯誤reject, 不再呼叫ensureChromium(同worker之其餘檔不各再等滿預算)', async function() {
        let n = 0
        let err = Object.assign(new Error('browser installation timed out'), { code: 'E_INSTALL' })
        let restore = withStub('ensureChromium', async () => {
            n++
            throw err
        })
        let cap = capLog()
        try {
            let lib = await freshLib()
            let es = []
            for (let i = 0; i < 3; i++) {
                try {
                    await lib.ensureE2eBrowser()
                }
                catch (e) {
                    es.push(e)
                }
            }
            assert.strictEqual(es.length, 3)
            assert.ok(es.every((e) => e === err), '每次皆以同一錯誤reject')
            assert.strictEqual(n, 1, '逾時後不得再各自等滿預算')
        }
        finally {
            cap.restore()
            restore()
        }
    })

})
