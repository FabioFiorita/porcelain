import { repoNotesQuery, setRepoNotesMutation } from '@/lib/daemon/procedures/notes'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

/** Per-repo quick notes; this companion hook remains on the notes procedure seam. */
export function useRepoNotes(active: boolean): {
  notes: string | undefined
  save: (notes: string) => Promise<void>
  isSaving: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const query = useDaemonQuery(repoNotesQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
  })
  const mutation = useDaemonMutation(setRepoNotesMutation, { invalidates: ['repoNotes'] })
  return {
    error: query.error ?? mutation.error,
    isSaving: mutation.isPending,
    notes: query.data,
    save: async (notes): Promise<void> => {
      if (repo === null) return
      await mutation.mutateAsync({ notes, repoPath: repo.path })
    },
  }
}
