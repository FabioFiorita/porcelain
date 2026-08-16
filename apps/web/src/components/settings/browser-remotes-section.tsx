import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  addBrowserEnvironmentConnection,
  browserEnvironmentConnections,
  ensureEnvironmentSession,
  removeBrowserEnvironmentConnection,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useQueries } from '@tanstack/react-query'
import { RefreshCw, X } from 'lucide-react'
import { useMemo, useState } from 'react'

type ConnectionState = 'checking' | 'online' | 'unauthorized' | 'offline'

function errorCode(error: unknown): unknown {
  if (error === null || typeof error !== 'object' || !('data' in error)) return undefined
  return (error as { data?: { code?: unknown } }).data?.code
}

function stateFor(query: {
  isPending: boolean
  isError: boolean
  data: unknown
  error: unknown
}): ConnectionState {
  if (query.isPending) return 'checking'
  if (query.data !== undefined) return 'online'
  if (
    query.isError &&
    (errorCode(query.error) === 'UNAUTHORIZED' || errorCode(query.error) === 'FORBIDDEN')
  ) {
    return 'unauthorized'
  }
  return 'offline'
}

function statusCopy(
  state: ConnectionState,
  identity:
    | {
        host: string
        platform: string
        version: string
      }
    | undefined,
): string {
  if (state === 'checking') return 'Checking…'
  if (state === 'unauthorized') return 'Token rejected — use a paired client token'
  if (state === 'offline') return 'Not reachable — check the URL or daemon'
  if (identity === undefined) return 'Online'
  return `${identity.host} · ${identity.platform} · daemon ${identity.version}`
}

function stateBadge(state: ConnectionState): React.JSX.Element {
  const label =
    state === 'online'
      ? 'Online'
      : state === 'checking'
        ? 'Checking'
        : state === 'unauthorized'
          ? 'Token rejected'
          : 'Offline'
  return <Badge variant={state === 'online' ? 'default' : 'outline'}>{label}</Badge>
}

/** Browser-only connection manager. Electron keeps its shell pairing/settings surface. */
export function BrowserRemotesSection(): React.JSX.Element {
  const revision = useEnvironmentSessionsRevision()
  const connections = useMemo(() => browserEnvironmentConnections(revision), [revision])
  const sessions = useMemo(
    () => connections.map((connection) => ensureEnvironmentSession(connection)),
    [connections],
  )
  const queries = useQueries({
    queries: sessions.map((entry) => ({
      queryKey: ['browser', 'environmentIdentity', entry.id],
      queryFn: () => entry.client.daemonInfo.query(),
      retry: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    })),
  })
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addConnection(): void {
    setError(null)
    setAdding(true)
    runUserAction(
      async (): Promise<void> => {
        await addBrowserEnvironmentConnection({ name, url, token })
        setName('')
        setUrl('')
        setToken('')
      },
      (reason: unknown): void => {
        setError(reason instanceof Error ? reason.message : 'Could not add that connection.')
      },
      (): void => setAdding(false),
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid={TestIds.browserEnvironmentConnections}>
      <div className="rounded-md border border-border/60 p-3">
        <p className="text-sm-minus font-medium">This device</p>
        <p className="text-xs text-muted-foreground">The daemon serving this browser tab</p>
        <Badge variant="outline" className="mt-2 rounded-md text-2xs text-muted-foreground">
          Primary · always available here
        </Badge>
      </div>

      {connections.length > 0 && (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          {connections.map((connection, index) => {
            const query = queries[index]
            const state = query === undefined ? 'checking' : stateFor(query)
            return (
              <li
                key={connection.id}
                className="flex items-start justify-between gap-3 p-3"
                data-testid={TestIds.browserEnvironmentConnection(connection.id)}
              >
                <div className="min-w-0">
                  <p className="text-sm-minus font-medium">{connection.name}</p>
                  <p className="truncate font-mono text-2xs-plus text-muted-foreground">
                    {connection.url}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {statusCopy(state, query?.data)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {stateBadge(state)}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Reconnect ${connection.name}`}
                    disabled={query === undefined || query.isFetching}
                    onClick={(): void => {
                      if (query === undefined) return
                      runUserAction(
                        () => query.refetch().then(() => undefined),
                        (): void => setError(`Could not reconnect ${connection.name}.`),
                      )
                    }}
                  >
                    <RefreshCw />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${connection.name}`}
                    onClick={(): void => removeBrowserEnvironmentConnection(connection.id)}
                  >
                    <X />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form
        className="flex flex-col gap-2 rounded-md border border-border/60 p-3"
        onSubmit={(event: React.FormEvent<HTMLFormElement>): void => {
          event.preventDefault()
          if (!adding) addConnection()
        }}
      >
        <p className="text-sm-minus font-medium">Add a daemon connection</p>
        <p className="text-xs text-muted-foreground">
          Enter a shared daemon URL and a revocable client token. The token is verified before it is
          saved and is never displayed after this form is cleared.
        </p>
        <Input
          data-testid={TestIds.browserEnvironmentLabel}
          aria-label="Connection label"
          placeholder="Label (for example, Beelink)"
          value={name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
            setName(event.target.value)
          }
          disabled={adding}
          maxLength={80}
        />
        <Input
          data-testid={TestIds.browserEnvironmentUrl}
          aria-label="Daemon URL"
          placeholder="https://beelink.example.ts.net:43117"
          value={url}
          onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
            setUrl(event.target.value)
          }
          disabled={adding}
          inputMode="url"
          autoComplete="url"
        />
        <Input
          data-testid={TestIds.browserEnvironmentToken}
          aria-label="Client token"
          placeholder="pc_client_…"
          type="password"
          value={token}
          onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
            setToken(event.target.value)
          }
          disabled={adding}
          autoComplete="off"
        />
        <Button
          type="submit"
          className="self-start"
          disabled={adding}
          data-testid={TestIds.browserEnvironmentAdd}
        >
          {adding ? 'Verifying…' : 'Verify and add'}
        </Button>
        {error !== null && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
