import { prepareActionRun } from '@porcelain/client-runtime/actions'
import type { ActionView } from '@porcelain/contracts/actions'
import { useActiveProject } from '@/features/projects'
import { spawnTerminalSession } from '@/features/terminal'

/**
 * Mobile prepare → Terminal create (ACT-003).
 *
 * Imports only the public Terminal `spawnTerminalSession` helper — never terminal-store.
 * Rejects on prepare refusal or spawn failure.
 */

export function useActionRun(): (action: ActionView) => Promise<void> {
  const project = useActiveProject()

  return async (action: ActionView): Promise<void> => {
    if (project === null) return

    const prepared = prepareActionRun(action, { projectPath: project.path })
    if (!prepared.ok) {
      if (prepared.error.code === 'actions.untrusted') {
        throw new Error('Command is not trusted on this machine')
      }
      throw new Error('Local path is required to run this action')
    }

    const { cwd, name, initialInput } = prepared.value
    await spawnTerminalSession({ cwd, name, initialInput })
  }
}
