import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import opt from './distRollupOpt.mjs' //建置設定與測試共用


let fdTar = './dist'

rollupFiles({ //rollupFiles預設會clean folder
    ...opt,
    fdTar,
})
    .catch((err) => {
        //建置失敗須以非0結束, 使發布流程得知
        console.log(err)
        process.exitCode = 1
    })
