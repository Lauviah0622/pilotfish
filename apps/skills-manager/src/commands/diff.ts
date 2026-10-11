import { join } from 'node:path';
import { selectTargets, takeSnapshot } from '../compare.js';
import { bold, dim, green, paintStatus, red, unifiedDiff, yellow } from '../format.js';
import { fileExists, readFileBytes } from '../fsutil.js';
import type { AppConfig, DeploymentTarget, FileChange, Selector } from '../types.js';

export interface DiffOptions {
	readonly selector: Selector;
	readonly mode: 'full' | 'summary' | 'stat';
}

export interface DiffResult {
	readonly exitCode: 0 | 1;
	readonly output: string;
}

export function runDiff(config: AppConfig, options: DiffOptions): DiffResult {
	const snapshot = takeSnapshot(config);
	if (!snapshot.source.rootExists)
		throw new Error(`Source directory not found: ${config.sourceDir}`);
	const targets = selectTargets(config, snapshot, options.selector);

	// Verify all selected source skill roots are valid; otherwise fail.
	const invalid = snapshot.source.skills
		.filter((s) => (options.selector.root ? s.name === options.selector.root : true))
		.filter((s) => !s.valid);
	if (invalid.length > 0) {
		const details = invalid.map((s) => `  ${s.name}: ${s.diagnostics.join('; ')}`).join('\n');
		throw new Error(
			`Invalid skill root(s) in ${config.sourceOverridden ? 'source' : 'SSOT'}:\n${details}`,
		);
	}

	const lines: string[] = [];
	let drift = 0;

	for (const t of targets) {
		if (t.status !== 'synced') drift++;
		switch (options.mode) {
			case 'summary':
				lines.push(renderSummaryLine(t));
				break;
			case 'stat':
				lines.push(renderStatLines(t));
				break;
			case 'full':
				lines.push(renderFullTarget(t));
				break;
		}
	}

	return {
		exitCode: drift > 0 ? 1 : 0,
		output: lines.filter((l) => l !== '').join('\n'),
	};
}

function renderSummaryLine(t: DeploymentTarget): string {
	const header = `${bold(`${t.agent}:${t.skill}`)}  ${paintStatus(t.status)}`;
	if (t.blockedReason) return `${header}  ${dim(t.blockedReason)}`;
	if (t.status === 'synced' || t.status === 'missing') return header;
	const counts = countChanges(t.changes);
	return `${header}  ${dim(`${counts.added} added, ${counts.removed} removed, ${counts.modified} modified`)}`;
}

function renderStatLines(t: DeploymentTarget): string {
	const header = `${bold(`${t.agent}:${t.skill}`)}  ${paintStatus(t.status)}`;
	if (t.blockedReason) return `${header}  ${dim(t.blockedReason)}`;
	if (t.changes.length === 0) return header;
	const rows: string[] = [header];
	for (const c of t.changes) {
		rows.push(`  ${renderChangeMarker(c)} ${c.relPath}`);
	}
	return rows.join('\n');
}

function renderFullTarget(t: DeploymentTarget): string {
	const header = `${bold(`${t.agent}:${t.skill}`)}  ${paintStatus(t.status)}`;
	if (t.blockedReason) return `${header}  ${dim(t.blockedReason)}`;
	if (t.status === 'synced') return header;
	if (t.status === 'missing') {
		const files = t.source?.files.map((f) => `  ${green('+')} ${f.relPath}`).join('\n') ?? '';
		return [header, dim('  (not deployed to this agent)'), files].filter(Boolean).join('\n');
	}
	const parts: string[] = [header];
	for (const change of t.changes) {
		parts.push(renderChangeDiff(t, change));
	}
	return parts.join('\n');
}

function renderChangeMarker(c: FileChange): string {
	switch (c.kind) {
		case 'added':
			return green('+');
		case 'removed':
			return red('-');
		case 'modified':
			return yellow('~');
	}
}

function countChanges(changes: readonly FileChange[]): {
	added: number;
	removed: number;
	modified: number;
} {
	let added = 0;
	let removed = 0;
	let modified = 0;
	for (const c of changes) {
		if (c.kind === 'added') added++;
		else if (c.kind === 'removed') removed++;
		else modified++;
	}
	return { added, removed, modified };
}

function renderChangeDiff(t: DeploymentTarget, change: FileChange): string {
	const label = `${t.skill}/${change.relPath}`;
	const srcPath = t.source ? join(t.source.root, change.relPath) : null;
	const tgtPath = t.target ? join(t.target.root, change.relPath) : null;

	if (change.kind === 'added') {
		if (!srcPath || !fileExists(srcPath)) return dim(`  ${green('+')} ${change.relPath}`);
		const srcBuf = readFileBytes(srcPath);
		const diff = unifiedDiff(Buffer.alloc(0), srcBuf, '/dev/null', label);
		return [dim(`  added  ${change.relPath}`), indent(diff, 2)].join('\n');
	}
	if (change.kind === 'removed') {
		if (!tgtPath || !fileExists(tgtPath)) return dim(`  ${red('-')} ${change.relPath}`);
		const tgtBuf = readFileBytes(tgtPath);
		const diff = unifiedDiff(tgtBuf, Buffer.alloc(0), label, '/dev/null');
		return [dim(`  removed  ${change.relPath}`), indent(diff, 2)].join('\n');
	}
	// modified
	if (!srcPath || !tgtPath) return dim(`  ${yellow('~')} ${change.relPath}`);
	const srcBuf = readFileBytes(srcPath);
	const tgtBuf = readFileBytes(tgtPath);
	const diff = unifiedDiff(tgtBuf, srcBuf, label, label);
	return [dim(`  modified  ${change.relPath}`), indent(diff, 2)].join('\n');
}

function indent(block: string, n: number): string {
	const pad = ' '.repeat(n);
	return block
		.split('\n')
		.map((l) => (l === '' ? l : pad + l))
		.join('\n');
}
