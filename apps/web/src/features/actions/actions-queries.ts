import type { ActionView } from '@porcelain/contracts/actions'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQuery } from '@tanstack/react-query'
import { actionsListKeyForProject } from './actions-query-key'

/**
 * Actions list read adapter (ACT-003).
 *
 * Binds ACT-002 list identity + daemon scope to React Query and invokes the
 * `actions` procedure through the vanilla tRPC client. Procedure-name keys are never used.
 */

/** All saved actions for the current project (live-refreshed when the agent curates them). */
export function useActions(enabled = true): ActionView[] {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonIdentity()
  const projectPath = project?.path ?? null
  const daemonScope: DaemonScope = { host: daemon.host, version: daemon.version }
  const utils = trpc.useUtils()

  const query = useQuery({
    queryKey: projectPath
      ? actionsListKeyForProject(daemonScope, projectPath)
      : ([{ domain: 'actions', name: 'list', projectPath: '' }, daemonScope] as const),
    queryFn: async (): Promise<ActionView[]> => {
      if (projectPath === null) return []
      return utils.client.actions.query(projectPath)
    },
    enabled: enabled && projectPath !== null,
  })

  return query.data ?? []
}
