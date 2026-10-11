# Skills Manager Specs

這份文件整理自 [[skills-manager-brainstorming]]，定義第一版 local-only global skills manager 的需求。

## 目標

建立一個 agent-agnostic 的 CLI，讓使用者只在一個 canonical repository 維護 global skill roots，再將 roots 部署到本機各 agent 的 global skills directory。

核心心智模型：

1. SSOT 是唯一允許維護 skill 的位置。
2. Agent skills directory 是部署結果，不是資料來源。
3. `doctor` 與 `diff` 用來觀察 actual state，`apply` 用來讓 actual state 接近 desired state。

## MVP 範圍

- 只管理同一台電腦上的 global skills。
- 使用 canonical source 加 materialized copies，不使用 symlink。
- 透過 `.env` 設定 SSOT 與 agent skills directories。
- 預設將所有 SSOT skill roots 部署到所有已啟用的 agents，保留每個 root 以下的目錄結構。
- 提供 `doctor`、`diff` 與 `apply`。
- 既有 `import` 可把包含一個或多個巢狀 skills 的 archive directory 放進 SSOT，作為單一 skill root。
- `diff` 與 `apply` 都能依 skill root 或 agent 縮小範圍。
- 所有部署都是單向的：SSOT → Agent。

## 非目標

第一版不處理：

- 跨機器同步。
- daemon、watch mode 或自動背景同步。
- agent → SSOT 的反向同步或自動 import。
- per-skill deployment rules。
- registry、plugin system 或資料庫。
- 自動刪除 agent directory 中的 skills。
- 驗證 agent runtime 是否真的成功載入 skill；MVP 只檢查 filesystem state。

Agent 自己新增的 skill 仍可存在。若要納入長期維護，使用者必須先手動複製到 SSOT，之後再透過 `apply` 部署。

## 名詞

- **SSOT**：canonical repository root，也是唯一允許編輯與維護 skills 的位置。
- **Skill root**：SSOT 的直接子目錄；`doctor`、`diff`、`apply` 的管理單位，內含一個或多個 skills。
- **Skill**：skill root 內包含 `SKILL.md` 的目錄；skill root 本身也可以是一個 skill。
- **Source inventory**：SSOT 中實際存在的 skill roots 及其內部 skills。
- **Agent inventory**：各 agent global skills directory 中實際存在的 skill roots 及其內部 skills。
- **Desired state**：所有 SSOT skill roots 都存在於所有已啟用的 agents，且整個 root 的內容與目錄結構一致。
- **Actual state**：直接掃描 filesystem 得到的目前狀態。
- **Deployment target**：一組 `skill root × agent`。

## 目錄模型

```text
<SSOT>/
├── code-review/                  # skill root，也是 skill
│   └── SKILL.md
└── obsidian/                     # skill root，內有兩個 skills
    ├── README.md
    └── skills/
        ├── obsidian-markdown/
        │   └── SKILL.md
        └── json-canvas/
            └── SKILL.md

<CLAUDE_SKILLS_DIR>/
├── code-review/
│   └── SKILL.md
└── obsidian/
    ├── README.md
    └── skills/
        ├── obsidian-markdown/SKILL.md
        └── json-canvas/SKILL.md

<CODEX_SKILLS_DIR>/
├── code-review/
│   └── SKILL.md
└── obsidian/
    ├── README.md
    └── skills/
        ├── obsidian-markdown/SKILL.md
        └── json-canvas/SKILL.md
```

SSOT 與 agent directory 的直接子目錄各代表一個 skill root。MVP 以直接子目錄的名稱作為 root identifier，在 root 內遞迴尋找 `SKILL.md`；包含 `SKILL.md` 的目錄才算 skill。`apply` 完整複製 root 到 `<AGENT_SKILLS_DIR>/<root-name>`，不攤平內部 skills；`diff` 比較整個 root。

掃描 root 列表時遵循 SSOT／agent directory 頂層的 `.gitignore`，且一律略過 `.git/`。root 內的檔案則依該 root 的 `.gitignore` 計算 inventory 與 diff。

MVP 的 filesystem 檢查不保證每個 agent 都能在 runtime 發現巢狀 skills。各 agent 的實際 discovery 行為需另行驗證。

## 設定

設定先使用 `.env`，只放與本機環境有關的路徑：

```dotenv
SKILLS_SOURCE_DIR=~/.skills/skills
CLAUDE_SKILLS_DIR=~/.claude/skills
CODEX_SKILLS_DIR=~/.codex/skills
CURSOR_SKILLS_DIR=~/.cursor/skills
```

規則：

