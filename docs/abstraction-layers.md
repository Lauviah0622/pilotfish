
# AI Workflow Layering Model

## 1. 核心共識

在模型層，`prompt`、`context`、`skill`、`memory`、`docs` 本質上並沒有差異。
它們最後都會被轉成 token，進入同一個模型序列，成為模型生成輸出的 conditioning material。

也就是：

```txt
prompt / context / skill / memory / docs
→ tokens
→ hidden representations
→ conditioning material
→ output distribution
```

所以如果只從 model ingestion 的角度看：

> 它們都只是 vector / transformation 的材料。

概念上，和軟體開發類似，CPU 完全不知道執行的指令集是來自於 OS, Runtime 還是你真正的 code。但當我們在實作一個 app 時，這些東西是有差別的。換句話真正的差異不在模型內部運作，這只是不同的 abstraction layer 而已。從這個角度來看，都只是其中一層的 interface，而已，但這些 interface 會有不同的 lifecycle、ownership、injection timing、authority、scope 與 maintenance strategy。

因此，我們討論應該是

```txt
作為 human-AI collaboration runtime，這些 interface 應該如何分工？
```

---

## 2. 目前常見的 AI abstraction layering

在一般 prompt-centric 的 AI 使用方式中，常見分法是：

- Context：讀取的專案的資訊後，會被儲存在 agent service 內部供後續推理使用
- Prompt：有幾種行為
	- 給予背景知識
	- 行為指令：action / instruction / transformation request
- Skill：reusable procedure / method
	- 作為一個可重複使用的行為指示、或者是執行風格
- Tool：external capability / side effect
	- 給予 Agent interface 進行操作


粗略可以寫成：

```txt
output = prompt(context)
```

或更完整：

```txt
output = skill.apply(
  action = prompt,
  state = context,
  priors = memory,
  capabilities = tools
)
```

這種模式下，prompt 通常承載主要 movement。

它告訴模型：

```txt
對這些 context 做什麼
用什麼角度做
輸出成什麼形式
有哪些限制
```

所以傳統使用方式比較像：

```txt
prompt carries intent
context provides material
skill provides method
```

---

## 3. 你的使用方式改變了抽象定位

你的 workflow 不是典型 prompt-centric。

你透過 inline 的方式，把 action / instruction / method intent 直接寫在 context 旁邊。

因此 prompt 不再是主要的 instruction layer。

它更像：

```txt
pointer
selector
dispatcher
entrypoint
method invocation
cursor command
```

也就是：

```txt
prompt ≈ call this action at this location
```

例如：

```txt
run @architecture.md#state-boundary/action:review
```

這時真正的 action 不在 chat prompt 裡，而在 context file 的某個 block 裡。

因此你的模式更像：

```txt
artifact = runtime.execute(context_block.inline_action)
```

而不是：

```txt
artifact = prompt(context)
```

---

## 4. Prompt 的重新定位

在這個 workflow 裡，prompt 應該被降級。

它不是主要語意載體，而是 invocation layer。

### Prompt 負責

```txt
指定 anchor
指定 action
指定 scope
指定輸出目的地
觸發 runtime
```

### Prompt 不應該負責

```txt
承載完整背景
承載長期規則
承載方法論
承載大量約束
承載 project knowledge
```

換句話說：

```txt
Prompt is not the method body.
Prompt is the method call.
```

或者：

```txt
Prompt = invocation / pointer
```

這讓 prompt 變薄，而 context / skill / inline action 變厚。

---

## 5. Context 的重新定位

在一般使用方式中，context 通常被視為 passive source。

但在你的 workflow 中，context 被升級為 active document。

它不是單純背景資料，而是：

```txt
state + local affordances
```

也就是 context block 裡可能同時包含：

```txt
facts
constraints
decision history
local problem framing
local action annotation
evaluation criteria
related references
```

因此 context 不只是模型讀取的資料，而是 action 被宣告、定位與執行的地方。

可以說：

```txt
Context is not just what the model reads.
Context is where actions are declared.
```

或更短：

```txt
Context as control surface
```

---

## 6. Inline Action 的定位

Inline action 是這套 workflow 的核心差異。

它是 colocated with context 的 local intent。

也就是：

```txt
某段 context 旁邊，直接標註這段 context 應該如何被操作。
```

