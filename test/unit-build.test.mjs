import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import buildUmd from './tools/buildUmd.mjs'
import { fdSrcAbs } from './tools/srcDir.mjs'


//unit-build: 以共用建置設定建置UMD並於Node載入
//斷言對應規則帳本(CLAUDE_rulebook.md)之R2、R3、R4(U4、U5)、R14, 以及建構子之site檢查(P1)
describe('unit-build', function() {

    let fdTmp = path.resolve('./test/_tmp/unit-build')
    let built = null

    before(async function() {
        this.timeout(180000)
        fs.rmSync(fdTmp, { recursive: true, force: true })
        built = await buildUmd(path.join(fdTmp, 'build'))
    })

    after(function() {
        fs.rmSync(fdTmp, { recursive: true, force: true })
    })

    it('B1 建置無無法解析之引用、無未命名之external, 且未印invalid runin', function() {
        //R2
        let bad = built.warns.filter((v) => /could not be resolved|No name was provided for external module/.test(v))
        assert.deepStrictEqual(bad, [])

        //R14: 明給runin
        assert.deepStrictEqual(built.logs.filter((v) => v.includes('invalid runin')), [])
    })

    it('B2 UMD標頭不帶外部模組參數', function() {
        //R3: 取banner後之UMD包裝段
        let c = fs.readFileSync(built.fp, 'utf8')
        let head = c.slice(0, c.indexOf('"use strict"'))
        assert.ok(head.length > 0)
        assert.ok(/module\.exports=\w+\(\)/.test(head), head)
        assert.ok(!head.includes('require('), head)
        assert.ok(!head.includes('define(['), head)
    })

    it('B3 Node可載入: require建出之UMD、import src皆得function', async function() {
        //R4(U4)
        let require = createRequire(import.meta.url)
        let m = require(built.fp)
        assert.strictEqual(typeof m, 'function')

        //R4(U5)
        let ms = await import(pathToFileURL(path.join(fdSrcAbs(), 'WUiLoginout.mjs')).href)
        assert.strictEqual(typeof ms.default, 'function')
    })

    it('P1 建構子site無效即拋invalid site(檢查先於存取window)', async function() {
        let ms = await import(pathToFileURL(path.join(fdSrcAbs(), 'WUiLoginout.mjs')).href)
        assert.throws(() => ms.default(''), /invalid site/)
        assert.throws(() => ms.default(), /invalid site/)
        assert.throws(() => ms.default(123), /invalid site/)
    })

})
