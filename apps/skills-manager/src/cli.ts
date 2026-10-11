import { runApply } from './commands/apply.js';
import { runDiff } from './commands/diff.js';
import { runDoctor } from './commands/doctor.js';
import { runImport } from './commands/import.js';
import { ConfigError, loadConfig, rejectOverlappingPaths } from './config.js';

const HELP = `skills — local-only global skills manager

USAGE
  skills <command> [options]

COMMANDS
  doctor [options]           Show source, agents, deployment matrix, and summary
  diff   [options]           Compare source skill roots with targets (read-only)
  apply  [options]           Deploy source skill roots to targets
  import <url> [options]     Download a skill root archive (zip / tar.gz) into the source

COMMON OPTIONS
  --source <dir>             Override SKILLS_SOURCE_DIR for this command
  --root <name>              Limit to one skill root  (diff / apply)
  --skill <name>             Alias for --root
  --agent <name>             Limit to one agent  (diff / apply)

DIFF OPTIONS
  --target <dir>             Compare only this skills directory (instead of agents)
  (default)                  One line per root with status and file change counts
  --summary                  Same as the default output
  --stat                     Per-file add/remove/modify list (no textual diff)
  --verbose                  Show the full textual diff

APPLY OPTIONS
  --target <dir>             Deploy only to this skills directory (instead of agents)
  --dry-run                  Show plan without touching the filesystem
  --force                    Overwrite \`different\` targets with source content

IMPORT OPTIONS
  --subdir <path>            Treat this subpath of the archive as the skill root
  --as <name>                Override the inferred skill root name
  --force                    Replace an existing source skill root with the same name

EXIT CODES
  0  success, no drift
  1  success, found missing / different targets
  2  configuration, argument, or I/O error

CONFIG (.env)
  SKILLS_SOURCE_DIR          Canonical SSOT directory (unless --source is given)
  CLAUDE_SKILLS_DIR          Enable Claude Code
  CODEX_SKILLS_DIR           Enable Codex
  CURSOR_SKILLS_DIR          Enable Cursor

The CLI looks for \`.env\` in the current working directory, then
\`~/.config/skills-manager/.env\`. If neither exists it uses process.env.
CLI paths resolve against the current working directory. --target replaces
the agent list; use --source and --target together for repository-local deployment.
`;

interface ParsedArgs {
	readonly command: string;
	readonly positional: readonly string[];
	readonly root?: string;
	readonly agent?: string;
	readonly source?: string;
	readonly target?: string;
	readonly subdir?: string;
	readonly as?: string;
	readonly dryRun: boolean;
	readonly force: boolean;
	readonly summary: boolean;
	readonly stat: boolean;
	readonly verbose: boolean;
	readonly help: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
	let root: string | undefined;
	let agent: string | undefined;
	let source: string | undefined;
	let target: string | undefined;
	let subdir: string | undefined;
	let as: string | undefined;
	let dryRun = false;
	let force = false;
	let summary = false;
	let stat = false;
	let verbose = false;
	let help = false;

	const positional: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		if (a === '-h' || a === '--help') {
			help = true;
			continue;
		}
		if (a === '--dry-run') {
			dryRun = true;
			continue;
		}
		if (a === '--force') {
			force = true;
			continue;
		}
		if (a === '--summary') {
			summary = true;
			continue;
		}
		if (a === '--stat') {
			stat = true;
			continue;
		}
		if (a === '--verbose') {
			verbose = true;
			continue;
		}
		if (a === '--root' || a.startsWith('--root=') || a === '--skill' || a.startsWith('--skill=')) {
			const flag = a.startsWith('--root') ? '--root' : '--skill';
			const v = readValue(flag, a, argv, i);
			if (root !== undefined) throw new UsageError('--root/--skill may only be given once');
			root = v.value;
			if (v.consumed) i++;
			continue;
		}
		if (a === '--agent' || a.startsWith('--agent=')) {
			const v = readValue('--agent', a, argv, i);
			if (agent !== undefined) throw new UsageError('--agent may only be given once');
			agent = v.value;
			if (v.consumed) i++;
			continue;
		}
		if (a === '--source' || a.startsWith('--source=')) {
			const v = readValue('--source', a, argv, i);
			if (source !== undefined) throw new UsageError('--source may only be given once');
			source = v.value;
			if (v.consumed) i++;
			continue;
		}
		if (a === '--target' || a.startsWith('--target=')) {
			const v = readValue('--target', a, argv, i);
			if (target !== undefined) throw new UsageError('--target may only be given once');
			target = v.value;
			if (v.consumed) i++;
			continue;
		}
		if (a === '--subdir' || a.startsWith('--subdir=')) {
			const v = readValue('--subdir', a, argv, i);
			if (subdir !== undefined) throw new UsageError('--subdir may only be given once');
			subdir = v.value;
			if (v.consumed) i++;
			continue;
		}
		if (a === '--as' || a.startsWith('--as=')) {
			const v = readValue('--as', a, argv, i);
			if (as !== undefined) throw new UsageError('--as may only be given once');
			as = v.value;
			if (v.consumed) i++;
			continue;
		}
		if (a.startsWith('--')) {
			throw new UsageError(`Unknown option: ${a}`);
		}
		positional.push(a);
	}

	if (!help && positional.length === 0) {
		help = true;
	}

	if (Number(summary) + Number(stat) + Number(verbose) > 1) {
		throw new UsageError('--summary, --stat, and --verbose are mutually exclusive');
	}

	const command = positional[0] ?? '';
	return {
		command,
		positional: positional.slice(1),
		root,
		agent,
		source,
		target,
		subdir,
		as,
		dryRun,
		force,
		summary,
		stat,
		verbose,
		help,
	};
}

