import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ignore, { type Ignore } from 'ignore';
import { dirExists, fileExists, hashFile, listFiles } from './fsutil.js';
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
 * Scan a root directory and return the skills it contains. Each direct
 * subdirectory is treated as a skill candidate.
 */
export function scanInventory(root: string): InventoryResult {
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

	const diagnostics: string[] = [];
	const skills: SkillInventoryEntry[] = [];

	for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
		if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
		const name = String(entry.name);
		const skillPath = join(root, name);
		if (!isValidSkillName(name)) {
			diagnostics.push(`Skipped invalid skill directory name: ${name}`);
			continue;
		}
		skills.push(readSkill(name, skillPath));
	}

	return { root, skills, diagnostics, rootExists: true };
}

function readSkill(name: string, root: string): SkillInventoryEntry {
	const diagnostics: string[] = [];
	const skillMd = join(root, 'SKILL.md');
	let valid = true;
	if (!fileExists(skillMd)) {
		diagnostics.push(`Missing SKILL.md in ${root}`);
		valid = false;
	}
	let files: SkillFile[] = [];
	try {
		const ig = makeIgnorer(root);
		const walked = listFiles(root, ig);
		files = walked.map((w) => ({
			relPath: w.rel,
			size: w.size,
			sha256: hashFile(w.abs),
		}));
	} catch (err) {
		diagnostics.push(`Failed to read ${root}: ${(err as Error).message}`);
		valid = false;
	}
	return { name, root, files, diagnostics, valid };
}
