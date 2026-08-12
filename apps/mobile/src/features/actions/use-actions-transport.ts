import { getDaemonClient } from '@/lib/daemon/client'
import { type Environment, isPaired } from '@/lib/daemon/environment'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon, type DaemonProcedure } from '@/lib/daemon/procedure'

/** Call an Actions procedure when a paired daemon is available. */
export function callActionsProcedure<TInput, TOutput>(
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