function readValue(
	name: string,
	a: string,
	argv: readonly string[],
	i: number,
): { value: string; consumed: boolean } {
	if (a.startsWith(`${name}=`)) {
		const value = a.slice(name.length + 1);
		if (!value) throw new UsageError(`${name} requires a value`);
		return { value, consumed: false };
	}
	const next = argv[i + 1];
	if (!next || next.startsWith('-')) {
		throw new UsageError(`${name} requires a value`);
	}
	return { value: next, consumed: true };
}

export class UsageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UsageError';
	}
}

export async function main(argv: readonly string[]): Promise<number> {
	let parsed: ParsedArgs;
	try {
		parsed = parseArgs(argv);
	} catch (err) {
		if (err instanceof UsageError) {
			process.stderr.write(`error: ${err.message}\n\n${HELP}`);
			return 2;
		}
		throw err;
	}

	if (parsed.help) {
		process.stdout.write(HELP);
		return 0;
	}

	const { command } = parsed;
	try {
		switch (command) {
			case 'doctor': {
				rejectExtraPositional(command, parsed.positional);
				if (parsed.target) throw new UsageError('doctor does not accept --target');
				if (parsed.root || parsed.agent) {
					throw new UsageError('doctor does not accept --root or --agent');
				}
				rejectImportFlags(command, parsed);
				if (parsed.dryRun || parsed.force || parsed.summary || parsed.stat || parsed.verbose) {
					throw new UsageError('doctor does not accept apply/diff flags');
				}
				const result = runDoctor(loadConfig(process.cwd(), { source: parsed.source }));
				process.stdout.write(`${result.output}\n`);
				return result.exitCode;
			}
			case 'diff': {
				rejectExtraPositional(command, parsed.positional);
				rejectImportFlags(command, parsed);
				if (parsed.target && parsed.agent) {
					throw new UsageError('--target and --agent cannot be combined');
				}
				if (parsed.dryRun || parsed.force) {
					throw new UsageError('diff does not accept --dry-run or --force');
				}
				const mode = parsed.verbose ? 'full' : parsed.stat ? 'stat' : 'summary';
				const config = loadConfig(process.cwd(), { source: parsed.source, target: parsed.target });
				rejectOverlappingPaths(config);
				const result = runDiff(config, {
					selector: { root: parsed.root, agent: parsed.agent },
					mode,
				});
				process.stdout.write(result.output + (result.output ? '\n' : ''));
				return result.exitCode;
			}
			case 'apply': {
				rejectExtraPositional(command, parsed.positional);
				rejectImportFlags(command, parsed);
				if (parsed.target && parsed.agent) {
					throw new UsageError('--target and --agent cannot be combined');
				}
				if (parsed.summary || parsed.stat || parsed.verbose) {
					throw new UsageError('apply does not accept --summary, --stat, or --verbose');
				}
				const config = loadConfig(process.cwd(), { source: parsed.source, target: parsed.target });
				rejectOverlappingPaths(config);
				const result = runApply(config, {
					selector: { root: parsed.root, agent: parsed.agent },
					dryRun: parsed.dryRun,
					force: parsed.force,
				});
				process.stdout.write(`${result.output}\n`);
				return result.exitCode;
			}
			case 'import': {
				if (parsed.target) throw new UsageError('import does not accept --target');
				if (parsed.positional.length === 0) {
					throw new UsageError('import requires a URL — e.g. skills import <url>');
				}
				if (parsed.positional.length > 1) {
					throw new UsageError(
						`import takes exactly one URL; extra args: ${parsed.positional.slice(1).join(' ')}`,
					);
				}
				if (parsed.root || parsed.agent) {
					throw new UsageError('import does not accept --root or --agent');
				}
				if (parsed.dryRun || parsed.summary || parsed.stat || parsed.verbose) {
					throw new UsageError('import does not accept --dry-run / --summary / --stat / --verbose');
				}
				const config = loadConfig(process.cwd(), { source: parsed.source });
				const result = await runImport(config, {
					url: parsed.positional[0]!,
					subdir: parsed.subdir,
					as: parsed.as,
					force: parsed.force,
				});
				process.stdout.write(`${result.output}\n`);
				return result.exitCode;
			}
			default:
				throw new UsageError(`Unknown command: ${command}`);
		}
	} catch (err) {
		if (err instanceof UsageError) {
			process.stderr.write(`error: ${err.message}\n\n${HELP}`);
			return 2;
		}
		if (err instanceof ConfigError) {
			process.stderr.write(`config error: ${err.message}\n`);
			return 2;
		}
		process.stderr.write(`error: ${(err as Error).message}\n`);
		return 2;
	}
}

function rejectExtraPositional(command: string, extra: readonly string[]): void {
	if (extra.length > 0) {
		throw new UsageError(`${command} does not accept extra positional args: ${extra.join(' ')}`);
	}
}

function rejectImportFlags(command: string, parsed: ParsedArgs): void {
	if (parsed.subdir !== undefined || parsed.as !== undefined) {
		throw new UsageError(`${command} does not accept --subdir or --as (import only)`);
	}
}
