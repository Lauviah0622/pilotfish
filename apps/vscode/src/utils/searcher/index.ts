/**
 * @agent:action:do
 * 把會用到的東西 export 出來，麻煩你了！
 * @agent:reply:done — 已匯出共用 range 型別與建構器、三個 inspector，以及 searchLine
 * 的函式和相關型別；尚未完成的 findCurrentBlock 不納入公開介面。
 */

export {
	makeLineRange,
	type CharacterSpan,
	type Position,
	type SearchDirection,
	type SpanRange,
	type TextRange,
} from './base';
export {
	AgentCommentInspector,
	CommentCloseInspector,
	CommentStartInspector,
	type AgentCommentToken,
	type CommentBoundaryToken,
} from './inspectors';
export {
	inspectMatch,
	searchLine,
	type InspectLine,
	type LineTextSource,
	type SearchLineContext,
	type SearchLineDecision,
	type SearchLineOptions,
	type SearchLineResult,
} from './searchLine';
