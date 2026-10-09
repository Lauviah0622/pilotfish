import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeSkill } from './_helpers.mjs';

test('.env paths are resolved relative to the .env file dir', () => {
	const fx = createFixture();
	try {
		// Use relative paths in .env so we exercise the baseDir resolution.
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: './ssot',
			CLAUDE_SKILLS_DIR: './claude',
		});
		writeSkill(fx.sourceDir, 'r', { 'SKILL.md': 'x\n' });
		const r = run(fx.root, ['doctor']);
		assert.equal(r.status, 1, r.stderr);
		assert.match(r.stdout, / r\b/);
	} finally {
		fx.cleanup();
	}
});

test('invalid SKILL.md (missing) marks skill invalid in SSOT and fails diff/apply', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'broken', { 'README.md': 'no skill md\n' });
		const d = run(fx.root, ['doctor']);
		// doctor should list diagnostic but still exit 1 due to missing deployment.
		assert.notEqual(d.status, 2);
		assert.match(d.stdout, /Missing SKILL.md/);

		const a = run(fx.root, ['apply']);
		assert.equal(a.status, 2);
		assert.match(a.stderr, /Invalid skill/);
	} finally {
		fx.cleanup();
	}
});

test('config error when SKILLS_SOURCE_DIR is just whitespace', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: '   ' });
		const r = run(fx.root, ['doctor']);
		assert.equal(r.status, 2);
	} finally {
		fx.cleanup();
	}
});

test('absolute ~ paths are expanded', () => {
	// We can't write to the real home; just make sure the parser does not reject it
	// by testing it only indirectly — set a bogus ~ path and expect "SSOT not found"
	// behavior without a crash.
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: '~/nonexistent-skills-manager-test',
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		const r = run(fx.root, ['doctor']);
		// Should not crash; may exit 0 or 1 depending on whether other agents have skills.
		assert.notEqual(r.status, 2, r.stderr);
		assert.match(r.stdout, new RegExp(homedir().replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')));
	} finally {
		fx.cleanup();
	}
});
