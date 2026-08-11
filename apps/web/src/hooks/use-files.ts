import type { DirEntry, FileView } from '@backend/api'
import { isFilesProjectRelativePath } from '@porcelain/contracts/files'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { shellTrpc, trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useSelectionStore } from '@renderer/stores/selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useCallback } from 'react'

/** Strip trailing slashes except root `/`. */
export function normalizeProjectRoot(projectPath: string): string {
  const trimmed = projectPath.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/**
 * Convert a daemon-host absolute path to a project-relative wire path.
 * Returns null when outside, equal to root, empty relative, or not a valid
 * filesProjectRelativePath (including embedded .. segments).
 */
export function projectRelativeFromAbsolute(
  projectPath: string,
  absolutePath: string,
): string | null {
  const root = normalizeProjectRoot(projectPath)
  if (absolutePath === root) return null
  const prefix = root === '/' ? '/' : `${root}/`
  if (!absolutePath.startsWith(prefix)) return null
  const rel = absolutePath.slice(prefix.length)
  if (rel === '') return null
  // Reject repeated separators / dot segments without accepting outside paths
  if (!isFilesProjectRelativePath(rel)) return null
  return rel
}

/**
 * Convert project-relative wire path back to UI absolute.
 * Normalized root `/` → `/${relative}` — NEVER `//${relative}`.
 */
export function projectAbsoluteFromRelative(projectPath: string, relative: string): string {
  const root = normalizeProjectRoot(projectPath)
  if (root === '/') return `/${relative}`
  return `${root}/${relative}`
}

/** Valid typed disabled query input — always pass this (never null/cast) when the query hook must run disabled. */
export const DISABLED_FILES_QUERY_INPUT = {
  projectPath: '/',
  path: '__disabled__',
} as const
// Satisfies readFileInputSchema / previewHtmlInputSchema (projectPath `/` is valid; path `__disabled__` is a valid relative).

export function useReadDir(path: string, enabled = true): DirEntry[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const { data } = trpc.readDir.useQuery(
    { repoPath: repo?.path ?? '', path, showHidden },
    { enabled: enabled && repo !== null },
  )
  return data
}

export function useReadFile(
  path: string,
  enabled = true,
): {
  view: FileView | undefined
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const rel = repo ? projectRelativeFromAbsolute(repo.path, path) : null
  const { data: view, error } = trpc.readFile.useQuery(
    rel && repo
      ? { projectPath: normalizeProjectRoot(repo.path), path: rel }
      : DISABLED_FILES_QUERY_INPUT,
    {
      // Agent markdown images call this with enabled=false for data:/remote srcs so
      // we never hit the daemon with an empty path or a URL it can't open.
      enabled: enabled && repo !== null && rel !== null && path !== '',
    },
  )
  return { view, error }
}

/**
 * Sandboxed HTML preview for a path: daemon reads the file and inlines relative
 * sibling images as data URIs. Only enabled while the HTML preview mode is active.
 */
export function usePreviewHtml(
  path: string,
  enabled: boolean,
): { html: string | null | undefined; error: { message: string } | null } {
  const repo = useRepoStore((s) => s.repo)
  const rel = repo ? projectRelativeFromAbsolute(repo.path, path) : null
  const { data: html, error } = trpc.previewHtml.useQuery(
    rel && repo
      ? { projectPath: normalizeProjectRoot(repo.path), path: rel }
      : DISABLED_FILES_QUERY_INPUT,
    { enabled: enabled && repo !== null && rel !== null && path !== '' },
  )
  return { html, error }
}

/** Prefetch a file's contents (tree hover) so opening it feels instant. */
export function useReadFilePrefetch(): (path: string) => Promise<void> {
  const utils = trpc.useUtils()
  const repo = useRepoStore((s) => s.repo)
  return (path: string): Promise<void> => {
    if (!repo) return Promise.resolve()
    const rel = projectRelativeFromAbsolute(repo.path, path)
    if (rel === null) return Promise.resolve()
    return utils.readFile.prefetch({
      projectPath: normalizeProjectRoot(repo.path),
      path: rel,
    })
  }
}

export function useWriteTextFile(path: string): {
  save: (content: string, onSaved?: () => void) => void
  isSaving: boolean
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.writeTextFile.useMutation({
    onSuccess: async (
      _data: unknown,
      variables: { projectPath: string; path: string; content: string },
    ): Promise<void> => {
      // the edit changes git state too, not just the file
      await Promise.all([
        utils.readFile.invalidate({ projectPath: variables.projectPath, path: variables.path }),
        utils.previewHtml.invalidate({ projectPath: variables.projectPath, path: variables.path }),
        utils.gitFlow.invalidate(),
        utils.gitDiffFile.invalidate(),
      ])
    },
  })
  return {
    // Per-call onSuccess runs *in addition to* the hook-level one (TanStack v5);
    // it lets the caller advance its saved-watermark only once the write settles.
    save: (content: string, onSaved?: () => void): void => {
      if (!repo) return
      const rel = projectRelativeFromAbsolute(repo.path, path)
      if (rel === null) return
      mutation.mutate(
        { projectPath: normalizeProjectRoot(repo.path), path: rel, content },
        { onSuccess: onSaved },
      )
    },
    isSaving: mutation.isPending,
    error: mutation.error,
  }
}

export function usePinnedEntries(): DirEntry[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.pinnedEntries.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data
}

/** Monorepo hide/pin lists; empty arrays when the repo has never configured scope. */
export function useRepoScope(): { hiddenPaths: string[]; pinnedPaths: string[] } | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.repoScope.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data
}

