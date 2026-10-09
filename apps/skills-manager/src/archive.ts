import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { unzipSync } from 'fflate';
import { extract as tarExtract } from 'tar-stream';

export type ArchiveFormat = 'zip' | 'targz' | 'tar';

const MAX_BYTES = 100 * 1024 * 1024; // 100 MiB
const FETCH_TIMEOUT_MS = 60_000;

export class ArchiveError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ArchiveError';
	}
}

export function detectFormat(url: string): ArchiveFormat {
	let pathname: string;
	try {
		pathname = new URL(url).pathname.toLowerCase();
	} catch {
		throw new ArchiveError(`Not a valid URL: ${url}`);
	}
	if (pathname.endsWith('.zip')) return 'zip';
	if (pathname.endsWith('.tar.gz') || pathname.endsWith('.tgz')) return 'targz';
	if (pathname.endsWith('.tar')) return 'tar';
	throw new ArchiveError(
		`Could not detect archive format from URL. Expected .zip, .tar.gz, .tgz, or .tar — got ${pathname}`,
	);
}

/**
 * Download an archive to memory, with a size cap and a timeout. Only http(s)
 * schemes are accepted.
 */
export async function fetchArchive(url: string): Promise<Buffer> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new ArchiveError(`Not a valid URL: ${url}`);
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new ArchiveError(`Only http(s) URLs are supported, got ${parsed.protocol}`);
	}

	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			signal: ac.signal,
			redirect: 'follow',
			headers: {
				'User-Agent': 'skills-manager/0.1',
				Accept: 'application/octet-stream, application/zip, application/x-gzip, */*',
			},
		});
		if (!res.ok) {
			throw new ArchiveError(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
		}
		const declared = Number(res.headers.get('content-length') ?? '0');
		if (declared > MAX_BYTES) {
			throw new ArchiveError(`Archive too large: Content-Length ${declared} > ${MAX_BYTES} bytes`);
		}
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.length > MAX_BYTES) {
			throw new ArchiveError(`Archive too large: downloaded ${buf.length} > ${MAX_BYTES} bytes`);
		}
		return buf;
	} finally {
		clearTimeout(timer);
	}
}

export async function extractArchive(
	buffer: Buffer,
	format: ArchiveFormat,
	destDir: string,
): Promise<void> {
	switch (format) {
		case 'zip':
			extractZip(buffer, destDir);
			return;
		case 'targz':
			await extractTar(Buffer.from(gunzipSync(buffer)), destDir);
			return;
		case 'tar':
			await extractTar(buffer, destDir);
			return;
	}
}

function extractZip(buffer: Buffer, destDir: string): void {
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(buffer);
	} catch (err) {
		throw new ArchiveError(`Failed to unzip archive: ${(err as Error).message}`);
	}
	for (const [entryPath, data] of Object.entries(files)) {
		// Directory entries end with `/` and have empty content.
		if (entryPath.endsWith('/')) continue;
		const safe = sanitizeEntryPath(entryPath);
		if (!safe) continue;
		const outPath = join(destDir, safe);
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, Buffer.from(data));
	}
}

async function extractTar(buffer: Buffer, destDir: string): Promise<void> {
	const extract = tarExtract();
	return new Promise<void>((resolve, reject) => {
		extract.on('entry', (header, stream, next) => {
			const safe = sanitizeEntryPath(header.name);
			if (!safe || header.type !== 'file') {
				stream.on('end', next);
				stream.resume();
				return;
			}
			const outPath = join(destDir, safe);
			mkdirSync(dirname(outPath), { recursive: true });
			const chunks: Buffer[] = [];
			stream.on('data', (chunk: unknown) => {
				chunks.push(chunk as Buffer);
			});
			stream.on('end', () => {
				writeFileSync(outPath, Buffer.concat(chunks));
				next();
			});
			stream.on('error', reject);
		});
		extract.on('finish', resolve);
		extract.on('error', (err) => reject(new ArchiveError(`Tar extraction failed: ${err.message}`)));
		extract.end(buffer);
	});
}

/**
 * Normalize an archive entry path, rejecting absolute paths and any `..`
 * segments. Returns a safe relative POSIX path, or null to drop the entry.
 */
function sanitizeEntryPath(raw: string): string | null {
	if (!raw) return null;
	if (raw.includes('\0')) return null;
	// Reject absolute paths.
	if (raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)) return null;
	const parts: string[] = [];
	for (const part of raw.split(/[\\/]/)) {
		if (part === '' || part === '.') continue;
		if (part === '..') return null;
		parts.push(part);
	}
	if (parts.length === 0) return null;
	return parts.join('/');
}

/**
 * If `dir` contains exactly one entry and that entry is a directory, return
 * its name — this is the typical GitHub (`repo-main/`) and npm (`package/`)
 * tarball shape. Otherwise return null.
 */
export function findSingleTopLevelDir(dir: string): string | null {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return null;
	}
	if (entries.length !== 1) return null;
	const only = entries[0]!;
	try {
		if (!statSync(join(dir, only)).isDirectory()) return null;
	} catch {
		return null;
	}
	return only;
}

/**
 * Infer a skill name from (in order of preference): --as, --subdir basename,
 * or the archive filename stem.
 */
export function inferSkillName(
	url: string,
	subdir: string | undefined,
	override: string | undefined,
): string | null {
	if (override) return override;
	if (subdir) {
		const parts = subdir.split(/[\\/]/).filter(Boolean);
		const last = parts[parts.length - 1];
		if (last) return last;
	}
	try {
		const u = new URL(url);
		const file = basename(u.pathname);
		return file.replace(/\.(zip|tar\.gz|tgz|tar)$/i, '') || null;
	} catch {
		return null;
	}
}
