import {
	App,
	DataAdapter,
	Notice,
	PluginSettingTab,
	Setting,
} from 'obsidian';
import MyPlugin from './main';

async function copyPluginFolder(
	adapter: DataAdapter,
	source: string,
	target: string,
): Promise<void> {
	if (!(await adapter.exists(target))) {
		await adapter.mkdir(target);
	}
	const { files, folders } = await adapter.list(source);
	for (const file of files) {
		const name = file.substring(file.lastIndexOf('/') + 1);
		const data = await adapter.readBinary(file);
		await adapter.writeBinary(`${target}/${name}`, data);
	}
	for (const folder of folders) {
		const name = folder.substring(folder.lastIndexOf('/') + 1);
		await copyPluginFolder(adapter, folder, `${target}/${name}`);
	}
}

export interface ObsidianPilotFishPluginSettings {
	skillBasePath: string;
	promptPrefix: string;
}

const DIR_NAME = 'obsidian-pilot-fish'

export const DEFAULT_SETTINGS: ObsidianPilotFishPluginSettings = {
	skillBasePath: `agents/skills/${DIR_NAME}`,
	promptPrefix: '$collab',
};

export class ObsidianPilotFishPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Skill path')
			.setDesc("set the skill path which will apply into")
			.addText((text) =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.skillBasePath)
					.onChange(async (value) => {
						this.plugin.settings.skillBasePath = value;
						await this.plugin.saveSettings();
					}),
			);
		
		new Setting(containerEl)
			.setName('Apply the ')
			.setDesc("set the skill path which will apply into")
			.addButton((btn) => {
				/**
				 * @claude ask
				 * How will you implement the code that copy some file into the target path
				 * @reply: Depends on where the source lives.
				 *   - Source is inside the vault: `const src = this.app.vault.getFileByPath(srcPath);`
				 *     then `await this.app.vault.copy(src, `${this.plugin.settings.skillBasePath}/${name}`);`
				 *     — `vault.copy` handles TFile → new path within the vault. Ensure the target folder
				 *     exists first with `await this.app.vault.createFolder(dir).catch(() => {})`.
				 *   - Source bundled with the plugin (e.g. `assets/skill.md`): read via
				 *     `await this.app.vault.adapter.read(pluginDir + '/assets/skill.md')` then
				 *     `await this.app.vault.adapter.write(targetPath, contents)`. `adapter` accepts
				 *     paths outside vault-tracked files (like the plugin dir).
				 *   - Source on disk outside vault (desktop only): Node `fs/promises` works since
				 *     Obsidian is Electron, but breaks the mobile build — avoid unless desktop-only.
				 *   Wrap the button handler in try/catch and surface errors with `new Notice(err.message)`.
				 * @status: replied
				 */
				/**
				 * @claude do
				 * OK great. implement that copy the target folder, leave the folder path start from the plugin root folder
				 * @reply: Done — button labeled "Apply" (CTA). On click, resolves source as `${manifest.dir}/skills` (plugin-root-relative), target as settings.skillBasePath, and recurses via copyPluginFolder helper using adapter.list/readBinary/writeBinary. Errors surfaced with Notice.
				 * @status: done
				 */
				btn.setButtonText('Apply')
					.setCta()
					.onClick(async () => {
						try {
							const pluginDir = this.plugin.manifest.dir;
							if (!pluginDir) {
								throw new Error('Plugin directory unavailable');
							}
							const source = `${pluginDir}/assets/skills/${DIR_NAME}`;
							const target = this.plugin.settings.skillBasePath;
							await copyPluginFolder(
								this.app.vault.adapter,
								source,
								target,
							);
							new Notice(`Copied ${source} → ${target}`);
						} catch (err) {
							new Notice(`Copy failed: ${(err as Error).message}`);
						}
					});
			})

		new Setting(containerEl)
			.setName('Prompt prefix')
			.addText((text) =>
				text
					.setPlaceholder('Enter your prompt prefix')
					.setValue(this.plugin.settings.promptPrefix)
					.onChange(async (value) => {
						this.plugin.settings.promptPrefix = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
