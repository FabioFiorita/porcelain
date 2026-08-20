import { prepareActionRun } from '@porcelain/client-runtime/actions'
import type { HubTarget } from '@porcelain/client-runtime/projects'
import type { ActionView } from '@porcelain/contracts/actions'
import { environmentClientFor } from '@renderer/lib/environment-sessions'
import { revealTerminal, spawnLocalTerminal } from '@renderer/lib/terminal-actions'
import { trpc } from '@renderer/lib/trpc'
import { currentHubTarget } from '@renderer/stores/hub-selection'
import { useTerminalsStore } from '@renderer/stores/terminals'

/**
 * Authorize → Terminal create (ACT-003).
 *
 * The run target is explicit: Environment + Project + Worktree + checkout path. Nothing
 * here infers it — a caller that has no Worktree selected gets `'needs-target'` back and
 * must ask the human which checkout to run in (#24). The daemon re-checks the target,
 * the Action, and machine trust before it hands back a command; this adapter only turns
 * that authorization into exactly one terminal create.
 */

export type RunActionResult = 'ran' | 'needs-local-path' | 'needs-trust' | 'needs-target'

export type RunActionOptions = {
  /** Explicit run target; defaults to the current Hub Worktree selection. */
  target?: HubTarget | null
  localPath?: string | null
}

/** Run a saved action against an explicit target (always a new terminal session). */
export function useActionRun(): (
  action: ActionView,
  opts?: RunActionOptions,
) => Promise<RunActionResult> {
  const defaultClient = trpc.useUtils().client

  return async (action: ActionView, opts?: RunActionOptions): Promise<RunActionResult> => {
    const target = opts?.target === undefined ? currentHubTarget() : opts.target
    if (target === null) return 'needs-target'
    if (!action.trusted) return 'needs-trust'

    const owner = environmentClientFor(target.environmentId, defaultClient)
    const client =
      target.environmentId === null
        ? defaultClient
        : owner === null
          ? (() => {
              throw new Error('The target Environment is offline.')
            })()
          : owner.client

    const authorized = await client.prepareActionRun.mutate({
      actionId: action.id,
      target: {
        environmentId: target.environmentId,
        projectId: target.projectId,
        worktreeId: target.worktreeId,
        path: target.path,
      },
    })

    const prepared = prepareActionRun(authorized, { localPath: opts?.localPath })
    if (!prepared.ok) return 'needs-local-path'

    const { where, cwd, name, initialInput } = prepared.value
    if (where === 'local') {
      await spawnLocalTerminal(cwd, { name, initialInput })
      return 'ran'
    }

    const id = await useTerminalsStore.getState().create({
      cwd,
      name,
      initialInput,
      session: owner?.session ?? undefined,
    })
    revealTerminal(id)
    return 'ran'
  }
}
