import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useEnvironmentStatuses, useRemoteEnvironments } from '@renderer/features/remote'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useCheckForUpdates, useInstallUpdate, useUpdateStatus } from '@renderer/hooks/use-updates'
import { compactButtonClass } from '@renderer/lib/controls'
import { waitForDaemonReady } from '@renderer/lib/daemon-readiness'
import {
  compareVersions,
  DAEMON_UPDATE_FOREGROUND_COMMAND,
  DAEMON_UPDATE_SYSTEMD_COMMAND,
} from '@renderer/lib/daemon-update'
import {
  environmentClientFor,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { isBrowser } from '@renderer/lib/platform'
import { trpc } from '@renderer/lib/trpc'
import { copyText } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Loader2, RotateCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function UpdatesSection(): React.JSX.Element {
  return isBrowser ? <DaemonUpdatesSection environmentId={null} /> : <ElectronUpdatesSection />
}

const LOCAL_ENVIRONMENT_VALUE = '__local__'

export function ElectronUpdatesSection(): React.JSX.Element {
  const remotes = useRemoteEnvironments()
  const statuses = useEnvironmentStatuses()
  const [environmentId, setEnvironmentId] = useState<string | null>(null)
  const selectedStatus = statuses.get(environmentId)
  const selectedName =
    environmentId === null
      ? 'Local'
      : (selectedStatus?.name ??
        remotes?.environments.find((environment) => environment.id === environmentId)?.name ??
        'Environment')

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="desktop-app-updates-heading">
        <h3 id="desktop-app-updates-heading" className="text-sm font-medium">
          Desktop app
        </h3>
        <AppUpdatesSection />
      </section>
      <section
        className="flex flex-col gap-4 border-t border-border/60 pt-5"
        aria-labelledby="environment-daemon-updates-heading"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 id="environment-daemon-updates-heading" className="text-sm font-medium">
              Environment daemon
            </h3>
            <p className="text-xs text-muted-foreground">
              Inspect or update one daemon without changing the Environment shown by this window.
            </p>
          </div>
          <Select
            value={environmentId ?? LOCAL_ENVIRONMENT_VALUE}
            onValueChange={(value) =>
              setEnvironmentId(value === LOCAL_ENVIRONMENT_VALUE ? null : value)
            }
          >
            <SelectTrigger size="sm" aria-label="Daemon Environment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LOCAL_ENVIRONMENT_VALUE}>Local</SelectItem>
              {(remotes?.environments ?? []).map((environment) => (
                <SelectItem value={environment.id} key={environment.id}>
                  {statuses.get(environment.id)?.name ?? environment.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DaemonUpdatesSection
          key={environmentId ?? LOCAL_ENVIRONMENT_VALUE}
          environmentId={environmentId}
          environmentName={selectedName}
        />
      </section>
    </div>
  )
}

export function AppUpdatesSection(): React.JSX.Element {
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
          disabled={checking || status?.state === 'unavailable'}
        >
          {checking ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {checking ? 'Checking…' : 'Check for updates'}
        </Button>
      </div>

      {status?.state === 'unavailable' && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {status.unavailableReason}
        </p>
      )}

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

export function DaemonUpdatesSection({
  environmentId,
  environmentName,
}: {
  environmentId: string | null
  environmentName?: string
}): React.JSX.Element {
  const revision = useEnvironmentSessionsRevision()
  const primary = trpc.useUtils().client
  const owner = environmentClientFor(environmentId, primary, revision)
  const identity = useQuery({
    enabled: owner !== null,
    queryKey: ['settings', 'daemonInfo', environmentId],
    queryFn: async () => {
      if (owner === null) throw new Error('The target Environment is offline.')
      return owner.client.daemonInfo.query()
    },
  })
  const check = useMutation({
    mutationFn: async () => {
      if (owner === null) throw new Error('The target Environment is offline.')
      return owner.client.checkDaemonUpdate.mutate()
    },
  })
  const restart = useMutation({
    mutationFn: async () => {
      if (owner === null) throw new Error('The target Environment is offline.')
      return owner.client.restartDaemon.mutate()
    },
  })
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const current = check.data?.currentVersion ?? identity.data?.version ?? null
  const latest = check.data?.latestVersion ?? null
  const checked = check.data !== undefined
  const restartable = check.data?.restartable === true
  const busy = check.isPending || restart.isPending
  const behind = current !== null && latest !== null ? compareVersions(current, latest) < 0 : false

  const copyRestart = (): void => {
    runUserAction(
      async () => {
        await copyText(
          restartable ? DAEMON_UPDATE_SYSTEMD_COMMAND : DAEMON_UPDATE_FOREGROUND_COMMAND,
        )
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
          <p className="text-sm-minus font-medium">
            {environmentName === undefined ? 'Daemon version' : `${environmentName} daemon`}
          </p>
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
          disabled={busy || owner === null}
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
          disabled={busy || !checked || !restartable}
          onClick={() =>
            restart.mutate(undefined, {
              onSuccess: async () => {
                // A restart mutation only proves the supervisor accepted the request. Poll the
                // selected Environment itself, then refresh its version/session-facing cache;
                // this works for any restartable host and never tells a Windows/macOS host to
                // run a systemd command.
                try {
                  if (owner === null) throw new Error('The selected Environment is offline.')
                  owner.session?.start()
                  await waitForDaemonReady(() => owner.client.daemonInfo.query())
                  await queryClient.invalidateQueries({
                    exact: true,
                    queryKey: ['settings', 'daemonInfo', environmentId],
                  })
                  check.reset()
                  toast.success('Daemon restarted and is ready.')
                } catch (error) {
                  toastUserActionError('Wait for daemon restart', error)
                }
              },
              onError: (error) => toastUserActionError('Restart daemon', error),
            })
          }
        >
          {restart.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {restart.isPending ? 'Restarting…' : 'Update and restart'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={compactButtonClass}
          disabled={busy}
          onClick={copyRestart}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : restartable ? 'Copy restart command' : 'Copy start command'}
        </Button>
      </div>
      {checked && !restartable && (
        <p className="text-xs text-muted-foreground">
          This daemon is not the always-on unit, so Porcelain will not restart it from here. Stop it
          and re-run <code className="font-mono">{DAEMON_UPDATE_FOREGROUND_COMMAND}</code>.
        </p>
      )}
      {owner === null && (
        <p className="text-xs text-muted-foreground">
          This Environment is offline. Reconnect it before checking or installing an update.
        </p>
      )}
    </div>
  )
}
