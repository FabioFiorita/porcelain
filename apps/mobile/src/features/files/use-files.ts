import { isFilesProjectRelativePath } from '@porcelain/contracts/files'
import { useMemo } from 'react'
import {
  type CodeSearchOptions,
  type CodeSearchResult,
  createFileMutation,
  createFolderMutation,
  type DirEntry,
  duplicatePathMutation,
  type FileSearchResult,
  type FileView,
  hidePathMutation,
  pinnedEntriesQuery,
  pinPathMutation,
  previewHtmlQuery,
  readDirQuery,
  readFileQuery,
  renamePathMutation,
  searchCodeQuery,
  searchFilesQuery,
  trashPathMutation,
  unhidePathMutation,
  unpinPathMutation,
} from '@/lib/daemon/procedures/files'
import { repoNotesQuery, setRepoNotesMutation } from '@/lib/daemon/procedures/notes'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useDaemonWatch } from '@/lib/daemon/watch'

import { absolutePath, parentPath, relativePath } from './file-paths'
import { useFilesStore } from './files-store'

/** Valid typed disabled query input — always pass with enabled:false (never null/cast). */
const DISABLED_FILES_QUERY_INPUT = {
  projectPath: '/',
  path: '__disabled__',
} as const

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

/**
 * What a working-tree write makes stale: the same list a `file-tree` push invalidates, plus the
 * reads only a write can invalidate — the open file's contents (a rename moves it out from
 * under the viewer) and any content search still showing lines that have moved.
 */
const WRITE_INVALIDATIONS = [...TREE_INVALIDATIONS, 'readFile', 'searchCode', 'searchText'] as const

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
 * Watched rather than polled: an open file is exactly what session watch interests are for,
 * and a poll would re-read a megabyte of source every few seconds to learn nothing.
 */
export function useFileContents(relative: string, active: boolean): FileContents {
  const repo = useActiveRepo()
  const valid = repo !== null && relative !== '' && isFilesProjectRelativePath(relative)
  const enabled = active && valid
  // Watch still absolute until a later unit.
  useDaemonWatch({ files: enabled && repo ? [absolutePath(repo.path, relative)] : [] })

  const { data, error, isLoading } = useDaemonQuery(
    readFileQuery,
    valid && repo ? { projectPath: repo.path, path: relative } : DISABLED_FILES_QUERY_INPUT,
    { enabled },
  )
  return { error, isLoading, view: data }
}

/**
 * An HTML file as the daemon prepares it for preview: read from disk with its local sibling
 * images inlined as data URIs, so a page can show its own screenshots inside a WebView that is
 * allowed no network at all.
 *
 * `null` rather than an error when the daemon declines — missing, empty, or past the size cap.
 * Only fetched while the preview is actually on screen; the source view has no use for it.
 */
export function useHtmlPreview(
  relative: string,
  enabled: boolean,
): { html: string | null | undefined; isLoading: boolean; error: Error | null } {
  const repo = useActiveRepo()
  const valid = repo !== null && relative !== '' && isFilesProjectRelativePath(relative)
  const { data, error, isLoading } = useDaemonQuery(
    previewHtmlQuery,
    valid && repo ? { projectPath: repo.path, path: relative } : DISABLED_FILES_QUERY_INPUT,
    { enabled: enabled && valid },
  )
  return { error, html: data, isLoading }
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
 * Repo-wide **content** search — the desktop Search tab's read, not the ⌘P finder's.
 *
 * The daemon runs `git grep` and answers per-file context hunks with a truncation flag, so
 * nothing here re-groups or re-caps. The caller debounces the whole option set: a keystroke in
 * the exclude field is as much a new search as a keystroke in the query.
 */
export function useCodeSearch(
  options: CodeSearchOptions,
  active: boolean,
): { result: CodeSearchResult | undefined; isLoading: boolean; error: Error | null } {
  const repo = useActiveRepo()
  const trimmed = options.query.trim()
  const { data, error, isLoading } = useDaemonQuery(
    searchCodeQuery,
    { ...options, query: trimmed, repoPath: repo?.path ?? '' },
    {
      enabled: active && repo !== null && trimmed !== '',
      placeholderData: 'keepPreviousData',
      staleTime: 10_000,
    },
  )

  return { error, isLoading: isLoading && trimmed !== '', result: data }
}

export type FileWrites = {
  /** Create an empty file named `name` inside the repo-relative directory `dir`. */
  createFile: (dir: string, name: string) => Promise<void>
  createFolder: (dir: string, name: string) => Promise<void>
  /** Rename in place — `name` is a bare name, never a path. */
  rename: (relative: string, name: string) => Promise<void>
  /** Copy to a free "… copy" sibling; answers the new path, repo-relative. */
  duplicate: (relative: string) => Promise<string | null>
  /** The OS trash, not `rm`. */
  trash: (relative: string) => Promise<void>
  isPending: boolean
}

/**
 * The working-tree writes behind a row's long-press menu.
 *
 * Invalidate-only, like every other write on this seam: the daemon is the truth about what is
 * on disk, and a tree that paints a file the daemon refused to create is worse than a tree that
 * redraws a beat later. Every one of these rejects with the daemon's own message — a name
 * collision, a read-only directory — and the caller is expected to show it.
 */
export function useFileWrites(): FileWrites {
  const repo = useActiveRepo()
  const create = useDaemonMutation(createFileMutation, { invalidates: WRITE_INVALIDATIONS })
  const folder = useDaemonMutation(createFolderMutation, { invalidates: WRITE_INVALIDATIONS })
  const rename = useDaemonMutation(renamePathMutation, { invalidates: WRITE_INVALIDATIONS })
  const duplicate = useDaemonMutation(duplicatePathMutation, { invalidates: WRITE_INVALIDATIONS })
  const trash = useDaemonMutation(trashPathMutation, { invalidates: WRITE_INVALIDATIONS })

  return {
    createFile: async (dir, name): Promise<void> => {
      if (repo === null) return
      const path = dir === '' ? name : `${dir}/${name}`
      if (!isFilesProjectRelativePath(path)) return
      await create.mutateAsync({ projectPath: repo.path, path })
    },
    createFolder: async (dir, name): Promise<void> => {
      if (repo === null) return
      const path = dir === '' ? name : `${dir}/${name}`
      if (!isFilesProjectRelativePath(path)) return
      await folder.mutateAsync({ projectPath: repo.path, path })
    },
    duplicate: async (relative): Promise<string | null> => {
      if (repo === null || !isFilesProjectRelativePath(relative)) return null
      // Daemon returns project-relative path directly.
      return await duplicate.mutateAsync({ projectPath: repo.path, path: relative })
    },
    isPending:
      create.isPending ||
      folder.isPending ||
      rename.isPending ||
      duplicate.isPending ||
      trash.isPending,
    rename: async (relative, name): Promise<void> => {
      if (repo === null || !isFilesProjectRelativePath(relative)) return
      const parent = parentPath(relative)
      const to = parent === '' ? name : `${parent}/${name}`
      if (!isFilesProjectRelativePath(to)) return
      await rename.mutateAsync({ projectPath: repo.path, from: relative, to })
    },
    trash: async (relative): Promise<void> => {
      if (repo === null || !isFilesProjectRelativePath(relative)) return
      await trash.mutateAsync({ projectPath: repo.path, path: relative })
    },
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
