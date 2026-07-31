# Performance (must stay fast on a 50 GB monorepo)

- **Never render all lines of a file.** Viewer and diffs go through `VirtualRows`; Shiki tokenizes only
  mounted rows.
- **Never index what isn't visible.** The file tree is lazy per-directory `readDir` on expand; nothing
  is indexed up front. `git ls-files` is cached stale-while-revalidate.
- **`optimizeDeps.entries` must cover `src/**/*.{ts,tsx}`** so every `@base-ui/react/*` entry is
  pre-bundled — a dep discovered lazily mid-session re-optimizes, loads a second React copy, and
  crashes with "Invalid hook call".
- **Git queries are live, fs queries are cached.** `gitFlow` (staleTime 0 + 3s poll) and `gitDiffFile`
  (staleTime 0) must reflect the working tree; fs-backed queries keep the 30s default. The 3s poll is
  cheap **only** because the daemon memoizes flow on a status+numstat+layers key — don't break that key.
- **Open file documents stay fresh by a WATCHER, not by polling `readFile`.** A `refetchInterval` would
  re-read every open file on a timer and throw away the 30s cache. Instead the renderer pushes its open
  file-tab paths and the daemon watches just **those files' directories**, emitting `working-tree`.
  *Why dirs, not the tree:* a recursive watch on a 50 GB repo is the thing this rule exists to avoid,
  and it would drown in `.git`/`node_modules` churn; watching open files' dirs (filtered by basename,
  surviving tmp+rename) is O(open tabs). Don't upgrade it to a recursive watch, don't make `readFile`
  poll.
- **The Files tree stays fresh by a WATCHER, not by polling `readDir`.** Same shape: the renderer pushes
  currently-**expanded** dir paths and the daemon puts ONE non-recursive `fs.watch` on each, emitting a
  window-targeted `file-tree` event. This stays O(expanded dirs): **`.git` events are dropped** (index
  churn must not spam refetches), watchers are **capped per sender** (extras fall back to the 3s-stale
  tab switch), and bursts are **debounced** into one send. It must never become a recursive tree watch,
  and `readDir` must keep its 30s cache. Watchers are reaped on window close.

