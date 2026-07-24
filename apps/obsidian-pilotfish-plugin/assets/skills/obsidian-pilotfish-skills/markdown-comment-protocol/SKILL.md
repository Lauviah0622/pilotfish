---
name: markdown-comment-protocol
description: Use this skill when working in Markdown documents where the user and agent communicate through callout comment blocks. This skill defines a protocol for reading `> [!Comment] For Agent` as user instructions to the agent, and writing `> [!Comment] For User` blocks as inline agent responses, updates, questions, or handoff notes inside the same Markdown file.
---

# Markdown Comment Protocol

Use this skill when the task involves collaborating with the user directly inside a Markdown file.

The protocol has two block types:

```md
> [!Comment] For Agent
> User message to the agent.
```

```md
> [!Comment] For User
> Agent message to the user.
```

## Rules

1. Treat every `> [!Comment] For Agent` block as an instruction, constraint, question, or note from the user.
2. When replying inside the document, use `> [!Comment] For User` exactly. But Keep one reply into one `> [!Comment] For User` block
3. Preserve existing document content. Add responses near the relevant section or directly after the triggering comment unless the file structure suggests a better location. Mostly after the last continuous comment block.
4. Keep inline agent comments concise and action-oriented.
5. Do not rewrite the user's `For Agent` comments unless explicitly asked to edit them.
6. If multiple `For Agent` comments conflict, follow the most recent one in document order unless another instruction clearly has higher priority.
7. If a request in the document is ambiguous or blocked, reply in the file with a `For User` comment that states the blocker and the next decision needed.

## Writing Style For Agent Replies

- State decisions, blockers, assumptions, or completion notes directly.
- Prefer short paragraphs over long explanations.
- If listing action items, keep them flat and brief.
- Mirror the document language when practical.

## Recommended Workflow

1. Scan the Markdown file for `For Agent` blocks before editing substantive content.
2. Execute the requested work in the file or related files.
3. If needed, leave a `For User` block to confirm what changed, ask for a decision, or note unresolved risk.
4. Cuz the position of the For Agent block would change, so make sure you put the reply block at the right place after the generated content should be write into file

## Examples

User to agent:

```md
> [!Comment] For Agent
> Please tighten this section and add one example about API retries.
```

Agent reply:

```md
> [!Comment] For User
> Revised this section for brevity and added one retry example below.
```

Blocked case:

```md
> [!Comment] For User
> The requested example depends on whether this flow should use REST or GraphQL. Confirm the target API style and I will add the example in place.
```
