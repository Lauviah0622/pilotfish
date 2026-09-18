import * as vscode from 'vscode';
import * as editorProtocol from '../utils/editor-skill-protocol';

const SELECTORS = [
  { language: 'plaintext' },
  { language: 'typescript' },
  { language: 'typescriptreact' },
  { language: 'javascript' },
  { language: 'javascriptreact' },
];

export const provideAgentCompletion =
  vscode.languages.registerCompletionItemProvider(SELECTORS, {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
    ) {
      const linePrefix = document
        .lineAt(position)
        .text.slice(0, position.character);

      if (linePrefix.includes('@agent')) {
        return undefined;
      }

      const agentActionCompletion = new vscode.CompletionItem('agent');

      agentActionCompletion.label = 'Agent action';
      agentActionCompletion.insertText = new vscode.SnippetString(
        `${editorProtocol.ACTION_PREFIX}:`,
      );
      agentActionCompletion.filterText = 'agent';
      agentActionCompletion.sortText = '0001'; // order higher than agent block
      agentActionCompletion.documentation = new vscode.MarkdownString(
        'Insert @agent action',
      );
      // 這樣才可以觸發 provideAgentAction
      agentActionCompletion.command = {
        command: 'editor.action.triggerSuggest',
        title: 'Suggest agent actions',
      };

      const agentBlockCommentCompletion = new vscode.CompletionItem(
        'agent block',
      );
      agentBlockCommentCompletion.label = 'Agent block';

      agentBlockCommentCompletion.filterText = 'agent';
      agentActionCompletion.sortText = '0000';
      agentBlockCommentCompletion.insertText = new vscode.SnippetString('');
      agentBlockCommentCompletion.command = {
        command: 'pilotfish-vscode.insertAgentBlock',
        title: 'Re-trigger completions...',
      };
      agentBlockCommentCompletion.documentation = new vscode.MarkdownString(
        'Create @agent block comment',
      );

      return [agentActionCompletion, agentBlockCommentCompletion];
    },
  });

export const provideAgentAction =
  vscode.languages.registerCompletionItemProvider(
    SELECTORS,
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
      ) {
        const linePrefix = document
          .lineAt(position)
          .text.slice(0, position.character);

        if (linePrefix.endsWith(`${editorProtocol.PREFIX}:`)) {
          const actionCompletionItems = [
            `${editorProtocol.ACTION}:${editorProtocol.ACTIONS.DO}`,
            `${editorProtocol.ACTION}:${editorProtocol.ACTIONS.ASK}`,
            `${editorProtocol.ACTION}:${editorProtocol.ACTIONS.DISCUSS}`,
          ].map((label) => {
            const item = new vscode.CompletionItem(
              label,
              vscode.CompletionItemKind.Method,
            );

            return item;
          });

          return [
            new vscode.CompletionItem(
              editorProtocol.ACTION,
              vscode.CompletionItemKind.Method,
            ),
            ...actionCompletionItems,
          ];
        }

        if (linePrefix.endsWith(`${editorProtocol.ACTION}:`)) {
          const actionCompletionItems = [
            editorProtocol.ACTIONS.DO,
            editorProtocol.ACTIONS.ASK,
            editorProtocol.ACTIONS.DISCUSS,
          ].map((label) => {
            const item = new vscode.CompletionItem(
              label,
              vscode.CompletionItemKind.Method,
            );

            item.filterText = `${editorProtocol.ACTION_PREFIX}:`;
            item.sortText = '0002';

            return item;
          });

          return actionCompletionItems;
        }

        return undefined;
      },
    },
    ':',
  );
