import { listUnmanaged, selectTargets, takeSnapshot } from '../compare.js';
import { STATUS_WORD, bold, dim, formatTable, paintStatus, paintStatusSymbol } from '../format.js';
import type { AppConfig } from '../types.js';

export interface DoctorResult {
	readonly exitCode: 0 | 1;
	readonly output: string;
}

export function runDoctor(config: AppConfig): DoctorResult {
	const snapshot = takeSnapshot(config);
	const targets = selectTargets(config, snapshot, {});

	const sections: string[] = [];

	// Paths.
	sections.push(bold('Paths'));
	const pathRows: string[][] = [
		['  SSOT', config.sourceDir + sourceAnnotation(snapshot.source.rootExists)],
	];
	for (const agent of config.agents) {
		const inv = snapshot.agents.get(agent.name);
		pathRows.push([`  ${agent.name}`, agent.dir + sourceAnnotation(inv?.rootExists ?? false)]);
	}
	if (config.envFile) {
		pathRows.push([dim('  .env'), dim(config.envFile)]);
	} else {
		pathRows.push([dim('  .env'), dim('(none — using process.env)')]);
	}
	sections.push(formatTable(pathRows));

	// Effective rules remain visible even when matching paths are excluded.
	sections.push('');
	sections.push(bold('Path rules'));
	for (const agent of config.agents) {
		sections.push(`  ${agent.name} scan exclude: ${JSON.stringify(agent.scanExcludePatterns)}`);
		sections.push(`  ${agent.name} write deny: ${JSON.stringify(agent.writeDenyPatterns)}`);
	}

	// Source inventory.
	sections.push('');
	sections.push(bold('SSOT skills'));
	if (snapshot.source.skills.length === 0) {
		sections.push('  (no skills found)');
	} else {
		for (const s of snapshot.source.skills) {
			const marker = s.valid ? ' ' : '!';
			sections.push(`  ${marker} ${s.name}  ${dim(`${s.files.length} file(s)`)}`);
			for (const d of s.diagnostics) {
				sections.push(`    ${dim(`- ${d}`)}`);
			}
		}
	}

	// Deployment matrix.
	sections.push('');
	sections.push(bold('Deployment matrix'));
	if (snapshot.source.skills.length === 0 || config.agents.length === 0) {
		sections.push('  (no targets to render)');
	} else {
		const agents = [...config.agents].sort((a, b) => (a.name < b.name ? -1 : 1));
		const header = ['  skill', ...agents.map((a) => a.name)];
		const rows: string[][] = [header];
		for (const skill of snapshot.source.skills) {
			const row = [`  ${skill.name}`];
			for (const agent of agents) {
				const t = targets.find((x) => x.skill === skill.name && x.agent === agent.name);
				row.push(t ? `${paintStatusSymbol(t.status)} ${paintStatus(t.status)}` : '-');
			}
			rows.push(row);
		}
		sections.push(formatTable(rows));
	}

	// Unmanaged skills.
	const unmanaged = listUnmanaged(config, snapshot);
	if (unmanaged.length > 0) {
		sections.push('');
		sections.push(bold('Unmanaged (agent-only) skills'));
		for (const u of unmanaged) {
			sections.push(`  ${u.agent}: ${u.skill}`);
		}
	}

	// Diagnostics.
	const diagnostics: string[] = [];
	for (const d of snapshot.source.diagnostics) diagnostics.push(`[SSOT] ${d}`);
	for (const agent of config.agents) {
		const inv = snapshot.agents.get(agent.name);
		if (!inv) continue;
		for (const d of inv.diagnostics) diagnostics.push(`[${agent.name}] ${d}`);
		for (const s of inv.skills) {
			for (const d of s.diagnostics) diagnostics.push(`[${agent.name}:${s.name}] ${d}`);
		}
	}
	for (const s of snapshot.source.skills) {
		for (const d of s.diagnostics) diagnostics.push(`[SSOT:${s.name}] ${d}`);
	}
	if (diagnostics.length > 0) {
		sections.push('');
		sections.push(bold('Diagnostics'));
		for (const d of diagnostics) sections.push(`  ${d}`);
	}

	// Summary counts.
	const counts: Record<string, number> = {
		synced: 0,
		missing: 0,
		different: 0,
		unmanaged: 0,
		blocked: 0,
	};
	for (const t of targets) counts[t.status] = (counts[t.status] ?? 0) + 1;
	counts.unmanaged = unmanaged.length;

	sections.push('');
	sections.push(bold('Summary'));
	const summaryRows: string[][] = [];
	for (const k of ['synced', 'missing', 'different', 'unmanaged', 'blocked'] as const) {
		summaryRows.push([`  ${STATUS_WORD[k]}`, String(counts[k])]);
	}
	sections.push(formatTable(summaryRows));

	// Unmanaged entries are informational; blocked deployments require attention.
	const drift = counts.missing! + counts.different! + counts.blocked!;
	const exitCode: 0 | 1 = drift > 0 ? 1 : 0;

	return { exitCode, output: sections.join('\n') };
}

function sourceAnnotation(exists: boolean): string {
	return exists ? '' : dim('  (not found)');
}
