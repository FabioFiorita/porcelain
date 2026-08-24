import { Button } from '@renderer/components/ui/button'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useCheckForUpdates, useInstallUpdate, useUpdateStatus } from '@renderer/hooks/use-updates'
import { compactButtonClass } from '@renderer/lib/controls'
import {
  compareVersions,
  DAEMON_UPDATE_FOREGROUND_COMMAND,
  DAEMON_UPDATE_SYSTEMD_COMMAND,
} from '@renderer/lib/daemon-update'
import { isBrowser } from '@renderer/lib/platform'
import { copyText } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { runUserAction } from '@shared/background'
import { Check, Copy, Loader2, RotateCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function UpdatesSection(): React.JSX.Element {
  return isBrowser ? <DaemonUpdatesSection /> : <AppUpdatesSection />
}

function AppUpdatesSection(): React.JSX.Element {
  const status = useUpdateStatus()
  const { check, isChecking } = useCheckForUpdates()
  const { install, isInstalling } = useInstallUpdate()

  const checking = isChecking || status?.state === 'checking'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm-minus font-medium">Current version</p>
          <p className="text-xs text-muted-foreground">
            Porcelain {status ? `v${status.currentVersion}` : '…'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className={compactButtonClass}
          onClick={() => check()}
          disabled={checking}
        >
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
          <Button
            size="sm"
            className={compactButtonClass}
            onClick={() => install()}
            disabled={isInstalling}
          >
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

function DaemonUpdatesSection(): React.JSX.Element {
  const identity = trpc.daemonInfo.useQuery()
  const check = trpc.checkDaemonUpdate.useMutation()
  const restart = trpc.restartDaemon.useMutation()
  const [copied, setCopied] = useState(false)
  const current = check.data?.currentVersion ?? identity.data?.version ?? null
  const latest = check.data?.latestVersion ?? null
  const checked = check.data !== undefined
  const restartable = check.data?.restartable === true
  const behind = current !== null && latest !== null ? compareVersions(current, latest) < 0 : false

  const copyRestart = (): void => {
    runUserAction(
      async () => {
        await copyText(DAEMON_UPDATE_SYSTEMD_COMMAND)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      (error) => toastUserActionError('Copy restart command', error),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm-minus font-medium">Daemon version</p>
          <p className="text-xs text-muted-foreground">
            Porcelain {current !== null ? `v${current}` : '…'}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className={compactButtonClass}
          onClick={() =>
            check.mutate(undefined, {
              onError: (error) => toastUserActionError('Check for updates', error),
            })
          }
          disabled={check.isPending}
        >
          {check.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {check.isPending ? 'Checking…' : 'Check for updates'}
        </Button>
      </div>

      {check.isSuccess && latest === null && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          Couldn't reach the npm registry. Restart still installs whatever `@latest` resolves to.
        </p>
      )}
      {check.isSuccess && latest !== null && !behind && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" /> You're on the latest version.
        </p>
      )}
      {behind && (
        <p className="text-xs text-muted-foreground">
          Version {latest} is published. Restarting the always-on unit re-resolves{' '}
          <code className="font-mono">@fabiofiorita/porcelain@latest</code> and is the upgrade.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className={compactButtonClass}
          disabled={restart.isPending || !checked || !restartable}
          onClick={() =>
            restart.mutate(undefined, {
              onSuccess: () => toast.message('Restarting the daemon…'),
              onError: (error) => toastUserActionError('Restart daemon', error),
            })
          }
        >
          {restart.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {restart.isPending ? 'Restarting…' : 'Update and restart'}
        </Button>
        <Button variant="outline" size="sm" className={compactButtonClass} onClick={copyRestart}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy restart command'}
        </Button>
      </div>
      {checked && !restartable && (
        <p className="text-xs text-muted-foreground">
          This daemon is not the always-on unit, so Porcelain will not restart it from here. Stop it
          and re-run <code className="font-mono">{DAEMON_UPDATE_FOREGROUND_COMMAND}</code>.
        </p>
      )}
    </div>
  )
}
