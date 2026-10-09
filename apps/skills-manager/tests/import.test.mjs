import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { zipSync } from 'fflate';
import { pack as tarPack } from 'tar-stream';
import { createFixture, run, runAsync, writeDotenv } from './_helpers.mjs';

/**
 * Build a zip Buffer from a map of entry path → content.
 * entry paths are POSIX; empty content strings become directory entries.
 */
function makeZip(entries) {
	const flat = {};
	for (const [path, content] of Object.entries(entries)) {
		flat[path] = typeof content === 'string' ? Buffer.from(content) : content;
	}
	return Buffer.from(zipSync(flat));
}

/**
 * Build a tar.gz Buffer from a map of entry path → content.
 */
async function makeTarGz(entries) {
	const pack = tarPack();
	const promises = [];
	for (const [path, content] of Object.entries(entries)) {
		promises.push(
			new Promise((resolve, reject) => {
				const buf = typeof content === 'string' ? Buffer.from(content) : content;
				pack.entry({ name: path, size: buf.length }, buf, (err) => {
					if (err) reject(err);
					else resolve();
				});
			}),
		);
	}
	await Promise.all(promises);
	pack.finalize();
	const chunks = [];
	for await (const chunk of pack) chunks.push(chunk);
	const tar = Buffer.concat(chunks);
	return Buffer.from(gzipSync(tar));
}

/**
 * Start an HTTP server that serves {path → buffer}. Each path is served with
 * a derived Content-Type and the correct Content-Length.
 */
async function serveFixtures(routes) {
	const server = createServer((req, res) => {
		const route = routes[req.url ?? ''];
		if (!route) {
			res.statusCode = 404;
			res.end('not found');
			return;
		}
		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/octet-stream');
		res.setHeader('Content-Length', String(route.length));
		res.end(route);
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = /** @type {AddressInfo} */ (server.address()).port;
	return {
		url: (p) => `http://127.0.0.1:${port}${p}`,
		close: () => new Promise((r) => server.close(() => r())),
	};
}

test('import zip with single top-level dir (GitHub-style) auto-strips', async () => {
	const fx = createFixture();
	const srv = await serveFixtures({
		'/review.zip': makeZip({
			'repo-main/SKILL.md': '# review\n',
			'repo-main/docs/notes.md': 'notes\n',
		}),
	});
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		const r = await runAsync(fx.root, ['import', srv.url('/review.zip')]);
		assert.equal(r.status, 0, r.stderr || r.stdout);
		assert.equal(readFileSync(join(fx.sourceDir, 'review', 'SKILL.md'), 'utf8'), '# review\n');
		assert.equal(readFileSync(join(fx.sourceDir, 'review', 'docs/notes.md'), 'utf8'), 'notes\n');
	} finally {
		await srv.close();
		fx.cleanup();
	}
});

test('import tar.gz (npm-style with package/ root) auto-strips', async () => {
	const fx = createFixture();
	const srv = await serveFixtures({
		'/pkg.tgz': await makeTarGz({
			'package/SKILL.md': '# npm skill\n',
			'package/package.json': '{"name":"x"}\n',
		}),
	});
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		const r = await runAsync(fx.root, ['import', srv.url('/pkg.tgz'), '--as', 'npm-skill']);
		assert.equal(r.status, 0, r.stderr || r.stdout);
		assert.equal(
			readFileSync(join(fx.sourceDir, 'npm-skill', 'SKILL.md'), 'utf8'),
			'# npm skill\n',
		);
	} finally {
		await srv.close();
		fx.cleanup();
	}
});

test('import --subdir picks a nested skill out of a multi-skill repo', async () => {
	const fx = createFixture();
	const srv = await serveFixtures({
		'/multi.zip': makeZip({
			'repo-main/skills/code-review/SKILL.md': '# code review\n',
			'repo-main/skills/code-review/helper.md': 'tips\n',
			'repo-main/skills/debugging/SKILL.md': '# debug\n',
			'repo-main/README.md': 'top-level readme\n',
		}),
	});
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		const r = await runAsync(fx.root, [
			'import',
			srv.url('/multi.zip'),
			'--subdir',
			'skills/code-review',
		]);
		assert.equal(r.status, 0, r.stderr || r.stdout);
		assert.ok(existsSync(join(fx.sourceDir, 'code-review', 'SKILL.md')));
		assert.ok(existsSync(join(fx.sourceDir, 'code-review', 'helper.md')));
		assert.equal(existsSync(join(fx.sourceDir, 'debugging')), false);
	} finally {
		await srv.close();
		fx.cleanup();
	}
});

