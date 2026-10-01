import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import {
	C_LIKE_LANG_DOC_BLOCK_COMMENT,
	OBSIDIAN_CALLOUT_BLOCK,
	SCRIPT_LANG_STYLE_COMMENT,
	XML_STYLE_BLOCK_COMMENT,
} from '../utils/blockSyntax';
import { putTextIntoBlock } from '../utils/putTextIntoBlock';

suite('putTextIntoBlock', () => {
	test('wraps text with Obsidian-style line comments', () => {
		const result = putTextIntoBlock(OBSIDIAN_CALLOUT_BLOCK, ['first line', 'second line']);

		const expect = ['> first line', '> second line'].join('\n');

		assert.strictEqual(result, expect);
	});

	test('wraps text with indented script-style line comments', () => {
		const result = putTextIntoBlock(SCRIPT_LANG_STYLE_COMMENT, ['first line', 'second line'], {
			indentSpace: 4,
		});

		const expect = ['    # first line', '    # second line'].join('\n');

		assert.strictEqual(result, expect);
	});

	test('wraps text with an indented C-like doc block comment', () => {
		const result = putTextIntoBlock(C_LIKE_LANG_DOC_BLOCK_COMMENT, ['first line', 'second line'], {
			indentSpace: 2,
		});

		const expect = ['  /**', '   * first line', '   * second line', '   */'].join('\n');

		assert.strictEqual(result, expect);
	});

	test('wraps text with an indented XML-style block comment', () => {
		const result = putTextIntoBlock(XML_STYLE_BLOCK_COMMENT, ['first line', 'second line'], {
			indentSpace: 2,
		});

		const expect = ['  <!--', '    first line', '    second line', '  -->'].join('\n');

		assert.strictEqual(result, expect);
	});

	test('can leave the first line unindented', () => {
		const result = putTextIntoBlock(C_LIKE_LANG_DOC_BLOCK_COMMENT, ['first line', 'second line'], {
			indentSpace: 2,
			indentFirstLine: false,
		});

		const expect = ['/**', '   * first line', '   * second line', '   */'].join('\n');

		assert.strictEqual(result, expect);
	});
});
