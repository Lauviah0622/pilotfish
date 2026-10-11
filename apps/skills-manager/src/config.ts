import { existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, win32 } from 'node:path';
import { AGENT_DEFINITIONS } from './agents.js';
import type { AgentConfig, AppConfig } from './types.js';

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

export const GLOBAL_DOTENV_LOCATION = '~/.config/skills-manager/.env';

export function globalDotenvPath(): string {
	return resolve(expandHome(GLOBAL_DOTENV_LOCATION));
}

export function expandHome(p: string): string {
	if (p === '~') return homedir();
	if (p.startsWith('~/')) return resolve(homedir(), p.slice(2));
	return p;
}

/**
 * Resolve a value possibly containing ~ against a base directory (the .env dir).
 * If the path is absolute (after ~ expansion), it is returned as-is.
 */
export function resolvePath(value: string, baseDir: string): string {
	const expanded = expandHome(value);
	if (isAbsolute(expanded)) return expanded;
	return resolve(baseDir, expanded);
}

/**
 * Locate a .env file. Spec forbids --env-file; we look in CWD, then
 * the global configuration location. If neither exists, we return null and
 * fall back to process.env with cwd as the base for relative paths.
 */
export function findDotenv(cwd: string = process.cwd()): string | null {
	const candidates = [resolve(cwd, '.env'), globalDotenvPath()];
	for (const c of candidates) {
		if (existsSync(c) && statSync(c).isFile()) return c;
	}
	return null;
}

function readPatterns(key: string): string[] {
	const raw = process.env[key]?.trim();
	if (!raw) return [];
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw new ConfigError(`${key} must be a JSON array of relative path patterns.`);
	}
	if (
		!Array.isArray(value) ||
		value.some(
			(p) =>
				typeof p !== 'string' ||
				!p.trim() ||
				p !== p.trim() ||
				isAbsolute(p) ||
				win32.parse(p).root !== '' ||
				p.startsWith('!') ||
				p.startsWith('#') ||
				p.includes('\\') ||
				['\r', '\n', '\0'].some((character) => p.includes(character)) ||
				p.split('/').some((part) => part === '..' || part === '.'),
		)
	)
		throw new ConfigError(
			`${key} must contain nonempty root-relative patterns (no negation, absolute paths, or traversal).`,
		);
	return value;
}

export interface PathOverrides {
	readonly source?: string;
	readonly target?: string;
}

export function loadConfig(cwd: string = process.cwd(), overrides: PathOverrides = {}): AppConfig {
	const envFile = findDotenv(cwd);
	if (envFile) {
		try {
			// Node 20.12+ / 21.7+. Does not override already-set process.env keys,
			// which matches shell-wins-over-dotfile convention.
			process.loadEnvFile(envFile);
		} catch (err) {
			throw new ConfigError(`Failed to read ${envFile}: ${(err as Error).message}`);
		}
	}
	const baseDir = envFile ? dirname(envFile) : cwd;

	const sourceRaw = overrides.source ?? process.env.SKILLS_SOURCE_DIR;
	if (!sourceRaw || sourceRaw.trim() === '') {
		throw new ConfigError(
			'SKILLS_SOURCE_DIR is required. Set it in your .env file or environment, or pass --source.',
		);
	}

	const sourceDir = overrides.source
		? resolve(cwd, expandHome(overrides.source))
		: resolvePath(sourceRaw.trim(), baseDir);
	const targetDir = overrides.target ? resolve(cwd, expandHome(overrides.target)) : undefined;

	const agents: AgentConfig[] = [];
	for (const definition of [...AGENT_DEFINITIONS].sort((a, b) =>
		a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
	)) {
		const { id, env } = definition;
		const raw = (process.env[env.skillsDir] ?? '').trim();
		if (raw === '') continue;
		const dir = resolvePath(raw, baseDir);
		if (targetDir && canonicalPath(dir) !== canonicalPath(targetDir)) {
			continue;
		}
		agents.push({
			name: id,
			envVar: env.skillsDir,
			dir,
			scanExcludePatterns: readPatterns(env.scanExcludePatterns),
			writeDenyPatterns: readPatterns(env.writeDenyPatterns),
		});
	}
	if (targetDir) {
		const matchingAgent = agents[0];
		agents.splice(0, agents.length, {
			name: targetDir,
			envVar: '--target',
			dir: targetDir,
			scanExcludePatterns: matchingAgent?.scanExcludePatterns ?? [],
			writeDenyPatterns: matchingAgent?.writeDenyPatterns ?? [],
		});
	}

	return {
		envFile,
		sourceDir,
		sourceOverridden: overrides.source !== undefined,
		agents,
	};
}

function canonicalPath(path: string): string {
	let existing = resolve(path);
	while (!existsSync(existing)) existing = dirname(existing);
	return resolve(realpathSync(existing), relative(existing, path));
}

function containsPath(parent: string, child: string): boolean {
	const rel = relative(parent, child);
	return rel === '' || (rel.split(/[\\/]/)[0] !== '..' && !isAbsolute(rel));
}

export function rejectOverlappingPaths(config: AppConfig): void {
	const source = canonicalPath(config.sourceDir);
	for (const agent of config.agents) {
		const target = canonicalPath(agent.dir);
		if (containsPath(source, target) || containsPath(target, source)) {
			throw new ConfigError(
				`Source and target directories must not overlap: ${config.sourceDir}, ${agent.dir}.`,
			);
		}
	}
}

export function requireAgent(config: AppConfig, name: string): AgentConfig {
	const agent = config.agents.find((a) => a.name === name);
	if (!agent) {
		const available = config.agents.map((a) => a.name).join(', ') || '(none)';
		throw new ConfigError(`Agent "${name}" is not enabled. Enabled agents: ${available}.`);
	}
	return agent;
}
