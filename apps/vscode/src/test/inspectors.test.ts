import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import type { LineTextSource } from '../utils/base';
import type { CommentSyntax } from '../utils/commentSyntax';
import {
	AgentCommentInspector,
	CommentCloseInspector,
	CommentStartInspector,
} from '../utils/searcher/inspectors';
import { searchLine } from '../utils/searcher/searchLine';

const lineSyntax = { kind: 'line', prefix: '#' } satisfies CommentSyntax;
const blockSyntax = {
	kind: 'block',
	open: '/*',
	close: '*/',
	insertOpen: '/**',
	contentPrefix: ' * ',
} satisfies CommentSyntax;

const lines = (...text: string[]): LineTextSource => ({
	lineCount: text.length,
	getLine: (line) => text[line],
});

suite('inspectors', () => {
	test('finds the nearest canonical agent marker in either direction', () => {
		const text = '/* @agent:action:ask @agent:reply:done */';
		const source = lines(text);

		const next = searchLine(source, { line: 0, character: 0 }, 'down', AgentCommentInspector());
		const previous = searchLine(
			source,
			{ line: 0, character: text.length },
			'up',
			AgentCommentInspector(),
		);

		assert.strictEqual(next?.result.kind, 'agent:action');
		assert.strictEqual(previous?.result.kind, 'agent:reply');
	});

	test('applies exclusive matching only to the first inspected line', () => {
		const result = searchLine(
			lines('@agent:action:ask', '@agent:reply:done'),
			{ line: 0, character: 0 },
			'down',
			AgentCommentInspector(),
			{ inclusive: false },
		);

		assert.strictEqual(result?.line, 1);
		assert.strictEqual(result?.result.kind, 'agent:reply');
	});

	test('finds a block-comment start with its character range', () => {
		const result = searchLine(
			lines('code /* comment'),
			{ line: 0, character: 0 },
			'down',
			CommentStartInspector(blockSyntax),
		);

		assert.deepStrictEqual(result?.result, {
			kind: 'comment-start',
			syntax: '/*',
			range: [
				{ line: 0, character: 5 },
				{ line: 0, character: 7 },
			],
		});
	});

	test('recognizes an indented line-comment prefix', () => {
		const result = searchLine(
			lines('  # comment'),
			{ line: 0, character: 0 },
			'down',
			CommentStartInspector(lineSyntax),
		);

		assert.deepStrictEqual(result?.result.range, [
			{ line: 0, character: 2 },
			{ line: 0, character: 3 },
		]);
	});

	test('finds the nearest block-comment close while searching upward', () => {
		const text = '/* first */ /* second */';
		const result = searchLine(
			lines(text),
			{ line: 0, character: text.length },
			'up',
			CommentCloseInspector(blockSyntax),
		);

		assert.deepStrictEqual(result?.result.range, [
			{ line: 0, character: 22 },
			{ line: 0, character: 24 },
		]);
	});

	test('ignores non-canonical agent markers', () => {
		const result = searchLine(
			lines('@agent:action:other'),
			{ line: 0, character: 0 },
			'down',
			AgentCommentInspector(),
		);

		assert.strictEqual(result, undefined);
	});
});

const REAL_WORLD_AGENT_BLOCK = `    /**
     * @agent:action:discuss
		 * 這理想直接刪除掉當下個 comment block
		 
		 * 有幾個狀況
		 * 一個 comment 中有多個 action | 一個 comment 
		 * 這時候要考慮刪掉整個 comment block 還是單純的 action / reply block 
		 * 
		 * 還有要判斷 action block 跟 reply block
		 * @agent:reply:done — 建議以一組 action + reply 為最小刪除單位；cursor 在 reply 時往前歸屬最近的 action，範圍到下一個 action 或 comment 結尾。若整個 comment 只含這一組，就連 comment delimiters 一起刪除；整段刪除可另做明確指令。遇到孤立 reply 或無法判定的結構則不刪並提示。
		 * 
		 * @agent:action:discuss
		 * 我覺得我想要用跟 findAgentActionLine 類似的邏輯，應該可以共用？你怎麼想
		 * 
		 * @agent:reply:done — 可以共用定位邏輯，但不要直接共用只回傳行號的 'findAgentActionLine'。建議抽成 locator，回傳 comment range、目前 action range 與 reply range；make command 取 action 起始行，cleanup 再依範圍刪除。代價是 locator 要處理更多邊界，最好搭配 fixtures 測試。
     */`;

suite('inspectors with a real-world agent block', () => {
	const source = lines(...REAL_WORLD_AGENT_BLOCK.split('\n'));

	test('finds the comment boundaries across mixed indentation', () => {
		const start = searchLine(
			source,
			{ line: 0, character: 0 },
			'down',
			CommentStartInspector(blockSyntax),
		);
		const lastLine = source.lineCount - 1;
		const close = searchLine(
			source,
			{ line: lastLine, character: source.getLine(lastLine).length },
			'up',
			CommentCloseInspector(blockSyntax),
		);

		assert.deepStrictEqual(start?.result.range, [
			{ line: 0, character: 4 },
			{ line: 0, character: 6 },
		]);
		assert.deepStrictEqual(close?.result.range, [
			{ line: 15, character: 5 },
			{ line: 15, character: 7 },
		]);
	});

	test('walks both exchanges in order from either direction', () => {
		const collectTokens = (direction: 'up' | 'down') => {
			const lastLine = source.lineCount - 1;
			let position =
				direction === 'down'
					? { line: 0, character: 0 }
					: { line: lastLine, character: source.getLine(lastLine).length };
			const tokens = [];

			for (let index = 0; index < 4; index += 1) {
				const match = searchLine(source, position, direction, AgentCommentInspector(), {
					inclusive: false,
				});
				assert.ok(match);
				tokens.push({
					line: match.line,
					kind: match.result.kind,
					value: match.result.kind === 'agent:action' ? match.result.type : match.result.status,
				});
				position = direction === 'down' ? match.result.range[1] : match.result.range[0];
			}

			return tokens;
		};

		const expected = [
			{ line: 1, kind: 'agent:action', value: 'discuss' },
			{ line: 9, kind: 'agent:reply', value: 'done' },
			{ line: 11, kind: 'agent:action', value: 'discuss' },
			{ line: 14, kind: 'agent:reply', value: 'done' },
		];

		assert.deepStrictEqual(collectTokens('down'), expected);
		assert.deepStrictEqual(collectTokens('up'), expected.slice().reverse());
	});
});
