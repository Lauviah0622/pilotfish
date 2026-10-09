import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeSkill } from './_helpers.mjs';

test('per-skill .gitignore excludes files from inventory on both sides', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', {
			'SKILL.md': 'x\n',
			'.gitignore': 'build/\n*.log\n',
			'build/out.js': 'generated\n',
			'notes.log': 'junk\n',
			'keep.md': 'real\n',
		});
		writeSkill(fx.claudeDir, 'review', {
			'SKILL.md': 'x\n',
			'.gitignore': 'build/\n*.log\n',
			'build/other.js': 'different generated\n',
			'something.log': 'different junk\n',
			'keep.md': 'real\n',
		});
		const r = run(fx.root, ['diff', '--summary']);
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /claude:review\s+synced/);
	} finally {
		fx.cleanup();
	}
});

test('ignore handles character classes (impossible with handwritten matcher)', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', {
			'SKILL.md': 'x\n',
			'.gitignore': 'tmp[0-9].txt\n',
			'tmp5.txt': 'junk\n',
			'tmpA.txt': 'keep\n',
		});
		writeSkill(fx.claudeDir, 'review', {
			'SKILL.md': 'x\n',
			'.gitignore': 'tmp[0-9].txt\n',
			'tmp5.txt': 'DIFFERENT\n',
			'tmpA.txt': 'keep\n',
		});
		const r = run(fx.root, ['diff', '--summary']);
		assert.equal(r.status, 0, r.stderr);
		assert.match(r.stdout, /synced/);
	} finally {
		fx.cleanup();
	}
});

test('ignore honors negation (!keep.log overrides *.log)', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', {
			'SKILL.md': 'x\n',
			'.gitignore': '*.log\n!keep.log\n',
			'junk.log': 'ignored\n',
			'keep.log': 'tracked\n',
		});
		// Claude has keep.log DIFFERENT so if we respect !keep.log the diff fails.
		writeSkill(fx.claudeDir, 'review', {
			'SKILL.md': 'x\n',
			'.gitignore': '*.log\n!keep.log\n',
			'keep.log': 'LOCAL\n',
		});
		const r = run(fx.root, ['diff', '--summary']);
		assert.equal(r.status, 1, r.stderr);
		assert.match(r.stdout, /different/);
	} finally {
		fx.cleanup();
	}
});
