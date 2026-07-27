import type { EnvironmentStatus } from '@main/shell-api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useEnvironmentStatuses } from '@renderer/hooks/use-environment-status'
import { usePairEnvironment } from '@renderer/hooks/use-pairing'
import {
  useAddRemoteEnvironment,
  useConnectRemoteEnvironment,
  useDisconnectRemoteEnvironment,
  useOpenWindowInEnvironment,
  useRemoteEnvironments,
  useRemoveRemoteEnvironment,
} from '@renderer/hooks/use-remote-daemon'
import { compactButtonClass, rowActionClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { platformLabel } from '@shared/platform'
import { TestIds } from '@shared/test-ids'
import { X } from 'lucide-react'
import { useState } from 'react'

/**
 * One line of prose for a probed environment: what it is when we reached it, why it
 * isn't usable when we didn't. `unauthorized` says the token — the fix there is
 * re-pairing, not waking the box.
 */
function describeStatus(status: EnvironmentStatus | undefined): string {
  if (status === undefined) return 'Checking…'
  if (status.state === 'offline') return 'Not reachable'
  if (status.state === 'unauthorized') return 'Reachable, but the saved token was rejected'
  const machine =
    status.host !== null && status.platform !== null
      ? `${status.host} · ${platformLabel(status.platform)}`
      : (status.host ?? 'Online')
  return status.version !== null ? `${machine} · daemon ${status.version}` : machine
}

/**
 * Machines this app can open windows against. Electron-only (hidden in the browser
 * client, which already IS served by its daemon). Multi-endpoint failover stays under
 * the hood — no Prefer / Add address UI.
 */
export function RemotesSection(): React.JSX.Element {
  const data = useRemoteEnvironments()
  const statuses = useEnvironmentStatuses()
  const { add, isPending: isAdding, error } = useAddRemoteEnvironment()
  const { connect, pendingId: connectingId } = useConnectRemoteEnvironment()
  const { disconnect, isPending: isDisconnecting } = useDisconnectRemoteEnvironment()
  const { open: openInEnv } = useOpenWindowInEnvironment()
  const { remove, pendingId: removingId } = useRemoveRemoteEnvironment()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [pasted, setPasted] = useState('')
  const { pair, isPending: isPairing, error: pairError } = usePairEnvironment()

  const environments = data?.environments ?? []
  const activeId = data?.activeId ?? null

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Remotes</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Each window can use a different daemon — local project in one, remote in another. Use here
          reloads this window; New window opens a fresh one on that environment.
        </p>
      </div>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
        <li
          className="flex items-center justify-between gap-3 p-3"
          data-testid={TestIds.environmentRow('local')}
        >
          <div className="min-w-0">
            <p className="text-sm-minus font-medium">This device</p>
            <p className="text-xs text-muted-foreground">{describeStatus(statuses.get(null))}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeId == null ? (
              <Badge
                variant="outline"
                className="rounded-md border-border/60 text-2xs text-muted-foreground"
              >
                This window
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className={rowActionClass}
                disabled={isDisconnecting}
                onClick={() => disconnect()}
              >
                {isDisconnecting ? 'Switching…' : 'Use here'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className={rowActionClass}
              onClick={() => openInEnv({ environmentId: null })}
            >
              New window
            </Button>
          </div>
        </li>
        {environments.map((env) => {
          const isActive = env.id === activeId
          const status = statuses.get(env.id)
          const via =
            status?.state === 'online' && status.endpoint != null
              ? status.endpoint.includes('100.')
                ? 'via Tailscale'
                : 'via local network'
              : null
          return (
            <li
              key={env.id}
              className="flex items-center justify-between gap-3 p-3"
              data-testid={TestIds.environmentRow(env.id)}
            >
              <div className="min-w-0">
                <p className="text-sm-minus font-medium">{env.name}</p>
                <p className="text-xs text-muted-foreground">
                  {describeStatus(status)}
                  {via != null ? ` · ${via}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isActive ? (
                  <Badge
                    variant="outline"
                    className="rounded-md border-border/60 text-2xs text-muted-foreground"
                  >
                    This window
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className={rowActionClass}
                    disabled={connectingId === env.id}
                    onClick={() => connect(env.id)}
                  >
                    {connectingId === env.id ? 'Switching…' : 'Use here'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={rowActionClass}
                  onClick={() => openInEnv({ environmentId: env.id })}
                >
                  New window
                </Button>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={removingId === env.id}
                        onClick={() => remove(env.id)}
                        aria-label="Remove"
                      >
                        <X />
                      </Button>
                    }
                  />
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              </div>
            </li>
          )
        })}
      </ul>

      {showAdd ? (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
          <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
            Add remote
          </p>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Paste a pairing link"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              disabled={isAdding || isPairing}
              aria-label="Pairing link"
            />
            <Button
              variant="default"
              size="sm"
              className={compactButtonClass}
              disabled={isAdding || isPairing || pasted.trim() === ''}
              onClick={() => pair(pasted)}
            >
              {isPairing ? 'Pairing…' : 'Pair'}
            </Button>
          </div>
          {pairError != null && <p className="text-xs text-destructive">{pairError}</p>}
          <p className="text-2xs tracking-wider text-muted-foreground uppercase">
            or enter manually
          </p>
          <Input
            placeholder="Name (e.g. Workshop)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isAdding}
          />
          <Input
            placeholder="URL (e.g. http://my-server.tailnet.ts.net:43117)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isAdding}
          />
          <Input
            type="password"
            placeholder="Daemon token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isAdding}
          />
          <p className="text-xs text-muted-foreground">
            On the other machine: Settings → Share → Pair, or{' '}
            <span className="font-mono">cat ~/.porcelain/daemon-token</span>.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className={compactButtonClass}
              disabled={isAdding || url.trim() === '' || token.trim() === ''}
              onClick={() => add({ name, url, token })}
            >
              {isAdding ? 'Adding…' : 'Add & use here'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={compactButtonClass}
              disabled={isAdding}
              onClick={() => {
                setShowAdd(false)
                setName('')
                setUrl('')
                setToken('')
              }}
            >
              Cancel
            </Button>
          </div>
          {error != null && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className={cn('self-start', compactButtonClass)}
          onClick={() => setShowAdd(true)}
        >
          Add remote
        </Button>
      )}
    </div>
  )
}
