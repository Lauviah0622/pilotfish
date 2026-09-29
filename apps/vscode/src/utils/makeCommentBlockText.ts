import { getCommentSyntax } from './commentSyntax';
import * as obsidianProtocol from './protocols/obsidian-skill-protocol';

export function makeCommentBlockText(
	langId: string,
	text: string[],
	config?: { indentSpace: number },
): string {
	const ind = ' '.repeat(config?.indentSpace ?? 0);
	if (langId === 'markdown') {
		return [obsidianProtocol.FIRST_LINE, ...text].map((line) => `> ${line}`).join('\n');
	}

	const syntax = getCommentSyntax(langId);
	if (!syntax) return '';
	if (syntax.kind === 'line') {
		return text
			.map((line, index) =>
				index === 0 ? `${syntax.prefix} ${line}` : `${ind}${syntax.prefix} ${line}`,
			)
			.join('\n');
	}

	const lines = text.map((line) => `${ind}${syntax.contentPrefix}${line}`).join('\n');
	return `${syntax.insertOpen}\n${lines}\n${ind}${syntax.close}`;
}
