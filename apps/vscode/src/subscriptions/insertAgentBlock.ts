import * as vscode from 'vscode';
import * as editorProtocol from '../utils/protocols/editor-skill-protocol';
import { makeCommentBlockText } from '../utils/makeCommentBlockText';

const getIndentSpace = (editor: vscode.TextEditor) => {
	const indentSpace =
		editor.document.lineAt(editor.selection.active.line).text.match(/^(\s*)/)?.[1]?.length ?? 0;

	return indentSpace;
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
		const isMarkdown = langId === 'markdown';
		const content = isMarkdown ? '' : `${editorProtocol.ACTION_PREFIX}:`;

		const indentSpace = getIndentSpace(editor);
		const text = makeCommentBlockText(langId, [content], { indentSpace });
		const cursorAnchor = isMarkdown ? '> ' : content;

		const insertionPoint = editor.selection.active;
		const didInsert = await editor.edit((editBuilder) => {
			for (const selection of editor.selections) {
				editBuilder.insert(selection.active, text);
			}
		});
		if (!didInsert) return;

		// compute the row count and ch count of inserted content in whole text
		const idx = text.lastIndexOf(cursorAnchor);
		if (idx === -1) return;
		const before = text.slice(0, idx + cursorAnchor.length);
		const lines = before.split('\n');
		const lineOffset = lines.length - 1;
		const charOffset = lines[lines.length - 1].length;
		const newPos = new vscode.Position(
			insertionPoint.line + lineOffset,
			lineOffset === 0 ? insertionPoint.character + charOffset : charOffset,
		);

		editor.selection = new vscode.Selection(newPos, newPos);
		if (!isMarkdown) {
			await vscode.commands.executeCommand('editor.action.triggerSuggest');
		}
	},
);

export { insertAgentBlock };