- `SKILLS_SOURCE_DIR` 必填。
- 有設定 skills directory 的 agent 才視為 enabled。
- 程式必須自行展開路徑開頭的 `~`；不能假設 dotenv parser 會處理。
- 相對路徑以 `.env` 所在目錄為基準解析。
- agent ID 與 skills directory、scan exclude、write deny 的環境變數名稱，集中由靜態 `AgentDefinition` registry 明確定義；目前包含 `claude`、`codex`、`cursor`。
- `.env` 只決定已註冊 agent 的啟用、路徑與規則，不再透過任意 `<NAME>_SKILLS_DIR` 自動註冊 agent；未註冊的變數略過。新增 agent 需在 registry 加入定義並重新建置。
- `.env` 不承載 per-skill targeting 或其他巢狀設定。
- 缺少或無法讀取 SSOT 時，所有命令都應明確失敗。
- agent directory 不存在時，read-only command 將它視為空 inventory；`apply` 可在 deployment plan 中列出待建立的目錄。

## Target selection

`diff` 與 `apply` 使用相同的 selector：

```sh
skills diff
skills diff --root code-review
skills diff --agent claude
skills diff --root obsidian --agent claude

skills apply
skills apply --root code-review
skills apply --agent claude
skills apply --root obsidian --agent claude
```

- 沒有 selector：選取所有 SSOT skill roots × 所有 enabled agents。
- 只有 `--root`：選取該 root × 所有 enabled agents。
- 只有 `--agent`：選取所有 SSOT skill roots × 該 agent。
- 同時指定：只選取該 root × 該 agent。
- `--skill` 保留為 `--root` 的相容別名；它選取整個 root，不選取單一巢狀 skill。
- 指定不存在的 SSOT root 或未啟用的 agent 時，命令應失敗，不能靜默忽略。

MVP 每種 selector 只接受一個值。多值或重複 flag 可以留到後續版本。

## Deployment status

`doctor` 與 `diff` 必須根據實際 filesystem inventory 計算狀態，不能只依賴快取或設定檔。

| Status | 條件 | 是否異常 |
|---|---|---|
| `synced` | SSOT 與 agent 都有同名 root，且完整內容一致 | 否 |
| `missing` | SSOT 有 root，但 agent 沒有 | 是 |
| `different` | SSOT 與 agent 都有同名 root，但內容不同 | 是 |
| `unmanaged` | agent 有 root，但 SSOT 沒有 | 否 |

MVP 不使用 ownership manifest，因此無法可靠區分：

- 本工具曾部署、後來在 agent 端被修改的 `modified` root。
- agent 原本就有、恰好與 SSOT 同名的 `conflict` root。

兩者在第一版一律呈現為 `different`，並採取相同的保守覆寫規則。未來若加入 ownership manifest，才能把它們拆成獨立狀態。

內容一致的定義：

- 遞迴比較兩邊的相對檔案路徑集合。
- 比較每個檔案的 bytes 或由 bytes 產生的 hash。
- 任一方多出、缺少或修改檔案，都視為 `different`。
- directory mtime、檔案 mtime 與檔案排列順序不參與比較。

## `skills doctor`

用途：提供 SSOT 與所有 enabled agents 的整體 inventory 和 deployment status。

最低輸出需求：

- SSOT path 與每個 agent path。
- 找到的 source roots 與各 root 內的 skills。
- 每個 agent 實際存在的 roots。
- `skill root × agent` deployment matrix。
- `missing`、`different` 與 `unmanaged` 的摘要數量。
- 不可讀路徑、無效 skill root 或其他診斷訊息。

`doctor` 必須是 read-only，不建立目錄、不複製檔案，也不修復狀態。

`unmanaged` 只代表該 root 不在 SSOT，不應自動當成錯誤或建議刪除。

## `skills diff`

用途：比較 SSOT 與選取的 agent targets，不修改任何內容。

行為：

- 使用共同 selector 縮小比較範圍。
- 對每個 target 顯示 `synced`、`missing` 或 `different`。
- `different` 時列出新增、刪除與修改的相對檔案。
- 提供可讀的逐檔 textual diff；binary file 至少要標示為 binary difference。
- 所有 output ordering 必須 deterministic：先依 agent，再依 skill root 與相對路徑排序。

`diff` 不需要把 agent-only `unmanaged` roots 納入預設 target，因為 selector 的 root universe 來自 SSOT；整體 unmanaged inventory 由 `doctor` 負責呈現。

## `skills apply`

用途：將選取的 SSOT skill roots 複製到 agent directories，保留每個 root 以下的完整目錄結構。

### 基本流程

1. 解析設定與 selectors。
2. 掃描 SSOT 與 selected agent directories。
3. 產生 deployment plan。
4. 在寫入前顯示 plan。
5. 對允許的 targets 執行 materialized copy。
6. 重新比較完成後的 target，確認結果為 `synced`。

### 預設規則

- `missing`：允許部署。
- `synced`：不寫入，回報 no-op。
- `different`：拒絕覆寫該 target，除非使用者明確傳入 `--force`。
- `unmanaged`：不在預設 deployment targets 中，不修改也不刪除。
- 不刪除任何未被選取的 root 或 agent-only root。
- 同一次 apply 中一個 target 的衝突，不得造成其他衝突 target 被覆寫。

### Flags

```sh
skills apply --dry-run
skills apply --force
```

