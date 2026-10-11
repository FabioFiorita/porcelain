---
route: /
selectors:
  - 'Review'
  - 'Files'
  - 'All files'
  - 'Search files'
tests:
  - apps/web/spec/integration/files-tree-expansion.test.tsx
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/paths
---

# files.tree-expansion

## What it is

Opening a folder loads its children lazily. A single-child folder chain becomes one row and opens with one click. A close while a read is pending keeps the resulting flattened row closed and does not load the next directory.

## How a user reaches it

- Review (phone width) → Files → a folder in the tree under region "All files". At desktop width Files is in the review sidebar.
- A focused folder opens with ArrowRight and closes with ArrowLeft.
- [Quick open](files.quick-open.md) and opening a [pinned file](files.pin.md) reveal the selected file's ancestor folders. "Search files" filters the loaded tree.

## Driving it

Start with `$C start` and pair the browser. Use `fixtures.repositoryPath` from `connection.json` as `REPO`. Before a full page load:

```sh
mkdir -p "$REPO/a/b" "$REPO/c/d/e" "$REPO/x/nested" "$REPO/w"
printf 'First file\n' > "$REPO/a/b/first.txt"
printf 'Second file\n' > "$REPO/a/b/second.txt"
printf 'Keep visible\n' > "$REPO/x/nested/visible.txt"
printf 'Deep file\n' > "$REPO/c/d/e/deep.txt"
printf 'Lazy sibling\n' > "$REPO/w/loaded.txt"
```

1. Navigate to `/`. At phone width open Review, then choose Files.
2. Click treeitem "a" once. Wait for the lazy reads: treeitem "a / b" is expanded and both "first.txt" and "second.txt" are visible. Save a screenshot after this first click.
3. Click "a / b" once: its files disappear. With that row still focused, ArrowRight shows them and ArrowLeft hides them again.
4. Click "c" once. After the reads for `c`, `c/d` and `c/d/e`, "c / d / e" is expanded and "deep.txt" is visible.
5. To check a close during loading, start from a full page load with cold reads. Hold `GET .../directory?path=a` before page initialization using browser-context routing. Click "a" twice (open, close), then release the response. "a / b" stays collapsed; no read for `a/b` occurs and its files stay absent. Restore routing in `finally`.
6. As a separate observational check, click "x" once to load and open "x / nested". Observe the tree's shadow root for childList, subtree and attributes. On every callback look up rows by name again: "visible.txt" must exist and "x / nested" must retain `aria-expanded="true"`. Click "w" (which sorts before "x"): "loaded.txt" appears without a recorded disappearance or collapse. A held sibling read can also check the pending state. The named spec does not cover sibling blinking.
7. Enter `visible` in textbox "Search files", check its row, then clear the filter. Expanded folders remain open.
8. Repeat the first-click screenshot in dark mode. Repeat at desktop width; the Electron app uses this same web adapter. Native Electron bridge behavior is outside this map.

## What proves it works

- `files-tree-expansion.test.tsx` asserts the cold single-child chain opens with one click, closes with one click, and responds to ArrowRight/ArrowLeft.
- The three-level case checks the final file, expanded row and reads for every directory in the chain.
- The late-close case holds the first read, closes before completion and checks the collapsed row and absence of a child-directory read.
- Directory reads return 200 JSON. The adapter rebuilds with `resetPaths`, preserving visible expansion through a single-child chain's hidden ancestors and continuing a newly loaded chain only while its parent is open.
