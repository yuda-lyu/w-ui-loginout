import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'


//unit-noFixedPorts: 測試監聽埠之守護不變式(規則帳本R16; 規格 C:/opensrcOper/dspec/e2e埠與多套件同跑.md E8)
//本套件之假伺服器與測試伺服器皆在測試行程內, 監聽埠一律由作業系統配發(listen(0)), 實際埠取自server.address().port, 網址與斷言由實際埠衍生;
//故不需固定基準埠、保留埠、行程表驗證與換埠。本檔守護下列不變式(皆為原始碼靜態掃描, 不開任何socket, 與機器上哪些埠被占用、作業系統配發範圍、負載無關; 不斷言任何具體埠號):
//  PN-001 所有.listen(之第一個引數皆為字面0(後接逗號或右括號)
//  PN-002 無host:埠字面(127.0.0.1:數字、localhost:數字、${host}:數字等)
//  PN-003 無埠命名(大小寫不拘)之變數或鍵指定數字字面, 無範本運算式內之純數字
//  PN-004 無引號包住之4~5位純數字字串(如斷言「訊息不含埠」寫回'8430')、無舊固定埠段(84xx)之數字字面
//  PN-005 無舊機制殘留(保留埠、行程表驗證、selfCheck、E2E_PORT_*)且舊機制之檔不存在
//  PN-006 會監聽之測試檔皆印出實際埠一行(規格E6)
//  PN-000 掃描範圍非空、掃描規則與註解遮罩自測(已知正例必抓、已知反例不抓)
//掃描範圍: test下(含子夾, 不含_tmp與pics)所有.mjs/.js/.cjs/.json/.html, 本檔自身除外(其樣本刻意含固定埠字樣)


let fpSelf = fileURLToPath(import.meta.url)
let fdTest = path.dirname(fpSelf)


//listFiles, 掃描範圍
let listFiles = () => {
    let rs = []
    let walk = (fd) => {
        for (let v of fs.readdirSync(fd)) {
            let fp = path.join(fd, v)
            let st = fs.statSync(fp)
            if (st.isDirectory()) {
                if (v !== '_tmp' && v !== 'pics' && v !== 'node_modules') {
                    walk(fp)
                }
            }
            else if (/\.(mjs|js|cjs|json|html)$/.test(v) && fp !== fpSelf) {
                rs.push(fp)
            }
        }
    }
    walk(fdTest)
    return rs
}


