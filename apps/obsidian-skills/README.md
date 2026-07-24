# agents

This folder is the agent layer for this vault.

It is not meant to be a standalone app or a general utilities directory. Its purpose is to hold reusable agent-facing infrastructure that can be shared across different note domains.

## Positioning

`agents/` exists to separate agent infrastructure from domain content.

In practice, that means:

- domain knowledge and working notes should stay in their own topic folders
- reusable agent conventions, capabilities, and scaffolding should live under `agents/`
- domain folders may reference or mount what they need from `agents/`, but should not become the source of truth for shared agent logic

This keeps the vault structure cleaner and makes agent-related conventions easier to evolve without scattering them across unrelated note areas.

## Domain Boundaries

### `skills/`

`skills/` is the home for reusable agent capabilities.

Anything placed here should be:

- cross-domain
- reusable in more than one topic area
- expressed as an agent-facing convention, workflow, or capability
- the communication contract between agent and user
- the reusable skill for obsidian

Anything that is tightly coupled to one project, one note tree, or one temporary task should stay outside this folder unless it is later generalized.

### `scripts/`

`scripts/` is the home for supporting tooling around the agent layer.

Anything placed here should help maintain, attach, scaffold, or operate the shared agent structure. It should support the system around `skills/`, rather than become a dumping ground for unrelated personal scripts.

## What Belongs Here

Good candidates for `agents/`:

- reusable agent skills
- shared collaboration conventions
- scaffolding for agent-enabled folders
- maintenance tooling for the shared agent layer
- documentation about structure, boundaries, and extension rules

Poor candidates for `agents/`:

- topic-specific notes
- project-specific logic that has not been generalized, you should put the content in the `.agents` under specific domain folder
- one-off experiments with no reuse value
- generic scripts unrelated to the agent workflow

## Extension Guidance

When adding something new, the main question is not whether an agent uses it, but whether multiple domains should share it.

Use this rule of thumb:

- if it defines shared agent behavior, put it in `agents/`
- if it belongs to one domain only, keep it in that domain
- if it starts domain-specific but becomes reusable, move or extract it into `agents/`

This folder should stay small, opinionated, and reusable. Its value comes from being a stable shared layer, not from holding every artifact related to AI or automation.
