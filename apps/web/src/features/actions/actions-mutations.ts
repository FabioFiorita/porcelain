import { actionsMutations, actionsProjectKey } from '@porcelain/client-runtime/actions'
import type { ActionWhere } from '@porcelain/contracts/actions'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateActionsIdentities } from './actions-query-key'

/**
 * Actions mutation adapter (ACT-003).
 *
 * Non-optimistic: success-only exact invalidation of list keys via ACT-002
 * `actionsMutations.*.affectedQueries` (list+trust collapse to one list row).
 * Transport goes through the vanilla tRPC client. Failures reject without toast —
 * the edge the human touched owns the message.
 */

export type NewActionInput = {
  title: string
  command: string
  where?: ActionWhere
}

function daemonScopeFromIdentity(daemon: {
  host: string | null
  version: string | null
}): DaemonScope {
  return { host: daemon.host, version: daemon.version }
}

/** Add/edit/delete/move saved actions. Each successful mutation refreshes the list. */
export function useActionMutations(): {
  add: (input: NewActionInput) => Promise<void>
  update: (id: string, fields: NewActionInput) => Promise<void>
  move: (id: string, direction: 'up' | 'down') => Promise<void>
  remove: (id: string) => Promise<void>
} {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client

  return {
    add: async (input: NewActionInput): Promise<void> => {
      if (!project) return
      const wire = {
        repoPath: actionsProjectKey(project.path),
        title: input.title,
        command: input.command,
        where: input.where,
      }
      await client.addAction.mutate(wire)
      await invalidateActionsIdentities(
        queryClient,
        daemonScope,
        actionsMutations.add.affectedQueries(wire),
      )
    },
    update: async (id: string, fields: NewActionInput): Promise<void> => {
      if (!project) return
      const wire = {
        repoPath: actionsProjectKey(project.path),
        id,
        title: fields.title,
        command: fields.command,
        where: fields.where,
      }
      await client.updateAction.mutate(wire)
      await invalidateActionsIdentities(
        queryClient,
        daemonScope,
        actionsMutations.update.affectedQueries(wire),
      )
    },
    move: async (id: string, direction: 'up' | 'down'): Promise<void> => {
      if (!project) return
      const wire = {
        repoPath: actionsProjectKey(project.path),
        id,
        direction,
      }
      await client.moveAction.mutate(wire)
      await invalidateActionsIdentities(
        queryClient,
        daemonScope,
        actionsMutations.move.affectedQueries(wire),
      )
    },
    remove: async (id: string): Promise<void> => {
      if (!project) return
      const wire = {
        repoPath: actionsProjectKey(project.path),
        id,
      }
      await client.deleteAction.mutate(wire)
      await invalidateActionsIdentities(
        queryClient,
        daemonScope,
        actionsMutations.delete.affectedQueries(wire),
      )
    },
  }
}

/**
 * Accept a command this machine has not run before. Trust is recorded against the
 * command TEXT on this machine only. Rejects rather than toasting: the trust dialog owns failure.
 */
export function useTrustAction(): (id: string) => Promise<void> {
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client

  return async (id: string): Promise<void> => {
    const repoPath = useProjectSelectionStore.getState().project?.path
    if (!repoPath) return
    const wire = { repoPath: actionsProjectKey(repoPath), ids: [id] }
    await client.trustActions.mutate(wire)
    await invalidateActionsIdentities(
      queryClient,
      daemonScope,
      actionsMutations.trust.affectedQueries(wire),
    )
  }
}
