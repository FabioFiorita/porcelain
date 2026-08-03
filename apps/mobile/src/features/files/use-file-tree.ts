import { useCallback, useMemo } from 'react'
import { create } from 'zustand'

import type { EntryItem } from '@/components/entry-rows'
import type { DaemonError } from '@/lib/daemon/errors'
import { type DirEntry, readDirQuery } from '@/lib/daemon/procedures/files'
import { useDaemonQueries } from '@/lib/daemon/queries'
import { ancestorPaths, fileTreeItems } from './tree-rows'
import { useFilesWatch } from './use-files'

const SEPARATOR = '/'

/**
 * Which folders are open, per tree root. It outlives the screen on purpose: a tab switch or a push
 * to a file and back should return to the shape the reader left, not to a collapsed root. Keyed by
 * root so a folder deep-link keeps its own shape and switching repos starts clean.
 */
type FileTreeState = {
  expandedByRoot: Readonly<Record<string, readonly string[]>>
  toggle: (root: string, path: string) => void
  reveal: (root: string, ancestors: readonly string[]) => void
  collapseAll: (root: string) => void
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  collapseAll: (root: string): void => {
    set((state) => ({ expandedByRoot: { ...state.expandedByRoot, [root]: [] } }))
  },
  expandedByRoot: {},
  reveal: (root: string, ancestors: readonly string[]): void => {
    set((state) => {
      const open = new Set(state.expandedByRoot[root] ?? [])
      for (const ancestor of ancestors) open.add(ancestor)
      return { expandedByRoot: { ...state.expandedByRoot, [root]: [...open] } }
    })
  },
  toggle: (root: string, path: string): void => {
    set((state) => {
      const open = new Set(state.expandedByRoot[root] ?? [])
      if (!open.delete(path)) {
        open.add(path)
      } else {
        // Closing a folder closes what is inside it: re-opening shows the shape the tree had the
        // first time, not whatever was left open three levels down.
        for (const path_ of [...open]) {
          if (path_.startsWith(`${path}${SEPARATOR}`)) open.delete(path_)
        }
      }
      return { expandedByRoot: { ...state.expandedByRoot, [root]: [...open] } }
    })
  },
}))

export type FileTree = {
  items: EntryItem[]
  expanded: ReadonlySet<string>
  toggle: (path: string) => void
  /** Open every folder down to a path — what a pinned entry or a search hit needs. */
  reveal: (path: string) => void
  collapseAll: () => void
  refresh: () => Promise<void>
  isPending: boolean
  error: DaemonError | null
}

/**
 * The file tree: one `readDir` per open folder, exactly like the renderer's tree. Folders read
 * lazily rather than from a whole-repo index, so opening this tab costs one directory however big
 * the checkout is — and a folder nobody has opened honestly has no item count to show.
 */
export function useFileTree({
  enabled,
  repoPath,
  rootPath,
  showHidden,
}: {
  enabled: boolean
  repoPath: string
  /** Where the tree starts. The repo root, or the folder a deep link opened. */
  rootPath: string
  showHidden: boolean
}): FileTree {
  const open = useFileTreeStore((state) => state.expandedByRoot[rootPath])
  const expanded = useMemo((): ReadonlySet<string> => new Set(open ?? []), [open])

  // Sorted and joined so the query inputs keep their identity across renders that changed nothing.
  const expandedKey = useMemo(() => [...expanded].sort().join('\n'), [expanded])
  const dirs = useMemo(
    (): string[] => [rootPath, ...(expandedKey === '' ? [] : expandedKey.split('\n'))],
    [expandedKey, rootPath],
  )
  const inputs = useMemo(
    () => dirs.map((path) => ({ path, repoPath, showHidden })),
    [dirs, repoPath, showHidden],
  )

  const results = useDaemonQueries(readDirQuery, inputs, { enabled, staleTime: 30_000 })
  const watched = useMemo((): string[] => (enabled ? dirs : []), [dirs, enabled])
  useFilesWatch({ dirs: watched })

  const entriesByPath = useMemo((): Map<string, readonly DirEntry[]> => {
    const listings = new Map<string, readonly DirEntry[]>()
    for (const [index, dir] of dirs.entries()) {
      const data = results[index]?.data
      if (data !== undefined) listings.set(dir, data)
    }
    return listings
  }, [dirs, results])

  const items = useMemo(
    (): EntryItem[] => fileTreeItems({ entriesByPath, expanded, root: rootPath }),
    [entriesByPath, expanded, rootPath],
  )

  const toggle = useCallback(
    (path: string): void => {
      useFileTreeStore.getState().toggle(rootPath, path)
    },
    [rootPath],
  )

  const reveal = useCallback(
    (path: string): void => {
      useFileTreeStore.getState().reveal(rootPath, ancestorPaths(rootPath, path))
    },
    [rootPath],
  )

  const collapseAll = useCallback((): void => {
    useFileTreeStore.getState().collapseAll(rootPath)
  }, [rootPath])

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all(results.map((result) => result.refetch()))
  }, [results])

  return {
    collapseAll,
    error: results[0]?.error ?? null,
    expanded,
    isPending: results[0]?.isPending ?? false,
    items,
    refresh,
    reveal,
    toggle,
  }
}
