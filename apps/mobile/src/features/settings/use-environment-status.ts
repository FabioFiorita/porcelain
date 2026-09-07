import { remoteProcedures } from '@porcelain/contracts/remote'
import { useQuery } from '@tanstack/react-query'
import { type Environment, isPaired } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { callDaemon, namedContractQuery } from '@/lib/daemon/procedure'
import { daemonKeys } from '@/lib/daemon/queries'

const info = namedContractQuery('daemonInfo', remoteProcedures.daemonInfo)

/** Inspect each saved connection independently of the project being viewed. */
export function useEnvironmentStatus(environment: Environment) {
  const query = useQuery({
    queryKey: daemonKeys.call(environment.id, info.name, undefined),
    enabled: environment.enabled && isPaired(environment),
    queryFn: () => {
      if (!isPaired(environment)) throw new Error('Environment is not paired')
      return callDaemon(getDaemonClient(environment), info, undefined)
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
    retry: false,
  })
  return {
    version: query.data?.version ?? null,
    label: !environment.enabled
      ? 'Disconnected'
      : !isPaired(environment)
        ? 'Unpaired'
        : query.isError
          ? 'Connection failed'
          : query.data !== undefined
            ? 'Connected'
            : 'Connecting…',
  }
}
