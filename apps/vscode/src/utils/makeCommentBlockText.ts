import * as obsidianProtocol from './obsidian-skill-protocol';

const lineCommentLangs = new Set(['python', 'ruby', 'shellscript', 'yaml', 'toml', 'perl', 'r']);
const htmlLangs = new Set(['html', 'xml']);

export function makeCommentBlockText(
	langId: string,
	text: string[],
	config?: { indentSpace: number },
): string {
	const ind = ' '.repeat(config?.indentSpace ?? 0);
	if (langId === 'markdown') {
		return [obsidianProtocol.FIRST_LINE, ...text]
      .map((line) => `> ${line}`)
      .join('\n');
	}
	if (htmlLangs.has(langId)) {
		const lines = text.map((l) => `${ind}  ${l}`).join('\n');
		return `<!--\n${lines}\n${ind}-->`;
	}
	if (lineCommentLangs.has(langId)) {
		return text.map((l, i) => (i === 0 ? `# ${l}` : `${ind}# ${l}`)).join('\n');
	}
	const lines = text.map((l) => `${ind} * ${l}`).join('\n');
	return `/**\n${lines}\n${ind} */`;
}
