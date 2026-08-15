import { prepareActionRun } from '@porcelain/client-runtime/actions'
import { type ActionView, actionsProcedures } from '@porcelain/contracts/actions'
import { useActiveEnvironment } from '@/features/remote'
import { spawnTerminalSession } from '@/features/terminal'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { useActionsTarget } from './actions-target'
import { callActionsProcedure } from './use-actions-transport'

/**
 * Mobile authorize → Terminal create (ACT-003).
 *
 * The daemon authorizes the run against an explicit Environment + Project + Worktree
 * target (#24) and hands back the command plus the verified checkout; this hook only
 * spawns. Imports only the public Terminal `spawnTerminalSession` helper — never
 * terminal-store. Rejects on a missing target, a daemon refusal, or a spawn failure.
 */

const prepareProcedure = namedContractProcedure(
  'prepareActionRun',
  actionsProcedures.prepareActionRun,
)

export function useActionRun(): (action: ActionView) => Promise<void> {
  const target = useActionsTarget()
  const environment = useActiveEnvironment()

  return async (action: ActionView): Promise<void> => {
    if (target === null) {
      throw new Error('No Worktree target for this Project on the paired daemon')
    }

    const authorized = await callActionsProcedure(environment, prepareProcedure, {
      actionId: action.id,
      target,
    })
    const prepared = prepareActionRun(authorized)
    if (!prepared.ok) {
      // A phone has no local daemon, so a `where: 'local'` action cannot run here.
      throw new Error('This action runs on the human’s own device, not from the phone')
    }

    const { cwd, name, initialInput } = prepared.value
    await spawnTerminalSession({ cwd, name, initialInput })
  }
}
