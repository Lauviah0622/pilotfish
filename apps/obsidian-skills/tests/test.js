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



/**
 * @agent discuss
 * 有幾個狀況
 
 * - 有用 git init 想做比對，但最後卻沒有用 git diff？
 * - 
 * @reply: 建議把 package root 設為 `path.resolve(testsDir, '..')`，skill path 也從該 root
 *   組合，避免測試依賴 monorepo 結構。目前 `git init` 沒建立 baseline，確實無法產生有意義的
 *   diff；若保留現有語意斷言就移除 git init，若要測實際 patch，再先建立 baseline 並檢查 git diff。
 *   取捨是 git diff 更貼近編輯結果，但仍不能取代「唯一回覆、協定正確」等語意驗證。
 * @status: replied
 * 
 * @agent do 
 * 好你先改 root path 那個問題
 * @reply: 已將 root 改為 `apps/obsidian-skills` package，skill path 現在從 package root 組合。
 * @status: done
 */


const testsDir = __dirname;
const packageRoot = path.resolve(testsDir, '..');
const templatePath = path.join(testsDir, 'test-template.md');


console.log('START: markdown-comment-protocol integration test.');

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
