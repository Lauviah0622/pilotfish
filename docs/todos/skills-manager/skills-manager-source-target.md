# Temp mode

目前預設都是吃 .env 裡面的變數嘛，我想加一個 target, source 的參數。

其實就是取代掉原本 env 的 SKILLS_SOURCE_DIR 還有各 agent 的 XXX_SKILLS_DIR。直接用指定的 target 跟 source 來處理

目的是例如我有個 repo specfic skills folder，那我不想要把某些 skill 放到整個 global，我只是想要弄到 scoped folder 這樣。這時候就會用到這個


幾個指令

doctor: 就是吃 source （所以原本顯示的 SSOT ，如果是用 --source 就要改成顯示 source）
skills diff: 比較 source 跟 target。如果 --source 就是比較 --source 跟各 agent 的差異。如果是 --target 就是比較 SSOT 跟 target 的差異，就不比 registety agent 了（可以註記一下目前的 target）

apply: 也是簡單的 source -> target
import： 直接安裝在 source 裡面


你怎麼看

> [!Comment] For Agent
> 你怎麼看

> [!Comment] For User
> 我贊成加 `--source`／`--target`，把它們定義成「只覆寫這次執行的路徑」即可；`.env` 仍提供預設值。`--source` 和 `--target` 都指向**存放 skill roots 的目錄**，不是單一 skill 目錄。
>
> - `doctor` 接受 `--source`，把輸出中的 SSOT 改標為 Source；其他 agent 的盤點仍照常顯示。先不讓 `doctor` 接受 `--target`。
> - `diff`／`apply`：未指定參數時維持 SSOT → 已啟用 agents；只有 `--source` 時是指定來源 → 已啟用 agents；只有 `--target` 時是 SSOT → 指定目標；兩者都有時是指定來源 → 指定目標。指定 `--target` 時只處理那個目錄，不再展開 agent 清單，輸出也顯示實際路徑。
> - `import --source` 匯入指定來源目錄，不自動部署；`import --target` 應視為參數錯誤。
>
> 要特別寫清楚：`apply --source ./repo-skills` **仍會部署到全域 agents**；repo scoped 的用法應同時給 `--target`，例如 `skills apply --source ./repo-skills --target ./.agents/skills --dry-run`。另外，CLI 的相對路徑以執行時的工作目錄解析；只有 `--source` 時不能先因 `.env` 缺少 `SKILLS_SOURCE_DIR` 而失敗。沿用現有的衝突保護與 `--force` 規則，並拒絕 source／target 相同或互相包含的路徑，避免覆寫來源。


> [!Comment] For Agent
> OK 那照上面的提的東西作吧

> [!Comment] For User
> 已完成：`doctor`／`diff`／`apply`／`import` 支援前述 `--source` 規則，`diff`／`apply` 也支援 `--target` 的單一目錄模式；`doctor --source` 會顯示 Source。保留既有衝突保護、`--force` 與符合已註冊 agent 目錄時的路徑規則，並拒絕 source／target 重疊及不適用的參數組合。已更新 CLI 說明與 README；skills manager 的型別檢查、lint、建置及 72 項測試皆通過。