export function useRevealInFinder(): (path: string) => void {
  const mutation = shellTrpc.revealInFinder.useMutation()
  return (path: string): void => mutation.mutate(path)
}

/** Drop stale tree + pinned rows after a file vanished from disk (external delete). */
export function useRefreshTree(): () => void {
  const utils = trpc.useUtils()
  // Stable identity so callers can safely list it in effect deps without re-firing.
  return useCallback(() => {
    utils.readDir.invalidate()
    utils.pinnedEntries.invalidate()
  }, [utils])
}

export function useTrashPath(): (path: string) => Promise<void> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.trashPath.useMutation({
    onSuccess: async () => {
      // a deleted file leaves the tree, the pinned list, and git's working tree
      await Promise.all([
        utils.readDir.invalidate(),
        utils.pinnedEntries.invalidate(),
        utils.gitFlow.invalidate(),
      ])
    },
    // The confirm dialog now closes on click, so a silent failure would leave the file
    // in place with no feedback — surface why (permission denied, locked file, …).
    onError: onMutationError('Delete'),
  })
  return async (path: string): Promise<void> => {
    if (!repo) return
    const rel = projectRelativeFromAbsolute(repo.path, path)
    if (rel === null) return
    try {
      await mutation.mutateAsync({
        projectPath: normalizeProjectRoot(repo.path),
        path: rel,
      })
      // The file is gone from disk; close any open view of it so the viewer doesn't
      // render a dead tab (the tree keys a file tab by this same absolute path).
      useTabsStore.getState().closeTabEverywhere(tabId('file', path))
    } catch {
      // Already surfaced by the mutation's onError toast; swallow so the click handler's
      // floating promise doesn't reject unhandled.
    }
  }
}

// Creating/renaming/duplicating a path changes the same three views a delete does:
// the tree, the pinned list, and git's working tree (a new or renamed file is a new
// change). The hooks throw on conflict (file exists) so callers can surface the error.
function invalidateTree(utils: ReturnType<typeof trpc.useUtils>): Promise<unknown> {
  return Promise.all([
    utils.readDir.invalidate(),
    utils.pinnedEntries.invalidate(),
    utils.gitFlow.invalidate(),
  ])
}

