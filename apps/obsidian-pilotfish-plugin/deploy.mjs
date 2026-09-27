import { access, cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const vaultArgument = process.argv[2] ?? process.env.OBSIDIAN_VAULT;

if (!vaultArgument) {
	throw new Error(
		'Pass a vault path: npm run deploy -- /path/to/vault\n' +
			'Or set the OBSIDIAN_VAULT environment variable.',
	);
}

const vaultPath = resolve(vaultArgument);
const obsidianDir = join(vaultPath, '.obsidian');

async function validate() {
	try {
		if (!(await stat(obsidianDir)).isDirectory()) {
			throw new Error();
		}
	} catch {
		throw new Error(`Not an Obsidian vault (missing ${obsidianDir})`);
	}
	
	const manifest = JSON.parse(
		await readFile(join(PROJECT_ROOT, 'manifest.json'), 'utf8'),
	);
	
	if (typeof manifest.id !== 'string' || manifest.id.length === 0) {
		throw new Error('manifest.json must contain a non-empty plugin id');
	}

	return manifest
}

const validManifest = await validate();


const packageDir = join(PROJECT_ROOT, 'dist', validManifest.id);
const pluginDir = join(obsidianDir, 'plugins', validManifest.id);
const managedArtifacts = ['main.js', 'manifest.json', 'styles.css', 'assets'];

for (const artifact of managedArtifacts) {
	await access(join(packageDir, artifact));
}

await mkdir(pluginDir, { recursive: true });

for (const artifact of managedArtifacts) {
	const source = join(packageDir, artifact);
	const target = join(pluginDir, artifact);
	await rm(target, { recursive: true, force: true });
	await cp(source, target, { recursive: true });
}


console.log('─'.repeat(process.stdout.columns ?? 80))
console.log(`Deployed ${validManifest.id} to ${pluginDir}\n\n`);
