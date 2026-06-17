import { homedir } from 'node:os'
import { join } from 'node:path'

// Pure plugin definitions — no electron/fs imports, so this is unit-testable.
// The side-effecting installer (writes files, copies the built server, runs the
// `claude` CLI) lives in plugin.ts.

export const PLUGIN_NAME = 'porcelain'
export const MARKETPLACE_NAME = 'porcelain'
export const REVIEW_SKILL_NAME = 'review-with-porcelain'

/**
 * The plugin's own version — bumped whenever the bundled MCP server or skill gains
 * capabilities (NOT tied to the app version, since the plugin can change between
 * releases). The app records the version installed and offers an "Update" when this
 * constant is newer. Bump on any change to the MCP tools or the review skill.
 * 2.0.0: added review-comment + project-board tools on top of feature review sets.
 * 2.1.0: added saved-action tools (list/create/update/delete_action).
 */
export const PLUGIN_VERSION = '2.1.0'

/**
 * The local Claude Code marketplace root the app writes. Lives in ~/.porcelain
 * (the user's home, NOT a work repo) alongside the agent channel. Copying the
 * built MCP server here makes it a real, runnable file even when the app itself
 * is packaged inside app.asar.
 */
export function pluginMarketplaceDir(): string {
  return join(homedir(), '.porcelain', 'plugin')
}

export function marketplaceManifest(): Record<string, unknown> {
  return {
    name: MARKETPLACE_NAME,
    owner: { name: 'Porcelain' },
    description: 'Porcelain — feature-review companion plugin.',
    plugins: [
      {
        name: PLUGIN_NAME,
        source: `./${PLUGIN_NAME}`,
        description: 'Push feature review sets to the Porcelain app (MCP server + review skill).',
      },
    ],
  }
}

export function pluginManifest(version: string): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    description:
      'Feature-review companion: push review sets to the Porcelain app so a human can review the whole feature in flow order.',
    version,
    author: { name: 'Porcelain' },
    // Inline stdio MCP server; ${CLAUDE_PLUGIN_ROOT} resolves to the installed
    // plugin dir, where the installer copies the bundled server.js.
    mcpServers: {
      porcelain: {
        command: 'node',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder Claude Code expands at runtime, not a JS template
        args: ['${CLAUDE_PLUGIN_ROOT}/server.js'],
      },
    },
  }
}

/**
 * The non-interactive CLI commands that register + install the local plugin.
 * Idempotent across both first-install and upgrade: `add`/`install` do the work
 * on a clean machine and no-op afterwards, while `marketplace update`/`plugin
 * update` re-read the bumped manifest and apply the version bump — without them,
 * a re-run silently stays on the installed version. (Claude still requires a
 * session restart before the refreshed tools load.)
 */
export function installCommands(): string[] {
  return [
    `claude plugin marketplace add ${pluginMarketplaceDir()}`,
    `claude plugin marketplace update ${MARKETPLACE_NAME}`,
    `claude plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
    `claude plugin update ${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
  ]
}

export const REVIEW_SKILL = `---
name: ${REVIEW_SKILL_NAME}
description: Push a feature review set to the Porcelain app so a human can review the WHOLE feature (including server/cross-seam files that aren't in the git diff) in flow order. Use after implementing, or while working on, a multi-file feature — especially one that spans the client/server seam.
---

# Review with Porcelain

Porcelain is a macOS review companion that shows a "feature view": the whole feature in flow order (entry point → data), not just the git diff. You built the feature, so you know its true boundary — hand it over so the human reviews the complete picture instead of only the files that happen to have changed.

## When to use

After you implement a feature, finish a meaningful slice, or are asked to "set up the review" — especially when your change touches only part of a feature that spans many files or the client/server seam (the diff can't show the other half, because it didn't change and the link is a route string, not an import).

## How

Call the \`porcelain\` MCP tools with \`repoPath\` set to the ABSOLUTE path of the repo you're working in (your cwd):

- \`set_feature_review\` — replace the review set: \`{ repoPath, name, files: [...] }\`
- \`add_review_files\` — add files to it incrementally while you work
- \`get_feature_review\` — read back the current set (name, files, sources, notes); use it to verify what you pushed or to make an idempotent update (read → modify → \`set\`), and to recover the set if you lose context
- \`clear_feature_review\` — remove it

Each file is \`{ path, source?, note? }\`:
- \`path\` — repo-relative.
- \`source\` — OMIT for files you changed (Porcelain detects those from git). Use \`"shipped"\` for files already landed that the change depends on (the server route/controller/service, an existing endpoint), and \`"context"\` for unchanged files needed to follow the flow (shared types, constants).
- \`note\` — the cross-file invariant a reviewer must check, e.g. "labels here must match CALLOUT_TEMPLATES in the service" or "this mutation must invalidate the listX query".

## What to include

The COMPLETE feature, not just your diff:
- The files you changed (no \`source\` needed).
- The cross-seam files the diff can't show — the server route/controller/service a client change calls (\`shipped\`), and shared types or constants both sides depend on (\`context\`).
- A \`note\` on every file where there's an invariant, contract, or gotcha the reviewer would otherwise miss.

Keep it tight: the files that make up THIS feature, broad enough that the human can read it as one story from entry point to data.

## Reviewer comments

The human also leaves comments in Porcelain — anchored to specific lines (or a whole file) — as concrete review context for you. Check them:

- \`get_review_comments\` — \`{ repoPath }\` → the OPEN comments, each with its file/line anchor, the snippet it was attached to, the note, and an id. Read these before and during the work: they tell you exactly what to explain, fix, or look at.
- \`resolve_review_comment\` — \`{ repoPath, id }\` → mark one resolved once you've ACTUALLY addressed the note; it then drops off the reviewer's open list.

When the human says "look at my comments", "I left some notes", or asks about a specific line/diff, call \`get_review_comments\` first.

## Project board

The repo has a todo/doing/done board of cards (features/tasks). Read it to know what to build and keep it in sync as you work — it's how the human queues work without spelling everything out in chat:

- \`list_cards\` — \`{ repoPath }\` → the board grouped by column, each card with an id, title, and body. Check it to pick up queued work.
- \`create_card\` — \`{ repoPath, title, body?, status? }\` → capture a task (defaults to the "todo" column).
- \`update_card\` — \`{ repoPath, id, title?, body? }\` → edit a card.
- \`move_card\` — \`{ repoPath, id, status }\` → move a card to "doing" when you start it and "done" when you finish, so the human sees progress.
- \`delete_card\` — \`{ repoPath, id }\`.

## Saved actions

The repo has saved "actions" — named shell commands the human runs in Porcelain's embedded terminal with one click (dev server, storybook, test watcher, …). Curate them so the project's common commands are one click away for the human:

- \`list_actions\` — \`{ repoPath }\` → the saved actions, each with an id, title, command, and optional cwd.
- \`create_action\` — \`{ repoPath, title, command, cwd? }\` → add one (e.g. title "Storybook", command "pnpm --filter web storybook").
- \`update_action\` — \`{ repoPath, id, title?, command?, cwd? }\` → edit one (empty-string cwd clears it).
- \`delete_action\` — \`{ repoPath, id }\`.

You DEFINE actions; only the human runs them (there is no run tool). When you discover the project's common commands (from package.json scripts, the README, or what the human asks you to run repeatedly), offer to save them as actions.
`
