import { Button } from '@renderer/components/ui/button'
import { useCheckForUpdates, useInstallUpdate, useUpdateStatus } from '@renderer/hooks/use-updates'
import { Check, Loader2, RotateCw, TriangleAlert } from 'lucide-react'

export function UpdatesSection(): React.JSX.Element {
  const status = useUpdateStatus()
  const { check, isChecking } = useCheckForUpdates()
  const { install, isInstalling } = useInstallUpdate()

  const checking = isChecking || status?.state === 'checking'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm-minus font-semibold">Current version</p>
          <p className="text-xs text-muted-foreground">
            Porcelain {status ? `v${status.currentVersion}` : '…'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => check()} disabled={checking}>
          {checking ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {checking ? 'Checking…' : 'Check for updates'}
        </Button>
      </div>

      {status?.state === 'up-to-date' && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" /> You're on the latest version.
        </p>
      )}
      {status?.state === 'available' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Version {status.version} found —
          downloading…
        </p>
      )}
      {status?.state === 'downloaded' && (
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-1.5 text-xs text-success">
            <Check className="size-3.5" /> Version {status.version} is ready to install.
          </p>
          <Button size="sm" onClick={() => install()} disabled={isInstalling}>
            <RotateCw /> Install and restart
          </Button>
        </div>
      )}
      {status?.state === 'error' && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Couldn't check for updates{status.error ? `: ${status.error}` : '.'}
        </p>
      )}
    </div>
  )
}