export function useCreateFile(): {
  create: (path: string) => Promise<void>
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.createFile.useMutation({ onSuccess: () => invalidateTree(utils) })
  return {
    create: async (path: string): Promise<void> => {
      if (!repo) return
      const rel = projectRelativeFromAbsolute(repo.path, path)
      if (rel === null) return
      await mutation.mutateAsync({ projectPath: normalizeProjectRoot(repo.path), path: rel })
    },
    error: mutation.error,
  }
}

export function useCreateFolder(): {
  create: (path: string) => Promise<void>
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.createFolder.useMutation({ onSuccess: () => invalidateTree(utils) })
  return {
    create: async (path: string): Promise<void> => {
      if (!repo) return
      const rel = projectRelativeFromAbsolute(repo.path, path)
      if (rel === null) return
      await mutation.mutateAsync({ projectPath: normalizeProjectRoot(repo.path), path: rel })
    },
    error: mutation.error,
  }
}

export function useRenamePath(): {
  rename: (from: string, to: string) => Promise<void>
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.renamePath.useMutation({ onSuccess: () => invalidateTree(utils) })
  return {
    rename: async (from: string, to: string): Promise<void> => {
      if (!repo) return
      const fromRel = projectRelativeFromAbsolute(repo.path, from)
      const toRel = projectRelativeFromAbsolute(repo.path, to)
      if (fromRel === null || toRel === null) return
      await mutation.mutateAsync({
        projectPath: normalizeProjectRoot(repo.path),
        from: fromRel,
        to: toRel,
      })
    },
    error: mutation.error,
  }
}

/**
 * Duplicate returns absolute UI path on success, or null when no mutation ran
 * (no repo / invalid conversion). Callers that ignore the result need no edits:
 * tree-node.tsx, file-commands.tsx.
 */
export function useDuplicatePath(): (path: string) => Promise<string | null> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.duplicatePath.useMutation({ onSuccess: () => invalidateTree(utils) })
  return async (path: string): Promise<string | null> => {
    if (!repo) return null
    const rel = projectRelativeFromAbsolute(repo.path, path)
    if (rel === null) return null
    const relativeNew = await mutation.mutateAsync({
      projectPath: normalizeProjectRoot(repo.path),
      path: rel,
    })
    return projectAbsoluteFromRelative(repo.path, relativeNew)
  }
}

export function useEntryActions(entry: DirEntry): {
  hide: () => Promise<void>
  unhide: () => Promise<void>
  hideSelected: () => Promise<void>
  pin: () => Promise<void>
  unpin: () => Promise<void>
  selectionSize: number
} {
  const repo = useRepoStore((s) => s.repo)
  const selected = useSelectionStore((s) => s.selected)
  const clearSelection = useSelectionStore((s) => s.clear)
  const utils = trpc.useUtils()
  const hideMutation = trpc.hidePath.useMutation()
  const unhideMutation = trpc.unhidePath.useMutation()
  const pinMutation = trpc.pinPath.useMutation()
  const unpinMutation = trpc.unpinPath.useMutation()

  const run = async (mutation: typeof hideMutation, paths: string[]): Promise<void> => {
    if (!repo) return
    for (const path of paths) {
      await mutation.mutateAsync({ repoPath: repo.path, path })
    }
    clearSelection()
    await Promise.all([
      utils.readDir.invalidate(),
      utils.pinnedEntries.invalidate(),
      utils.repoScope.invalidate(),
    ])
  }

  return {
    hide: () => run(hideMutation, [entry.path]),
    unhide: () => run(unhideMutation, [entry.path]),
    hideSelected: () => run(hideMutation, [...new Set([...selected, entry.path])]),
    pin: () => run(pinMutation, [entry.path]),
    unpin: () => run(unpinMutation, [entry.path]),
    selectionSize: selected.size,
  }
}
