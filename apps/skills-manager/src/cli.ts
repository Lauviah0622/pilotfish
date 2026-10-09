import { runApply } from './commands/apply.js';
import { runDiff } from './commands/diff.js';
import { runDoctor } from './commands/doctor.js';
import { runImport } from './commands/import.js';
import { ConfigError, loadConfig } from './config.js';

const HELP = `skills — local-only global skills manager

USAGE
  skills <command> [options]

COMMANDS
  doctor                     Show SSOT, agents, deployment matrix, and summary
  diff   [options]           Compare SSOT skills with agent inventories (read-only)
  apply  [options]           Deploy SSOT skills to agents
  import <url> [options]     Download a skill archive (zip / tar.gz) into the SSOT

COMMON OPTIONS
  --skill <name>             Limit to one skill  (diff / apply)
  --agent <name>             Limit to one agent  (diff / apply)

DIFF OPTIONS
  --summary                  One line per target
  --stat                     Per-file add/remove/modify list (no textual diff)

APPLY OPTIONS
  --dry-run                  Show plan without touching the filesystem
  --force                    Overwrite \`different\` targets with SSOT content

IMPORT OPTIONS
  --subdir <path>            Treat this subpath of the archive as the skill root
  --as <name>                Override the inferred skill name
  --force                    Replace an existing SSOT skill with the same name

EXIT CODES
  0  success, no drift
  1  success, found missing / different targets
  2  configuration, argument, or I/O error

CONFIG (.env)
  SKILLS_SOURCE_DIR          Canonical SSOT directory (required)
  <NAME>_SKILLS_DIR          Enable agent \`<name>\` (lowercased)

The CLI looks for \`.env\` in the current working directory, then
\`~/.config/skills-manager/.env\`. If neither exists it uses process.env.
`;

interface ParsedArgs {
	readonly command: string;
	readonly positional: readonly string[];
	readonly skill?: string;
	readonly agent?: string;
	readonly subdir?: string;
	readonly as?: string;
	readonly dryRun: boolean;
	readonly force: boolean;
	readonly summary: boolean;
	readonly stat: boolean;
	readonly help: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
	let skill: string | undefined;
	let agent: string | undefined;
	let subdir: string | undefined;
	let as: string | undefined;
	let dryRun = false;
	let force = false;
	let summary = false;
	let stat = false;
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
		if (a === '--skill' || a.startsWith('--skill=')) {
			const v = readValue('--skill', a, argv, i);
			if (skill !== undefined) throw new UsageError('--skill may only be given once');
			skill = v.value;
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

	if (summary && stat) {
		throw new UsageError('--summary and --stat are mutually exclusive');
	}

	const command = positional[0] ?? '';
	return {
		command,
		positional: positional.slice(1),
		skill,
		agent,
		subdir,
		as,
		dryRun,
		force,
		summary,
		stat,
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
		return { value: a.slice(name.length + 1), consumed: false };
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
		const config = loadConfig();
		switch (command) {
			case 'doctor': {
				rejectExtraPositional(command, parsed.positional);
				if (parsed.skill || parsed.agent) {
					throw new UsageError('doctor does not accept --skill or --agent');
				}
				rejectImportFlags(command, parsed);
				if (parsed.dryRun || parsed.force || parsed.summary || parsed.stat) {
					throw new UsageError('doctor does not accept apply/diff flags');
				}
				const result = runDoctor(config);
				process.stdout.write(`${result.output}\n`);
				return result.exitCode;
			}
			case 'diff': {
				rejectExtraPositional(command, parsed.positional);
				rejectImportFlags(command, parsed);
				if (parsed.dryRun || parsed.force) {
					throw new UsageError('diff does not accept --dry-run or --force');
				}
				const mode = parsed.summary ? 'summary' : parsed.stat ? 'stat' : 'full';
				const result = runDiff(config, {
					selector: { skill: parsed.skill, agent: parsed.agent },
					mode,
				});
				process.stdout.write(result.output + (result.output ? '\n' : ''));
				return result.exitCode;
			}
			case 'apply': {
				rejectExtraPositional(command, parsed.positional);
				rejectImportFlags(command, parsed);
				if (parsed.summary || parsed.stat) {
					throw new UsageError('apply does not accept --summary or --stat');
				}
				const result = runApply(config, {
					selector: { skill: parsed.skill, agent: parsed.agent },
					dryRun: parsed.dryRun,
					force: parsed.force,
				});
				process.stdout.write(`${result.output}\n`);
				return result.exitCode;
			}
			case 'import': {
				if (parsed.positional.length === 0) {
					throw new UsageError('import requires a URL — e.g. skills import <url>');
				}
				if (parsed.positional.length > 1) {
					throw new UsageError(
						`import takes exactly one URL; extra args: ${parsed.positional.slice(1).join(' ')}`,
					);
				}
				if (parsed.skill || parsed.agent) {
					throw new UsageError('import does not accept --skill or --agent');
				}
				if (parsed.dryRun || parsed.summary || parsed.stat) {
					throw new UsageError('import does not accept --dry-run / --summary / --stat');
				}
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
