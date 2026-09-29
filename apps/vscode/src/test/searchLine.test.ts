import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import type { LineTextSource } from '../utils/base';
import { type SearchLineContext, searchLine } from '../utils/searcher/searchLine';

const lines = (...text: string[]): LineTextSource => ({
	lineCount: text.length,
	getLine: (line) => text[line],
});

suite('searchLine', () => {
	test('searches upward until the inspector finds a result', () => {
		const source = lines('target', 'middle', 'cursor');

		const result = searchLine(source, { line: 2, character: 3 }, 'up', ({ text }) =>
			text === 'target' ? { kind: 'found', value: text.toUpperCase() } : { kind: 'continue' },
		);

		assert.deepStrictEqual(result, {
			result: 'TARGET',
			line: 0,
			text: 'target',
		});
	});

	test('returns undefined when the inspector reaches a normal stop boundary', () => {
		const visited: number[] = [];
		const source = lines('should not be visited', 'boundary', 'cursor');

		const result = searchLine(source, { line: 2, character: 2 }, 'up', ({ position, text }) => {
			visited.push(position.line);
			return text === 'boundary' ? { kind: 'stop' } : { kind: 'continue' };
		});

		assert.strictEqual(result, undefined);
		assert.deepStrictEqual(visited, [2, 1]);
	});

	test('searches downward and derives a position for each visited line', () => {
		const positions: SearchLineContext['position'][] = [];
		const source = lines('cursor', 'next', 'target');

		const result = searchLine(source, { line: 0, character: 4 }, 'down', (context) => {
			positions.push(context.position);
			return context.text === 'target'
				? { kind: 'found', value: context.position.line }
				: { kind: 'continue' };
		});

		assert.strictEqual(result?.result, 2);
		assert.deepStrictEqual(positions, [
			{ line: 0, character: 4 },
			{ line: 1, character: 0 },
			{ line: 2, character: 0 },
		]);
	});

	test('starts later upward lines at their line end', () => {
		const positions: SearchLineContext['position'][] = [];
		const source = lines('top', 'cursor');

		searchLine(source, { line: 1, character: 2 }, 'up', (context) => {
			positions.push(context.position);
			return { kind: 'continue' };
		});

		assert.deepStrictEqual(positions, [
			{ line: 1, character: 2 },
			{ line: 0, character: 3 },
		]);
	});

	test('passes inclusive through for the inspector to interpret', () => {
		const source = lines('/* @agent:action:ask */');

		const result = searchLine(
			source,
			{ line: 0, character: 3 },
			'up',
			({ inclusive, isFirst }) => ({ kind: 'found', value: { inclusive, isFirst } }),
			{ inclusive: false },
		);

		assert.deepStrictEqual(result?.result, { inclusive: false, isFirst: true });
	});

	test('does not inspect an out-of-bounds starting line', () => {
		let inspected = false;

		const result = searchLine(lines('only line'), { line: 2, character: 0 }, 'down', () => {
			inspected = true;
			return { kind: 'found', value: true };
		});

		assert.strictEqual(result, undefined);
		assert.strictEqual(inspected, false);
	});
});
