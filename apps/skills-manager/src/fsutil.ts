import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { fdir } from 'fdir';
import type { Ignore } from 'ignore';

export interface WalkedFile {
	readonly abs: string;
	readonly rel: string;
	readonly size: number;
}

/**
 * Recursively list files under `root`, honoring an `ignore` matcher. Returns
 * POSIX-style relative paths, sorted lexicographically.
 */
export function listFiles(root: string, ignorer: Ignore): WalkedFile[] {
	const crawler = new fdir()
		.withRelativePaths()
		.withPathSeparator('/')
		.exclude((_dirName, dirPath) => {
			// dirPath comes from fdir; derive its path relative to `root` (POSIX,
			// trailing slash) so `ignore` can match directory rules correctly.
			const rel = toRelative(root, dirPath);
			if (rel === '') return false;
			return ignorer.ignores(`${rel}/`);
		})
		.filter((path) => !ignorer.ignores(path))
		.crawl(root);
	const relPaths = crawler.sync();

	const out: WalkedFile[] = [];
	for (const rel of relPaths) {
		const abs = `${root}/${rel}`;
		let size = 0;
		try {
			size = statSync(abs).size;
		} catch {
			continue;
		}
		out.push({ abs, rel, size });
	}
	out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
	return out;
}

function toRelative(root: string, p: string): string {
	// fdir hands us absolute dir paths with a trailing separator.
	const r = root.endsWith('/') ? root.slice(0, -1) : root;
	let rel = p.startsWith(r) ? p.slice(r.length) : p;
	while (rel.startsWith('/')) rel = rel.slice(1);
	while (rel.endsWith('/')) rel = rel.slice(0, -1);
	return rel.split(/[\\/]/).join('/');
}

export function hashFile(abs: string): string {
	const buf = readFileSync(abs);
	return createHash('sha256').update(buf).digest('hex');
}

export function readFileBytes(abs: string): Buffer {
	return readFileSync(abs);
}

export function ensureDir(dir: string): void {
	mkdirSync(dir, { recursive: true });
}

export function dirExists(dir: string): boolean {
	try {
		return statSync(dir).isDirectory();
	} catch {
		return false;
	}
}

export function fileExists(file: string): boolean {
	try {
		return statSync(file).isFile();
	} catch {
		return false;
	}
}

/**
 * Copy a directory's contents to a staging path on the same parent dir, then
 * atomically swap it into the target location.
 *
 *   - If target does not exist: rename(staging → target).
 *   - If target exists and `replace=true`: rename(target → old), rename(staging → target), rm(old).
 *   - If target exists and `replace=false`: throw.
 *
 * Cleans up staging on failure.
 */
export function atomicDeploy(sourceDir: string, targetDir: string, replace: boolean): void {
	const parent = dirname(targetDir);
	ensureDir(parent);
	const stamp = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const staging = `${targetDir}.staging.${stamp}`;
	const old = `${targetDir}.old.${stamp}`;

	try {
		cpSync(sourceDir, staging, { recursive: true, dereference: false });
	} catch (err) {
		try {
			rmSync(staging, { recursive: true, force: true });
		} catch {}
		throw err;
	}

	const targetExists = existsSync(targetDir);
	if (targetExists && !replace) {
		rmSync(staging, { recursive: true, force: true });
		throw new Error(`Target ${targetDir} already exists`);
	}

	try {
		if (targetExists) {
			renameSync(targetDir, old);
		}
		renameSync(staging, targetDir);
	} catch (err) {
		try {
			if (existsSync(old) && !existsSync(targetDir)) {
				renameSync(old, targetDir);
			}
		} catch {}
		try {
			rmSync(staging, { recursive: true, force: true });
		} catch {}
		throw err;
	}

	if (targetExists) {
		try {
			rmSync(old, { recursive: true, force: true });
		} catch {
			// Best effort — target is already in place.
		}
	}
}
