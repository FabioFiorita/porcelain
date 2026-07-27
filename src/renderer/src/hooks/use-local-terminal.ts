import { onMutationError } from '@renderer/hooks/mutation-error'
import { localDaemonClient, setLocalDaemonEndpoint } from '@renderer/lib/local-daemon'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

/**
 * "This device" terminals: running a shell on the machine the app is on while the window
 * works on a remote daemon (see lib/local-daemon.ts for why).
 *
 * Electron-only by nature — the browser client has no shell router and no local daemon, so
 * every query here is disabled there and the UI hides the affordance.
 */

export interface LocalDaemonInfo {
  url: string
  token: string
  /** True when this window is ALREADY on the local daemon — the feature is then pointless. */
  isLocal: boolean
}

/**
 * The local daemon's endpoint. Refetched on focus and on `local-daemon-changed` (the child
 * restarted on a new port — use-app-events invalidates this), and each result re-points the
 * live session rather than rebuilding it, so open PTYs survive a daemon restart.
 */
export function useLocalDaemon(): LocalDaemonInfo | undefined {
  const { data } = shellTrpc.localDaemon.useQuery(undefined, { enabled: !isBrowser })
  const url = data?.url
  const token = data?.token
  useEffect(() => {
    // An empty url means the child hasn't reported its port yet; connecting to '' would
    // resolve to the page origin, which is a different daemon entirely.
    if (url === undefined || url === '' || token === undefined) return
    setLocalDaemonEndpoint({ url, token })
  }, [url, token])
  return data
}

/** The remembered local cwd for this repo on this window's environment (null = never mapped). */
export function useLocalTerminalPath(repoPath: string | null): string | null | undefined {
  const { data } = shellTrpc.localTerminalPath.useQuery(
    { repoPath: repoPath ?? '' },
    { enabled: !isBrowser && repoPath !== null },
  )
  return data
}

export function useSetLocalTerminalPath(): {
  save: (input: { repoPath: string; localPath: string }) => Promise<void>
  isPending: boolean
} {
  const utils = shellTrpc.useUtils()
  const mutation = shellTrpc.setLocalTerminalPath.useMutation({
    onSuccess: async () => {
      await utils.localTerminalPath.invalidate()
    },
    onError: onMutationError('Save local terminal path'),
  })
  return {
    save: async (input) => {
      await mutation.mutateAsync(input)
    },
    isPending: mutation.isPending,
  }
}

export interface LocalTerminalRow {
  id: string
  name: string
  cwd: string
  status: 'running' | 'exited'
  exitCode?: number
}

/**
 * The local daemon's terminal roster, scoped to the mapped directory — the local twin of
 * the `terminalSessions` query in `use-terminal-channel`, on the same 5s poll so a session
 * killed elsewhere reconciles here too.
 *
 * It goes through the vanilla client (`localDaemonClient`) inside a plain react-query
 * `useQuery` rather than `trpc.terminalSessions.useQuery`: the tRPC React hooks are bound
 * to ONE client via their provider, and a third `createTRPCReact` instance + provider (with
 * its own context — see the shared-context trap in lib/trpc) would be a lot of machinery
 * for one query on a second machine. Sanctioned the same way the vanilla client is in
 * `stores/repo.ts` and `use-app-events.ts`.
 */
export function useLocalTerminalSessions(localPath: string | null): LocalTerminalRow[] {
  const { data } = useQuery({
    queryKey: ['local-terminal-sessions', localPath],
    enabled: !isBrowser && localPath !== null,
    refetchInterval: 5000,
    queryFn: async (): Promise<LocalTerminalRow[]> => {
      const client = localDaemonClient()
      if (client === null || localPath === null) return []
      const sessions = await client.terminalSessions.query()
      return sessions.filter((s) => s.cwd === localPath || s.cwd.startsWith(`${localPath}/`))
    },
  })
  return data ?? []
}
