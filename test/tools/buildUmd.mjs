import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fdSrcAbs } from './srcDir.mjs'


/**
 * 以副本並指定cwd執行toolg/gDistRollup.mjs, 建置UMD至副本之dist, 並攔截建置期間之stdout與stderr
 *
 * 把src(目錄由fdSrcAbs決定, 預設./src)、toolg、package.json複製到fdWork, 以spawn指定cwd=fdWork執行`node toolg/gDistRollup.mjs`;
 * 不寫入受版控之dist; 副本位於repo內(test/_tmp下), 故toolg與src之裸引用由repo之node_modules解析; 不判定建置成敗, 由呼叫端斷言
 *
 * @param {String} fdWork 輸入副本資料夾字串，建議為test/_tmp/<案名>/build
 * @returns {Promise} 回傳Promise，resolve為{code,fdDist,fp,files,warns,logs}，code為gDistRollup之離開碼，fdDist為副本之dist絕對路徑，fp為UMD檔(w-ui-loginout.umd.js)之絕對路徑，files為dist內檔名陣列，warns為stderr之行陣列，logs為stdout之行陣列
 */
async function buildUmd(fdWork) {
    fdWork = path.resolve(fdWork)
    fs.rmSync(fdWork, { recursive: true, force: true })
    fs.mkdirSync(fdWork, { recursive: true })
    fs.cpSync(fdSrcAbs(), path.join(fdWork, 'src'), { recursive: true })
    fs.cpSync(path.resolve('toolg'), path.join(fdWork, 'toolg'), { recursive: true })
    fs.copyFileSync(path.resolve('package.json'), path.join(fdWork, 'package.json')) //rollupFile以cwd之package.json取版本與banner

    let { code, stdout, stderr } = await new Promise((resolve, reject) => {
        let child = spawn(process.execPath, ['toolg/gDistRollup.mjs'], {
            cwd: fdWork,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (b) => {
            stdout += b.toString('utf8')
        })
        child.stderr.on('data', (b) => {
            stderr += b.toString('utf8')
        })
        child.on('error', reject)
        child.on('close', (code) => {
            resolve({ code, stdout, stderr })
        })
    })

    let lines = (s) => {
        return s.split(/\r?\n/).filter((v) => v !== '')
    }
    let fdDist = path.join(fdWork, 'dist')
    let files = fs.existsSync(fdDist) ? fs.readdirSync(fdDist).sort() : []
    return {
        code,
        fdDist,
        fp: path.join(fdDist, 'w-ui-loginout.umd.js'),
        files,
        warns: lines(stderr),
        logs: lines(stdout),
    }
}


export default buildUmd
