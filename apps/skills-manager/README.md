# @pilotfish/skills-manager

`skills` — a local-only, agent-agnostic CLI that treats one directory as the single source of truth (SSOT) for your global agent skills and deploys that directory into Claude Code, Codex, Cursor, or any other agent's global skills folder.

The mental model, in three lines:

1. The SSOT is the only place you edit skills.
2. Agent directories are deployment output, never input.
3. `doctor` and `diff` observe the actual filesystem state; `apply` makes it match the SSOT.

## Install

```sh
pnpm install
pnpm run build       # produces ./dist/skills.js with a shebang
# then either link it or invoke it directly
./dist/skills.js --help
```

If you want the `skills` command globally:

```sh
pnpm link --global
```

## Configure (.env)

Create `.env` either in the current working directory or at `~/.config/skills-manager/.env`. Only agents whose variable is set are considered **enabled**.

```dotenv
SKILLS_SOURCE_DIR=~/.skills/skills
CLAUDE_SKILLS_DIR=~/.claude/skills
CODEX_SKILLS_DIR=~/.codex/skills
CURSOR_SKILLS_DIR=~/.cursor/skills
```

- `SKILLS_SOURCE_DIR` is required.
- Any `<NAME>_SKILLS_DIR` registers an agent called `<name>` (lowercased).
- `~` is expanded. Relative paths resolve against the `.env` file's directory.

The CLI never writes to `.env`, never spawns a daemon, and never watches files.

## Commands

### `skills doctor`

Read-only overview. Shows SSOT and agent paths, a deployment matrix, unmanaged (agent-only) skills, diagnostics, and a summary count.

### `skills diff [--skill S] [--agent A] [--summary|--stat]`

Per-target comparison. Default output is unified textual diff; `--summary` compresses to one line per target, `--stat` lists per-file changes without the textual diff.

### `skills apply [--skill S] [--agent A] [--dry-run] [--force]`

Deploys selected SSOT skills to agents.

- `missing` targets are created.
- `synced` targets are skipped.
- `different` targets are **refused** without `--force`; with `--force` they are atomically replaced.
- `unmanaged` agent-only skills are never touched.
- Each `skill × agent` target is independent — a conflict on one target does not block another.
- Deploys are staged into `<target>.staging.<id>`, verified, then renamed into place; failures leave the original target intact.
- After a successful apply, the target is re-scanned to confirm it is `synced`.

## Selectors

`--skill` and `--agent` behave the same way across `diff` and `apply`:

| Selectors            | Scope                                   |
| -------------------- | --------------------------------------- |
| (none)               | all SSOT skills × all enabled agents    |
| `--skill S`          | skill S × all enabled agents            |
| `--agent A`          | all SSOT skills × agent A               |
| `--skill S --agent A`| exactly one target                      |

Unknown skills or disabled agents fail with exit code 2 — never silently ignored.

## Exit codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| 0    | success, no drift                                               |
| 1    | success, found `missing` / `different` targets (or apply conflict) |
| 2    | configuration, argument, I/O error                              |

`unmanaged` skills on their own never trigger exit code 1 — they are informational.

## Skill validity

A skill is a direct subdirectory of a root (SSOT or agent) that:

- has a safe directory name (no path traversal), and
- contains a readable `SKILL.md`.

Invalid source skills cause `diff` and `apply` to fail; `doctor` lists them in diagnostics and keeps scanning.

## Ignore rules

The following paths are always ignored when computing inventory and status:

- `.git/`, `.DS_Store`, `Thumbs.db`

Each skill directory may contain a `.gitignore`; the matcher supports `#` comments, blank lines, trailing `/` (directory-only), leading `/` (anchored), `*`/`**`/`?` globs, and `!` negation.

## Non-goals (MVP)

- No cross-machine sync, no daemons, no watch mode.
- No reverse sync (agent → SSOT). To bring an agent's new skill into maintenance, copy it into the SSOT by hand first.
- No per-skill routing rules in `.env`.
- No deletion of agent-only skills.
- No runtime check that an agent actually loaded a skill — only filesystem state.

## Development

```sh
pnpm run check-types   # tsc --noEmit
pnpm run lint          # biome check
pnpm run lint:fix      # biome check --write (safe fixes)
pnpm run build         # type-check + lint + esbuild bundle
pnpm run watch         # esbuild watch mode
pnpm run test          # build + run node:test suite under tests/
```

Layout:

```
src/
  index.ts             entry point (shebang injected by esbuild banner)
  cli.ts               argument parsing + dispatch + exit codes
  config.ts            .env loading, path resolution, agent discovery
  env.ts               minimal dotenv parser
  inventory.ts         SSOT / agent scan + skill validity checks
  compare.ts           status computation + selector logic
  fsutil.ts            recursive listing, hashing, atomic deploy
  gitignore.ts         minimal gitignore matcher
  format.ts            colored output, tables, unified diff
  commands/
    doctor.ts
    diff.ts
    apply.ts
tests/
  *.test.mjs           node --test suites that spawn dist/skills.js
```
