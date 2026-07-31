import type { EnvironmentStatus } from '@main/shell-api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useEnvironmentStatuses } from '@renderer/hooks/use-environment-status'
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
 * isn't usable when we didn't. `unauthorized` means the saved device credential
 * was revoked — create a fresh connection link on that machine.
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

/** Primary action slot — Badge ("This window") and Button ("Use here") share a
 *  fixed min width so "New window" lines up on every row. */
const primaryActionSlotClass = 'flex min-w-[5.75rem] justify-end'

/**
 * Machines this app can open windows against. Electron-only. Add with a one-time
 * connection link from the other machine's Settings → Share or host CLI.
 */
export function RemotesSection(): React.JSX.Element {
  const data = useRemoteEnvironments()
  const statuses = useEnvironmentStatuses()
  const { add, isPending: isAdding, error } = useAddRemoteEnvironment()
  const { connect, pendingId: connectingId } = useConnectRemoteEnvironment()
  const { disconnect, isPending: isDisconnecting } = useDisconnectRemoteEnvironment()
  const { open: openInEnv } = useOpenWindowInEnvironment()
  const { remove, pendingId: removingId } = useRemoveRemoteEnvironment()
  const [connectionLink, setConnectionLink] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const environments = data?.environments ?? []
  const activeId = data?.activeId ?? null
  const localStatus = statuses.get(null)
  const localName =
    localStatus?.host != null && localStatus.host !== '' ? localStatus.host : 'This device'

  return (
    <div className="flex flex-col gap-3">
      {/* Title lives on the dialog header — don't restate "Remotes" here. */}
      <ul className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
        <li
          className="flex items-center justify-between gap-3 p-3"
          data-testid={TestIds.environmentRow('local')}
        >
          <div className="min-w-0">
            <p className="text-sm-minus font-medium">{localName}</p>
            <p className="text-xs text-muted-foreground">{describeStatus(localStatus)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className={primaryActionSlotClass}>
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
            </div>
            <Button
              variant="outline"
              size="sm"
              className={rowActionClass}
              onClick={() => openInEnv({ environmentId: null })}
            >
              New window
            </Button>
            {/* Reserve the same slot as the remove control on remote rows so
                "New window" lines up across every environment. */}
            <span className="size-7 shrink-0" aria-hidden />
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
                <div className={primaryActionSlotClass}>
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
                </div>
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
          <Input
            type="password"
            placeholder="Connection link (https://…/pair#token=…)"
            value={connectionLink}
            onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
              setConnectionLink(e.target.value)
            }
            disabled={isAdding}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Create this one-time link from Settings → Share or the host CLI.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className={compactButtonClass}
              disabled={isAdding || connectionLink.trim() === ''}
              onClick={() => add({ connectionLink })}
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
                setConnectionLink('')
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
