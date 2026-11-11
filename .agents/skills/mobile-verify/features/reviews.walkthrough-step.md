---
screen: /walkthrough-step
selectors:
  - 'Step'
  - 'Previous step'
  - 'Next step'
  - 'Files'
  - "This step isn't available"
  - 'Open walkthrough'
  - 'Step unavailable'
tests:
  - packages/client/src/features/walkthroughs/rules/walkthrough.spec.ts
  - apps/mobile/src/features/workspace/rules/diff-page.spec.ts
api:
  - GET /api/worktrees/:worktreeId/walkthrough
  - GET /api/worktrees/:worktreeId/branch-changes
  - POST /api/worktrees/:worktreeId/branch-changes/diffs
---

# reviews.walkthrough-step

A walkthrough step's files read as one scrolling page of diffs, the same reader as [All changes](reviews.all-changes.md), limited to the files the step cites (renamed files included). The native title is "Step N of M" with the comparison beneath; the step's title and explanation head the page.

## How to get to it (user POV)

- [Walkthrough](reviews.walkthrough-page.md) → a step's See the code, or a step row in the tablet steps list. Native Back returns to the page at the same place.

## Driving it with agent-device

Preconditions: [reviews.walkthrough-page](reviews.walkthrough-page.md) with a ready walkthrough of at least two steps.

1. Open step 1's code. Expect title "Step 1 of N", the step title and explanation, then only that step's files with sticky headings. Previous step is disabled; Next step moves to step 2 in place and its page starts at its first file; on the last step Next step is disabled.
2. Phone: the Files top-bar menu lists the step's files, one line each (the file name, the folder only when two names collide, and, for a file listed more than once, the first details that tell its sections apart, such as `Branch` or `Uncommitted · staged`), and jumps to one. Tablet: the file list sits beside the diffs whenever the reader has at least 700 units of content width, so an iPad Pro 11" keeps it in portrait too; narrower content falls back to the phone layout.
3. Tap a file heading: the file screen opens on the Branch comparison; Back returns.
4. Write a new walkthrough with fewer steps while a later step is open: "This step isn't available" with Open walkthrough, which returns to the page.

## Gotchas

- Steps read the Branch comparison against the default base, like See every changed file.
