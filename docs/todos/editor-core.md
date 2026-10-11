# Editor Core Abstraction

這份文件整理 VS Code 與 Obsidian 共用邏輯的抽象提案。目標是讓協作行為只維護一份，各 app 負責接上自己的編輯器 API。尚未開始搬移程式碼。

開發優先順序見 [Pilotfish Development Roadmap](../roadmap.md)。

## 問題與現有起點

兩個編輯器都需要建立 collaboration block、根據游標或範圍定位需求，以及產生 invocation。未來的 block 清理、摘要與 TODO 支援，也會遇到相同的重複維護問題。

目前已有可共用的基礎：

- [base.ts](../../apps/vscode/src/utils/base.ts) 定義普通的 `Position` 與 `LineTextSource`，沒有依賴 VS Code API。
- [findAgentActionLine.ts](../../apps/vscode/src/utils/locators/findAgentActionLine.ts) 只接收文字來源、游標位置與 comment syntax。
- [searcher](../../apps/vscode/src/utils/searcher/index.ts) 將逐行搜尋與內容辨識分開。
- [putTextIntoBlock.ts](../../apps/vscode/src/utils/putTextIntoBlock.ts) 負責文字序列化與縮排保留。

這些純函式適合先搬出來，沿用現有測試，再補 Markdown 的定位與共用 command 組裝。

## 抽象邊界

檔案格式與編輯器是兩個不同維度。Markdown 在 VS Code 和 Obsidian 中，應使用同一份定位與序列化邏輯；source comment 是 core 支援的另一種格式。

| 責任 | Editor core | 各 app adapter |
| --- | --- | --- |
| 協定 | action、reply、格式常數與辨識規則 | 提供設定值與操作入口 |
| 定位 | 找到 block、action、reply 與範圍 | 讀取文件、游標與 selection |
| 文字生成 | block 模板、縮排、invocation 字串 | 將文字插入文件或複製到剪貼簿 |
| 編輯結果 | 回傳文字、range 與建議游標位置 | 使用編輯器 API 套用結果與 undo |
| 互動 | 提供可用的 action 與內容資料 | 命令註冊、快捷鍵、補全 UI、通知 |
| 設定與部署 | 接收必要的明確輸入 | 設定頁、plugin lifecycle、安裝與部署 |

Core 使用普通 TypeScript 資料與函式，不依賴 `vscode`、`obsidian`、DOM、剪貼簿或 Node filesystem API。它接收文字與位置，回傳計算結果。

插件內保留很薄的接線程式，負責取得輸入與套用輸出。VS Code 的多游標與 Obsidian 的特定 UI 行為，仍由各自的 adapter 處理。

## 目錄提案

```text
packages/editor-core/
  src/
    protocol/       action、reply 與格式規則
    locators/       collaboration block 與 action 定位
    serializers/    source comment 與 Markdown callout 文字生成
    invocation/     block、行或範圍的 command 組裝
    types.ts        文字來源、位置、range 與結果型別
  tests/            共用行為與 fixtures

apps/vscode/                    VS Code adapter
apps/obsidian-pilotfish-plugin/  Obsidian adapter
```

這是責任分區的提案，實作時依檔案數量調整，先沿用現有搜尋與 serializer 結構。第一版只需一個 repo 內部共用模組。

兩邊已使用 esbuild；build 時把 core 一起包進各自的產物，使用者不需要額外安裝 core。實作時再選擇 local package 的引用方式，並確認 TypeScript 與 esbuild 都能解析同一個入口。

## 最小輸入與輸出

沿用目前已存在的最小文字介面：

```ts
type Position = {
  line: number;
  character: number;
};

type LineTextSource = {
  lineCount: number;
  getLine: (line: number) => string;
};
```

VS Code 可以把 `document.lineAt(line).text` 接成 `getLine()`；Obsidian 可以使用 `editor.getLine(line)`。Core 只依賴這個介面。

