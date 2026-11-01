---
route: /
selectors:
  - "Load older commits"
  - "Timeline reading area"
  - "Review"
  - "Worktree review"
  - "Files"
  - "Timeline"
  - "Timeline of "
  - "Renamed from"
  - "Start of this file’s history."
  - "Show timeline"
tests:
  - apps/web/spec/integration/files-timeline.test.tsx
  - apps/web/spec/integration/reviews-reopen-document.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - GET /api/worktrees/:worktreeId/file-commits
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
---

# files.timeline

A file's timeline lists the commits that changed it, newest first. It follows the file back across a rename and names the path it had then. Opening a commit shows that commit with the file's diff.

## How to get to it (user POV)

- Open a file document (Review → tab Files → click a file row), then button "Timeline" in its toolbar. Below 720 px the label is visually hidden, but the button keeps the name "Timeline".
- Review → tab Files → right-click a file row → menuitem "Show timeline".
- Review → tab Changes → right-click a change row → "Show timeline".

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

Before a full page load. This makes three commits touching the file: the initial commit, a modification, and a rename to `guide.md`.

```sh
git -C "$REPO" -c user.name=Verifier -c user.email=verify@example.invalid commit -am "Explain the change to review"
git -C "$REPO" mv README.md guide.md
git -C "$REPO" -c user.name=Verifier -c user.email=verify@example.invalid commit -m "Move the readme to the guide"
git -C "$REPO" log --follow --format=%s -- guide.md
```

The last line prints `Move the readme to the guide`, `Explain the change to review`, `Initial commit`. The working tree is now clean.

### 1. The timeline follows the rename and opens a commit

1. Navigate to `/`
   Expect: button "Review".
2. Click button `Review`
   Expect: dialog "Worktree review".
3. Click tab `Files`
   Expect: treeitem "guide.md" in the tree of region "All files", and no treeitem "README.md".
4. Click treeitem `guide.md`
   Expect: the dialog is gone; heading "guide.md" [level=1]; button "Timeline"; title "guide.md — repository".
5. Click button `Timeline`
   Expect: title "Timeline of guide.md — repository"; list "Timeline of guide.md" holding, in order, buttons beginning "Move the readme to the guide", "Explain the change to review" and "Initial commit", with the texts "Renamed from README.md", "Modified as README.md" and "Added as README.md", then "Start of this file’s history.".
6. Click button `/^Explain the change to review/`
   Expect: heading "Explain the change to review" [level=2] and the text "A change to review." in the README diff. The title is the commit's 7-character id, from `git -C "$REPO" rev-parse --short=7 HEAD~1`, followed by " — repository".

### 2. The tree menu opens the timeline

7. Click button `Review`
   Expect: dialog "Worktree review" on tab "Files".
8. Right-click treeitem `guide.md`
   Expect: menuitem "Show timeline".
9. Click menuitem `Show timeline`
   Expect: the dialog is gone; list "Timeline of guide.md" with a button beginning "Move the readme to the guide".
10. Inspect HTTP traffic
    Expect: `GET /api/worktrees/<worktreeId>/file-commits?path=guide.md...`, `GET /api/worktrees/<worktreeId>/commits/<oid>/files` and `POST /api/worktrees/<worktreeId>/commits/<oid>/diffs`, all 2xx.

### Observable proof

Compare rows/old paths with `git -C "$REPO" log --follow -- guide.md`.

Automated coverage: `files-timeline.test.tsx`, `reviews-reopen-document.test.tsx`.

### Older history and return

Create more than 100 commits touching one file, including a rename. Load older commits and compare the complete OID/path sequence with Git. Open an older row, then return through its existing timeline tab: loaded rows, selected commit and reading position remain. Fail a later page and Retry; keep confirmed rows and use the same continuation. A rewritten checkout replaces the old page window with an explicit restart; shallow history names its boundary. The shared query rereads current data to the retained depth when the timeline is reopened, without retaining hidden live subscriptions.

## Gotchas

- Do the git setup before a full reload of `/`. The timeline is not refetched on focus, so commits made after it loads show only after a full reload of `/`.
- After the setup README.md no longer exists, and the working tree is clean, so the Changes tab is empty. Clicking guide.md opens it as a file document, which is the one with the "Timeline" button. A changed file opens as a diff instead.
- A commit row's name starts with its subject and continues with the short id, author and age, so address it with `/^<subject>/`.
Each opened document closes it.
- The timeline is a distinct document: its tab is named `Timeline of guide.md`, while the file tab is `guide.md`. Repeating "Timeline" or "Show timeline" focuses the existing timeline tab, including in the other pane, and adds no tab.
