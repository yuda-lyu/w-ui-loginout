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
<script src="https://yuda-lyu.github.io/w-ui-loginout/dist/w-ui-loginout.umd.js"></script>
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

## Testing (development only)

The browser tests in `test/` (`npm test`) launch Chromium only through [w-playwright](https://www.npmjs.com/package/w-playwright) (a devDependency, `import wpw from 'w-playwright'`); this package depends on neither `playwright` nor `playwright-core` directly. The tests use the headless shell managed by Playwright only (no real Google Chrome, Microsoft Edge or full Chromium is started).

1. **Installation**: `npm i` brings in `playwright-core` (exact version, pinned by w-playwright). Do not install `playwright` or `playwright-core` separately.
2. **Browser download**: the managed headless shell is fetched through w-playwright. The tests start it with `autoInstall: true`, so a missing browser is downloaded once before the first launch. To fetch it in advance, run `await wpw.ensureChromium()` (do not use `npx playwright install`: a different Playwright version in the dependency tree could download a different browser build). On Linux, missing system libraries are not installed automatically (w-playwright option `installDeps`).
3. **Offline**: download the browser on a connected machine with the same w-playwright version, copy Playwright's browser folder to the target machine and point the environment variable `PLAYWRIGHT_BROWSERS_PATH` at it. Set it before the tests start; it is read when Playwright is loaded.
4. **Real Chrome / Edge**: not used by these tests. Anything that launches them through w-playwright (`channel: 'chrome'` or `'msedge'`) requires the browser to be installed.
5. **Guard argument**: w-playwright always gives exactly one `--disable-features` on every launch (Playwright's default list plus `AutofillAiWalletPrivatePasses` plus the caller's own). Since Chromium 153, every new browser root process on Windows calls `LogonUser` once with a wrong password for the current user, which counts as a failed logon; ten of them within ten minutes lock the account. Disabling that feature prevents it. There is no option to turn the guard off.
6. **Unsupported environment variables**: `PWDEBUG` (inspector mode) and `SELENIUM_REMOTE_URL` make w-playwright reject the launch.

