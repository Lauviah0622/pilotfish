# Pilotfish Development Roadmap

這份 roadmap 整理自目前的專案文件、`apps` 實作，以及 2026-10-09 的討論。它是開發順序提案，各階段以驗收條件推進，尚未承諾時程。

近期目標是讓自己每天能穩定使用，再讓其他人可以自行安裝與完成一次協作。先讓文件內的一次協作完整可靠，再把它變成容易安裝、持續維護的工具。

## 目前狀態

- VS Code 已有 block 插入、source action 補全、游標所在 block 的 action 定位，以及 invocation 複製。
- Obsidian 已有 callout 插入、游標行號 invocation 複製，以及 `build → package → deploy` 流程。
- Source 與 Markdown skills 已有各自的協定與 agent E2E 測試。
- `skills-manager` 已有 `doctor / diff / apply`、selectors、dry-run、覆寫保護與 URL archive import；目前應進入穩定化階段。
- VS Code 與 Obsidian 的功能逐漸重疊，共用的協作行為需要抽成 editor core，避免每次功能變更都維護兩份邏輯。

尚未接通的部分包括：

- 文件描述共同 `collab` router，但目前名為 `collab` 的 source skill 明確只處理非 Markdown 檔案。
- Obsidian 插入 `[!Question] For Agent`，Markdown skill 與 VS Code 使用 `[!Comment] For Agent`。
- VS Code 的 Markdown 定位仍使用辨識 source marker 的 inspector；Obsidian 則直接複製目前游標行號。
- 普通行的 invocation 與 source skill「不在 collaboration block 就找下一個 block」的規則，需要一起釐清。
- Installer 仍複製 app 層級的目錄；`--force` 是 merge copy，可能留下舊檔案。
- Obsidian 的 Apply 按鈕指向尚未提供的 skill assets。

## 階段 1：共用 Editor Core 與完整協作流程

先建立共用 editor core，再把兩個編輯器的 Markdown 行為接上同一份實作。抽象邊界與搬移順序見 [Editor Core Abstraction](todos/editor-core.md)。

- [ ] 把 VS Code 已有的純函式與測試搬進 `packages/editor-core`，先保留目前行為。
- [ ] 補上 Markdown collaboration block 定位，供 VS Code 與 Obsidian 共用。
- [ ] 共用 block 模板、協定常數與 invocation 組裝。
- [ ] 明確定義 Markdown 的 `do / ask / discuss` 表示方式，以及 pending、完成與被阻擋時的 reply 行為。
- [ ] 補齊共同 `collab` 入口，依檔案格式選擇對應的協作規則。
- [ ] 定義普通行、選取範圍與 collaboration block 的調用差異。
- [ ] 定義同一個 block 再次調用時，如何辨識新需求並保留先前結果。
- [ ] 同步 skills、編輯器模板與 protocol 文件，使用共同 fixtures 驗證各端行為。

驗收條件：source 與 Markdown 都能完成「建立 block → 複製 invocation → 正確定位 → 處理需求 → 回寫結果」。相鄰 blocks 不會互相干擾；`ask / discuss` 不修改實作；普通行的調用不會意外執行其他 block。

## 階段 2：可重現的打包與安裝

先固定三個責任：skill build 負責 source → artifact；skills-manager 負責 SSOT → agent；編輯器插件負責建立與定位協作入口。

- [ ] 建立 skill builder，發現 leaf skills、驗證名稱與必要 metadata，並產生可重現的 artifact。
- [ ] 固定安裝 layout，解決 source directory name 與 skill name 不一致的問題。
- [ ] 保留完整的 skill runtime 資源，以及 vendored skills 的來源與 license。
- [ ] 讓 installer 消費 build artifact，明確處理衝突、覆寫與舊檔案殘留。
- [ ] 接通 Obsidian 的 skill assets 與安裝入口。
- [ ] 釐清 global skills manager 與 project／vault 安裝的邊界，再決定可共用的部署能力。
- [ ] 穩定化 skills-manager，將已實作的命令、正式規格與 README 同步。
- [ ] 讓 agent E2E 使用正式 build／install artifact。

驗收條件：在乾淨環境中，依文件完成 build 與安裝後，agent 能找到並使用預期版本的 skills；升級不留下已移除的 runtime 檔案，也不修改無關 skills。

相關設計：[Skill Build Process](todos/skill-build-process.md)、[Skills Manager Specs](todos/skilles-manager/skills-manager-specs.md)。

## 階段 3：日常編輯操作

共用行為從 editor core 開始實作，各編輯器保留自己的互動方式。

- [ ] 補齊兩個編輯器在 Markdown block 內的定位與 invocation 行為。
- [ ] 提供清理已完成 collaboration block 的操作，辨識完整區塊並保留未完成要求。
- [ ] 補上檔案引用與補全。
- [ ] 依實際使用需求加入整頁 invocation、討論摘要與 callout theme。

驗收條件：常用操作不需要手動修模板、找 action 行號或整理 reply；同一份 Markdown 在兩個編輯器中有一致的協作語意。

## 階段 4：Markdown TODO 協作

TODO 可以使用較簡潔的 serialization，但 action 與 reply 的語意沿用共同協定。[Ideas](ideas.md) 已指出多個 task 執行時，行號會隨文件修改而漂移，因此這一階段需要穩定的 task ID。

- [ ] 定義 task ID 與定位規則，讓回寫不只依賴原始行號。
- [ ] 定義 checkbox、task 子項、附加脈絡與 reply 的關係。
- [ ] 完成指定單一 task 的執行流程，驗證成功後才更新 checkbox。
- [ ] 被阻擋時保留未完成狀態，留下原因與下一個需要的決定。
- [ ] 驗證插入 reply、task 搬移與行號漂移後，仍能更新原本指定的 task。
- [ ] 單一 task 流程穩定後，再擴展多個 task 的選取與執行。

驗收條件：完成「指定 task → 執行 → 驗證 → 更新 checkbox／reply」，且文件位置改變後仍可識別原 task。

## 階段 5：小規模試用與發佈準備

- [ ] 將 sample README 改成實際的安裝、設定與使用說明。
- [ ] 提供兩個最小範例：source 修改與 Markdown 討論。
- [ ] 確認正式 package 能在乾淨 checkout 中完成 build、測試與安裝。
- [ ] 整理共用 core、插件與 skills 的版本相容關係。
- [ ] 邀請少量使用者自行完成一次協作，依具體阻礙調整流程。

驗收條件：使用者可以依文件自行安裝，完成一次程式修改與一次文件討論，且成果留在正確的文件位置。

## 暫緩方向

Service memory calibration 繼續保留為設計方向，等核心協作流程穩定、累積到具體問題後，再決定要實作的能力。

Skills-manager 的 ownership manifest、prune、per-skill targeting 與跨機器同步，也依實際維護需求逐步評估。

## 本次檢查紀錄

2026-10-09 在目前工作區執行的檢查：

- VS Code typecheck 與 29 個單元測試通過；lint 仍有格式錯誤與一個 warning。
- Skills-manager build 與 23 個非 import 測試通過。
- Obsidian build 通過；lint 有 4 個 warnings，沒有 errors。
- 這次沒有重跑 agent E2E、archive import 測試或實際編輯器操作。

以上是目前工作區的檢查結果，尚未驗證乾淨安裝或正式發佈流程。
