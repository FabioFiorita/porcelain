import type { Action, ActionView, ActionWhere } from '@porcelain/contracts/actions'
import { invalidateAfterSuccess } from '@renderer/hooks/mutation-error'
import { spawnLocalTerminal } from '@renderer/lib/terminal-actions'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'

/** All saved actions for the current project (live-refreshed when the agent curates them). */
export function useActions(enabled = true): ActionView[] {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.actions.useQuery(project?.path ?? '', {
    enabled: enabled && project !== null,
  })
  return data ?? []
}

export interface NewActionInput {
  title: string
  command: string
  where?: ActionWhere
}

/**
 * Add/edit/delete saved actions. Each mutation refreshes the list.
 *
 * Every call rejects rather than toasting: ONE owner per failure, and that owner is
 * the edge the human touched (the composer and the row menu both wrap these in
 * `runUserAction` with a real toast). A mutation-level `onError` would double it.
 */
export function useActionMutations(): {
  add: (input: NewActionInput) => Promise<void>
  update: (id: string, fields: NewActionInput) => Promise<void>
  move: (id: string, direction: 'up' | 'down') => Promise<void>
  remove: (id: string) => Promise<void>
} {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const refresh = async (): Promise<void> => {
    await utils.actions.invalidate()
  }
  const add = trpc.addAction.useMutation({ onSuccess: refresh })
  const update = trpc.updateAction.useMutation({ onSuccess: refresh })
  const move = trpc.moveAction.useMutation({ onSuccess: refresh })
  const remove = trpc.deleteAction.useMutation({ onSuccess: refresh })
  return {
    add: async (input: NewActionInput): Promise<void> => {
      if (!project) return
      await add.mutateAsync({ repoPath: project.path, ...input })
    },
    update: async (id: string, fields: NewActionInput): Promise<void> => {
      if (!project) return
      await update.mutateAsync({ repoPath: project.path, id, ...fields })
    },
    move: async (id: string, direction: 'up' | 'down'): Promise<void> => {
      if (!project) return
      await move.mutateAsync({ repoPath: project.path, id, direction })
    },
    remove: async (id: string): Promise<void> => {
      if (!project) return
      await remove.mutateAsync({ repoPath: project.path, id })
    },
  }
}

/**
 * Accept a command this machine has not run before. Trust is recorded against the
 * command TEXT on this machine only, so editing it later — by hand, by an agent,
 * or by a teammate's commit — asks again.
 *
 * Rejects rather than toasting: the trust dialog that called it owns the failure.
 */
export function useTrustAction(): (id: string) => Promise<void> {
  const utils = trpc.useUtils()
  const mutation = trpc.trustActions.useMutation()
  return async (id: string): Promise<void> => {
    const repoPath = useProjectSelectionStore.getState().project?.path
    if (!repoPath) return
    await mutation.mutateAsync({ repoPath, ids: [id] })
    await invalidateAfterSuccess([utils.actions.invalidate()], 'Accept command')
  }
}

export type RunActionResult = 'ran' | 'needs-local-path'

/**
 * Run an action: spawn a terminal named after it with the command typed in, and open
 * its tab; the shell stays live after (Ctrl-C, re-run, keep working). Human-only — no
 * agent path executes an action (see audit).
 *
 * `where: local` runs on This device. When the local path map is missing, returns
 * `needs-local-path` so the caller can open the path dialog and retry with `localPath` set.
 */
export function useRunAction(): (
  action: Action,
  opts?: { localPath?: string | null },
) => Promise<RunActionResult> {
  const project = useProjectSelectionStore((s) => s.project)
  const createTerminal = useTerminalsStore((s) => s.create)
  const openTab = useTabsStore((s) => s.openTab)
  return async (action: Action, opts?: { localPath?: string | null }): Promise<RunActionResult> => {
    if (!project) return 'ran'
    if (action.where === 'local') {
      const localPath = opts?.localPath
      if (localPath == null || localPath === '') return 'needs-local-path'
      await spawnLocalTerminal(localPath, {
        name: action.title,
        initialInput: action.command,
      })
      return 'ran'
    }
    const id = await createTerminal({
      cwd: project.path,
      name: action.title,
      initialInput: action.command,
    })
    openTab({ id: tabId('terminal', id), kind: 'terminal', title: action.title, path: id })
    return 'ran'
  }
}
