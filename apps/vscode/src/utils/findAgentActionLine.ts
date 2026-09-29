import type * as vscode from 'vscode';
import { type CommentSyntax, getCommentSyntax } from './commentSyntax';

const AGENT_ACTION_PATTERN = /@agent:action:(?:do|ask|discuss)\b/;

export type AgentActionPosition = {
	line: number;
	character: number;
};

export type LineTextSource = {
	getLine: (line: number) => string;
};

const findLineCommentStart = (text: string, prefix: string) => {
	const start = text.length - text.trimStart().length;
	return text.startsWith(prefix, start) ? start : undefined;
};

const findLineCommentAction = (
	source: LineTextSource,
	cursor: AgentActionPosition,
	prefix: string,
) => {
	const currentLine = source.getLine(cursor.line);
	const currentCommentStart = findLineCommentStart(currentLine, prefix);
	if (currentCommentStart === undefined || cursor.character < currentCommentStart + prefix.length) {
		return undefined;
	}

	for (let line = cursor.line; line >= 0; line--) {
		const text = source.getLine(line);
		const commentStart = findLineCommentStart(text, prefix);
		if (commentStart === undefined) break;
		if (AGENT_ACTION_PATTERN.test(text.slice(commentStart + prefix.length))) {
			return line;
		}
	}

	return undefined;
};

const findBlockCommentAction = (
	source: LineTextSource,
	cursor: AgentActionPosition,
	open: string,
	close: string,
) => {
	let actionLine: number | undefined;

	for (let line = cursor.line; line >= 0; line--) {
		const text = source.getLine(line);
		const textBeforeCursor = line === cursor.line ? text.slice(0, cursor.character) : text;
		const openIndex = textBeforeCursor.lastIndexOf(open);
		const closeIndex = textBeforeCursor.lastIndexOf(close);

		if (closeIndex > openIndex) return undefined;

		const closeAfterCursor = line === cursor.line ? text.indexOf(close, cursor.character) : -1;
		const commentText = text.slice(
			openIndex === -1 ? 0 : openIndex + open.length,
			closeAfterCursor === -1 ? text.length : closeAfterCursor,
		);
		if (actionLine === undefined && AGENT_ACTION_PATTERN.test(commentText)) {
			actionLine = line;
		}

		if (openIndex !== -1) {
			return actionLine;
		}
	}

	return undefined;
};

export const findAgentActionLine = (
  source: LineTextSource,
  cursor: AgentActionPosition,
  syntax: CommentSyntax | undefined,
) => {
  if (!syntax) return undefined;
  if (syntax.kind === 'line') {
    return findLineCommentAction(source, cursor, syntax.prefix);
  }

  return findBlockCommentAction(source, cursor, syntax.open, syntax.close);
};
