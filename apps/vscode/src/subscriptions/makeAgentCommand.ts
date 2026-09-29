import * as vscode from 'vscode';
import { getCommentSyntax } from '../utils/commentSyntax';
import { findAgentActionLine } from '../utils/findAgentActionLine';

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
		const syntax = getCommentSyntax(editor.document.languageId);

		const actionLine = findAgentActionLine(
			{
				lineCount: editor.document.lineCount,
				getLine: (line) => editor.document.lineAt(line).text,
			},
			editor.selection.active,
			syntax,
		);

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
