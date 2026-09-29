import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import type { CommentSyntax } from '../utils/commentSyntax';
import { type LineTextSource, findAgentActionLine } from '../utils/findAgentActionLine';

const lineSyntax = { kind: 'line', prefix: '#' } satisfies CommentSyntax;
const blockSyntax = {
	kind: 'block',
	open: '/*',
	close: '*/',
	insertOpen: '/**',
	contentPrefix: ' * ',
} satisfies CommentSyntax;

const lines = (...text: string[]): LineTextSource => ({
	getLine: (line) => text[line],
});

suite('findAgentActionLineInText', () => {
	test('finds an action in the current consecutive line-comment block', () => {
		const source = lines('  # @agent:action:ask', '  # question', '  # cursor');

		assert.strictEqual(
			findAgentActionLine(source, { line: 2, character: 10 }, lineSyntax),
			0,
		);
	});

	test('stops at a non-comment line', () => {
		const source = lines('# @agent:action:ask', 'value = 1', '# cursor');

		assert.strictEqual(
			findAgentActionLine(source, { line: 2, character: 8 }, lineSyntax),
			undefined,
		);
	});

	test('finds an action in the surrounding block comment', () => {
		const source = lines('/* @agent:action:discuss', ' * question', ' * cursor', ' */');

		assert.strictEqual(
			findAgentActionLine(source, { line: 2, character: 9 }, blockSyntax),
			0,
		);
	});

	test('does not cross a block-comment close before the cursor', () => {
		const text = '/* @agent:action:do */ const value = 1;';

		assert.strictEqual(
			findAgentActionLine(lines(text), { line: 0, character: text.length }, blockSyntax),
			undefined,
		);
	});
});
