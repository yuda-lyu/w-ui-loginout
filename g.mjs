import wui from 'w-ui-loginout/src/WUiLoginout.mjs'


function loginSuccess(data) {
    console.log('login success', data.user)
    // vo.$ui.updateConnState('已連線')
    // vo.$ui.updateUserToken(data.token)
    // vo.$ui.updateUserSelf(data.user)
}

function loginError(data) {
    console.log('login error', data)
    // vo.$ui.updateConnState(data.text)
    // vo.$ui.updateUserToken('')
    // vo.$ui.updateUserSelf(get(vo, `$store.state.userDef`))
    // vo.ready = false
    // vo.msg = data.msg
}

//login
console.log('login...')
let ll = wui('wperm', {
    // logIn: '{base}sso/?sid=i12-i34-i56-i78', //提供sso指定需返回之專案sid
    // logOut: '{base}sso/api/logout?token={token}',
    // checkToken: '{base}sso/api/checkToken?token={token}',
    // goSSO: '{base}sso/?token={token}',
    // goPerm: '{baseNoPort}perm/?token={token}',
})
ll.login({
    afterGetUser: null,
    afterLogin: null,
    loginSuccess,
    loginError,
})
// vo.ll = ll
