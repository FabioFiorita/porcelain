# Revision comparison (U3a)

Contracts: `packages/contracts/src/reviews/review-comparison.ts` and `api.ts`.

- `GET /api/reviews/:reviewId/compare?from=1&to=2` reads one summary. Omit `from` to use `lastSeenRevision`, and `to` to use latest. No seen revision returns a null comparison and an explicit unknown baseline. Reversed revisions return 400; absent reviews/revisions return 404. Comparing a revision to itself is valid.
- Files are matched by manifest path. Both head-side and merge-base-side blob OIDs count; mode-only differences do not. Rename membership follows the published manifest path. No head-range file list is used.
- Decisions affected are B's layers with changed steps pointing at changed/entered files or a different fingerprint. New/gone IDs and invalid current decision-mark keys are separate.
- File marks are current stored keys: matches to B's manifest head blobs carry; other keys in B reset. A path absent from B's manifest has unknown validity, even if it left A: the base may have caught up while the head blob stayed identical. No marks are changed by reading.
- Verdict additions/drops compare full entries (removal path order is ignored), and deleted-file membership comes from each manifest.
- Conversation counts agent messages created strictly after A's publication and currently resolved review-owned threads. It does not infer resolution time. Missing creation timestamps are unknown. Messages can be newer than B, since this is the current conversation.
- Proof includes B's published checks. Result changes match a unique `(name, layerId, stepId)` in both revisions. Duplicate identities are unknown, and no execution OID is claimed.
- `GET /api/reviews/:reviewId/interdiff?from=1&to=2&path=decision.ts` returns `{kind:"diff",from,to,path,diffs:[{paths,content}]}` using the existing bounded retained reader for one literal path. Missing baseline, absent manifest membership, and unchanged files return `kind:"unavailable"` with a reason. A missing head side is rendered as an addition/deletion by that same reader. Base-only changes can return a metadata-only empty patch. Retention works after worktree and branch removal.

Run `.agents/skills/server-verify/scripts/cli doctor`, then `start`. Then run the comparison fixture:

```sh
.agents/skills/server-verify/scripts/cli fixture compare-revisions --instance <id>
```

The deterministic driver publishes A, marks two files, posts an agent comment, commits a one-file change, advances the base with an unrelated file, rebases and publishes B. It records the direct Git range's unrelated file as a negative control, reads compare/interdiff, removes its worktree and branch, and reads both again. Sanitized HTTP readbacks and exact Git OIDs go to `revision-comparison.json` in the instance evidence directory. The caller stops the instance with its printed stop command. Loopback proof does not establish LAN/remote transport behavior.

Automated promises: `packages/reviews/src/rules/review-comparison.spec.ts`, `apps/server/spec/integration/reviews-comparison.integration.ts`, `packages/client/src/features/reviews/queries/project-reviews.spec.ts`.
