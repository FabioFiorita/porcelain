# files.timeline

## What it is

A file's timeline lists the commits that changed it, newest first. It follows the file back across a rename and names the path it had then. Opening a commit shows that commit with the file's diff.

## How a user reaches it

- Open a file document (Review → tab Files → click a file row), then button "Timeline" in its toolbar. Below 720 px the label is visually hidden, but the button keeps the name "Timeline".
- Review → tab Files → right-click a file row → menuitem "Show timeline".
- Review → tab Changes → right-click a change row → "Show timeline".

## Driving it

Start with `$C start`. Set `REPO` to the path it prints after `repository`.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Setup

Before a page load. This makes three commits touching the file: the initial commit, a modification, and a rename to `guide.md`.

```sh
git -C "$REPO" -c user.name=Verifier -c user.email=verify@example.invalid commit -am "Explain the change to review"
git -C "$REPO" mv README.md guide.md
git -C "$REPO" -c user.name=Verifier -c user.email=verify@example.invalid commit -m "Move the readme to the guide"
git -C "$REPO" log --follow --format=%s -- guide.md
```

The last line prints `Move the readme to the guide`, `Explain the change to review`, `Initial commit`. The working tree is now clean.

### 1. The timeline follows the rename and opens a commit

1. Open `/` on the instance web URL
   Look for: button "Review".
2. Click the button named 'Review'
   Look for: dialog "Worktree review".
3. Click the tab named 'Files'
   Look for: treeitem "guide.md" in the tree of region "All files", and no treeitem "README.md".
4. Click the tree item named 'guide.md'
   Look for: the dialog is gone; heading "guide.md" [level=1]; button "Timeline"; Page Title "guide.md — repository".
5. Click the button named 'Timeline'
   Look for: Page Title "Timeline of guide.md — repository"; list "Timeline of guide.md" holding, in order, buttons beginning "Move the readme to the guide", "Explain the change to review" and "Initial commit", with the texts "Renamed from README.md", "Modified as README.md" and "Added as README.md", then "Start of this file’s history.".
6. Click the button whose name starts with 'Explain the change to review'
   Look for: heading "Explain the change to review" [level=2] and the text "A change to review." in the README diff. The Page Title is the commit's 7-character id, from `git -C "$REPO" rev-parse --short=7 HEAD~1`, followed by " — repository".

### 2. The tree menu opens the timeline

7. Click the button named 'Review'
   Look for: dialog "Worktree review" on tab "Files".
8. Right-click the tree item named 'guide.md'
   Look for: menuitem "Show timeline".
9. Click the menu item named 'Show timeline'
   Look for: the dialog is gone; list "Timeline of guide.md" with a button beginning "Move the readme to the guide".
10. Inspect browser network evidence
    Look for: `GET /api/worktrees/<worktreeId>/file-commits?path=guide.md...`, `GET /api/worktrees/<worktreeId>/commits/<oid>/files` and `POST /api/worktrees/<worktreeId>/commits/<oid>/diffs`, all 2xx.

## What proves it works

- The three rows match `git log --follow -- guide.md`, and the oldest two name the old path `README.md`. That shows the server followed the rename.
- `apps/web/spec/integration/files-timeline.test.tsx` makes the same commits. The first test opens guide.md, then Timeline, and asserts list "Timeline of guide.md" shows "Renamed from README.md", "Modified as README.md", "Added as README.md" and "Start of this file’s history.". It then asserts that opening "Explain the change to review" shows that heading and "A change to review.". The second test asserts that the tree menu's "Show timeline" shows the button "Move the readme to the guide…".

## Gotchas

- Do the git setup before loading `/`. The timeline is not refetched on focus, so commits made after it loads show only after loading `/`.
- After the setup README.md no longer exists, and the working tree is clean, so the Changes tab is empty. Clicking guide.md opens it as a file document, which is the one with the "Timeline" button. A changed file opens as a diff instead.
- A commit row's name starts with its subject and continues with the short id, author and age, so choose the row whose name starts with the subject.
- At phone width the tree lives in the sheet behind button "Review". Each opened document closes it.
- The timeline document tab is named after the file, like the file document tab: both read "guide.md Close guide.md", so distinguish their documents once both are open; move between them with the buttons inside the documents ("Timeline") or the Page URL (`entry=timeline%3Aguide.md`, `entry=file%3Aguide.md`).
