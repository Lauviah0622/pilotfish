## markdown protocol todo

> [!Comment] For Agent
> 我希望 markdown protocol 能夠有效的跟 todo 結合，你有什麼想法

> [!Comment] For User
> 我建議不要再發明一套「agent todo」語法，而是讓兩者分工：Markdown checkbox 是 task 與狀態的 source of truth，`For Agent`／`For User` callout 則保留限制、討論與執行結果。
>
> 最小可行規則可以是：`$collab file:line` 指到未完成的 task 時，把該 task 視為 `do`，只處理游標所在的 checkbox 與其子項；縮排在 task 下的 `For Agent` 是額外脈絡。開始時在同一個 task 下加入 `For User: Pending...`，驗證成功後才把 `[ ]` 改成 `[x]` 並將 reply 換成摘要；若被阻擋則保留 `[ ]`，reply 說明 blocker。這樣不需要靠 `[/]` 等非標準狀態表示執行中。
>
> Reply 仍應維持獨立 callout，不要塞回 `For Agent` 或 checkbox 文字裡。第一版也不需要 task ID：用 Markdown 的父子結構與游標位置綁定即可；等真的有跨檔引用、task 搬移或多人並行需求，再加穩定 ID。這也能解掉目前 `docs/todos/todos.md` 提到「結果放在同一個 block」和既有 protocol 的衝突。


- 應該需要 ID，因為如果在執行多個 todo 的話，anchor 會 drift，這樣不知道在哪裡處理
- 在想這這個是不是要跟 markdown-agent-protocol 分開？因為 todo 好像不會用那種格式，可能會是一個更簡潔的方式。而且畢竟目前的