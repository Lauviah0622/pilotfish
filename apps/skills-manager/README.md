# @pilotfish/skills-manager

`skills` — a local-only CLI that uses a configured source directory (SSOT) for your global agent skill roots by default and deploys each root into an agent's skills folder. One-command path overrides can use repository-local directories.

The mental model, in three lines:

1. The selected source is the place you edit skills.
2. Agent directories are deployment output, never input.
3. `doctor` and `diff` observe the actual filesystem state; `apply` makes targets match the selected source.

Each direct child of the SSOT is a **skill root**. A root can contain one skill at its top level or several skills deeper in its tree. A directory containing `SKILL.md` is a skill; the complete root is the unit that `diff` compares and `apply` copies.

```text
<SSOT>/
├── review/SKILL.md
└── obsidian/
    ├── README.md
    └── skills/
        ├── markdown/SKILL.md
        └── canvas/SKILL.md

<CODEX_SKILLS_DIR>/
├── review/SKILL.md
└── obsidian/
    ├── README.md
    └── skills/
        ├── markdown/SKILL.md
        └── canvas/SKILL.md
```

The manager preserves each root's paths. Its filesystem checks do not establish whether a particular agent discovers nested skills at runtime.

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

CODEX_SCAN_EXCLUDE_PATTERNS='[".system/"]'
CODEX_WRITE_DENY_PATTERNS='[".system/"]'
CLAUDE_SCAN_EXCLUDE_PATTERNS='[".trash/", "synced/"]'
CLAUDE_WRITE_DENY_PATTERNS='[".trash/", "synced/"]'
```

- `SKILLS_SOURCE_DIR` is required unless that invocation supplies `--source`.
- Supported agents and their environment keys are defined in `src/agents.ts`:

| Agent | Skills directory | Scan exclusions | Write denials |
| --- | --- | --- | --- |
| `claude` | `CLAUDE_SKILLS_DIR` | `CLAUDE_SCAN_EXCLUDE_PATTERNS` | `CLAUDE_WRITE_DENY_PATTERNS` |
| `codex` | `CODEX_SKILLS_DIR` | `CODEX_SCAN_EXCLUDE_PATTERNS` | `CODEX_WRITE_DENY_PATTERNS` |
| `cursor` | `CURSOR_SKILLS_DIR` | `CURSOR_SCAN_EXCLUDE_PATTERNS` | `CURSOR_WRITE_DENY_PATTERNS` |

- A registered agent is enabled only when its skills directory variable is nonempty.
- Unknown variables such as `CUSTOM_SKILLS_DIR` are ignored; they no longer register agents.
- To add an agent, add an `AgentDefinition` entry in `src/agents.ts` with a unique ID and
  explicit environment keys, then rebuild. Commands share the resulting configuration.
- `~` is expanded. Relative paths resolve against the `.env` file's directory.

### One-command path overrides

`--source <dir>` selects a different directory of skill roots for this invocation. `--target <dir>` selects one destination skills directory instead of all enabled agents. Both paths may be absolute or relative to the current working directory; they do not change `.env`. A source or target is the **parent directory of skill roots**, not an individual skill root.

| Command | `--source` | `--target` |
| --- | --- | --- |
| `doctor` | Show the selected source as `Source`; keep the enabled-agent overview | Not accepted |
| `diff`, `apply` | Compare/deploy from the selected source to enabled agents | Compare/deploy to this directory only; source defaults to SSOT |
| `import` | Import into the selected source | Not accepted |

With both flags, `diff` and `apply` use the specified source and target without requiring any configured agent. For example, from a repository root:

```sh
skills diff --source ./repo-skills --target ./.agents/skills
skills apply --source ./repo-skills --target ./.agents/skills --dry-run
skills apply --source ./repo-skills --target ./.agents/skills
```

`apply --source ./repo-skills` alone still deploys to every enabled agent, including global directories. A direct `--target` cannot be combined with `--agent`; its output shows the resolved target path. If the target matches a configured agent directory, that agent's scan exclusions and write denials still apply. `diff` and `apply` reject source and target directories that are equal or nested within one another, including paths through existing symlinks. Existing `--force` conflict handling still applies. Relative `.env` paths continue to resolve against the `.env` file's directory.

The CLI never writes to `.env`, never spawns a daemon, and never watches files.

## Agent path rules

Each enabled agent accepts the scan exclusion and write denial variables listed above.
Values are JSON arrays of strings; unset, blank, or `[]` means no rules. Shell environment
values take precedence over `.env`. Rules for one agent do not affect other agents or SSOT.

Patterns use the existing `ignore` package's gitignore wildcards (`*`, `**`, `?`, character
classes), anchored to the agent skills root. Use `/` as the separator. For example,
`.system/` matches that directory and all descendants; `review/cache/` excludes a nested
directory, and `native-*` matches root entries. Absolute paths, traversal, negation, comments,
and backslashes are rejected. Quote the JSON with single quotes in `.env` as shown above.

- **Scan exclude** prunes inventory traversal before hashing. Excluded root entries do not
  appear as skill roots, unmanaged entries, or missing-`SKILL.md` diagnostics. Nested excluded
  files are omitted from both sides of the comparison. This does not grant or deny writes.
- **Write deny** produces a `blocked` target in doctor, diff, and the deployment plan. Apply
  refuses it, including with `--force` or `--dry-run`; other targets continue. Exit code is 1.
  Because deployment atomically replaces a whole skill root, a rule protecting a
  descendant also blocks its parent root, even if that descendant does not exist yet.
  Consequently `*/private/` blocks every skill root; use more specific rules if needed.

`doctor` lists both sets of effective rules. Inventory exclusions do not hide an existing
write target from collision checks: apply inspects the selected target directly for planning
and post-write verification. With scan-only exclusions, apply may therefore report a conflict
that doctor/diff omit; `--force` is still required to replace different content.

The example rules are explicit local configuration, not automatic detection of built-in
skills. `.env.example` provides a versioned template; the local `.env` is ignored by Git.

## Commands

### `skills doctor`

Read-only overview. Shows the source and agent paths, a deployment matrix, unmanaged (agent-only) skills, effective path rules, diagnostics, and a summary count. `--source` labels the selected source `Source` in output.

### `skills diff [--root R] [--agent A] [--summary|--stat|--verbose]`

Per-target comparison. Default output shows each root, its status, and file change counts on one line. `--summary` keeps this output for compatibility, `--stat` lists changed files, and `--verbose` shows the full textual diff. These output options cannot be combined.

### `skills apply [--root R] [--agent A] [--dry-run] [--force]`

Deploys selected source skill roots to agents or the specified `--target`, preserving all paths below each root.

- `missing` targets are created.
- `synced` targets are skipped.
- `different` targets are **refused** without `--force`; with `--force` they are atomically replaced.
- `unmanaged` agent-only roots are never touched.
- `blocked` targets are refused regardless of `--force`.
- Each `skill root × agent` target is independent — a conflict on one target does not block another.
- Deploys are staged into `<target>.staging.<id>`, verified, then renamed into place; failures leave the original target intact.
- After a successful apply, the target is re-scanned to confirm it is `synced`.

### `skills import <archive-url> [--subdir P] [--as R] [--force]`

Imports a zip or tar.gz archive into one source skill root. The chosen archive directory must contain at least one `SKILL.md` anywhere in its tree. `--subdir` selects a smaller root within the archive; `--as` names the source root. Import does not deploy it until `skills apply` runs.

## Selectors

`--root` and `--agent` behave the same way across `diff` and `apply`. `--skill` remains an alias for `--root` for existing commands; it selects a root, not one nested skill.

| Selectors            | Scope                                   |
| -------------------- | --------------------------------------- |
| (none)               | all SSOT roots × all enabled agents     |
| `--root R`           | root R × all enabled agents             |
| `--agent A`          | all SSOT roots × agent A                |
| `--root R --agent A` | exactly one target                      |

Unknown roots or disabled agents fail with exit code 2 — never silently ignored.

## Exit codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| 0    | success, no drift                                               |
| 1    | success, found `missing` / `different` / `blocked` targets (or apply conflict) |
| 2    | configuration, argument, I/O error                              |

`unmanaged` roots on their own never trigger exit code 1 — they are informational.

## Skill validity

A skill root is a direct subdirectory of the SSOT or agent directory that:

- has a safe directory name (no path traversal), and
- contains at least one readable `SKILL.md` at any depth.

Each directory containing `SKILL.md` is listed as a skill within its root. Invalid source roots cause `diff` and `apply` to fail; `doctor` lists them in diagnostics and keeps scanning.

## Ignore rules

The following paths are always ignored when computing inventory and status:

- `.git/`, `.DS_Store`, `Thumbs.db`

The SSOT and agent directory may each contain a `.gitignore` to exclude direct child roots. Each skill root may also contain a `.gitignore` for its own files. The matcher supports `#` comments, blank lines, trailing `/` (directory-only), leading `/` (anchored), `*`/`**`/`?` globs, and `!` negation. `.git/`, `.DS_Store`, and `Thumbs.db` are always ignored when scanning.

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