//maskComments, 把註解以空白取代(保留換行, 行號不變); 認得字串、範本字串(含${}內插與巢狀)與正則字面, 故'text/plain, */*'之/*不會被當成區塊註解開頭
let maskComments = (src) => {
    let out = ''
    let i = 0
    let n = src.length
    let stack = [] //範本字串之巢狀: {t:'tpl'}、{t:'code',d:花括號深度}(${}內之程式)
    let prev = '' //上一個非空白字元
    let prevWord = false //上一個記號為關鍵字(其後之/為正則開頭)
    let blank = (s) => s.replace(/[^\n]/g, ' ')
    let kw = /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await)\s*$/
    while (i < n) {
        let c = src[i]
        let d = src[i + 1]
        let top = stack.length > 0 ? stack[stack.length - 1] : null
        if (top && top.t === 'tpl') {
            if (c === '\\') {
                out += src.slice(i, i + 2)
                i += 2
            }
            else if (c === '`') {
                stack.pop()
                out += c
                i++
                prev = '`'
                prevWord = false
            }
            else if (c === '$' && d === '{') {
                stack.push({ t: 'code', d: 1 })
                out += '${'
                i += 2
                prev = '{'
                prevWord = false
            }
            else {
                out += c
                i++
            }
            continue
        }
        if (c === '/' && d === '/') {
            let j = src.indexOf('\n', i)
            j = j < 0 ? n : j
            out += blank(src.slice(i, j))
            i = j
        }
        else if (c === '/' && d === '*') {
            let j = src.indexOf('*/', i + 2)
            j = j < 0 ? n : j + 2
            out += blank(src.slice(i, j))
            i = j
        }
        else if (c === '\'' || c === '"') {
            let j = i + 1
            while (j < n && src[j] !== c && src[j] !== '\n') {
                j += src[j] === '\\' ? 2 : 1
            }
            j = Math.min(j + 1, n)
            out += src.slice(i, j)
            i = j
            prev = c
            prevWord = false
        }
        else if (c === '`') {
            stack.push({ t: 'tpl' })
            out += c
            i++
        }
        else if (c === '/' && (prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || prevWord)) {
            //正則字面: 到未跳脫且不在[...]內之/為止, 再接旗標
            let j = i + 1
            let inCls = false
            while (j < n && src[j] !== '\n') {
                if (src[j] === '\\') {
                    j += 2
                    continue
                }
                if (src[j] === '[') {
                    inCls = true
                }
                else if (src[j] === ']') {
                    inCls = false
                }
                else if (src[j] === '/' && !inCls) {
                    break
                }
                j++
            }
            j = Math.min(j + 1, n)
            while (j < n && /[a-z]/.test(src[j])) {
                j++
            }
            out += src.slice(i, j)
            i = j
            prev = '/'
            prevWord = false
        }
        else {
            if (top && top.t === 'code') {
                if (c === '{') {
                    top.d++
                }
                else if (c === '}') {
                    top.d--
                    if (top.d === 0) {
                        stack.pop()
                    }
                }
            }
            out += c
            i++
            if (!/\s/.test(c)) {
                prev = c
                prevWord = /[\w$]/.test(c) && kw.test(out.slice(-14))
            }
        }
    }
    return out
}


//maskHtml, html只去除<!-- -->註解(不做JS記號分析)
let maskHtml = (src) => src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))


let codeOf = (fp, src) => (fp.endsWith('.html') ? maskHtml(src) : maskComments(src))


let findAll = (re, code) => {
    let rs = []
    let m
    re.lastIndex = 0
    while ((m = re.exec(code)) !== null) {
        rs.push({ index: m.index, text: m[0] })
    }
    return rs
}


