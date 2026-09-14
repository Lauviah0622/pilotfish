---
name: collab
description: Handle @agent comment blocks embedded in source files. Invoke with an optional file:line reference (e.g. /collab src/foo.ts:42) to process the nearest block at that position.
---

# Collab Protocol

This skill processes `/* @agent */` comment blocks that the user writes directly in source files. It is the primary channel for inline instructions, questions, and design discussions.

## Core Protocol

All communication follows a symmetric pattern inside a single comment block:

- **User → Agent**: `@agent {{action}}` — the opening line declares what kind of instruction this is
- **Agent → User**: `@reply` — the agent always responds by appending a `@reply` line inside the same block

**Never delete the user's original block content.** Only append.

### Status Flow

Every `@reply` carries a status. The agent writes two edits per block:

1. **Start** — append `@reply status:pending` immediately when processing begins, so the user can see work is in progress
2. **Finish** — update to `@reply status:done` and add the reply content

```js
/* @agent do
 * Rename fetchUser → getUser throughout this file
 * @reply status:pending
 */

/* @agent do
 * Rename fetchUser → getUser throughout this file
 * @reply status:done — 7 instances renamed, type import on line 3 updated.
 */
```

This two-phase pattern applies to **all action types**.

## Invocation

- `/collab` — handle the block described or quoted in the current message
- `/collab src/components/Foo.tsx:42` — read from that file at that line, find the enclosing or nearest `/* @agent ... */` block, handle only that block

When a `file:line` is given:
1. Read the file starting at the given line
2. Locate the enclosing `/* @agent ... */` block (search up if mid-block, or take the next block below)
3. Handle that single block unless the user explicitly asks to scan further

## Actions

### `do`

Request a code change or implementation.

- Make the actual code changes in the file
- `@reply status:done` with a one-line summary (line numbers help)

```js
/* @agent do
 * Rename fetchUser → getUser throughout this file
 * @reply status:done — 7 instances renamed, type import on line 3 updated.
 */
```

### `ask`

Ask the agent a question.

- `@reply status:done` with a direct answer
- Multi-line is fine; indent continuation lines with `*   `

```js
/* @agent ask
 * Should we memoize this selector?
 * @reply status:done — Yes, inputs are stable. Use useMemo with [userId, filters]
 *   as deps to avoid recalculation on unrelated renders.
 */
```

### `discuss`

Think through a design idea or tradeoff.

- `@reply status:done` with a structured opinion: recommendation first, then tradeoff

```js
/* @agent discuss
 * Split AuthProvider into state-layer + UI-layer?
 * @reply status:done — Worth it. State layer becomes independently testable and the
 *   UI layer stays pure. Extra file is a low cost. One risk: shared context type
 *   needs to live in a third file — plan for that upfront.
 */
```

## Rules

- Only handle the block at the indicated position; do not scan the rest of the file unless asked
- Keep `@reply` concise — this is a code comment, not a chat message
- For `do` blocks, always make the actual code change; `@reply status:done` without the change is wrong
- Preserve indentation and comment style of the surrounding file
