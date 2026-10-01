import type { LineTextSource, Position } from '../base';
import type { BlockSyntax } from '../blockSyntax';
import {
	AgentCommentInspector,
	BlockCommentCloseInspector,
	BlockCommentStartInspector,
	searchLine,
} from '../searcher';

const comparePositions = (left: Position, right: Position) =>
	left.line === right.line ? left.character - right.character : left.line - right.line;

const findLineCommentAction = (
	source: LineTextSource,
	cursor: Position,
	syntax: Extract<BlockSyntax, { kind: 'line' }>,
) => {
	const inspectCommentStart = BlockCommentStartInspector(syntax);
	const inspectAction = AgentCommentInspector('action');

	return searchLine(source, cursor, 'up', (context) => {
		const commentStart = inspectCommentStart(context);
		if (commentStart.kind !== 'found') return { kind: 'stop' };
		if (context.isFirst && cursor.character < commentStart.value.range[1].character) {
			return { kind: 'stop' };
		}

		const action = inspectAction(context);
		return action.kind === 'found'
			? { kind: 'found', value: context.position.line }
			: { kind: 'continue' };
	})?.result;
};

const findBlockCommentAction = (
	source: LineTextSource,
	cursor: Position,
	syntax: Extract<BlockSyntax, { kind: 'block' }>,
) => {
	const close = searchLine(source, cursor, 'down', BlockCommentCloseInspector(syntax));
	if (!close) return undefined;

	const start = searchLine(source, close.result.range[0], 'up', BlockCommentStartInspector(syntax));
	if (!start || comparePositions(start.result.range[0], cursor) > 0) return undefined;

	const action = searchLine(source, close.result.range[0], 'up', AgentCommentInspector('action'), {
		inclusive: false,
	});
	if (!action || comparePositions(action.result.range[0], start.result.range[1]) < 0) {
		return undefined;
	}

	return action.line;
};

export const findAgentActionLine = (
	source: LineTextSource,
	cursor: Position,
	syntax: BlockSyntax | undefined,
) => {
	if (!syntax) return undefined;
	return syntax.kind === 'line'
		? findLineCommentAction(source, cursor, syntax)
		: findBlockCommentAction(source, cursor, syntax);
};