Inline action 通常包含：

```txt
要做什麼
為什麼在這裡做
使用哪個 skill
關注哪些面向
避免哪些誤判
輸出格式
品質判準
```

例如：

```md
## State Boundary Design

目前我們把 server state 交給 React Query，
URL state 放在 search params，
跨頁但非 server 的狀態暫時用 Zustand。

@action review-boundary
use: skills/frontend-state-boundary-review
focus:
  - sync direction
  - lifecycle mismatch
  - reset strategy
  - cache pollution
output:
  - risks
  - better boundary
  - migration suggestion
```

這時 inline action 才是真正的 local prompt / local action。

它讓 action 和 context 不容易脫節。

---

## 7. Skill 的重新定位

在你的 workflow 中，skill 不應該只是 prompt template。

它更像：

```txt
importable method
shared procedure dependency
method library
protocol
```

也就是：

```txt
Skill = reusable method implementation
```

Inline action 可以引用 skill：

```txt
use: skills/frontend-state-boundary-review
```

此時關係變成：

```txt
context block = local state + local intent
skill = reusable method
prompt = invoke this block
```

更像程式中的：

```txt
reviewStateBoundary(contextBlock)
```

Skill 負責的是跨任務可重用的處理流程，例如：

```txt
review frontend state boundary
write ADR
critique abstraction
extract decisions
name a project
analyze API contract
```

一個好的 skill 應該包含：

```txt
purpose
applicable situations
required inputs
procedure
heuristics
anti-patterns
output contract
evaluation criteria
```

### extra

除此之外，還有最基本的 inline instruction protocol 要作為最基礎的 skill

---

## 8. Service Memory 的定位

Service memory 指的是 assistant / service 跨對話保留的長期互動脈絡。

但在這套架構中，它不應該是 project context，也不應該是 source of truth。

它比較像：

```txt
subtle behavioral prior
interaction residue
style gravity
ambient tendency
```

也就是：

```txt
Service memory = tendency
Project context = state
Inline action = intention
Skill = technique
Prompt = invocation
```

Service memory 適合影響：

```txt
回答節奏
抽象層級
是否保留不確定性
是否避免廉價鼓勵
是否知道使用者偏好 context-first framing
是否在探索型問題中慢一點
```

它不適合承擔：

```txt
repo 最新架構
文件內容
某個 action 的位置
某個 skill 的精確版本
某個專案決策的 source of truth
```

Service memory 應該低權重、可檢視、可修正、可忘記。

它像潛意識或氣質，但不能完全不可見。

---

## 9. Project Context vs Service Memory

這兩者很容易混淆，但應該分開。

### Project Context

```txt
user-owned
explicit
versionable
inspectable
source of truth
high authority
project-specific
```

例如：

```txt
README
ADR
Obsidian notes
architecture docs
inline action files
skills directory
repo docs
```

### Service Memory

```txt
service-owned or assistant-managed
subtle
cross-session
low authority
behavioral prior
style / epistemic tendency
correctable
```

例如：

```txt
使用者偏好不要太快收斂
使用者偏好理性、多角度分析
使用者在 AI workflow 中重視 context ownership
使用者不喜歡把 AI 當 silver bullet
```

因此：

```txt
Project context tells the assistant what is true here.
Service memory tells the assistant how to approach the user by default.
```

---

## 10. Tool 的定位

Tool 和 skill 也需要分開。

```txt
Skill = 教 AI 怎麼做
Tool = 讓 AI 真的能做
```

Skill 是 method。

Tool 是 capability。

例如：

```txt
Skill:
  如何 review React state boundary

Tool:
  讀取 repo 檔案
  搜尋 GitHub issue
  執行 test
  修改檔案
  產生文件
```

在 runtime 中：

```txt
skill decides procedure
tool performs IO or side effects
```

---

## 11. Calibration Discussion 的定位

Service memory 不應該主要透過 prompt 設定，而應該透過一連串自我檢視、討論與修正慢慢萃取。

也就是：

```txt
profile discovery
而不是
profile declaration
```

Calibration discussion 是一個 meta-layer，用來檢查 assistant 對使用者的長期假設。

它處理的不是任務 artifact，而是：

```txt
未來 assistant 應該如何靠近使用者的問題
```

