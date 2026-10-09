import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve, win32 } from 'node:path';
import { AGENT_DEFINITIONS } from './agents.js';
import type { AgentConfig, AppConfig } from './types.js';

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
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
 * ~/.config/skills-manager/.env. If neither exists, we return null and
 * fall back to process.env with cwd as the base for relative paths.
 */
export function findDotenv(cwd: string = process.cwd()): string | null {
	const candidates = [resolve(cwd, '.env'), resolve(homedir(), '.config/skills-manager/.env')];
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

export function loadConfig(cwd: string = process.cwd()): AppConfig {
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

	const sourceRaw = process.env.SKILLS_SOURCE_DIR;
	if (!sourceRaw || sourceRaw.trim() === '') {
		throw new ConfigError(
			'SKILLS_SOURCE_DIR is required. Set it in your .env file or environment.',
		);
	}

	const sourceDir = resolvePath(sourceRaw.trim(), baseDir);

	const agents: AgentConfig[] = [];
	for (const definition of [...AGENT_DEFINITIONS].sort((a, b) =>
		a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
	)) {
		const { id, env } = definition;
		const raw = (process.env[env.skillsDir] ?? '').trim();
		if (raw === '') continue;
		agents.push({
			name: id,
			envVar: env.skillsDir,
			dir: resolvePath(raw, baseDir),
			scanExcludePatterns: readPatterns(env.scanExcludePatterns),
			writeDenyPatterns: readPatterns(env.writeDenyPatterns),
		});
	}

	return {
		envFile,
		sourceDir,
		agents,
	};
}

export function requireAgent(config: AppConfig, name: string): AgentConfig {
	const agent = config.agents.find((a) => a.name === name);
	if (!agent) {
		const available = config.agents.map((a) => a.name).join(', ') || '(none)';
		throw new ConfigError(`Agent "${name}" is not enabled. Enabled agents: ${available}.`);
	}
	return agent;
}
