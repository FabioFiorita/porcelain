#!/usr/bin/env bash
# PreToolUse(Bash) guard for Porcelain's autonomous operation.
#
#   1. Blocks branch creation        -> CLAUDE.md rule 8 (commit straight to main).
#   2. Runs the verification gate     -> CLAUDE.md rule 3 (before ANY commit) and
#      blocks the commit on failure, feeding the failing output back to the agent
#      so it can fix and retry without a human in the loop.
#
# Exit 2 blocks the tool call; everything on stderr is shown to the agent.
# This is the deterministic backstop the advisory CLAUDE.md rules can't be.

set -u
# Hooks run without the interactive shell's PATH; make pnpm/node resolvable.
export PATH="$HOME/Library/pnpm:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Pull the Bash command out of the hook's JSON stdin. node is always present
# (this is a Node project), so we don't depend on jq being installed.
cmd="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(((JSON.parse(s).tool_input)||{}).command||"")}catch(e){process.stdout.write("")}})')"

# --- Rule 8: never create branches ------------------------------------------
if printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+(checkout[[:space:]]+-[bB]|switch[[:space:]]+(-[cC]|--create)|branch[[:space:]]+[^-[:space:]])'; then
  echo "Blocked (CLAUDE.md rule 8): never create branches — commit straight to main." >&2
  exit 2
fi

# --- Rule 3: verification gate before any commit ----------------------------
if printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+commit([[:space:]]|$)'; then
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "git-guard: pnpm not on PATH; skipping the gate (fail-open). Run 'pnpm verify' manually." >&2
    exit 0
  fi
  out="$(mktemp)"
  if pnpm verify >"$out" 2>&1; then
    rm -f "$out"
    exit 0
  fi
  {
    echo "Verification gate FAILED — commit blocked (CLAUDE.md rule 3: lint · typecheck · test · build)."
    echo "Fix the failures, then retry the commit. For lint/format issues run: pnpm lint:fix"
    echo "----- last 40 lines of 'pnpm verify' -----"
    tail -n 40 "$out"
  } >&2
  rm -f "$out"
  exit 2
fi

exit 0
