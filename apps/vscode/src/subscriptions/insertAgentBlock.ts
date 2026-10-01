import * as vscode from 'vscode';
import { getBlockSyntax } from '../utils/blockSyntax';
import * as editorProtocol from '../utils/protocols/editor-skill-protocol';
import * as onsidianProtocol from '../utils/protocols/obsidian-skill-protocol';
import { putTextIntoBlock } from '../utils/putTextIntoBlock';

const getIndentSpace = (editor: vscode.TextEditor) => {
	const indentSpace =
		editor.document.lineAt(editor.selection.active.line).text.match(/^(\s*)/)?.[1]?.length ?? 0;

	return indentSpace;
};

const getActionText = (langId: string) => {
	const isMarkdown = langId === 'markdown';
	const actionText = isMarkdown
		? onsidianProtocol.FOR_AGENT_CALLOUT
		: `${editorProtocol.ACTION_PREFIX}:`;

	return actionText;
};

const insertAgentBlock = vscode.commands.registerCommand(
	'pilotfish-vscode.insertAgentBlock',
	async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('No active editor.');
			return;
		}
		const langId = editor.document.languageId;
		const actionText = getActionText(langId);

		const indentSpace = getIndentSpace(editor);
		const syntax = getBlockSyntax(langId);

		const text = putTextIntoBlock(syntax, [actionText], {
			indentSpace,
			indentFirstLine: false,
		});
		const insertionPoint = editor.selection.active;
		// insert the agent block
		const didInsert = await editor.edit((editBuilder) => {
			for (const selection of editor.selections) {
				editBuilder.insert(selection.active, text);
			}
		});
		if (!didInsert) return;

		// TODO 這裡要重寫

		// compute the row count and ch count of inserted content in whole text
		const idx = text.lastIndexOf(actionText);
		if (idx === -1) return;
		const before = text.slice(0, idx + actionText.length);
		const lines = before.split('\n');
		const lineOffset = lines.length - 1;

		const charOffset = lines[lines.length - 1].length; // get the end of the actionText line
		const newPos = new vscode.Position(
			insertionPoint.line + lineOffset,
			lineOffset === 0 ? insertionPoint.character + charOffset : charOffset,
		);

		editor.selection = new vscode.Selection(newPos, newPos);

		if (langId !== 'markdown') {
			await vscode.commands.executeCommand('editor.action.triggerSuggest');
		}
	},
);

export { insertAgentBlock };
