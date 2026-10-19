import {
  REVIEW_PROOF_ASSETS,
  REVIEW_PROOF_FILE_MEBIBYTES,
  REVIEW_PROOF_MEBIBYTES,
  REVIEW_PROOF_OUTPUT_LENGTH,
} from '@porcelain/contracts/shared';

export const REVIEW_GUIDE = `# Publishing a Porcelain review

A review explains decisions. Each layer is one behavior or ownership decision; lanes describe the parts of the system that decision crosses. Put an owner before the decisions that use it. Step pointers explain a block and its consequence. Uncovered changed lines appear as Not explained. Diagram owners can be New, Changed or Removed; problems appear as Needs your decision. These are authored explanations, not automatically verified architectural claims.

## Commit, then publish

Publish committed branch work. HEAD must be a commit on an attached branch, and staged, unstaged and untracked changes must be committed first. Paths explicitly supplied as proof assets are excluded from the clean-tree check.

Call \`read_review\` first. With no \`reviewId\`, it resolves the cwd branch's open review. It returns the review, revision list and selected revision (latest by default). Pass \`reviewId\` and optionally \`revision\` to read a retained review without its original worktree.

Publish with \`expectedRevision\` set to the review's latest revision number, or 0 for a new review. An intervening publish causes a conflict: read again before retrying. \`base\` defaults to the repository's default branch; an explicit base names a full local or remote branch ref.

The review belongs to the project. Its key is the supplied GitHub \`pullRequest\` URL's PR, otherwise the branch. The PR repository must match origin. Adding a PR later keeps the open branch review; a different PR starts a review for that key. An explicit \`reviewId\` must name an open review with the same key. Closing and deleting belong to the developer; there is no MCP delete tool.

Each successful publish adds an immutable numbered revision, with head, base and merge-base commit OIDs, publishing-worktree labels, verdict, layers, diagram and proof. Porcelain pins the head in the project's common Git directory, so code remains readable after branch or worktree removal. Stored excerpts remain readable even if the repository disappears. Pointers must name existing lines at the head commit; deleted files cannot supply a head pointer.

## Verdict

Every publish requires:

\`\`\`json
{
  "verdict": {
    "asked": { "text": "What the developer asked for", "links": [{ "title": "Brief", "url": "https://github.com/owner/repository/issues/1" }] },
    "recommendation": "hold",
    "reasons": ["Why this should merge or wait"],
    "notProven": [{ "what": "Desktop", "why": "Mac is off" }],
    "removed": []
  }
}
\`\`\`

Recommendation is \`merge\` or \`hold\`. Supply 1–5 reason lines. Put work you did not run in \`notProven\`; proof checks accept only \`pass\` or \`fail\`.

## Removals

Every file deleted between the merge base and head must appear by its exact path in \`verdict.removed[].paths\`. Each entry names the removed behavior and why it was removed. Publication refuses an unexplained deletion with \`Explain every removal: <path> is deleted but no verdict.removed entry names it.\` Diagram Removed owners do not replace this declaration.

## Decisions and diagram

Layers have UUID ids, a title, summary, lanes and steps. A step has a UUID id, lane index, title, text, \`kind: "changed" | "context"\`, and a pointer with path and inclusive line range. A context step introduces useful unchanged code. Keep explanations concise and order steps as the behavior flows.

An optional \`diagram.after\` holds boxes and arrows. A decision box has \`decision: true\` and a valid \`layerId\`; owner boxes can use \`change: "new" | "changed" | "removed"\`, detail and a layerId. A problem names a decision still needing the developer. Arrows name existing boxes; their labels describe relationships. Diagram claims need support in the linked code.

## Optional summary

\`summaryHtml\` is optional, for diagrams or media the structured verdict cannot hold. It is a complete HTML document of at most 10 MiB, rendered in an opaque sandbox. It cannot access Porcelain credentials or APIs. Author CSS for a readable narrow pane; missing detectable CSS produces an advisory warning. Theme values \`--porcelain-background\`, \`--porcelain-foreground\` and \`data-theme\` are available. Links such as \`#layer-1\` open that decision. Never embed credentials.

## Proof

Report checks actually run, including failures. Each check has name, \`result: "pass" | "fail"\` and optional output (at most ${REVIEW_PROOF_OUTPUT_LENGTH} characters).

Supply at most ${REVIEW_PROOF_ASSETS} assets: image (PNG/JPEG/GIF/WebP), video (MP4/WebM), or an HTTP(S) link. A file path is relative to the publishing worktree; Porcelain copies at most ${REVIEW_PROOF_FILE_MEBIBYTES} MiB per file and ${REVIEW_PROOF_MEBIBYTES} MiB together. Its bytes must match its kind. Checks and assets can name a valid layerId, or layerId plus stepId.

To carry an image or video into a later revision, supply its prior \`proofId\` instead of path. Use exactly one. Every revision keeps its own proof; republishing does not alter earlier revisions. The current worktree view reports proof stale when its branch tip differs from that revision's head or code differs from HEAD; its own proof paths are excluded. A new head needs fresh proof and another publish.

## Comments

\`list_comments\` reads the cwd branch's review threads together with worktree-owned threads. Its default \`scope: "waiting"\` returns unresolved threads whose latest message is not from the agent; \`scope: "all"\` includes every thread. An explicit reviewId reads that review's threads even after worktree removal.

Comment tools accept \`reviewId\` to select a review owner. Each review thread reports \`review: { reviewId, revision, headOid }\` for the revision it was written on, independently of its comment-update revision. Threads span review revisions. Worktree-owned comments remain separate. Branch anchors use a branch comparison and a commit OID; additions are at that head and deletions are at its merge base. Re-find the code if the head changed. Stable creation and message ids make retries idempotent. Reply in Markdown; resolve after addressing the comment or the developer accepts it.

## Handoff

A publish returns \`reviewId\`, \`revision\`, \`headOid\`, \`baseOid\` and \`links\`. Web destinations cover the review, its revision and each decision. The app links use the configured Porcelain hub origin and retain the environment, selected host, revision and decision. Hosts prefer configured Cloudflare, then Tailscale, then LAN.

Put the returned decision app link from \`links.decisions\` in the handoff, alongside the exact head commit and any unproven surfaces. New web review destinations and native universal-link handling are delivered separately; producing a link does not certify those clients can open it yet.
`;
