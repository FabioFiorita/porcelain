import { type FSWatcher, watch } from 'node:fs'
import { basename, dirname } from 'node:path'
import { emitAppEvent } from './app-events'

/**
 * Watch the files currently open in the viewer so an external write — most often
 * the user's coding agent editing a file in the embedded terminal — live-refreshes
 * the open document. The renderer pushes its open file paths via the `watchFiles`
 * procedure (one call whenever the set changes); we reconcile the directory
 * watchers to match and emit a `working-tree` app-event on a relevant change.
 *
 * We watch each file's DIRECTORY, not the file: tools write atomically (tmp +
 * rename), which swaps the inode and breaks a direct file watch (same reason
 * `review-watch` watches dirs). We then filter the directory's events down to the
 * basenames we actually care about, so a noisy directory only fires when an OPEN
 * file changes. Watching just the open files' dirs — never the whole tree — keeps
 * this cheap on a 50 GB monorepo and sidesteps `.git`/`node_modules` churn.
 *
 * The event carries no path (the app-event channel is a bare enum), so the
 * renderer re-reads every open document; there are only a handful, so a blanket
 * `readFile` invalidation is cheap and keeps the channel simple. Watching adds no
 * new capability over `readFile` (which already takes an arbitrary path) and the
 * event leaks nothing — so it's not a new security surface.
 *
 * One global watcher set, not per-window: the app is effectively single-window
 * (one repo per window, re-created only when none exist), so a per-sender map
 * would be needless machinery. A stray cross-window event costs only a harmless
 * re-read.
 */
const watchers = new Map<string, { watcher: FSWatcher; files: Set<string> }>()

export function setWatchedFiles(paths: string[]): void {
  const byDir = new Map<string, Set<string>>()
  for (const path of paths) {
    const dir = dirname(path)
    const files = byDir.get(dir) ?? new Set<string>()
    files.add(basename(path))
    byDir.set(dir, files)
  }

  // Drop watchers for directories that no longer hold an open file.
  for (const [dir, entry] of watchers) {
    if (!byDir.has(dir)) {
      entry.watcher.close()
      watchers.delete(dir)
    }
  }

  // Add new directory watchers; refresh the basename filter on existing ones (the
  // live callback reads it back through the map, so mutating it in place is enough).
  for (const [dir, files] of byDir) {
    const existing = watchers.get(dir)
    if (existing) {
      existing.files = files
      continue
    }
    try {
      const watcher = watch(dir, (_event, filename) => {
        const entry = watchers.get(dir)
        if (!entry) return
        // Some platforms don't report the filename — assume a watched file changed.
        if (!filename || entry.files.has(filename)) emitAppEvent('working-tree')
      })
      watchers.set(dir, { watcher, files })
    } catch {
      // fs.watch is unsupported on some platforms/filesystems; the file just won't
      // live-refresh (reopening the tab still forces a fresh read).
    }
  }
}
