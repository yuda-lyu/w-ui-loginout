/**
 * 以瀏覽器(與Node 18+)內建之fetch發送GET請求，為本套件發請求之唯一出口
 *
 * 語意對齊原先axios之用法:
 *   - 只有2xx為成功，非2xx即reject
 *   - 回應本文可JSON.parse者為解析結果，否則為原字串(空字串維持空字串)
 *   - 不設逾時
 * 錯誤訊息只含狀態碼或'Network Error'，不含請求網址(網址常帶token)，亦不附原始錯誤(fetch例外之訊息可能含網址)
 *
 * @private
 * @param {String} url 輸入請求網址字串
 * @returns {Promise} 回傳Promise，resolve為回應物件{data,status,statusText,headers}，headers為小寫鍵之物件；非2xx時reject為Error(message為'Request failed with status code {狀態碼}'，並帶status與response)，網路錯誤時reject為Error(message為'Network Error')
 */
async function httpGet(url) {

    //fetch
    let res = null
    try {
        res = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
            },
        })
    }
    catch (err) {
        //網址無法解析、無法連線、連線中斷等皆屬之, 不帶原始錯誤避免網址外流
        throw new Error('Network Error')
    }

    //text
    let text = ''
    try {
        text = await res.text()
    }
    catch (err) {
        throw new Error('Network Error')
    }

    //data, 可解析為JSON者轉換, 否則保留原字串
    let data = text
    if (text !== '') {
        try {
            data = JSON.parse(text)
        }
        catch (err) {}
    }

    //headers
    let headers = {}
    res.headers.forEach((v, k) => {
        headers[k] = v
    })

    //r
    let r = {
        data,
        status: res.status,
        statusText: res.statusText,
        headers,
    }

    //check, 只有2xx為成功
    if (res.status < 200 || res.status >= 300) {
        let err = new Error(`Request failed with status code ${res.status}`)
        err.status = res.status
        err.response = r
        throw err
    }

    return r
}


export default httpGet
