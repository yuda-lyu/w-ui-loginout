//e2e共用實作之單一橋接: 專案一律經此引用w-package-tools-e2e與w-playwright, 不各自手寫
import wpw from 'w-playwright'
export { default as registerCleanupHooks } from 'w-package-tools-e2e/src/registerCleanupHooks.mjs'
export { default as pollUntil } from 'w-package-tools-e2e/src/pollUntil.mjs'


/**
 * 啟動Chromium之單一出口(本套件測試唯一之啟動點), 一律經w-playwright, 不直接使用playwright或playwright-core
 *
 * w-playwright於每次啟動之命令列恰給一個--disable-features(Playwright預設清單加AutofillAiWalletPrivatePasses加呼叫端自給者),
 * 使Chromium系瀏覽器不因啟動而對目前Windows使用者累計錯誤密碼次數; 本套件測試只用無頭(headless shell), 不啟動真Chrome、Edge或完整Chromium;
 * autoInstall為true: 缺Playwright受管之瀏覽器時安裝一次再啟動(同原w-package-tools-e2e之launchChromium行為); Linux缺系統相依時不自動安裝(installDeps預設關)
 *
 * @param {Object} [opt={}] 輸入chromium.launch之設定物件，原樣傳入w-playwright，預設{}
 * @returns {Promise} 回傳Promise，resolve回傳Browser，reject回傳帶code之Error
 */
async function launchChromium(opt = {}) {
    return wpw.launchChromium({ ...opt, autoInstall: true })
}


export { launchChromium }
