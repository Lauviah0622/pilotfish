# Service Memory Calibration

## 1. 核心問題

在 AI workflow 中，`prompt`、`context`、`skill`、`memory` 這些概念表面上有不同名稱，但對模型本身來說，它們最後都會被轉成 token，進入同一個模型序列，成為 conditioning material。

因此，真正重要的差異不在於模型是否把它們視為不同種類，而在於人類與系統如何設計這些 interface：

* 誰負責維護？
* 何時注入？
* 作用範圍多大？
* 是否可重用？
* 是否可檢視與修正？
* 它應該是明確指令，還是 subtle prior？

在這個框架下，`service memory` 不應該被視為另一種 project context，也不應該被當成穩定知識庫。它更接近一種由長期互動沉澱出的行為傾向。

---

## 2. Service Memory 的定位

Service memory 可以理解為：

> 由服務或 assistant 在跨對話中保留的長期互動脈絡，用來影響回答風格、判斷節奏、關注點與預設行為。

但在更細緻的 workflow 裡，它不應該是主要的 source of truth。

比較準確的定位是：

```txt
Service memory = subtle behavioral prior
Project context = explicit source of truth
Inline action = local intentional instruction
Skill = reusable method
Prompt = invocation / pointer
```

也就是：

```txt
memory = tendency
context = state
action = intention
skill = technique
prompt = invocation
```

---

## 3. Service Memory 不應該是什麼

Service memory 不適合承擔以下角色：

### 3.1 不應該是專案知識庫

不適合記：

```txt
某個 repo 的最新架構
某個 skill 的精確內容
某段 inline action 的位置
某個功能目前採用 Zustand 還是 React Query
某個文件第幾行有什麼指令
```

這些應該存在 user-owned 的 project context 裡，例如：

```txt
repo
Obsidian vault
Markdown docs
ADR
README
skills directory
inline action annotations
```

### 3.2 不應該是硬性的 system prompt

如果 service memory 被寫成：

```txt
以後你都要用理性、多角度、批判的方式回答我。
```

它會變得太像角色設定或永續 prompt。

這種形式的問題是：

* 過度明示
* 容易僵化
* 容易把局部偏好泛化成永久人格
* 可能與當下明確 context 衝突
* 讓 AI 看起來像是在套模板，而不是自然理解使用者

### 3.3 不應該壓過 explicit context

權重順序應該大致是：

```txt
Inline action / explicit context
> current task instruction
> skill
> current conversation context
> service memory
> model pretraining habit
```

如果 service memory 與當下明確 context 衝突，應該永遠是 explicit context 贏。

---

## 4. Service Memory 比較像什麼

Service memory 比較像：

```txt
ambient prior
interaction residue
style gravity
behavioral bias
subconscious-like tendency
```

它不是直接告訴模型「現在做 X」。它比較像讓模型在面對多種可能回答時，微微偏向某種互動方式。

例如：

```txt
在探索性問題中，不要太快收斂。
在抽象問題中，先定位概念邊界，再給結論。
不要過度使用鼓勵式語氣。
當使用者修正抽象層級時，不要只回答表面內容。
當使用者討論 AI workflow 時，優先考慮 interface、lifecycle、ownership boundary。
```

這些不是任務指令，而是互動傾向。

---

## 5. 為什麼它像「潛意識」

Service memory 像潛意識，不是因為它真的有心理意義，而是因為它的作用方式更接近：

```txt
不直接決定答案
但影響答案靠近問題的方式
```

它影響的是：

* 回答節奏
* 抽象層級
* 是否保留不確定性
* 是否先展開或先收斂
* 對哪些偏差比較敏感
* 如何理解使用者的修正
* 什麼情況下要避免模板化回答

它不應該成為一組硬規則，而是長期互動中形成的 subtle behavioral pattern。

---

## 6. Service Memory 仍然需要可檢視與可修正

雖然 service memory 可以像潛意識一樣 subtle，但不能完全不可見。

如果完全不可見，會產生風險：

