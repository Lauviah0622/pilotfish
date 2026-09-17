#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
	copyFileSync,
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');



const testsDir = __dirname;
const packageRoot = path.resolve(testsDir, '..');
const templatePath = path.join(testsDir, 'test-template.md');


console.log('START: pilotfish obsidian-skills integration test.');

function createTestingSandbox() {
	const skillPath = path.join(
		packageRoot,
		'skills/obsidian-pilotfish-skills/markdown-comment-protocol',
	);
	const runDir = mkdtempSync(path.join(tmpdir(), 'pilotfish-obsidian-skill-'));
	const installedSkillPath = path.join(
		runDir,
		'.agents/skills/markdown-comment-protocol',
	);

	mkdirSync(installedSkillPath, { recursive: true });
	cpSync(skillPath, installedSkillPath, { recursive: true });
	copyFileSync(templatePath, path.join(runDir, 'test-result.md'));

	return runDir;
}

const runDir = createTestingSandbox();
const resultPath = path.join(runDir, 'test-result.md');
/**
 * 使用 git 可以自然用 git diff 來讀取結果，就不用自己比對
 */
const git = spawnSync('git', ['init', '--quiet'], {
	cwd: runDir,
	encoding: 'utf8',
});


if (git.status !== 0) {
	console.error(git.stderr || 'Failed to initialize fixture repository.');
	process.exit(git.status ?? 1);
}

const PROMPT = '$collab test-result.md:1';
const codex = spawnSync(
	'codex',
	[
		'exec',
		'--ephemeral',
		'--ignore-user-config',
		'--sandbox',
		'workspace-write',
		'-C',
		runDir,
		PROMPT,
	],
	{
		encoding: 'utf8',
		maxBuffer: 10 * 1024 * 1024,
	},
);

if (codex.status !== 0) {
	console.error(codex.stdout);
	console.error(codex.stderr);
	console.error(`FAIL: Codex exited with status ${codex.status}.`);
	console.error(`Fixture retained at: ${runDir}`);
	process.exit(codex.status ?? 1);
}

const template = readFileSync(templatePath, 'utf8').trim();
const result = readFileSync(resultPath, 'utf8');


assert.ok(
	result.includes(template),
	'The original For Agent block was changed or removed.',
);

const replyCount = result.match(/^> \[!Comment\] For User$/gm)?.length ?? 0;
assert.equal(replyCount, 1, `Expected exactly one For User block, found ${replyCount}.`);


console.log('\n--- test-result.md  start ---\n\n');
console.log(result.trimEnd());
console.log('\n\n--- test-result.md end ---\n');


console.log('PASS: markdown-comment-protocol handled the blocked request.');
