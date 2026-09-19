# Handoff: build the review workspace in apps/web

The prototype in this folder is the spec for the web app. It runs with
`npm install && npm run dev` (http://localhost:5181), uses the same stack, layering,
names and data shapes as `apps/web`, and fakes only the server. `PROTOTYPE.md` is the
detailed reference, screen by screen, with the contracts; read it next.

Status: updated on 2026-09-18 to match the server review (decisions in the Porcelain
Notion database, one page per section, plus a glossary). `design/prototype` is not
committed yet. Typecheck is clean. The server is rebuilt first, following the Notion
page "Server rebuild: build order"; the web follows, then desktop and mobile.

## What Porcelain is for

A developer's coding agent (Claude Code, Codex) works in a worktree. When it stops, the
developer reviews what it did before committing. Review answers four questions:

1. **What changed, and why?** The agent's summary page and, when it drew one, a
   Before/After diagram.
2. **Is it right?** Each layer walks one behaviour through the code, step by step;
   anything the layers don't explain is listed as Not explained.
3. **Where do I push back?** Comments on lines, files or the whole worktree, answered
   by the agent.
4. **Am I done?** Every layer ticked (the dot turns hollow green), then commit.

## What we decided (and why)

**One server per web app.** The web app is served by one server and shows only it. A
browser pairs once with a link from `porcelain pair` on the server machine; the owner
revokes devices there. Agents connect with `porcelain mcp`, never with a token.

**Layout.** Three columns: projects and worktrees on the left, tabbed documents in the
centre (split in two on demand), surfaces on the right (Changes/Review, Files, History).
Selection lives in the URL. Everything opens as a tab.

**The sidebar dot.** One dot per worktree, never a count: green (review ready), hollow
green (every layer reviewed, not committed), yellow (the agent replied, unread).
Worktrees come live from Git; there is no refresh.

**The review is what the agent publishes.**
- **Summary**: the agent's own HTML page, like a Claude artifact, sandboxed with a
  blank identity (scripts, CDNs and fonts allowed; Porcelain's login and API
  unreachable), following the app's theme; its `#layer-N` links open layers.
- **Graph**: Porcelain draws the agent's diagram (lanes, boxes, New/Changed/Removed,
  After and optionally Before); boxes open layers.
- **Layers**: one behaviour each, told as steps (lane, title, a sentence or two, the
  code). Changed code shows as a diff, context as plain code. Steps follow the code
  when it moves, warn when it changed since the review, and fold when committed.
- **Not explained**: changed code no step covers. Nothing can hide by being left out.
- Without a review, everything reads **Changes**: every file, ticked per file.
- Gone: `handoff.md`, the report tab, uploads, the all-diffs scroll, per-commit layers.

**Ticks** are per layer in a review and per file in Changes; each stores the
fingerprint of what you saw and goes stale when that code moves on. A file's diff runs
from the last commit to disk: that is what Porcelain commits, so staged and unstaged
edits never hide from each other.

**Comments** are a conversation with the agent. They follow the code (Outdated shows
the lines as they were), can be general, render Markdown, and remember what you have
read on every device. Nothing is pushed to agents: you tell the agent to read them.

**Live updates.** The server sends notices of what changed; only those reads reload.
Nothing polls and nothing refetches on window focus.

**Files** is a light file manager: folders on demand, quick open (Mod+P), edit, create,
move, delete to the trash, ignored files included, HTML previews from their own link.

**History** pages by "commits before the last one shown", takes new commits live, and
opens commits file by file.

**Git**: an icon-only split button at the end of the tab bar. One request per action,
sent with what you saw (refused with "changed since you looked" if it moved); live
progress for fetch, pull and push; commit (single, groups with AI drafts, amend with a
warning when already pushed); stash; switch and create branches; discard with Restore;
an action cut off by a server restart is shown once and never locks anything. Pull only
fast-forwards by default, as Git does, and offers merge or rebase for a diverged branch.
A pull that stops on a conflict says how to finish (a merge commit takes the whole
index) or back out.

