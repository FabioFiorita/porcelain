import {
  projectDataDispositionsQuery,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import type { ChannelDispositionValue } from '@porcelain/contracts/project-data'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQuery } from '@tanstack/react-query'
import { projectDataQueryKey } from './project-data-query-key'

/**
 * Web Project Data read adapter (PDT-003).
 *
 * Binds PDT-003 identities + daemon scope to React Query and invokes the live
 * procedures through the vanilla tRPC client. Procedure-name keys are never used.
 */

function daemonScopeFromIdentity(daemon: {
  host: string | null
  version: string | null
}): DaemonScope {
  return { host: daemon.host, version: daemon.version }
}

const DISABLED_DISPOSITIONS = {
  domain: 'project-data',
  name: 'dispositions',
  projectPath: '/',
} as const

const DISABLED_VISIBILITY = {
  domain: 'project-data',
  name: 'visibility',
  projectPath: '/',
} as const

export function useCompanionDispositions(): ChannelDispositionValue[] | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const projectPath = project?.path ?? null
  const client = trpc.useUtils().client

  const query = useQuery({
    queryKey: projectPath
      ? projectDataQueryKey(daemonScope, projectDataDispositionsQuery(projectPath))
      : projectDataQueryKey(daemonScope, DISABLED_DISPOSITIONS),
    queryFn: async (): Promise<ChannelDispositionValue[]> => {
      if (projectPath === null) return []
      return client.companionDispositions.query(projectPath)
    },
    enabled: project !== null,
  })

  return query.data
}

/** Whether git is blind to `.porcelain/` in this clone. */
export function useCompanionGitVisibility(): {
  data: { hidden: boolean } | undefined
  isPending: boolean
} {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonIdentity()
  const daemonScope = daemonScopeFromIdentity(daemon)
  const projectPath = project?.path ?? null
  const client = trpc.useUtils().client

  const query = useQuery({
    queryKey: projectPath
      ? projectDataQueryKey(daemonScope, projectDataVisibilityQuery(projectPath))
      : projectDataQueryKey(daemonScope, DISABLED_VISIBILITY),
    queryFn: async (): Promise<{ hidden: boolean }> => {
      if (projectPath === null) return { hidden: false }
      return client.companionGitVisibility.query(projectPath)
    },
    enabled: project !== null,
  })

  return { data: query.data, isPending: query.isPending }
}
