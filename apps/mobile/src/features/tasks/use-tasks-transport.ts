import { type Environment, isPaired } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon, type DaemonProcedure } from '@/lib/daemon/procedure'

/**
 * Call a Tasks procedure against ONE named Environment.
 *
 * The Environment is always passed in, never read from a store here: the board shows several
 * daemons' rows at once, and a transport that reached for "the active one" is exactly how a
 * Task gets filed on the wrong machine.
 */
export function callTasksProcedure<TInput, TOutput>(
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
