#!/usr/bin/env bash
# PreToolUse(Bash) guard for Porcelain's autonomous operation.
#
#   1. Blocks branch creation        -> CLAUDE.md rule 8 (commit straight to main).
#   2. Runs the verification gate     -> CLAUDE.md rule 3 (before ANY commit) and
#      blocks the commit on failure, feeding the failing output back to the agent
#      so it can fix and retry without a human in the loop.
#
# Exit 2 blocks the tool call; everything on stderr is shown to the agent.
# This is the deterministic backstop the advisory CLAUDE.md rules can't be, so it
# fails CLOSED: if it can't run the gate, it refuses the commit rather than waving
# it through. Command classification is done in node (always present) so it walks
# past git's global flags (git -C <path> commit, git --no-pager commit, ...) that
# a naive `git <verb>` regex would miss.

set -u
# Hooks run without the interactive shell's PATH; make pnpm/node resolvable.
export PATH="$HOME/Library/pnpm:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Classify the Bash command: prints BLOCK_BRANCH, GATE, or OK.
decision="$(node -e '
  let s = "";
  process.stdin.on("data", d => s += d).on("end", () => {
    let cmd = "";
    try { cmd = ((JSON.parse(s).tool_input) || {}).command || ""; } catch (e) {}
    const segments = cmd.split(/&&|\|\||;|\n|\|/);
    const VALUE_FLAGS = new Set(["-C","-c","--git-dir","--work-tree","--namespace","--exec-path","--super-prefix"]);
    let decision = "OK";
    for (const seg of segments) {
      const toks = seg.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < toks.length; i++) {
        if (toks[i] !== "git" && !toks[i].endsWith("/git")) continue;
        let j = i + 1;
        while (j < toks.length && toks[j].startsWith("-")) {
          const flag = toks[j];
          j++;
          if (VALUE_FLAGS.has(flag) && j < toks.length && !toks[j].startsWith("-")) j++;
        }
        if (j >= toks.length) break;
        const verb = toks[j];
        const rest = toks.slice(j + 1);
        const isCreate =
          (verb === "checkout" && rest.some(r => r === "-b" || r === "-B")) ||
          (verb === "switch" && rest.some(r => r === "-c" || r === "-C" || r === "--create")) ||
          (verb === "branch" && ((rest[0] && !rest[0].startsWith("-")) || rest.some(r => r === "-c" || r === "-C" || r === "--copy")));
        if (isCreate) decision = "BLOCK_BRANCH";
        else if (verb === "commit" && decision !== "BLOCK_BRANCH") decision = "GATE";
        break;
      }
      if (decision === "BLOCK_BRANCH") break;
    }
    process.stdout.write(decision);
  });
')"

case "$decision" in
  BLOCK_BRANCH)
    echo "Blocked (CLAUDE.md rule 8): never create branches — commit straight to main." >&2
    exit 2
    ;;
  GATE)
    if ! command -v pnpm >/dev/null 2>&1; then
      echo "git-guard: pnpm not found on PATH — REFUSING the commit (the rule-3 gate can't run)." >&2
      echo "Fix PATH / install pnpm, or commit from an environment where 'pnpm verify' works." >&2
      exit 2
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
    ;;
  *)
    exit 0
    ;;
esac
