import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeSkill } from './_helpers.mjs';

test('registered agents use their own directory and rule variables', () => {
	const fx = createFixture();
	try {
		const cursorDir = join(fx.root, 'cursor');
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
			CODEX_SKILLS_DIR: fx.codexDir,
			CURSOR_SKILLS_DIR: cursorDir,
			CLAUDE_SCAN_EXCLUDE_PATTERNS: '\'["hidden/"]\'',
			CODEX_WRITE_DENY_PATTERNS: '\'["demo/"]\'',
			CURSOR_SCAN_EXCLUDE_PATTERNS: '\'["hidden/"]\'',
			CURSOR_WRITE_DENY_PATTERNS: '\'["demo/"]\'',
		});
		writeSkill(fx.sourceDir, 'demo', { 'SKILL.md': 'source\n' });
		for (const root of [fx.claudeDir, fx.codexDir, cursorDir]) {
			writeSkill(root, 'hidden', { 'SKILL.md': 'agent only\n' });
		}
		const claude = run(fx.root, ['apply', '--agent', 'claude']);
		assert.equal(claude.status, 0, claude.stderr);
		for (const agent of ['codex', 'cursor']) {
			const result = run(fx.root, ['apply', '--agent', agent, '--force']);
			assert.equal(result.status, 1, result.stderr);
		}
		const doctor = run(fx.root, ['doctor']);
		assert.equal(doctor.status, 1, doctor.stderr);
		assert.ok(doctor.stdout.includes(cursorDir));
		assert.match(doctor.stdout, /codex: hidden/);
		assert.doesNotMatch(doctor.stdout, /(?:claude|cursor): hidden/);
	} finally {
		fx.cleanup();
	}
});

test('unknown directory variables and rules for disabled agents do not enable agents', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
			CODEX_SKILLS_DIR: '"   "',
			CURSOR_SKILLS_DIR: '""',
			CUSTOM_SKILLS_DIR: join(fx.root, 'custom'),
			CUSTOM_SCAN_EXCLUDE_PATTERNS: 'invalid-json',
			CODEX_WRITE_DENY_PATTERNS: 'invalid-json',
			CURSOR_SCAN_EXCLUDE_PATTERNS: 'invalid-json',
		});
		writeSkill(fx.sourceDir, 'demo', { 'SKILL.md': 'source\n' });
		const doctor = run(fx.root, ['doctor']);
		assert.equal(doctor.status, 1, doctor.stderr);
		for (const agent of ['codex', 'cursor', 'custom']) {
			const diff = run(fx.root, ['diff', '--agent', agent]);
			assert.equal(diff.status, 2);
			assert.match(diff.stderr, /not enabled.*Enabled agents: claude/);
		}
	} finally {
		fx.cleanup();
	}
});

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

test('root without any SKILL.md is invalid in SSOT and fails diff/apply', () => {
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
		assert.match(d.stdout, /No SKILL.md found/);

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
