---
screen: /
selectors:
  - "Review"
  - "Select a worktree to continue."
  - "Changes"
  - "No worktree selected."
  - "Uncommitted changes"
  - "Branch changes"
  - "Show branch changes"
  - "Show uncommitted changes"
  - "Refresh review"
  - "Comments"
  - "Close comments"
  - "Back to changed files"
  - "Read diff again"
  - "No changed files."
  - "Reviewed marks are unavailable because this branch has no base."
tests:
  - apps/mobile/spec/e2e/phone-shell.e2e.ts
  - apps/mobile/spec/e2e/destinations.e2e.ts
  - apps/mobile/spec/e2e/tablet-shell.tablet.e2e.ts
  - apps/mobile/spec/e2e/review.e2e.ts
  - apps/mobile/spec/e2e/review.tablet.e2e.ts
api:
  - "GET /api/worktrees/:worktreeId/text"
  - "GET /api/worktrees/:worktreeId/changes"
  - "POST /api/worktrees/:worktreeId/changes/diffs"
  - "GET /api/worktrees/:worktreeId/branch-changes"
  - "POST /api/worktrees/:worktreeId/branch-changes/diffs"
  - "GET /api/worktrees/:worktreeId/comments"
  - "GET /api/worktrees/:worktreeId/review"
  - "GET /api/worktrees/:worktreeId/reviewed"
---

# reviews.review

## What it is

The selected worktree's review: uncommitted or branch changes, fingerprint-aware reviewed states, published layer text, native file diffs and a native comments sheet. Without a selection it shows “Select a worktree to continue.”. This destination exposes reads. The API list names only the methods called by this screen.

## How a user reaches it

- cold launch opens Review
- iPhone: Review tab; iPad: Review sidebar row
- deep link `porcelain.dev://` (CLI path `/`)
- workspace picker selects a paired environment, project and available worktree

## Driving it

Start `.agents/skills/mobile-verify/scripts/cli start` (or `start --device ipad`). Follow `access.pairing.md` and `projects.workspace-picker.md` to pair and select the disposable sample worktree. The sample repository contains a changed readme. Use the CLI's server commands to publish a sample review, seed a comment and mark the file reviewed.

```sh
.agents/skills/mobile-verify/scripts/cli open /
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for “Uncommitted changes”, the published layer title and summary, and the changed file with its comparison and reviewed state. Tap a file using its exact path from the snapshot. Look for “Back to changed files” and the native patch. The patch preserves addition and deletion prefixes. Binary and omitted content display their reason; metadata-only content displays the Git patch.

```sh
.agents/skills/mobile-verify/scripts/cli tap --label Comments
.agents/skills/mobile-verify/scripts/cli snapshot
.agents/skills/mobile-verify/scripts/cli tap --label 'Close comments'
.agents/skills/mobile-verify/scripts/cli tap --label 'Back to changed files'
.agents/skills/mobile-verify/scripts/cli tap --label 'Show branch changes'
.agents/skills/mobile-verify/scripts/cli snapshot
.agents/skills/mobile-verify/scripts/cli tap --label 'Show uncommitted changes'
.agents/skills/mobile-verify/scripts/cli screenshot
```

Look for comment anchors, messages and resolved/open states, dismissal returning to the same diff, and branch files or the explicit empty state. “Refresh review” rereads snapshots and reviewed marks. A changed fingerprint displays “Changed since review”. A stale diff request refreshes the changes list once, then reads against its current token and file fingerprints; it does not retry the old snapshot. When a branch has no base, its files have no reviewed marks and the screen explains why; no branch marks request is sent. “Read diff again” retries a failed read. Switch worktrees or forget the environment and verify the previous review and sheet disappear. Visit Files and return through Review; the selected workspace remains selected.

## What proves it works

- `review.e2e.ts` and `review.tablet.e2e.ts` select a disposable worktree, read its exact changed line, published text and reviewed state, open and dismiss comments, read a committed branch-file diff, and return to the unpaired empty state. Server traces assert native read routes.
- Existing shell and destinations flows keep all empty-state entry points.
- `packages/client/src/features/reviews/rules/files.spec.ts` covers matching fingerprints, stale marks and untracked patch whitespace. Shared Changes rule specs cover selection keys, staged/unstaged rename batching, branch ranges and rename paths.
- `packages/client/spec/integration/reviews.integration.ts` proves real staged/unstaged patches, untracked text and automatic recovery from a real 409 after an edit between list and diff reads.

## Gotchas

- Shared renderer: `apps/mobile/src/shared/diff/file-diff.tsx`, `FileDiff({content})`; History uses the same content shape.
- Review is read-only. Published HTML summaries and diagrams remain outside this screen; native layer summaries and steps are shown.
- On iPad the content column reports the selected worktree's uncommitted file count; the detail column owns file selection and the diff viewport.
- iPhone and iPad need separate drives. Report the baseline iPad “Add environment” covered-button verifier block if encountered.
- Physical-device Local Network permission denial and retry remain unproved by simulators.
