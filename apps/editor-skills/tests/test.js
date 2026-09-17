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
const templatePath = path.join(testsDir, 'test-template.ts');

console.log('START: editor collaboration protocol end-to-end test.');

function createTestingSandbox() {
	const skillPath = path.join(
		packageRoot,
		'skills/editor-commands-protocal',
	);
	const runDir = mkdtempSync(path.join(tmpdir(), 'pilotfish-editor-skill-'));
	const installedSkillPath = path.join(runDir, '.agents/skills/collab');

	mkdirSync(installedSkillPath, { recursive: true });
	cpSync(skillPath, installedSkillPath, { recursive: true });
	copyFileSync(templatePath, path.join(runDir, 'test-result.ts'));

	return runDir;
}

const runDir = createTestingSandbox();
const resultPath = path.join(runDir, 'test-result.ts');

// Codex requires a repository as its working directory; the assertions below
// validate the resulting file directly rather than relying on textual git diff.
const git = spawnSync('git', ['init', '--quiet'], {
	cwd: runDir,
	encoding: 'utf8',
});

if (git.status !== 0) {
	console.error(git.stderr || 'Failed to initialize fixture repository.');
	process.exit(git.status ?? 1);
}

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
		'$collab test-result.ts:6',
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

const result = readFileSync(resultPath, 'utf8');

assert.ok(
	result.includes(
		'@agent:action:do',
	),
	'The original action marker or request was changed or removed.',
);
assert.match(result, /function getUser\(\)/, 'The function was not renamed.');
assert.match(result, /const currentUser = getUser\(\);/, 'The call was not renamed.');

const replyCount = result.match(/@agent:reply:done\b/g)?.length ?? 0;
assert.equal(replyCount, 1, `Expected exactly one done reply, found ${replyCount}.`);
assert.doesNotMatch(result, /@agent:reply:pending\b/, 'Pending reply was not finalized.');
assert.doesNotMatch(
	result,
	/@reply(?:\s+status)?:|@status:/,
	'Found a legacy reply or status marker.',
);

console.log('\n--- test-result.ts start ---\n');
console.log(result.trimEnd());
console.log('\n--- test-result.ts end ---\n');
console.log('PASS: editor skill completed the action using the canonical protocol.');
