import * as vscode from 'vscode';
import { getCommentSyntax } from '../utils/commentSyntax';

const AGENT_ACTION_PATTERN = /@agent:action:(?:do|ask|discuss)\b/;

const findLineCommentStart = (text: string, prefix: string) => {
	const start = text.length - text.trimStart().length;
	return text.startsWith(prefix, start) ? start : undefined;
};

const findLineCommentAction = (
	document: vscode.TextDocument,
	cursor: vscode.Position,
	prefix: string,
) => {
	const currentLine = document.lineAt(cursor.line).text;
	const currentCommentStart = findLineCommentStart(currentLine, prefix);
	if (currentCommentStart === undefined || cursor.character < currentCommentStart + prefix.length) {
		return undefined;
	}

	for (let line = cursor.line; line >= 0; line--) {
		const text = document.lineAt(line).text;
		const commentStart = findLineCommentStart(text, prefix);
		if (commentStart === undefined) break;
		if (AGENT_ACTION_PATTERN.test(text.slice(commentStart + prefix.length))) {
			return line;
		}
	}

	return undefined;
};

const findBlockCommentAction = (
	document: vscode.TextDocument,
	cursor: vscode.Position,
	open: string,
	close: string,
) => {
	let actionLine: number | undefined;

	for (let line = cursor.line; line >= 0; line--) {
		const text = document.lineAt(line).text;
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

/**
 * 概念上類似這樣
 * @agent:action:ask
 * ...
 * @agent:reply:done
 *
 * @agent:action:do   ← 應該找到這個最近的 action
 * 正在編輯這裡       ← cursor
 *
 * 但要處理 line comment 跟 block comment 兩種語言 comment 類型
 */
const findAgentActionLine = (document: vscode.TextDocument, cursor: vscode.Position) => {
	const syntax = getCommentSyntax(document.languageId);
	if (!syntax) return undefined;
	if (syntax.kind === 'line') {
		return findLineCommentAction(document, cursor, syntax.prefix);
	}

	return findBlockCommentAction(document, cursor, syntax.open, syntax.close);
};

/**
 * the agent command format would be like:
 * single line: {custom prefix} {file-path}:{linenumber}
 * multi line: {custom prefix} {file-path}:{linenumber-from}-{linenumber-to}
 */
const makeAgentCommand = vscode.commands.registerCommand(
	'pilotfish-vscode.makeAgentCommand',
	() => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('No active editor.');
			return;
		}
		const uri = editor.document.uri;
		const { start, end } = editor.selection;
		const actionLine = findAgentActionLine(editor.document, editor.selection.active);
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
		const filePath = workspaceFolder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;

		const prefix = vscode.workspace
			.getConfiguration('pilotfish-vscode')
			.get<string>('copyPathPrefix', '');
		const lineRef =
			actionLine !== undefined
				? `${actionLine + 1}`
				: start.line === end.line
					? `${start.line + 1}`
					: `${start.line + 1}-${end.line + 1}`;
		const value = `${prefix}${filePath}:${lineRef}`;

		vscode.env.clipboard.writeText(value);
		vscode.window.showInformationMessage(`Copied: ${value}`);
	},
);

export { makeAgentCommand };
