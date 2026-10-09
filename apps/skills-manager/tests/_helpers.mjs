import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const CLI = resolve(here, '..', 'dist', 'skills.js');

export function createFixture() {
	const root = mkdtempSync(join(tmpdir(), 'skills-manager-'));
	const sourceDir = join(root, 'ssot');
	const claudeDir = join(root, 'claude');
	const codexDir = join(root, 'codex');
	mkdirSync(sourceDir, { recursive: true });
	mkdirSync(claudeDir, { recursive: true });
	// codex dir intentionally left non-existent to test missing agent dir
	return {
		root,
		sourceDir,
		claudeDir,
		codexDir,
		envFile: join(root, '.env'),
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	};
}

export function writeFile(path, content) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
}

export function writeSkill(root, name, files) {
	for (const [rel, content] of Object.entries(files)) {
		writeFile(join(root, name, rel), content);
	}
}

export function writeDotenv(path, map) {
	const lines = Object.entries(map).map(([k, v]) => `${k}=${v}`);
	writeFileSync(path, `${lines.join('\n')}\n`);
}

export function run(cwd, args, extraEnv = {}) {
	const env = {
		...process.env,
		NO_COLOR: '1',
		...extraEnv,
	};
	const res = spawnSync(process.execPath, [CLI, ...args], {
		cwd,
		env,
		encoding: 'utf8',
	});
	return {
		status: res.status,
		stdout: res.stdout ?? '',
		stderr: res.stderr ?? '',
	};
}

export function readText(path) {
	return readFileSync(path, 'utf8');
}

/** Keep the parent event loop free for fixture HTTP servers. */
export function runAsync(cwd, args, extraEnv = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [CLI, ...args], {
			cwd,
			env: { ...process.env, NO_COLOR: '1', ...extraEnv },
		});
		let stdout = '';
		let stderr = '';
		child.stdout.setEncoding('utf8').on('data', (data) => {
			stdout += data;
		});
		child.stderr.setEncoding('utf8').on('data', (data) => {
			stderr += data;
		});
		child.on('error', reject);
		child.on('close', (status) => resolve({ status, stdout, stderr }));
	});
}
