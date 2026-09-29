export type Position = {
	line: number;
	character: number;
};

export type TextRange = readonly [Position, Position];

declare const spanRangeBrand: unique symbol;
export type SpanRange = TextRange & { readonly [spanRangeBrand]: true };

export type SearchDirection = 'up' | 'down';

export type CharacterSpan = readonly [from: number, to: number];

export const makeLineRange = (line: number, start: number, end: number): SpanRange =>
	[
		{ line, character: start },
		{ line, character: end },
	] as unknown as SpanRange;
