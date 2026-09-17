export const PREFIX = '@agent';
export const ACTION = 'action';
export const ACTION_PREFIX = `${PREFIX}:${ACTION}:`;

export const ACTIONS = {
	DO: 'do',
	ASK: 'ask',
	DISCUSS: 'discuss',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];