**Cut:** file pinning, terminal, multi-window, sharing, a mobile app (the web narrows to a phone), navigator search, an
Artifacts surface, a Git surface, opening a file at an old commit, searching History,
reviews kept per commit (deferred). **Later:** a file's own history.

## How to build it

1. **Server first**, per the Notion build order: quality path, foundations, pairing,
   live worktrees, small reads, live channel, the review, Git actions, service.
2. **Contracts**: `src/contracts` is the target shape; add each as the server gains it.
3. **Client**: implement a live adapter for each port in `src/api/api.ts` (including
   `live` and `connection`).
4. **Dependencies**: see Libraries below.
5. **Domain** (`src/domain/*`): pure, port with specs first. The ones worth the most
   care: `listChanges` (one entry per file, which change it keeps); `anchorForRange` and
   `mixedSelectionMessage` (split versus unified); `resolveRelativePath` (security:
   `..` past the root, schemes, `//`, encoded traversal); `gitActionBlocker` and
   `primaryGitAction` (merge and rebase first, diverged with Fast-forward only);
   `binaryEntry`, `resolveCommitModel`, `widestLane` with `layoutGraph`. The editor's
   save and draft states (`file-editor.tsx`, `edit-drafts.ts`) are worth a pure reducer
   with specs of their own.
6. **Query** (`src/query/*`): keys, the live channel, the operation and connection
   stores, the hooks.
7. **Router**: the new `entry` kinds (`review`, `layer:`, `unexplained`, `change:`,
   `file:`, `commit:`), kept across surfaces.
8. **Views**: `code-document.tsx` first, then the documents, the surfaces, the
   navigator, pairing and dialogs. Port the prototype's behaviour onto apps/web's
   components rather than copying them over: keep the web's accessibility (labels,
   focus handling, keyboard paths) and hardening (error boundaries, input checks,
   safe links) where the prototype is looser. Views here still import a few contract
   types directly; in apps/web they come through `domain/`.
9. Drop `development/prototype-controls.tsx` and `api/mock-*`.

Keep the boundaries: views never import `api/`, domain never imports React or TanStack,
api never imports query or views. `src/components/ui/*` is copied from apps/web; the one
deliberate edit (red destructive menu items) is described in PROTOTYPE.md.

## Libraries

Compared with `apps/web/package.json`. apps/web pins exact versions; use these.

### Add

| Package | Version | Why |
| --- | --- | --- |
| `@pierre/diffs` | `1.4.2` | Every diff, file, commit and markdown code block: `CodeView` (virtualized, sticky headers, inline annotations for comments, gutter ＋ with drag-to-select, line selection, collapse), `File`, `parsePatchFiles`, and the editor (`EditProvider`) for quick edits. Highlights with Shiki themes `pierre-light` / `pierre-dark`. |
| `@pierre/trees` | `1.0.0-beta.6` | The Files surface (`FileTree`: search, git status incl. `ignored`, rename, drag and drop, context menu) and the built-in file-type icons used everywhere (`createFileTreeIconResolver`, `getBuiltInSpriteSheet('complete')`). |
| `@tanstack/markdown` | `0.0.14` | Markdown for step text, comment bodies and the Reader view; its fenced code is rendered by Pierre `File`. |
| `@xyflow/react` | `12.11.6` | The review's Before/After diagram and each layer's graph (`review-diagram.tsx`, ported from the server lab). |
| `@dagrejs/dagre` | `1.1.8` | Layout for graphs without lanes; the same version as the server lab. |

Already in apps/web and used as-is: `@base-ui/react`, `@shadcn/react` (Message,
Bubble, MessageScroller), `@tanstack/react-query`, `-router`, `-hotkeys`, `-form`
and their devtools, `react-resizable-panels`, `date-fns`, `lucide-react`,
`class-variance-authority`, `cn`, `tailwindcss`, `tw-animate-css`,
`@fontsource-variable/geist`, `shadcn`.

