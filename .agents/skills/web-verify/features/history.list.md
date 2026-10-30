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

The History list gives each commit one row with its message, 7-character id, author, relative age and ref chips, drawn on its graph line in a list named "Commits" (the full graph is a separate document behind "Open graph" at the bottom of the panel), and marks a merge commit with a merge icon.

## How to get to it (user POV)

- Phone width: button "Review" → sheet "Worktree review" → tab "History".
- Desktop width (1280 px and wider): button "History" in the rail (navigation "Side panel"); the panel "Review sidebar" opens on it.
- Shortcut `Alt+3` opens History (the docked panel on desktop, the sheet at phone width); URL `?surface=history`.

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
   - region "Branch" naming the branch above the list; list "Commits"; no list "Commit graph"; text "Start of history." after the last row; button "Open graph" at the bottom of the panel.

### Ref identity and colliding names

1. In the disposable repository, tag the current commit with the checked-out branch's name, then make another commit on that branch.
2. Open History and Graph. Expect: the branch chip on the newest commit uses the current-branch colour; the same-named tag on the older commit stays neutral. A remote branch with the same display name also stays neutral.
3. Add a local branch and tag with the same name on one commit. Expect: tag chips have a small tag icon, including in the overflow popover at phone width; branch chips have no tag icon. Both chips remain reachable; only a local branch matching the full checked-out branch ref is current.
4. Check out a commit detached. Expect: Graph keeps its separate HEAD marker and no branch or tag receives current-branch colour. Internal Porcelain refs stay hidden.

### Observable proof

Compare four subjects/order/short IDs/ref chips with `git -C "$REPO" log --format="%h %s %D" --decorate-refs="refs/*"`.

Automated coverage: `history-list.test.tsx`.

## Gotchas

- Match row names by anchored regex; merge starts with Merge commit. Full long subjects remain accessible despite visual truncation.
- Setup leaves branch/merge/files; reset before another map.
