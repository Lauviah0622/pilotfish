import type { Position } from './base';

/**
 * @prop commentRange: 整個 comment 的 range
 * - 如果是 block comment，會是多行。如果是單行 comment 就是 syntax + cotent 的 Range
 *  - 如果是 JS 這種 /** 開頭的以及 block end，內容只有一個要算進去，例如
 * 
 * /**
 *	* @agent:action:discuss
 *	* <- 要算 block start and end: 所以是 row 0 - 4
 *  * /
		
 * 上面這個情境，block start 要算，block end 也要算

 * /**
 *	* @agent:action:discuss
 *	* ... <- 要算 block start: 所以是 row 0 - 2
 *	* @agent:reply:done
 *	* ... <- 都不算: 所以是 row 3 - 4
 *	* @agent:reply:done
 *	* ... <- 要算 block end: 所以是 row 5 - 7
	  * /
 *  
 * 
 * @prop agentBlockSyntax: 實際的 @agent:action:discuss 這類的東西，去掉 comment 的
 * 
 */

type ActionAgentBlock = {
	kind: 'action';
	type: 'do' | 'ask' | 'discuss';
	agentBlockSyntax: string;
	commentRange: [Position, Position];
};

type ReplyAgentBlock = {
	kind: 'reply';
	status: 'done' | 'pending' | '';
	agentBlockSyntax: string;
	commentRange: [Position, Position];
};

type AgentBlock = ReplyAgentBlock | ActionAgentBlock;

/**
 * 如果在 agent block 裡面，就尋找到目前這個 agent block 的資訊
 * @agent:action:discuss
 * 你會怎麼實作？
 * @agent:reply:done — 我會拆成兩步：先共用 `CommentSyntax`/`LineTextSource` 找出 cursor 所在 comment 的邊界，
 * 再掃描其中所有 action/reply marker；每個 marker 到下一個 marker 前就是一個 `AgentBlock`，第一個/最後一個才分別納入
 * comment 開頭/結尾，最後回傳包含 cursor 的 block。不直接呼叫 `findAgentActionLine`，因為它無法區分 reply；抽出
 * comment-boundary helper 共用即可。另外 `commentRange` 實際是 agent block range，建議改名 `range`。
 *
 * @agent:action:discuss
 * 但你這樣不就找了整個 comment block？
 * @agent:reply:done — 對，先解析整個 comment 對這裡太重。改成從 cursor 向上找最近的 action/reply marker，再向下找到下一個 marker 或 comment end，直接得到目前 block 的 range；只有 cursor 在 comment opener 與第一個 marker 之間時才補向下找。最壞仍會走過目前 comment，但不建立完整 `AgentBlock[]`。`findAgentActionLine` 可抽出「同一 comment 內方向搜尋」共用，不能直接沿用它只找 action 的結果。
 *
 * @agent:action:discuss
 * 我提一個抽象
 * search up / search down loop -> parse and get token type -> get pisition
 * 這個好像可以依照需要拓展
 * 甚至可以拓展成 search next / prev block 來找 related block or all block
 *
 * @agent:reply:done — 可以，這個抽象比先 parse 整個 comment 更合適。建議底層只做 `searchAgentToken(source, from, direction, syntax)`，在同一 comment 邊界內回傳最近的 `{ token, range }`；current／related／all 都由上層組合 prev/next。`findCurrentBlock` 用向上搜尋取得起始 token、向下搜尋取得終點，`findAgentActionLine` 則重用搜尋但只接受 action。代價是要先定義 from 的 inclusive/exclusive 與同一行多 marker，否則連續呼叫 next/prev 可能重複命中。
 *
 * @agent:action:discuss
 * 我覺得可能分這樣
 * searchAgentToken(source, from, direction, exit: (text: string) => boolean) => {token, range}
 * exit 是 line parser 這樣，可能會有 comment start / comment end /agent syntax / comment body 類似這種？
 * @agent:reply:done — 方向接近，但不要讓 `exit(text): boolean` 同時當 parser；boolean 會丟失「為何停止」以及找到的 token。建議拆成 `parseLine(text, syntax): ScanToken[]` 與 search loop，token 只需 comment start/end、action、reply，普通 comment body 回空陣列。search loop 依 direction 排序 token，agent match 回 `{ token, range }`，comment boundary 則停止；若 caller 要篩目標可傳 `accept(token)`。同一行可能同時有 start/action/end，所以 parser 應回陣列而非單一 token。
 * @agent:action:do
 * 好，你做做看，先寫一個出來看看
 * @agent:reply:done — 已先實作第一層 `parseLineTokens`／`searchAgentToken`：支援 block 與連續 line comments、up/down、同一行多 token、comment boundary、inclusive 與 `accept` 篩選，並新增 5 個 unit tests。`findCurrentBlock` 暫不組 range，下一步再用這個 scanner 實作。
 */
const findCurrentBlock = (): AgentBlock | undefined => {
	// 可以使用 ./findAgentActionLine？或 findAgentActionLine 要怎麼一起調整比較好

	return undefined;
};
