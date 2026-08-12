import type { Environment } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { callDaemon, type DaemonProcedure } from '@/lib/daemon/procedure'

import { pairedProjectEnvironment } from './project-procedures'

/** Call the canonical Project binding through the paired daemon transport. */
export function callProjectDaemon<TInput, TOutput>(
  environment: Environment | null,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  const paired = pairedProjectEnvironment(environment, procedure.name)
  return callDaemon(getDaemonClient(paired), procedure, input)
}
