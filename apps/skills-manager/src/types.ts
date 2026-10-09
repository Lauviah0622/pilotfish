export type AgentName = string;

export interface AgentConfig {
	readonly name: AgentName;
	readonly envVar: string;
	readonly dir: string;
}

export interface AppConfig {
	readonly envFile: string | null;
	readonly sourceDir: string;
	readonly agents: readonly AgentConfig[];
}

export type SkillStatus = 'synced' | 'missing' | 'different' | 'unmanaged';

export interface SkillFile {
	readonly relPath: string;
	readonly size: number;
	readonly sha256: string;
}

export interface SkillInventoryEntry {
	readonly name: string;
	readonly root: string;
	readonly files: readonly SkillFile[];
	readonly diagnostics: readonly string[];
	readonly valid: boolean;
}

export interface InventoryResult {
	readonly root: string;
	readonly skills: readonly SkillInventoryEntry[];
	readonly diagnostics: readonly string[];
	readonly rootExists: boolean;
}

export interface FileChange {
	readonly kind: 'added' | 'removed' | 'modified';
	readonly relPath: string;
}

export interface DeploymentTarget {
	readonly skill: string;
	readonly agent: AgentName;
	readonly status: SkillStatus;
	readonly source: SkillInventoryEntry | null;
	readonly target: SkillInventoryEntry | null;
	readonly changes: readonly FileChange[];
}

export interface Selector {
	readonly skill?: string;
	readonly agent?: string;
}

export interface AppliedOutcome {
	readonly skill: string;
	readonly agent: AgentName;
	readonly action: 'created' | 'replaced' | 'skipped-synced' | 'skipped-conflict' | 'failed';
	readonly reason?: string;
}