Not needed in apps/web: `diff` (jsdiff) only builds patches for the mock server, and
`zod` comes through `packages/contracts`.

### Remove

| Package | Used today in | Why it goes |
| --- | --- | --- |
| `@tanstack/highlight` | `lib/code-highlight.ts`, `lib/code-theme.ts`, `lib/diff-highlight.ts` (+ specs) | Pierre highlights every diff, file and markdown code block with Shiki and its own themes. Two highlighters would mean two theme systems and two token pipelines. |
| `@tanstack/react-virtual` | `views/review/code-preview.tsx` | Pierre's `CodeView` virtualizes diffs and files itself and owns its scroll element. |
| `@react-symbols/icons` | `views/review/review-row.tsx`, `views/review/file-navigation.tsx` | File-type icons now come from `@pierre/trees`' built-in set everywhere, so a tab, a list row and the tree show the same icon. Folders use lucide `Folder` / `FolderGit2`. |

Leave for now: `embla-carousel-react`, `input-otp`, `react-day-picker` and `cmdk`
are imported only by vendored shadcn components (`carousel`, `input-otp`,
`calendar`, `command`) that nothing in apps/web uses. Removing them is a separate
cleanup.

### Agent skills added

Pinned in `skills-lock.json` and installed under `.agents/skills/`. Read them before
touching Pierre code:

| Skill | Source | Covers |
| --- | --- | --- |
| `diffs` | `pierrecomputer/pierre` → `skills/diffs/SKILL.md` | `@pierre/diffs`: CodeView, annotations, selection, editor, themes, SSR, workers. |
| `trees` | `pierrecomputer/pierre` → `skills/trees/SKILL.md` | `@pierre/trees`: FileTree, selection, search, rename, drag and drop, icons, git status, themes. |

Already there: `shadcn`, `react-doctor`.

## Pierre gotchas worth knowing up front

Details are in PROTOTYPE.md → Pierre usage notes.

- Both packages render into **shadow roots**. Theme backgrounds and the gutter ＋ are
  styled through `unsafeCSS` (`views/review/pierre.ts`); the tree through
  `--trees-*-override` variables (`pierre.css`). Slotted React content inherits the
  monospace font; `.diff-annotation` resets it.
- File-type icon colours live inside the tree's shadow root and aren't exported, so
  `pierre.css` carries a copy under `.pierre-file-icon`. Regenerate it when bumping
  `@pierre/trees`.
- `CodeView` owns its scroll element, so it can't sit in a shadcn `ScrollArea`; its
  native scrollbar is styled to match (`.code-scroll`).
- File headers are a fixed 44px and there is no slot between items, so a step's
  explanation cannot sit between files of one `CodeView`: layer pages use one Pierre
  component per step. Key a non-virtualized `FileDiff` on its `cacheKey`, or it keeps
  showing its first diff.
- A single file under its own toolbar needs `disableFileHeader`, `FLUSH_TOP_CSS` **and**
  `itemMetrics.paddingTop: 0`, or the virtual layout keeps a gap.
- Give every item a `version` derived from its state; CodeView re-renders only items
  whose version moved.
- Agent HTML runs in a sandbox without same-origin. Don't auto-size it; let it fill its
  box and scroll.

## Open points

- The rule for Not explained (blank lines, imports, comments and lone closing brackets
  don't count; a step covering part of a paragraph explains it) was chosen while
  building the mock, because counting every line flagged every import and brace. The
  owner kept it (2026-09-19); revisit it with real agent reviews, where an import that
  adds a dependency is the likeliest thing to slip through.
- Known gaps are listed at the end of PROTOTYPE.md.

## Not the spec

`design/main-feature-inventory.md` is the inventory of `main` the first kept/cut
decisions came from; this document and PROTOTYPE.md win where they differ.
