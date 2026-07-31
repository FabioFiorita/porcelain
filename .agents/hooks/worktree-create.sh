#!/usr/bin/env bash
# Claude Code `WorktreeCreate` adapter → `pnpm worktree create <slug>`.
#
# Registering this hook REPLACES Claude's built-in worktree creation entirely, so
# every Claude worktree lands on `work/<slug>` with an isolated daemon port,
# channel home, user data, and playground — the same managed lifecycle
# `pnpm worktree` owns for every host.
#
# Claude also stops processing `.worktreeinclude` once this hook exists; seeding
# gitignored personal files is `pnpm worktree create`'s job (it reads the same
# file for every harness). Do not duplicate that copy logic here.
#
# Protocol:
#   stdin  — JSON with `name` (suggested worktree slug)
#   stdout — ONLY the absolute path of the created worktree directory
#   exit 0 — created; any other code fails creation and surfaces stderr
# `jq` is not assumed to exist; the payload is parsed with node, like git-guard.sh.
set -euo pipefail

fail() {
  echo "worktree-create ✗ $1" >&2
  exit 1
}

payload="$(cat)"

# Slugify the suggested name into what scripts/worktree.mjs accepts:
# 2–48 chars of lowercase alnum/hyphen, starting with an alphanumeric.
slug="$(
  printf '%s' "$payload" | node -e '
let raw = ""
process.stdin.on("data", (chunk) => { raw += chunk })
process.stdin.on("end", () => {
  let name = ""
  try {
    const value = JSON.parse(raw || "{}")
    if (typeof value?.name === "string") name = value.name
  } catch {}
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 48)
    .replace(/-+$/, "")
  process.stdout.write(slug.length >= 2 ? slug : "")
})
'
)"
[ -n "$slug" ] || slug="task-$(date +%Y%m%d-%H%M%S)"

# The hook may run from anywhere; resolve the primary checkout the way
# scripts/worktree.mjs does — the parent of the shared git common dir.
cd "${CLAUDE_PROJECT_DIR:-${GROK_WORKSPACE_ROOT:-$PWD}}" 2>/dev/null ||
  fail "cannot enter the project directory"
top="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "not inside a git repository"
common="$(git rev-parse --git-common-dir)"
case "$common" in
  /*) ;;
  *) common="$top/$common" ;;
esac
common="$(cd "$common" && pwd -P)" || fail "cannot resolve the shared git directory"
primary="$(cd "$common/.." && pwd -P)" || fail "cannot resolve the primary checkout"

cd "$primary"
parent="$(dirname "$primary")/$(basename "$primary")-worktrees"

# Two sessions can slugify to the same name. `create` refuses an existing branch
# or path, so pick a free `<slug>`, `<slug>-2` … `<slug>-9` BEFORE calling it —
# cheaper and more reliable than parsing which failure came back on stderr.
# Every existence check `pnpm worktree create` itself makes: checkout path,
# branch, and the three managed runtime paths (see managedPaths in worktree.mjs).
taken() {
  if [ -e "$parent/$1" ]; then return 0; fi
  if [ -n "$(git branch --list "work/$1" 2>/dev/null)" ]; then return 0; fi
  if [ -e "$HOME/.porcelain-dev-worktrees/$1" ]; then return 0; fi
  if [ -e "$HOME/.local/share/porcelain-dev-worktrees/$1" ]; then return 0; fi
  if [ -e "$HOME/code/porcelain-playgrounds/$1" ]; then return 0; fi
  return 1
}

# `-N` must still fit the 48-char slug limit scripts/worktree.mjs enforces.
base="${slug:0:46}"
base="${base%%-}"
candidate="$slug"
suffix=2
while taken "$candidate"; do
  if [ "$suffix" -gt 9 ]; then
    fail "no free slug for '$slug' (tried $base-2 through $base-9)"
  fi
  candidate="$base-$suffix"
  suffix=$((suffix + 1))
done
slug="$candidate"

# `pnpm worktree create` is chatty; its output belongs on stderr so stdout stays
# the single path Claude parses.
pnpm worktree create "$slug" >&2 || fail "pnpm worktree create $slug failed"

path="$parent/$slug"
[ -d "$path" ] || fail "expected worktree directory is missing: $path"
cd "$path" && pwd -P
