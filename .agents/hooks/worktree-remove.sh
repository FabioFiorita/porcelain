#!/usr/bin/env bash
# Claude Code `WorktreeRemove` adapter → `pnpm worktree remove <slug>`.
#
# Protocol:
#   stdin  — JSON with `worktree_path` (absolute path to the worktree)
#   exit 0 — removed; any other code leaves the worktree in place and shows stderr
# `jq` is not assumed to exist; the payload is parsed with node, like git-guard.sh.
#
# Managed checkouts go through `pnpm worktree remove --force`, which also stops
# the isolated dev daemon and deletes the branch, channels, user data, and
# playground. `--force` is deliberate: Claude only fires this event after the
# human explicitly chose to delete the worktree at session exit, and that choice
# already means "throw the work away" — an unmerged or dirty branch must not turn
# an accepted deletion into a hook failure. Unmanaged checkouts fall back to
# plain `git worktree remove`.
set -euo pipefail

fail() {
  echo "worktree-remove ✗ $1" >&2
  exit 1
}

payload="$(cat)"

read_json() {
  printf '%s' "$1" | node -e '
const [field] = process.argv.slice(1)
let raw = ""
process.stdin.on("data", (chunk) => { raw += chunk })
process.stdin.on("end", () => {
  let value = ""
  try {
    const parsed = JSON.parse(raw || "{}")
    if (typeof parsed?.[field] === "string") value = parsed[field]
  } catch {}
  process.stdout.write(value)
})
' "$2"
}

target="$(read_json "$payload" worktree_path)"
[ -n "$target" ] || fail "hook payload had no worktree_path"
[ -d "$target" ] || fail "worktree_path is not a directory: $target"

top="$(git -C "$target" rev-parse --show-toplevel)" || fail "not a git worktree: $target"
common="$(git -C "$target" rev-parse --git-common-dir)"
case "$common" in
  /*) ;;
  *) common="$top/$common" ;;
esac
common="$(cd "$common" && pwd -P)" || fail "cannot resolve the shared git directory"
primary="$(cd "$common/.." && pwd -P)" || fail "cannot resolve the primary checkout"

# Git refuses to remove a worktree from inside it, so every removal runs from the
# primary checkout.
cd "$primary"

config="$target/.porcelain-worktree.json"
if [ ! -f "$config" ]; then
  echo "worktree-remove · $target is not a managed worktree; using git worktree remove" >&2
  git worktree remove --force "$target" >&2 || fail "git worktree remove failed for $target"
  exit 0
fi

slug="$(node -e '
const [file] = process.argv.slice(1)
const { readFileSync } = require("node:fs")
let value = ""
try {
  const parsed = JSON.parse(readFileSync(file, "utf8"))
  if (typeof parsed?.slug === "string") value = parsed.slug
} catch {}
process.stdout.write(value)
' "$config")"
[ -n "$slug" ] || fail "$config has no slug"

pnpm worktree remove "$slug" --force >&2 || fail "pnpm worktree remove $slug failed"
