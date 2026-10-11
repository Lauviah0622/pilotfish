import { join } from 'node:path';
import { compareSkills, selectTargets, takeSnapshot } from '../compare.js';
import { bold, dim, green, paintStatus, red, yellow } from '../format.js';
import { atomicDeploy, dirExists, ensureDir } from '../fsutil.js';
import { readSkill } from '../inventory.js';
import type {
	AppConfig,
	AppliedOutcome,
	DeploymentTarget,
	Selector,
	SkillStatus,
} from '../types.js';

export interface ApplyOptions {
	readonly selector: Selector;
	readonly dryRun: boolean;
	readonly force: boolean;
}

export interface ApplyResult {
	readonly exitCode: 0 | 1 | 2;
	readonly output: string;
}

export function runApply(config: AppConfig, options: ApplyOptions): ApplyResult {
	const snapshot = takeSnapshot(config);
	if (!snapshot.source.rootExists)
		throw new Error(`Source directory not found: ${config.sourceDir}`);
	const targets = selectTargets(config, snapshot, options.selector).map((t) => {
		if (t.blockedReason) return t;
		// Scan exclusions do not authorize overwriting an existing directory.
		// Inspect only this deployment target for planning and verification.
		const agent = config.agents.find((a) => a.name === t.agent)!;
		const path = join(agent.dir, t.skill);
		const target = dirExists(path) ? readSkill(t.skill, path) : null;
		return { ...t, target, ...compareSkills(t.source, target) };
	});

	// Fail if any selected SSOT skill root is invalid.
	const invalid = snapshot.source.skills
		.filter((s) => (options.selector.root ? s.name === options.selector.root : true))
		.filter((s) => !s.valid);
	if (invalid.length > 0) {
		const details = invalid.map((s) => `  ${s.name}: ${s.diagnostics.join('; ')}`).join('\n');
		throw new Error(
			`Invalid skill root(s) in ${config.sourceOverridden ? 'source' : 'SSOT'}:\n${details}`,
		);
	}

	const sections: string[] = [];
	sections.push(bold(options.dryRun ? 'Deployment plan (dry run)' : 'Deployment plan'));

	for (const t of targets) {
		sections.push(`  ${renderPlanLine(t, options.force)}`);
	}

	const outcomes: AppliedOutcome[] = [];
	let hasConflict = false;

	if (!options.dryRun) {
		sections.push('');
		sections.push(bold('Applying…'));
		for (const t of targets) {
			const outcome = applyTarget(config, t, options.force);
			outcomes.push(outcome);
			sections.push(`  ${renderOutcomeLine(outcome)}`);
			if (outcome.action === 'skipped-conflict' || outcome.action === 'failed') {
				hasConflict = true;
			}
		}

		// Verification pass: re-scan agent dirs that we touched and confirm synced.
		const verify = verifyOutcomes(config, outcomes);
		if (verify.length > 0) {
			sections.push('');
			sections.push(bold('Post-apply verification'));
			for (const line of verify) sections.push(`  ${line}`);
			if (verify.some((l) => l.includes('FAIL'))) {
				return { exitCode: 2, output: sections.join('\n') };
			}
		}
	} else {
		// Dry-run — still flag targets that would be refused without --force.
		for (const t of targets) {
			if (t.status === 'blocked' || (t.status === 'different' && !options.force))
				hasConflict = true;
		}
	}

	const exitCode: 0 | 1 | 2 = hasConflict ? 1 : 0;
	return { exitCode, output: sections.join('\n') };
}

function renderPlanLine(t: DeploymentTarget, force: boolean): string {
	const header = `${bold(`${t.agent}:${t.skill}`)}  ${paintStatus(t.status)}`;
	if (t.blockedReason) return `${header}  ${red(t.blockedReason)}`;
	const plan = plannedAction(t.status, force);
	return `${header}  ${describeAction(plan)}`;
}

function renderOutcomeLine(o: AppliedOutcome): string {
	const header = `${bold(`${o.agent}:${o.skill}`)}`;
	const extra = o.reason ? `  ${dim(o.reason)}` : '';
	return `${header}  ${colorForAction(o.action)}${extra}`;
}

type Action = 'create' | 'replace' | 'no-op' | 'refuse' | 'unmanaged-skip';

function plannedAction(status: SkillStatus, force: boolean): Action {
	switch (status) {
		case 'blocked':
			return 'refuse';
		case 'missing':
			return 'create';
		case 'synced':
			return 'no-op';
		case 'different':
			return force ? 'replace' : 'refuse';
		case 'unmanaged':
			return 'unmanaged-skip';
	}
}

function describeAction(a: Action): string {
	switch (a) {
		case 'create':
			return green('create');
		case 'replace':
			return yellow('replace (force)');
		case 'no-op':
			return dim('already synced — skip');
		case 'refuse':
			return red('conflict — skip (use --force to overwrite)');
		case 'unmanaged-skip':
			return dim('unmanaged — skip');
	}
}

function colorForAction(action: AppliedOutcome['action']): string {
	switch (action) {
		case 'created':
			return green('created');
		case 'replaced':
			return yellow('replaced');
		case 'skipped-synced':
			return dim('skipped (already synced)');
		case 'skipped-conflict':
			return red('skipped (conflict)');
		case 'failed':
			return red('failed');
	}
}

function applyTarget(config: AppConfig, t: DeploymentTarget, force: boolean): AppliedOutcome {
	if (t.blockedReason) {
		return { skill: t.skill, agent: t.agent, action: 'skipped-conflict', reason: t.blockedReason };
	}
	if (t.status === 'synced') {
		return { skill: t.skill, agent: t.agent, action: 'skipped-synced' };
	}
	if (t.status === 'unmanaged') {
		return {
			skill: t.skill,
			agent: t.agent,
			action: 'skipped-synced',
			reason: 'unmanaged — ignored',
		};
	}
	if (t.status === 'different' && !force) {
		return {
			skill: t.skill,
			agent: t.agent,
			action: 'skipped-conflict',
			reason: 'target differs from source — rerun with --force to overwrite',
		};
	}
	const agent = config.agents.find((a) => a.name === t.agent)!;
	ensureDir(agent.dir);

	const sourceRoot = t.source?.root;
	if (!sourceRoot) {
		return {
			skill: t.skill,
			agent: t.agent,
			action: 'failed',
			reason: 'no source directory',
		};
	}
	const targetPath = join(agent.dir, t.skill);
	const replace = t.status === 'different';
	try {
		atomicDeploy(sourceRoot, targetPath, replace);
	} catch (err) {
		return {
			skill: t.skill,
			agent: t.agent,
			action: 'failed',
			reason: (err as Error).message,
		};
	}
	return {
		skill: t.skill,
		agent: t.agent,
		action: replace ? 'replaced' : 'created',
	};
}

function verifyOutcomes(config: AppConfig, outcomes: readonly AppliedOutcome[]): string[] {
	const touched = outcomes.filter((o) => o.action === 'created' || o.action === 'replaced');
	if (touched.length === 0) return [];

	const out: string[] = [];
	for (const o of touched) {
		const agent = config.agents.find((a) => a.name === o.agent)!;
		const path = join(agent.dir, o.skill);
		const tgt = dirExists(path) ? readSkill(o.skill, path) : null;
		const src = readSkill(o.skill, join(config.sourceDir, o.skill));
		const { status } = compareSkills(src, tgt);
		if (status === 'synced') {
			out.push(`${o.agent}:${o.skill}  ${green('OK')}`);
		} else {
			out.push(`${o.agent}:${o.skill}  ${red('FAIL')} (status after apply: ${status})`);
		}
	}
	return out;
}
