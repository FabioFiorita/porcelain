# Porcelain review prototype

A clickable, fully mocked prototype of the Porcelain review workspace, built
to be translated into `apps/web`. It uses the same stack, layering, names and
data shapes as the real app; only the transport is fake.

```bash
npm install
npm run dev        # http://localhost:5181 (also on the LAN)
```

Everything resets on reload. The **Prototype** pill at the bottom of the screen
simulates what only a real agent, Git or the network would do: the agent replying
to comments, moving or rewriting code under a review, committing or rebasing in its
own session, creating a worktree; the connection dropping, the server restarting
mid-push, this browser being revoked; slow or failing requests. Every change
reaches the app through the mock live channel, as the server's watchers would
announce it.

## Stack

| Concern | Library (same pins as apps/web) |
| --- | --- |
| Diffs, files, inline comments, gutter button, line selection | `@pierre/diffs` `CodeView` / `File` |
| File tree, search, git status, context menu | `@pierre/trees` `FileTree` |
| Chrome | shadcn (`base-rhea`) on Base UI, Tailwind 4, the web app's `app.css` preset copied byte for byte |
| Comment threads | shadcn `Message`, `Bubble`, `MessageScroller` (`@shadcn/react`) |
| URL state | `@tanstack/react-router` |
| Server state | `@tanstack/react-query` |
| Shortcuts | `@tanstack/react-hotkeys` |
| Forms | `@tanstack/react-form` |
| Markdown prose | `@tanstack/markdown` (code blocks rendered by Pierre) |
| Panels | `react-resizable-panels` |
| File-type icons | `@pierre/trees` built-in set (`complete`, coloured), in the tree and everywhere else |
| Times | `date-fns` |
| Mock patches | `diff` (jsdiff; already a dependency of `@pierre/diffs`) |
| Diagrams (the review's Before/After graph, each layer's graph) | `@xyflow/react`, `@dagrejs/dagre` (same versions as the server lab) |

Dropped relative to apps/web: `@tanstack/highlight` and `@tanstack/react-virtual`
(Pierre highlights and virtualizes).

File-type icons are Pierre's own, everywhere. The Files tree uses its default built-in set
(`complete`, coloured; `views/review/file-icons.tsx` only adds lucide symbols for symlinks and
submodules). Tabs, review rows, comment headers, the file toolbar and the commit dialog draw the
same icons with `FileTypeIcon` (`views/review/file-type-icon.tsx`): Pierre's
`createFileTreeIconResolver` picks the symbol exactly as the tree does, and `PierreIconSprite`
(mounted once in `main.tsx`) puts `getBuiltInSpriteSheet('complete')` in the page. The per-type
colours live inside the tree's shadow root and `@pierre/trees` does not export its stylesheet, so
`pierre.css` carries a copy under `.pierre-file-icon`; regenerate it when bumping `@pierre/trees`.
The folder browser uses lucide `Folder` / `FolderGit2`. apps/web can drop `@react-symbols/icons`.

## Layering — maps 1:1 onto apps/web/src

| Prototype | apps/web | Notes |
| --- | --- | --- |
| `src/contracts/*` | `packages/contracts/src/*` | Types only. `/** PROPOSED */` marks additions (see below). |
| `src/domain/*` | `src/domain/*` | Pure rules; no React, no TanStack, no api. |
| `src/api/api.ts` | `src/api/api.ts` | The `Api` port, grouped by resource. |
| `src/api/mock-*.ts`, `src/api/fixtures/*` | `src/api/*/mock.ts`, fixtures | In-memory server: state (`mock-store`), what the server computes on read (`mock-review`), Git actions (`mock-git`), summary links (`mock-summary`), the API (`mock-api`), the Prototype panel (`mock-controls`). Replace with live adapters. |
| `src/query/*` | `src/query/*` | Keys, provider, operation store, hooks. Hook names have no `Query` suffix. |
| `src/routes/router.tsx` | `src/routes/router.tsx` | Hand-written `validateSearch`. |
| `src/views/workspace/*` | `src/views/workspace/*` | Shell, navigator, dialogs, preferences. |
| `src/views/review/*` | `src/views/review/*` | Documents, surfaces, comments. |
| `src/development/*` | `src/development/*` | Devtools; `prototype-controls` is prototype-only. |
| `src/components/ui/*` | same | Copied unmodified from apps/web. |

**One deliberate change to a vendored component:** the translucent menu style
(`menuColor: default-translucent`) forces destructive items back to the normal
text colour with `!important`. The three `**:data-[variant=destructive]:…!`
classes were removed from `components/ui/context-menu.tsx` and
`components/ui/dropdown-menu.tsx`, so destructive items are red. Apply the same
edit in apps/web. Rule: every destructive action is red (the `destructive`
button or menu variant).