- `--dry-run`：完整產生並顯示 plan，但不建立目錄或寫入檔案。
- `--force`：允許以 SSOT 完整取代 `different` target。

`--force` 的作用域只限 selected deployment targets，不能刪除整個 agent skills directory 或修改其他 roots。

### 寫入安全

- 先將單一 skill root 複製到同一 filesystem 上的 staging directory。
- staging 完成並通過基本驗證後，才替換 target root directory。
- target 原本不存在時，將驗證完成的 staging directory 移入 target path。
- target 已存在且為 `different` 時，只能在 `--force` 下替換。
- 失敗時應保留原 target，並清理未完成的 staging content。
- 不透過 unresolved glob 或未展開的環境變數決定刪除範圍。

## `skills import`

從 archive 匯入時，選定的目錄成為一個 SSOT skill root。該目錄只需在任一深度包含至少一個 `SKILL.md`，不要求頂層有 `SKILL.md`；使用 `--subdir` 可選取 archive 中較小的目錄。匯入後仍需執行 `apply` 才會部署到 agents。

## Skill validity

MVP 至少檢查：

- skill root 是 SSOT 或 agent skills directory 下的直接子目錄。
- root 內至少有一個包含可讀取 `SKILL.md` 的目錄；root 本身可以包含 `SKILL.md`。
- root name 可安全作為單一 directory name，不能包含 path traversal。

無效的 source root 必須使 `diff` 與 `apply` 失敗；`doctor` 則應列出診斷並繼續掃描其他可讀項目。

第一版不需要完整驗證 Agent Skills frontmatter schema；這可與未來的 build/validation flow 整合。

## Exit status

CLI 應提供適合 script 使用的 exit status：

| Exit code | 意義 |
|---|---|
| `0` | 命令成功，且沒有需要處理的 drift |
| `1` | 命令成功，但發現 `missing`、`different` 或 apply conflict |
| `2` | 設定、參數、I/O 或其他執行錯誤 |

`doctor` 中單純存在 `unmanaged` root 不應造成 exit code `1`。

## 驗收條件

### Inventory 與狀態

- SSOT 有、agent 無的 root 顯示為 `missing`。
- 兩邊完整一致的 root 顯示為 `synced`。
- 任一檔案新增、刪除或內容改變時顯示為 `different`。
- agent-only root 顯示為 `unmanaged`，且不被視為錯誤。
- agent directory 不存在時，`doctor` 仍能呈現該 agent 的 missing state。
- 一個 root 內有多個巢狀 `SKILL.md` 時，`doctor` 列出所有 skills，但部署狀態仍以 root 為單位。

### Selectors

- `--root` 只影響指定 root；`--skill` 相容別名具有相同行為。
- `--agent` 只影響指定 agent。
- 同時使用時只影響唯一交集 target。
- 不存在的 root 或 disabled agent 會回報明確錯誤。

### Apply safety

- `apply` 可將 `missing` root 部署成 `synced`，且保留內部巢狀路徑與非 `SKILL.md` 檔案。
- 重複執行相同 `apply` 是 no-op，具備 idempotency。
- 預設不覆寫 `different` target。
- `--force` 只替換 selected `different` targets。
- agent-only roots 不會被修改或刪除。
- `--dry-run` 不產生任何 filesystem change。
- 複製或驗證失敗時，不留下半套 target。

### Read-only guarantees

- `doctor` 與 `diff` 執行前後的 filesystem 內容完全不變。
- `diff` 能穩定列出 modified、added 與 removed files。

## 後續版本候選

- Ownership manifest：區分 `modified` 與 `conflict`，並記錄本工具部署過的內容。
- `--prune`：只刪除 manifest 證明由本工具管理、但已不在 desired state 的 skills。
- Per-root agent targeting。
- `skills list`：若需要比 `doctor` 更精簡的 source inventory view 再加入。
- 外部來源版本追蹤與自動更新；目前可手動複製或使用 archive `import` 納入 SSOT。
- Agent discovery/runtime checks。
- 多值 selectors、machine-readable output 與 CI integration。

## 尚待決定

- `.env` 的預設搜尋位置，以及是否允許 `--env-file`。
    - 不允許
- CLI package 與 executable 的正式名稱。
- `diff` 的預設詳細程度，以及是否另外提供 `--summary` 或 `--stat`。
    - 可以，
- Apply 遇到部分 target 衝突時，是繼續處理其他安全 target，還是整批停止。無論採哪一種，都不能覆寫衝突 target。
    - 每個 skill root × agent target 獨立處理。
- `--force` 替換 target 時是否保留可復原的 backup。
     - 不用
- 是否忽略 `.DS_Store` 等非 skill runtime 檔案；若要忽略，doctor、diff 與 apply 必須共用同一套規則。
    - 依照 gitignore 走

## 技術選型

- source code：使用 typescript，然後利用 esbuild 打包
- 整包 compile 成加上 shebang 的單一可執行 JS
