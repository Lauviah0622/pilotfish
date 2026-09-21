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
const { test } = require('node:test');

const testsDir = __dirname;
const packageRoot = path.resolve(testsDir, '../..');
const templatePath = path.join(testsDir, 'protocol-check-template.md');
const TEMP_FILE_NAME = 'test-result.md';

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
	copyFileSync(templatePath, path.join(runDir, TEMP_FILE_NAME));

	return {
		resultPath: path.join(runDir, TEMP_FILE_NAME),
		runDir,
	};
}

test('collab reports a Markdown blocker using the comment protocol', () => {
	const { resultPath, runDir } = createTestingSandbox();
	const git = spawnSync('git', ['init', '--quiet'], {
		cwd: runDir,
		encoding: 'utf8',
	});

	assert.equal(git.status, 0, git.stderr || 'Failed to initialize fixture repository.');

	// Keep the prompt standalone for readable
	const CODEX_PROMPT = `$collab ${TEMP_FILE_NAME}:1`;

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
      CODEX_PROMPT,
    ],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  );

	assert.equal(
		codex.status,
		0,
		`${codex.stdout}\n${codex.stderr}\nFixture retained at: ${runDir}`,
	);

	const template = readFileSync(templatePath, 'utf8').trim();
	const result = readFileSync(resultPath, 'utf8');

	assert.ok(
		result.includes(template),
		'The original For Agent block was changed or removed.',
	);

	const replyCount = result.match(/^> \[!Comment\] For User$/gm)?.length ?? 0;
	assert.equal(replyCount, 1, `Expected exactly one For User block, found ${replyCount}.`);
	assert.doesNotMatch(result, /^> Pending\.\.\.$/m, 'Pending reply was not finalized.');
	assert.doesNotMatch(result, /\/\*\s*@agent:/, 'Found source-comment protocol in Markdown.');
});
