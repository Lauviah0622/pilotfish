---
name: markdown-file-feedback
description: Use this skill when the user invokes `$markdown-file-feedback <markdown-file>` or otherwise wants feedback on a specific Markdown file. Read the named file, treat it as the primary context, and return feedback through the requested channel. If feedback should be written into the file, the markdown comment protocol is the default convention.
---

# Markdown File Feedback

Use this skill for feedback tasks centered on one Markdown file.

Typical invocation:

```text
$markdown-file-feedback path/to/file.md
```

## Contract

- take one Markdown file as the primary target
- read the file before giving feedback
- keep feedback grounded in that file's content
- use the requested feedback channel
- default to `markdown-comment-protocol` for in-file feedback

## Notes

- prefer file-specific feedback over broad cross-file inference
- preserve the document unless the user explicitly asks for edits
- if the target file is ambiguous, resolve it before proceeding
