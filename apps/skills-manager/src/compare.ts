import { ConfigError, requireAgent } from './config.js';
import { scanInventory } from './inventory.js';
import { pathMatcher, writeDeniedReason } from './path-rules.js';
import type {
	AgentConfig,
	AppConfig,
	DeploymentTarget,
	FileChange,
	InventoryResult,
	Selector,
	SkillInventoryEntry,
	SkillStatus,
} from './types.js';

export interface Snapshot {
	readonly source: InventoryResult;
	readonly agents: Map<string, InventoryResult>;
}

export function takeSnapshot(config: AppConfig): Snapshot {
	const source = scanInventory(config.sourceDir);
	const agents = new Map<string, InventoryResult>();
	for (const agent of config.agents) {
		agents.set(agent.name, scanInventory(agent.dir, agent.scanExcludePatterns));
	}
	return { source, agents };
}

export function compareSkills(
	source: SkillInventoryEntry | null,
	target: SkillInventoryEntry | null,
): { status: SkillStatus; changes: FileChange[] } {
	if (source && !target) {
		const changes = source.files.map<FileChange>((f) => ({
			kind: 'added',
			relPath: f.relPath,
		}));
		return { status: 'missing', changes };
	}
	if (!source && target) {
		return { status: 'unmanaged', changes: [] };
	}
	if (!source || !target) {
		return { status: 'synced', changes: [] };
	}
	const srcMap = new Map(source.files.map((f) => [f.relPath, f] as const));
	const tgtMap = new Map(target.files.map((f) => [f.relPath, f] as const));
	const changes: FileChange[] = [];
	for (const [rel, sf] of srcMap) {
		const tf = tgtMap.get(rel);
		if (!tf) {
			changes.push({ kind: 'added', relPath: rel });
			continue;
		}
		if (sf.sha256 !== tf.sha256) {
			changes.push({ kind: 'modified', relPath: rel });
		}
	}
	for (const rel of tgtMap.keys()) {
		if (!srcMap.has(rel)) changes.push({ kind: 'removed', relPath: rel });
	}
	changes.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
	return { status: changes.length === 0 ? 'synced' : 'different', changes };
}

/**
 * Compute deployment targets for a selector.
 *
 * - Without --skill: iterate every SSOT skill.
 * - Without --agent: iterate every enabled agent.
 *
 * `unmanaged` agent-only skills are NOT returned here; `diff` and `apply`
 * work only on SSOT skills. The `doctor` command surfaces them separately.
 */
export function selectTargets(
	config: AppConfig,
	snapshot: Snapshot,
	selector: Selector,
): DeploymentTarget[] {
	validateSelector(config, snapshot, selector);

	const sourceSkills = snapshot.source.skills;
	const skills = selector.skill
		? sourceSkills.filter((s) => s.name === selector.skill)
		: sourceSkills;

	const agents: AgentConfig[] = selector.agent
		? [requireAgent(config, selector.agent)]
		: [...config.agents];

	const results: DeploymentTarget[] = [];
	for (const agent of agents.sort((a, b) => (a.name < b.name ? -1 : 1))) {
		const inv = snapshot.agents.get(agent.name);
		for (const skill of skills) {
			const tgt = inv?.skills.find((s) => s.name === skill.name) ?? null;
			const excluded = pathMatcher(agent.scanExcludePatterns);
			const comparableSource = {
				...skill,
				files: skill.files.filter((f) => !excluded.ignores(`${skill.name}/${f.relPath}`)),
			};
			const { status, changes } = compareSkills(comparableSource, tgt);
			const blockedReason = writeDeniedReason(skill.name, agent.writeDenyPatterns);
			results.push({
				skill: skill.name,
				agent: agent.name,
				status: blockedReason ? 'blocked' : status,
				blockedReason,
				source: skill,
				target: tgt,
				changes,
			});
		}
	}
	return results;
}

function validateSelector(config: AppConfig, snapshot: Snapshot, selector: Selector): void {
	if (selector.skill) {
		const found = snapshot.source.skills.some((s) => s.name === selector.skill);
		if (!found) {
			throw new ConfigError(`Skill "${selector.skill}" not found in SSOT (${config.sourceDir}).`);
		}
	}
	if (selector.agent) {
		requireAgent(config, selector.agent);
	}
}

export interface UnmanagedEntry {
	readonly agent: string;
	readonly skill: string;
}

export function listUnmanaged(config: AppConfig, snapshot: Snapshot): UnmanagedEntry[] {
	const sourceNames = new Set(snapshot.source.skills.map((s) => s.name));
	const out: UnmanagedEntry[] = [];
	for (const agent of config.agents) {
		const inv = snapshot.agents.get(agent.name);
		if (!inv) continue;
		for (const s of inv.skills) {
			if (!sourceNames.has(s.name)) {
				out.push({ agent: agent.name, skill: s.name });
			}
		}
	}
	out.sort((a, b) =>
		a.agent !== b.agent
			? a.agent < b.agent
				? -1
				: 1
			: a.skill < b.skill
				? -1
				: a.skill > b.skill
					? 1
					: 0,
	);
	return out;
}
