import { actionsMutations, actionsProjectKey } from '@porcelain/client-runtime/actions'
import type { ActionWhere } from '@porcelain/contracts/actions'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { environmentClientFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateActionsIdentities } from './actions-query-key'
import { useSelectedProjectId } from './actions-scope'

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
  const projectId = useSelectedProjectId()
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
  const environmentId = useHubSelectionStore((state) =>
    state.selection.kind === 'home' ? null : state.selection.environmentId,
  )
  const owner = environmentClientFor(environmentId, client)

  const ownerClient = () => {
    if (environmentId === null) return client
    if (owner === null) throw new Error('The target Environment is offline.')
    return owner.client
  }

  return {
    add: async (input: NewActionInput): Promise<void> => {
      if (projectId === null) return
      const wire = {
        projectId: actionsProjectKey(projectId),
        title: input.title,
        command: input.command,
        where: input.where,
      }
      await ownerClient().addAction.mutate(wire)
      await invalidateActionsIdentities(
        queryClient,
        daemonScope,
        actionsMutations.add.affectedQueries(wire),
      )
    },
    update: async (id: string, fields: NewActionInput): Promise<void> => {
      if (projectId === null) return
      const wire = {
        projectId: actionsProjectKey(projectId),
        id,
        title: fields.title,
        command: fields.command,
        where: fields.where,
      }
      await ownerClient().updateAction.mutate(wire)
      await invalidateActionsIdentities(
        queryClient,
        daemonScope,
        actionsMutations.update.affectedQueries(wire),
      )
    },
    move: async (id: string, direction: 'up' | 'down'): Promise<void> => {
      if (projectId === null) return
      const wire = {
        projectId: actionsProjectKey(projectId),
        id,
        direction,
      }
      await ownerClient().moveAction.mutate(wire)
      await invalidateActionsIdentities(
        queryClient,
        daemonScope,
        actionsMutations.move.affectedQueries(wire),
      )
    },
    remove: async (id: string): Promise<void> => {
      if (projectId === null) return
      const wire = {
        projectId: actionsProjectKey(projectId),
        id,
      }
      await ownerClient().deleteAction.mutate(wire)
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
  const projectId = useSelectedProjectId()
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client
  const environmentId = useHubSelectionStore((state) =>
    state.selection.kind === 'home' ? null : state.selection.environmentId,
  )
  const owner = environmentClientFor(environmentId, client)

  return async (id: string): Promise<void> => {
    if (projectId === null) return
    const wire = { projectId: actionsProjectKey(projectId), ids: [id] }
    const ownerClient =
      environmentId === null
        ? client
        : (owner?.client ??
          (() => {
            throw new Error('The target Environment is offline.')
          })())
    await ownerClient.trustActions.mutate(wire)
    await invalidateActionsIdentities(
      queryClient,
      daemonScope,
      actionsMutations.trust.affectedQueries(wire),
    )
  }
}
