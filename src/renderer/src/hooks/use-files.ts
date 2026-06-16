import type { DirEntry, FileView } from '@main/api'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useSelectionStore } from '@renderer/stores/selection'
import { useCallback } from 'react'

export function useReadDir(path: string, enabled = true): DirEntry[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const { data } = trpc.readDir.useQuery(
    { repoPath: repo?.path ?? '', path, showHidden },
    { enabled: enabled && repo !== null },
  )
  return data
}

export function useReadFile(path: string): {
  view: FileView | undefined
  error: { message: string } | null
} {
  const { data: view, error } = trpc.readFile.useQuery(path)
  return { view, error }
}

/** Prefetch a file's contents (tree hover) so opening it feels instant. */
export function useReadFilePrefetch(): (path: string) => Promise<void> {
  const utils = trpc.useUtils()
  return (path) => utils.readFile.prefetch(path)
}

export function useWriteTextFile(path: string): {
  save: (content: string) => void
  isSaving: boolean
  error: { message: string } | null
} {
  const utils = trpc.useUtils()
  const mutation = trpc.writeTextFile.useMutation({
    onSuccess: async (_data, variables) => {
      // the edit changes git state too, not just the file
      await Promise.all([
        utils.readFile.invalidate(variables.path),
        utils.gitFlow.invalidate(),
        utils.gitDiffFile.invalidate(),
      ])
    },
  })
  return {
    save: (content) => mutation.mutate({ path, content }),
    isSaving: mutation.isPending,
    error: mutation.error,
  }
}

export function usePinnedEntries(): DirEntry[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.pinnedEntries.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data
}

export function useRevealInFinder(): (path: string) => void {
  const mutation = trpc.revealInFinder.useMutation()
  return (path) => mutation.mutate(path)
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
  })
  return (path) => mutation.mutateAsync(path)
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
    await Promise.all([utils.readDir.invalidate(), utils.pinnedEntries.invalidate()])
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
