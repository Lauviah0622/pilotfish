# Skills Manager fixtures

Each directory under `roots/` is one skill root. Tests should copy the chosen
root into a temporary SSOT directory, then run the CLI against that temporary
directory. Tests must not fetch upstream repositories at runtime.

| Root | Purpose | Provenance |
| --- | --- | --- |
| `simple-skill` | A minimal root with a top-level `SKILL.md` | Created for this test suite |
| `react-best-practices` | A single skill with companion files and nested rules | Unmodified tracked files from `skills/react-best-practices/` in `vercel-labs/agent-skills` commit `063bee94c3f4df8453406c830b0a7df0f2860278` ([source](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-best-practices)); the upstream `SKILL.md` declares `license: MIT` |
| `obsidian-skills` | A root without a top-level `SKILL.md`, containing multiple nested skills | Unmodified tracked files from `kepano/obsidian-skills` commit `3ccff5338ea700537839b21900aa5358a0402c98` ([source](https://github.com/kepano/obsidian-skills/tree/3ccff5338ea700537839b21900aa5358a0402c98)); upstream MIT license is included in that root |

The Vercel repository did not include a standalone license file at the pinned
commit; the skill's `SKILL.md` declares `license: MIT`. The Obsidian fixture
preserves its repository root, including `.claude-plugin/`, `README.md`,
`LICENSE`, and `skills/`. Git metadata is omitted from both snapshots.
