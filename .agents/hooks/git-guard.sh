#!/usr/bin/env bash
# Shared PreToolUse(Bash) guard for Porcelain's autonomous operation.
# Claude Code and Grok Build both load it through .claude/settings.json.
#
#   1. Blocks unmanaged branch/worktree creation -> use `pnpm worktree create`.
#   2. Accepts commits on `main` (solo main-first flow), on managed `work/*`
#      branches, and inside harness-native worktrees; every other branch is
#      unmanaged and blocked.
#   3. Runs the verification gate     -> AGENTS.md rule 3 (before ANY commit) and
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

# AI harnesses (T3 Code, Codex, Grok Build, Claude) cut their own worktrees on
# their own branch names — often a detached HEAD — and can't be redirected into
# our managed lifecycle. Recognize them by location: a linked worktree (`.git`
# is a file, not a directory) below a known harness root.
is_harness_worktree() {
  local top
  top="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$top" ] && [ -f "$top/.git" ] || return 1
  top="$(CDPATH= cd -- "$top" 2>/dev/null && pwd -P)" || return 1
  case "$top" in
    "$HOME"/.t3/worktrees/* | "$HOME"/.codex/worktrees/* | "$HOME"/.grok/worktrees/* | */.claude/worktrees/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Classify the Bash command: prints BLOCK_CREATE, COMMIT, or OK.
decision="$(node -e '
  let s = "";
  process.stdin.on("data", d => s += d).on("end", () => {
    let cmd = "";
    try {
      const event = JSON.parse(s);
      const input = event.tool_input || event.toolInput || {};
      cmd = input.command || "";
    } catch (e) {}
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
          (verb === "branch" && ((rest[0] && !rest[0].startsWith("-")) || rest.some(r => r === "-c" || r === "-C" || r === "--copy"))) ||
          (verb === "worktree" && rest[0] === "add");
        if (isCreate) decision = "BLOCK_CREATE";
        else if (verb === "commit" && decision !== "BLOCK_CREATE") decision = "COMMIT";
        break;
      }
      if (decision === "BLOCK_CREATE") break;
    }
    process.stdout.write(decision);
  });
')"

case "$decision" in
  BLOCK_CREATE)
    echo "Blocked (AGENTS.md rule 8): create isolated task branches with 'pnpm worktree create <slug>'." >&2
    exit 2
    ;;
  COMMIT)
    branch="$(git branch --show-current 2>/dev/null || true)"
    case "$branch" in
      main) ;;
      work/*)
        profile_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
        if ! node -e '
          const fs = require("node:fs");
          const branch = process.argv[1];
          try {
            const c = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
            const ok = c.version === 1 && c.branch === branch &&
              branch === `work/${c.slug}` && Number.isInteger(c.port) &&
              c.port >= 43200 && c.port <= 43999;
            process.exit(ok ? 0 : 1);
          } catch { process.exit(1); }
        ' "$branch" "$profile_root/.porcelain-worktree.json"; then
          echo "Blocked (AGENTS.md rule 8): $branch is missing a valid managed worktree profile." >&2
          exit 2
        fi
        ;;
      *)
        # Harness worktrees commit on any branch (or detached HEAD) — gate unchanged.
        if ! is_harness_worktree; then
          echo "Blocked (AGENTS.md rule 8): unmanaged branch '$branch'; commit on main, 'pnpm worktree create <slug>', or work in a harness worktree." >&2
          exit 2
        fi
        ;;
    esac
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
      echo "Verification gate FAILED — commit blocked (AGENTS.md rule 3: lint · typecheck · test · build)."
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
