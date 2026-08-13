import { gitFlowQuery, gitRangeFlowQuery, gitStatusQuery } from '@porcelain/client-runtime/git'
import { projectDataMutations, projectDataProjectKey } from '@porcelain/client-runtime/project-data'
import type { CompanionDispositionValue, Layer } from '@porcelain/contracts/project-data'
import { invalidateGitEffects } from '@renderer/features/git'
import { invalidateAfterSuccess, onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateProjectDataIdentities } from './project-data-query-key'

/**
 * Web Project Data mutation adapter (PDT-003).
 *
 * Non-optimistic: vanilla client mutate, then exact identity invalidation plus
 * the ruling-3 Git/Review refresh. Notes `save` stays void (`mutate`).
 */

function daemonScopeFromIdentity(daemon: {
  host: string | null
  version: string | null
}): DaemonScope {
  return { host: daemon.host, version: daemon.version }
}

export function useSetProjectNotes(): {
  save: (projectPath: string | undefined, notes: string) => void
} {
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
  const mutation = useMutation({
    mutationFn: (input: { repoPath: string; notes: string }) => client.setRepoNotes.mutate(input),
    onSuccess: (_data, input) =>
      invalidateProjectDataIdentities(
        queryClient,
        daemonScope,
        projectDataMutations.setRepoNotes.affectedQueries(input),
      ),
    onError: onMutationError('Save notes'),
  })
  return {
    save: (projectPath: string | undefined, notes: string): void => {
      if (!projectPath) return
      mutation.mutate({ repoPath: projectDataProjectKey(projectPath), notes })
    },
  }
}

export function useSetProjectLayers(): {
  save: (layers: Layer[] | null) => Promise<void>
  isSaving: boolean
} {
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation({
    mutationFn: (input: { repoPath: string; layers: Layer[] | null }) =>
      utils.client.setRepoLayers.mutate(input),
  })
  return {
    save: async (layers: Layer[] | null): Promise<void> => {
      const projectPath = useProjectSelectionStore.getState().project?.path
      if (!projectPath) return
      const wire = { repoPath: projectDataProjectKey(projectPath), layers }
      await mutation.mutateAsync(wire)
      await invalidateAfterSuccess(
        [
          invalidateProjectDataIdentities(
            queryClient,
            daemonScope,
            projectDataMutations.setRepoLayers.affectedQueries(wire),
          ),
          invalidateGitEffects(queryClient, daemonScope, [
            gitFlowQuery(wire.repoPath),
            gitRangeFlowQuery(wire.repoPath),
          ]),
          utils.activeReview.invalidate(),
          utils.reviewReading.invalidate(),
          utils.exploreReading.invalidate(),
        ],
        'Save layers',
      )
    },
    isSaving: mutation.isPending,
  }
}

export function useSetCompanionGitVisibility(): (hidden: boolean) => Promise<void> {
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
  const mutation = useMutation({
    mutationFn: (input: { repoPath: string; hidden: boolean }) =>
      client.setCompanionGitVisibility.mutate(input),
    onError: onMutationError('Change git visibility'),
  })
  return async (hidden: boolean): Promise<void> => {
    const repoPath = useProjectSelectionStore.getState().project?.path
    if (!repoPath) return
    const wire = { repoPath: projectDataProjectKey(repoPath), hidden }
    await mutation.mutateAsync(wire)
    await invalidateAfterSuccess(
      [
        invalidateProjectDataIdentities(
          queryClient,
          daemonScope,
          projectDataMutations.setCompanionGitVisibility.affectedQueries(wire),
        ),
        invalidateGitEffects(queryClient, daemonScope, [gitStatusQuery(wire.repoPath)]),
      ],
      'Change git visibility',
    )
  }
}

export function useSetCompanionDisposition(): {
  set: (key: string, disposition: CompanionDispositionValue) => Promise<string[]>
  isSaving: boolean
} {
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
  const mutation = useMutation({
    mutationFn: (input: {
      repoPath: string
      key: string
      disposition: CompanionDispositionValue
    }) => client.setCompanionDisposition.mutate(input),
    onError: onMutationError('Change what git carries'),
  })
  return {
    set: async (key, disposition): Promise<string[]> => {
      const repoPath = useProjectSelectionStore.getState().project?.path
      if (!repoPath) return []
      const wire = { repoPath: projectDataProjectKey(repoPath), key, disposition }
      const result = await mutation.mutateAsync(wire)
      await invalidateAfterSuccess(
        [
          invalidateProjectDataIdentities(
            queryClient,
            daemonScope,
            projectDataMutations.setCompanionDisposition.affectedQueries(wire),
          ),
          invalidateGitEffects(queryClient, daemonScope, [gitStatusQuery(wire.repoPath)]),
        ],
        'Change what git carries',
      )
      return result.untracked
    },
    isSaving: mutation.isPending,
  }
}
