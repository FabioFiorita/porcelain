import { prepareActionRun } from '@porcelain/client-runtime/actions'
import { type ActionView, actionsProcedures } from '@porcelain/contracts/actions'
import { useActiveEnvironment } from '@/features/remote'
import { spawnTerminalSession } from '@/features/terminal'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { useActionsTarget } from './actions-target'
import { callActionsProcedure } from './use-actions-transport'

/**
 * Mobile authorize → Terminal create.
 *
 * The daemon authorizes the run against an explicit Environment + Project + Worktree
 * target and hands back the command plus the verified checkout; this hook only
 * spawns. Imports only the public Terminal `spawnTerminalSession` helper — never
 * terminal-store. Rejects on a missing target, a daemon refusal, or a spawn failure.
 *
 * Returns the spawned session's id, because running an Action has to LAND on the shell it
 * started — the same thing the web popover does. Where that lands is the caller's business;
 * this hook does not navigate.
 */

const prepareProcedure = namedContractProcedure(
  'prepareActionRun',
  actionsProcedures.prepareActionRun,
)

export function useActionRun(): (action: ActionView) => Promise<string> {
  const target = useActionsTarget()
  const environment = useActiveEnvironment()

  return async (action: ActionView): Promise<string> => {
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
    return await spawnTerminalSession({ cwd, name, initialInput })
  }
}
