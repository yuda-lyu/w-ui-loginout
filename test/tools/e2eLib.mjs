//e2e共用實作之單一橋接: 專案一律經此引用w-package-tools-e2e, 不各自手寫
export { default as launchChromium } from 'w-package-tools-e2e/src/launchChromium.mjs'
export { default as registerCleanupHooks } from 'w-package-tools-e2e/src/registerCleanupHooks.mjs'
export { default as pollUntil } from 'w-package-tools-e2e/src/pollUntil.mjs'
