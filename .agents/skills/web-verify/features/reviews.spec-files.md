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

Turning on Spec files in Settings lists changed spec files after the other changed files.

## How a user reaches it

- Toggle Sidebar → Settings → Appearance → Spec files

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Turning on Spec files in Settings lists changed spec files after the other changed files

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Changes"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role switch --name "Spec files"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Back"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/reviews-spec-files.e2e.ts` (Playwright e2e): turning on Spec files in Settings lists changed spec files after the other changed files.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
