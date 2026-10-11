import assert from 'node:assert/strict';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFixture, run, writeDotenv, writeFile, writeSkill } from './_helpers.mjs';

test('--source selects a different inventory while keeping the configured agents', () => {
	const fx = createFixture();
	try {
		const scopedSource = join(fx.root, 'scoped-source');
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'global', { 'SKILL.md': 'global\n' });
		writeSkill(scopedSource, 'local', { 'SKILL.md': 'local\n' });

		const doctor = run(fx.root, ['doctor', '--source', './scoped-source']);
		assert.equal(doctor.status, 1, doctor.stderr);
		assert.match(doctor.stdout, /Source skill roots/);
		assert.doesNotMatch(doctor.stdout, /SSOT skill roots/);
		assert.match(doctor.stdout, /local/);
		assert.doesNotMatch(doctor.stdout, /\bglobal\b/);

		const diff = run(fx.root, ['diff', '--source', './scoped-source']);
		assert.equal(diff.status, 1, diff.stderr);
		assert.match(diff.stdout, /claude:local\s+missing/);
		assert.doesNotMatch(diff.stdout, /claude:global/);

		const applied = run(fx.root, ['apply', '--source', './scoped-source']);
		assert.equal(applied.status, 0, applied.stderr);
		assert.equal(readFileSync(join(fx.claudeDir, 'local/SKILL.md'), 'utf8'), 'local\n');
		assert.equal(existsSync(join(fx.claudeDir, 'global')), false);
	} finally {
		fx.cleanup();
	}
});

test('--source and --target work without .env and deploy only to the selected directory', () => {
	const fx = createFixture();
	try {
		const scopedSource = join(fx.root, 'scoped-source');
		const scopedTarget = join(fx.root, 'scoped-target');
		writeSkill(scopedSource, 'review', { 'SKILL.md': 'source\n' });
		writeSkill(scopedTarget, 'local-only', { 'SKILL.md': 'preserve\n' });
		const flags = ['--source', './scoped-source', '--target', './scoped-target'];

		const diff = run(fx.root, ['diff', ...flags], { SKILLS_SOURCE_DIR: '' });
		assert.equal(diff.status, 1, diff.stderr);
		assert.match(diff.stdout, /review\s+missing/);
		assert.ok(diff.stdout.includes(scopedTarget));

		const dryRun = run(fx.root, ['apply', ...flags, '--dry-run'], { SKILLS_SOURCE_DIR: '' });
		assert.equal(dryRun.status, 0, dryRun.stderr);
		assert.equal(existsSync(join(scopedTarget, 'review')), false);
		const applied = run(fx.root, ['apply', ...flags], { SKILLS_SOURCE_DIR: '' });
		assert.equal(applied.status, 0, applied.stderr);
		assert.equal(readFileSync(join(scopedTarget, 'review/SKILL.md'), 'utf8'), 'source\n');
		assert.equal(readFileSync(join(scopedTarget, 'local-only/SKILL.md'), 'utf8'), 'preserve\n');
		assert.equal(existsSync(join(fx.claudeDir, 'review')), false);

		writeFile(join(scopedTarget, 'review/SKILL.md'), 'local edit\n');
		const conflict = run(fx.root, ['apply', ...flags], { SKILLS_SOURCE_DIR: '' });
		assert.equal(conflict.status, 1, conflict.stderr);
		assert.equal(readFileSync(join(scopedTarget, 'review/SKILL.md'), 'utf8'), 'local edit\n');
		const forced = run(fx.root, ['apply', ...flags, '--force'], { SKILLS_SOURCE_DIR: '' });
		assert.equal(forced.status, 0, forced.stderr);
		assert.equal(readFileSync(join(scopedTarget, 'review/SKILL.md'), 'utf8'), 'source\n');
	} finally {
		fx.cleanup();
	}
});

test('--target alone uses the configured source and ignores other agents', () => {
	const fx = createFixture();
	try {
		const scopedTarget = join(fx.root, 'scoped-target');
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical\n' });
		const result = run(fx.root, ['apply', '--target', './scoped-target']);
		assert.equal(result.status, 0, result.stderr);
		assert.ok(result.stdout.includes(scopedTarget));
		assert.equal(readFileSync(join(scopedTarget, 'review/SKILL.md'), 'utf8'), 'canonical\n');
		assert.equal(existsSync(join(fx.claudeDir, 'review')), false);
	} finally {
		fx.cleanup();
	}
});

test('explicit target keeps configured write denials when it matches an agent directory', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
			CLAUDE_WRITE_DENY_PATTERNS: '\'["review/"]\'',
		});
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical\n' });
		const result = run(fx.root, ['apply', '--target', fx.claudeDir, '--force']);
		assert.equal(result.status, 1, result.stderr);
		assert.match(result.stdout, /blocked/);
		assert.equal(existsSync(join(fx.claudeDir, 'review')), false);
	} finally {
		fx.cleanup();
	}
});

test('path flags reject invalid combinations and overlapping directories', () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'canonical\n' });
		for (const args of [
			['doctor', '--target', fx.claudeDir],
			['import', 'https://example.test/review.zip', '--target', fx.claudeDir],
			['diff', '--target', fx.claudeDir, '--agent', 'claude'],
		]) {
			const result = run(fx.root, args);
			assert.equal(result.status, 2, result.stderr);
		}

		for (const target of [fx.sourceDir, join(fx.sourceDir, 'nested'), fx.root]) {
			const result = run(fx.root, ['apply', '--target', target, '--force']);
			assert.equal(result.status, 2, result.stderr);
			assert.match(result.stderr, /must not overlap/);
		}
		const alias = join(fx.root, 'source-alias');
		symlinkSync(fx.sourceDir, alias);
		const aliasResult = run(fx.root, ['apply', '--target', alias, '--force']);
		assert.equal(aliasResult.status, 2, aliasResult.stderr);
		assert.match(aliasResult.stderr, /must not overlap/);
		assert.equal(readFileSync(join(fx.sourceDir, 'review/SKILL.md'), 'utf8'), 'canonical\n');
	} finally {
		fx.cleanup();
	}
});

test('diff and apply reject a missing explicit source instead of reporting no work', () => {
	const fx = createFixture();
	try {
		for (const command of ['diff', 'apply']) {
			const result = run(
				fx.root,
				[command, '--source', './missing-source', '--target', './scoped-target'],
				{ SKILLS_SOURCE_DIR: '' },
			);
			assert.equal(result.status, 2, result.stderr);
			assert.match(result.stderr, /Source directory not found/);
		}
		assert.equal(existsSync(join(fx.root, 'scoped-target')), false);
	} finally {
		fx.cleanup();
	}
});
