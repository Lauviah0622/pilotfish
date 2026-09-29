export const PREFIX = '@agent';
export const ACTION = 'action';
export const ACTION_PREFIX = `${PREFIX}:${ACTION}`;

export const ACTIONS = {
	DO: 'do',
	ASK: 'ask',
	DISCUSS: 'discuss',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

export const REPLY_STATUSES = {
	DONE: 'done',
	PENDING: 'pending',
} as const;

export type ReplyStatus = (typeof REPLY_STATUSES)[keyof typeof REPLY_STATUSES];

export const AGENT_ACTION_PATTERN = /@agent:action:(do|ask|discuss)\b/;
export const AGENT_REPLY_PATTERN = /@agent:reply:(done|pending)\b/;
