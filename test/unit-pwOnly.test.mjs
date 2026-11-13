import assert from 'assert'
import fs from 'fs'
import path from 'path'


//unit-pwOnly: Chromium系瀏覽器之啟動一律經w-playwright之靜態盤點(規則帳本R17; 對應w-playwright帳本R-PW-ONLY與R-PW-WIRING之盤點)
//掃描範圍: src、test、toolg之.mjs/.js(排除node_modules、dist、各層_tmp)


//rePw, 直接匯入playwright或playwright-core之樣式(靜態import/export from、動態import()、require()); 與w-playwright帳本R-PW-ONLY同一正則
let rePw = /(from\s+|import\(\s*|require\(\s*)['"`]playwright(-core)?['"`/]/


//reOldLaunch, 舊啟動路徑(w-package-tools-e2e之launchChromium、launchChromiumCore、launchBrowser深層匯入; 其內直接使用playwright, 繞過w-playwright之守門); 以片段組出, 使本檔不命中自己
let reOldLaunch = new RegExp(['w-package-tools-e2e', 'src', '(launchChromium|launchChromiumCore|launchBrowser)'].join('/'))


//reLaunchCall, 啟動呼叫(w-playwright之兩個啟動入口)
let reLaunchCall = /\bwpw\.(launchChromium|launchChromiumPersistent)\(/g


//reDirectLaunch, 直接以BrowserType啟動(chromium.launch等)
let reDirectLaunch = /\b(chromium|firefox|webkit)\.(launch|launchPersistentContext|launchServer|connect|connectOverCDP)\s*\(/


//listFiles, 遞迴列出.mjs/.js檔
let listFiles = (fd, out = []) => {
    if (!fs.existsSync(fd)) {
        return out
    }
    for (let ent of fs.readdirSync(fd, { withFileTypes: true })) {
        if (['node_modules', 'dist', '_tmp'].includes(ent.name)) {
            continue
        }
        let fp = path.join(fd, ent.name)
        if (ent.isDirectory()) {
            listFiles(fp, out)
        }
        else if (/\.(mjs|js)$/.test(ent.name)) {
            out.push(fp)
        }
    }
    return out
}


let toRel = (fp) => {
    return path.relative('.', fp).split(path.sep).join('/')
}


let readJson = (fp) => {
    return JSON.parse(fs.readFileSync(fp, 'utf8'))
}


//cmpVer, 比較x.y.z版本(只取數字三段)
let cmpVer = (a, b) => {
    let pa = String(a).split('.').map((v) => parseInt(v, 10))
    let pb = String(b).split('.').map((v) => parseInt(v, 10))
    for (let i = 0; i < 3; i++) {
        let d = (pa[i] || 0) - (pb[i] || 0)
        if (d !== 0) {
            return d
        }
    }
    return 0
}


describe('unit-pwOnly', function() {

    let roots = ['./src', './test', './toolg']
    let files = []
    for (let fd of roots) {
        files.push(...listFiles(fd))
    }
    let readAll = () => {
        return files.map((fp) => ({ fp: toRel(fp), c: fs.readFileSync(fp, 'utf8') }))
    }

    it('PO0 盤點有效(防空集合): 三個根目錄皆有檔; 正則對各種匯入寫法皆命中, 對w-playwright與一般文字不命中', function() {
        for (let fd of roots) {
            let n = files.filter((fp) => toRel(fp).startsWith(fd.replace('./', '') + '/')).length
            assert.ok(n > 0, `${fd}掃描檔數為0`)
        }
        assert.ok(files.length >= 10, `掃描檔數過少: ${files.length}`)

        //正例(組字, 使本檔不含完整之匯入句)
        let q = '\''
        let d = '"'
        let b = '`'
        let pos = [
            `import { chromium } from ${q}playwright${q}`,
            `import { chromium } from ${d}playwright-core${d}`,
            `import(${q}playwright${q})`,
            `await import( ${d}playwright-core${d} )`,
            `let { chromium } = require(${q}playwright${q})`,
            `import x from ${q}playwright/lib/foo.js${q}`,
            `export * from ${b}playwright-core${b}`,
        ]
        for (let s of pos) {
            assert.ok(rePw.test(s), `應命中: ${s}`)
        }

        //反例
        let neg = [
            `import wpw from ${q}w-playwright${q}`,
            `import x from ${q}playwright-extra${q}`,
            `//playwright-core由w-playwright提供`,
            `let s = ${q}playwright${q}`,
        ]
        for (let s of neg) {
            assert.ok(!rePw.test(s), `不應命中: ${s}`)
        }
    })

    it('PO1 src、test、toolg無直接匯入playwright或playwright-core(含動態import與require)', function() {
        let bad = []
        for (let { fp, c } of readAll()) {
            let ls = c.split('\n')
            ls.forEach((v, i) => {
                if (rePw.test(v)) {
                    bad.push(`${fp}:${i + 1}: ${v.trim()}`)
                }
            })
        }
        assert.deepStrictEqual(bad, [])
    })

    it('PO2 package.json不宣告playwright或playwright-core, 以devDependencies宣告w-playwright(^1.0.1), 實裝版本不低於1.0.1', function() {
        let pkg = readJson('./package.json')
        for (let k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
            for (let name of ['playwright', 'playwright-core']) {
                assert.strictEqual((pkg[k] || {})[name], undefined, `${k}不得宣告${name}`)
            }
        }
        assert.strictEqual((pkg.devDependencies || {})['w-playwright'], '^1.0.1')
        assert.strictEqual((pkg.dependencies || {})['w-playwright'], undefined, 'src不啟動瀏覽器, w-playwright只屬dev')
        let pw = readJson('./node_modules/w-playwright/package.json')
        assert.ok(cmpVer(pw.version, '1.0.1') >= 0 && parseInt(pw.version, 10) === 1, `實裝版本: ${pw.version}`)
    })

    it('PO3 啟動點全集: src無啟動呼叫; test內wpw.launchChromium(只有test/tools/e2eLib.mjs一處; 無舊啟動路徑之深層匯入; 無直接以BrowserType啟動', function() {
        let sites = []
        let olds = []
        let directs = []
        for (let { fp, c } of readAll()) {
            if (fp.startsWith('test/unit-pwOnly.test.mjs')) {
                continue
            }
            let m = c.match(reLaunchCall)
            if (m) {
                sites.push(...m.map((v) => `${fp}: ${v}`))
            }
            if (reOldLaunch.test(c)) {
                olds.push(fp)
            }
            if (reDirectLaunch.test(c)) {
                directs.push(fp)
            }
        }
        assert.deepStrictEqual(sites, ['test/tools/e2eLib.mjs: wpw.launchChromium('])
        assert.deepStrictEqual(olds, [])
        assert.deepStrictEqual(directs, [])
    })

    it('PO4 e2eLib之啟動出口原樣傳入呼叫端選項並明給autoInstall: true; e2eHelpers經e2eLib啟動且只有一處', function() {
        let lib = fs.readFileSync('./test/tools/e2eLib.mjs', 'utf8')
        assert.ok(lib.includes('wpw.launchChromium({ ...opt, autoInstall: true })'))
        assert.ok(lib.includes(`import wpw from 'w-playwright'`))
        let h = fs.readFileSync('./test/tools/e2eHelpers.mjs', 'utf8')
        assert.ok(h.includes(`import { launchChromium, registerCleanupHooks } from './e2eLib.mjs'`))
        assert.strictEqual(h.match(/\blaunchChromium\(/g).length, 1)
    })

})
