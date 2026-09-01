import type { DaemonScope } from '@renderer/lib/daemon-scope'
import {
  daemonScopeForEnvironment,
  environmentClientFor,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath, useHubRepoTarget } from '@renderer/stores/hub-repo'
import { useDaemonIdentity } from './use-daemon-identity'

/** The selected Worktree's authoritative daemon. Unknown secondary ids fail closed. */
export function useHubRepoOwner(): {
  repoPath: string | null
  daemon: DaemonScope
  owner: ReturnType<typeof environmentClientFor>
} {
  const repoPath = useHubRepoPath()
  const target = useHubRepoTarget()
  const identity = useDaemonIdentity()
  const sessionRevision = useEnvironmentSessionsRevision()
  const primary = trpc.useUtils().client
  return {
    repoPath,
    daemon: daemonScopeForEnvironment(target?.environmentId, identity),
    owner:
      target === null && repoPath !== null
        ? { client: primary, session: null }
        : environmentClientFor(target?.environmentId ?? null, primary, sessionRevision),
  }
}

export function hubOwnerClient(
  owner: ReturnType<typeof environmentClientFor>,
): NonNullable<ReturnType<typeof environmentClientFor>>['client'] {
  if (owner === null) throw new Error('The target Environment is offline.')
  return owner.client
}
