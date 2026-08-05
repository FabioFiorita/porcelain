import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { useInstallUpdate, useUpdateStatus } from '@renderer/hooks/use-updates'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { Loader2, RotateCw } from 'lucide-react'

/**
 * Titlebar install chip: appears only once a release is downloaded and ready.
 * Shell chrome next to the environment switcher (not the viewer TopBar). Matches
 * the env chip's height/surface so the pair reads as one control cluster.
 *
 * On a phone the titlebar is tight (env is already icon-only), so this collapses
 * to the same size-8 glyph with the version in the accessible name + tooltip.
 * Browser clients have no auto-updater — always null.
 */
export function UpdateButton(): React.JSX.Element | null {
  const status = useUpdateStatus()
  const { install, isInstalling } = useInstallUpdate()
  const compact = useIsMobile()

  if (isBrowser) return null
  if (status?.state !== 'downloaded' || status.version == null) return null

  const version = status.version.replace(/^v/i, '')
  const label = `Update to ${version}`
  const tip = isInstalling ? `Installing ${version}…` : `Install Porcelain ${version} and restart`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-testid={TestIds.updateButton}
            aria-label={label}
            disabled={isInstalling}
            title={compact ? tip : undefined}
            onClick={() => install()}
            className={cn(
              'app-no-drag flex shrink-0 items-center rounded-md border border-border bg-secondary',
              'text-xs font-medium text-secondary-foreground transition-colors',
              'hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              'disabled:pointer-events-none disabled:opacity-50',
              // Height is derived, never pinned: `py-1` on a text-xs line box is what
              // makes this exactly as tall as the env chip beside it. A literal `h-8`
              // here drifted 6px taller and broke the cluster.
              compact ? 'size-8 justify-center' : 'max-w-48 gap-1.5 px-2 py-1',
            )}
          >
            {isInstalling ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin opacity-80" aria-hidden />
            ) : (
              <RotateCw className="size-3.5 shrink-0 opacity-80" aria-hidden />
            )}
            {!compact && <span className="truncate">{label}</span>}
          </button>
        }
      />
      <TooltipContent side="bottom" align="end">
        {tip}
      </TooltipContent>
    </Tooltip>
  )
}
