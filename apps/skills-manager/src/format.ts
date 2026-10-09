import { createPatch } from 'diff';
import pc from 'picocolors';
import type { SkillStatus } from './types.js';

export const STATUS_SYMBOL: Record<SkillStatus, string> = {
	blocked: '×',
	synced: '✓',
	missing: '·',
	different: '≠',
	unmanaged: '+',
};

export const STATUS_WORD: Record<SkillStatus, string> = {
	blocked: 'blocked',
	synced: 'synced',
	missing: 'missing',
	different: 'different',
	unmanaged: 'unmanaged',
};

const STATUS_COLOR: Record<SkillStatus, (s: string) => string> = {
	blocked: pc.red,
	synced: pc.green,
	missing: pc.yellow,
	different: pc.red,
	unmanaged: pc.cyan,
};

export function paintStatus(s: SkillStatus): string {
	return STATUS_COLOR[s](STATUS_WORD[s]);
}

export function paintStatusSymbol(s: SkillStatus): string {
	return STATUS_COLOR[s](STATUS_SYMBOL[s]);
}

export const bold = pc.bold;
export const dim = pc.dim;
export const red = pc.red;
export const green = pc.green;
export const yellow = pc.yellow;

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function visibleWidth(s: string): number {
	return s.replace(ANSI_RE, '').length;
}

function padRightVisible(s: string, width: number): string {
	const visible = visibleWidth(s);
	if (visible >= width) return s;
	return s + ' '.repeat(width - visible);
}

/**
 * Render a table with column padding. Columns are separated by two spaces.
 */
export function formatTable(rows: readonly (readonly string[])[]): string {
	if (rows.length === 0) return '';
	const widths: number[] = [];
	for (const row of rows) {
		row.forEach((cell, i) => {
			const w = visibleWidth(cell);
			if (!widths[i] || widths[i]! < w) widths[i] = w;
		});
	}
	return rows
		.map((row) =>
			row
				.map((cell, i) => (i === row.length - 1 ? cell : padRightVisible(cell, widths[i] ?? 0)))
				.join('  '),
		)
		.join('\n');
}

/**
 * Produce a colored unified diff between two files. Binary content is
 * rendered as a single "Binary files differ" line.
 */
export function unifiedDiff(a: Buffer, b: Buffer, aLabel: string, bLabel: string): string {
	if (isBinary(a) || isBinary(b)) {
		return `Binary files ${aLabel} and ${bLabel} differ`;
	}
	const aText = a.toString('utf8');
	const bText = b.toString('utf8');
	if (aText === bText) return '';
	const patch = createPatch(bLabel, aText, bText, '', '', { context: 3 });
	return colorizePatch(stripPatchHeader(patch, aLabel, bLabel));
}

function isBinary(buf: Buffer): boolean {
	const n = Math.min(buf.length, 8000);
	for (let i = 0; i < n; i++) {
		if (buf[i] === 0) return true;
	}
	return false;
}

/**
 * `createPatch` emits:
 *   Index: label
 *   =============================================
 *   --- label\told
 *   +++ label\tnew
 *   @@ ...
 *
 * We swap the --- /+++ lines in for consistent `a/`+`b/` labels and drop the
 * Index / ==== lines.
 */
function stripPatchHeader(patch: string, aLabel: string, bLabel: string): string {
	const lines = patch.split('\n');
	// Drop the Index: line, the === line, and the two --- / +++ lines.
	const bodyStart = lines.findIndex((l) => l.startsWith('@@'));
	if (bodyStart === -1) return '';
	const body = lines.slice(bodyStart).join('\n');
	return [`--- a/${aLabel}`, `+++ b/${bLabel}`, body].join('\n');
}

function colorizePatch(patch: string): string {
	return patch
		.split('\n')
		.map((line) => {
			if (line.startsWith('+++') || line.startsWith('---')) return dim(line);
			if (line.startsWith('@@')) return dim(line);
			if (line.startsWith('+')) return green(line);
			if (line.startsWith('-')) return red(line);
			return line;
		})
		.join('\n');
}
