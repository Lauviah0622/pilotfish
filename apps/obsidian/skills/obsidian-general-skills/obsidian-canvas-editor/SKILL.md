---
name: obsidian-canvas-editor
description: Use this skill when working with Obsidian `.canvas` files and the user wants the agent to inspect, add, remove, replace, reposition, or relink canvas nodes and edges by editing the JSON directly.
---

# Obsidian Canvas Editor

Use this skill when the task is to modify an Obsidian `.canvas` file directly.

`.canvas` files are JSON documents with this top-level shape:

```json
{
  "nodes": [],
  "edges": []
}
```

## Core Model

Each node is an object in `nodes`. Common node types:

- `text`: requires `text`
- `file`: requires `file`
- `link`: requires `url`
- `group`: visual grouping area

All nodes should have:

- `id`
- `type`
- `x`
- `y`
- `width`
- `height`

Each edge is an object in `edges` and should have:

- `id`
- `fromNode`
- `toNode`

Common optional edge fields:

- `fromSide`
- `toSide`
- `fromEnd`
- `toEnd`
- `label`
- `color`

## Editing Rules

1. Parse the `.canvas` file as JSON before editing.
2. Preserve valid JSON syntax.
3. Keep every node `id` unique within the file.
4. Keep every edge `id` unique within the file.
5. Ensure every `fromNode` and `toNode` refers to an existing node `id`.
6. When removing a node, also remove all edges that reference it.
7. When replacing a node, preserve or intentionally update its connected edges.
8. Match the existing file's style when possible:
   - preserve indentation and field ordering where practical
   - reuse the existing path style for `file` nodes unless the user asks to normalize it
9. Prefer 16-character lowercase hex strings for new `id` values to match common Obsidian-style IDs.
10. If the request changes layout, place new nodes with consistent spacing rather than overlapping existing nodes.

## Common Operations

### Add a node

1. Inspect existing nodes and choose a non-overlapping position.
2. Generate a new unique node `id`.
3. Append the new node to `nodes`.
4. If requested, create one or more edges linking it to existing nodes.

Example file node:

```json
{
  "id": "8077f30f970a9e85",
  "x": 120,
  "y": -120,
  "width": 400,
  "height": 400,
  "type": "file",
  "file": "path/to/file.md"
}
```

#### File node

1. The path of file node should be the absolute path start from the vault root

### Remove a node

1. Find the node by `id`, `text`, `file`, or another user-provided selector.
2. Remove the node from `nodes`.
3. Remove every edge whose `fromNode` or `toNode` points to that node.

### Replace a node

Use "replace" to mean one of two things:

- update fields on the existing node while keeping the same `id`
- remove one node and insert a new node in its place

Default to updating the existing node in place when possible. This preserves edge references and is safer.

Examples:

- replace a `text` node's `text`
- replace a `file` node's `file` path
- replace a node's position and size
- replace one connection target by updating related edges

### Relink nodes

1. Find the relevant source and target nodes.
2. Add, remove, or edit edges in `edges`.
3. Keep edge directions and side anchors intentional.

## Recommended Workflow

1. Read the full `.canvas` file.
2. Summarize the current structure if the request is broad or ambiguous.
3. Identify the target nodes and edges before editing.
4. Apply the smallest safe JSON change that satisfies the request.
5. Re-read the file after editing to confirm:
   - JSON is intact
   - referenced IDs exist
   - removed nodes do not leave dangling edges

## Heuristics

- Use `text` nodes for section labels or instructions.
- Use `file` nodes for vault content such as `.md` files.
- Keep related nodes aligned in rows or columns when adding several items.
- If one label node connects to many file nodes, fan them out with readable spacing.
- If the user asks for bulk operations, apply a consistent placement pattern.

## Example Requests This Skill Should Handle

- Add all Markdown files in a folder as `file` nodes.
- Remove a canvas node and all of its connections.
- Replace one file node with another while preserving links.
- Add a text heading and connect it to a set of notes.
- Reposition nodes into a cleaner layout.
