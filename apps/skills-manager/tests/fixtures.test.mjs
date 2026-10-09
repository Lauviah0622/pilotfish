import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { copyRootFixture, createFixture, run, writeDotenv, writeFile } from './_helpers.mjs';

function readTree(root) {
	function visit(dir) {
		return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) return visit(path);
			assert.ok(entry.isFile(), `Unexpected non-file fixture entry: ${path}`);
			return [{ path: relative(root, path), content: readFileSync(path) }];
		});
	}

	return visit(root).sort((a, b) => a.path.localeCompare(b.path));
}

function configureClaude(fx) {
	writeDotenv(fx.envFile, {
		SKILLS_SOURCE_DIR: fx.sourceDir,
		CLAUDE_SKILLS_DIR: fx.claudeDir,
	});
}

test('simple skill fixture is discovered and apply is idempotent', () => {
	const fx = createFixture();
	try {
		configureClaude(fx);
		copyRootFixture(fx.sourceDir, 'simple-skill');

		const before = run(fx.root, ['doctor']);
		assert.equal(before.status, 1, before.stderr);
		assert.match(before.stdout, /simple-skill\s+1 skill\(s\)/);
		assert.match(before.stdout, /simple-skill\s+.*missing/);

		const first = run(fx.root, ['apply', '--root', 'simple-skill']);
		assert.equal(first.status, 0, first.stderr || first.stdout);
		assert.deepEqual(
			readTree(join(fx.claudeDir, 'simple-skill')),
			readTree(join(fx.sourceDir, 'simple-skill')),
		);

		const second = run(fx.root, ['apply', '--root', 'simple-skill']);
		assert.equal(second.status, 0, second.stderr || second.stdout);
		assert.match(second.stdout, /already synced/i);
	} finally {
		fx.cleanup();
	}
});

test('Vercel fixture deploys its complete root and detects a nested rule change', () => {
	const fx = createFixture();
	try {
		configureClaude(fx);
		copyRootFixture(fx.sourceDir, 'react-best-practices');

		const before = run(fx.root, ['doctor']);
		assert.equal(before.status, 1, before.stderr);
		assert.match(before.stdout, /react-best-practices\s+1 skill\(s\)/);

		const applied = run(fx.root, ['apply', '--root', 'react-best-practices']);
		assert.equal(applied.status, 0, applied.stderr || applied.stdout);
		assert.deepEqual(
			readTree(join(fx.claudeDir, 'react-best-practices')),
			readTree(join(fx.sourceDir, 'react-best-practices')),
		);

		const rule = join(fx.claudeDir, 'react-best-practices', 'rules', 'async-parallel.md');
		writeFile(rule, '# Local edit\n');
		const diff = run(fx.root, ['diff', '--root', 'react-best-practices', '--stat']);
		assert.equal(diff.status, 1, diff.stderr);
		assert.match(diff.stdout, /claude:react-best-practices\s+different/);
		assert.match(diff.stdout, /rules\/async-parallel\.md/);
		assert.doesNotMatch(diff.stdout, /rules\/rerender-memo\.md/);

		const conflict = run(fx.root, ['apply', '--root', 'react-best-practices']);
		assert.equal(conflict.status, 1, conflict.stderr);
		assert.equal(readFileSync(rule, 'utf8'), '# Local edit\n');
	} finally {
		fx.cleanup();
	}
});

test('Obsidian fixture discovers six nested skills and deploys the repository root intact', () => {
	const fx = createFixture();
	try {
		configureClaude(fx);
		copyRootFixture(fx.sourceDir, 'obsidian-skills');

		const before = run(fx.root, ['doctor']);
		assert.equal(before.status, 1, before.stderr);
		assert.match(before.stdout, /obsidian-skills\s+6 skill\(s\)/);
		assert.match(before.stdout, /obsidian-skills\/skills\/json-canvas/);
		assert.match(before.stdout, /obsidian-skills\/skills\/obsidian-markdown/);

		const applied = run(fx.root, ['apply', '--root', 'obsidian-skills']);
		assert.equal(applied.status, 0, applied.stderr || applied.stdout);
		assert.equal(existsSync(join(fx.claudeDir, 'obsidian-skills', 'SKILL.md')), false);
		assert.ok(existsSync(join(fx.claudeDir, 'obsidian-skills', '.claude-plugin', 'plugin.json')));
		assert.deepEqual(
			readTree(join(fx.claudeDir, 'obsidian-skills')),
			readTree(join(fx.sourceDir, 'obsidian-skills')),
		);

		const diff = run(fx.root, ['diff', '--root', 'obsidian-skills', '--summary']);
		assert.equal(diff.status, 0, diff.stderr);
		assert.match(diff.stdout, /claude:obsidian-skills\s+synced/);
	} finally {
		fx.cleanup();
	}
});
