---
name: collab
description: Handle @agent action blocks embedded in source-code comments. Invoke with an optional file:line reference (for example, $collab src/foo.ts:42) to process the block at that position.
---

# Editor Collaboration Protocol

Use this skill for inline collaboration in non-Markdown source files. Keep the
conversation inside the source language's native comment syntax.

## Canonical Markers

- User to agent: `@agent:action:{action}`
- Agent to user: `@agent:reply:{status}`
- Actions: `do`, `ask`, `discuss`
- Reply statuses: `pending`, `done`

The marker is language-independent. Only the surrounding comment syntax changes.

```ts
/* @agent:action:do
 * Rename fetchUser to getUser.
 * @agent:reply:done — Renamed 7 references.
 */
```

```py
# @agent:action:ask
# Should this result be cached?
# @agent:reply:done — Yes. Cache it by user ID and invalidate it on updates.
```

```html
<!-- @agent:action:discuss
  Should this component own the dialog state?
  @agent:reply:done — Prefer local ownership; no sibling currently needs it.
-->
```

Never delete or rewrite the user's action marker or request. Append the reply in
the same comment block, preserving the file's indentation and comment style.

## Invocation

- `$collab` handles the block described or quoted in the current request.
- `$collab src/components/Foo.tsx:42` reads that file and handles one block at
  that position.

When a `file:line` is given:

1. Locate the comment containing that line.
2. If the line is not inside a collaboration block, use the next block below
   whose opening marker matches `@agent:action:{action}`.
3. Handle only that block unless the user explicitly asks to scan further.

Support the source language's normal block or consecutive line comments, such
as `/* ... */`, `<!-- ... -->`, `# ...`, and `// ...`.

## Reply Lifecycle

When useful for work that will take time, append `@agent:reply:pending` before
starting. Replace that marker with the final reply; do not keep both markers.

```ts
/* @agent:action:do
 * Rename fetchUser to getUser.
 * @agent:reply:pending
 */
```

Every completed action uses `@agent:reply:done`, including `ask` and `discuss`.
Write the response after an em dash on the same line when it is short. Continue
on following comment lines when more detail is needed.

## Actions

### `do`

Make the requested change, verify it in proportion to its risk, and then append
a concise summary. Never mark the reply `done` before the change is complete.

```ts
/* @agent:action:do
 * Rename fetchUser to getUser.
 * @agent:reply:done — Renamed 7 references and updated the type import.
 */
```

### `ask`

Append a direct answer.

```ts
/* @agent:action:ask
 * Should we memoize this selector?
 * @agent:reply:done — Yes. Its inputs are stable; use userId and filters as deps.
 */
```

### `discuss`

Append a recommendation first, followed by the important tradeoff.

```ts
/* @agent:action:discuss
 * Split AuthProvider into state and UI layers?
 * @agent:reply:done — Yes. It improves testability, at the cost of one shared
 *   context-types module.
 */
```

## Rules

- Recognize only the canonical markers above; do not introduce `@agent do`,
  `@reply:`, `@reply status:...`, or a separate `@status:` field.
- Keep replies concise because they remain in source code.
- Preserve indentation and the surrounding comment style.
- For `do`, make the actual code change before writing a completed reply.
- If the requested work cannot be completed, leave the reply `pending` and state
  the blocker after the marker.