一個 memory audit 可以包含：

```txt
current assumptions
evidence
scope
confidence
user correction
updated priors
```

例如：

```txt
假設：使用者在探索型問題中不喜歡太快收斂。
Evidence：使用者多次指出 AI 太快回答會像沒思考。
Scope：抽象、哲學、設計、AI workflow 問題。
Not scope：語法查詢、debug、快速事實問題。
Confidence：high。
```

這讓 service memory 成為可討論、可修正的 subtle prior，而不是黑箱偏誤。

---

## 12. 完整分層模型

最終可以整理成這樣：

```txt
Service Memory
  = subtle behavioral prior / interaction gravity

Project Context
  = explicit world state / source of truth

Context Block
  = local state / local problem surface

Inline Action
  = local intent colocated with context

Skill
  = reusable method / procedure library

Prompt
  = invocation / pointer / dispatcher

Tool
  = external capability / IO / side effect

Output Artifact
  = result of executing action over context through skill and tools

Feedback
  = evaluation signal that may update context, skill, or memory

Calibration Discussion
  = meta-layer for inspecting and correcting service memory
```

---

## 13. Runtime Flow

在這套架構下，一次操作可能是：

```txt
1. User invokes prompt:
   run @architecture.md#state-boundary/action:review

2. Runtime resolves anchor:
   find context block

3. Runtime reads inline action:
   determine local intent, output format, focus areas

4. Runtime imports skill:
   use frontend-state-boundary-review procedure

5. Runtime gathers relevant project context:
   related docs, decisions, code references

6. Runtime optionally uses service memory:
   adjust tone, depth, abstraction style

7. Runtime calls tools if needed:
   read files, search repo, run tests

8. Model generates artifact:
   review / ADR / patch / summary

9. Feedback updates explicit context or calibration priors
```

More formally:

```txt
artifact = runtime.execute(
  invocation = prompt,
  state = project_context + context_block,
  local_intent = inline_action,
  method = skill,
  capabilities = tools,
  priors = service_memory
)
```

---

## 14. Authority Order

當不同層發生衝突時，建議權重是：

```txt
1. Explicit current instruction
2. Inline action
3. Project context / source of truth
4. Skill procedure
5. Current conversation context
6. Service memory
7. Model general prior
```

但這不是絕對階層，而是一個原則：

> 越 explicit、越 local、越 user-owned 的資訊，權重越高。

Service memory 只能調性，不應該覆蓋 explicit context。

---

## 15. 這套分層和傳統 Prompt Engineering 的差異

傳統 prompt engineering：

```txt
prompt carries intent
context is attached material
skill is reusable prompt/SOP
memory is persistent profile
```

你的 workflow：

```txt
context carries local affordances
inline action carries intent
skill carries reusable method
prompt carries invocation
service memory carries subtle behavioral prior
```

也就是：

```txt
Prompt-centric:
  instruction → uses context

Context-centric:
  context exposes executable affordances → prompt invokes one
```

或者：

```txt
Traditional:
  prompt tells AI what to do with context

Your model:
  context declares what can be done here;
  prompt selects and invokes it
```

---

## 16. 可能的命名

這套模式可以稱為：

```txt
Context-embedded action workflow
Executable context
Context as control surface
Contextual command execution
AI document runtime
Interaction tuning + executable context
```

其中最核心的一句可能是：

> Context is not just what the model reads. Context is where actions are declared.

或者：

> Prompt is not the instruction. Prompt is the invocation.

---

## 17. 總結

這套分層的核心不是要證明 prompt、context、skill、memory 在模型內部是不同東西。

相反地，核心前提是：

```txt
在模型面前，它們幾乎都是 conditioning material。
```

真正值得設計的是它們在 human-AI workflow 中的 interface 分工。

最後收斂出的共識是：

```txt
Prompt = invocation
Inline Action = local intent
Context = explicit state + control surface
Skill = reusable method
Tool = capability
Service Memory = subtle behavioral prior
Calibration Discussion = memory correction layer
Output = artifact
Feedback = update signal
```

這不是一般 prompt engineering，而比較像：

```txt
human-AI collaboration runtime design
```

也就是設計一套讓 AI 能在明確 context、可重用 method、局部 action、低權重 behavioral prior 之間協作的操作系統。
