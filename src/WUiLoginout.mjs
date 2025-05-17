import axios from 'axios'
import get from 'lodash-es/get.js'
import isDev from 'wsemi/src/isDev.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import ispint from 'wsemi/src/ispint.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import ispm from 'wsemi/src/ispm.mjs'
import cint from 'wsemi/src/cint.mjs'
import delay from 'wsemi/src/delay.mjs'
import pmConvertResolve from 'wsemi/src/pmConvertResolve.mjs'


/**
 * 前端界面用之使用者登入出輔助功能函數
 *
 * @param {String} site 輸入專案名稱字串
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {String} [opt.params={}] 輸入，預設{}
 * @param {String} [opt.keyGlobal='___params___'] 輸入，預設'___params___'
 * @param {Integer} [opt.timeWaitAnimation=0] 輸入，預設0
 * @param {String} [opt.defToken='sys'] 輸入，預設'sys'
 * @param {String} [opt.apiName='api'] 輸入，預設'api'
 * @param {String} [opt.apiNameForVerify='getUserByToken'] 輸入，預設'getUserByToken'
 * @param {Integer} [opt.retry=3] 輸入驗證token失敗重試次數整數，預設為3
 * @returns {Object} 回傳輔助函數物件，可使用'parseUrl'、'getTokenFromUrl'、'getToken'、'getValue'、'getUrl'、'getApi'、'login'、'detect'、'logout'
 * @example
 * import wui from 'w-ui-loginout/src/WUiLoginout.mjs'
 *
 * function loginSuccess(data) {
 *     console.log('login success', data.user)
 *     // vo.$ui.updateConnState('已連線')
 *     // vo.$ui.updateUserToken(data.token)
 *     // vo.$ui.updateUserSelf(data.user)
 * }
 *
 * function loginError(data) {
 *     console.log('login error', data)
 *     // vo.$ui.updateConnState(data.text)
 *     // vo.$ui.updateUserToken('')
 *     // vo.$ui.updateUserSelf(get(vo, `$store.state.userDef`))
 *     // vo.ready = false
 *     // vo.msg = data.msg
 * }
 *
 * //login
 * console.log('login...')
 * let ll = wui('wperm', {
 *     // logIn: '{base}sso/?sid=i12-i34-i56-i78', //提供sso指定需返回之專案sid
 *     // logOut: '{base}sso/api/logout?token={token}',
 *     // checkToken: '{base}sso/api/checkToken?token={token}',
 *     // goSSO: '{base}sso/?token={token}',
 *     // goPerm: '{baseNoPort}perm/?token={token}',
 * })
 * ll.login({
 *     afterGetUser: null,
 *     afterLogin: null,
 *     loginSuccess,
 *     loginError,
 * })
 * // vo.ll = ll
 *
 */
