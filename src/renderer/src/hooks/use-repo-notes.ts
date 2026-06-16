import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/** Per-repo quick notes (markdown string), persisted in the app config store. */
export function useRepoNotes(): string | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.repoNotes.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data
}

export function useSetRepoNotes(): { save: (repoPath: string | undefined, notes: string) => void } {
  const utils = trpc.useUtils()
  const mutation = trpc.setRepoNotes.useMutation({
    // Keep the cache in step so a repo switch and back shows the latest notes
    // without a network round-trip; notes never touch git, so nothing else.
    onSuccess: () => utils.repoNotes.invalidate(),
  })
  return {
    save: (repoPath, notes) => {
      if (!repoPath) return
      mutation.mutate({ repoPath, notes })
    },
  }
}