**Porcelain runs outside a secure context.** Over plain http on a LAN or
tailnet (e.g. `http://192.168.x.x:5181`), the browser removes
`navigator.clipboard` and `crypto.randomUUID`. Both are routed through
fallbacks: `views/workspace/copy.ts` (hidden-textarea copy) and `lib/id.ts`
(`createId`, built on `crypto.getRandomValues`). apps/web must do the same, or
copying, posting a comment and running a git action all throw when opened
from another machine.

**Dialogs** share one shape: an icon in the header (`views/workspace/dialog-icon.tsx`),
a fixed header, and a body that scrolls inside shadcn `ScrollArea` so the
scrollbar never cuts the rounded corners.

Scrollbars follow one rule: anything React owns scrolls inside shadcn
`ScrollArea` (dialogs, the History list, the tab strip). The tab strip composes
the Base UI primitive with `ScrollBar orientation="horizontal"` (6px, overlaying
its bottom border) because the vendored `ScrollArea` only renders a vertical bar,
and its row is `h-full` so the border never leaves a pixel to scroll vertically.
Pierre's `CodeView` and editor own their scroll element (virtualization listens
to it), so they cannot sit in a `ScrollArea` viewport; their native bar is
dressed like the shadcn thumb instead (`.code-scroll` in `pierre.css`, and the
same rule inside the shadow root via `SURFACE_CSS`).

**Toasts** follow one rule (`views/workspace/notify.ts`): confirm what the
reviewer cannot see where they clicked (copies, opening or removing a project,
bulk reviewed marks, git results) and report every failure. Changes visible in
place (one tick, posting a comment or reply, resolve) only toast when they fail.

Views never import `api/`; domain never imports React or TanStack; api never
imports query or views — the same boundaries `scripts/boundary-rules.ts` enforces.

## Product decisions encoded here

The server review of 2026-09-18 reshaped the product. Its decisions live in the
Porcelain Notion database (one page per section, plus a glossary and the
"Server rebuild: build order" page); this prototype is how they look and behave.

- Three columns: projects and worktrees left, tabbed documents centre, surfaces right.
- **One server per web app.** The web app is served by one server and shows only it.
  A browser becomes a *device* by pasting a pairing link once (`porcelain pair` on the
  server machine; 15 minutes, single use). Settings shows this device and can forget
  it; only the owner, on the server machine, pairs and revokes.
- **Worktrees come from Git.** The server lists them live, so there is no refresh and
  new agent worktrees just appear. Names are branch names; a project can be renamed.
  An unreachable repository shows as an unavailable project.
- **The sidebar dot** replaces badges: green (review ready), hollow green (every layer
  reviewed, not committed yet), yellow (the agent replied and you have not seen it).
- **The review is what the agent publishes**: a summary page (its own HTML, like a
  Claude artifact), an optional Before/After diagram, and **layers**. A layer tells
  one behaviour from start to end as **steps**: a lane label, a title, a sentence or
  two, and the code block it explains. There is no `handoff.md`, no report tab, no
  uploads and no all-diffs scroll.
- **Nothing changed can hide**: changed code no step explains is listed as
  **Not explained**.
- **Without a review** everything reads Changes: every changed file, ticked per file.
- **Ticks**: in a review you tick layers; in Changes (and Not explained) files. A tick
  stores the fingerprint of what you saw and goes stale when the code moves on.
- **Comments** are a conversation with the agent, anchored to lines, a file, or the
  whole worktree (general threads). They follow the code; when it is gone they are
  **Outdated** and show the lines as they were. Bodies are Markdown. Nothing is pushed
  to agents: you tell the agent to read its comments (MCP `list_comments` returns only
  what waits for it).
- **Live updates** replace polling: the server says what changed and only that
  reloads. Nothing refetches on window focus.
- **Files** is a light file manager: folders load when opened, quick open (Mod+P),
  edit, create, move, delete to the trash, ignored files (like `.env`) included.
- **History** pages by "commits before the last one shown", takes new commits live,
  and restarts from the top when the branch was rewritten.
- **Git**: one request per action with a targeted check ("changed since you looked"),
  live progress, discard (restorable), amend (warns when already pushed), switch and
  create branches, and an interrupted action shown once after a server restart.
- Settings; keyboard shortcuts; light/dark/system.

Cut: file pinning, terminal, multi-window, sharing, a mobile app (the web app narrows to a phone), navigator search, an
Artifacts surface, a Git surface, opening a file at an old commit, searching History,
reviews kept per commit (deferred). Later: a file's own history.

