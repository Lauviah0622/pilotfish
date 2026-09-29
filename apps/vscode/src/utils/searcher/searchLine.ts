import type { LineTextSource, Position, SearchDirection } from '../base';

export type SearchLineDecision<T> =
	| { kind: 'continue' }
	| { kind: 'stop' }
	| { kind: 'found'; value: T };

export const inspectMatch = <T>(match: T | undefined): SearchLineDecision<T> => {
	return match ? { kind: 'found', value: match } : { kind: 'continue' };
};

export type SearchLineResult<T> = {
	result: T;
	line: Position['line'];
	text: string;
};

export type SearchLineOptions = {
	inclusive?: boolean;
};

export type SearchLineContext = {
	text: string;
	position: Position;
	from: Position;
	direction: SearchDirection;
	isFirst: boolean;
	inclusive: boolean;
};

export type InspectLine<T> = (context: SearchLineContext) => SearchLineDecision<T>;

export const searchLine = <T>(
	source: LineTextSource,
	from: Position,
	direction: SearchDirection,
	inspectLine: InspectLine<T>,
	options: SearchLineOptions = {},
): SearchLineResult<T> | undefined => {
	if (from.line < 0 || from.line >= source.lineCount) return undefined;

	const step = direction === 'up' ? -1 : 1;
	const inclusive = options.inclusive ?? true;

	for (let line = from.line; line >= 0 && line < source.lineCount; line += step) {
		const text = source.getLine(line);
		const isFirst = line === from.line;
		const position = {
			line,
			character: isFirst ? from.character : direction === 'up' ? text.length : 0,
		};
		const decision = inspectLine({
			text,
			position,
			from,
			direction,
			isFirst,
			inclusive,
		});

		if (decision.kind === 'continue') continue;
		if (decision.kind === 'stop') return undefined;

		return { result: decision.value, line, text };
	}

	return undefined;
};
