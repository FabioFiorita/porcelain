---
route: /
selectors:
  - "Review"
  - "Changes"
  - "Toggle Sidebar"
  - "Settings"
  - "Spec files"
  - "Back"
tests:
  - apps/web/spec/e2e/reviews-spec-files.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/changes
---

# reviews.spec-files

## What it is

The Settings switch "Spec files" (Appearance → Code) groups changed spec and test files after the other changed files and starts them collapsed, both in the Changes list of the review sidebar and in the Changes document. Off (the default), files keep the server's order.

A spec file is one named `*.spec.*`, `*.test.*`, `*.browser.*`, `*_test.*`, `*_spec.*`, `test_*.py`, `*Test`/`*Tests`/`*Spec` (.java, .kt, .cs, .swift, .scala), or any file under a `spec`, `specs`, `__tests__` or `tests` folder (`apps/web/src/features/reviews/rules/spec-paths.ts`).

## How a user reaches it

- Sidebar (phone width: `Toggle Sidebar` first) → `Settings` → Appearance section → switch `Spec files`.
- `Alt+Shift+S` opens Settings on Appearance (ignored while focus is in a text field).
- Route `/settings/appearance`.

## Driving it

`$C start`; pair your browser using the card’s pairing-link command, then `REPO=<connection.json fixtures.repositoryPath>`.

### Setup

```sh
printf 'export const spec = true;\n' > "$REPO/search.spec.ts"
printf 'export const search = true;\n' > "$REPO/search.ts"
```

### Steps

1. Navigate to `/` on the card’s web URL (full page load)
   Look for: paragraph "3 files" in region "Review content" (allow a moment for the watcher; repeat Navigate to `/` on the card’s web URL (full page load) until it shows).
2. Click button named `Review`, then click tab named `Changes`
   Look for: in the review sheet, below "All changes", the file rows in this order: button "README.md · unstaged", button "search.spec.ts · untracked", button "search.ts · untracked" (the text after "·" is the change scope).
3. Press `Escape`
   Look for: the review sheet closes; button "Toggle Sidebar" is reachable.
4. Click button named `Toggle Sidebar`, then click button named `Settings`
   Look for: Page URL `/settings/appearance`; switch "Spec files" not checked; text "Group them after the other files and start them collapsed."
5. Click switch named `Spec files`
   Look for: switch "Spec files" is checked.
6. Click button named `Back`
   Look for: region "Review content" shows again; in it the file sections run README.md, search.ts, then search.spec.ts, with search.spec.ts collapsed.
7. Click button named `Review`
   Look for: the Changes rows now in the order "README.md · unstaged", "search.ts · untracked", "search.spec.ts · untracked".
8. Reset: Press `Escape`, click button named `Toggle Sidebar`, click button named `Settings`, click switch named `Spec files`, click button named `Back`
   Look for: switch "Spec files" unchecked before Back; the rows back in the order of step 2.

## What proves it works

- The order in step 2 versus step 7 is the promise. The preference is kept by this browser (Web Storage `porcelain.prototype.preferences`, key `collapseSpecs`), not by the server: Navigate to `/` on the card’s web URL (full page load) after step 6 keeps the grouped order, and no request is sent when the switch flips (Inspect HTTP requests and responses shows only reads such as `GET /api/worktrees/<worktreeId>/changes`).
- `apps/web/spec/e2e/reviews-spec-files.e2e.ts` (web project, 414x896): with README.md, search.spec.ts and search.ts changed, the sidebar rows read README.md, search.spec.ts, search.ts; after turning on "Spec files" in Settings and going Back, they read README.md, search.ts, search.spec.ts.

## Gotchas

- The setting persists in the browser for the rest of the instance and changes the order every later feature sees; run the reset in step 8.
- The two setup files stay on disk and in every later feature's Changes list; remove them with `rm "$REPO/search.spec.ts" "$REPO/search.ts"` when done.
- Phone width: the review sidebar is a sheet behind "Review" and covers the page; press `Escape` to close it before `Toggle Sidebar`. "Changes" exactly names the sidebar tab; the document tab's name is "Changes Close Changes", so the exact address stays unique.
