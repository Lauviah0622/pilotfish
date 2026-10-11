import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const publishScript = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'scripts',
	'publish.mjs',
);

function command(cwd, executable, args, env = process.env) {
	const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8' });
	if (result.status !== 0) throw new Error(`${executable} ${args.join(' ')}: ${result.stderr}`);
	return result.stdout.trim();
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'skills-publish-'));
	const remote = join(root, 'remote.git');
	const repo = join(root, 'repo');
	const pkg = join(repo, 'pkg');
	const bin = join(root, 'bin');
	const log = join(root, 'release.json');
	mkdirSync(join(pkg, 'scripts'), { recursive: true });
	mkdirSync(bin);
	copyFileSync(publishScript, join(pkg, 'scripts', 'publish.mjs'));
	writeFileSync(
		join(pkg, 'package.json'),
		JSON.stringify({ name: '@pilotfish/skills-manager', version: '0.1.0' }),
	);
	writeFileSync(join(pkg, 'README.md'), 'Initial package\n');
	writeFileSync(join(pkg, '.gitignore'), 'dist/\n*.tgz\n');
	command(root, 'git', ['init', '--bare', remote]);
	command(root, 'git', ['init', '-b', 'main', repo]);
	command(repo, 'git', ['config', 'user.email', 'test@example.com']);
	command(repo, 'git', ['config', 'user.name', 'Test']);
	command(repo, 'git', ['config', 'commit.gpgsign', 'false']);
	command(repo, 'git', ['config', 'tag.gpgsign', 'false']);
	command(repo, 'git', ['remote', 'add', 'origin', remote]);
	command(repo, 'git', ['add', '.']);
	command(repo, 'git', ['commit', '-m', 'Initial package']);
	command(repo, 'git', ['push', '-u', 'origin', 'main']);

	const stubs = {
		pnpm: `#!/usr/bin/env node
const fs = require('node:fs');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/skills.js', '#!/usr/bin/env node\\n');
`,
		npm: `#!/usr/bin/env node
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const filename = 'pilotfish-skills-manager-' + pkg.version + '.tgz';
fs.writeFileSync(filename, 'test tarball');
process.stdout.write(JSON.stringify([{ name: pkg.name, version: pkg.version, filename, files: [{ path: 'dist/skills.js' }] }]));
`,
		gh: `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const notesFile = args[args.indexOf('--notes-file') + 1];
fs.writeFileSync(process.env.PUBLISH_TEST_LOG, JSON.stringify({ args, notes: fs.readFileSync(notesFile, 'utf8') }));
`,
	};
	for (const [name, content] of Object.entries(stubs)) {
		const path = join(bin, name);
		writeFileSync(path, content);
		chmodSync(path, 0o755);
	}
	return {
		root,
		repo,
		pkg,
		log,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
		run: () =>
			spawnSync(process.execPath, [join(pkg, 'scripts', 'publish.mjs')], {
				cwd: pkg,
				encoding: 'utf8',
				env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PUBLISH_TEST_LOG: log },
			}),
	};
}

test('publishes the first version with a package tarball and initial notes', () => {
	const f = fixture();
	try {
		const result = f.run();
		assert.equal(result.status, 0, result.stderr);
		const release = JSON.parse(readFileSync(f.log, 'utf8'));
		assert.deepEqual(release.args.slice(0, 3), [
			'release',
			'create',
			'@pilotfish/skills-manager@0.1.0',
		]);
		assert.equal(release.args[3], realpathSync(join(f.pkg, 'pilotfish-skills-manager-0.1.0.tgz')));
		assert.deepEqual(release.args.slice(4, 8), [
			'--target',
			'main',
			'--title',
			'@pilotfish/skills-manager 0.1.0',
		]);
		assert.match(release.notes, /Initial release/);
	} finally {
		f.cleanup();
	}
});

test('notes compare only the package against its previous tag', () => {
	const f = fixture();
	try {
		command(f.repo, 'git', ['tag', '@pilotfish/skills-manager@0.1.0']);
		command(f.repo, 'git', ['push', 'origin', '--tags']);
		writeFileSync(
			join(f.pkg, 'package.json'),
			JSON.stringify({ name: '@pilotfish/skills-manager', version: '0.2.0' }),
		);
		writeFileSync(join(f.pkg, 'README.md'), 'Updated package\n');
		writeFileSync(join(f.repo, 'unrelated.txt'), 'Unrelated\n');
		command(f.repo, 'git', ['add', '.']);
		command(f.repo, 'git', ['commit', '-m', 'Update skills manager']);
		command(f.repo, 'git', ['push', 'origin', 'main']);
		const result = f.run();
		assert.equal(result.status, 0, result.stderr);
		const release = JSON.parse(readFileSync(f.log, 'utf8'));
		assert.equal(release.args[2], '@pilotfish/skills-manager@0.2.0');
		assert.match(release.notes, /Changes since `@pilotfish\/skills-manager@0\.1\.0`/);
		assert.match(release.notes, /Update skills manager/);
		assert.match(release.notes, /pkg\/README\.md/);
		assert.doesNotMatch(release.notes, /unrelated\.txt/);
	} finally {
		f.cleanup();
	}
});

test('refuses to publish a dirty worktree', () => {
	const f = fixture();
	try {
		writeFileSync(join(f.repo, 'untracked.txt'), 'unfinished\n');
		const result = f.run();
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Commit or remove all working tree changes/);
		assert.equal(existsSync(f.log), false);
	} finally {
		f.cleanup();
	}
});

test('refuses to publish a commit that is not on origin/main', () => {
	const f = fixture();
	try {
		writeFileSync(join(f.pkg, 'README.md'), 'Unpushed package\n');
		command(f.repo, 'git', ['add', '.']);
		command(f.repo, 'git', ['commit', '-m', 'Unpushed change']);
		const result = f.run();
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /main must match the pushed origin\/main commit/);
		assert.equal(existsSync(f.log), false);
	} finally {
		f.cleanup();
	}
});

test('refuses to publish an existing package tag', () => {
	const f = fixture();
	try {
		command(f.repo, 'git', ['tag', '@pilotfish/skills-manager@0.1.0']);
		command(f.repo, 'git', ['push', 'origin', '--tags']);
		const result = f.run();
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Tag already exists/);
		assert.equal(existsSync(f.log), false);
	} finally {
		f.cleanup();
	}
});
