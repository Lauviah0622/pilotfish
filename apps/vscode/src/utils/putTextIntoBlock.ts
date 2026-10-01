import type { BlockSyntax } from './blockSyntax';

/**
 * @agent:action:do
 * 新增一個 config ，讓外部決定說第一行要不要縮排。因為 insert 通常不用
 * @agent:reply:done — 新增 `indentFirstLine`（預設 true）；insert 明確設為 false，
 * 並補上首行不縮排的測試。
 */
export function putTextIntoBlock(
	syntax: BlockSyntax,
	text: string[],
	config?: { indentSpace: number; indentFirstLine?: boolean },
): string {
	const indent = ' '.repeat(config?.indentSpace ?? 0);
	const indentFirstLine = config?.indentFirstLine ?? true;

	if (!syntax) return '';
	const lines =
		syntax.kind === 'line'
			? text.map((line) => `${syntax.prefix}${line}`)
			: [syntax.insertOpen, ...text.map((line) => `${syntax.contentPrefix}${line}`), syntax.close];

	return lines
		.map((line, index) => `${index === 0 && !indentFirstLine ? '' : indent}${line}`)
		.join('\n');
}
