/** Agent IDs and environment keys are explicit; directory values enable agents. */
export interface AgentDefinition {
	readonly id: string;
	readonly env: {
		readonly skillsDir: string;
		readonly scanExcludePatterns: string;
		readonly writeDenyPatterns: string;
	};
}

export const AGENT_DEFINITIONS = [
	{
		id: 'claude',
		env: {
			skillsDir: 'CLAUDE_SKILLS_DIR',
			scanExcludePatterns: 'CLAUDE_SCAN_EXCLUDE_PATTERNS',
			writeDenyPatterns: 'CLAUDE_WRITE_DENY_PATTERNS',
		},
	},
	{
		id: 'codex',
		env: {
			skillsDir: 'CODEX_SKILLS_DIR',
			scanExcludePatterns: 'CODEX_SCAN_EXCLUDE_PATTERNS',
			writeDenyPatterns: 'CODEX_WRITE_DENY_PATTERNS',
		},
	},
	{
		id: 'cursor',
		env: {
			skillsDir: 'CURSOR_SKILLS_DIR',
			scanExcludePatterns: 'CURSOR_SCAN_EXCLUDE_PATTERNS',
			writeDenyPatterns: 'CURSOR_WRITE_DENY_PATTERNS',
		},
	},
] as const satisfies readonly AgentDefinition[];
