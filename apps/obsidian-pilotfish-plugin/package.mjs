import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));

async function  validate() {
	const manifestPath = join(PROJECT_ROOT, 'manifest.json');
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
	
	if (typeof manifest.id !== 'string' || manifest.id.length === 0) {
		throw new Error('manifest.json must contain a non-empty plugin id');
	}

	return manifest
}

const validManifest = await validate()

// DIST
const packageDir = join(PROJECT_ROOT, 'dist', validManifest.id);
const artifacts = ['main.js', 'manifest.json', 'styles.css', 'assets'];

for (const artifact of artifacts) {
	// check the user permission of the file
	await access(join(PROJECT_ROOT, artifact));
}

await rm(packageDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });

for (const artifact of artifacts) {
	await cp(join(PROJECT_ROOT, artifact), join(packageDir, artifact), {
		dereference: true,
		recursive: true,
	});
}

console.log('─'.repeat(process.stdout.columns ?? 80))
console.log(`Packaged ${validManifest.id} at ${packageDir}`);
