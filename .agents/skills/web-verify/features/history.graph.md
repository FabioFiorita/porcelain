---
route: /
selectors:
  - "Review"
  - "History"
  - "Open graph"
  - "Commit graph"
  - "Merge commit"
  - "history-graph"
tests:
  - apps/web/spec/e2e/history-graph.e2e.ts
api:
  - GET /api/worktrees/:worktreeId/commits
  - GET /api/worktrees/:worktreeId/commits/:oid/files
---

# history.graph

## What it is

Open graph opens the commit graph of the checked-out branch as a document tab ("Graph") with its lanes, merges and ref chips; the tab comes back after a reload, and clicking a commit in it opens that commit's document.

## How a user reaches it

- Review → History → button "Open graph" (in the History header, beside the branch name; shown once the branch has commits).
- The tab "Graph" in the "Open documents" tablist once opened; URL `entry=graph` on the workspace route.

## Driving it

Start with `$C start`. `REPO` is the repository path `start` printed.

### Setup

A branch merged back with a merge commit:

```sh
git -C "$REPO" switch -c topic
printf '# Topic\n' > "$REPO/topic.md"
git -C "$REPO" add --all
git -C "$REPO" commit -m "Add the topic notes"
git -C "$REPO" switch main
printf '# Steps\n' > "$REPO/steps.md"
git -C "$REPO" add --all
git -C "$REPO" commit -m "Write the review steps"
git -C "$REPO" merge --no-ff --no-edit topic
git -C "$REPO" log -1 --format='%s %p'
```

The last line prints `Merge branch 'topic'` and two parent ids. ("Add the topic notes" also carries the README change, which the switch took along.)

1. `$C click --role button --name "Review"`
   Look for: dialog "Worktree review".
2. `$C click --role tab --name "History"`
   Look for: four rows, the first starting "Merge commit Merge branch 'topic'", and button "Open graph".
3. `$C click --role button --name "Open graph"`
   Look for: the sheet closes; tab starting "Graph" selected in tablist "Open documents"; Page Title "Commit graph — repository"; Page URL has `entry=graph`; list "Commit graph" whose first button starts "Merge commit Merge branch 'topic'" and holds img "Merge commit"; the row starting "Add the topic notes" carries the chip "topic". The lanes are an `aria-hidden` SVG (test id `history-graph`): check them in a `screenshot`, two lanes joining at the merge dot.
4. `$C open "<path and query of the Page URL from step 3>"`
   Look for: after the reload, tab "Graph" is still selected and list "Commit graph" shows again.
5. `$C click --role button --name "/^Merge commit ?Merge branch 'topic'/"`
   Look for: heading starting "Merge branch 'topic'"; tab "Graph" no longer selected (a commit tab named by the 7-character id is); Page Title "<7-character id> — repository"; the toolbar shows tabs "1st parent · <id>" and "2nd parent · <id>".

## What proves it works

- The Graph tab surviving the reload in step 4, and the merge commit opening from it in step 5; `network` shows `GET /api/worktrees/<id>/commits/<oid>/files` answered 200 for the merge commit.
- `apps/web/spec/e2e/history-graph.e2e.ts`: Open graph selects the tab "Graph"; list "Commit graph" shows img "Merge commit" and the chip "topic"; after a reload the Graph tab is still selected; clicking the merge commit row in the graph shows heading "Merge branch 'topic'…" and deselects the Graph tab.

## Gotchas

- Reload with the full Page URL, as the test's `page.reload()` does, not `open /`: the bare route carries no `entry`, so it is not the same reload and need not land on the Graph tab.
- Commit row names are the whole row text; address them with a regex anchored at the start. The merge row's name begins with the img label "Merge commit".
- The setup leaves topic, the merge and two new files in the repository for the rest of the instance; start a fresh instance for features that expect the sample's single commit.
