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
  re-read every open file on a timer and throw away the 30s cache. Instead the session registers its open
  file paths via `session:watches` and the Files domain watches those files' **parent directories**,
  emitting typed `files.content-changed` facts with project-relative `paths`. *Why dirs, not the tree:*
  a recursive watch on a 50 GB repo is the thing this rule exists to avoid, and it would drown in
  `.git`/`node_modules` churn; watching open files' dirs (filtered by basename, surviving tmp+rename) is
  O(open tabs). Don't upgrade it to a recursive watch, don't make `readFile` poll.
- **The Files tree stays fresh by a WATCHER, not by polling `readDir`.** Same shape: the session registers
  currently-**expanded** dir paths and the Files domain puts ONE non-recursive `fs.watch` on each,
  emitting typed `files.tree-changed` facts (project-relative `paths`, `'.'` for the project root). This
  stays O(expanded dirs): **`.git` events are dropped** (index churn must not spam refetches), combined
  interests are **capped solely by session-watches** (`SESSION_WATCH_INTEREST_LIMIT`), and bursts are
  **debounced** into one publish. A directory that is both a file parent and a tree interest shares one
  host watcher. It must never become a recursive tree watch, and `readDir` must keep its 30s cache.
  Watchers are reaped on session close.
