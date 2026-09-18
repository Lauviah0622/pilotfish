export type CommentSyntax =
	| { kind: 'line'; prefix: string }
	| {
			kind: 'block';
			open: string;
			close: string;
			insertOpen: string;
			contentPrefix: string;
	  };

const lineCommentLangs = new Set(['python', 'ruby', 'shellscript', 'yaml', 'toml', 'perl', 'r']);
const htmlLangs = new Set(['html', 'xml']);

export function getCommentSyntax(languageId: string): CommentSyntax | undefined {
	if (languageId === 'markdown') return undefined;
	if (lineCommentLangs.has(languageId)) return { kind: 'line', prefix: '#' };
	if (htmlLangs.has(languageId)) {
		return {
			kind: 'block',
			open: '<!--',
			close: '-->',
			insertOpen: '<!--',
			contentPrefix: '  ',
		};
	}

	return {
		kind: 'block',
		open: '/*',
		close: '*/',
		insertOpen: '/**',
		contentPrefix: ' * ',
	};
}
