# Symlink 相容性與同步架構

**User:** Anonymous  
**Created:** 10/8/2026 10:43:51  
**Updated:** 10/8/2026 10:55:43  
**Exported:** 10/8/2026 14:57:00  
**Link:** [https://chatgpt.com/c/6ac70366-d62c-83ec-a5bd-d23218cdb930](https://chatgpt.com/c/6ac70366-d62c-83ec-a5bd-d23218cdb930)  

## Prompt:
10/8/2026, 10:44:26 AM

想弄個 agent agnostic 的 skills management flow。你怎麼想

## Response:
10/8/2026, 10:44:29 AM · gpt-6-thinking

我會先看目前幾個主流 agent 怎麼載入、發現和執行 skills，再從「跨工具的共同規格」與「各 agent 的適配層」來拆這個設計。

我覺得這個方向很值得做，而且**

## Prompt:
10/8/2026, 10:49:16 AM

先不跨機器吧，甚至只是要先管 global skill 而已。我需要一個 SSOT skill set 而不是東改西改

## Response:
10/8/2026, 10:49:24 AM · gpt-6-thinking

> **Searched 4 websites**
>
> 
>
> Worked for 8s

喔，那這個需求其實簡單很多，而且我覺得方向很合理 XD
　　
你要的不是一套完整的 Skills Management System，而是：

**Single Source of Truth（SSOT）+ Agent-specific Distribution**

也就是：

- 所有 global skills 只維護一份。
- Claude Code、Codex、Cursor 等 agent 都讀取同一份內容。
- 不需要同步多台電腦。
- 不需要在不同 agent 的目錄重複修改。
- 新增、修改、刪除 skill 都從同一個地方進行。

我會優先考慮 **symlink-based architecture**，而不是寫一個同步工具。

## 1. 建議的目錄結構

這裡最重要的差異是：

**不存在 sync，只有同一份檔案的多個入口。**

你修改 `~/skills/code-review/SKILL.md`，各個 agent 看到的就是修改後的內容（至少下次重新載入 skill 時）。

## 2. 但 symlink 有個相容性問題

剛查了一下，Cursor 已支援 `~/.agents/skills/` 作為 global skills 目錄。<Cite ref="turn637808search0"/>

不過 Claude Code 曾有 symlink discovery 的 regression，也有人確認特定版本可以正常使用。<Cite refs={["turn637808search5","turn637808search6"]}/>

所以我會先採用 **每個 skill 獨立 symlink** 的形式，驗證各 agent 的 discovery 行為。

例如：

如果 Claude、Codex、Cursor 都可以正常辨識，那基本上就達成你的需求了。

## 3. 如果想再做成管理 flow

我覺得只需要三個操作：

| Command | 行為 |
|---|---|
| `skills link` | 將 SSOT skills 安裝至各 agent |
| `skills list` | 列出 canonical skills 和 link 狀態 |
| `skills doctor` | 檢查 broken links、衝突與 agent discovery |

甚至不需要 DB、daemon 或 watch process。

關鍵是 `skills link` 必須具備 **idempotency**，而且不能直接覆蓋 agent 既有的 skills。

另外，我會保留各 agent 自己的 native skills，不強迫所有東西都進 SSOT。

**我的傾向是先用 shell script + symlink，只有遇到相容性問題才引入 copy-based adapter。**

這樣你真正需要維護的只有一個 `~/skills/`，其他都只是映射。

## Prompt:
10/8/2026, 10:50:35 AM

唉唉對 Symlink 有相容性問題，然後之前的嘗試是有時候可以有時候不行？

## Response:
10/8/2026, 10:50:39 AM · gpt-6-thinking

> **Searched 3 websites**
>
> 
>
> Worked for 6s

對，而且我查了一下，**不是單純「symlink 不支援」，而是不同 agent、版本、甚至 symlink 的位置，都可能影響 discovery。** 😅

幾個實際案例：

| Agent | 問題 |
|---|---|
| Claude Code | v2.1.87 可辨識，v2.1.89 有 regression，symlink 被忽略。<Cite ref="turn882343search3"/> |
| Codex | v0.98.0 無法辨識整個 `.agents/skills` 的 symlink；後續版本又有 symlink 遞迴掃描的問題。<Cite refs={["turn882343search1","turn882343search6"]}/> |
| Cursor | v2.4.21 的 global skills symlink 有問題，但有人回報 project-level symlink 正常。<Cite ref="turn882343search9"/> |

甚至 Claude Code 有案例是把 symlink 換成實體目錄後，依然無法發現 skills，最後確認根本不是 symlink 的問題。<Cite ref="turn882343search0"/>

## 所以我反而會改變架構選擇

**Canonical Source + Materialized Copies**

這跟一般 sync 最大的不同是，資料流永遠只有單向：

`SSOT → Agent`

Agent 目錄是 generated output，不應該直接修改。

只要實作：

- `skills apply`：從 SSOT 複製並更新各 agent。
- `skills diff`：檢查 SSOT 和已部署的 skill 是否不同。
- `skills doctor`：檢查目錄、版本、遺失及衝突。

`apply` 可以用 manifest 記錄自己管理的檔案，確保不覆蓋 agent 原生 skills，也不誤刪使用者自己安裝的內容。

而且這樣有一個意外的優點：

**Agent 更新導致 symlink discovery 壞掉，也不會直接破壞你的 skills management flow。**

代價只是 SSOT 修改後要再執行一次 `skills apply`。

我其實比較喜歡這個方案。因為你真正想保證的是 **只有一個編輯來源，而不是磁碟上只能存在一份檔案**。這兩件事不一樣。

## Prompt:
10/8/2026, 10:52:47 AM

我想是這樣

- 我需要有個地方可以知道目前各個 agent 有哪些 skills => 就是你的 doctor
- 我需要 apply
  - apply 可能會 by skill
  - 也需要 by agent
- diff 的確也是需要的，來確認目前手上所有的 skill 在各個 agent 有沒有變更

## Response:
10/8/2026, 10:52:52 AM · gpt-6-thinking

我覺得這樣已經可以整理成一個很清楚的 CLI 了。而且有一個關鍵：**你需要管理的不只是 skills，而是 Skill × Agent 的部署狀態。**

我會把它設計成一個很小的 declarative deployment tool，有點像簡化版的 package manager。

## 1. 核心操作

| Command | 用途 |
|---|---|
| `skills doctor` | 查看所有 agent 目前有哪些 skills，以及部署狀態 |
| `skills apply` | 將 SSOT 部署到 agent |
| `skills diff` | 比較 SSOT 與 agent 上的 skills |
| `skills list` | 查看 SSOT 有哪些 skills |

其中 `apply` 和 `diff` 都支援相同的 targeting 語法。

這樣不需要為不同操作設計多套選取邏輯。

## 2. 最重要的資料模型

我會把兩個概念分開：

- **Source inventory**：SSOT 裡面有哪些 skills。
- **Agent inventory**：每個 agent 實際有哪些 skills。

然後用兩者的差異得到 Deployment Status。

<box border radius="xl" padding={3} gap={3}>
  <text weight="medium" size="sm">Deployment Matrix（示意）</text>
  {@body const rows = [{skill:"code-review",states:["synced","synced","modified"]},{skill:"debugging",states:["synced","missing","synced"]},{skill:"architecture",states:["missing","synced","missing"]}]}
  <table>
    <table-row>
      <table-cell width="34%">Skill</table-cell>
      <table-cell>Claude</table-cell>
      <table-cell>Codex</table-cell>
      <table-cell>Cursor</table-cell>
    </table-row>
    {#each rows as r}
      <table-row>
        <table-cell><text weight="medium" size="xs">{r.skill}</text></table-cell>
        {#each r.states as s}
          <table-cell>
            <row align="center" gap={1}>
              <icon name={s==="synced"?"check-circle-2":s==="missing"?"minus-circle":"alert-circle"} color={s==="synced"?"success":s==="missing"?"tertiary":"warning"} size="xs"/>
              <text size="xs">{s}</text>
            </row>
          </table-cell>
        {/each}
      </table-row>
    {/each}
  </table>
  <caption>doctor 可以同時呈現整體狀態、agent-specific skills 與未受管理的 skills。</caption>
</box>

這裡我會特別定義幾種狀態：

| Status | 意義 |
|---|---|
| `synced` | 與 SSOT 完全一致 |
| `missing` | SSOT 有，但 agent 沒有 |
| `modified` | Agent 上內容與 SSOT 不同 |
| `unmanaged` | Agent 有，但 SSOT 沒有 |
| `conflict` | 部署目標已存在非本工具管理的同名 skill |

`unmanaged` 不等於錯誤。因為 agent 可能有自己專屬的 skills。

## 3. 我會另外加上 desired state

這點我覺得比 CLI 更值得討論。

例如你不一定希望所有 skills 都部署到所有 agents。

如此一來，`missing` 才有明確意義。

假如 `architecture` 沒有部署到 Cursor，這不應該被 doctor 視為問題，因為原本就沒有這個意圖。

## 4. Apply 與 Diff 的語義

我會要求 `diff` 是完全 read-only，而 `apply` 只根據 selected targets 執行部署。

`apply` 最好先顯示 deployment plan：

尤其當 agent 端的 skill 被修改過，`apply` 不應該直接覆蓋。至少 MVP 可以預設拒絕覆蓋 drifted copies，要求 `--force`。

另外，刪除 SSOT skill 時，是否連帶刪除 agent 端的 copy，也要單獨定義。我傾向需要 `--prune`，且只允許刪除本工具曾經部署的內容。

---

## 5. 我心目中的 MVP

我反而不會一開始做 registry、plugin system、watcher，甚至不一定需要 manifest。

如果你只要求檔案內容比較，直接使用 recursive file comparison 或 hash，就能實作大部分功能。但若要安全判斷「這份 skill 是我部署的，還是原本就存在」，就需要一個簡單的 ownership manifest。

我會把第一版範圍壓成：

- `doctor`：掃描所有來源、目標與部署狀態。
- `diff`：支援 `--skill`、`--agent`，必要時提供逐檔 diff。
- `apply`：支援相同 selector、dry-run、衝突保護。
- `config`：宣告 agent 路徑與 skill targets。
- `manifest`：只記錄 deployment ownership，不需要資料庫。

**還有一件事情我會堅持：doctor 必須顯示真實 filesystem inventory，而不是只讀 manifest。** 因為有可能有人透過 agent CLI 安裝了新 skill，或手動刪掉檔案，工具仍然應該能發現。

目前這個設計其實滿接近一個 local-only 的 GitOps：SSOT 是 desired state，agent 目錄是 actual state，`diff` 用來觀察 drift，`apply` 用來 reconcile。

但我認為有個問題會直接影響架構：**你希望 agent 上新增的 skill，能不能反向 import 回 SSOT？**

我會先不支援自動雙向同步，但保留未來的 `skills import --agent claude --skill xxx`。這可以讓整個系統一直保持單向、可預測。

## Prompt:
10/8/2026, 10:55:27 AM

我同意，但 config 我想先直接用 .env 處理就好了，我比較習慣。然後不能不要能夠反向，即使 agent 自己新增 skill，如果要作維護修改也應該複製進來。

## Response:
10/8/2026, 10:55:29 AM · gpt-6-thinking

我同意，而且這樣整個系統的規則會更簡單。

**SSOT 不只是主要來源，而是唯一允許維護的來源。**

即使 Claude 自己新增了一個 skill，它也只是存在於 Claude 的 workspace，還不算正式進入你的 skill set。

## 1. 架構定案

`.env` 只放環境相關的資訊：

這裡要注意，`~` 不一定會被 dotenv parser 展開，因此程式需要自己處理 home directory expansion。

## 2. 行為規則

| 操作 | 規則 |
|---|---|
| `doctor` | 掃描 SSOT 與所有 agent 的實際目錄 |
| `diff` | 只比較，不修改任何資料 |
| `apply` | 永遠只有 SSOT → Agent |
| Agent 新增 skill | 顯示為 `unmanaged` |
| Agent 修改 skill | 顯示為 `modified`，不能反向同步 |
| SSOT 刪除 skill | 不自動刪除 agent 上的副本 |

例如 Claude 新增了一個 `test-helper`：

你要正式維護它，就必須先手動複製到 `~/.skills/skills/test-helper`，再透過 `apply` 部署。

這樣不需要 `import` 指令，也不會有雙向同步帶來的衝突。

## 3. 我會再調整一個細節

既然你不想用 YAML config，就不應該在 `.env` 裡面塞複雜的 per-skill target 規則。

我建議第一版直接採用：

**預設所有 SSOT skills 都部署到所有已啟用的 agents。**

如果未來有些 skills 確實只適用特定 agent，再引入 target filtering。

另外，為了避免誤刪，我會保留兩個重要安全原則：

- `apply` 預設不覆蓋 unmanaged 或已被 agent 修改的檔案，除非明確指定 `--force`。
- `apply` 預設不刪除任何檔案；未來如果需要清理，再加入 `--prune`。

這樣第一版的心智模型可以濃縮成三句：

1. **SSOT 是唯一的編輯位置。**
2. **Agent directories 是部署結果，不是資料來源。**
3. **Doctor / Diff 觀察狀態，Apply 讓實際狀態接近期望狀態。**

我覺得到這裡，其實已經足夠開始實作 MVP 了。甚至可以先不做 `.state/manifest.json`，用內容 hash 做 `diff`；只是沒有 manifest 時，無法可靠區分「曾部署但被修改」與「原本就存在的同名 skill」，所以第一版遇到差異就一律保守處理，不自動覆蓋。



---
Powered by [ChatGPT Exporter](https://www.chatgptexporter.com)