## Mock worktrees

| Navigator row | What it shows |
| --- | --- |
| porcelain → `codex/porcelain-rebuild` (green) | The full review: a summary page, a Before/After diagram, three layers (one with a context step), Not explained code in five files, agent-opened threads, a general thread, an outdated thread, 20 commits with a merge, unreadable, ignored, symlink and submodule files. |
| porcelain → `codex/review-layer-empty-match` | Changes with no review: modified, added and deleted files, ticked per file. |
| porcelain → `codex/tree-icons` (hollow green) | A one-layer review already ticked through, not committed yet. |
| porcelain → `main`, fieldnotes → `main` | Clean worktrees. |
| fieldnotes → `feat/board-filters` (yellow) | A one-layer review and an agent reply you have not seen; 2 behind. |
| atlas | An unavailable project: its repository cannot be reached. |

## How the review works

- **Summary.** The agent's HTML page, served from its own link inside a sandbox with
  a blank identity: scripts, CDNs and fonts load, but it cannot reach Porcelain's
  login, storage or API. Porcelain passes its theme (`#theme=light|dark`) and the
  page's `#layer-N` links open that layer. The server injects Porcelain's fonts
  (Geist, Geist Mono) and theme tokens (`--porcelain-*`), as CSS that works without
  scripts plus a script that follows the app's theme, and the link bridge. The mock
  does the same (`api/mock-summary.ts`) and serves the page from its own link through
  the dev server with the sandbox header (`vite.config.ts` → `mockPages`); some
  browsers will not run scripts in a sandboxed blob page.
- **Graph.** When the agent drew one, the change as boxes in lanes, After (with
  New/Changed/Removed badges) and optionally Before (with notes on what was wrong).
  Porcelain draws it; clicking a box opens the layer behind it.
- **Layers and steps.** Each step points at lines of a file. The server re-finds them
  on every read (same lines, else the same text nearby): a step whose code moved
  follows it; one whose code is gone reads "Code changed since the review was
  written"; one whose code was committed folds as "Committed". A changed step shows its
  block as a diff, a context step plain code.
- **Not explained.** Changed lines no step covers. Blank lines, imports, comments and
  lone closing brackets do not count, and a step covering part of a paragraph explains
  the paragraph.
- **Ticks and the dot.** A layer's fingerprint is computed from the code its changed
  steps cover, so moving code keeps the tick and rewriting it makes it stale. When
  every layer is ticked the dot turns hollow green; when nothing the review describes
  is uncommitted, the review hides until the agent publishes again.

## Live updates

`query/live.tsx` is the live channel: one WebSocket per server in apps/web, the mock's
event stream here. The server sends notices (`contracts/live.ts`): inventory, files
changed (with paths), branch moved, review, comments, marks, and Git action progress.
Each reloads only the reads it names, and only if they are on screen. A burst is
grouped over about 150 ms. After a reconnect the app re-checks what is on screen once.
Nothing polls; `refetchOnWindowFocus` is off.

## Contracts

Everything below is PROPOSED (see `src/contracts/README.md`). Ordered by how much the
UI depends on it.

| Change | Why |
| --- | --- |
| `review.ts`: `ReviewResponse { summary: { url }, diagram?: { after, before? }, layers, notExplained }`; steps with `pointer` and a server-resolved `location` (`current` / `changed` / `committed`); `notExplained` lists binary files with `binary: true` | The review is a summary page, a diagram and layers of steps; replaces review layers and the handoff artifacts. |
| `marks.ts`: marks on `{ kind: 'layer' }` or `{ kind: 'file' }` targets, `SetMarksRequest` with many marks | Ticks per layer in a review, per file in Changes; "Mark all" is one request. |
| `comments.ts`: `worktree` anchor, `location`, `snapshot`, `seenUpTo`, client-picked `threadId`/`messageId`, `MarkSeen`, `parent` on commit anchors | General threads, comments that follow code, the yellow dot, retries that never duplicate, merge comments that reopen the right diff. |
| `inventory.ts`: `Worktree.signal`, no `available` on worktrees, `RenameProjectRequest` | The dot; worktrees live from Git; renaming. |
| `git-status.ts`: `fingerprint` per change, `branch.upstreamOid`, `interrupted`, `inProgress` (a merge or rebase stopped on a conflict), a `head` diff selection (last commit to disk), `TextRangeRequest` | Cheap "did it change"; targeted checks; conflict guidance; a file Git lists as staged and unstaged shows all its edits, as it will be committed; context steps. |
| `git-actions.ts`: `RunGitActionRequest { requestId, input, expected }`, `amend`, `discard`, `switch-branch`, `create-branch`, `progress`, `interrupted`, `BranchesResponse`, drafts by files, `CommitModelsResponse` (`GET /git/commit-models`, `provider:model` ids); a commit during a merge commits the whole index | One request per action; the new actions; drafts only offer models the server's agent CLIs can run; Git refuses a partial commit during a merge. |
| `files.ts`: `DirectoryListing`, `FileSearchResponse`, `PreviewLinkResponse` (with `revision`), `TextResponse.fingerprint`, `FileEditResponse` | Folders on demand, quick open, images and HTML previews from their own link, a changed image's Before. |
| `commit-history.ts`: `before` + `hasMore`, `HISTORY_REWRITTEN`, `CommitFilesResponse`, `CommitDiffResponse` | Paging without signed cursors; commits load file by file. |
| `connection.ts`: `PairRequest`, `SessionResponse`, errors `NOT_PAIRED`, `DEVICE_REVOKED`, `PAIRING_LINK_EXPIRED`, `PAIRING_LINK_USED` | Device pairing. |
| `live.ts`: `LiveNotice`, `LiveState` | The live channel. |
| Removed: `review-layers.ts`, `artifacts.ts`, `reviewed-files.ts`, prepare/execute, `nextCursor` | Replaced above. |

