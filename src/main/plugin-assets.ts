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
export const LAYERS_SKILL_NAME = 'flow-layers'
export const ARTIFACT_SKILL_NAME = 'feature-artifact'

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
 * 2.4.0: added the flow-layers channel — get/set/reset_flow_layers let the agent read
 *        and retune the per-repo review-flow grouping (two-way) — plus a flow-layers skill.
 * 2.5.0: added the reviewed-marks channel — get_reviewed_files reads which files the human
 *        has ticked as reviewed (read-only, app→agent) — taught in the review skill.
 * 2.6.0: added the feature-view snapshot channel — get_feature_view reads Porcelain's
 *        COMPUTED view (every file with its git-truth source + flow layer; read-only,
 *        app→agent) and get_review_comments now tags each comment with that source; plus a
 *        per-file `layer` on review files that drives the feature view's grouping/order.
 * 2.7.0: added the feature-artifact channel — set/get/clear_feature_artifact let the agent
 *        author a self-contained HTML explainer Porcelain renders in a sandboxed iframe
 *        (two-way) — plus a focused feature-artifact skill.
 * 2.8.0: added answer_review_comment — the agent attaches one reply to a review comment
 *        (overwritten on re-answer), rendered under the comment in Porcelain.
 */
export const PLUGIN_VERSION = '2.8.0'

/**
 * The local Claude Code marketplace root the app writes. Lives in ~/.porcelain
 * (the user's home, NOT a work repo) alongside the agent channel. Copying the
 * built MCP server here makes it a real, runnable file even when the app itself
 * is packaged inside app.asar.
 */
export function pluginMarketplaceDir(): string {
  return join(homedir(), '.porcelain', 'plugin')
}

/** Where Cursor loads user-installed local plugins from. */
export function cursorPluginLocalDir(): string {
  return join(homedir(), '.cursor', 'plugins', 'local', PLUGIN_NAME)
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
          'MCP server + skills to push feature review sets, read review comments, reviewed-file marks, and project notes, manage the project board and saved actions, tune the review-flow layers, and author feature artifacts in the Porcelain app.',
      },
    ],
  }
}

export function pluginManifest(version: string): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    description:
      "Porcelain companion: push feature review sets so a human reviews the whole feature in flow order, read/resolve review comments, see which files the human has marked reviewed, read the human's project notes, manage the project board and saved actions, tune the review-flow layers, and author feature artifacts — over MCP.",
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

export function cursorMarketplaceManifest(): Record<string, unknown> {
  return marketplaceManifest()
}

export function cursorPluginManifest(version: string): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    description:
      "Porcelain companion: push feature review sets so a human reviews the whole feature in flow order, read/resolve review comments, see which files the human has marked reviewed, read the human's project notes, manage the project board and saved actions, tune the review-flow layers, and author feature artifacts — over MCP.",
    version,
    author: { name: 'Porcelain' },
  }
}

export function cursorMcpManifest(): Record<string, unknown> {
  return {
    mcpServers: {
      porcelain: {
        command: 'node',
        args: ['./server.js'],
      },
    },
  }
}

/** Manual fallback when the app can't copy into ~/.cursor/plugins/local. */
export function cursorInstallCommands(): string[] {
  const src = join(pluginMarketplaceDir(), PLUGIN_NAME)
  const dest = cursorPluginLocalDir()
  return [`mkdir -p ${dest}`, `cp -R ${src}/. ${dest}/`]
}

