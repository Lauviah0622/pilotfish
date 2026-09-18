import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import { makeCommentBlockText } from '../utils/makeCommentBlockText';

suite('makeCommentBlockText', () => {
	test('creates an Obsidian comment callout for Markdown', () => {
		const result = makeCommentBlockText('markdown', ['first line', 'second line']);

		assert.strictEqual(result, '> [!Comment] For Agent\n> first line\n> second line');
	});

	test('creates an indented multi-line comment for line-comment languages', () => {
		const result = makeCommentBlockText('python', ['first line', 'second line'], {
			indentSpace: 4,
		});

		assert.strictEqual(result, '# first line\n    # second line');
	});

	test('creates an indented JSDoc-style block comment by default', () => {
		const result = makeCommentBlockText('typescript', ['first line', 'second line'], {
			indentSpace: 2,
		});

		assert.strictEqual(result, '/**\n   * first line\n   * second line\n  */');
	});

	test('creates an HTML comment using HTML comment syntax', () => {
		const result = makeCommentBlockText('html', ['first line', 'second line'], {
			indentSpace: 2,
		});

		assert.strictEqual(result, '<!--\n    first line\n    second line\n  -->');
	});
});
