import { homedir } from 'node:os'
import { join } from 'node:path'

// Pure plugin definitions — no electron/fs imports, so this is unit-testable.
// The side-effecting installer (writes files, copies the built server, runs the
// `claude` CLI) lives in plugin.ts.

export const PLUGIN_NAME = 'porcelain'
export const MARKETPLACE_NAME = 'porcelain'
export const REVIEW_SKILL_NAME = 'review-with-porcelain'
export const BOARD_SKILL_NAME = 'project-board'
export const ACTIONS_SKILL_NAME = 'saved-actions'
export const NOTES_SKILL_NAME = 'repo-notes'

/**
 * The plugin's own version — bumped whenever the bundled MCP server or any skill
 * gains capabilities (NOT tied to the app version, since the plugin can change
 * between releases). The app records the version installed and offers an "Update"
 * when this constant is newer. Bump on any change to the MCP tools or a bundled skill.
 * 2.0.0: added review-comment + project-board tools on top of feature review sets.
 * 2.1.0: added saved-action tools (list/create/update/delete_action).
 * 2.2.0: split the one review skill into focused skills (review-with-porcelain,
 *        project-board, saved-actions) so the board/comment/action tools are
 *        discoverable on their own triggers — no new tools.
 * 2.3.0: added the repo-notes channel — get_repo_notes reads the human's per-repo
 *        notes scratchpad (read-only, app→agent) — plus a focused repo-notes skill.
 */
export const PLUGIN_VERSION = '2.3.0'

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
    description: 'Porcelain — agent companion plugin.',
    plugins: [
      {
        name: PLUGIN_NAME,
        source: `./${PLUGIN_NAME}`,
        description:
          'MCP server + skills to push feature review sets, read review comments and project notes, and manage the project board and saved actions in the Porcelain app.',
      },
    ],
  }
}

export function pluginManifest(version: string): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    description:
      "Porcelain companion: push feature review sets so a human reviews the whole feature in flow order, read/resolve review comments, read the human's project notes, and manage the project board and saved actions — over MCP.",
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
description: Push a feature review set to the Porcelain app — and read the human's review comments — so a human can review the WHOLE feature (including server/cross-seam files that aren't in the git diff) in flow order. Use after implementing, or while working on, a multi-file feature (especially one spanning the client/server seam), and when the human says they left comments or notes on your change.
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

The human also leaves comments in Porcelain — anchored to specific lines (or a whole file) — as concrete review context for you. They're the counterpart to the review set: app → agent. Check them:

- \`get_review_comments\` — \`{ repoPath }\` → the OPEN comments, each with its file/line anchor, the snippet it was attached to, the note, and an id. Read these before and during the work: they tell you exactly what to explain, fix, or look at.
- \`resolve_review_comment\` — \`{ repoPath, id }\` → mark one resolved once you've ACTUALLY addressed the note; it then drops off the reviewer's open list.

When the human says "look at my comments", "I left some notes", or asks about a specific line/diff, call \`get_review_comments\` first.
`

export const BOARD_SKILL = `---
name: ${BOARD_SKILL_NAME}
description: Read and update the Porcelain project board — the repo's todo/doing/done cards. Use to pick up queued work the human added, capture new tasks you discover, and move cards to doing/done as you progress, so the human can queue and track work without spelling it out in chat.
---

# Porcelain project board

Porcelain shows a per-repo todo/doing/done board of cards (features/tasks). It's how the human queues work without spelling everything out in chat, and how you reflect progress back — a two-way channel. Read it to know what to build; keep it in sync as you work.

Call the \`porcelain\` MCP tools with \`repoPath\` set to the ABSOLUTE path of the repo you're working in (your cwd):

- \`list_cards\` — \`{ repoPath }\` → the board grouped by column, each card with an id, title, and body. Check it to pick up queued work.
- \`create_card\` — \`{ repoPath, title, body?, status? }\` → capture a task (defaults to the "todo" column).
- \`update_card\` — \`{ repoPath, id, title?, body? }\` → edit a card.
- \`move_card\` — \`{ repoPath, id, status }\` → move a card to "doing" when you start it and "done" when you finish, so the human sees progress.
- \`delete_card\` — \`{ repoPath, id }\`.

## How to use it

- When the human says "what's on my board", "what should I build next", or asks you to pick up queued work, call \`list_cards\` first.
- When you start a card, \`move_card\` it to "doing"; when you finish, move it to "done" — keep the board honest so the human sees real-time progress.
- Capture follow-ups and tasks you discover with \`create_card\` so nothing gets lost in chat.
`

