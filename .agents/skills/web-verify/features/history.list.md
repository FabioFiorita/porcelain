# history.list

## What it is

The History list gives each commit one row with its message, 7-character id, author, relative age and ref chips, without a graph beside it (the graph is a separate document behind "Open graph"), and marks a merge commit with a merge icon.

## How a user reaches it

- Phone width: button "Review" → sheet "Worktree review" → tab "History".
- Desktop width (1280 px and wider): tab "History" in the review sidebar ("Review sidebar").
- Shortcut `Alt+3` selects the History surface (the sheet still needs "Review" at phone width); URL `?surface=history`.

## Driving it

Start with `$C start`. `REPO` is the repository path `start` printed.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

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

1. Click the button named 'Review'
   Look for: dialog "Worktree review" with tabs "Changes", "Files", "History".
2. Click the tab named 'History'
   Look for, in the snapshot of the sheet:
   - four row buttons, the merge first (the two commits made in the same second may come in either order, a live run showed "Add the topic notes" above "Describe every step…"): one starting "Merge commit Merge branch 'topic'" that holds img "Merge commit" and the chip "main"; one starting "Describe every step the reviewer takes before approving the change" with that whole subject as text and no img "Merge commit"; one starting "Add the topic notes" with the chip "topic"; one starting "Initial commit";
   - each row's name goes on with the 7-character id, "Porcelain Development" and the age;
   - button "Open graph" in the header beside the branch name; no list "Commit graph"; text "Start of history." after the last row.

## What proves it works

- The snapshot after step 2 matches `git -C "$REPO" log --format='%h %s %D' --decorate-refs='refs/*'`: the same four subjects in the same order, the same short ids and chips.
- `apps/web/spec/integration/history-list.test.tsx`: in the review sidebar the merge row holds img "Merge commit"; the long subject is shown whole and its row has no merge icon; the "Add the topic notes" row shows the chip "topic"; no list "Commit graph" is rendered and button "Open graph" is.

## Gotchas

- Rows are buttons named by their whole text; choose the row whose name starts with "Add the topic notes". The merge row's name begins with the img label "Merge commit".
- A long subject is truncated visually but its full text is in the accessibility tree; compare names in the snapshot, not the screenshot.
- The setup leaves the branch, merge and files in place for the rest of the instance.
