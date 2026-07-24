import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Modal,
	Notice,
	Plugin,
} from 'obsidian';
import { DEFAULT_SETTINGS, ObsidianPilotFishPluginSettings, ObsidianPilotFishPluginSettingTab } from './settings';

// Remember to rename these classes and interfaces!

export default class ObsidianPilotFishPlugin extends Plugin {
	settings!: ObsidianPilotFishPluginSettings;

	async onload() {
		await this.loadSettings();
		
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');

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
				const command = '$collab';
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


		this.addSettingTab(new ObsidianPilotFishPluginSettingTab(this.app, this));

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
