import type { BlockSyntax } from './blockSyntax';

export function putTextIntoBlock(
	syntax: BlockSyntax,
	text: string[],
	config?: { indent: string; indentFirstLine?: boolean },
): string {
	const indent = config?.indent ?? '';
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
