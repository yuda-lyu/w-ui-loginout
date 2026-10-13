import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fdSrcAbs } from './tools/srcDir.mjs'


//unit-imports: src之靜態盤點
//斷言對應規則帳本(CLAUDE_rulebook.md)之R1(引用皆宣告且可解析)、R13(無除錯輸出)


//selfProvided, 自有套件已自帶之相依(全域規範§7): 套件名 → 提供者; 測試另驗提供者確實將其列為dependencies
let selfProvided = {
    'lodash-es': 'wsemi',
}


//listSrc, src下之mjs
let listSrc = () => {
    let fd = fdSrcAbs()
    return fs.readdirSync(fd).filter((v) => v.endsWith('.mjs')).map((v) => path.join(fd, v))
}


//stripComments, 去除區塊與行註解(只用於掃描, 不需完整之JS語法分析)
let stripComments = (c) => {
    c = c.replace(/\/\*[\s\S]*?\*\//g, '')
    c = c.replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    return c
}


//getSpecs, 取import/export之來源字串
let getSpecs = (c) => {
    let rs = []
    let re = /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
    let m
    while ((m = re.exec(c)) !== null) {
        rs.push(m[1])
    }
    return rs
}


//pkgNameOf, 裸引用之套件名
let pkgNameOf = (spec) => {
    let ss = spec.split('/')
    return spec.startsWith('@') ? `${ss[0]}/${ss[1]}` : ss[0]
}


let readJson = (fp) => {
    return JSON.parse(fs.readFileSync(fp, 'utf8'))
}


describe('unit-imports', function() {

    let pkg = readJson('./package.json')
    let declared = { ...(pkg.dependencies || {}), ...(pkg.peerDependencies || {}) }

    it('I1 src之裸引用皆已宣告於dependencies, 或為自有套件自帶且提供者確實列為相依', function() {
        let bad = []
        for (let fp of listSrc()) {
            let specs = getSpecs(stripComments(fs.readFileSync(fp, 'utf8')))
            for (let spec of specs) {
                if (spec.startsWith('.')) {
                    continue
                }
                let name = pkgNameOf(spec)
                if (declared[name]) {
                    continue
                }
                let provider = selfProvided[name]
                if (provider && declared[provider]) {
                    let pp = readJson(path.resolve('./node_modules', provider, 'package.json'))
                    if ((pp.dependencies || {})[name]) {
                        continue
                    }
                }
                bad.push(`${path.basename(fp)}: ${spec}`)
            }
        }
        assert.deepStrictEqual(bad, [])
    })

    it('I2 src之引用皆可解析(裸引用以import.meta.resolve, 相對引用檔案存在)', function() {
        let bad = []
        let n = 0
        for (let fp of listSrc()) {
            let specs = getSpecs(stripComments(fs.readFileSync(fp, 'utf8')))
            for (let spec of specs) {
                n++
                if (spec.startsWith('.')) {
                    if (!fs.existsSync(path.resolve(path.dirname(fp), spec))) {
                        bad.push(`${path.basename(fp)}: ${spec}`)
                    }
                    continue
                }
                try {
                    import.meta.resolve(spec)
                }
                catch (err) {
                    bad.push(`${path.basename(fp)}: ${spec} (${err.code})`)
                }
            }
        }
        assert.ok(n > 0)
        assert.deepStrictEqual(bad, [])
    })

    it('I3 src無除錯輸出(console.*呼叫, 註解除外)', function() {
        let bad = []
        for (let fp of listSrc()) {
            let c = stripComments(fs.readFileSync(fp, 'utf8'))
            let ls = c.split('\n')
            ls.forEach((v, i) => {
                if (/\bconsole\.(log|warn|error|info|debug)\s*\(/.test(v)) {
                    bad.push(`${path.basename(fp)}: ${v.trim()}`)
                }
            })
        }
        assert.deepStrictEqual(bad, [])
    })

})
