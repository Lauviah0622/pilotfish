import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { cancel, confirm, intro, isCancel, log, outro, text } from '@clack/prompts';
import { AGENT_DEFINITIONS } from '../agents.js';
import { globalDotenvPath, rejectOverlappingPaths, resolvePath } from '../config.js';
import type { AgentConfig } from '../types.js';

const DEFAULT_SOURCE = '~/.skills/skills';

function validatePathInput(value: string | undefined): string | undefined {
	if (/[\0\r\n"]/.test(value ?? '')) return 'Paths cannot contain quotes or line breaks.';
	return undefined;
}

function selectedPath(
	answer: string,
	suggested: string,
	cwd: string,
): { saved: string; full: string } {
	const value = answer.trim() || suggested;
	const error = validatePathInput(value);
	if (error) throw new Error(error);
	const saved = value.startsWith('~/') || value === '~' ? value : resolve(cwd, value);
	return { saved, full: resolvePath(saved, cwd) };
}

function cancelled(): number {
	cancel('Setup cancelled.');
	return 1;
}

/** Guide a user through a first-time global configuration without replacing existing data. */
export async function runInit(cwd: string = process.cwd()): Promise<number> {
	const configFile = globalDotenvPath();
	if (existsSync(configFile)) {
		process.stdout.write(`Configuration already exists: ${configFile}\nEdit it to change paths.\n`);
		return 0;
	}

	intro('Skills Manager setup');
	log.info(`Create ${configFile}`);
	if (existsSync(resolve(cwd, '.env'))) {
		log.warn('The .env in this directory takes precedence when running here.');
	}
	log.info('The SSOT is the parent directory of your skill roots.');

	const sourceAnswer = await text({
		message: 'SSOT directory',
		placeholder: DEFAULT_SOURCE,
		defaultValue: DEFAULT_SOURCE,
		validate: validatePathInput,
	});
	if (isCancel(sourceAnswer)) return cancelled();
	const source = selectedPath(sourceAnswer, DEFAULT_SOURCE, cwd);
	const selected: {
		definition: (typeof AGENT_DEFINITIONS)[number];
		path: { saved: string; full: string };
	}[] = [];
	for (const definition of AGENT_DEFINITIONS) {
		const configHomes = definition.configDirs.map((path) => resolvePath(path, cwd));
		const foundHome = configHomes.find(
			(path) => statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false,
		);
		const status = foundHome
			? 'configuration directory found'
			: 'configuration directory not found';
		const enabled = await confirm({
			message: `${definition.displayName}: ${status} (${foundHome ?? configHomes.join(', ')}). Configure skills?`,
			initialValue: Boolean(foundHome),
		});
		if (isCancel(enabled)) return cancelled();
		if (!enabled) continue;
		const answer = await text({
			message: `${definition.displayName} skills directory`,
			placeholder: definition.defaultSkillsDir,
			defaultValue: definition.defaultSkillsDir,
			validate: validatePathInput,
		});
		if (isCancel(answer)) return cancelled();
		selected.push({ definition, path: selectedPath(answer, definition.defaultSkillsDir, cwd) });
	}

	const dirs = new Set<string>();
	const agents: AgentConfig[] = selected.map(({ definition, path }) => {
		if (dirs.has(path.full)) throw new Error(`Agent skills directory selected twice: ${path.full}`);
		dirs.add(path.full);
		return {
			name: definition.id,
			envVar: definition.env.skillsDir,
			dir: path.full,
			scanExcludePatterns: [],
			writeDenyPatterns: [],
		};
	});
	rejectOverlappingPaths({
		envFile: null,
		sourceDir: source.full,
		sourceOverridden: false,
		agents,
	});

	const lines = [
		'# Skills Manager: edit these paths for this machine.',
		`SKILLS_SOURCE_DIR="${source.saved}"`,
	];
	for (const { definition, path } of selected) {
		lines.push(`${definition.env.skillsDir}="${path.saved}"`);
		if (definition.id === 'codex') {
			lines.push(`${definition.env.scanExcludePatterns}='[".system/"]'`);
			lines.push(`${definition.env.writeDenyPatterns}='[".system/"]'`);
		}
		if (definition.id === 'claude') {
			lines.push(`${definition.env.scanExcludePatterns}='[".trash/", "synced/"]'`);
			lines.push(`${definition.env.writeDenyPatterns}='[".trash/", "synced/"]'`);
		}
	}
	mkdirSync(source.full, { recursive: true });
	mkdirSync(dirname(configFile), { recursive: true, mode: 0o700 });
	writeFileSync(configFile, `${lines.join('\n')}\n`, { flag: 'wx', mode: 0o600 });
	log.success(`Created ${configFile}`);
	log.info(`SSOT: ${source.full}`);
	for (const { definition, path } of selected) {
		log.info(`${definition.displayName}: ${path.full}`);
	}
	if (selected.length === 0) log.warn('No agents selected; edit the .env to add one later.');
	outro('Next: run skills doctor to inspect the configuration.');
	return 0;
}
