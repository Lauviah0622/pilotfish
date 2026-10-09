import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeSkill } from './_helpers.mjs';

test('doctor reports synced, missing, different, unmanaged', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
			CODEX_SKILLS_DIR: fx.codexDir,
		});

		writeSkill(fx.sourceDir, 'code-review', {
			'SKILL.md': 'canonical review\n',
			'notes.md': 'alpha\n',
		});
		writeSkill(fx.sourceDir, 'debugging', {
			'SKILL.md': 'canonical debug\n',
		});

		// Claude: code-review is drifted, debugging is identical, plus one unmanaged.
		writeSkill(fx.claudeDir, 'code-review', {
			'SKILL.md': 'canonical review\n',
			'notes.md': 'alpha-MODIFIED\n',
		});
		writeSkill(fx.claudeDir, 'debugging', {
			'SKILL.md': 'canonical debug\n',
		});
		writeSkill(fx.claudeDir, 'claude-native', {
			'SKILL.md': 'claude-only\n',
		});

		const res = run(fx.root, ['doctor']);
		assert.equal(res.status, 1, res.stderr);
		assert.match(res.stdout, /SSOT skill roots/);
		assert.match(res.stdout, /code-review/);
		assert.match(res.stdout, /debugging/);
		assert.match(res.stdout, /Deployment matrix/);
		assert.match(res.stdout, /different/);
		assert.match(res.stdout, /missing/);
		assert.match(res.stdout, /unmanaged/i);
		assert.match(res.stdout, /claude-native/);
	} finally {
		fx.cleanup();
	}
});

test('doctor exits 0 when everything is synced; unmanaged alone does not fail it', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'x\n' });
		writeSkill(fx.claudeDir, 'review', { 'SKILL.md': 'x\n' });
		writeSkill(fx.claudeDir, 'local-only', { 'SKILL.md': 'local\n' });

		const res = run(fx.root, ['doctor']);
		assert.equal(res.status, 0, res.stderr);
		assert.match(res.stdout, /local-only/);
	} finally {
		fx.cleanup();
	}
});

test('doctor lists nested skills beneath their deployment root', () => {
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
		const res = run(fx.root, ['doctor']);
		assert.equal(res.status, 1, res.stderr);
		assert.match(res.stdout, /obsidian\s+2 skill\(s\)/);
		assert.match(res.stdout, /obsidian\/skills\/markdown/);
		assert.match(res.stdout, /obsidian\/skills\/canvas/);
		assert.match(res.stdout, /obsidian\s+.*missing/);
		assert.doesNotMatch(res.stdout, /No SKILL.md found/);
	} finally {
		fx.cleanup();
	}
});

test('doctor fails cleanly when SKILLS_SOURCE_DIR is missing', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {});
		const res = run(fx.root, ['doctor']);
		assert.equal(res.status, 2);
		assert.match(res.stderr, /SKILLS_SOURCE_DIR/);
	} finally {
		fx.cleanup();
	}
});
