export type BlockSyntax =
	| { kind: 'line'; prefix: string }
	| {
			kind: 'block';
			open: string;
			close: string;
			/**
			 * insert open is for jsdoc. it diffriciate the "/**" and  "/*".
			 * "/**" is for doc and "/*" not
			 */
			insertOpen: string;
			contentPrefix: string;
	  };

const lineCommentLangs = new Set(['python', 'ruby', 'shellscript', 'yaml', 'toml', 'perl', 'r']);
const htmlLangs = new Set(['html', 'xml']);

/**
 * > example
 * > example
 */
export const OBSIDIAN_CALLOUT_BLOCK = { kind: 'line', prefix: '> ' } satisfies BlockSyntax;

/**
 * # example
 * # example
 */
export const SCRIPT_LANG_STYLE_COMMENT = { kind: 'line', prefix: '# ' } satisfies BlockSyntax;

/**
 * example
 */
export const C_LIKE_LANG_DOC_BLOCK_COMMENT = {
	kind: 'block',
	open: '/*',
	close: ' */',
	insertOpen: '/**',
	contentPrefix: ' * ',
} satisfies BlockSyntax;

// <!--
//   example
// -->
export const XML_STYLE_BLOCK_COMMENT = {
	kind: 'block',
	open: '<!--',
	close: '-->',
	insertOpen: '<!--',
	contentPrefix: '  ',
} satisfies BlockSyntax;

export function getBlockSyntax(languageId: string) {
	if (languageId === 'markdown') return OBSIDIAN_CALLOUT_BLOCK;
	if (lineCommentLangs.has(languageId)) return SCRIPT_LANG_STYLE_COMMENT;
	if (htmlLangs.has(languageId)) {
		return XML_STYLE_BLOCK_COMMENT;
	}

	return C_LIKE_LANG_DOC_BLOCK_COMMENT;
}