內部位置統一使用 zero-based line／character；產生對外的 `file:line` invocation 時，再統一轉成 one-based line。Adapter 負責將編輯器自己的位置型別轉成普通資料。

文字生成可以回傳插入文字與相對游標位置。未來清理 block 時，可以回傳 edit range；實際寫入與 undo 由 adapter 執行。先依目前功能需要定義結果型別，避免提前建立完整的通用 editor interface。

## 兩個操作範例

### 複製協作指令

1. Adapter 取得文件、檔案路徑、格式、游標、selection 與 prefix 設定。
2. Core 判斷目前目標是 collaboration block、普通行或選取範圍。
3. Core 組出 invocation 字串。
4. Adapter 寫入剪貼簿並顯示通知。

路徑相對於 workspace 或 vault 的解析由 adapter 處理；prefix 分隔與行號格式由 core 統一處理。

### 插入 Collaboration Block

1. Adapter 取得插入位置、所在行的縮排與檔案格式。
2. Core 產生合法的 block 文字與建議游標位置。
3. Adapter 使用自己的編輯 API 插入文字並移動游標。
4. Adapter 視編輯器能力觸發 action 補全。

Markdown 與 source comment 使用不同 serialization，但共享 action 與 reply 的語意。

## Core、Skill 與 Protocol 的關係

- Collaboration protocol 定義共同的 action、reply 與定位契約。
- Editor core 是插件執行的 TypeScript 實作，協助建立、定位與整理 collaboration block。
- Collab skill 是 agent 讀取的文字契約，規範如何找到需求、執行 action 與回寫結果。
- App adapter 接上編輯器 API，提供使用者操作入口。

抽出 core 可以消除兩個插件之間的重複邏輯；skill 與程式實作的一致性仍需要共同範例與 contract tests 維護。第一版先固定 canonical format 與 fixtures，之後有明確需求再評估產生文件或 metadata 的流程。

## 漸進搬移順序

1. 搬移現有純函式、型別、protocol constants 與測試，讓 VS Code 改用 core，先保留目前行為。
2. 在 core 補上 Markdown callout locator，讓 VS Code 與 Obsidian 共用。
3. 共用 block template 與 invocation 組裝，統一兩個編輯器的 Markdown 格式與 prefix 處理。
4. 明確定義普通行、selection、重複調用與 reply lifecycle，再同步 skills 和文件。
5. 後續 block 清理、TODO 定位等共用功能，從 core 開始實作。

先抽出現有能力，再補一致性。每一步都能使用既有插件驗證，避免一次搬移所有 UI 與設定邏輯。

## 測試邊界

共用行為的測試搬進 core，涵蓋：

- 游標在 action、內容與 reply 裡的定位。
- 相鄰 blocks、comment 邊界與非 comment 行，避免定位跨越目標。
- Markdown callout、source block comment 與連續 line comments。
- 縮排、插入文字與建議游標位置。
- 單行、selection 與 block invocation，以及 zero-based 到 one-based 的轉換。

各插件只保留必要的 adapter 驗證：輸入的文字、位置與設定是否正確傳入 core，以及結果是否正確套回編輯器。

Agent E2E 另外驗證 skill 的 action 與回寫行為，包括保留使用者要求、`ask / discuss` 不修改實作，以及被阻擋時留下正確狀態。

## 待定與第一批範圍

需要在實作過程中定下來的項目：

- Markdown 是否明示 action，以及 canonical callout 的最終格式。
- 普通行或 selection 如何表達直接回答，避免與尋找下一個 collaboration block 的規則混淆。
- 完整 collaboration block 的邊界，尤其是 Markdown 分開的 action／reply blocks。
- 共同 `collab` router 與格式專屬 skills 的安裝、命名關係。
- Local package 的引用、typecheck 與 build 方式。

第一批範圍是抽出 editor core，並接通兩邊的 Markdown 插入與定位。完成後再擴展日常操作與 TODO 支援。
