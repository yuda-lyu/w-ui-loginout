# w-ui-loginout
A tool for login and logout in browser.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-ui-loginout.svg?style=flat)](https://npmjs.org/package/w-ui-loginout) 
[![license](https://img.shields.io/npm/l/w-ui-loginout.svg?style=flat)](https://npmjs.org/package/w-ui-loginout) 
[![npm download](https://img.shields.io/npm/dt/w-ui-loginout.svg)](https://npmjs.org/package/w-ui-loginout) 
[![npm download](https://img.shields.io/npm/dm/w-ui-loginout.svg)](https://npmjs.org/package/w-ui-loginout) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-ui-loginout.svg)](https://www.jsdelivr.com/package/npm/w-ui-loginout)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-ui-loginout/global.html).

## Installation

### Using npm(ES6 module):
```alias
npm i w-ui-loginout
```

> This package runs in the browser (it uses `window`, `localStorage` and the built-in `fetch`). In Node.js it can be loaded (`require`/`import`), but its functions need a browser environment.

#### Example for browser:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-ui-loginout/blob/master/src/WUiLoginout.mjs)]
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
    params: {
        // logIn: '{base}sso/?sid=i12-i34-i56-i78', //提供sso指定需返回之專案sid
        // logOut: '{base}sso/api/logout?token={token}',
        // checkToken: '{base}sso/api/checkToken?token={token}',
        // goSSO: '{base}sso/?token={token}',
        // goPerm: '{baseNoPort}perm/?token={token}',
    },
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

Add script for w-ui-loginout. No other script is required.
```alias
<script src="https://cdn.jsdelivr.net/npm/w-ui-loginout@1.0.34/dist/w-ui-loginout.umd.js"></script>
```

The global name contains hyphens, so get it by `window['w-ui-loginout']`.
```alias
let wui = window['w-ui-loginout']
let ll = wui('wperm', {
    params: {
        // logOut: '{base}sso/api/logout?token={token}',
        // checkToken: '{base}sso/api/checkToken?token={token}',
    },
})
ll.login({
    loginSuccess: (data) => {
        console.log('login success', data.user)
    },
    loginError: (data) => {
        console.log('login error', data.text, data.msg)
    },
})
```

