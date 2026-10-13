import path from 'path'
import opt from '../../toolg/distRollupOpt.mjs'


/**
 * 取得測試建置與掃描之src目錄
 *
 * 預設為建置設定之fdSrc(./src)；驗證修前為紅時，以環境變數WUL_FDSRC指向修前副本(例如git show HEAD:src/...取至./tmp/後之目錄)
 *
 * @returns {String} 回傳src目錄字串
 */
function fdSrcOf() {
    let fd = process.env.WUL_FDSRC
    if (typeof fd === 'string' && fd !== '') {
        return fd
    }
    return opt.fdSrc
}


/**
 * 取得src目錄之絕對路徑
 *
 * @returns {String} 回傳絕對路徑字串
 */
function fdSrcAbs() {
    return path.resolve(fdSrcOf())
}


export {
    fdSrcOf,
    fdSrcAbs
}
