import { type FSWatcher, watch } from 'node:fs'
import { basename, dirname } from 'node:path'

/**
 * Watch the files currently open in the viewer so an external write — usually the
 * user's coding agent editing in the embedded terminal — live-refreshes the open
 * document. The renderer pushes its open paths via `watchFiles`; we reconcile the
 * directory watchers to match and emit a `working-tree` app-event.
 *
 * We watch each file's DIRECTORY, not the file: tools write atomically (tmp +
 * rename), which swaps the inode and breaks a direct file watch (same reason
 * `review-watch` watches dirs). Events are then filtered down to the basenames we
 * care about. Never the whole tree — see the audit skill's perf invariant.
 *
 * The event carries no path (the app-event channel is a bare enum), so the
 * renderer re-reads every open document — cheap at a handful of tabs. It adds no
 * capability over `readFile`, which already takes an arbitrary path.
 *
 * Watchers are keyed per window (the calling WebContents) and a change fires only
 * on the owning window (guarded by `isDestroyed`), never broadcast; a window's
 * watchers are reaped on close via `clearWatchedFiles`.
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

/**
 * Watch the DIRECTORIES currently expanded in the Files tree (pushed via
 * `watchDirs`) so an external add/remove live-refreshes the tree. Tree twin of the
 * open-files watcher above; same per-sender keying and reap-on-window-close
 * (`clearWatchedDirs`). PERF INVARIANT (audit skill): ONE non-recursive `fs.watch` per
 * expanded dir — never a recursive watch on the repo. `.git` events are dropped,
 * watchers are capped per sender, bursts debounce into ONE `file-tree` app-event.
 */
const DIR_DEBOUNCE_MS = 200
// A sane upper bound: a human rarely has this many folders open at once, and the
// 3s-stale tab switch still refreshes any dir past the cap, so dropping extras
// silently is safe. Guards against an unbounded watcher count on a pathological tree.
const MAX_WATCHED_DIRS = 128

/** Ignore git's own churn: a `.git` entry, or anything reported beneath it. */
export function isGitChurn(filename: string | null): boolean {
  return filename === '.git' || (filename?.startsWith('.git/') ?? false)
}

interface DirWatchEntry {
  dirs: Map<string, FSWatcher>
  debounce: ReturnType<typeof setTimeout> | null
}

const dirWatchers = new Map<FileWatchSender, DirWatchEntry>()

// Coalesce a burst of dir events (a tool writing many files) into one `file-tree`
// send, DIR_DEBOUNCE_MS after the last event. Window-targeted like `working-tree`.
function scheduleTreeEvent(sender: FileWatchSender, entry: DirWatchEntry): void {
  if (entry.debounce !== null) clearTimeout(entry.debounce)
  entry.debounce = setTimeout(() => {
    entry.debounce = null
    if (!sender.isDestroyed()) sender.send('app-event', 'file-tree')
  }, DIR_DEBOUNCE_MS)
}

export function setWatchedDirs(sender: FileWatchSender, dirs: string[]): void {
  // Cap the count so a pathological tree can't spawn unbounded watchers.
  const wanted = new Set(dirs.slice(0, MAX_WATCHED_DIRS))

  const entry = dirWatchers.get(sender) ?? { dirs: new Map<string, FSWatcher>(), debounce: null }
  dirWatchers.set(sender, entry)

  // Drop watchers for dirs no longer expanded.
  for (const [dir, watcher] of entry.dirs) {
    if (!wanted.has(dir)) {
      watcher.close()
      entry.dirs.delete(dir)
    }
  }

  // Add a non-recursive watcher for each newly expanded dir.
  for (const dir of wanted) {
    if (entry.dirs.has(dir)) continue
    try {
      // No options → `fs.watch` defaults to NON-recursive; that default is the perf
      // invariant here (one watcher per dir, never the whole tree).
      const watcher = watch(dir, (_event, filename) => {
        if (isGitChurn(filename)) return
        scheduleTreeEvent(sender, entry)
      })
      // A watched dir can be deleted out from under us (the agent removing a folder);
      // fs.watch emits 'error' then — drop the watcher rather than crash the process.
      watcher.on('error', () => {
        watcher.close()
        entry.dirs.delete(dir)
      })
      entry.dirs.set(dir, watcher)
    } catch {
      // fs.watch is unsupported on some platforms/filesystems, or the dir is already
      // gone; the tree just won't live-refresh it (the tab-switch poll still covers it).
    }
  }

  // A sender with nothing expanded and no pending send keeps no entry.
  if (entry.dirs.size === 0 && entry.debounce === null) dirWatchers.delete(sender)
}

export function clearWatchedDirs(sender: FileWatchSender): void {
  const entry = dirWatchers.get(sender)
  if (!entry) return
  for (const watcher of entry.dirs.values()) watcher.close()
  if (entry.debounce !== null) clearTimeout(entry.debounce)
  dirWatchers.delete(sender)
}
