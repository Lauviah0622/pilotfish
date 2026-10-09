import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeFile, writeSkill } from './_helpers.mjs';

test('apply deploys missing skills and is idempotent', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', {
			'SKILL.md': 'alpha\n',
			'docs/notes.md': 'notes\n',
		});

		const r1 = run(fx.root, ['apply']);
		assert.equal(r1.status, 0, r1.stderr);
		assert.ok(existsSync(join(fx.claudeDir, 'review', 'SKILL.md')));
		assert.equal(readFileSync(join(fx.claudeDir, 'review', 'docs/notes.md'), 'utf8'), 'notes\n');

		// Idempotent re-run.
		const r2 = run(fx.root, ['apply']);
		assert.equal(r2.status, 0, r2.stderr);
		assert.match(r2.stdout, /already synced/i);
	} finally {
		fx.cleanup();
	}
});

test('apply deploys a nested skill root intact and treats it as one target', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'obsidian', {
			'skills/markdown/SKILL.md': '# markdown\n',
			'skills/canvas/SKILL.md': '# canvas\n',
			'skills/canvas/references/schema.md': 'schema\n',
			'README.md': 'shared context\n',
		});

		const first = run(fx.root, ['apply', '--root', 'obsidian']);
		assert.equal(first.status, 0, first.stderr);
		assert.equal((first.stdout.match(/claude:obsidian\s/g) ?? []).length, 3);
		assert.equal(
			readFileSync(join(fx.claudeDir, 'obsidian/skills/canvas/references/schema.md'), 'utf8'),
			'schema\n',
		);
		assert.equal(
			readFileSync(join(fx.claudeDir, 'obsidian/README.md'), 'utf8'),
			'shared context\n',
		);

		writeFile(join(fx.claudeDir, 'obsidian/skills/canvas/SKILL.md'), '# local edit\n');
		const conflict = run(fx.root, ['apply', '--root', 'obsidian']);
		assert.equal(conflict.status, 1, conflict.stderr);
		assert.equal(
			readFileSync(join(fx.claudeDir, 'obsidian/skills/canvas/SKILL.md'), 'utf8'),
			'# local edit\n',
		);
		const forced = run(fx.root, ['apply', '--root', 'obsidian', '--force']);
		assert.equal(forced.status, 0, forced.stderr);
		assert.equal(
			readFileSync(join(fx.claudeDir, 'obsidian/skills/canvas/SKILL.md'), 'utf8'),
			'# canvas\n',
		);
	} finally {
		fx.cleanup();
	}
});

test('apply refuses to overwrite a different target without --force', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical\n' });
		writeSkill(fx.claudeDir, 'review', { 'SKILL.md': 'LOCAL EDIT\n' });

		const r = run(fx.root, ['apply']);
		assert.equal(r.status, 1, r.stderr);
		assert.match(r.stdout, /conflict/);
		assert.equal(readFileSync(join(fx.claudeDir, 'review', 'SKILL.md'), 'utf8'), 'LOCAL EDIT\n');
	} finally {
		fx.cleanup();
	}
});

test('apply --force replaces different targets', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical\n' });
		writeSkill(fx.claudeDir, 'review', { 'SKILL.md': 'LOCAL\n', 'cruft.md': 'junk\n' });

		const r = run(fx.root, ['apply', '--force']);
		assert.equal(r.status, 0, r.stderr);
		assert.equal(readFileSync(join(fx.claudeDir, 'review', 'SKILL.md'), 'utf8'), 'canonical\n');
		assert.equal(existsSync(join(fx.claudeDir, 'review', 'cruft.md')), false);
	} finally {
		fx.cleanup();
	}
});

test('apply --dry-run leaves filesystem unchanged', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical\n' });
		const r = run(fx.root, ['apply', '--dry-run']);
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /dry run/i);
		assert.equal(existsSync(join(fx.claudeDir, 'review')), false);
	} finally {
		fx.cleanup();
	}
});

test('apply does not touch unmanaged agent-only skills', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical\n' });
		writeSkill(fx.claudeDir, 'claude-only', { 'SKILL.md': 'local\n' });
		const r = run(fx.root, ['apply']);
		assert.equal(r.status, 0, r.stderr);
		assert.equal(readFileSync(join(fx.claudeDir, 'claude-only', 'SKILL.md'), 'utf8'), 'local\n');
	} finally {
		fx.cleanup();
	}
});

test('apply creates agent dir if missing', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CODEX_SKILLS_DIR: fx.codexDir, // not pre-created
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'c\n' });
		const r = run(fx.root, ['apply']);
		assert.equal(r.status, 0, r.stderr);
		assert.ok(existsSync(join(fx.codexDir, 'review', 'SKILL.md')));
	} finally {
		fx.cleanup();
	}
});

test('conflict in one target does not block other safe targets in the same run', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'alpha', { 'SKILL.md': 'canonical-a\n' });
		writeSkill(fx.sourceDir, 'beta', { 'SKILL.md': 'canonical-b\n' });
		writeSkill(fx.claudeDir, 'alpha', { 'SKILL.md': 'LOCAL\n' });

		const r = run(fx.root, ['apply']);
		assert.equal(r.status, 1, r.stderr);
		// beta still created despite alpha being refused.
		assert.equal(readFileSync(join(fx.claudeDir, 'beta', 'SKILL.md'), 'utf8'), 'canonical-b\n');
		assert.equal(readFileSync(join(fx.claudeDir, 'alpha', 'SKILL.md'), 'utf8'), 'LOCAL\n');
	} finally {
		fx.cleanup();
	}
});

test('apply ignores .DS_Store on both sides', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'c\n' });
		// Pre-existing synced skill but with a .DS_Store on the agent side.
		writeSkill(fx.claudeDir, 'review', { 'SKILL.md': 'c\n' });
		writeFile(join(fx.claudeDir, 'review', '.DS_Store'), 'junk');
		const r = run(fx.root, ['diff', '--summary']);
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /claude:review\s+synced/);
	} finally {
		fx.cleanup();
	}
});