export const REVIEW_SKILL = `---
name: ${REVIEW_SKILL_NAME}
description: Push a feature review set to the Porcelain app — and read the human's review comments and which files they've marked reviewed — so a human can review the WHOLE feature (including server/cross-seam files that aren't in the git diff) in flow order. Use after implementing, or while working on, a multi-file feature (especially one spanning the client/server seam), and when the human says they left comments or notes on your change or asks what they've reviewed so far.
---

# Review with Porcelain

Porcelain is a macOS review companion that shows a "feature view": the whole feature in flow order (entry point → data), not just the git diff. You built the feature, so you know its true boundary — hand it over so the human reviews the complete picture instead of only the files that happen to have changed.

## When to use

After you implement a feature, finish a meaningful slice, or are asked to "set up the review" — especially when your change touches only part of a feature that spans many files or the client/server seam (the diff can't show the other half, because it didn't change and the link is a route string, not an import).

## How

Call the \`porcelain\` MCP tools with \`repoPath\` set to the ABSOLUTE path of the repo you're working in (your cwd):

- \`set_feature_review\` — replace the review set: \`{ repoPath, name, files: [...] }\`. List files in FLOW ORDER (entry point → data) — Porcelain renders them in that order.
- \`add_review_files\` — add files to it incrementally while you work
- \`get_feature_review\` — read back the current set (name, files, sources, notes, layers); use it to verify what you pushed or to make an idempotent update (read → modify → \`set\`), and to recover the set if you lose context
- \`get_feature_view\` — read back the COMPUTED view: every file Porcelain renders, grouped in flow order, each tagged with its real source (\`changed\` = in the git diff, \`context\`/\`shipped\` = the unchanged rest) and layer. Where \`get_feature_review\` echoes what you declared, this shows what Porcelain made of it after folding in git status + the import baseline — use it to confirm the view rendered as intended.
- \`clear_feature_review\` — remove it

Each file is \`{ path, source?, note?, layer? }\`:
- \`path\` — repo-relative.
- \`source\` — OMIT for files you changed (Porcelain detects those from git). Use \`"shipped"\` for files already landed that the change depends on (the server route/controller/service, an existing endpoint), and \`"context"\` for unchanged files needed to follow the flow (shared types, constants).
- \`note\` — the cross-file invariant a reviewer must check, e.g. "labels here must match CALLOUT_TEMPLATES in the service" or "this mutation must invalidate the listX query".
- \`layer\` — OPTIONAL, and the way to control the feature view's grouping. Set it to the flow-layer heading this file belongs to (e.g. \`"Store"\`, \`"Routes"\`, \`"Data"\`). When ANY file has a \`layer\`, Porcelain groups the FEATURE VIEW by your declared layers + file order verbatim, instead of the repo-wide regex layers — so you place every file exactly where it belongs in THIS feature, no file lands in "Other", and nothing gets swept up by a catch-all pattern. Files left without a \`layer\` fall back to the regex match. (The repo-wide regex layers still group the Changes/History tabs — tune those with the flow-layers skill; the feature view is yours to shape per-feature here.)

## What to include

The COMPLETE feature, not just your diff:
- The files you changed (no \`source\` needed).
- The cross-seam files the diff can't show — the server route/controller/service a client change calls (\`shipped\`), and shared types or constants both sides depend on (\`context\`).
- A \`note\` on every file where there's an invariant, contract, or gotcha the reviewer would otherwise miss.

Keep it tight: the files that make up THIS feature, broad enough that the human can read it as one story from entry point to data.

## Reviewer comments

The human also leaves comments in Porcelain — anchored to specific lines (or a whole file) — as concrete review context for you. They're the counterpart to the review set: app → agent. Check them:

- \`get_review_comments\` — \`{ repoPath }\` → the OPEN comments, each with its file/line anchor, the snippet it was attached to, the note, and an id. Each is also tagged with the file's feature-view status — \`(changed)\` (in the git diff), \`(context)\`, or \`(shipped)\` — so you can tell a comment on a file you diffed from one on an unchanged context/cross-seam file the human is asking about. Read these before and during the work: they tell you exactly what to explain, fix, or look at.
- \`resolve_review_comment\` — \`{ repoPath, id }\` → mark one resolved once you've ACTUALLY addressed the note; it then drops off the reviewer's open list.

When the human says "look at my comments", "I left some notes", or asks about a specific line/diff, call \`get_review_comments\` first.

## Reviewed files

The human also ticks off files as they review them — a per-file "reviewed" checkbox in Porcelain's Changes/Feature lists. This is the other half of their review state (app → agent, read-only):

- \`get_reviewed_files\` — \`{ repoPath }\` → the repo-relative paths the human has marked reviewed. Any changed file NOT in this list is still unreviewed, so focus your explanations and double-checks there and treat the listed ones as already vetted. The marks describe the current working tree and reset when the changes are committed.

When the human asks "what have I reviewed", "where was I", or "what's left to review", call \`get_reviewed_files\`. It's read-only — "reviewed" is the human's act, so there is no tool to set it; don't mark files reviewed on their behalf.
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

export const LAYERS_SKILL = `---
name: ${LAYERS_SKILL_NAME}
description: Tune Porcelain's review-flow layers for a repo — the ordered rules that group changed files into a story from entry point to data. Use to check the codebase's actual structure and decide which layers to add, edit, reorder, or remove so a human reviews changes grouped the way THIS repo is built, especially when the human says the grouping is wrong, files land in "Other", or you've just learned the repo's layout.
---

