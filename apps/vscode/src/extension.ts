// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
	provideAgentAction,
	provideAgentCompletion,
} from './subscriptions/agentBlockCompletions';
import { insertAgentBlock } from './subscriptions/insertAgentBlock';
import { makeAgentCommand } from './subscriptions/makeAgentCommand';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const helloWorld = vscode.commands.registerCommand('pilotfish-vscode.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from pilotfish-vscode!');
		console.log('Hello World from pilotfish-vscode!');
	});

	context.subscriptions.push(
		helloWorld,
		insertAgentBlock,
		makeAgentCommand,
		provideAgentAction,
		provideAgentCompletion,
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