test('import fails when archive has no SKILL.md', async () => {
	const fx = createFixture();
	const srv = await serveFixtures({
		'/bad.zip': makeZip({
			'repo-main/README.md': 'no skill here\n',
		}),
	});
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		const r = await runAsync(fx.root, ['import', srv.url('/bad.zip')]);
		assert.equal(r.status, 2);
		assert.match(r.stdout, /No SKILL.md/);
	} finally {
		await srv.close();
		fx.cleanup();
	}
});

test('import refuses to overwrite an existing SSOT skill without --force', async () => {
	const fx = createFixture();
	const srv = await serveFixtures({
		'/review.zip': makeZip({
			'repo-main/SKILL.md': '# fresh\n',
		}),
	});
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		// Pre-seed the SSOT.
		const { writeSkill } = await import('./_helpers.mjs');
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'OLD CONTENT\n' });
		const r = await runAsync(fx.root, ['import', srv.url('/review.zip')]);
		assert.equal(r.status, 2);
		assert.match(r.stdout, /already contains/);
		// Original content preserved.
		assert.equal(readFileSync(join(fx.sourceDir, 'review', 'SKILL.md'), 'utf8'), 'OLD CONTENT\n');
	} finally {
		await srv.close();
		fx.cleanup();
	}
});

test('import --force replaces an existing SSOT skill', async () => {
	const fx = createFixture();
	const srv = await serveFixtures({
		'/review.zip': makeZip({
			'repo-main/SKILL.md': '# fresh\n',
		}),
	});
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		const { writeSkill } = await import('./_helpers.mjs');
		writeSkill(fx.sourceDir, 'review', { 'SKILL.md': 'OLD\n', 'cruft.md': 'junk\n' });
		const r = await runAsync(fx.root, ['import', srv.url('/review.zip'), '--force']);
		assert.equal(r.status, 0, r.stderr || r.stdout);
		assert.equal(readFileSync(join(fx.sourceDir, 'review', 'SKILL.md'), 'utf8'), '# fresh\n');
		assert.equal(existsSync(join(fx.sourceDir, 'review', 'cruft.md')), false);
	} finally {
		await srv.close();
		fx.cleanup();
	}
});

test('import rejects path traversal entries', async () => {
	const fx = createFixture();
	const srv = await serveFixtures({
		'/evil.zip': makeZip({
			'repo-main/SKILL.md': '# evil\n',
			'repo-main/../escape.sh': 'rm -rf /\n',
		}),
	});
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		const r = await runAsync(fx.root, ['import', srv.url('/evil.zip'), '--as', 'evil']);
		assert.equal(r.status, 0, r.stderr || r.stdout);
		// The malicious entry must NOT have been written anywhere outside the skill root.
		assert.equal(existsSync(join(fx.sourceDir, 'escape.sh')), false);
		assert.equal(existsSync(join(fx.root, 'escape.sh')), false);
	} finally {
		await srv.close();
		fx.cleanup();
	}
});

test('import rejects URLs without a recognized extension', async () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		const r = run(fx.root, ['import', 'https://example.com/nothing']);
		assert.equal(r.status, 2);
		assert.match(r.stdout + r.stderr, /archive format/i);
	} finally {
		fx.cleanup();
	}
});

test('import rejects non-http(s) URLs', async () => {
	const fx = createFixture();
	try {
		writeDotenv(fx.envFile, { SKILLS_SOURCE_DIR: fx.sourceDir });
		const r = run(fx.root, ['import', 'file:///etc/passwd.zip']);
		assert.equal(r.status, 2);
		assert.match(r.stdout + r.stderr, /http\(s\)/);
	} finally {
		fx.cleanup();
	}
});

test('import then apply: full round-trip into agent dir', async () => {
	const fx = createFixture();
	const srv = await serveFixtures({
		'/review.zip': makeZip({
			'repo-main/SKILL.md': '# round-trip\n',
		}),
	});
	try {
		writeDotenv(fx.envFile, {
			SKILLS_SOURCE_DIR: fx.sourceDir,
			CLAUDE_SKILLS_DIR: fx.claudeDir,
		});
		const r1 = await runAsync(fx.root, ['import', srv.url('/review.zip'), '--as', 'rt']);
		assert.equal(r1.status, 0, r1.stderr || r1.stdout);
		const r2 = run(fx.root, ['apply']);
		assert.equal(r2.status, 0, r2.stderr || r2.stdout);
		assert.equal(readFileSync(join(fx.claudeDir, 'rt', 'SKILL.md'), 'utf8'), '# round-trip\n');
	} finally {
		await srv.close();
		fx.cleanup();
	}
});