```txt
AI 以為自己懂使用者
AI 把舊印象套到新情境
AI 把短期狀態誤認成長期偏好
AI 把局部話題人格化
AI 用錯誤 prior 干擾 explicit context
```

所以理想的 service memory 應該是：

```txt
not primary-controlled,
but inspectable / correctable / forgettable
```

也就是：

* 平常不需要手動維護
* 不作為主要知識來源
* 但必要時可以檢查
* 可以修正
* 可以降權
* 可以忘記

---

## 7. Service Memory 不應該用 prompt 方式初始化

一個重要觀察是：

> Service memory 如果用 prompt 形式硬塞，它會比較像角色設定；但如果它來自長期互動與自我檢視，它才比較像氣質。

不好的方式：

```txt
請記住：我是一個理性、批判、context-first 的人。以後都要用這種方式回答我。
```

比較好的方式：

```txt
透過一組問答、修正、反例與討論，萃取出使用者的思考節奏、品質判準、抽象偏好與互動反感點。
```

也就是：

```txt
profile discovery
而不是
profile declaration
```

---

## 8. Service Memory 的三層來源

Service memory 可以從三層訊號形成。

### 8.1 Declared Preference

使用者明確說出的偏好。

例如：

```txt
我不喜歡太快收斂。
我偏好理性、多角度分析。
我不喜歡太鼓勵式的語氣。
我希望探索型問題可以慢一點。
```

這是最表層，也最容易被直接記下來。

---

### 8.2 Revealed Preference

使用者在互動中顯現的偏好。

例如：

```txt
使用者常常修正 assistant 的抽象定位。
使用者不滿意一般化答案，會要求重新切 interface boundary。
使用者在 AI workflow 問題上，重視 context ownership 勝過 prompt 技巧。
使用者會把表面分類推向 lifecycle、runtime、control surface 層次。
```

這比 declared preference 更接近真實互動模式。

---

### 8.3 Epistemic Style

更深層的是使用者理解問題的方式。

例如：

```txt
使用者傾向把問題視為系統裡的 boundary / lifecycle / control surface 問題。
使用者喜歡從一般用法往下挖到 interface 定位。
使用者對「只是分類」不滿，會追問這個分類在實際 workflow 中如何運作。
使用者傾向將模糊概念重新轉成 architecture 或 runtime design。
```

這一層最接近「氣質」。

---

## 9. Calibration：不是設定，而是討論

Service memory 的校正不應該像設定頁：

```txt
語氣：理性
長度：中等
風格：批判
```

這種設定太扁平，無法表達真正的 interaction style。

比較好的方式是定期做一場 meta-discussion：

```txt
最近我們的互動裡，我似乎形成了幾個對你的假設：

1. 你偏好先展開抽象邊界，再收斂到實作。
2. 你不喜歡太快把模糊問題整理成標準答案。
3. 你在 AI workflow 問題上，重視 context ownership 勝過 prompt 技巧。
4. 你希望我在探索性問題中保留 uncertainty，而不是裝作很確定。

你覺得哪些是準的？
哪些已經過時？
哪些只是某一段時間的狀態？
哪些不應該被過度套用？
```

這不是設定，而是共同檢視 assistant 對使用者的 self-model。

---

## 10. Memory Audit 的重點

Memory audit 不只是確認「AI 記得對不對」。

更重要的是確認：

```txt
這個假設作用範圍多大？
它是不是過度泛化？
它是不是已經過時？
它的權重應該高還是低？
它是否會干擾 explicit context？
```

特別重要的是：

> service memory 最危險的不是記錯，而是把局部狀態人格化。

例如：

```txt
使用者最近常討論 relationship
```

不代表：

```txt
使用者所有問題都應該被 relationship lens 解讀
```

又例如：

```txt
使用者最近常討論 AI workflow
```

不代表：

```txt
所有工程問題都要被拉回 AI workflow 哲學
```

所以 memory audit 需要檢查 assumption 的 scope。

---

## 11. Suggested Memory Calibrat
