import { type FSWatcher, watch } from 'node:fs'
import { basename, dirname } from 'node:path'

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
 * Watchers are keyed per window (the calling WebContents): each window watches its
 * own open files, and a directory change fires `working-tree` only on the owning
 * window (guarded by `isDestroyed`), never broadcast across windows. A window's
 * watchers are reaped when it closes via `clearWatchedFiles`.
 */

/**
 * The minimal slice of `WebContents` we need: send an app-event and check the
 * window is still alive. Kept structural (not the electron type) so the module
 * stays honest about what it touches and is unit-testable with a plain fake —
 * `as unknown as` casts are banned repo-wide.
 */
interface FileWatchSender {
  send(channel: string, ...args: unknown[]): void
  isDestroyed(): boolean
}

const watchers = new Map<FileWatchSender, Map<string, { watcher: FSWatcher; files: Set<string> }>>()

export function setWatchedFiles(sender: FileWatchSender, paths: string[]): void {
  const byDir = new Map<string, Set<string>>()
  for (const path of paths) {
    const dir = dirname(path)
    const files = byDir.get(dir) ?? new Set<string>()
    files.add(basename(path))
    byDir.set(dir, files)
  }

  const senderWatchers =
    watchers.get(sender) ?? new Map<string, { watcher: FSWatcher; files: Set<string> }>()
  watchers.set(sender, senderWatchers)

  // Drop watchers for directories that no longer hold an open file.
  for (const [dir, entry] of senderWatchers) {
    if (!byDir.has(dir)) {
      entry.watcher.close()
      senderWatchers.delete(dir)
    }
  }

  // Add new directory watchers; refresh the basename filter on existing ones (the
  // live callback reads it back through the map, so mutating it in place is enough).
  for (const [dir, files] of byDir) {
    const existing = senderWatchers.get(dir)
    if (existing) {
      existing.files = files
      continue
    }
    try {
      const watcher = watch(dir, (_event, filename) => {
        const entry = senderWatchers.get(dir)
        if (!entry) return
        // Some platforms don't report the filename — assume a watched file changed.
        if (!filename || entry.files.has(filename)) {
          if (!sender.isDestroyed()) sender.send('app-event', 'working-tree')
        }
      })
      senderWatchers.set(dir, { watcher, files })
    } catch {
      // fs.watch is unsupported on some platforms/filesystems; the file just won't
      // live-refresh (reopening the tab still forces a fresh read).
    }
  }

  // A window with no open files keeps no entry in the top-level map.
  if (senderWatchers.size === 0) watchers.delete(sender)
}

export function clearWatchedFiles(sender: FileWatchSender): void {
  const senderWatchers = watchers.get(sender)
  if (!senderWatchers) return
  for (const { watcher } of senderWatchers.values()) watcher.close()
  watchers.delete(sender)
}
