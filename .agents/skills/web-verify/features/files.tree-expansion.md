---
route: /
selectors:
  - 'Review'
  - 'Files'
  - 'All files'
  - 'Search files'
tests:
  - apps/web/spec/integration/files-tree-expansion.test.tsx
  - packages/client/src/features/files/rules/file-tree.spec.ts
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/paths
---

# files.tree-expansion

Opening a folder loads its children lazily. A single-child folder chain becomes one row and opens with one click. A close while a read is pending keeps the resulting flattened row closed and does not load the next directory.

## Sub-features

- `files.tree-expansion` — Folder expansion, collapse and refresh.

## How to get to it (user POV)

- Review (phone width) → Files → a folder in the tree under region "All files". At desktop width Files is in the review sidebar.
- A focused folder opens with ArrowRight and closes with ArrowLeft.
- [Quick open](files.quick-open.md) and opening a [pinned file](files.pin.md) reveal the selected file's ancestor folders. "Search files" filters the loaded tree.

## Driving it with browser

Preconditions: [surface baseline](README.md).

```sh
mkdir -p "$REPO/a/b" "$REPO/c/d/e" "$REPO/x/nested" "$REPO/w" "$REPO/closed/b/x" "$REPO/closed/b/y"
printf 'First file\n' > "$REPO/a/b/first.txt"
printf 'Second file\n' > "$REPO/a/b/second.txt"
printf 'Keep visible\n' > "$REPO/x/nested/visible.txt"
printf 'Deep file\n' > "$REPO/c/d/e/deep.txt"
printf 'Lazy sibling\n' > "$REPO/w/loaded.txt"
printf 'Stay closed\n' > "$REPO/closed/b/x/closed.txt"
```

1. Navigate to `/`. At phone width open Review, then choose Files.
2. Click treeitem "a" once. Wait for the lazy reads: treeitem "a / b" is expanded and both "first.txt" and "second.txt" are visible. Save a screenshot after this first click.
3. Click "a / b" once: its files disappear. With that row still focused, ArrowRight shows them and ArrowLeft hides them again.
4. Click "c" once. After the reads for `c`, `c/d` and `c/d/e`, "c / d / e" is expanded and "deep.txt" is visible.
5. To check a close during loading, start from a full page load with cold reads. Hold `GET .../directory?path=a` and arm a separate hold for `path=a/b` before page initialization using browser-context routing. Click "a" to open, wait for the held read to arrive, click again to close, then release the response. Open "w" and wait for "loaded.txt" before checking that "a / b" stays collapsed, the separate `a/b` hold was never requested and its files stay absent. Restore routing in `finally`.
6. As a separate observational check, click "x" once to load and open "x / nested". Observe the tree's shadow root for childList, subtree and attributes. On every callback look up rows by name again: "visible.txt" must exist and "x / nested" must retain `aria-expanded="true"`. Click "w" (which sorts before "x"): "loaded.txt" appears without a recorded disappearance or collapse. A held sibling read can also check the pending state.
7. Enter `visible` in textbox "Search files", check its row, then clear the filter. Expanded folders remain open.
8. Repeat the first-click screenshot in dark mode. Repeat at desktop width; repeat native bridge behavior separately in desktop verification. Native Electron bridge behavior is outside this map.
9. Open "closed" and then its child "x" until "closed.txt" is visible. Collapse "closed / b", then remove the empty fixture directory `closed/b/y` on disk. After the live rebuild, "closed / b / x" stays collapsed and "closed.txt" stays absent.

### Observable proof

Directory reads answer 200. Closing an ancestor before a held read settles must not open/read its child; remaining paths stay closed even if sibling deletion flattens the chain. A removed/reintroduced path is newly discovered.

Automated coverage: `files-tree-expansion.test.tsx`, `file-tree.spec.ts`.

## Gotchas

- A pending directory read is not an empty folder. Close before release to prove cancellation rather than ordinary expansion.
