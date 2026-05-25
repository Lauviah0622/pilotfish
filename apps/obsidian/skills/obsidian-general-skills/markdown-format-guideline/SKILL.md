---
name: markdown-format-guideline
description: Use this skill when writing or editing Markdown in this repo and the user wants repo-specific formatting consistency. It covers preferred usage of headings, lists, blockquotes, Obsidian callouts, code fences, and lightweight structural conventions for notes, interview prep, and collaborative documents.
---

# Markdown Format Guideline

Use this skill when editing Markdown in this repo.

The goal is not strict style policing. The goal is:

- keep notes easy to scan
- make structure predictable
- preserve author intent
- use special syntax only when it adds meaning

## Core Principle

Prefer the lightest structure that still communicates the document clearly.

- Do not over-format short notes.
- Do not introduce sections, callouts, or tables unless they help navigation.
- Preserve existing local patterns when a file already has a stable structure.

## Headings

Use headings to show document structure, not to decorate.

- Use `#` for the document title when the file behaves like a standalone note.
- Use `##` for major sections.
- Use `###` only when a section genuinely needs subdivision.
- Avoid going deeper unless the file is already highly structured.

## Lists

Use lists when the content is naturally list-shaped.

- Use `-` for unordered lists.
- Keep bullet phrasing parallel when possible.
- Avoid deeply nested lists unless hierarchy is important.
- If nesting starts to get heavy, prefer a new section or a short paragraph.

Use numbered lists when order matters:

1. sequence
2. workflow
3. prioritization



## Blockquotes

In this repo, Most of the file are the personal note. So blockquotes usually mean "outside the main flow".

Use blockquotes for:

- side thoughts
- memo-like remarks
- framing statements
- a voice that intentionally steps outside the main article or note body

Examples:

```md
> 這段是補充想法，不是正文主線。
```

```md
> 面試時這句可以當 opening。
```

Do not use blockquotes for ordinary emphasis that should just be a paragraph or bullet.

But it still depends on the context. Some of the file are the essay draft. the blockquote may the really blockquote use in the essay. In this context, the obsidian callouts in comment type would be used in this senario. See Obsidian Callouts section for more details

## Obsidian Callouts

Use Obsidian callouts only when the note benefits from semantic labeling.

Common patterns in this repo:

- `> [!Comment]`
  - collaborative inline comments between user and agent
- `> [!Question]`
  - unresolved question, prompt, or discussion point
- `> [!Note]`
  - important contextual note worth highlighting
- `> [!Warning]`
  - risk, caveat, or anti-pattern

Guidelines:

- Use callouts more sparingly than normal blockquotes.
- Prefer plain blockquotes for lightweight side thoughts.
- Use callouts when the label itself adds meaning.
- Keep each callout focused on one purpose.

When working with markdown-comment-protocol:

- Preserve existing `> [!Comment] For Agent` blocks.
- Reply with one `> [!Comment] For User` block per response.
- Add replies near the relevant section unless the document suggests otherwise.

## Emphasis

Use emphasis conservatively.

- Use `**bold**` for strong emphasis or key labels.
- Use `_italic_` sparingly for nuance, tone, or foreign terms if useful.
- Avoid stacking bold, italic, and code formatting on the same phrase unless necessary.

## Inline Code and Code Fences

Use inline code for:

- file paths
- commands
- identifiers
- syntax literals

Examples:

- `pnpm build`
- `mock_interview/intro/5_intro_v2.md`
- `> [!Comment] For User`

Use fenced code blocks for:

- command examples
- code snippets
- Markdown examples

Prefer language info strings when useful:

```md
```ts
const x = 1
```
```

## File and Section Openings

Choose the opening based on document type.

### Standalone note

Use:

- title
- short context or goal
- then sections

### Working draft

It is acceptable to begin directly with bullets, partial thoughts, or prompts if the file is clearly a scratchpad.

### Collaborative review file

Prefer:

- current text
- inline comments
- short meta notes only when needed

## Recommended Patterns By Document Type

### Interview prep notes

Prefer:

- short headings
- bullets
- short explanatory paragraphs
- blockquotes for meta reminders or speaking cues

### Mock interview drafts

Prefer:

- the draft itself
- targeted comments near the relevant lines
- limited top-level framing

### Topic summaries

Prefer:

- title
- short thesis or summary
- grouped sections
- examples only when they clarify a decision or distinction

## Things to Avoid

- decorative headings with no structural value
- excessive callouts
- large nested bullet trees when a paragraph is clearer
- mixing too many note modes in one section
  - example: checklist + essay + callout + transcript all interleaved without structure
- reformatting stable files just to make them look cleaner

## Editing Rule

When editing an existing Markdown file in this repo:

1. identify the file's current mode
   - scratchpad, note, draft, review, summary
2. preserve the mode unless there is a strong reason to restructure
3. apply these conventions lightly
4. optimize for readability, not uniformity

## Default Bias

If unsure:

- prefer plain paragraphs over special containers
- prefer bullets over tables
- prefer blockquotes over callouts for lightweight asides
- prefer fewer heading levels
