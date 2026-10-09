export type AgentName = string;

export interface AgentConfig {
	readonly name: AgentName;
	readonly envVar: string;
	readonly dir: string;
	readonly scanExcludePatterns: readonly string[];
	readonly writeDenyPatterns: readonly string[];
}

export interface AppConfig {
	readonly envFile: string | null;
	readonly sourceDir: string;
	readonly agents: readonly AgentConfig[];
}

export type SkillStatus = 'synced' | 'missing' | 'different' | 'unmanaged' | 'blocked';

/**
 * skill root 掃描結果中的一個檔案。
 *
 * @remarks
 * 掃描時會先套用忽略規則，再記錄：
 *
 * - `relPath`：相對於 skill root 的路徑，使用 `/` 分隔。
 * - `size`：檔案大小，單位為 bytes；不參與內容比較。
 * - `sha256`：讀取檔案 bytes 後算出的雜湊值，用來比較同一路徑的內容。
 */
export interface SkillFile {
	readonly relPath: string;
	readonly size: number;
	readonly sha256: string;
}

/**
 * 一個可部署的 skill root 的掃描結果。
 *
 * @remarks
 * skill root 是 SSOT 或 agent skills 目錄下的直接子目錄；其中可以有多個巢狀 skill。
 * 比較和部署都以整個 root 為單位，而非單一 `SKILL.md`。
 *
 * - `name`：root 的目錄名稱，用來配對 SSOT 和 agent 端。
 * - `root`：該目錄在檔案系統中的路徑。
 * - `skillPaths`：各個 `SKILL.md` 所在的相對目錄；`.` 表示 root 本身。
 * - `files`：套用忽略規則後掃描到的檔案，包含巢狀 skill 以外的檔案。
 * - `diagnostics`：掃描時發現的問題。
 * - `valid`：掃描成功且找到至少一個 `SKILL.md` 時為 `true`。
 */
export interface SkillInventoryEntry {
	readonly name: string;
	readonly root: string;
	readonly skillPaths: readonly string[];
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
	readonly blockedReason?: string;
}

export interface Selector {
	readonly root?: string;
	readonly agent?: string;
}

export interface AppliedOutcome {
	readonly skill: string;
	readonly agent: AgentName;
	readonly action: 'created' | 'replaced' | 'skipped-synced' | 'skipped-conflict' | 'failed';
	readonly reason?: string;
}
