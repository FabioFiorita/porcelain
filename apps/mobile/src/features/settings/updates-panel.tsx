import { remoteProcedures } from '@porcelain/contracts/remote'
import { useState } from 'react'
import { View } from 'react-native'

import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useConnectionState } from '@/features/remote'
import { copyText } from '@/lib/clipboard'
import { namedContractMutation, namedContractQuery } from '@/lib/daemon/procedure'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

const daemonInfoProcedure = namedContractQuery('daemonInfo', remoteProcedures.daemonInfo)
const checkUpdateProcedure = namedContractMutation(
  'checkDaemonUpdate',
  remoteProcedures.checkDaemonUpdate,
)
const restartProcedure = namedContractMutation('restartDaemon', remoteProcedures.restartDaemon)

const SYSTEMD_RESTART = 'systemctl --user restart porcelain.service'

function compareVersions(left: string, right: string): number {
  const parts = (value: string): number[] =>
    (/^v?([^-+]*)/.exec(value)?.[1] ?? '').split('.').map((segment) => {
      const digits = /^\d+/.exec(segment)
      return digits === null ? 0 : Number(digits[0])
    })
  const a = parts(left)
  const b = parts(right)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

/**
 * Settings › Updates — the daemon this device is paired with, not an app-store build.
 *
 * Check talks to npm through the daemon. Restart is the upgrade for an always-on unit; a
 * development daemon refuses, and the command is copied so the host can run it.
 */
export function UpdatesSettings(): React.JSX.Element {
  const connection = useConnectionState()
  const info = useDaemonQuery(daemonInfoProcedure, undefined, {
    enabled: connection.kind === 'ready',
  })
  const check = useDaemonMutation(checkUpdateProcedure)
  const restart = useDaemonMutation(restartProcedure)
  const [copied, setCopied] = useState(false)

  if (connection.kind === 'no-environment') {
    return (
      <EmptyNote
        body="Pair an environment first. Updates are a property of the daemon this device talks to."
        testID="porcelain-settings-updates-no-env"
        title="No environment"
      />
    )
  }

  if (connection.kind !== 'ready') {
    return (
      <EmptyNote
        body="The active environment is not reachable. Fix the connection under Remotes, then return here."
        testID="porcelain-settings-updates-offline"
        title="Daemon not connected"
      />
    )
  }

  const current = check.data?.currentVersion ?? info.data?.version ?? null
  const latest = check.data?.latestVersion ?? null
  const checked = check.data !== undefined
  const restartable = check.data?.restartable === true
  const behind = current !== null && latest !== null ? compareVersions(current, latest) < 0 : false

  return (
    <View className="gap-5" testID="porcelain-settings-updates">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-sm font-medium text-foreground">Daemon version</Text>
          <Text className="text-xs text-muted-foreground">
            Porcelain {current === null ? '…' : `v${current}`}
          </Text>
        </View>
        <Button
          disabled={check.isPending}
          size="sm"
          testID="porcelain-settings-updates-check"
          variant="secondary"
          onPress={() => {
            check.mutate(undefined)
          }}
        >
          <Text>{check.isPending ? 'Checking…' : 'Check for updates'}</Text>
        </Button>
      </View>

      {check.isError ? (
        <ErrorNote
          message={check.error.message || 'Could not check for updates.'}
          testID="porcelain-settings-updates-error"
        />
      ) : null}

      {check.isSuccess && latest === null ? (
        <Text className="text-xs text-muted-foreground">
          Couldn&apos;t reach the npm registry. Restart still installs whatever `@latest` resolves
          to.
        </Text>
      ) : null}

      {check.isSuccess && latest !== null && !behind ? (
        <Text className="text-xs text-muted-foreground">You&apos;re on the latest version.</Text>
      ) : null}

      {behind ? (
        <Text className="text-xs text-muted-foreground">
          Version {latest} is published. Restarting the always-on unit re-resolves
          @fabiofiorita/porcelain@latest and is the upgrade.
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <Button
          disabled={restart.isPending || !checked || !restartable}
          size="sm"
          testID="porcelain-settings-updates-restart"
          onPress={() => {
            restart.mutate(undefined)
          }}
        >
          <Text>{restart.isPending ? 'Restarting…' : 'Restart daemon'}</Text>
        </Button>
        <Button
          size="sm"
          testID="porcelain-settings-updates-copy"
          variant="outline"
          onPress={() => {
            void copyText(SYSTEMD_RESTART).then((ok) => {
              if (!ok) return
              setCopied(true)
              setTimeout(() => {
                setCopied(false)
              }, 2000)
            })
          }}
        >
          <Text>{copied ? 'Copied' : 'Copy restart command'}</Text>
        </Button>
      </View>

      {restart.isError ? (
        <ErrorNote
          message={restart.error.message || 'That daemon cannot restart itself from here.'}
          testID="porcelain-settings-updates-restart-error"
        />
      ) : null}
    </View>
  )
}
