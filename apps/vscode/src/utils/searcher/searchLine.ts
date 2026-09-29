import type { Position, SearchDirection } from './base';

export type LineTextSource = {
	lineCount: number;
	getLine: (line: number) => string;
};

/**
 * @agent:action:ask
 * 你要怎麼處理都在單行的狀況啊？突然想到。我們是不是有個大假設是都是多行的 block comment
 * @agent:reply:done — 沒有多行假設；`searchLine` 把完整 `Position` 與當行文字交給 callback，單行 comment 可直接依 character 順序判斷 start/action/reply/end。looper 本身不解析 token，之後由 comment parser 補單行整合案例。
 */

export type SearchLineDecision<T> =
	| { kind: 'continue' }
	| { kind: 'stop' }
	| { kind: 'found'; value: T };

export const inspectMatch = <T>(match: T | undefined): SearchLineDecision<T> => {
	return match ? { kind: 'found', value: match } : { kind: 'continue' };
};

export type SearchLineResult<T> = {
	result: T;
	line: Position['line'];
	text: string;
};

export type SearchLineOptions = {
	inclusive?: boolean;
};

export type SearchLineContext = {
	text: string;
	/**
	 * @agent:action:ask
	 * line 這個 prop 好像已經在 position 裡面了？
	 * @agent:reply:done — 對，這裡完全重複；`position.line` 就是當前掃描行。`line` 現在只是 inspectors 建立 range 時的便利欄位，可以拿掉並將使用點改為 `context.position.line`。
	 *
	 * @agent:action:do
	 * 好，調整一下
	 * @agent:reply:done — 已移除重複的 `line`，inspectors 與測試改用 `position.line`。
	 */
	position: Position;
	from: Position;
	direction: SearchDirection;
	isFirst: boolean;
	inclusive: boolean;
};

export type InspectLine<T> = (context: SearchLineContext) => SearchLineDecision<T>;

/**
 * @agent:action:discuss
 *
 * 你原本寫的有點複雜，你看看 staged 的檔案（你寫的）跟我寫得那個大概念。稍微討論一下
 *
 * @agent:reply:done — 我同意你的 `searchLine` 純 looper 方向比較好；staged 版把迴圈、comment 邊界、token parsing 與篩選綁得太緊。callback 建議改成 `(text, line) => continue | stop | found<T>`，因為要區分「繼續」、「碰到邊界但沒結果」與「找到結果」，而不是 `() => T`。入口仍保留完整 `Position`，首行依 character 截斷，後續行才只看 line，這樣單行 start/action/end 才不會失真。
 * parser 另做純函式回傳 `Token[]`（不是 `[Token]`），並統一 `kind` 命名；`searchLine` 找到時再回 `{ result, line, text }`。這樣先把 looper 測穩，再由 find-current/next/prev 各自組合規則。
 *
 * @agent:action:discuss
 * - (text, line) => continue | stop | found<T>
 * continue, stop 這個是什麼意思啊？還是你是只說如果 return continue 就繼續找，stop 相當於 error, found return
 * - 入口仍保留完整 `Position`，首行依 character 截斷，後續行才只看 line，這樣單行 start/action/end 才不會失真。
 * 這個同意，search line 也保療 from 而不是 fromLine，加上 inclusive 應該會更好用
 *
 *
 * 我又稍微改了一下，你看看
 *
 * @agent:reply:done — 對，`continue` 是正常掃下一行；`stop` 是碰到 comment boundary／非 comment 行後正常結束並回 `undefined`，不是 error；`found` 才帶結果返回，真正錯誤另外 throw。這版已更接近，型別建議收斂成 `ParseResult<T> = { kind: 'continue' } | { kind: 'stop' } | { kind: 'found'; value: T }`，而 `Assertion<T>` 應接收有型別的 `{ text, line, from, isFirst, direction }` 並回 `ParseResult<T>`；`Result<T>.line` 則是 `Position['line']`，不是 `T`。保留 `from: Position` 是對的，但 `inclusive` 應交給 callback 依 token range 判斷，純 line looper 只提供 `isFirst/from`。`parsedTokens: T[]` 也比 tuple 正確；另外 `CommentLine.kind` 要能表示 body/single-line，或乾脆由 tokens 推導，不然 action-only 的中間行沒有合法 kind。
 *
 * @agent:action:do
 *
 * 好，我們收斂的差不多了，開始動工吧，原本的就拿掉
 * @agent:reply:done — 已移除原本的 token/comment scanner 與草稿，改為純 `searchLine`：callback 回傳 continue/stop/found，context 保留 Position、方向、首行與 inclusive。新增 6 個 looper unit tests，focused TypeScript、Biome 與測試皆通過。
 */
export const searchLine = <T>(
	source: LineTextSource,
	from: Position,
	direction: SearchDirection,
	inspectLine: InspectLine<T>,
	options: SearchLineOptions = {},
): SearchLineResult<T> | undefined => {
	if (from.line < 0 || from.line >= source.lineCount) return undefined;

	const step = direction === 'up' ? -1 : 1;
	const inclusive = options.inclusive ?? true;

	for (let line = from.line; line >= 0 && line < source.lineCount; line += step) {
		const text = source.getLine(line);
		const isFirst = line === from.line;
		const position = {
			line,
			character: isFirst ? from.character : direction === 'up' ? text.length : 0,
		};
		const decision = inspectLine({
			text,
			position,
			from,
			direction,
			isFirst,
			inclusive,
		});

		if (decision.kind === 'continue') continue;
		if (decision.kind === 'stop') return undefined;

		return { result: decision.value, line, text };
	}

	return undefined;
};
