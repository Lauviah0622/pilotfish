import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeSkill } from './_helpers.mjs';

test('diff defaults to root status and file counts, and --verbose shows per-file changes', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', {
			'SKILL.md': 'alpha\nbeta\n',
			'extra.md': 'one\n',
		});
		writeSkill(fx.claudeDir, 'review', {
			'SKILL.md': 'alpha\nGAMMA\n',
			'legacy.md': 'leftover\n',
		});
		const concise = run(fx.root, ['diff']);
		assert.equal(concise.status, 1, concise.stderr);
		assert.match(concise.stdout, /claude:review\s+different/);
		assert.match(concise.stdout, /1 added, 1 removed, 1 modified/);
		assert.equal(concise.stdout.trim().split('\n').length, 1);
		assert.doesNotMatch(concise.stdout, /SKILL\.md|extra\.md|legacy\.md/);
		assert.equal(concise.stdout, run(fx.root, ['diff', '--summary']).stdout);

		const res = run(fx.root, ['diff', '--verbose']);
		assert.equal(res.status, 1, res.stderr);
		assert.match(res.stdout, /claude:review/);
		assert.match(res.stdout, /different/);
		assert.match(res.stdout, /modified\s+SKILL.md/);
		assert.match(res.stdout, /added\s+extra.md/);
		assert.match(res.stdout, /removed\s+legacy.md/);
		assert.match(res.stdout, /\+beta/);
		assert.match(res.stdout, /-GAMMA/);
	} finally {
		fx.cleanup();
	}
});

test('diff output detail options cannot be combined', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		for (const flags of [
			['--summary', '--verbose'],
			['--stat', '--verbose'],
		]) {
			const res = run(fx.root, ['diff', ...flags]);
			assert.equal(res.status, 2);
			assert.match(res.stderr, /mutually exclusive/);
		}
	} finally {
		fx.cleanup();
	}
});

test('diff --summary gives one-line-per-target', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'a\n' });
		writeSkill(fx.sourceDir, 'debug', { 'SKILL.md': 'b\n' });
		writeSkill(fx.claudeDir, 'review', { 'SKILL.md': 'a\n' });
		const res = run(fx.root, ['diff', '--summary']);
		assert.equal(res.status, 1, res.stderr);
		assert.match(res.stdout, /claude:review\s+synced/);
		assert.match(res.stdout, /claude:debug\s+missing/);
		// 2 lines total.
		assert.equal(res.stdout.trim().split('\n').length, 2);
	} finally {
		fx.cleanup();
	}
});

test('diff --skill limits scope to one skill', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'a\n' });
		writeSkill(fx.sourceDir, 'debug', { 'SKILL.md': 'b\n' });
		const res = run(fx.root, ['diff', '--skill', 'review', '--summary']);
		assert.equal(res.status, 1, res.stderr);
		assert.match(res.stdout, /claude:review/);
		assert.doesNotMatch(res.stdout, /claude:debug/);
	} finally {
		fx.cleanup();
	}
});

test('diff --root reports nested file changes within one root', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'obsidian', {
			'skills/markdown/SKILL.md': '# markdown\n',
			'skills/canvas/SKILL.md': '# canvas\n',
		});
		writeSkill(fx.claudeDir, 'obsidian', {
			'skills/markdown/SKILL.md': '# local\n',
			'skills/canvas/SKILL.md': '# canvas\n',
		});
		const res = run(fx.root, ['diff', '--root', 'obsidian', '--stat']);
		assert.equal(res.status, 1, res.stderr);
		assert.match(res.stdout, /claude:obsidian\s+different/);
		assert.match(res.stdout, /skills\/markdown\/SKILL.md/);
		assert.doesNotMatch(res.stdout, /skills\/canvas\/SKILL.md/);
	} finally {
		fx.cleanup();
	}
});

test('diff fails when --skill does not exist in SSOT', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'a\n' });
		const res = run(fx.root, ['diff', '--skill', 'ghost']);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /not found in SSOT/);
	} finally {
		fx.cleanup();
	}
});

test('empty --root value does not select every root', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'a\n' });
		const res = run(fx.root, ['diff', '--root=']);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /--root requires a value/);
	} finally {
		fx.cleanup();
	}
});

test('diff fails when --agent is disabled', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'a\n' });
		const res = run(fx.root, ['diff', '--agent', 'cursor']);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /not enabled/);
	} finally {
		fx.cleanup();
	}
});
