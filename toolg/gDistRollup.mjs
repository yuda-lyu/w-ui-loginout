import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'

rollupFiles({ //rollupFiles預設會clean folder
    fns: 'WUiLoginout.mjs',
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    runin: 'browser', //本套件為瀏覽器端工具
    // bNodePolyfill: true,
    // bMinify: false,
    globals: {
        // 'xlsx': 'XLSX',
    },
    external: [
        // 'xlsx',
    ],
})
    .catch((err) => {
        //建置失敗須以非0結束, 使發布流程得知
        console.log(err)
        process.exitCode = 1
    })
