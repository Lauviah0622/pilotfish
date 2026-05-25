---
name: collab
description: Handle @claude comment blocks embedded in source files. Invoke with an optional file:line reference (e.g. /collab src/foo.ts:42) to process the nearest block at that position.
---

# Collab Protocol

This skill processes `/* @claude */` comment blocks that the user writes directly in source files. It is the primary channel for inline instructions, questions, and design discussions.

## Block Types

```
/* @claude do
 * <what to change or implement>
 * @status: pending
 */

/* @claude ask
 * <question for Claude>
 * @status: pending
 *
 * @claude user-reply
 */

/* @claude discuss
 * <design idea or tradeoff to think through>
 * @status: pending
 */
```

## Invocation

- `/collab` — handle the block described or quoted in the current message
- `/collab src/components/Foo.tsx:42` — read from that file at that line, find the enclosing or nearest `/* @claude ... */` block, handle only that block

When a `file:line` is given:
1. Read the file starting at the given line
2. Locate the enclosing `/* @claude ... */` block (search up if mid-block, or take the next block below)
3. Handle that single block unless the user explicitly asks to scan further

## How to Respond

**Never delete the user's original block content.** Always reply inside the same block by appending `@reply:` and updating `@status:`.

### `do` block
- Make the requested code changes in the file
- Update `@status: pending` → `@status: done`
- Add a one-line `@reply:` summarising what changed (line numbers help)

```js
/* @claude do
 * Rename fetchUser → getUser throughout this file
 * @reply: Done — 7 instances renamed, type import on line 3 updated.
 * @status: done
 */
```

### `ask` block
- Add a `@reply:` with a direct answer (multi-line is fine, indent continuation lines with `*   `)
- Update `@status: pending` → `@status: replied`

```js
/* @claude ask
 * Should we memoize this selector?
 * @reply: Yes — inputs are stable. Use useMemo with [userId, filters] as deps
 *   to avoid recalculation on unrelated renders.
 * @status: replied
 */
```

### `discuss` block
- Add a `@reply:` with a structured opinion: recommendation first, then tradeoff
- Update `@status: pending` → `@status: replied`

```js
/* @claude discuss
 * Split AuthProvider into state-layer + UI-layer?
 * @reply: Worth it. State layer becomes independently testable and the UI layer
 *   stays pure. Extra file is a low cost. One risk: shared context type needs
 *   to live in a third file — plan for that upfront.
 * @status: replied
 */
```

## Rules

- Only handle the block at the indicated position; do not scan the rest of the file unless asked
- Keep `@reply:` concise — this is a code comment, not a chat message
- For `do` blocks, always make the actual code change; `@status: done` without the change is wrong
- Preserve indentation and comment style of the surrounding file
