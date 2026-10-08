apps/editor-skills/tests/protocol-check
apps/obsidian-skills/tests/protocol-check

這兩個有調整一些資料夾架構跟名稱，方便之後新增新的 e2e test。

但還有一些要調整的
- 內部的指令要調整
- 想改成用 node test runner
- package.json 的指令想要改成 node 的 test runner 系列的


先幫我改這些？

> [!Comment] For User
> 已把兩組 protocol-check 改成 `node:test` 與 `*.test.js`，修正搬移後的 skill、fixture 和 prompt 路徑，並把兩個 package 的 `test` script 統一為 `node --test`。兩邊完整 e2e 各 1 個 test，皆已通過。



> [!Comment] For Agent
> 如果要把兩個測試的共用邏輯抽出來，你會怎麼做？

> [!Comment] For User
> 我會只抽「執行框架」，保留各測試的情境與 assertions。新增 repo-level 的 `tests/helpers/run-codex-skill-e2e.js`，提供 `runCodexSkillE2E({ skillPath, installedSkillName, fixturePath, fixtureFileName })`：負責建立 temp repo、複製 skill／fixture、`git init`、執行 `codex exec`、整理失敗訊息，最後回傳 `result` 與 `runDir`。兩個 `protocol-check.test.js` 只留下各自的設定、test 名稱和 protocol-specific assertions。這樣之後新增 e2e 只要準備 fixture 與 assertions，也不會把兩種 protocol 的行為硬塞進一個高度參數化的共用測試。


要改的地方有

1. 原本有個 template 的概念。這個應該不用了。這會讓整個流程有點麻煩？可能直接都放在 /sandbox 或者是 /template 裡面。
2. 應該要有個 createAgentTestingSandbox(skillsPath, sandboxPath, sandboxConfig: {installedSkill: path}) 這樣概念的東西我想
3. git init 應該要放在 createAgentTestingSandbox 裡面。
4. codex 的 runner 要分開變成另一個 utils
5. 保存下來是沒錯的


