import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Modal,
	Notice,
	Plugin,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	ObsidianPilotFishPluginSettings,
	ObsidianPilotFishPluginSettingTab,
} from './settings';

// Remember to rename these classes and interfaces!

export default class ObsidianPilotFishPlugin extends Plugin {
	settings!: ObsidianPilotFishPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');

		/**
		 * @agent ask
		 * If I wanna add a button on the left of the toolbar, How would you do?
		 * @reply: Use `this.addRibbonIcon(...)` inside `onload()`. That creates a
		 *   left ribbon button in Obsidian desktop. Example:
		 *   `this.addRibbonIcon('fish', 'Pilotfish', () => { new Notice('clicked'); });`
		 *   Keep the callback thin and call the same logic as a command if the
		 *   action should be reusable.
		 * @status: replied
		 * @agent do
		 * ADd the button
		 * @reply: Done. Added a minimal left ribbon button in `onload()`
		 *   that shows a notice when clicked.
		 * @status: done
		 */

		this.addRibbonIcon('plus', 'Pilotfish', () => {
			new Notice('Pilotfish ribbon clicked');
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'make-liner-collab-cmd',
			name: 'Make one line collab prompt',
			editorCallback: async (
				editor: Editor,
				ctx: MarkdownView | MarkdownFileInfo,
			) => {
				const path = ctx.file?.path;
				if (!path) {
					new Notice('No active file');
					return;
				}

				const line = editor.getCursor().line + 1;
						/**
						 * @agent ask
						 * how to get the setting value
						 * @reply: Read it from `this.settings` after `await this.loadSettings()`
						 *   runs in `onload()`. In this callback, for example, use
						 *   `this.settings.promptPrefix` or `this.settings.skillBasePath`.
						 * @status: replied
						 * 
						 * @agent do
						 * I want the command get from settings, check the ./settings and Prompt prefix
						 * @reply: Done. The command now reads `this.settings.promptPrefix`,
						 *   so the copied `$collab path:line` prefix follows the plugin setting.
						 * @status: done
						 */
						const command = this.settings.promptPrefix;
				const ref = `${command} ${path}:${line}`;
				await navigator.clipboard.writeText(ref);
				new Notice(`Copied ${ref}`);
			},
		});

		this.addCommand({
			id: 'insert-agent-block',
			name: 'Insert for agent block',
			editorCallback: (editor) => {
				const BLOCK_TEMPLATE = `
> [!Question] For Agent
> ...
`;

				editor.replaceRange(BLOCK_TEMPLATE, editor.getCursor());
				new Notice('Block inserted!!');
			},
		});

		this.addSettingTab(
			new ObsidianPilotFishPluginSettingTab(this.app, this),
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ObsidianPilotFishPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
