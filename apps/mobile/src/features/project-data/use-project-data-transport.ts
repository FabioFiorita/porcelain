import { type Environment, isPaired } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon, type DaemonProcedure } from '@/lib/daemon/procedure'

/** Call a Project Data procedure when a paired daemon is available. */
export function callProjectDataProcedure<TInput, TOutput>(
  environment: Environment | null,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  if (!isPaired(environment)) {
    return Promise.reject(
      new DaemonError('unreachable', procedure.name, 'No daemon is paired with this device.'),
    )
  }
  return callDaemon(getDaemonClient(environment), procedure, input)
}