# Porcelain flow layers

Porcelain groups a change into **flow layers** — an ordered list of \`{ label, pattern }\` rules — so a human reviews the diff as a story from the entry point down to the data, not as an alphabetical file list. Each changed file is bucketed into the **furthest-right matching** layer; anything no layer matches falls into **Other** (rendered last). You know how this repo is actually laid out, so tune the layers to fit it instead of leaving the generic defaults.

**Scope — these layers drive the Changes/History tabs (the whole repo).** They're regex rules applied to every review, so they suit broad, repo-wide structure. They are NOT the lever for one feature's flow: if a regex layer is hard to write (files would land in "Other", or a catch-all like \`app/\` sweeps unrelated files together), that's a sign you're fighting the wrong tool. To shape **the feature view** for a specific feature, don't bend the repo-wide regex — set each file's \`layer\` in \`set_feature_review\` (see the review-with-porcelain skill). There you place each file in a named layer and declared order verbatim, per-feature, with no regex and no "Other". Reach for repo-wide layers below only for the Changes-tab grouping.

## When to use

- The human says the grouping looks wrong, or too many files are landing in **Other**.
- You've just mapped the repo's structure (a monorepo, a framework with its own conventions, an unusual folder layout) and the default layers don't reflect it.
- The human asks you to "set up the review flow", "fix the layers", or "group my changes by layer".

## How

Call the \`porcelain\` MCP tools with \`repoPath\` set to the ABSOLUTE path of the repo you're working in (your cwd). This is a **whole-set replace** — there is no per-layer add/delete; you always send the COMPLETE ordered list.

- \`get_flow_layers\` — \`{ repoPath }\` → the effective layers (the repo's custom set, or the built-in defaults), as a numbered list AND JSON. **Always read this first**, then modify and set — that's how you add, edit, remove, or reorder.
- \`set_flow_layers\` — \`{ repoPath, layers: [{ label, pattern }, ...] }\` → replace the whole set with your new ordered list (at least one layer).
- \`reset_flow_layers\` — \`{ repoPath }\` → drop the custom set and fall back to the defaults.

## Designing the layers

1. \`get_flow_layers\` to see what's in effect.
2. Look at the repo: the directories under \`src\` (or the package roots in a monorepo), the framework's conventions, where the entry points, the data/schema, and the tests live.
3. Order them **entry point → data**: the surface the user touches first at the top (pages/routes/screens), shared UI and logic in the middle (components, hooks, services), persistence at the bottom (models, schema, migrations), and tests last.
4. Write a regex \`pattern\` per layer, tested against the **repo-relative path**. The three shapes the defaults use:
   - **Folder**: \`(^|/)(components|ui)/\` — files inside a folder of that name.
   - **Extension**: \`\\.(sql|prisma)$\` — files with that extension.
   - **Filename suffix**: \`\\.(test|spec)\\.[a-z]+$\` — files whose name ends that way before the extension.
5. \`set_flow_layers\` with the full ordered list.

**Order matters twice**: it's the order groups render in, AND the furthest-right match on a path wins (so \`apps/api/controllers/x.ts\` is a Controller, not a Route, even though \`api/\` also matches). Put the more-specific layer so its match sits further right in the path, or rely on a filename-suffix pattern (which matches to the right of any directory). Keep the set tight — a handful of meaningful layers beats one per folder; let the long tail fall into **Other**.
`