export const ACTIONS_SKILL = `---
name: ${ACTIONS_SKILL_NAME}
description: Curate Porcelain's saved actions — named shell commands (dev server, tests, storybook, …) the human runs in the app's embedded terminal with one click. Use to add or edit the project's common commands so they're one click away. You define them; only the human runs them.
---

# Porcelain saved actions

Porcelain has saved "actions" — named shell commands the human runs in the embedded terminal with one click (dev server, storybook, test watcher, …). Curate them so the project's common commands are one click away for the human.

Call the \`porcelain\` MCP tools with \`repoPath\` set to the ABSOLUTE path of the repo you're working in (your cwd):

- \`list_actions\` — \`{ repoPath }\` → the saved actions, each with an id, title, command, and optional cwd.
- \`create_action\` — \`{ repoPath, title, command, cwd? }\` → add one (e.g. title "Storybook", command "pnpm --filter web storybook").
- \`update_action\` — \`{ repoPath, id, title?, command?, cwd? }\` → edit one (empty-string cwd clears it).
- \`delete_action\` — \`{ repoPath, id }\`.

You DEFINE actions; only the human runs them (there is no run tool). When you discover the project's common commands (from package.json scripts, the README, or what the human asks you to run repeatedly), offer to save them as actions.
`

export const NOTES_SKILL = `---
name: ${NOTES_SKILL_NAME}
description: Read the human's per-repo project notes from Porcelain — a freeform markdown scratchpad of conventions, gotchas, todos, and context for the repo. Use to pick up project context the human jotted down instead of spelling it out in chat, especially when they say "my notes" or you're starting work in a repo.
---

# Porcelain project notes

Porcelain keeps a per-repo notes scratchpad — a freeform markdown card (Files → Notes) where the human jots conventions, gotchas, todos, and context for the repo. It's a ONE-WAY channel: the human writes, you read.

Call the \`porcelain\` MCP tool with \`repoPath\` set to the ABSOLUTE path of the repo you're working in (your cwd):

- \`get_repo_notes\` — \`{ repoPath }\` → the human's notes as markdown (or a hint that there are none yet).

## How to use it

- When the human says "check my notes", "see my project notes", or "what did I write down", call \`get_repo_notes\` first.
- When you start work in a repo, read the notes for standing context (conventions to follow, gotchas to avoid, what the human wants next) before asking.
- The notes are the human's scratchpad — read-only, there is no write tool; don't try to edit them. Capture actionable tasks on the project board instead (see the project-board skill).
`

export interface PluginSkill {
  /** Skill dir + frontmatter \`name\`; becomes \`porcelain:<name>\` once installed. */
  name: string
  /** The SKILL.md body, frontmatter included. */
  content: string
}

/** Every skill the plugin ships — the installer writes one \`skills/<name>/SKILL.md\` each. */
export const SKILLS: readonly PluginSkill[] = [
  { name: REVIEW_SKILL_NAME, content: REVIEW_SKILL },
  { name: BOARD_SKILL_NAME, content: BOARD_SKILL },
  { name: ACTIONS_SKILL_NAME, content: ACTIONS_SKILL },
  { name: NOTES_SKILL_NAME, content: NOTES_SKILL },
]
