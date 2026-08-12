import { prepareActionRun } from '@porcelain/client-runtime/actions'
import type { ActionView } from '@porcelain/contracts/actions'
import { spawnLocalTerminal } from '@renderer/lib/terminal-actions'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'

/**
 * Prepare → Terminal create (ACT-003).
 *
 * Uses real ACT-002 `prepareActionRun` then exactly one platform create with
 * prepared `name` / `cwd` / `initialInput`. Never `terminal:write` for the command.
 */

export type RunActionResult = 'ran' | 'needs-local-path' | 'needs-trust'

/**
 * Run a saved action: prepare, then create a new terminal (always a new session).
 * No project → silent `'ran'` (current guard). Terminal create failures reject to the caller.
 */
export function useActionRun(): (
  action: ActionView,
  opts?: { localPath?: string | null },
) => Promise<RunActionResult> {
  return async (
    action: ActionView,
    opts?: { localPath?: string | null },
  ): Promise<RunActionResult> => {
    const project = useProjectSelectionStore.getState().project
    if (!project) return 'ran'

    const prepared = prepareActionRun(action, {
      projectPath: project.path,
      localPath: opts?.localPath,
    })
    if (!prepared.ok) {
      if (prepared.error.code === 'actions.untrusted') return 'needs-trust'
      return 'needs-local-path'
    }

    const { where, cwd, name, initialInput } = prepared.value
    if (where === 'local') {
      await spawnLocalTerminal(cwd, { name, initialInput })
      return 'ran'
    }

    const id = await useTerminalsStore.getState().create({ cwd, name, initialInput })
    useTabsStore.getState().openTab({
      id: tabId('terminal', id),
      kind: 'terminal',
      title: name,
      path: id,
    })
    return 'ran'
  }
}
