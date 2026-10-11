import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, cwd = packageDir, inherit = false) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: 'utf8',
		stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(' ')} failed: ${result.stderr?.trim() || result.status}`,
		);
	}
	return result.stdout?.trim() ?? '';
}

function requireCleanMain(repoRoot) {
	const branch = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], repoRoot);
	if (branch !== 'main') throw new Error(`Publish from main only (current branch: ${branch}).`);
	if (run('git', ['status', '--porcelain=v1', '--untracked-files=all'], repoRoot)) {
		throw new Error('Commit or remove all working tree changes before publishing.');
	}
	const head = run('git', ['rev-parse', 'HEAD'], repoRoot);
	const remoteHead = run('git', ['ls-remote', 'origin', 'refs/heads/main'], repoRoot).split(
		'\t',
	)[0];
	if (!remoteHead) throw new Error('origin/main was not found.');
	if (head !== remoteHead) throw new Error('main must match the pushed origin/main commit.');
}

function makeNotes(name, previousTag, repoRoot, packagePath) {
	if (!previousTag) return `## Initial release\n\nFirst release of ${name}.\n`;
	const range = `${previousTag}..HEAD`;
	const subjects = run('git', ['log', '--format=%s', range, '--', packagePath], repoRoot)
		.split('\n')
		.filter(Boolean);
	const stat = run('git', ['diff', '--stat', range, '--', packagePath], repoRoot);
	if (!stat) throw new Error(`No changes in ${packagePath} since ${previousTag}.`);
	const summary = subjects.length
		? subjects.map((subject) => `- ${subject}`).join('\n')
		: '- Package files changed.';
	return `## Changes since \`${previousTag}\`\n\n${summary}\n\n## File summary\n\n\`\`\`text\n${stat}\n\`\`\`\n`;
}

function main() {
	if (process.argv.length > 2) throw new Error('Usage: pnpm run publish');
	const { name, version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
	if (!name || !version) throw new Error('package.json must have a name and version.');
	const tag = `${name}@${version}`;
	const title = `${name} ${version}`;
	const repoRoot = run('git', ['rev-parse', '--show-toplevel']);
	const packagePath = relative(repoRoot, packageDir).split(sep).join('/');

	requireCleanMain(repoRoot);
	run('git', ['fetch', 'origin', '--tags'], repoRoot);
	requireCleanMain(repoRoot);
	if (run('git', ['tag', '--list', tag], repoRoot)) throw new Error(`Tag already exists: ${tag}`);
	if (run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], repoRoot)) {
		throw new Error(`Remote tag already exists: ${tag}`);
	}
	const previousTag = run(
		'git',
		['tag', '--merged', 'HEAD', '--list', `${name}@*`, '--sort=-version:refname'],
		repoRoot,
	)
		.split('\n')
		.find(Boolean);
	const notes = makeNotes(name, previousTag, repoRoot, packagePath);

	run('pnpm', ['run', 'test'], packageDir, true);
	const packs = JSON.parse(run('npm', ['pack', '--json'], packageDir));
	const pack = packs[0];
	if (packs.length !== 1 || pack.name !== name || pack.version !== version) {
		throw new Error('npm pack returned an unexpected package or version.');
	}
	if (!pack.files?.some((file) => file.path === 'dist/skills.js')) {
		throw new Error('npm pack did not include dist/skills.js.');
	}
	requireCleanMain(repoRoot);

	const notesDir = mkdtempSync(join(tmpdir(), 'skills-manager-release-'));
	try {
		const notesFile = join(notesDir, 'notes.md');
		writeFileSync(notesFile, notes);
		run(
			'gh',
			[
				'release',
				'create',
				tag,
				join(packageDir, pack.filename),
				'--target',
				'main',
				'--title',
				title,
				'--notes-file',
				notesFile,
			],
			repoRoot,
			true,
		);
	} finally {
		rmSync(notesDir, { recursive: true, force: true });
	}
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
