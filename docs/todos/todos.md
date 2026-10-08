### Contract tests

- [ ] 建立固定 fixtures，涵蓋 Markdown 與 source comment protocols。
- [ ] 測試 formatter、block locator 與 router。
- [ ] 實作獨立的 `validate-protocol` parser，供 contract tests 與 agent e2e assertions 共用。

### pilotfish-vscode

- [x] 把 protocol keyword 獨立出來，然後要跟 editor-skill 對齊
- [-] 新增一個處理該檔案所有的 block 的指令吧 不做了，用複製全部行號來作  ❌ 2026-09-30
- [x] 改成，只要 cursor 在 block 內，就自動複製那個 block 的 command，這樣就不用找了
- [x] 加上 utils test，但如果只是產模版我不太想要寫還沒啥意義。想想有意義的測試是什麼
  - 一部分弄好了
- [x] 重構尋找行號邏輯 ✅ 2026-09-30
- [ ] make agent command 
	- [ ] 如果沒有 agent block 或者是 action，那就是直接複製該行的行號 + 檔名，然後就不回復在檔案直接回答，直接回答這段好像還沒有作 #T0
	- [ ] 複製整個頁面的 agent block #T1
- [ ] delete agent block #T0
- [ ] summarie agent block -> 可能會變成一種 action #T1
- [ ] agent block ref file intellesense #T0


### obsidian-pilotfish-plugin

- [ ] agent block action => 採用 跟 action:do 一樣的邏輯 #T0
	- 蠻重要的，因為蠻常在 md 去指定任務...
	- [ ] 需要訂定語法
- [ ] delete agent block  #T0
- [ ] summarize current range 
	- [ ] 需要有 pending... status 
	- [ ] 先弄個 start  / close sign
- [ ] custom agent callout theme
	- [ ] 客製的 callout theme 跟調整 callout 的 format: docs/protocol-command.md:44


### TODO in markodwn
- [ ] 跟 todo 的互動方式
- [ ] 怎麼不要 invocation block 直接回答問題？

## skill

- [x] 這個已經釐清好基本架構了 ✅ 2026-09-21
	- [ ] 應該要寫清楚一點，多一點自己的想法而不是
- [ ] 接下來應該要定義出每個部分理想的架構，看看現在有什麼需要調整的部分 
	- 是不是還有其他 invocation 的可能性呢？不過這應該也是基於前面的架構大概加上去
	- [ ] 面對 todo 類型的 md，好像要有個 action 的 block，可以較他去處理事情，然後反而只是把結果放在同一個 block 裡面
- [ ] build process  [skill-build-process](docs/todos/skill-build-process.md)

### misc

- [x] 目前 editor-commands-protocal，裡面好像還有其他的 protocol 範例 `editor-commands-protocal` 改成與 frontmatter 一致的 `collab` ✅ 2026-09-22
- [-] install 的 sciprts 要清楚不需要的資料 ❌ 2026-09-22
	- 這背後有更大的問題，先不這樣作



## Comment

- 目前有個問題是我要改 command 要同時改 skills 跟 plugin/ extension 這兩邊。還沒想到好方法同步
  - 寫在 skill 裡面作 export？ 