//rules, 掃描規則: 回傳違規之位置陣列[{ index, text }]
let rules = {
    //PN-001: .listen(之第一個引數須為字面0(後接逗號或右括號; 0+x、0||x、{port:..}、變數等皆違規)
    listen: (code) => {
        let rs = []
        let re = /\.listen\s*\(/g
        let m
        while ((m = re.exec(code)) !== null) {
            let rest = code.slice(m.index + m[0].length, m.index + m[0].length + 40)
            if (!/^\s*0\s*[,)]/.test(rest)) {
                rs.push({ index: m.index, text: (m[0] + rest).split('\n')[0] })
            }
        }
        return rs
    },
    //PN-002: host:埠字面
    hostPort: (code) => findAll(/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1?\]|\$\{[^}]*\}):\d{2,5}\b/g, code),
    //PN-003: 埠命名(大小寫不拘, 如port、basePort、BASE_PORT)之變數或鍵(可帶引號)指定數字字面、範本運算式內之純數字
    portAssign: (code) => findAll(/\b(?!(?:import|export|report|support|transport)\b)\w*port\w*['"]?\s*(?::|=(?!=))\s*\d|\$\{\s*\d+\s*\}/gi, code),
    //PN-004: 引號包住之4~5位純數字字串; 舊固定埠段84xx(8425–8449)之數字字面
    literalPort: (code) => findAll(/['"`]\d{4,5}['"`]|\b84[2-4]\d\b/g, code),
}
let lineOf = (code, index) => code.slice(0, index).split('\n').length


//scanAll, 對掃描範圍逐檔套用規則, 回傳違規清單['檔:行 文字']
let scanAll = (rule) => {
    let rs = []
    for (let fp of listFiles()) {
        let code = codeOf(fp, fs.readFileSync(fp, 'utf8'))
        for (let h of rule(code)) {
            rs.push(`${path.relative(fdTest, fp)}:${lineOf(code, h.index)} ${h.text}`)
        }
    }
    return rs
}


describe('unit-noFixedPorts', function() {

    it('PN-000 掃描範圍非空且含已知會監聽之檔; 規則與註解遮罩自測(已知正例必抓、已知反例不抓)', function() {
        let names = listFiles().map((v) => path.relative(fdTest, v).replace(/\\/g, '/'))
        for (let n of ['tools/fakeServer.mjs', 'tools/e2eHelpers.mjs', 'api-httpGet.test.mjs', 'e2e-login.test.mjs', 'pages/app.html']) {
            assert.ok(names.includes(n), `掃描範圍缺少${n}: ${names.join(',')}`)
        }
        //已知會監聽之站點必被掃到(否則PN-001空轉)
        let sites = 0
        for (let fp of listFiles()) {
            sites += (codeOf(fp, fs.readFileSync(fp, 'utf8')).match(/\.listen\(/g) || []).length
        }
        assert.ok(sites >= 2, `.listen(站點數${sites}`)

        //(以下樣本為「被掃描之原始碼片段」, 內含雙引號字串與${...}字樣, 非實際程式用法)
        /* eslint-disable quotes, no-template-curly-in-string */
        let bad = {
            listen: ['s.listen(8430)', 's.listen(port, resolve)', "s.listen(p, '127.0.0.1')", 's.listen(\n  8430)', 's.listen(8430, resolve)', 's.listen(0 + 9100)', 's.listen(0 || P)', 's.listen({ port: 8430 })', 's.listen(+"0")', 's.listen (9100)', 's.listen(\'0\')'],
            hostPort: ["'http://127.0.0.1:8430/x'", '`http://localhost:8430/`', '`http://${host}:8430/app/`', "'http://[::1]:8430/'"],
            portAssign: ['let port = 8434', 'let portRefused = 8435', '{ port: 8430 }', 'let basePort=8430', '`${8433}`', 'const PORT = 9100', 'BASE_PORT = 9100', "{ 'port': 9100 }", 'let Port=9100', 'ports = 9100'],
            literalPort: ["includes('8430')", 'includes("8430")', 'includes(`8430`)', 'strictEqual(env.port, 8430)', 'x === 8441'],
        }
        let good = {
            listen: ['s.listen(0, resolve)', "srv.listen(0, '127.0.0.1', resolve)", 's.listen(\n  0)', 's.listen( 0 , cb)'],
            hostPort: ['`http://127.0.0.1:${port}/x`', '`http://${host}:${env.port}/app/`', "'http://127.0.0.1/app/'", "'http://[bad?token=secret'"],
            portAssign: ['let port = null', 'let port = server.address().port', 'port = await getPort()', 'let timeout = 3000', "import x from 'y'", 'if (a.port === 1) {}', 'let report = 1', 'let support: 2'],
            literalPort: ['includes(String(env.port))', 'setTimeout(resolve, 3000)', 'timeout: 15000', "'abc'", 'let n = 18000'],
        }
        for (let k of Object.keys(rules)) {
            for (let s of bad[k]) {
                assert.ok(rules[k](maskComments(s)).length >= 1, `${k}應抓到: ${s}`)
            }
            for (let s of good[k]) {
                assert.deepStrictEqual(rules[k](maskComments(s)), [], `${k}不應抓到: ${s}`)
            }
        }

        //註解遮罩: 註解內之字樣不計; 字串、正則、範本內之/*或//或引號不使其後之程式被誤判為註解
        let masked = [
            '//s.listen(8430)\n/* s.listen(8431) */',
            '/* s.listen(8430)\n   s.listen(8431) */',
            'x = 1 // s.listen(8430)',
        ]
        for (let s of masked) {
            assert.deepStrictEqual(rules.listen(maskComments(s)), [], `註解內不計: ${s}`)
        }
        let notMasked = [
            "let a = 'text/plain, */*'\n s.listen(9100)", //字串內之/*
            "let a = 'a // b'; s.listen(9100)", //字串內之//
            'let a = /[\'"]/g\n s.listen(9100)', //正則內之引號
            'let a = x.split(/\\r?\\n/)\n s.listen(9100)', //一般正則
            'let a = `${b ? `x` : "y"}`\n s.listen(9100)', //範本內插與巢狀範本
            "// don't\n s.listen(9100)", //行註解內之單引號
            "let a = \"don't\"; s.listen(9100)", //雙引號字串內之單引號
            'return /a\'b/.test(x) && s.listen(9100)', //return後之正則
        ]
        for (let s of notMasked) {
            assert.strictEqual(rules.listen(maskComments(s)).length, 1, `不應被遮蔽: ${s}`)
        }
        assert.strictEqual(maskComments('a\n/* x\ny */\nb').split('\n').length, 4) //行號不變
        /* eslint-enable quotes, no-template-curly-in-string */
    })

    it('PN-001 所有.listen(之第一個引數皆為字面0(埠由作業系統配發)', function() {
        assert.deepStrictEqual(scanAll(rules.listen), [])
    })

    it('PN-002 無host:埠字面', function() {
        assert.deepStrictEqual(scanAll(rules.hostPort), [])
    })

    it('PN-003 無埠命名之變數或鍵指定數字字面, 無範本運算式內之純數字', function() {
        assert.deepStrictEqual(scanAll(rules.portAssign), [])
    })

    it('PN-004 無引號包住之4~5位純數字字串, 無舊固定埠段(84xx)字面', function() {
        assert.deepStrictEqual(scanAll(rules.literalPort), [])
    })

    it('PN-005 無舊機制殘留(保留埠、行程表驗證、selfCheck、E2E_PORT_*)', function() {
        let re = /reserveE2ePorts|reserveTestPorts|reservePorts|listenReserved|verifyListening|TEST_PORTS|ALL_TEST_PORTS|selfCheck|__self|listenerPids|describePortOwners|E2E_PORT_(?:OFFSET|HOLD|REG_DIR)|portChild|e2ePorts/
        let rs = []
        for (let fp of listFiles()) {
            let lines = fs.readFileSync(fp, 'utf8').split('\n')
            lines.forEach((v, i) => {
                if (re.test(v)) {
                    rs.push(`${path.relative(fdTest, fp)}:${i + 1} ${v.trim()}`)
                }
            })
        }
        assert.deepStrictEqual(rs, [])
        for (let n of ['tools/e2ePorts.mjs', 'tools/portChild.mjs', 'unit-e2ePorts.test.mjs']) {
            assert.ok(!fs.existsSync(path.join(fdTest, n)), `舊機制之檔不得存在: ${n}`)
        }
    })

    it('PN-006 會監聽之測試檔(呼叫.listen(或startFakeServer()皆印出實際埠一行(規格E6)', function() {
        let re = /\[(?:\$\{name\}|[\w-]+)\] \[e2e-port\] 實際埠 \$\{[^}]+\}\(作業系統配發\)/
        let rs = []
        let n = 0
        for (let fp of listFiles()) {
            if (path.basename(fp) === 'fakeServer.mjs') {
                continue //假伺服器為被呼叫之工具, 由呼叫端印出
            }
            let code = codeOf(fp, fs.readFileSync(fp, 'utf8'))
            if (/\.listen\(|startFakeServer\(/.test(code)) {
                n++
                if (!re.test(code)) {
                    rs.push(path.relative(fdTest, fp))
                }
            }
        }
        assert.ok(n >= 2, `會監聽之檔數${n}`)
        assert.deepStrictEqual(rs, [])
    })

})
