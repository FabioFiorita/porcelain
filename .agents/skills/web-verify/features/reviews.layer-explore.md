---
route: /
selectors:
  - "Explore the layer"
  - "Full layer diff"
  - "Layer diff scope"
  - "All files"
  - "One file"
  - "Close"
tests:
  - apps/web/spec/integration/reviews-layer-explore.test.tsx
api:
  - GET /api/worktrees/:worktreeId/review
  - GET /api/worktrees/:worktreeId/changes
---

# reviews.layer-explore

## What it is

Each layer has a persistent Explore the layer panel, with short code-location links, file paths, context and stale indicators, collapsed architectural intent and verification evidence. Code can show every changed file in the layer or one complete file at a time. Graph keeps the numbered navigation beside it. In Graph, selecting a numbered point or a graph node opens its complete file in a dialog; closing it returns to the same graph and selection. In Code, numbered points select a complete file in the main pane. The explorer holds no code preview. Existing context remains an explicitly labeled excerpt without whole-file marks.

## Driving it

Use `$C start --review-sample`. Pair the browser, open the Review sidebar, then Publish an immutable note.

1. In Code, expect All files selected, six changed files and one existing context location. Explore the layer lists all seven locations and their paths without requiring graph panning.
2. Click Explore Prepare a bounded request. One file is selected; the client file's entire current diff is shown, while the web file is absent. Mark the client file reviewed and wait for its Unmark control to become enabled, confirming the write finished. The server's reviewed-files readback names only that path, and reviewed-layers keeps its existing marks unchanged.
3. Click Full layer diff. All files is selected and the web diff returns. Collapse and expand files independently as usual.
4. Click Graph. The graph stays on the left and Explore the layer on the right, with all seven numbered links and no code preview. Click Explore Authorize and persist the outcome: a dialog with that title shows the complete server diff and its individual reviewed control; the client diff is absent.
5. Close the dialog. Graph stays selected and the server node is highlighted. Clicking a node also opens its file in a dialog. Escape closes it and restores focus to the node.
6. Click Explore Reuse the workspace actor. Its dialog shows an existing-context source excerpt without a whole-file mark. Close it and switch to Code: One file keeps the selected location. Full layer diff returns to the complete changed-file set.
7. Repeat the navigation at 414 × 896. The inspector stacks below the main view and scrolls independently. Graph, Code, All files and One file remain reachable. Return through the layer and overview document tabs.

## Evidence

The integration case compares the full and single-file documents, checks mark independence through server readbacks, and follows graph nodes into a full-diff dialog without changing the graph. Live driving checks the persistent split and phone layout. Web and desktop share this renderer; native mobile has its own review surface.
