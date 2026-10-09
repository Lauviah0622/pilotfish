import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeSkill } from './_helpers.mjs';

test('diff shows per-file changes between SSOT and agent', () => {
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
		const res = run(fx.root, ['diff']);
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
