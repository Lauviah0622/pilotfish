import ignore, { type Ignore } from 'ignore';

/** Patterns use gitignore wildcards, anchored to the configured agent root. */
export function pathMatcher(patterns: readonly string[]): Ignore {
	return ignore().add(patterns.map((pattern) => `/${pattern}`));
}

/** Deployment swaps a whole skill tree: protect matching trees and their ancestors. */
export function writeDeniedReason(skill: string, patterns: readonly string[]): string | undefined {
	for (const pattern of patterns) {
		const prefixes = [pattern];
		for (let i = 0; i < pattern.length; i++) {
			if (pattern[i] === '/') prefixes.push(pattern.slice(0, i + 1));
		}
		if (pathMatcher(prefixes).ignores(`${skill}/`)) {
			return `write denied by pattern ${JSON.stringify(pattern)}`;
		}
	}
	return undefined;
}
