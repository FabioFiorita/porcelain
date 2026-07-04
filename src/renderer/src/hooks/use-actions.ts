import type { Action } from '@backend/actions-store'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'

/** All saved actions for the current repo (live-refreshed when the agent curates them). */
export function useActions(enabled = true): Action[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.actions.useQuery(repo?.path ?? '', { enabled: enabled && repo !== null })
  return data ?? []
}

export interface NewActionInput {
  title: string
  command: string
  cwd?: string
}

/** Add/edit/delete saved actions. Each mutation refreshes the list. */
export function useActionMutations(): {
  add: (input: NewActionInput) => Promise<void>
  update: (id: string, fields: NewActionInput) => Promise<void>
  move: (id: string, direction: 'up' | 'down') => Promise<void>
  remove: (id: string) => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const refresh = async (): Promise<void> => {
    await utils.actions.invalidate()
  }
  const add = trpc.addAction.useMutation({ onSuccess: refresh })
  const update = trpc.updateAction.useMutation({ onSuccess: refresh })
  const move = trpc.moveAction.useMutation({ onSuccess: refresh })
  const remove = trpc.deleteAction.useMutation({ onSuccess: refresh })
  return {
    add: async (input) => {
      if (!repo) return
      await add.mutateAsync({ repoPath: repo.path, ...input })
    },
    update: async (id, fields) => {
      if (!repo) return
      await update.mutateAsync({ repoPath: repo.path, id, ...fields })
    },
    move: async (id, direction) => {
      if (!repo) return
      await move.mutateAsync({ repoPath: repo.path, id, direction })
    },
    remove: async (id) => {
      if (!repo) return
      await remove.mutateAsync({ repoPath: repo.path, id })
    },
  }
}

/** Resolve an action's working directory against the repo root (relative ⇒ joined). */
function resolveCwd(repoPath: string, cwd: string | undefined): string {
  if (!cwd) return repoPath
  return cwd.startsWith('/') ? cwd : `${repoPath}/${cwd}`
}

/**
 * Run an action: spawn a terminal named after it with the command typed in, and open
 * its tab. The shell stays live after the command (Ctrl-C, re-run, keep working). The
 * human triggers this — there is no agent path that executes an action (see audit).
 */
export function useRunAction(): (action: Action) => Promise<void> {
  const repo = useRepoStore((s) => s.repo)
  const createTerminal = useTerminalsStore((s) => s.create)
  const openTab = useTabsStore((s) => s.openTab)
  return async (action) => {
    if (!repo) return
    const id = await createTerminal({
      cwd: resolveCwd(repo.path, action.cwd),
      name: action.title,
      initialInput: action.command,
    })
    openTab({ id: tabId('terminal', id), kind: 'terminal', title: action.title, path: id })
  }
}
