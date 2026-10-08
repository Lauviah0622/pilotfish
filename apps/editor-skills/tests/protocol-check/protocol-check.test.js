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
const templatePath = path.join(testsDir, 'protocol-check-template.ts');

const TEMP_FILE_NAME = 'test-result.ts';

/**
 * @agent:action:discuss
 * 想把一些 test basic suite 抽出來，討論看看怎作
 
 */

// 這個東西應該變成 createAgentTestingSandbox(skillsPath, sandboxPath, sandboxConfig: {installedSkill: path}) 這樣概念的東西我想

function createTestingSandbox() {
  const skillPath = path.join(packageRoot, 'skills/editor-commands-protocol');
  const runDir = mkdtempSync(path.join(tmpdir(), 'pilotfish-editor-skill-'));
  const installedSkillPath = path.join(runDir, '.agents/skills/collab');

  mkdirSync(installedSkillPath, { recursive: true });
  cpSync(skillPath, installedSkillPath, { recursive: true });

	// 原本有個 template 的概念。這個應該不用了。這會讓整個流程有點麻煩？可能直接都放在 /sandbox 或者是 /template 裡面。
  copyFileSync(templatePath, path.join(runDir, TEMP_FILE_NAME));

  return {
    resultPath: path.join(runDir, TEMP_FILE_NAME),
    runDir,
  };
}

test('collab completes a source action using the canonical protocol', () => {
  const { resultPath, runDir } = createTestingSandbox();

  // Codex requires a repository as its working directory. Assertions inspect
  // the resulting file directly instead of relying on textual command output.
  const git = spawnSync('git', ['init', '--quiet'], {
    cwd: runDir,
    encoding: 'utf8',
  });


	// git init 應該要放在 createAgentTestingSandbox 裡面。
  assert.equal(
    git.status,
    0,
    git.stderr || 'Failed to initialize fixture repository.',
  );


	// codex 的 runner 要分開變成另一個 utils

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

	// assertion 的部分就保留
  assert.equal(
    codex.status,
    0,
    `${codex.stdout}\n${codex.stderr}\nFixture retained at: ${runDir}`,
  );

  const result = readFileSync(resultPath, 'utf8');

  assert.match(
    result,
    /@agent:action:do[\s\S]*Rename fetchUser to getUser throughout this file\./,
    'The original action marker or request was changed or removed.',
  );
  assert.match(result, /function getUser\(\)/, 'The function was not renamed.');
  assert.match(
    result,
    /const currentUser = getUser\(\);/,
    'The call was not renamed.',
  );

  const replyCount = result.match(/@agent:reply:done\b/g)?.length ?? 0;
  assert.equal(
    replyCount,
    1,
    `Expected exactly one done reply, found ${replyCount}.`,
  );
  assert.doesNotMatch(
    result,
    /@agent:reply:pending\b/,
    'Pending reply was not finalized.',
  );
  assert.doesNotMatch(
    result,
    /@reply(?:\s+status)?:|@status:/,
    'Found a legacy reply or status marker.',
  );
});
