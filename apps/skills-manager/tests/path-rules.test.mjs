import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeSkill } from './_helpers.mjs';

function configure(fx, rules = {}) {
	writeDotenv(fx.envFile, {
		SKILLS_SOURCE_DIR: fx.sourceDir,
		CLAUDE_SKILLS_DIR: fx.claudeDir,
		CODEX_SKILLS_DIR: fx.codexDir,
		...Object.fromEntries(
			Object.entries(rules).map(([key, value]) => [key, `'${JSON.stringify(value)}'`]),
		),
	});
}

test('scan excludes containers, diagnostics, and nested files, rooted per agent', () => {
	const fx = createFixture();
	try {
		configure(fx, { CLAUDE_SCAN_EXCLUDE_PATTERNS: ['.trash/', 'synced/', 'review/cache/'] });
		writeSkill(fx.claudeDir, '.trash', { 'broken/README.md': 'trash' });
		writeSkill(fx.claudeDir, 'synced', { 'nested/SKILL.md': 'external' });
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical', 'cache/file': 'source' });
		writeSkill(fx.claudeDir, 'review', {
			'SKILL.md': 'canonical',
			'cache/file': 'local',
			'.trash/keep': 'visible',
		});
		writeSkill(fx.codexDir, 'synced', { 'SKILL.md': 'unmanaged' });
		const doctor = run(fx.root, ['doctor']);
		assert.match(doctor.stdout, /Path rules/);
		assert.doesNotMatch(doctor.stdout, /claude: (?:\.trash|synced)|Missing SKILL.md/);
		assert.match(doctor.stdout, /codex: synced/);
		const diff = run(fx.root, ['diff', '--agent', 'claude']);
		assert.doesNotMatch(diff.stdout, /cache\/file/);
		assert.match(diff.stdout, /\.trash\/keep/);
	} finally {
		fx.cleanup();
	}
});

for (const args of [['--force'], ['--force', '--dry-run']]) {
	test(`write deny wins over scan exclusion and force: ${args.join(' ')}`, () => {
		const fx = createFixture();
		try {
			configure(fx, {
				CLAUDE_SCAN_EXCLUDE_PATTERNS: ['.system/'],
				CLAUDE_WRITE_DENY_PATTERNS: ['.system/'],
			});
			writeSkill(fx.sourceDir, '.system', { 'SKILL.md': 'source' });
			writeSkill(fx.claudeDir, '.system', { 'nested/SKILL.md': 'agent builtin' });
			writeSkill(fx.sourceDir, 'safe', { 'SKILL.md': 'safe' });
			const result = run(fx.root, ['apply', ...args]);
			assert.equal(result.status, 1, result.stderr);
			assert.match(result.stdout, /claude:\.system\s+blocked\s+write denied/);
			assert.doesNotMatch(result.stdout, /claude:\.system\s+missing/);
			assert.equal(
				readFileSync(join(fx.claudeDir, '.system/nested/SKILL.md'), 'utf8'),
				'agent builtin',
			);
			assert.equal(existsSync(join(fx.claudeDir, '.system/SKILL.md')), false);
			assert.equal(existsSync(join(fx.claudeDir, 'safe/SKILL.md')), !args.includes('--dry-run'));
			assert.equal(existsSync(join(fx.codexDir, '.system/SKILL.md')), !args.includes('--dry-run'));
			assert.ok(
				readdirSync(fx.claudeDir).every(
					(name) => !name.includes('.staging.') && !name.includes('.old.'),
				),
			);
			for (const command of [
				['doctor'],
				['diff', '--agent', 'claude', '--summary'],
				['diff', '--agent', 'claude', '--stat'],
				['diff', '--agent', 'claude'],
			]) {
				assert.match(run(fx.root, command).stdout, /blocked/);
			}
		} finally {
			fx.cleanup();
		}
	});
}

for (const pattern of ['review/protected/', 'review/*.key', 'rev*/private/**', '**/secret/']) {
	test(`protect parent replacement even with absent descendants: ${pattern}`, () => {
		const fx = createFixture();
		try {
			configure(fx, { CLAUDE_WRITE_DENY_PATTERNS: [pattern] });
			writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'source' });
			writeSkill(fx.claudeDir, 'review', { 'SKILL.md': 'local', extra: 'keep' });
			const result = run(fx.root, ['apply', '--agent', 'claude', '--force']);
			assert.equal(result.status, 1, result.stderr);
			assert.match(result.stdout, /write denied/);
			assert.equal(readFileSync(join(fx.claudeDir, 'review/extra'), 'utf8'), 'keep');
		} finally {
			fx.cleanup();
		}
	});
}

test('scan-only rules permit writes, but retain collision protection and accurate dry-run', () => {
	const fx = createFixture();
	try {
		configure(fx, { CLAUDE_SCAN_EXCLUDE_PATTERNS: ['review/'] });
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical' });
		writeSkill(fx.claudeDir, 'review', { 'SKILL.md': 'local' });
		const dry = run(fx.root, ['apply', '--agent', 'claude', '--dry-run']);
		assert.equal(dry.status, 1, dry.stderr);
		assert.match(dry.stdout, /different.*conflict/);
		const apply = run(fx.root, ['apply', '--agent', 'claude', '--force']);
		assert.equal(apply.status, 0, apply.stderr);
		assert.match(apply.stdout, /OK/);
		assert.equal(readFileSync(join(fx.claudeDir, 'review/SKILL.md'), 'utf8'), 'canonical');
	} finally {
		fx.cleanup();
	}
});

test('write-only rules keep agent skills readable in doctor', () => {
	const fx = createFixture();
	try {
		configure(fx, { CLAUDE_WRITE_DENY_PATTERNS: ['native/'] });
		writeSkill(fx.claudeDir, 'native', { 'SKILL.md': 'native' });
		const result = run(fx.root, ['doctor']);
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /claude: native/);
	} finally {
		fx.cleanup();
	}
});

for (const value of [
	'not-json',
	'["../bad/"]',
	'["/absolute/"]',
	'["C:/absolute/"]',
	'["C:relative/"]',
	JSON.stringify(['bad\npattern']),
	JSON.stringify(['bad\rpattern']),
	JSON.stringify(['bad\0pattern']),
	'["!allow"]',
	'[5]',
	'[""]',
]) {
	test(`malformed patterns fail before deployment: ${value}`, () => {
		const fx = createFixture();
		try {
			writeDotenv(fx.envFile, {
				SKILLS_SOURCE_DIR: fx.sourceDir,
				CLAUDE_SKILLS_DIR: fx.claudeDir,
				CLAUDE_WRITE_DENY_PATTERNS: `'${value}'`,
			});
			writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'source' });
			const result = run(fx.root, ['apply', '--force']);
			assert.equal(result.status, 2);
			assert.match(result.stderr, /CLAUDE_WRITE_DENY_PATTERNS/);
			assert.equal(existsSync(join(fx.claudeDir, 'review')), false);
		} finally {
			fx.cleanup();
		}
	});
}
