import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	ArchiveError,
	detectFormat,
	extractArchive,
	fetchArchive,
	findSingleTopLevelDir,
	inferSkillName,
} from '../archive.js';
import { bold, dim, green, yellow } from '../format.js';
import { atomicDeploy, dirExists, ensureDir } from '../fsutil.js';
import { isValidSkillName, readSkill } from '../inventory.js';
import type { AppConfig } from '../types.js';

export interface ImportOptions {
	readonly url: string;
	readonly subdir?: string;
	readonly as?: string;
	readonly force: boolean;
}

export interface ImportResult {
	readonly exitCode: 0 | 1 | 2;
	readonly output: string;
}

export async function runImport(config: AppConfig, options: ImportOptions): Promise<ImportResult> {
	const format = detectFormat(options.url);

	const sections: string[] = [];
	sections.push(bold('Importing skill root from URL'));
	sections.push(`  ${dim('url    ')} ${options.url}`);
	sections.push(`  ${dim('format ')} ${format}`);
	if (options.subdir) sections.push(`  ${dim('subdir ')} ${options.subdir}`);

	let buffer: Buffer;
	try {
		buffer = await fetchArchive(options.url);
	} catch (err) {
		return fail(sections, `fetch failed: ${(err as Error).message}`);
	}
	sections.push(`  ${dim('size   ')} ${formatBytes(buffer.length)}`);

	const tmpRoot = mkdtempSync(join(tmpdir(), 'skills-import-'));
	const stagingDir = join(tmpRoot, 'extract');
	ensureDir(stagingDir);

	try {
		try {
			await extractArchive(buffer, format, stagingDir);
		} catch (err) {
			return fail(sections, `extract failed: ${(err as Error).message}`);
		}

		// Auto-strip single top-level dir (GitHub repo-main/, npm package/).
		let skillRoot = stagingDir;
		const topDir = findSingleTopLevelDir(skillRoot);
		if (topDir) {
			skillRoot = join(skillRoot, topDir);
			sections.push(`  ${dim('strip  ')} ${topDir}/`);
		}

		if (options.subdir) {
			skillRoot = join(skillRoot, options.subdir);
			if (!dirExists(skillRoot)) {
				return fail(sections, `--subdir "${options.subdir}" not found in archive`);
			}
		}

		const importedRoot = readSkill('import', skillRoot);
		if (!importedRoot.valid) return fail(sections, importedRoot.diagnostics.join('; '));

		const inferred = inferSkillName(options.url, options.subdir, options.as);
		if (!inferred) {
			return fail(sections, 'Could not infer a skill name from URL — pass --as <name>');
		}
		if (!isValidSkillName(inferred)) {
			return fail(
				sections,
				`Inferred skill name "${inferred}" is not a safe directory name — use --as <name>`,
			);
		}
		sections.push(`  ${dim('name   ')} ${inferred}`);

		const target = join(config.sourceDir, inferred);
		const targetExists = dirExists(target);
		if (targetExists && !options.force) {
			return fail(
				sections,
				`SSOT already contains "${inferred}" at ${target} — rerun with --force to replace or use --as`,
			);
		}

		ensureDir(config.sourceDir);
		try {
			atomicDeploy(skillRoot, target, targetExists);
		} catch (err) {
			return fail(sections, `write failed: ${(err as Error).message}`);
		}

		sections.push('');
		sections.push(
			`${targetExists ? yellow('replaced') : green('imported')} ${bold(inferred)} → ${target}`,
		);
		sections.push(dim('Next step: run `skills apply` to deploy to agents.'));
		return { exitCode: 0, output: sections.join('\n') };
	} finally {
		try {
			rmSync(tmpRoot, { recursive: true, force: true });
		} catch {
			// Best effort — tmp dir cleanup.
		}
	}
}

function fail(sections: string[], message: string): ImportResult {
	sections.push('');
	sections.push(`error: ${message}`);
	// ArchiveError and user-input problems are code 2 (config/arg/I-O errors);
	// anything that bubbles up here is in the same category.
	return { exitCode: 2, output: sections.join('\n') };
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

// Re-export so callers can distinguish archive errors cleanly if needed.
export { ArchiveError };
