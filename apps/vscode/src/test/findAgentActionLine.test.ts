import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import type { LineTextSource } from '../utils/base';
import type { BlockSyntax } from '../utils/blockSyntax';
import { findAgentActionLine } from '../utils/findAgentActionLine';

const lineSyntax = { kind: 'line', prefix: '#' } satisfies BlockSyntax;
const blockSyntax = {
	kind: 'block',
	open: '/*',
	close: '*/',
	insertOpen: '/**',
	contentPrefix: ' * ',
} satisfies BlockSyntax;

const lines = (...text: string[]): LineTextSource => ({
	lineCount: text.length,
	getLine: (line) => text[line],
});

suite('findAgentActionLineInText', () => {
	test('finds an action in the current consecutive line-comment block', () => {
		const source = lines('  # @agent:action:ask', '  # question', '  # cursor');

		assert.strictEqual(findAgentActionLine(source, { line: 2, character: 10 }, lineSyntax), 0);
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

		assert.strictEqual(findAgentActionLine(source, { line: 2, character: 9 }, blockSyntax), 0);
	});

	test('finds an action before a reply on the same block-comment line', () => {
		const text = '/* @agent:action:ask @agent:reply:done */';

		assert.strictEqual(
			findAgentActionLine(lines(text), { line: 0, character: text.indexOf('*/') }, blockSyntax),
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

	test('does not use the close syntax from a later block comment', () => {
		const text = 'const value = 1; /* @agent:action:do */';

		assert.strictEqual(
			findAgentActionLine(lines(text), { line: 0, character: 0 }, blockSyntax),
			undefined,
		);
	});

	test('does not cross the current block opening to find an earlier action', () => {
		const text = '/* @agent:action:do */ /* cursor */';

		assert.strictEqual(
			findAgentActionLine(lines(text), { line: 0, character: text.indexOf('cursor') }, blockSyntax),
			undefined,
		);
	});
});
