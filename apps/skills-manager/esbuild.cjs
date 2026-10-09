const esbuild = require('esbuild');
const { chmodSync, mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const outfile = resolve(__dirname, 'dist/skills.js');
mkdirSync(dirname(outfile), { recursive: true });

const banner = {
	js: [
		'#!/usr/bin/env node',
		"import { createRequire as __skillsCreateRequire } from 'node:module';",
		'const require = __skillsCreateRequire(import.meta.url);',
	].join('\n'),
};

/** @type {import('esbuild').BuildOptions} */
const options = {
	entryPoints: [resolve(__dirname, 'src/index.ts')],
	outfile,
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node20',
	minify: production,
	sourcemap: !production,
	sourcesContent: false,
	legalComments: 'none',
	logLevel: 'info',
	banner,
};

async function main() {
	if (watch) {
		const ctx = await esbuild.context(options);
		await ctx.watch();
		return;
	}
	await esbuild.build(options);
	chmodSync(outfile, 0o755);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
