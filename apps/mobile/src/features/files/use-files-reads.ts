import { type Environment, isPaired } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon, type DaemonProcedure } from '@/lib/daemon/procedure'

/** The daemon transport seam for Files reads; hooks and identities stay in files-reads.ts. */
export function callFilesQuery<TInput, TOutput>(
  environment: Environment | null,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  if (!isPaired(environment)) {
    return Promise.reject(new DaemonError('unreachable', procedure.name, 'No daemon is paired.'))
  }
  return callDaemon(getDaemonClient(environment), procedure, input)
}
