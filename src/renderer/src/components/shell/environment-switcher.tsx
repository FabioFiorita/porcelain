import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { useDaemonSkew } from '@renderer/hooks/use-daemon-skew'
import { useEnvironmentStatuses } from '@renderer/hooks/use-environment-status'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import {
  useConnectRemoteEnvironment,
  useDisconnectRemoteEnvironment,
  useOpenWindowInEnvironment,
  useRemoteEnvironments,
} from '@renderer/hooks/use-remote-daemon'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { platformLabel } from '@shared/platform'
import { TestIds } from '@shared/test-ids'
import {
  Check,
  Cloud,
  Monitor,
  Plus,
  Settings2,
  SquareArrowOutUpRight,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'

/**
 * The top-bar environment control: which machine this window is working on, and the
 * one place to move it to another one.
 *
 * It is ALWAYS rendered, including on This device — the previous Remote-only chip
 * could not be the thing you reach for to *go* remote, since it only existed once you
 * already were. The icon carries local-vs-remote (Monitor / Cloud) so a permanently-present
 * chip still reads at a glance.
 *
 * In the browser client it degrades to a static label: that client IS served by its
 * daemon, so there is nothing to switch to and no shell router to ask — but naming the
 * host is exactly what makes an iPad tab recognizable, so the label stays.
 */
export function EnvironmentSwitcher(): React.JSX.Element | null {
  const identity = useDaemonIdentity()
  const environments = useRemoteEnvironments()
  const statuses = useEnvironmentStatuses()
  const skew = useDaemonSkew()
  const isMobile = useIsMobile()
  const { connect, pendingId } = useConnectRemoteEnvironment()
  const { disconnect, isPending: isDisconnecting } = useDisconnectRemoteEnvironment()
  const { open: openInEnv } = useOpenWindowInEnvironment()
  const openSettings = useSettingsDialogStore((s) => s.openTo)
  const [menuOpen, setMenuOpen] = useState(false)

  const activeId = environments?.activeId ?? null
  const active =
    activeId === null ? null : environments?.environments.find((e) => e.id === activeId)
  // Local-machine identity must come from the LOCAL status probe (or identity only when
  // this window is actually bound local). `useDaemonIdentity` is the BOUND daemon — when
  // you're on Beelink it reports "beelink", which must never label the This device row.
  const localStatus = statuses.get(null)
  const localHost =
    localStatus?.host != null && localStatus.host !== ''
      ? localStatus.host
      : activeId === null && identity.host !== null && identity.host !== ''
        ? identity.host
        : null
  const localName = localHost ?? 'This device'
  const localDetail =
    localStatus?.platform != null && localStatus.platform !== ''
      ? platformLabel(localStatus.platform)
      : activeId === null && identity.platform !== null && identity.platform !== ''
        ? platformLabel(identity.platform)
        : 'This machine'
  // Chip: remote env name when bound remote; otherwise this machine's host.
  const label = active?.name ?? localName
  // Phone titlebar is tight — icon carries local vs remote; name lives in aria/tooltip.
  const compact = isMobile

  const chip = (
    <span
      className={cn(
        'flex items-center rounded-md border border-border bg-secondary',
        'text-xs font-medium text-secondary-foreground',
        compact ? 'size-8 justify-center' : 'max-w-48 gap-1.5 px-2 py-1',
      )}
      title={compact ? label : undefined}
    >
      {active ? (
        <Cloud className="size-3.5 shrink-0 opacity-80" aria-hidden />
      ) : (
        <Monitor className="size-3.5 shrink-0 opacity-80" aria-hidden />
      )}
      {!compact && <span className="truncate">{label}</span>}
      {skew && <TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden />}
    </span>
  )

  // No shell router in the browser — render the identity, drop the switching.
  if (isBrowser) {
    return (
      <div className="app-no-drag" data-testid={TestIds.environmentSwitcher}>
        <span role="img" aria-label={`Environment: ${label}`}>
          {chip}
        </span>
      </div>
    )
  }

  const switching = pendingId !== null || isDisconnecting

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  data-testid={TestIds.environmentSwitcher}
                  // The skew warning is an icon in the chip, so the accessible name
                  // has to carry it too — the tooltip body (which holds the full
                  // message) only mounts on hover/focus.
                  aria-label={
                    skew
                      ? `Environment: ${label} — daemon version mismatch`
                      : `Environment: ${label}`
                  }
                  className={cn(
                    'app-no-drag rounded-md transition-colors',
                    'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  )}
                >
                  {chip}
                </button>
              }
            />
          }
        />
        <TooltipContent side="bottom" align="end" className="max-w-sm">
          <div className="flex flex-col gap-0.5 text-left">
            <p className="whitespace-nowrap font-medium">{label}</p>
            {active && (
              <p className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {active.url}
              </p>
            )}
            {skew && <p className="mt-1 text-xs text-warning">{skew.message}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Click to switch environment</p>
          </div>
        </TooltipContent>
      </Tooltip>

      {/*
        align=end keeps the menu's trailing edge on the chip (same corner language as
        the rail project menu opening from its avatar). collisionPadding keeps the
        panel on-screen instead of sliding past the window edge on a short Mac chrome.
      */}
      <DropdownMenuContent align="end" side="bottom" sideOffset={6} className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Environments</DropdownMenuLabel>
          <EnvironmentRow
            id={null}
            name={localName}
            detail={localDetail}
            isActive={activeId === null}
            state={localStatus?.state}
            disabled={switching}
            onUse={() => disconnect()}
            onNewWindow={() => {
              setMenuOpen(false)
              openInEnv({ environmentId: null })
            }}
          />
          {(environments?.environments ?? []).map((env) => (
            <EnvironmentRow
              key={env.id}
              id={env.id}
              name={env.name}
              detail={env.url}
              isActive={env.id === activeId}
              state={statuses.get(env.id)?.state}
              disabled={switching}
              onUse={() => connect(env.id)}
              onNewWindow={() => {
                setMenuOpen(false)
                openInEnv({ environmentId: env.id })
              }}
            />
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => openSettings('remotes')}>
            <Plus className="shrink-0" />
            Add remote…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSettings('remotes')}>
            <Settings2 className="shrink-0" />
            Manage remotes…
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * One environment in the menu. Clicking the row binds THIS window to it (the
 * main-process reload does the rest); the trailing button opens a fresh window
 * instead, so `stopPropagation` has to suppress the row — the same controlled-menu
 * idiom as the project switcher's per-recent open-in-window button.
 */
function EnvironmentRow({
  id,
  name,
  detail,
  isActive,
  state,
  disabled,
  onUse,
  onNewWindow,
}: {
  id: string | null
  name: string
  detail: string
  isActive: boolean
  state: 'online' | 'unauthorized' | 'offline' | undefined
  disabled: boolean
  onUse: () => void
  onNewWindow: () => void
}): React.JSX.Element {
  return (
    <DropdownMenuItem
      data-testid={TestIds.environmentRow(id ?? 'local')}
      // Re-binding the window you're already on would reload it for nothing.
      disabled={disabled || isActive}
      onClick={onUse}
    >
      <StatusDot state={state} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{name}</span>
        <span className="truncate font-mono text-2xs-plus text-muted-foreground" dir="rtl">
          {detail}
        </span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {isActive && <Check className="shrink-0 text-success" />}
        <button
          type="button"
          aria-label={`Open ${name} in new window`}
          className={cn(
            'flex size-6 items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-accent/50 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
          onClick={(e) => {
            e.stopPropagation()
            onNewWindow()
          }}
        >
          <SquareArrowOutUpRight className="size-3.5" />
        </button>
      </div>
    </DropdownMenuItem>
  )
}

/**
 * Reachability at a glance. `undefined` (the probe hasn't answered yet) renders as
 * muted rather than red — claiming a box is down before we've asked is worse than
 * saying nothing. `unauthorized` gets its own colour because the fix differs: that
 * daemon is up and rejecting the saved token.
 */
function StatusDot({
  state,
}: {
  state: 'online' | 'unauthorized' | 'offline' | undefined
}): React.JSX.Element {
  const tone =
    state === 'online'
      ? 'bg-success'
      : state === 'unauthorized'
        ? 'bg-warning'
        : state === 'offline'
          ? 'bg-muted-foreground/40'
          : 'bg-muted-foreground/20'
  return (
    <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
      <span className={cn('size-1.5 rounded-full', tone)} />
    </span>
  )
}
