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

Open graph opens the commit graph of the checked-out branch as a document tab ("Graph") with its lanes, merges and ref chips, one row per commit in columns: short id, subject with a HEAD badge on the checked-out commit and its ref chips, author (when the page is wide enough) and age; Porcelain's internal `refs/porcelain/` refs never show; the tab comes back after a reload, and clicking a commit in it opens that commit's document.

## How to get to it (user POV)

- Review → History → button "Open graph" (after the commit list in the History panel; shown once the branch has commits).
- The tab "Graph" in the "Open documents" tablist once opened; URL `entry=graph` on the workspace route.

## Driving it with browser

Preconditions: [surface baseline](README.md).

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

1. Click button `Review`
   Expect: dialog "Worktree review".
2. Click tab `History`
   Expect: four rows, the first starting "Merge commit Merge branch 'topic'", and button "Open graph".
3. Click button `Open graph`
   Expect: the sheet closes; tab starting "Graph" selected in tablist "Open documents"; title "Commit graph — repository"; URL has `entry=graph`; list "Commit graph" whose first button starts "Merge commit Merge branch 'topic'" and holds img "Merge commit"; the row starting "Add the topic notes" carries the chip "topic". The lanes are an `aria-hidden` SVG (test id `history-graph`): check them in a screenshot, two lanes joining at the merge dot.
4. Navigate to `<path and query of the URL from step 3>`
   Expect: after the reload, tab "Graph" is still selected and list "Commit graph" shows again.
5. Click button `/^Merge commit ?Merge branch 'topic'/`
   Expect: heading starting "Merge branch 'topic'"; tab "Graph" no longer selected (a commit tab named by the 7-character id and subject is); title "<7-character id> — repository"; the toolbar shows tabs "1st parent · <id>" and "2nd parent · <id>".

### Observable proof

Reload full URL: Graph remains selected; opening merge records files GET/200.

Automated coverage: `history-graph.e2e.ts`.

## Gotchas

- Reload the complete URL, including entry; bare `/` need not restore Graph. Match whole-row names by anchored regex; merge starts with Merge commit.
- Setup leaves topic, merge and files; reset before maps expecting the initial fixture.

## Graph presentation

The checked-out HEAD row has a muted background and a semibold 13px title. Other rows use 13px titles, with 12px hashes, authors and ages. The branch heading is mono. History retains upstream labels and places Open graph immediately after the scrolling list.