function WUiLoginout(site, opt = {}) {

    //check site
    if (!isestr(site)) {
        throw new Error(`invalid site`)
    }

    //params
    let params = get(opt, 'params', {})
    // console.log('params', params)

    //keyGlobal
    let keyGlobal = get(opt, 'keyGlobal', '')
    if (!isestr(keyGlobal)) {
        keyGlobal = '___params___'
    }

    //timeWaitAnimation, 等待連線動畫展示延遲時間
    let timeWaitAnimation = get(opt, 'timeWaitAnimation')
    if (!ispint(timeWaitAnimation)) {
        timeWaitAnimation = 0
    }

    //defToken
    let defToken = get(opt, 'defToken', '')
    if (!isestr(defToken)) {
        defToken = 'sys'
    }

    //apiName
    let apiName = get(opt, 'apiName', '')
    if (!isestr(apiName)) {
        apiName = 'api'
    }

    //apiNameForVerify
    let apiNameForVerify = get(opt, 'apiNameForVerify', '')
    if (!isestr(apiNameForVerify)) {
        apiNameForVerify = 'getUserByToken'
    }

    //retry
    let retry = get(opt, 'retry')
    if (!isp0int(retry)) {
        retry = 3
    }

    //urlOrigin
    let urlOrigin = window.location.origin

    //urlBase
    let urlBase = window.location.origin + window.location.pathname

    //urlOriginNoPort, urlBaseNoPort, 取代開發階段perm用IIS反向代理架設, 網址無port得取代掉
    let urlOriginNoPort = urlOrigin
    let urlBaseNoPort = urlBase
    if (isestr(window.location.port)) {
        let p = `:${window.location.port}`
        urlOriginNoPort = urlOriginNoPort.replace(p, '')
        urlBaseNoPort = urlBaseNoPort.replace(p, '')
    }

    //save, 儲存至window供全域使用
    window[keyGlobal] = {
        ...params,
        site,
        origin: urlOrigin,
        originNoPort: urlOriginNoPort,
        base: urlBase,
        baseNoPort: urlBaseNoPort,
    }


    //parseUrl
    let parseUrl = () => {

        //ulps
        let ulps = new URLSearchParams(window.location.search)
        // console.log('ulps', ulps, window.location.search, window.location.href)

        //kp
        let kp = {}
        ulps.forEach((v, k) => {
            // console.log(k, v)
            kp[k] = v
        })
        // console.log('kp', kp)

        return kp
    }


    //getTokenFromUrl
    let getTokenFromUrl = () => {

        //kp
        let kp = parseUrl()
        // console.log('kp', kp)

        //token
        let token = get(kp, 'token', '')
        // console.log('token', token)

        return token
    }


    //getToken
    let getToken = () => {
        let token = ''
        if (!isestr(token)) {
            token = getTokenFromUrl()
            // console.log('getTokenFromUrl', token)
        }
        if (!isestr(token)) {
            token = localStorage.getItem(`${site}:userToken`) //[localStorage:token]
            // console.log('localStorage.getItem', token)
        }
        return token
    }


    //getValue
    let getValue = (key) => {
        let value = get(window, `${keyGlobal}.${key}`, '')
        return value
    }


    //getUrl
    let getUrl = (key) => {
        let token = getToken()
        let origin = get(window, `${keyGlobal}.origin`, '')
        let originNoPort = get(window, `${keyGlobal}.originNoPort`, '')
        let base = get(window, `${keyGlobal}.base`, '')
        let baseNoPort = get(window, `${keyGlobal}.baseNoPort`, '')
        let url = getValue(key)
        url = url.replace('{token}', token)
        url = url.replace('{origin}', origin)
        url = url.replace('{originNoPort}', originNoPort)
        url = url.replace('{base}', base)
        url = url.replace('{baseNoPort}', baseNoPort)
        return url
    }


    //getApi
    let getApi = async(path) => {
        let errTemp = null

        //urlBase
        let urlBase = getValue('base')
        // console.log('getApi urlBase', urlBase)

        //url
        let url = `${urlBase}${apiName}/${path}`
        // console.log('getApi url', url)

        //axios
        let r
        await axios({
            method: 'GET',
            url,
        })
            .then((res) => {
                r = res.data
                // console.log('getApi then', r)
            })
            .catch((err) => {
                // console.log('getApi catch', err)
                errTemp = err.toString()
            })

        //check
        if (errTemp !== null) {
            return Promise.reject(errTemp)
        }

        return r
    }


    //login
    let login = async (opt = {}) => {

        //afterGetUser
        let afterGetUser = get(opt, 'afterGetUser')

        //afterLogin
        let afterLogin = get(opt, 'afterLogin')

        //loginError
        let loginError = get(opt, 'loginError')

        //loginSuccess
        let loginSuccess = get(opt, 'loginSuccess')

        //site
        let site = getValue('site')
        // console.log('site', site)

        async function core() {
            let errTemp = null

            //delay, 等待連線動畫展示
            await delay(timeWaitAnimation)

            //check
            if (!isestr(site)) {
                console.log('site', site)
                throw new Error(`invalid site`)
            }

            //token
            let token = ''
            if (!isestr(token)) {
                token = getTokenFromUrl()
                // console.log('getTokenFromUrl', token)
            }
            if (!isestr(token)) {
                token = localStorage.getItem(`${site}:userToken`) //[localStorage:token]
                // console.log('localStorage.getItem', token)
            }

            //check
            if (isDev()) {
                if (!isestr(token)) {
                    // console.log('use defToken', defToken)
                    token = defToken
                }
                //不能用else if, 供測試無效令牌情況
                if (token === 'error') {
                    errTemp = {
                        text: '登入時無效令牌',
                        msg: 'invalid token',
                    }
                    return Promise.reject(errTemp)
                }
            }
            else {
                if (!isestr(token)) {
                    errTemp = {
                        text: '登入時無效令牌',
                        msg: 'invalid token',
                    }
                    return Promise.reject(errTemp)
                }
            }
            // console.log('token', token)

            //getApi
            let data = await getApi(`${apiNameForVerify}?token=${token}`)
                .catch((err) => {
                    errTemp = {
                        text: '登入時無法連線',
                        msg: err,
                    }
                })
            // console.log(apiNameForVerify, 'data', data, 'errTemp', errTemp)

            //check
            if (errTemp !== null) {
                return Promise.reject(errTemp)
            }

            //check, 內容為權限提供, 格式用pm2resolve轉, 故提取state進行判斷
            if (get(data, 'state') === 'error') {
                errTemp = {
                    text: '登入時驗證失敗',
                    msg: get(data, 'msg'),
                }
                return Promise.reject(errTemp)
            }

            //user
            let user = get(data, 'msg')
            // console.log('user', user)

            //check
            if (!iseobj(user)) {
                console.log('data', data)
                errTemp = {
                    text: '登入時無法取得使用者資訊',
                    msg: 'invalid user',
                }
                return Promise.reject(errTemp)
            }

            //afterGetUser
            if (isfun(afterGetUser)) {
                let r = afterGetUser(user)
                if (ispm(r)) {
                    r = await r
                }
            }

            return {
                token,
                user,
            }
        }

        //accdata
        let state
        let data
        await core()
            .then((res) => {
                state = true
                data = res

                //save userToken
                localStorage.setItem(`${site}:userToken`, res.token) //[localStorage:token]

            })
            .catch((err) => {
                state = false
                data = err

                //clear userToken
                localStorage.setItem(`${site}:userToken`, '') //[localStorage:token]

            })
        let accdata = {
            state,
            data,
        }
        // console.log('accdata', accdata)

        //afterLogin
        if (isfun(afterLogin)) {
            let r = afterLogin(accdata)
            if (ispm(r)) {
                r = await r
            }
        }

        //loginSuccess, loginError
        if (state) {
            if (isfun(loginSuccess)) {
                let r = loginSuccess(data)
                if (ispm(r)) {
                    r = await r
                }
            }
        }
        else {
            if (isfun(loginError)) {
                let r = loginError(data)
                if (ispm(r)) {
                    r = await r
                }
            }
        }

        return accdata
    }


    //detect
    let detect = async (opt = {}) => {

        //timePeriod, 輪循週期(ms)
        let timePeriod = get(opt, 'timePeriod')
        if (!ispint(timePeriod)) {
            timePeriod = 2000
        }
        timePeriod = cint(timePeriod)

        //procCheckToken
        let procCheckToken = get(opt, 'procCheckToken')

        //procLogout
        let procLogout = get(opt, 'procLogout')

        //site
        let site = getValue('site')
        // console.log('site', site)

        //urlCheckToken
        let urlCheckToken = getUrl('checkToken')

        //checkTokenCore
        let checkTokenCore = async() => {
            let errTemp = null

            //axios
            let res = await axios({
                method: 'GET',
                url: urlCheckToken,
            })
                .catch((err) => {
                    // console.log('urlLogOut catch', err)
                    errTemp = {
                        text: '驗證令牌時遭遇錯誤',
                        msg: err,
                    }
                })

            //check
            if (errTemp !== null) {
                return Promise.reject(errTemp)
            }

            return res
        }

        //checkToken
        let checkToken = async() => {

            //fun
            let fun = pmConvertResolve(checkTokenCore)

            //sendPkg
            let r = await fun()

            let n = 0
            while (r.state === 'error') {
                n += 1
                if (n > retry) {
                    break
                }
                console.log(`retry n=${n}`)
                r = await fun()
            }

            if (r.state === 'success') {
                return r.msg
            }
            else {
                return Promise.reject(r.msg)
            }
        }

        let locking = false
        async function core() {
            let errTemp = null

            //check
            if (locking) {
                return
            }
            locking = true

            //輪循確認ls內token是否存在
            let token = localStorage.getItem(`${site}:userToken`) //[localStorage:token]
            // console.log('localStorage.getItem', token)

            //check
            if (!isestr(token)) {
                errTemp = {
                    text: '令牌已清除',
                    msg: 'invalid token',
                }
                return Promise.reject(errTemp)
            }

            //checkToken
            let res = await checkToken()
                .catch((err) => {
                    errTemp = err
                })

            //check
            if (errTemp !== null) {
                return Promise.reject(errTemp)
            }

            //procCheckToken
            if (isfun(procCheckToken)) {
                let r = procCheckToken(res)
                if (ispm(r)) {
                    r = await r
                }
                if (!r) {
                    errTemp = {
                        text: '驗證令牌失敗',
                        msg: res,
                    }
                }
            }

            //check
            if (errTemp !== null) {
                return Promise.reject(errTemp)
            }

            locking = false
        }

        //setInterval
        let t = setInterval(() => {
            core()
                .catch((err) => {
                    clearInterval(t)
                    if (isfun(procLogout)) {
                        procLogout(err)
                    }
                })
        }, timePeriod)

        return null
    }


    //logout
    let logout = async (opt = {}) => {

        //procLogout
        let procLogout = get(opt, 'procLogout')

        //afterLogout
        let afterLogout = get(opt, 'afterLogout')

        //logoutError
        let logoutError = get(opt, 'logoutError')

        //logoutSuccess
        let logoutSuccess = get(opt, 'logoutSuccess')

        //site
        let site = getValue('site')
        // console.log('site', site)

        async function core() {
            let errTemp = null

            //token
            let token = getToken()

            //check
            if (!isestr(token)) {
                errTemp = {
                    text: '無法取得登出用token',
                    msg: 'invalid token',
                }
                return Promise.reject(errTemp)
            }

            //urlLogOut
            let urlLogOut = getUrl('logOut')
            if (!isestr(urlLogOut)) {
                errTemp = {
                    text: '無法取得登出用設定資訊',
                    msg: 'invalid urlLogOut',
                }
                return Promise.reject(errTemp)
            }

            //axios
            let res = await axios({
                method: 'GET',
                url: urlLogOut,
            })
                .catch((err) => {
                    // console.log('urlLogOut catch', err)
                    errTemp = {
                        text: '登出時遭遇錯誤',
                        msg: err,
                    }
                })

            //check
            if (errTemp !== null) {
                return Promise.reject(errTemp)
            }

            //procLogout
            if (isfun(procLogout)) {
                let r = procLogout(res)
                if (ispm(r)) {
                    r = await r
                }
                if (!r) {
                    errTemp = {
                        text: '登出失敗',
                        msg: res,
                    }
                }
            }

            //check
            if (errTemp !== null) {
                return Promise.reject(errTemp)
            }

            return {
                token,
            }
        }

        //accdata
        let state
        let data
        await core()
            .then((res) => {
                state = true
                data = res

            })
            .catch((err) => {
                state = false
                data = err

            })
        let accdata = {
            state,
            data,
        }

        //clear userToken
        localStorage.setItem(`${site}:userToken`, '') //[localStorage:token]

        //afterLogout
        if (isfun(afterLogout)) {
            let r = afterLogout(accdata)
            if (ispm(r)) {
                r = await r
            }
        }

        //logoutSuccess, logoutError
        if (state) {
            if (isfun(logoutSuccess)) {
                let r = logoutSuccess(data)
                if (ispm(r)) {
                    r = await r
                }
            }
        }
        else {
            if (isfun(logoutError)) {
                let r = logoutError(data)
                if (ispm(r)) {
                    r = await r
                }
            }
        }

        return accdata
    }


    //r
    let r = {
        parseUrl,
        getTokenFromUrl,
        getToken,
        getValue,
        getUrl,
        getApi,
        login,
        detect,
        logout,
    }


    return r
}


export default WUiLoginout
