import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import opt from './distRollupOpt.mjs' //建置設定與測試共用


let fdTar = './dist'

rollupFiles({ //rollupFiles預設會clean folder
    ...opt,
    fdTar,
})
    .catch((err) => {
        console.log(err)
    })
