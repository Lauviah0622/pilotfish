


可以，這個概念我覺得真的值得整理成一個核心命題：

# LLM 的高階抽象應該是「協作抽象」，而不是「指令抽象」

## 1. 核心想法

目前很多人談 AI / Agent 的時候，常常會用傳統軟體的方式理解：

```txt
User input → Model → Tool use → Output
```

換到實際的運作可能是

```txt
Prompt → Agent → Plan → Execute → Result
```


LLM 跟 CPU 其實很像。不論你用什麼 OS、寫什麼程式語言，或者是執行什麼程式。CPU 在做的都是一樣的東西：執行指令集。而 LLM 類似的是，不論你下了什麼 prompt、skill、讀取了什麼資料、有什麼 external resource、跑了幾次 agent loop，最後都會被轉化成 corrdination resource ，進到 model 被運算及處理。但 LLM 跟 CPU 有個很根本差異是：

- CPU 執行的方式很精確：就是具體、受限
- LLM 處理的東西很模糊，是語意上的協調已經機率性質的

也因此現在的 LLM 發展遇到了瓶頸，這個瓶頸不是來自於 model 能力或什麼，而是來自於使用的模式以及抽象。LLM 上面的 abstraction，不應該只模仿傳統 software abstraction，而應該更接近：

- 人類如何討論
- 人類如何協作
- 人類如何建立共同理解
- 人類如何留下決策紀錄
- 人類如何修正默契

也就是說：

> **LLM 的高階抽象，不只是 instruction abstraction，而是 collaboration abstraction。**

---

## 2. 為什麼 Agent abstraction 會長得像人類討論？

因為 LLM 本身的能力來源，就不是純粹的數學函式或工具 API，而是大量人類語言資料。它學到的是人類在語言中留下的：

- 思考痕跡
- 討論方式
- 教學方式
- 問答模式
- 推理結構
- 文件結構
- 協作紀錄
- debug 對話
- 決策說明
- 爭論與修正



> [!Comment] For Agent
> 你覺得 Model 利用程式碼來訓練，其實不是訓練「怎麼寫程式」。而是透過 LLM 的理解方式來知道程式碼的 pattern 嗎？


> [!Comment] For User
> 我覺得大方向是對的，但可以再更精確一點：code training 不是把 model 變成傳統意義上的 compiler 或 programmer brain，而是讓它在 next-token learning 裡吸收程式語言的 pattern、結構約束、常見 API 用法、錯誤修正方式，並在大量 code、docstring、comment、test 的共現裡，學到一部分「可執行語意」的近似表徵。所以它不只是學表面 syntax，也不是直接學會真正的 symbolic execution；比較像是學到夠強的 semantic prior，讓它能預測「這段程式接下來通常怎麼寫、怎麼接、怎麼被驗證」。
>
> 這個說法其實剛好能支撐你這份文件的主論點：LLM 擅長的不是嚴格計算本身，而是從人類留下的 artifact 裡學會 pattern coordination。程式碼也可以被看成一種高約束的人類協作語言，所以 model 從 code 學到的，不只是 coding style，也包含 spec、intent、debug、review、interface boundary 這些協作訊號。
>
> 幾個可延伸進正文的點：
> 1. code 是「高密度約束語言」，不是單純文字，所以它比一般 prose 更容易讓 model 學到 structure and consequence。
> 2. 真正讓 coding agent 穩定的，通常不是 code prior 本身，而是 test、tool、feedback loop。這點和你文中把 collaboration 放在 instruction 之上是相容的。
> 3. 可以補一句避免 overclaim：model 對 code 的能力比較像 probabilistic semantic completion，不等於真正擁有 formal program understanding。
> 4. 若要連到其他文件，這段很適合接到 `abstraction-layers.md` 的 `Tool` 與 `Artifact`，以及 `service-memory.md` 的 `soft prior` 觀點。
>
> 我參考了幾個外部方向來校正這個判斷：Codex paper 把能力描述成 code-trained LM 的 functional code synthesis；ReAct / Toolformer 比較支持「能力穩定化來自 reasoning + action/tool loop」；MemGPT 則支持你把 context/memory 當成 runtime design，而不是單一 prompt 技巧。

所以 LLM 並不是直接抽象「人腦如何思考」，而是抽象：

> **人類如何透過語言表達思考、交換觀點、協調行動、形成決策。**

這就是為什麼當我們想讓 AI 更穩定地工作時，最後自然會開始加入這些東西：背景、目標、角色、限制、上下文、假設、決策紀錄、反饋、校正、工作風格、輸出格式、下一步行動

