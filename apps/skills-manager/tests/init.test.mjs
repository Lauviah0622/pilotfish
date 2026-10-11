import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CLI, createFixture, run, writeFile } from './_helpers.mjs';

const globalEnvFile = (home) => join(home, '.config/skills-manager/.env');

function runGuided(cwd, home, steps) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [CLI, 'init'], {
			cwd,
			env: { ...process.env, HOME: home, NO_COLOR: '1' },
		});
		let stdout = '';
		let stderr = '';
		let step = 0;
		const timeout = setTimeout(() => {
			child.kill();
			reject(new Error(`init stalled at prompt ${step}: ${stdout}`));
		}, 5000);
		child.stdout.setEncoding('utf8').on('data', (chunk) => {
			stdout += chunk;
			if (step < steps.length && stdout.includes(steps[step][0])) {
				const answer = steps[step][1];
				child.stdin.write(answer === '\u0003' ? answer : `${answer}\r`);
				step++;
				if (step === steps.length) child.stdin.end();
			}
		});
		child.stderr.setEncoding('utf8').on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', (status) => {
			clearTimeout(timeout);
			resolve({ status, stdout, stderr, step });
		});
	});
}

test('init cancellation does not create a config file', async () => {
	const fx = createFixture();
	try {
		const home = join(fx.root, 'home');
		const result = await runGuided(fx.root, home, [['SSOT directory', '\u0003']]);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /Setup cancelled/);
		assert.ok(!existsSync(globalEnvFile(home)));
	} finally {
		fx.cleanup();
	}
});

test('init creates a global configuration with detected agent defaults', async () => {
	const fx = createFixture();
	try {
		const home = join(fx.root, 'home');
		mkdirSync(join(home, '.claude'), { recursive: true });
		mkdirSync(join(home, '.codex'), { recursive: true });
		mkdirSync(join(home, '.agents'), { recursive: true });
		const result = await runGuided(fx.root, home, [
			['SSOT directory', ''],
			['Claude Code: configuration directory found', ''],
			['Claude Code skills directory', ''],
			['Codex: configuration directory found', ''],
			['Codex skills directory', ''],
			['Cursor: configuration directory not found', ''],
		]);
		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.step, 6, result.stdout);
		assert.match(result.stdout, /home\/\.codex\)\. Configure skills\?/);
		const configFile = globalEnvFile(home);
		const config = readFileSync(configFile, 'utf8');
		assert.match(config, /SKILLS_SOURCE_DIR="~\/.skills\/skills"/);
		assert.match(config, /CLAUDE_SKILLS_DIR="~\/.claude\/skills"/);
		assert.match(config, /CODEX_SKILLS_DIR="~\/.agents\/skills"/);
		assert.doesNotMatch(config, /CURSOR_SKILLS_DIR/);
		assert.match(config, /CODEX_WRITE_DENY_PATTERNS/);
		assert.ok(existsSync(join(home, '.skills/skills')));
		const doctor = run(fx.root, ['doctor'], { HOME: home });
		assert.equal(doctor.status, 0, doctor.stderr);
		assert.match(doctor.stdout, /Claude Code|claude/);
	} finally {
		fx.cleanup();
	}
});

test('init detects the Codex shared directory when .codex is absent', async () => {
	const fx = createFixture();
	try {
		const home = join(fx.root, 'home');
		mkdirSync(join(home, '.agents'), { recursive: true });
		const result = await runGuided(fx.root, home, [
			['SSOT directory', ''],
			['Claude Code: configuration directory not found', 'n'],
			['Codex: configuration directory found', ''],
			['Codex skills directory', ''],
			['Cursor: configuration directory not found', 'n'],
		]);
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /home\/\.agents\)\. Configure skills\?/);
		const config = readFileSync(globalEnvFile(home), 'utf8');
		assert.match(config, /CODEX_SKILLS_DIR="~\/.agents\/skills"/);
	} finally {
		fx.cleanup();
	}
});

test('init preserves an existing global .env', () => {
	const fx = createFixture();
	try {
		const home = join(fx.root, 'home');
		const configFile = globalEnvFile(home);
		writeFile(configFile, 'SKILLS_SOURCE_DIR=/existing\n');
		const result = run(fx.root, ['init'], { HOME: home });
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /already exists/);
		assert.equal(readFileSync(configFile, 'utf8'), 'SKILLS_SOURCE_DIR=/existing\n');
	} finally {
		fx.cleanup();
	}
});

test('init can configure an agent without an existing config directory', async () => {
	const fx = createFixture();
	try {
		const home = join(fx.root, 'home');
		const target = join(fx.root, 'my cursor skills');
		const result = await runGuided(fx.root, home, [
			['SSOT directory', ''],
			['Claude Code: configuration directory not found', 'n'],
			['Codex: configuration directory not found', 'n'],
			['Cursor: configuration directory not found', 'y'],
			['Cursor skills directory', target],
		]);
		assert.equal(result.status, 0, result.stderr);
		const config = readFileSync(globalEnvFile(home), 'utf8');
		assert.ok(config.includes(`CURSOR_SKILLS_DIR="${target}"`));
		const doctor = run(fx.root, ['doctor'], { HOME: home });
		assert.equal(doctor.status, 0, doctor.stderr);
		assert.ok(doctor.stdout.includes(target));
	} finally {
		fx.cleanup();
	}
});

test('init rejects overlapping source and agent directories before writing', async () => {
	const fx = createFixture();
	try {
		const home = join(fx.root, 'home');
		mkdirSync(join(home, '.claude'), { recursive: true });
		const result = await runGuided(fx.root, home, [
			['SSOT directory', '~/.claude/skills'],
			['Claude Code: configuration directory found', ''],
			['Claude Code skills directory', ''],
			['Codex: configuration directory not found', ''],
			['Cursor: configuration directory not found', ''],
		]);
		assert.equal(result.status, 2);
		assert.match(result.stderr, /must not overlap/);
		assert.ok(!existsSync(globalEnvFile(home)));
	} finally {
		fx.cleanup();
	}
});
