import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fdSrcAbs } from './tools/srcDir.mjs'


//unit-docs: README與src之JSDoc須與實作一致
//斷言對應規則帳本(CLAUDE_rulebook.md)之R9
describe('unit-docs', function() {

    //驗證修前為紅時, 以環境變數WUL_README指向修前之README副本(src目錄同WUL_FDSRC)
    let readme = fs.readFileSync(process.env.WUL_README || './README.md', 'utf8')
    let src = fs.readFileSync(path.join(fdSrcAbs(), 'WUiLoginout.mjs'), 'utf8')

    //exampleOf, 取「let ll = wui('wperm', {」起至其對應之「})」之範例段
    let exampleOf = (c, prefix = '') => {
        let head = `${prefix}let ll = wui('wperm', {`
        let i = c.indexOf(head)
        assert.ok(i >= 0, `找不到範例: ${head}`)
        let j = c.indexOf(`${prefix}})`, i)
        assert.ok(j > i)
        return c.slice(i, j)
    }

    it('DC1 README與JSDoc之範例把網址鍵置於opt.params(實作只讀opt.params)', function() {
        for (let ex of [exampleOf(readme), exampleOf(src, ' * ')]) {
            let iParams = ex.indexOf('params: {')
            assert.ok(iParams > 0, ex)
            for (let k of ['logIn:', 'logOut:', 'checkToken:']) {
                let ik = ex.indexOf(k)
                assert.ok(ik > iParams, `${k} 須在 params 之內: ${ex}`)
            }
        }
    })

    it('DC2 README之UMD用法載明全域名與只需載入本檔, dev source code連到本repo', function() {
        assert.ok(readme.includes(`window['w-ui-loginout']`))
        assert.ok(readme.includes('No other script is required.'))
        assert.ok(readme.includes('(https://github.com/yuda-lyu/w-ui-loginout/blob/master/src/WUiLoginout.mjs)'))
        assert.ok(!readme.includes('w-cluster'))
    })

    it('DC3 README載明瀏覽器端工具、Node只可載入', function() {
        assert.ok(readme.includes('In Node.js it can be loaded'))
    })

    it('DC4 JSDoc: params型別Object、retry只用於detect、detect回傳停止函數、錯誤物件{text,msg}與回呼拋錯之處置', function() {
        assert.ok(src.includes('@param {Object} [opt.params={}]'))
        assert.ok(!src.includes('@param {String} [opt.params={}]'))
        assert.ok(src.includes('[opt.retry=3] 輸入detect檢查令牌失敗時之重試次數'))
        assert.ok(src.includes('detect啟動成功時回傳停止偵測函數'))
        assert.ok(src.includes('logout會停止進行中之偵測'))
        assert.ok(src.includes('login、logout、detect之錯誤物件一律為{text,msg}'))
        assert.ok(src.includes('回呼拋錯之處置'))
    })

})