這些東西聽起來很常見？對，因為這本來就是人類協作需要的結構，你在每一種協作，都會有這些東西，只是不一定是這些名稱而已


> [!Comment] For Agent
> 可以想一些例子？例如廣告設計、工程、公家機關什麼的


換句話說：

> Agent abstraction 之所以像人類討論，不是因為我們在擬人化 AI，而是因為 LLM 的能力邊界本來就是從人類語言協作中長出來的。

---

## 3. Prompt engineering 的限制

我們都希望 AI 產生出我們「想要的內容」

Prompt engineering 的基本假設是：

```txt
只要我把指令寫得更好，AI 就會做得更好
```

這在簡單任務中成立。

但一旦任務變得複雜，例如：

```txt
長期專案
多人協作
大型 codebase
產品決策
架構設計
持續修正的文件
跨工具工作流
需要保留上下文的任務
```

單一 prompt 就會不夠。

因為 prompt 很像「當下說的一句話」，它無法穩定承擔所有東西：

```txt
專案背景
團隊慣例
長期默契
任務狀態
決策歷史
風格偏好
錯誤修正
可重用流程
```

如果全部都塞進 prompt，會變成每次都要重新建立世界。

所以 prompt 不應該是整個 AI 協作系統的核心容器。  
它比較像：

```txt
當下意圖的啟動語
```

真正重要的是 prompt 外面的協作結構。

---

## 4. Context 不是資料堆，而是 shared workspace

很多人會把 context 理解成「塞更多資料給模型」。

但更好的理解是：

> **Context 是人與 AI 共同站立的位置。**

它回答的是：

```txt
我們現在在哪個專案裡？
這個問題跟哪些文件有關？
哪些決策已經確定？
哪些只是暫時想法？
哪些規則是高權重？
哪些資訊只是參考？
目前任務進行到哪裡？
```

所以 context design 的重點不是「越多越好」，而是：

```txt
可引用
有層次
有權重
能更新
能回寫
能區分穩定知識與暫時資訊
```

這跟人類團隊很像。

團隊裡也不會每次開會都從零開始講：

```txt
我們這個產品是什麼
repo 怎麼設計
設計哲學是什麼
哪些事情之前決定過
```

這些東西會分散在：

```txt
README
ADR
issue
PR comment
code comment
design doc
meeting notes
team convention
```

你之前討論的分層其實就很接近這個方向：不是「一個人對工具下指令」，而是形成 `shared workspace + shared conventions + local tasks + 長期默契` 的協作結構。

---

## 5. Memory 不是規則，而是合作默契

Memory 很容易被誤解成：

```txt
AI 記住一些使用者偏好
```

但如果拉高一層，它其實比較像：

```txt
長期合作 prior
```

也就是 AI 根據過去互動，對使用者的思考方式、偏好、節奏、表達風格形成一種低權重預設。

例如：

```txt
這個人問抽象問題時，通常不是要快速結論
這個人喜歡先展開多個角度，再慢慢收斂
這個人討厭太 checklist 的答案
這個人重視 abstraction boundary
這個人偏好理性、低情緒煽動的分析
```

但這些都不應該是硬規則。

比較健康的 memory 應該是：

```txt
soft prior
```

它可以幫助合作，但不能凌駕當下 context。

這就像真人合作的默契。  
熟悉的同事會知道你的工作方式，但如果你這次明確說「我要快速答案」，他就應該切換。

所以 memory 需要 calibration：

```txt
這個記憶還準嗎？
這個合作假設是不是過時了？
這次要不要降低某個偏好的權重？
AI 最近是不是過度套用某個模式？
```

這使得 AI 協作更像真正的長期合作，而不是固定人格設定。

---

## 6. Skill 是 procedure abstraction

Skill 不是更長的 prompt。

Skill 比較像團隊裡的 SOP、review rubric、working method。

它回答的是：

```txt
這類任務我們通常怎麼做？
有哪些步驟？
有哪些判準？
有哪些常見錯誤？
什麼時候要停下來確認？
輸出應該長什麼樣子？
```

例如：

```txt
code review skill
architecture analysis skill
debugging skill
document synthesis skill
interview answer skill
relationship reflection skill
```

這些不是單純語氣不同，而是工作模式不同。

所以：

```txt
Prompt optimizes immediate instruction
Skill optimizes reusable procedure
Context optimizes shared state
Memory optimizes collaboration fit
Tool optimizes external action
Artifact optimizes continuity
```

