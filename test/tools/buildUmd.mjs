import fs from 'fs'
import path from 'path'
import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import opt from '../../toolg/distRollupOpt.mjs'
import { fdSrcOf } from './srcDir.mjs'


/**
 * 以與toolg/gDistRollup.mjs相同之建置設定(toolg/distRollupOpt.mjs)建置UMD至指定資料夾，並攔截建置期間之console.warn與console.log
 *
 * 不寫入受版控之dist；src目錄由fdSrcOf決定(預設./src)
 *
 * @param {String} fdTar 輸入輸出資料夾字串，建議為test/_tmp/<案名>/build
 * @returns {Promise} 回傳Promise，resolve為{fp,warns,logs}，fp為UMD檔之絕對路徑，warns與logs為攔截之訊息字串陣列
 */
async function buildUmd(fdTar) {
    let warns = []
    let logs = []
    let cw = console.warn
    let cl = console.log
    console.warn = (...args) => {
        warns.push(args.map(String).join(' '))
    }
    console.log = (...args) => {
        logs.push(args.map(String).join(' '))
    }
    try {
        await rollupFiles({
            ...opt,
            fdSrc: fdSrcOf(),
            fdTar,
        })
    }
    finally {
        console.warn = cw
        console.log = cl
    }
    let fp = path.resolve(fdTar, 'w-ui-loginout.umd.js')
    if (!fs.existsSync(fp)) {
        throw new Error(`buildUmd: 未產出 ${fp}`)
    }
    return {
        fp,
        warns,
        logs,
    }
}


export default buildUmd
