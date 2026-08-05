import { useMemo } from 'react'
import {
  type DirEntry,
  type FileSearchResult,
  type FileView,
  hidePathMutation,
  pinnedEntriesQuery,
  pinPathMutation,
  readDirQuery,
  readFileQuery,
  searchFilesQuery,
  unhidePathMutation,
  unpinPathMutation,
} from '@/lib/daemon/procedures/files'
import { repoNotesQuery, setRepoNotesMutation } from '@/lib/daemon/procedures/notes'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useDaemonWatch } from '@/lib/daemon/watch'

import { absolutePath, relativePath } from './file-paths'
import { useFilesStore } from './files-store'

/** A repo-relative directory entry — what every row, route and comment in this tab speaks. */
export type FileEntry = Omit<DirEntry, 'path'> & {
  /** Repo-relative. */
  path: string
  /** The daemon's absolute path, kept so a row can act on it without re-deriving. */
  absolutePath: string
}

/**
 * Both invalidated by the daemon's `file-tree` and `scope` events. Listed on the writes too,
 * because a hide or a pin has to redraw the list before the next push arrives — otherwise the
 * row you just hid stays on screen until something else moves.
 */
const TREE_INVALIDATIONS = ['readDir', 'pinnedEntries', 'searchFiles'] as const

function toEntries(repoPath: string, entries: readonly DirEntry[] | undefined): FileEntry[] {
  if (entries === undefined) return []
  const mapped: FileEntry[] = []
  for (const entry of entries) {
    const relative = relativePath(repoPath, entry.path)
    // A daemon row that resolves outside the repo (a stale pin from another checkout) has no
    // honest place in a repo-relative tab — dropping it beats rendering a path that lies.
    if (relative === null) continue
    mapped.push({ ...entry, absolutePath: entry.path, path: relative })
  }
  return mapped
}

/**
 * One directory's entries. The daemon sorts (directories first, then name) and applies the
 * repo's hidden list, so this is a read, not a derivation.
 */
export function useDirEntries(
  relative: string,
  active: boolean,
): { entries: FileEntry[]; isLoading: boolean; error: Error | null } {
  const repo = useActiveRepo()
  const showHidden = useFilesStore((state) => state.showHidden)
  const repoPath = repo?.path ?? ''
  const path = absolutePath(repoPath, relative)

  // The daemon pushes `file-tree` for directories a session registered, so an agent creating
  // a file in the terminal redraws this list without a poll.
  useDaemonWatch({ dirs: active && repo !== null ? [path] : [] })

  const { data, error, isLoading } = useDaemonQuery(
    readDirQuery,
    { path, repoPath, showHidden },
    { enabled: active && repo !== null, placeholderData: 'keepPreviousData' },
  )

  return {
    entries: useMemo(() => toEntries(repoPath, data), [data, repoPath]),
    error,
    isLoading,
  }
}

/** The repo's pinned paths — the first half of the Files companion. */
export function usePinnedEntries(active: boolean): {
  entries: FileEntry[]
  isLoading: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const repoPath = repo?.path ?? ''
  const { data, error, isLoading } = useDaemonQuery(pinnedEntriesQuery, repoPath, {
    enabled: active && repo !== null,
  })

  return {
    entries: useMemo(() => toEntries(repoPath, data), [data, repoPath]),
    error,
    isLoading,
  }
}

export type FileContents = {
  view: FileView | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * One file's contents.
 *
 * Watched rather than polled: an open file is exactly what the daemon's `watch:files` set is
 * for, and a poll would re-read a megabyte of source every few seconds to learn nothing.
 */
export function useFileContents(relative: string, active: boolean): FileContents {
  const repo = useActiveRepo()
  const path = absolutePath(repo?.path ?? '', relative)
  const enabled = active && repo !== null && relative !== ''

  useDaemonWatch({ files: enabled ? [path] : [] })

  const { data, error, isLoading } = useDaemonQuery(readFileQuery, path, {
    enabled,
    placeholderData: 'keepPreviousData',
  })
  return { error, isLoading, view: data }
}

/**
 * Fuzzy path search across the repo's tracked files.
 *
 * `searchFiles` already answers repo-relative paths and already caps and de-scopes the result
 * set daemon-side, so nothing here converts or filters. An empty query is not a search: it
 * would ask the daemon to rank every file in the repo.
 */
export function useFileSearch(
  query: string,
  active: boolean,
): { results: FileSearchResult[]; isLoading: boolean; error: Error | null } {
  const repo = useActiveRepo()
  const trimmed = query.trim()
  const { data, error, isLoading } = useDaemonQuery(
    searchFilesQuery,
    { query: trimmed, repoPath: repo?.path ?? '' },
    {
      enabled: active && repo !== null && trimmed !== '',
      placeholderData: 'keepPreviousData',
      staleTime: 10_000,
    },
  )

  return {
    error,
    isLoading: isLoading && trimmed !== '',
    results: data ?? [],
  }
}

/**
 * The repo-scope writes behind a row's long-press menu: pin a path to the companion, or hide
 * it from the tree.
 *
 * Scope is per-repo daemon state (`.porcelain/scope.json`), not git — hiding a folder is how
 * a monorepo becomes readable, and it never touches the working tree.
 */
export function usePathScope(): {
  pin: (relative: string) => Promise<void>
  unpin: (relative: string) => Promise<void>
  hide: (relative: string) => Promise<void>
  unhide: (relative: string) => Promise<void>
  isPending: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const pin = useDaemonMutation(pinPathMutation, { invalidates: TREE_INVALIDATIONS })
  const unpin = useDaemonMutation(unpinPathMutation, { invalidates: TREE_INVALIDATIONS })
  const hide = useDaemonMutation(hidePathMutation, { invalidates: TREE_INVALIDATIONS })
  const unhide = useDaemonMutation(unhidePathMutation, { invalidates: TREE_INVALIDATIONS })

  const run = async (mutation: typeof pin, relative: string): Promise<void> => {
    if (repo === null) return
    await mutation.mutateAsync({ path: absolutePath(repo.path, relative), repoPath: repo.path })
  }

  return {
    error: pin.error ?? unpin.error ?? hide.error ?? unhide.error,
    hide: (relative) => run(hide, relative),
    isPending: pin.isPending || unpin.isPending || hide.isPending || unhide.isPending,
    pin: (relative) => run(pin, relative),
    unhide: (relative) => run(unhide, relative),
    unpin: (relative) => run(unpin, relative),
  }
}

/** Per-repo quick notes — the second half of the Files companion. `''` for a fresh repo. */
export function useRepoNotes(active: boolean): {
  notes: string | undefined
  save: (notes: string) => Promise<void>
  isSaving: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const { data, error } = useDaemonQuery(repoNotesQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
  })
  const mutation = useDaemonMutation(setRepoNotesMutation, { invalidates: ['repoNotes'] })

  return {
    error: error ?? mutation.error,
    isSaving: mutation.isPending,
    notes: data,
    save: async (notes: string): Promise<void> => {
      if (repo === null) return
      await mutation.mutateAsync({ notes, repoPath: repo.path })
    },
  }
}