export const ARTIFACT_SKILL = `---
name: ${ARTIFACT_SKILL_NAME}
description: Author a "feature artifact" for the Porcelain app — a self-contained HTML document (prose, inline SVG diagrams, tables, images) that explains a feature, which Porcelain renders in the viewer so the human gets an enhanced way to understand what you built. Use after implementing or explaining a feature when a rich visual/narrative explainer helps more than a plain chat message, or when the human asks you to "write it up in Porcelain".
---

# Porcelain feature artifact

Porcelain can render a **feature artifact**: a self-contained HTML document you author that explains a feature — with prose, diagrams, tables, and images — shown in the viewer. It COMPLEMENTS the feature review set (which is the file-by-file flow in \`review-with-porcelain\`): the review set is the code walkthrough; the artifact is the narrative/visual explainer (how it works, the architecture, the data flow, the decisions).

## When to use

- After you implement or explain a feature and a rich, visual write-up beats a wall of chat text — an architecture diagram, a sequence of steps, a comparison table.
- When the human says "write it up in Porcelain", "make me a diagram of this", or "explain the feature visually".

## How

Call the \`porcelain\` MCP tools with \`repoPath\` set to the ABSOLUTE path of the repo you're working in (your cwd):

- \`set_feature_artifact\` — \`{ repoPath, title, html }\` → author/replace the artifact.
- \`get_feature_artifact\` — \`{ repoPath }\` → check whether one exists (title, size, when set — not the full HTML).
- \`clear_feature_artifact\` — \`{ repoPath }\` → remove it.

## Authoring the HTML — read this before you write it

Porcelain renders your HTML in a **FULLY SANDBOXED iframe**. This is a hard constraint, not a preference:

- **Scripts NEVER run.** \`<script>\` is inert — don't rely on JS for anything.
- **External resources NEVER load.** No CDN scripts or stylesheets, no web fonts, no remote images, no \`fetch\`. Anything pointing at a URL silently fails to load.

So the document must be **ONE self-contained file**:

- **Inline all CSS** in a \`<style>\` tag (never \`<link rel="stylesheet">\`).
- **Diagrams = inline \`<svg>\`** drawn directly in the HTML — not \`<img>\` to a diagram service, not a Mermaid script.
- **Images = \`data:\` URIs** (e.g. \`<img src="data:image/png;base64,…">\`). No remote \`src\`.
- **Tables, headings, lists** = plain semantic HTML.
- Use system fonts (\`font-family: system-ui, sans-serif\`) — web fonts won't load.

**Dark styling.** Porcelain's UI is dark. Style the document itself to match: a dark background and light text, e.g.

\`\`\`html
<style>
  body { margin: 0; padding: 2rem; background: #0b0b0d; color: #e5e5e7;
         font-family: system-ui, sans-serif; line-height: 1.6; }
  h1, h2 { color: #fff; } a { color: #7aa2f7; }
  table { border-collapse: collapse; } td, th { border: 1px solid #2a2a2e; padding: .4rem .6rem; }
</style>
\`\`\`

**Size cap.** The HTML must be under ~1.5 MB. If you're embedding images, keep them small (or prefer inline SVG, which is tiny) — don't paste huge base64 blobs.

Write the whole \`<html>…</html>\` document (or just the body content — Porcelain renders whatever you send via \`srcdoc\`). Keep it focused: one feature, one clear explanation the human can read top to bottom.
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
  { name: LAYERS_SKILL_NAME, content: LAYERS_SKILL },
  { name: ARTIFACT_SKILL_NAME, content: ARTIFACT_SKILL },
]
