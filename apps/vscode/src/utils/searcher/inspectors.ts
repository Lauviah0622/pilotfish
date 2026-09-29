import { type CharacterSpan, type SpanRange, makeLineRange } from '../base';
import type { CommentSyntax } from '../commentSyntax';
import {
	AGENT_ACTION_PATTERN,
	AGENT_REPLY_PATTERN,
	type Action,
	type ReplyStatus,
} from '../protocols/editor-skill-protocol';
import { type InspectLine, type SearchLineContext, inspectMatch } from './searchLine';

export type AgentCommentToken =
	| {
			kind: 'agent:action';
			type: Action;
			syntax: string;
			range: SpanRange;
	  }
	| {
			kind: 'agent:reply';
			status: ReplyStatus;
			syntax: string;
			range: SpanRange;
	  };

export type CommentBoundaryToken = {
	kind: 'comment-start' | 'comment-close';
	syntax: string;
	range: SpanRange;
};

const chooseNearestLineSpan = <T extends { range: SpanRange }>(
	spans: T[],
	context: SearchLineContext,
): T | undefined => {
	const inclusive = context.isFirst ? context.inclusive : true;
	const character = context.position.character;

	// 刪去掉不在 Position 的 candidates
	const eligibleCandidates = spans.filter((candidate) => {
		const start = candidate.range[0].character;

		// 目前只比較 token start
		if (context.direction === 'up') return inclusive ? start <= character : start < character;
		return inclusive ? start >= character : start > character;
	});

	// 根據 up, down 重新排序 candidates
	eligibleCandidates.sort((left, right) => {
		const difference = left.range[0].character - right.range[0].character;
		return context.direction === 'up' ? -difference : difference;
	});

	return eligibleCandidates[0];
};

const findMatchesFromText = (text: string, syntax: string): CharacterSpan[] => {
	const matches: CharacterSpan[] = [];
	let start = text.indexOf(syntax);

	while (start !== -1) {
		matches.push([start, start + syntax.length]);
		start = text.indexOf(syntax, start + syntax.length);
	}

	return matches;
};

export type AgentCommentKind = 'action' | 'reply';

export const AgentCommentInspector =
	(kind?: AgentCommentKind): InspectLine<AgentCommentToken> =>
	(context) => {
		const matches: AgentCommentToken[] = [];

		if (kind === 'action' || !kind) {
			for (const match of context.text.matchAll(new RegExp(AGENT_ACTION_PATTERN, 'g'))) {
				matches.push({
					kind: 'agent:action',
					type: match[1] as Action,
					syntax: match[0],
					range: makeLineRange(context.position.line, match.index, match.index + match[0].length),
				});
			}
		}

		if (kind === 'reply' || !kind) {
			for (const match of context.text.matchAll(new RegExp(AGENT_REPLY_PATTERN, 'g'))) {
				matches.push({
					kind: 'agent:reply',
					status: match[1] as ReplyStatus,
					syntax: match[0],
					range: makeLineRange(context.position.line, match.index, match.index + match[0].length),
				});
			}
		}

		return inspectMatch(chooseNearestLineSpan(matches, context));
	};

export const BlockCommentStartInspector =
	(syntax: CommentSyntax): InspectLine<CommentBoundaryToken> =>
	(context) => {
		if (syntax.kind === 'block') {
			const matches: CommentBoundaryToken[] = findMatchesFromText(context.text, syntax.open).map(
				([from, to]) => ({
					kind: 'comment-start',
					syntax: syntax.open,
					range: makeLineRange(context.position.line, from, to),
				}),
			);

			return inspectMatch(chooseNearestLineSpan(matches, context));
		}

		const start = context.text.length - context.text.trimStart().length;
		if (!context.text.startsWith(syntax.prefix, start)) return { kind: 'continue' };

		return inspectMatch(
			chooseNearestLineSpan(
				[
					{
						kind: 'comment-start',
						syntax: syntax.prefix,
						range: makeLineRange(context.position.line, start, start + syntax.prefix.length),
					},
				],
				context,
			),
		);
	};

export const BlockCommentCloseInspector =
	(syntax: Extract<CommentSyntax, { kind: 'block' }>): InspectLine<CommentBoundaryToken> =>
	(context) => {
		const matches: CommentBoundaryToken[] = findMatchesFromText(context.text, syntax.close).map(
			([from, to]) => ({
				kind: 'comment-close',
				syntax: syntax.close,
				range: makeLineRange(context.position.line, from, to),
			}),
		);

		return inspectMatch(chooseNearestLineSpan(matches, context));
	};
