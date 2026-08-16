import type { ActionView } from '@porcelain/contracts/actions'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { environmentSessionFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useQuery } from '@tanstack/react-query'
import { actionsListKeyForProject } from './actions-query-key'
import { useSelectedProjectId } from './actions-scope'

/**
 * Actions list read adapter (ACT-003).
 *
 * Binds ACT-002 list identity + daemon scope to React Query and invokes the
 * `actions` procedure through the vanilla tRPC client. Procedure-name keys are never used.
 */

/**
 * Saved commands for one Project on this window's daemon. Defaults to the Project the
 * Hub selection names; a caller that already resolved a Project id passes it explicitly.
 */
export function useActions(
  enabled = true,
  projectId?: string | null,
  environmentId?: string | null,
): ActionView[] {
  const selectedProjectId = useSelectedProjectId()
  const resolvedProjectId = projectId === undefined ? selectedProjectId : projectId
  const daemon = useDaemonIdentity()
  const daemonScope: DaemonScope = { host: daemon.host, version: daemon.version }
  const utils = trpc.useUtils()
  const owner =
    environmentId === undefined || environmentId === null
      ? { client: utils.client }
      : environmentSessionFor(environmentId)

  const query = useQuery({
    queryKey: resolvedProjectId
      ? [...actionsListKeyForProject(daemonScope, resolvedProjectId), environmentId ?? null]
      : ([{ domain: 'actions', name: 'list', projectId: '' }, daemonScope] as const),
    queryFn: async (): Promise<ActionView[]> => {
      if (resolvedProjectId === null) return []
      if (owner === null) return []
      return owner.client.actions.query({ projectId: resolvedProjectId })
    },
    enabled: enabled && resolvedProjectId !== null,
  })

  return query.data ?? []
}
