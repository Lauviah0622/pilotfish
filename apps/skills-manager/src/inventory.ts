import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ignore, { type Ignore } from 'ignore';
import { dirExists, hashFile, listFiles } from './fsutil.js';
import { pathMatcher } from './path-rules.js';
import type { InventoryResult, SkillFile, SkillInventoryEntry } from './types.js';

const UNSAFE_NAME = /(^$)|(^\.{1,2}$)|[/\\\0]/;

const BUILTIN_IGNORE = ['.git/', '.DS_Store', 'Thumbs.db'];

export function isValidSkillName(name: string): boolean {
	return !UNSAFE_NAME.test(name);
}

function makeIgnorer(skillRoot: string): Ignore {
	const ig = ignore().add(BUILTIN_IGNORE);
	try {
		ig.add(readFileSync(join(skillRoot, '.gitignore'), 'utf8'));
	} catch {
		// No gitignore in this skill — built-in rules only.
	}
	return ig;
}

/**
 * Scan a directory and return its skill roots. Each direct subdirectory is
 * one deployment unit; SKILL.md may appear anywhere inside that unit.
 */
export function scanInventory(
	root: string,
	excludePatterns: readonly string[] = [],
): InventoryResult {
	if (!dirExists(root)) {
		return { root, skills: [], diagnostics: [], rootExists: false };
	}

	let entries: Array<{
		name: string;
		isDirectory(): boolean;
		isSymbolicLink(): boolean;
	}>;
	try {
		entries = readdirSync(root, { withFileTypes: true, encoding: 'utf8' });
	} catch (err) {
		return {
			root,
			skills: [],
			diagnostics: [`Failed to read ${root}: ${(err as Error).message}`],
			rootExists: true,
		};
	}

	const excluded = pathMatcher(excludePatterns);
	const ignored = makeIgnorer(root);
	const diagnostics: string[] = [];
	const skills: SkillInventoryEntry[] = [];

	for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		const name = String(entry.name);
		const skillPath = join(root, name);
		if (ignored.ignores(`${name}/`) || excluded.ignores(`${name}/`)) continue;
		if (!isValidSkillName(name)) {
			diagnostics.push(`Skipped invalid skill root directory name: ${name}`);
			continue;
		}
		skills.push(readSkill(name, skillPath, excluded));
	}

	return { root, skills, diagnostics, rootExists: true };
}

export function readSkill(
	name: string,
	root: string,
	excluded: Ignore = pathMatcher([]),
): SkillInventoryEntry {
	const diagnostics: string[] = [];
	let valid = true;
	let files: SkillFile[] = [];
	let skillPaths: string[] = [];
	try {
		const ig = makeIgnorer(root);
		const walked = listFiles(root, ig, (path) => excluded.ignores(`${name}/${path}`));
		skillPaths = walked
			.filter((w) => w.rel === 'SKILL.md' || w.rel.endsWith('/SKILL.md'))
			.map((w) => (w.rel === 'SKILL.md' ? '.' : w.rel.slice(0, -'/SKILL.md'.length)));
		if (skillPaths.length === 0) {
			diagnostics.push(`No SKILL.md found in ${root}`);
			valid = false;
		}
		files = walked.map((w) => ({
			relPath: w.rel,
			size: w.size,
			sha256: hashFile(w.abs),
		}));
	} catch (err) {
		diagnostics.push(`Failed to read ${root}: ${(err as Error).message}`);
		valid = false;
	}
	return { name, root, skillPaths, files, diagnostics, valid };
}
