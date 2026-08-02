import { useIsFocused } from 'expo-router'
import { useCallback } from 'react'

import type { DaemonError } from '@/lib/daemon/errors'
import { actionsQuery, type TerminalAction } from '@/lib/daemon/procedures/terminal'
import { useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

import { useTerminalStream } from './use-terminal-stream'

const ACTIONS_POLL_MS = 10_000

export class TerminalLimitError extends Error {
  public constructor() {
    super('The daemon is at its 64-terminal limit. Kill one and try again.')
    this.name = 'TerminalLimitError'
  }
}

export function useTerminalActions(): {
  actions: TerminalAction[]
  error: DaemonError | null
  isPending: boolean
  refetch: () => Promise<unknown>
  runAction: (action: TerminalAction) => Promise<string>
} {
  const repo = useActiveRepo()
  const focused = useIsFocused()
  const stream = useTerminalStream(null)
  const query = useDaemonQuery(actionsQuery, repo?.path ?? '', {
    backstopMs: ACTIONS_POLL_MS,
    enabled: repo !== null && focused,
    pollMs: ACTIONS_POLL_MS,
  })

  const runAction = useCallback(
    async (action: TerminalAction): Promise<string> => {
      if (repo === null) throw new Error('Choose a repo before starting a terminal.')
      if (action.where === 'local') {
        throw new Error('This Action runs on the desktop app’s machine.')
      }
      const id = await stream.create({
        cwd: repo.path,
        initialInput: action.command,
        name: action.title,
      })
      if (id === '') throw new TerminalLimitError()
      return id
    },
    [repo, stream],
  )

  return {
    actions: query.data ?? [],
    error: query.error,
    isPending: query.isPending,
    refetch: query.refetch,
    runAction,
  }
}
