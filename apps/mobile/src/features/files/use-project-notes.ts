import { useActiveProject } from '@/features/projects'
import { repoNotesQuery, setRepoNotesMutation } from '@/lib/daemon/procedures/notes'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

/** Per-project quick notes; this companion hook remains on the notes procedure seam. */
export function useProjectNotes(active: boolean): {
  notes: string | undefined
  save: (notes: string) => Promise<void>
  isSaving: boolean
  error: Error | null
} {
  const project = useActiveProject()
  const query = useDaemonQuery(repoNotesQuery, project?.path ?? '', {
    enabled: active && project !== null,
  })
  const mutation = useDaemonMutation(setRepoNotesMutation, { invalidates: ['repoNotes'] })
  return {
    error: query.error ?? mutation.error,
    isSaving: mutation.isPending,
    notes: query.data,
    save: async (notes): Promise<void> => {
      if (project === null) return
      await mutation.mutateAsync({ notes, repoPath: project.path })
    },
  }
}
