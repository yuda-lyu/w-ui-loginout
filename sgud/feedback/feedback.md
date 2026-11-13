# 回饋

本檔記任務中發現之自有套件、全域技能、全域設定之調整與抽提提案(只增不改;處置結果另記一列,寫明承接哪一列).回饋是紀錄與提案,實際修改走通報管道.

| 日期 | 類別 | 對象 | 內容 | 依據 |
|---|---|---|---|---|
| 2026-11-13 | 自有套件 | w-playwright | 提案抽提「接線斷言」為共用輔助:各使用端的接線測試都要寫同一段檢查(替身收到的選項 `args` 恰一個 `--disable-features`、為最後一個元素、含守門功能與 Playwright 預設功能、`ignoreDefaultArgs` 去掉預設那一串、無 `channel`／`executablePath`),十餘個使用端各抄一份會各自漂移;建議於 w-playwright 提供可深層引用之測試輔助(如 `test/tools/assertGuardedOptions.mjs`,與 `readBadPassword.mjs` 同法隨包發布),判準隨 Playwright 升版只改一處 | 本套件 `test/unit-wpwWiring.test.mjs` 之 `assertGuarded`(約 20 行);w-playwright 帳本 R-PW-WIRING 要求每個使用端皆有此類斷言 |
| 2026-11-13 | 全域技能 | role-coder-for-test §1 第 6 條(包裝套到多個呼叫點之接線測試) | 建議補一個 mocha 範本:要接住「由共用 `setup` 在 `beforeEach` 內啟動瀏覽器」之呼叫點,須在同一 `describe` 內**先**註冊「安裝替身」的 `beforeEach`、**再**呼叫 `setupE2e()`(hooks 依註冊順序執行),替身才會在啟動前就位;順序寫反時替身晚於真啟動,測試會空過或真啟動瀏覽器.另註明替身收到的是合併後選項(自用鍵已被剝除),此類鍵須以靜態檢查出口原始碼驗 | 本套件 `test/unit-wpwWiring.test.mjs` 檔頭之 hook 註冊順序;經驗檔第八節 |
