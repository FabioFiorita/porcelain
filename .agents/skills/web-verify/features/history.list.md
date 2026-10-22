---
route: /
selectors:
  - "Review"
  - "History"
  - "Merge commit"
  - "Commit graph"
  - "Open graph"
  - "Start of history."
tests:
  - apps/web/spec/integration/history-list.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits
---

# history.list

The History list gives each commit one row with its message, 7-character id, author, relative age and ref chips, without a graph beside it (the graph is a separate document behind "Open graph"), and marks a merge commit with a merge icon.

## How to get to it (user POV)

- Phone width: button "Review" → sheet "Worktree review" → tab "History".
- Desktop width (1280 px and wider): tab "History" in the review sidebar ("Review sidebar").
- Shortcut `Alt+3` selects the History surface (the sheet still needs "Review" at phone width); URL `?surface=history`.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

A long subject on main and a branch merged back with a merge commit:

```sh
git -C "$REPO" switch -c topic
printf '# Topic\n' > "$REPO/topic.md"
git -C "$REPO" add --all
git -C "$REPO" commit -m "Add the topic notes"
git -C "$REPO" switch main
printf '# Steps\n' > "$REPO/steps.md"
git -C "$REPO" add --all
git -C "$REPO" commit -m "Describe every step the reviewer takes before approving the change"
git -C "$REPO" merge --no-ff --no-edit topic
git -C "$REPO" log -1 --format='%s %p'
```

The last line prints `Merge branch 'topic'` and two parent ids.

1. Click button `Review`
   Expect: dialog "Worktree review" with tabs "Files", "Changes", "History".
2. Click tab `History`
   Look for, in the snapshot of the sheet:
   - four row buttons, the merge first (the two commits made in the same second may come in either order, a live run showed "Add the topic notes" above "Describe every step…"): one starting "Merge commit Merge branch 'topic'" that holds img "Merge commit" and the chip "main"; one starting "Describe every step the reviewer takes before approving the change" with that whole subject as text and no img "Merge commit"; one starting "Add the topic notes" with the chip "topic"; one starting "Initial commit";
   - each row's name goes on with the 7-character id, "Porcelain Development" and the age;
   - button "Open graph" in the header beside the branch name; no list "Commit graph"; text "Start of history." after the last row.

### Observable proof

Compare four subjects/order/short IDs/ref chips with `git -C "$REPO" log --format="%h %s %D" --decorate-refs="refs/*"`.

Automated coverage: `history-list.test.tsx`.

## Gotchas

- Match row names by anchored regex; merge starts with Merge commit. Full long subjects remain accessible despite visual truncation.
- Setup leaves branch/merge/files; reset before another map.
