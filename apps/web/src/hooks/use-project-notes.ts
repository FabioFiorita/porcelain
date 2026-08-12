import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'

/** Per-project quick notes (markdown string), persisted in the app config store. */
export function useProjectNotes(): string | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.repoNotes.useQuery(project?.path ?? '', { enabled: project !== null })
  return data
}

export function useSetProjectNotes(): {
  save: (projectPath: string | undefined, notes: string) => void
} {
  const utils = trpc.useUtils()
  const mutation = trpc.setRepoNotes.useMutation({
    // Keep the cache in step so a project switch and back shows the latest notes
    // without a network round-trip; notes never touch git, so nothing else.
    onSuccess: () => utils.repoNotes.invalidate(),
    onError: onMutationError('Save notes'),
  })
  return {
    save: (projectPath: string | undefined, notes: string): void => {
      if (!projectPath) return
      mutation.mutate({ repoPath: projectPath, notes })
    },
  }
}