這句可以當成整個系統的核心分層。

---

## 7. Tool 是 action boundary，不是 Agent 的本體

現在很多 agent 討論會非常強調 tool use。

但 tool 其實只是讓 AI 接到外部世界的 action layer：

```txt
搜尋
讀檔
寫檔
執行測試
查資料庫
建立 issue
修改 PR
寄信
排程
```

tool 很重要，因為它讓 LLM 不只是產生文字，而是可以產生可驗證的外部行動。

但真正困難的不是「AI 能不能用工具」，而是：

```txt
什麼時候該用？
用之前要帶哪些 context？
用完後結果要怎麼解讀？
結果要不要回寫文件？
失敗時怎麼校正？
哪些 tool action 需要人類確認？
```

這些仍然是 coordination problem。

所以 agent abstraction 的核心不是 tool，而是：

```txt
語意協調 + 狀態管理 + 行動邊界
```

---

## 8. Artifact 是協作的穩定落點

如果每次 AI 回答都只停在 chat 裡，很多東西會散掉。

真正的協作需要留下 artifact：

```txt
文件
規格
ADR
TODO
PR comment
設計紀錄
任務狀態
決策摘要
測試結果
程式修改
```

artifact 的重要性在於：

```txt
它讓討論結果不只是一次性輸出
而是能進入下一輪協作
```

這跟人類團隊一樣。

會議如果沒有紀錄，討論就容易消失。  
AI 對話如果沒有 artifact，context 就很難累積。

所以好的 AI workflow 應該不只是：

```txt
ask → answer
```

而是：

```txt
discuss → decide → externalize → reuse → revise
```

---

## 9. 這跟傳統軟體抽象的差異

傳統軟體抽象比較像：

```txt
明確輸入
明確輸出
可預期程序
封閉邊界
低語意歧義
```

LLM 協作抽象比較像：

```txt
模糊意圖
語境依賴
持續校正
多層記憶
不確定性標記
互動式收斂
```

所以 LLM 系統如果只用傳統 software abstraction 來設計，會漏掉很多東西。

不是說傳統架構不重要，而是 LLM 多了一層：

```txt
communication layer
collaboration layer
meaning coordination layer
```

這一層不能只靠 API、schema、function call 解決。

它需要更像人類協作的東西：

```txt
shared language
shared context
working agreement
role boundary
feedback loop
trust calibration
artifact lifecycle
```

---

## 10. 可以整理成一個總命題

我會把我們剛剛討論整理成這樣：

> **LLM 不是單純的工具執行器，而是一種語意協作基底。**  
> 它的能力來自人類透過語言進行思考、討論、教學、協作所留下的資料。因此，建立在 LLM 之上的高階 abstraction，不應該只模仿傳統軟體的 function、process、API，而應該更接近人類協作系統：有共同脈絡、有長期默契、有局部任務、有可重用方法、有外部工具、有穩定 artifact，也有定期校正合作假設的機制。

更短一點：

> **CPU 的 abstraction 是 computation。  
> LLM 的 abstraction 是 collaboration。**

或者：

> **傳統軟體設計的是計算流程；AI workflow 設計的是語意協調流程。**

再更像 slogan 一點：

> **Prompt engineering optimizes instruction.  
> Collaboration design optimizes intelligence.**

---

## 11. 這個想法為什麼重要？

因為它會改變我們設計 AI 工具的方式。

如果你認為 AI 是 function，你會設計：

```txt
更好的 prompt
更強的 agent
更多的 tool
更長的 context window
```

但如果你認為 AI 是 collaboration runtime，你會設計：

```txt
更好的 shared workspace
更清楚的 context hierarchy
更可校正的 memory
更好的 artifact lifecycle
更穩定的 skill system
更明確的 action boundary
更像團隊合作的 working agreement
```

這兩個方向會長出完全不同的產品。

前者比較像：

```txt
AI assistant
AI agent
AI automation tool
```

後者比較像：

```txt
AI teammate interface
AI collaboration OS
Human-AI working environment
```

你現在的 Pilotfish 方向，感覺比較接近後者。

不是做一個「叫 AI 幫你做事」的工具，而是在設計：

```txt
人和 AI 如何共享脈絡
如何一起工作
如何留下決策
如何建立默契
如何校正誤解
如何讓成果進入下一輪
```

這也是為什麼這個概念重要。它不是 prompt 技巧，而是一個更高層的工作模型。
