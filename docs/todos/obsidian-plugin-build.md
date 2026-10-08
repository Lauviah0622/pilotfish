

> [!Comment] For Agent
> 我要幫 apps/obsidian-pilotfish-plugin 弄個簡單的 build process，你怎麼看？

> [!Comment] For User
> 我會沿用現有的 esbuild，不另外引入 monorepo framework。第一版只要把 `dev` 與 `build` 分清楚：`dev` 繼續 watch 並產生 app root 的 `main.js`；`build` 則先 typecheck，再清空並建立 `dist/obsidian-pilotfish-plugin/`，放入 production `main.js`、`manifest.json`、`styles.css` 與 `assets/`。這個資料夾應該可以直接複製到 vault 的 `.obsidian/plugins/`。
>
> 我也會把「安裝到 vault」留成另一個 `deploy` 指令，不讓 build 依賴個人 vault 路徑。現在的 `build.sh` 會刪掉 app root 的 `assets/` 再複製，產物仍散在 source tree；建議改成一支小型、跨平台的 `build.mjs`，統一 bundle 與靜態檔案複製。先做到這裡就夠了，暫時不加 zip、GitHub Release 或複雜 manifest。若這個邊界符合你的需求，下一步就可以直接整理 scripts 與輸出結構。



> [!Comment] For Agent
> 你怎麼看上面的規劃

> [!Comment] For User
> 整體上我贊成，這個範圍就夠了：用 esbuild 將 `src/main.ts` bundle 成 `dist/obsidian-pilotfish-plugin/main.js`，再複製 `manifest.json`、`styles.css` 與 `assets/`；`versions.json` 不需要放進 runtime artifact。每次 build 先只清掉這個 dist target，避免修改 source tree。
>
> 唯一衝突是「只輸出到 dist」與「dev mode 直接吃專案根目錄」不能同時成立，因為 Obsidian 會在 plugin 目錄根層找 `main.js`。我建議讓 vault 的 `.obsidian/plugins/obsidian-pilotfish-plugin` symlink 到 `dist/obsidian-pilotfish-plugin`；開發流程就是執行一次 build、回 Obsidian reload，不需要 watch。這樣只要一支 `build.mjs` 與一個 `build` script，也不會在專案根目錄留下 generated files。

- build js file with esbuild
- copy the manifest file, styles.css, assets/
- 放在 dist 下面
- 不需要 watch，dev mode 直接吃那個專案資料夾，只需要 build 就好
- deploy 指令是把 build 出來的 dist 檔案複製過去
- esbuild 的 build 維持原本的指令，但是同時執行把需要的檔案複製到 dist 下面。換句話說會有兩個 main.js, 一個在 project root 給 dev 用, 一個在 dist 裡面給 bundle package 用
- 或者說是新增一個 bundle 指令吧，把該用的東西放到 dist 裡面


> [!Comment] For Agent
> 我重新逞理了一下，你看一下狀況

> [!Comment] For User
> 這版合理，兩份 `main.js` 也有清楚用途：project root 是 Obsidian 開發時直接載入的產物，dist 裡的是可部署的 package snapshot。既然不需要 watch，可以讓 `build` 維持「typecheck + production esbuild → root `main.js`」。
>
> 我建議新增的指令叫 `package`，不要叫 `bundle`，因為 esbuild 本身已經在做 bundle，名稱容易混淆。流程可以固定成：`package` 先執行 `build`，再清空 `dist/obsidian-pilotfish-plugin/`，把 root `main.js`、`manifest.json`、`styles.css`、`assets/` 複製進去；這樣不會包到 stale `main.js`，也不用重跑第二次 esbuild。
>
> `deploy` 再以 dist 為唯一來源複製到 vault。若希望一個指令完成全部，可以讓 `deploy` 先呼叫 `package`；若希望部署既有 artifact，則保持兩個指令獨立。除此之外，這個範圍已經可以直接實作，不需要再加其他 build abstraction。
