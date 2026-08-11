import { watch as defaultWatch, type FSWatcher } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { isFilesNotificationPath } from '@porcelain/contracts/files'
import type { SessionChange } from '@porcelain/contracts/session'

/**
 * Per-session non-recursive Files watches driven by declarative session interests.
 *
 * One map entry owns one host watcher even when the directory serves both open-file
 * basenames and tree interest. Content facts publish immediately; tree facts coalesce
 * for FILES_TREE_DEBOUNCE_MS after the last event. Interest bounding stays solely in
 * session-watches — this module never re-caps.
 */

export const FILES_TREE_DEBOUNCE_MS = 200

/** Ignore git's own churn: a `.git` entry, or anything reported beneath it. */
export function isGitChurn(filename: string | null): boolean {
  return filename === '.git' || (filename?.startsWith('.git/') ?? false)
}

export type FilesWatchHost = {
  readonly watch: typeof defaultWatch
  readonly setTimeout: typeof setTimeout
  readonly clearTimeout: typeof clearTimeout
}

export type SessionFilesWatches = {
  readonly apply: (interests: {
    readonly projectPath: string
    readonly files: readonly string[]
    readonly dirs: readonly string[]
  }) => void
  readonly clear: () => void
}

type DirEntry = {
  watcher: FSWatcher
  files: Set<string>
  treeInterested: boolean
}

function toNotificationPath(projectPath: string, absolute: string): string | null {
  const rel = relative(projectPath, absolute)
  if (rel === '') return '.'
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null
  if (!isFilesNotificationPath(rel)) return null
  return rel
}

function uniquePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

export function createSessionFilesWatches(options: {
  publish: (change: SessionChange) => void
  host?: Partial<FilesWatchHost>
}): SessionFilesWatches {
  const host: FilesWatchHost = {
    watch: options.host?.watch ?? defaultWatch,
    setTimeout: options.host?.setTimeout ?? setTimeout,
    clearTimeout: options.host?.clearTimeout ?? clearTimeout,
  }

  let projectPath: string | undefined
  const byDir = new Map<string, DirEntry>()
  let treeTimer: ReturnType<typeof setTimeout> | null = null
  /** Insertion-ordered pending tree notification paths for one coalesced publish. */
  const pendingTreePaths: string[] = []
  const pendingTreeSeen = new Set<string>()

  function cancelTreeDebounce(): void {
    if (treeTimer !== null) {
      host.clearTimeout(treeTimer)
      treeTimer = null
    }
    pendingTreePaths.length = 0
    pendingTreeSeen.clear()
  }

  function enqueueTreePath(notificationPath: string): void {
    if (pendingTreeSeen.has(notificationPath)) return
    pendingTreeSeen.add(notificationPath)
    pendingTreePaths.push(notificationPath)
  }

  function scheduleTreePublish(): void {
    if (treeTimer !== null) host.clearTimeout(treeTimer)
    treeTimer = host.setTimeout(() => {
      treeTimer = null
      const paths = pendingTreePaths.slice()
      pendingTreePaths.length = 0
      pendingTreeSeen.clear()
      if (projectPath === undefined || paths.length === 0) return
      options.publish({
        kind: 'files.tree-changed',
        projectPath,
        paths,
      })
    }, FILES_TREE_DEBOUNCE_MS)
  }

  function publishContent(paths: string[]): void {
    if (projectPath === undefined || paths.length === 0) return
    options.publish({
      kind: 'files.content-changed',
      projectPath,
      paths,
    })
  }

  function closeEntry(dir: string, entry: DirEntry): void {
    entry.watcher.close()
    byDir.delete(dir)
  }

  function onDirEvent(dir: string, filename: string | null): void {
    const entry = byDir.get(dir)
    const root = projectPath
    if (!entry || root === undefined) return

    const name =
      filename === null || filename === undefined
        ? null
        : typeof filename === 'string'
          ? filename
          : String(filename)

    // Content interests: basename filter; null/empty → every interested file under parent.
    if (entry.files.size > 0) {
      if (!name) {
        const paths = uniquePaths(
          [...entry.files]
            .map((base) => toNotificationPath(root, join(dir, base)))
            .filter((path): path is string => path !== null),
        )
        publishContent(paths)
      } else if (entry.files.has(name)) {
        const path = toNotificationPath(root, join(dir, name))
        if (path !== null) publishContent([path])
      }
    }

    // Tree interests: drop .git churn; coalesce paths across the debounce window.
    if (entry.treeInterested) {
      if (isGitChurn(name)) return
      const dirPath = toNotificationPath(root, dir)
      if (dirPath !== null) enqueueTreePath(dirPath)
      if (name) {
        const childPath = toNotificationPath(root, join(dir, name))
        if (childPath !== null) enqueueTreePath(childPath)
      }
      if (pendingTreePaths.length > 0) scheduleTreePublish()
    }
  }

  function openWatcher(dir: string, files: Set<string>, treeInterested: boolean): void {
    try {
      const watcher = host.watch(dir, (_event, filename) => {
        const name =
          filename === null || filename === undefined
            ? null
            : typeof filename === 'string'
              ? filename
              : String(filename)
        onDirEvent(dir, name)
      })
      watcher.on('error', () => {
        watcher.close()
        byDir.delete(dir)
        if (byDir.size === 0) cancelTreeDebounce()
      })
      byDir.set(dir, { watcher, files, treeInterested })
    } catch {
      // Unsupported filesystem or missing dir — stale until next apply/refetch.
    }
  }

  function clearFrame(): void {
    for (const [dir, entry] of byDir) closeEntry(dir, entry)
    cancelTreeDebounce()
    projectPath = undefined
  }

  return {
    apply(interests) {
      if (projectPath !== interests.projectPath) {
        clearFrame()
        projectPath = interests.projectPath
      }

      const desired = new Map<string, { files: Set<string>; treeInterested: boolean }>()

      for (const file of interests.files) {
        const dir = dirname(file)
        const base = basename(file)
        const existing = desired.get(dir)
        if (existing) {
          existing.files.add(base)
        } else {
          desired.set(dir, { files: new Set([base]), treeInterested: false })
        }
      }

      for (const dir of interests.dirs) {
        const existing = desired.get(dir)
        if (existing) {
          existing.treeInterested = true
        } else {
          desired.set(dir, { files: new Set(), treeInterested: true })
        }
      }

      for (const [dir, entry] of byDir) {
        if (!desired.has(dir)) closeEntry(dir, entry)
      }

      for (const [dir, wanted] of desired) {
        const existing = byDir.get(dir)
        if (existing) {
          existing.files = wanted.files
          existing.treeInterested = wanted.treeInterested
          continue
        }
        openWatcher(dir, wanted.files, wanted.treeInterested)
      }
    },

    clear() {
      clearFrame()
    },
  }
}