## Screens and where they live

| Screen | What to try | Code |
| --- | --- | --- |
| Shell | Drag the panel edges. The buttons at both ends of the tab bar (or `Mod+B`, `Alt+Shift+R`) hide the projects and the review sidebar, as in apps/web. Below 1280px the review sidebar slides over from the right; on a phone (below 768px) the projects slide over from the left too, picking a worktree closes them, and only the focused pane of a split shows. A column you hid stays hidden when the window narrows and widens again; slide-overs start closed. | `views/workspace/workspace-view.tsx`, `panel-toggle.tsx`, `use-media-query.ts`, `views/review/review-workspace.tsx` |
| Navigator | Projects and their worktrees, as Git lists them. A worktree is named after its branch. Each worktree has at most one dot, never a count. Green: a review is ready. Hollow green: every layer is reviewed and it is ready to commit. Yellow: the agent replied and you haven't read it. Hover the dot for what it means. A project's ⋯ menu (or right-click) has Rename…, Copy path and Remove from Porcelain; nothing on disk changes. A project the server can't reach is dimmed, shows its path and "Repository can't be reached", and lists no worktrees. Nothing refreshes: new worktrees appear on their own (Prototype → Creates a worktree). | `project-navigator.tsx`, `rename-project-dialog.tsx`, `domain/inventory.ts` |
| Open project | `+` in the navigator. Pick a repository the server found, or Browse for a folder on the server machine; there is no typed path. | `open-project-dialog.tsx` |
| Pairing | Replaces the whole app when this browser isn't paired or was revoked. Run `porcelain pair` on the server machine and paste the link it prints (15 minutes, works once; the code alone works too), then name this browser. Errors say plainly when a link expired or was already used. After a revoke it reads "This browser was revoked on the server". Pairing loads the workspace again. Try Prototype → Revoke this browser; a link containing "expired" or "used" shows those errors. | `pairing-screen.tsx`, `query/connection.ts` |
| Reconnecting pill | While the live connection is down, a small "Reconnecting…" pill shows in the navigator footer. It goes away on reconnect, and the app re-checks what is on screen once. Try Prototype → Drop the connection for 3 s. | `connection-pill.tsx`, `query/live.tsx` |
| Tabs | Everything opens as a tab. Right-click a tab: Pin/Unpin, Open to the side, Close, Close others, Close unpinned. Pinned tabs sit first with a pin instead of ×, and survive Close others and Close unpinned. Middle-click closes an unpinned tab. `Alt+←/→`, `Alt+W`, `Alt+\` (open to the side). | `views/review/document-tabs.tsx`, `use-tab-layout.ts`, `domain/tab-strip.ts` |
| Split view | "Open to the side" splits the centre into two resizable panes, each with its own tabs. Clicking a pane focuses it: the sidebar opens documents there and shortcuts act only on it. Emptying a pane collapses the split. At most two panes; tabs are copied to the other side, not dragged. | `views/review/review-workspace.tsx`, `use-tab-layout.ts` |
| Review | The first tab. With a review the toolbar reads Review, shows how many layers you ticked, and switches Summary / Graph. Summary is the agent's own page, sandboxed and following your theme; its layer links open that layer. Graph is Porcelain's drawing of the agent's diagram: lanes top to bottom, New / Changed / Removed badges, red notes on what was wrong; After / Before switch it, and clicking a box opens its layer. Without a review this tab is Changes: every diff (binary files as cards, images with Before and After), a tick per file, Mark all reviewed (one request), Discard in each file header. `J`/`K` move between files and `R`/`C` tick or comment on the current one: the file you last clicked or focused. | `overview-document.tsx`, `review-diagram.tsx`, `html-frame.tsx` |
| Layer | One behaviour, step by step. The header has the number, title, one-line summary, lanes, Code / Graph and the layer tick (Mark layer reviewed, Reviewed, Review again). Code lists every step: lane, name, what it does, and its code. Changed code is a diff cut to the step's lines (keeping hunk lines within 3 of them); unchanged code is plain, with real line numbers. Each block has Comment, Open file and Open diff; ＋ and drag work as in any diff. Committed steps fold into one row. A step whose code changed since the review says so, with Open file. Graph draws the steps in their lanes; click one to jump to its code. Try Prototype → Adds lines above a step (steps move, the tick holds), Rewrites code inside a step (the warning, the tick reads Review again), Commits the first layer itself (the steps fold). | `layer-document.tsx`, `step-block.tsx`, `patch-focus.ts` |
| Not explained | Changed lines no step explains, file by file, each diff cut to those lines, its header naming them ("Lines 6–10"). Binary files come first, under "Binary files": images show Before and After, anything else says it changed; each has its tick and Comment. Tick files one by one; comment as usual. The subtitle reads "N lines in M files". | `unexplained-document.tsx`, `binary-change.tsx` |
| Change | One file's diff, its tick, Discard, Open file. A changed image shows Before (from the last commit) and After side by side, stacked when narrow; another binary file says it changed. A conflicted file says so and points at the file. | `documents.tsx` → `ChangeDocument`, `binary-change.tsx` |
| File | One header row for every mode: file-type icon, dimmed folder path, file name, then Reader/Source (or Preview/Source), Comment (on the whole file), Edit, Open diff when changed, Copy path. The code sits flush under the toolbar. **Edit** opens Pierre's editor in place for quick changes (a `.env`, a typo); it saves 3 s after the last keystroke, on blur, on tab switch and on ⌘S, sending the fingerprint of the text it opened. If the file changed on disk the save is refused and a bar offers **Copy draft**, **Retry** (save over the new version) and **Reload** (drop the edit). An edit that did not land survives leaving the tab: the file shows "Your edit is not saved" with **Resume edit**. Try Prototype → Edits the open file while editing. **Follows the disk while reading:** when the agent writes the file, the view reloads (a live notice) and "Changed on disk just now" shows for 8 s. HTML **Preview** loads the file from its own signed link in the sandbox. The Reader shows Markdown images: a relative path loads from the repository through its preview link, `http(s)` directly (comment bodies still show images as links). Images open as images; SVG has Preview and Source. A jump to a comment switches the Reader or Preview to Source; a conflicted file opens in Source. Other binary or oversized files show "Not shown"; symlinks and submodules "Not followed". | `documents.tsx` → `FileDocument`, `file-editor.tsx`, `edit-drafts.ts`, `markdown-view.tsx`, `html-frame.tsx` |
| Commit | Its message, author and refs come with its file list, so it opens the same from anywhere; then each diff loads on its own. The code is read-only, but you can comment on it like any diff: the comment carries the commit oid as its `revision` and only shows in that commit. Every file header has a chevron to collapse it, remembered per document; **Collapse all / Expand all**. Merges get a "1st parent / 2nd parent" toggle. The body keeps its line breaks. | `documents.tsx` → `CommitDocument`, `use-collapsed-files.ts` |
| Review surface | Reads Changes until the agent publishes a review, then Review. Review: Summary, the layers (number, title, steps, open threads, tick; "Committed" when all its code is committed), how many you ticked, and Not explained with its count. Changes: every file with its tick, and Mark all. A file Git lists as both staged and unstaged is one row, with a quiet "staged" note, and its diff runs from the last commit to disk. A conflicted file has no tick, reads "conflicted" and opens the file. Comments: one card per thread. New comment starts a general thread about the whole worktree. Show resolved brings back closed ones. Bodies are Markdown (no raw HTML; images show as links). Each card says where its code is now, or Outdated (with the code as it was), or Committed. A yellow mark flags agent replies you haven't read; it clears after about a second on screen, or when you reveal or reply. | `review-index.tsx`, `comments-list.tsx`, `thread-card.tsx` |
| Files surface | Folders load when you open them. Ignored files and folders (`.env`, `dist/`) are dimmed; an ignored folder lists its contents only when opened. Symlinks and submodules are single rows with their own icon and a note ("→ docs/decisions/", "submodule"); they are never followed. A closed folder still shows a dot when something inside changed. A folder holding only one folder opens that one too ("server / src"). Your edits and the agent's changes update the tree without closing what you opened. At the top: Go to file…, New file, New folder, and the hidden-files toggle. Right-click for Open, Rename, Hide, Copy path, Delete; new items are named in place (Escape cancels); drag a row onto a folder to move it. Delete is red, asks first and moves to the trash. Hiding is per project and only affects Files. The open file is always shown in the tree: its folders open, it is selected and scrolled into view, following the active tab. | `files-surface.tsx`, `file-icons.tsx`, `query/files.ts` |
| Quick open | Mod+P, or Go to file… in Files. Type part of a name or path; the server returns the best matches first (ignored files are only in the tree). Enter opens it as a tab. | `quick-open.tsx`, `quick-open-store.ts` |
| History surface | The current branch, newest first, with its graph; the label on top says what it follows. Older commits load as you scroll: each page is "the commits before the last one shown", so new commits on top never shift the pages below. When the branch moves, new commits appear on top on their own. If a rebase removed the commit a page starts from, the list starts again from the top with a note. The mock serves 3 commits per page. | `history-surface.tsx`, `domain/history.ts`, `query/review.ts` |
| Git button | At the right end of the tab bar. Icon only; the tooltip says what a click will do. The main half does the likely next thing: Commit when files changed, else Pull when behind, else Push when ahead; a diverged branch says so instead. The arrow opens the menu: the branch with "n ahead · n behind", then Commit…, Amend last commit…, Push, Pull, Fetch, Stash changes, Pop stash, Switch branch…, Create branch…. A blocked item stays in place, dimmed, with the reason under it. Fetch, Pull and Push run at once; a small panel under the button shows Git's progress lines, and a toast gives the result. Stash changes and Pop stash ask first, showing the files or the stash. Every action sends what you saw; if something moved meanwhile it does not run, and the toast offers Look again. **Conflicts:** when a pull stops on one, Changes lists the conflicted files above the diffs (no tick: Open file) with what the merge staged below, and the button turns amber and a panel says what happened, lists the conflicted files (click to open), and how to finish (merge: remove the markers here or ask the agent, then commit; rebase: the agent or a terminal continues it) or back out, with `git merge --abort` / `git rebase --abort` to copy. The menu keeps one line at the top for it. **Diverged branch:** Pull only fast-forwards by default, so the menu offers Pull with merge and Pull with rebase under it, for that pull only. Try Prototype → Next pull stops on a conflict, then Pull with merge (or rebase); Agent resolves the conflict; Abort it in a terminal. | `git-button.tsx`, `conflict-guidance.tsx`, `git-feedback.ts`, `look-again.tsx`, `domain/git-action.ts`, `query/git-actions.ts` |
| Commit dialog | Three tabs: Single commit, Amend last, Use groups. Note: "Committed steps fold away in the review and show up in History." The list is what you saw when the dialog opened; a commit sends exactly those files. If one changed meanwhile nothing is committed: the list refreshes, marks what moved, and a note says so. The message is optional; Generate with AI writes one, with the model picked beside it from what the server's agent CLIs can run; closing the dialog stops a draft in progress. With no agent CLI on the server, drafting is hidden and the message is required; if the models fail to load, Retry. During a merge the dialog says the commit finishes it, keeps everything the merge staged and every conflicted file in (Git refuses a partial commit then), and suggests "Merge … into …"; a commit Git refuses (markers left) says why inside the dialog. Use groups proposes commits in order; you edit them, then commit them one by one. Amend last shows the commit it replaces, keeps its message and lets you add files; if that commit is already pushed, a red warning says amending rewrites pushed history and Porcelain does not force push. | `commit-dialog.tsx` |
| Branches | Switch branch lists branches with a search box; the current one is marked; a branch open in another worktree is dimmed with "Checked out in another worktree"; if Git still refuses, its own words are shown. Create branch asks for a name, with "Switch to it" ticked; Git's errors (invalid or taken name) appear under the field. | `branch-dialog.tsx` |
| Discard | On a file (a change's toolbar, a file header in Changes). Red, and asks first: "Discard changes to X? You can restore them." The toast "Discarded X" has Restore, which brings the old version back. | `discard.tsx` |
| Interrupted action | If the server restarted during a Git action, a slim bar at the top says what was cut off and what Git reports now. Dismiss hides it; nothing is locked. Try Prototype → Restart the server during a push. | `interrupted-action.tsx` |
| Settings | Theme, diff layout, line wrapping, markdown/HTML defaults, pull strategy (Fast-forward only, the default as in Git / Merge / Rebase), commit model (grouped Claude / Codex, as the server reports them; loading, "None on the server" with how to fix it, and Retry on errors; Prototype → Server has agent CLIs). **Agents**: they connect with `porcelain mcp` through the server machine's local socket, no token; Copy buttons for the Claude Code command and the Codex config. **This device**: its name, when it was paired, the server's name and version; Forget this browser is red, asks first, and brings back the pairing screen. | `settings-dialog.tsx`, `preferences.tsx` |
| Shortcuts | `Mod+/` or the keyboard button. `Mod+P` goes to a file. `Alt+1`–`Alt+3` switch Review / Files / History. `C` comments on the focused file. `Mod+Enter` posts a comment or commits. Plain keys don't fire while you type; Mod shortcuts do. | `shortcuts-dialog.tsx`, `shortcuts.ts` |

## How commenting works

Comments are a conversation between the reviewer and the agent, anchored to code or
to the whole worktree.

1. **The agent opens most threads**: when it builds the review, on code worth a
   closer look, and later when the reviewer asks it in its own session how something
   was done. Agent-opened threads start with the agent's sparkle.
2. **The reviewer replies, or starts a thread.** Hover a line: its number becomes a
   ＋. Click it for one line, drag it for a block, or select line numbers first. This
   works in every diff and in every step's code. A selection must stay on one numbering:
   in a split diff one side; in a unified one, removed lines or added and unchanged ones.
   A mixed one is refused with a toast saying which.
   "Comment" in a file header comments on the whole file (images and other binary
   files too); **New comment** in the Comments list starts a general thread.
3. **Posting saves at once**, with ids picked by the app, so a retry after a dropped
   response never posts twice. There are no drafts and no rounds.
4. **Comments follow the code.** The server re-finds the commented lines on every
   read, like review steps: moved code takes its threads along; code that is gone
   makes the thread **Outdated**, showing the lines as they were; committed code
   marks it **Committed**. Open threads never disappear or resolve on their own.
5. **Nothing is delivered to the agent.** A thread whose last message is the
   reviewer's reads "Waiting for the agent" until the reviewer tells the agent to read
   its comments; the agent's `list_comments` returns exactly those.
6. **Seen.** Each thread remembers how far the reviewer has read, on every device. An
   agent reply after that turns the worktree's dot yellow until the card has been on
   screen for a second, revealed, or replied to.
7. **Prototype panel:** "Reads comments and replies" answers every open thread where
   you spoke last (the dot turns yellow); "Explains how something was done" opens up to
   three threads on added code, in review order.

Commits take comments too: `CodeDocument` gets `revision={oid}` and stamps it on every
anchor it opens; worktree views never show commit comments and a commit shows only
its own. On a merge, a comment on the diff against the 2nd parent also records
`parent: 2`, shows only in that diff, and reopens it when you jump to it. Anchors are `CommentAnchor`s; placement is `domain/comments.ts`
`anchorPlacement` (under the current last line, or above the file).

## URL and tabs

- `?worktree=<id>` selects the worktree. Missing or stale → the first worktree with an
  unseen agent reply, else the first with a review ready.
- `?surface=changes|files|history` picks the right surface (`changes` is labelled Changes,
  or Review once the agent published a review).
- `?entry=` is the **active tab** of the left (or only) pane: `review`, `layer:<id>`,
  `unexplained`, `change:<path>`, `file:<path>`, `commit:<oid>` (`domain/documents.ts`).
  The old `handoff` reads as `review`; `artifact:…` and `git:…` parse to null and are
  dropped from the URL and from stored tabs.
- `?side=` is the active tab of the right pane while the centre is split; same format.
- Which tabs are open, and which are pinned, is per worktree in localStorage
  (`views/review/use-tab-layout.ts`); the ordering rules are pure functions in
  `domain/tab-strip.ts`.
- Left out of v1 on purpose: close to the left/right, close all, dragging tabs between
  panes, more than two panes.
- **Differs from apps/web:** tabs span surfaces, so `entry` is kept when the surface changes.

## Pierre usage notes

- All code goes through one component, `views/review/code-document.tsx`.
- Diffs arrive as unified patch text (live: `GitDiffResponse.content.patch`,
  `CommitChange.patch.text`) and are parsed with `parsePatchFiles`
  (`views/review/diff-entries.ts`). The mock produces real patches with jsdiff.
- `CodeView` options used: `stickyHeaders`, `enableLineSelection`,
  `enableGutterUtility` + `onGutterUtilityClick` (drag-to-select), `lineHoverHighlight: 'number'`,
  `diffStyle`, `overflow`, `unsafeCSS`, `layout`, themes `pierre-light`/`pierre-dark`;
  for a single file under its own toolbar also `disableFileHeader` and `itemMetrics.paddingTop: 0`.
- The theme writes its background inside the shadow root, so a page-level variable
  loses; `SURFACE_CSS` (`views/review/pierre.ts`) overrides it on `:host` through `unsafeCSS`.
- Slots used: `renderAnnotation` (threads, composer), `renderHeaderPrefix`
  (reviewed tick), `renderHeaderFilenameSuffix` (agent note), `renderHeaderMetadata`
  (stale badge, Comment), `renderCodeViewHeader` (commit header).
- Pierre has no slot between items and every file header is a fixed 44px (`itemMetrics.diffHeaderHeight`); `renderCustomHeader` replaces the header of every item. So nothing taller than a header can sit between two files of one `CodeView`; that is why layer pages use one Pierre component per step instead.
- Every item has a `version` derived from its notes and state; CodeView only
  re-renders items whose version moved.
- Both packages render into shadow roots. Slotted React content is styled with
  Tailwind normally, but inherits the monospace font — `.diff-annotation` in
  `pierre.css` resets it. The tree is themed with `--trees-*-override` variables.
- Markdown fenced code renders with Pierre `File` (`markdown-view.tsx`), so tokens
  are text, not HTML — matching the repo rule.
- The HTML frame loads a link (the summary's, or a file's preview link) with
  `sandbox="allow-scripts allow-forms allow-popups allow-modals"` and no same-origin;
  it fills its box and scrolls inside it. (Don't auto-size it: `scrollHeight` never
  shrinks below the frame, so it grows and keeps blank space.) The summary's only
  message back is `{ source: 'porcelain-summary', openLayer }`, accepted only from
  that frame's `contentWindow`.
- **Layer pages** render each step with its own non-virtualized `FileDiff` inside a
  `ScrollArea`, since a step's explanation is taller than a Pierre header can be. A
  non-virtualized `FileDiff` handed a new diff kept showing the first one even though
  its `cacheKey` changed; `step-block.tsx` keys it on `cacheKey` to force a remount.
- **Diagrams** use `@xyflow/react` (`review-diagram.tsx`, ported from the server
  lab): lanes as horizontal bands, laid out again once React Flow has measured the
  boxes; an arrow that would cross a box runs down the outer side. The wheel pans;
  zoom with the buttons or a pinch.

## Porting checklist for apps/web

The server comes first: follow the Notion page "Server rebuild: build order". Then:

1. Add the contracts above (Zod) as the server gains them; the prototype's
   `src/contracts` is the target shape.
2. Implement `api/*/live.ts` for each port in `src/api/api.ts`, including `live`
   (one WebSocket) and `connection` (pairing).
3. Dependencies: see `HANDOFF.md` → Libraries.
4. Port `domain/*` with specs (`documents`, `review`, `comments`, `history`,
   `git-action`, `inventory` are pure and easy to test).
5. Port `query/*`: keys (`worktree` → resource), `live.tsx`, the operation and
   connection stores, and the hooks. No `refetchOnWindowFocus`, no polling.
6. Replace `validateSearch` to accept the new `entry` kinds and keep `entry` across surfaces.
7. Port views: `code-document.tsx` first, then the documents (overview, layer, not
   explained, change, file, commit), the surfaces, the navigator, pairing and dialogs.
8. Drop `development/prototype-controls.tsx` and `api/mock-*`.

## Known gaps

- Discarding one hunk exists in the contract, the mock and `DiscardButton`, but no diff
  view offers it yet: Pierre's hunk separators need a slot for it.
- Conflicted and omitted diffs show a note, not a diff. Binary files inside a commit
  are left out of its document (Changes and Not explained show them).
- No hunk expansion: patches carry context only.
- J/K/R/C shortcuts do not work on layer pages (their blocks are separate components).
- Layer ticks are shown in the sidebar but set from the layer page.
- History's "rewritten" note rarely shows: when the live channel says the branch moved,
  TanStack refetches the pages from the fresh first page, so a vanished `before` is only
  hit in a race or after a missed notice (Prototype: Drop the connection, then Rebases
  its branch, then scroll History).
- The server must serve the app at `/pair` for pairing links; the pairing screen reads
  `#code=` from any path.
- No find-in-file. A file's own history (later).
- Sidebar tab labels clip by ~2px at the 260px minimum width.
- There is no shadcn checkbox in `components/ui`; the branch dialog uses Base UI's directly.
