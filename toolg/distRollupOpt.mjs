//建置dist之設定, 供toolg/gDistRollup.mjs與測試之建置(test/tools/buildUmd.mjs)共用, 不各寫一份
let opt = {
    fns: 'WUiLoginout.mjs',
    fdSrc: './src',
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
}


export default opt
