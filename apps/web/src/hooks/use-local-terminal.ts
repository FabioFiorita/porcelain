import { useHubInventories } from '@renderer/features/projects/hub-inventories'
import { listTerminalSessionsOnDaemon, suggestLocalTerminalPath } from '@renderer/features/terminal'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { localDaemonClient, setLocalDaemonEndpoint } from '@renderer/lib/local-daemon'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

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
  /** This device's home directory — the fallback folder when nothing local matches the repo. */
  home: string
}

/**
 * The local daemon's endpoint. Refetched on focus and on `local-daemon-changed` (the child
 * restarted on a new port — shell `local-daemon-changed` invalidates this), and each result re-points the
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

/**
 * Where the "Terminal folder on this device" field should START for an unmapped repo.
 *
 * Both inventories come from the Hub fan-out this window already runs, so this costs no
 * extra daemon round trip: the Environment bound to the window owns `repoPath`, the
 * `environmentId: null` view is this machine's own daemon. See
 * `features/terminal/local-path-suggestion.ts` for why the remote path is never offered.
 */
export function useLocalTerminalSuggestion(repoPath: string): string {
  const inventories = useHubInventories()
  const localDaemon = useLocalDaemon()
  const localHome = localDaemon?.home ?? null
  return useMemo(() => {
    const remoteProjects = inventories.find((view) => view.current)?.inventory.projects ?? []
    const localProjects =
      inventories.find((view) => view.environmentId === null)?.inventory.projects ?? []
    return suggestLocalTerminalPath({ repoPath, remoteProjects, localProjects, localHome })
  }, [inventories, localHome, repoPath])
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
    save: async (input: { repoPath: string; localPath: string }): Promise<void> => {
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
 * The local daemon's terminal roster, scoped to the mapped directory — the local twin
 * of `terminalSessions` in `useTerminalRoster` (same 5s poll, so a session killed
 * elsewhere reconciles here too). Goes through the vanilla client (`localDaemonClient`)
 * via plain react-query and the Terminal feature list helper. Keeps the dual-daemon
 * technical key `['local-terminal-sessions', localPath]` distinct from primary identity
 * keys; never invents a second `createTRPCReact` instance.
 */
export function useLocalTerminalSessions(localPath: string | null): LocalTerminalRow[] {
  const { data } = useQuery({
    queryKey: ['local-terminal-sessions', localPath],
    enabled: !isBrowser && localPath !== null,
    refetchInterval: 5000,
    queryFn: async (): Promise<LocalTerminalRow[]> => {
      const client = localDaemonClient()
      if (client === null || localPath === null) return []
      const sessions = await listTerminalSessionsOnDaemon(client)
      return sessions.filter((s) => s.cwd === localPath || s.cwd.startsWith(`${localPath}/`))
    },
  })
  return data ?? []
}
