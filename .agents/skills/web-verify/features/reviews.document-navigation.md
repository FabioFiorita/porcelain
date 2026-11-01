---
route: /reviews/$reviewId
selectors:
  - 'Open documents'
  - 'Review'
  - 'Back to the walkthrough'
  - ' pane'
  - 'Code content'
tests:
  - apps/web/spec/integration/reviews-document-navigation.test.tsx
  - apps/web/spec/integration/reviews-file-tabs.test.tsx
api:
  - GET /api/reviews/:reviewId
  - GET /api/worktrees/:worktreeId/text
---

# reviews.document-navigation

A standalone published review uses the same document and split identities as its worktree entrance. Its entry and side are URL state; presentation and code reading places remain owned by Review and Changes.

## Driving it with browser

Preconditions: [surface baseline](README.md). Publish the sample review.

1. Open the published review, select a decision and open one of its retained files. Expect a revision-qualified review-file entry in the URL, the matching tab and the Part of the review banner.
2. Open that file to the side. Expect the same retained identity in side, the primary document preserved and focus on the destination tab.
3. Browser Back removes the split; another Back returns to the same decision. Forward restores the document. Reload and copy the exact URL: review, selected revision, paired environment and both document identities survive.
4. Repeat from an explicit immutable revision and from a remote review. Missing revisions/computers retain their explanation and recovery path; malformed entry/side values are removed without erasing review context. Changing review revision resets the document navigation to the new revision's permanent Review document.
5. Hold a cold text read while switching saved tabs. The previous document remains readable and inert, the frame stays mounted and only the ready destination becomes selected. Rapid selection chooses the latest requested document. After a failed destination, opening a healthy document clears only that document's error boundary.

Reduced Motion disables the short side-pane/panel entrance. Live updates do not replay it. Native phone stacks and iPad document sessions need their own feature maps and device proof.
