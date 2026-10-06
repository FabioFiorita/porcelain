# app.tab-title

## What it is

The browser tab (document title) names what is shown: the open document, or the surface when no document is open, followed by ` — <project name>`; Settings and the empty workspace have their own titles.

The exact strings (`apps/web/src/features/reviews/rules/documents.ts`, `apps/web/src/app/connected-workspace.tsx`, `apps/web/src/app/settings-page.tsx`), with `P` = project name ("repository" in the disposable instance):

- Changes document (the "All changes"/"Review summary" handoff tab): `Changes — P`
- a changed file or a file opened from Files: `<file name> — P` (the last path segment, e.g. `README.md — P`)
- a commit: `<first 7 characters of the oid> — P`
- branch changes: `Branch changes — P`; commit graph: `Commit graph — P`; file timeline: `Timeline of <file name> — P`
- a published review layer: `Review — P`; Not explained: `Not explained — P`; proof: `Proof — P`
- no document open: the surface, `Changes — P`, `Files — P` or `History — P`
- a worktree on a remote computer, or on this computer once it has a custom name: the above followed by ` · <computer name>`
- Settings: `Settings` (or `Settings · <computer name>` when this computer has a custom name)
- no worktree selected (empty workspace), the pairing page and the initial HTML: `Porcelain`

## How a user reaches it

- It follows every navigation in the workspace: opening a document tab (Changes list, Files tree, History list), switching tabs, switching surface with the sidebar tabs or `Alt+1` / `Alt+2` / `Alt+3`, opening Settings.
- Read the browser document title at each step below.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`, then `REPO=<the repository path start printed>`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

None before step 1. Step 5 commits on disk; do it only after step 4, because "Open file" exists only for a file with uncommitted changes.

### Steps

1. Open `/` on the instance web URL
   Look for: Page Title "Changes — repository".
2. Click the button named 'Review', then click the tab named 'Files'
   Look for: the review sheet with tab "Files" selected and treeitem "README.md"; Page Title "Files — repository" (with the Changes document selected, the title follows the sidebar surface).
3. Right-click the tree item named 'README.md'
   Look for: menu with menuitems "Open diff" and "Open file".
4. Click the menu item named 'Open file'
   Look for: the sheet closes; a document tab for README.md is selected; Page Title "README.md — repository".
5. On disk: `git -C "$REPO" add -A && git -C "$REPO" commit -qm "Name the tab after the commit" && git -C "$REPO" rev-parse --short=7 HEAD`
   Look for: a 7-character oid printed; call it `OID`.
6. Click the button named 'Review', then click the tab named 'History'
   Look for: a button whose name starts with "Name the tab after the commit" above one starting with "Initial commit" (allow a moment for the watcher; inspect the current page again until it shows).
7. Click the button whose name starts with 'Name the tab after the commit'
   Look for: Page Title "`OID` — repository".
8. Click the button named 'Toggle Sidebar', then click the button named 'Settings'
   Look for: Page URL `/settings/appearance`; Page Title "Settings".
9. Click the button named 'Back'
   Look for: Page Title "`OID` — repository" again.

## What proves it works

- Steps 1, 4, 7, 8 and 9 each show the title stated above; reloading the current page preserves that title, since the open document lives in the URL's `entry` parameter.
- `apps/web/spec/e2e/app-tab-title.e2e.ts` (web project, 414x896): the title is "Changes — <project>" on load, "README.md — <project>" after Files → README.md → Open file, and "<oid 7> — <project>" after committing and opening that commit from History.

## Gotchas

- Order matters: after the commit README.md has no changes, so its tree menu offers "Open" instead of "Open file".
- The separator is an em dash with spaces (` — `), and the computer-name suffix uses ` · `.
- Switching the sidebar surface does not change the title while a file or commit document is selected (step 6 keeps "README.md — repository"); with the Changes document selected the title follows the surface (`Files — P`, `History — P`).
- Phone width: the review sidebar is a sheet behind the "Review" button; opening a document closes it, so click "Review" again before the next sidebar step.
- In an instance where another feature committed, renamed the project or gave this computer a custom name, the strings change accordingly (`Settings · <name>`, ` · <name>` suffix).
