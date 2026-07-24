#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1-}" ]; then
  echo "Usage: $0 <target-path>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GENERAL_SKILLS_PATH="$ROOT/agents/skills"
TARGET="$1"

mkdir -p "$TARGET/.agents/skills"

ln -sfn "$GENERAL_SKILLS_PATH/obsidian-general-skills" "$TARGET/.agents/skills/obsidian-general-skills"

echo "Created agentic scaffold at $TARGET"
