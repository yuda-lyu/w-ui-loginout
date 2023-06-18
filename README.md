# w-ui-loginout
A tool for login and logout in browser.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-ui-loginout.svg?style=flat)](https://npmjs.org/package/w-ui-loginout) 
[![license](https://img.shields.io/npm/l/w-ui-loginout.svg?style=flat)](https://npmjs.org/package/w-ui-loginout) 
[![gzip file size](http://img.badgesize.io/yuda-lyu/w-ui-loginout/master/dist/w-ui-loginout.umd.js.svg?compression=gzip)](https://github.com/yuda-lyu/w-ui-loginout)
[![npm download](https://img.shields.io/npm/dt/w-ui-loginout.svg)](https://npmjs.org/package/w-ui-loginout) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-ui-loginout.svg)](https://www.jsdelivr.com/package/npm/w-ui-loginout)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-ui-loginout/global.html).

## Installation
### Using npm(ES6 module):
> **Note:** w-ui-loginout is mainly dependent on `lodash` and `wsemi`.
```alias
npm i w-ui-loginout
```

#### Example for browser:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-cluster/blob/master/g-cluster.mjs)]
```alias
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

```

### In a browser(UMD module):
> **Note:** w-ui-loginout does not dependent on any package.

Add script for w-ui-loginout.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-ui-loginout@1.0.1/dist/w-ui-loginout.umd.js"></script>
```

