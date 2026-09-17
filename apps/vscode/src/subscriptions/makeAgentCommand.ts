import * as vscode from 'vscode';

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
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
		const filePath = workspaceFolder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;

		/**
		 * @agent ask
		 * TODO(protocol): This note contains obsolete marker proposals. The block locator must
		 * recognize only the canonical `@agent:action:{do|ask|discuss}` opening marker.
		 * TODO 這個能不能改成，只要 cursor 在 block 內，就自動複製那個 block 的 command，這樣就不用找了
		 * 那要做的可能是
		 */

		const prefix = vscode.workspace
			.getConfiguration('pilotfish-vscode')
			.get<string>('copyPathPrefix', '');
		const lineRef =
			start.line === end.line ? `${start.line + 1}` : `${start.line + 1}-${end.line + 1}`;
		const value = `${prefix}${filePath}:${lineRef}`;

		vscode.env.clipboard.writeText(value);
		vscode.window.showInformationMessage(`Copied: ${value}`);
	},
);

export { makeAgentCommand };
