# Skill Build Process

> [!Comment] For Agent
> 我想要幫 editor-skills / obsidian-skilles 作一個 build scripts，你怎麼想。因為目前的 ./scripts/install 有點太簡略，好像需要一個比較完整的設計

> [!Comment] For User
> 我贊成做 build script。我會把 build 定義成「找出、驗證並封裝 skills」，install 則只處理「將 build artifact 安裝到目標」。下面先是 working proposal，不是已經拍板的規格；我們可以先確定輸出結構和 install 的覆寫語意，再開始實作。

## 目前看到的問題

- `scripts/install.js` 同時在做 source discovery、artifact assembly 與 installation，邊界不清楚。
- 現在先從 `agents/skills/*` symlink 複製整個 app，再刪除 `skills` 以外的內容。這使 installer 必須知道 source tree 的組織方式。
- `--force` 目前實際上是 merge copy，同名檔案會被覆寫，但新版已刪除的舊檔案會殘留。
- 現有 editor/Obsidian E2E tests 是直接把單一 source skill 複製到 `.agents/skills/<skill-name>`，沒有驗證正式 build/install 出來的結構。
- `editor-commands-protocal/SKILL.md` 的 `name` 是 `collab`；[Agent Skills specification](https://agentskills.io/specification) 要求 `name` 與直接父目錄同名，所以 canonical source 本身也需要整理，不應由 builder 悄悄改名掩蓋。

## 我建議的邊界

```text
apps/*/skills
    │
    ▼
build-skills.js
discover → validate → package → manifest
    │
    ▼
dist/<app>/skills/<skill-name>
    │
    ▼
install.js
stage → conflict check → install → record ownership
    │
    ▼
<target>/skills/<skill-name>
```

### Build 負責的事

- 從 `apps/editor-skills/skills` 與 `apps/obsidian-skills/skills` 遞迴找出含 `SKILL.md` 的 skill directory。
- 驗證 `name`、`description`、目錄名稱、重複 skill name 與不安全的 symlink。
- 複製完整 skill directory，包含 `scripts/`、`references/`、`assets/` 與其他 skill runtime 需要的檔案。
- 排除 `.DS_Store`、tests、package metadata 和 generic Agent Skills artifact 不需要的 plugin metadata。
- 產生 deterministic `manifest.json`，記錄 app、skill name、source、output 與被納入的檔案。
- 對 vendored `obsidian-skills` 保留 upstream 版本、來源與 license，不能因為只擷取 leaf skills 就丟掉這些資訊。

### Install 負責的事

- 只讀取 `dist` artifact，不再理解 `apps/` 或 `agents/` 的 source layout。
- 支援安裝全部 app 或單一 app。
- 先安裝到 staging directory，驗證成功後才替換目標 skill。
- 預設遇到同名 skill 就停止，不覆寫使用者自己的內容。
- `--force` 只替換本次 artifact 管理的 skill，不刪除整個 `.agents`、`.claude` 或 `skills` directory。
- 在目標端記錄 Pilotfish 擁有的安裝檔案，讓之後升級可以安全清掉 stale files。

## 預期輸出

```text
dist/
├── editor-skills/
│   ├── skills/
│   │   └── collab/
│   └── manifest.json
└── obsidian-skills/
    ├── skills/
    │   ├── markdown-comment-protocol/
    │   ├── markdown-file-feedback/
    │   ├── obsidian-markdown/
    │   └── ...
    ├── licenses/
    └── manifest.json
```

`dist/<app>` 是可獨立發佈的 app artifact；installer 在安裝全部 app 時，再把各 app 的 `skills` 合併到目標。合併時必須做全局名稱衝突檢查。

## Script 介面草案

repo 目前沒有 root `package.json`，所以第一版不需要先引入 monorepo framework。可以使用一支共用 builder，各 app 的 package script 只當薄薄的入口。

```json
{
  "scripts": {
    "build": "node ../../scripts/build-skills.js --app editor-skills",
    "test": "node tests/test.js"
  }
}
```

```sh
node scripts/build-skills.js
node scripts/build-skills.js --app editor-skills
node scripts/install.js --target /project/.agents
node scripts/install.js --target /project/.agents --app obsidian-skills
```

## 測試邊界

Build tests 不需要啟動 agent，應該可以快速、deterministic 地驗證：

- recursive discovery
- required frontmatter
- skill name 與 directory name 一致
- duplicate skill name 失敗
- `scripts/`、`references/`、`assets/` 被完整複製
- 無關檔案被排除
- manifest 內容可重現

Install integration tests 使用 temporary directory 驗證：

- full install 與 single-app install
- 同名衝突預設失敗
- `--force` 只替換被管理的 skill
- 舊版殘留檔案會被清除
- target 中無關的 skill 不會被修改

現有 Codex E2E tests 另外保留，但改為使用 build artifact，這樣才會同時驗證實際發佈結構。

## 建議實作順序

1. 先將 `editor-commands-protocal` 改成與 frontmatter 一致的 `collab`。
2. 實作 `build-skills.js`、structural validation 與 manifest。
3. 補 build tests，並讓現有 E2E tests 改吃 artifact。
4. 重寫 `install.js` 使其只消費 artifact。
5. 補 install integration tests 與舊版 layout migration。

## 還需要一起決定

- 最終安裝 layout 要不要統一成 `<target>/skills/<skill-name>`？這和現在 tests 相同，也比 app 外層嵌套更 portable，但是會改變現有 installer 的輸出。
- `install.js` 應該嚴格要求先 build，還是在 repo 開發模式中自動呼叫 builder？
- app-level manifest 是否已足夠，還是需要一份合併後的 root manifest？
- vendored `obsidian-skills` 未來要繼續直接放在 source tree，還是另外建立 upstream lock/update 流程？
- 舊版 `<target>/skills/<app>/skills/...` layout 要自動 migration，還是只提供明確的一次性 migration command？



幾個定位
- agents: 這個應該要是其他的專案，甚至是自己專案可以直接 install 的東西，然後想想這不應該進 git？這算是另一種打包的 build 的概念（甚至是個 temp）
- .agents, .claude: 這個是 codex, claude 要吃的東西，因為目前用 symlink 很多 skill 抓不到。所以就是要複製 agents 的東西進來
- 每個