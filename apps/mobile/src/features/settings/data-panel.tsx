import { describeDisposition } from '@porcelain/client-runtime/companion-disposition'
import { useState } from 'react'
import { View } from 'react-native'

import { SegmentedControl } from '@/components/segmented-control'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useActiveEnvironment, useConnectionState } from '@/lib/daemon/environments-store'
import {
  type ChannelDisposition,
  companionDispositionsQuery,
  companionGitVisibilityQuery,
  setCompanionDispositionMutation,
  setCompanionGitVisibilityMutation,
} from '@/lib/daemon/procedures/companion'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

/**
 * Settings › Data — the same repo companion dispositions the desktop client edits,
 * against the same daemon procedures. Nothing here is mobile-only state: the answer
 * is parsed out of `.porcelain/.gitignore` on every read, so a flip made on a phone
 * and a flip made on the desktop cannot disagree.
 */
export function DataSettings(): React.JSX.Element {
  const environment = useActiveEnvironment()
  const connection = useConnectionState()
  const repoPath = environment?.activeRepoPath ?? null

  if (environment === null || connection.kind === 'no-environment') {
    return (
      <EmptyDataState
        body="Pair an environment first. What git carries is a property of the repository on the daemon."
        testID="porcelain-settings-data-no-env"
        title="No environment"
      />
    )
  }

  if (connection.kind !== 'ready') {
    return (
      <EmptyDataState
        body={
          connection.kind === 'connecting' || connection.kind === 'loading'
            ? 'Connecting to the daemon…'
            : 'The active environment is not reachable. Fix the connection under Environments, then return here.'
        }
        testID="porcelain-settings-data-offline"
        title="Daemon not connected"
      />
    )
  }

  if (repoPath === null) {
    return (
      <EmptyDataState
        body="Open a project from the header. Companion data is stored per repository."
        testID="porcelain-settings-data-empty"
        title="No repository selected"
      />
    )
  }

  return <CompanionDataEditor repoPath={repoPath} />
}

function EmptyDataState({
  title,
  body,
  testID,
}: {
  title: string
  body: string
  testID: string
}): React.JSX.Element {
  return (
    <View className="gap-2 rounded-xl border border-border bg-muted/40 p-4" testID={testID}>
      <Text className="text-sm font-medium text-foreground">{title}</Text>
      <Text className="text-xs leading-5 text-muted-foreground">{body}</Text>
    </View>
  )
}

function CompanionDataEditor({ repoPath }: { repoPath: string }): React.JSX.Element {
  const dispositions = useDaemonQuery(companionDispositionsQuery, repoPath)
  const visibility = useDaemonQuery(companionGitVisibilityQuery, repoPath)
  const [lastUntracked, setLastUntracked] = useState<string[]>([])

  // A flip rewrites `.gitignore` and going Local stages a deletion, so the row,
  // the visibility line, and the Changes reads are all stale afterwards. Named
  // for the mobile procedure set — this client has no `gitStatus`.
  const invalidates = [
    'companionDispositions',
    'companionGitVisibility',
    'gitFlow',
    'gitRangeFlow',
    'diffReading',
  ]
  const setDisposition = useDaemonMutation(setCompanionDispositionMutation, { invalidates })
  const setVisibility = useDaemonMutation(setCompanionGitVisibilityMutation, { invalidates })

  const hidden = visibility.data?.hidden === true

  if (dispositions.isLoading) {
    return (
      <Text className="text-sm text-muted-foreground" testID="porcelain-settings-data-loading">
        Loading channels…
      </Text>
    )
  }

  if (dispositions.isError) {
    return (
      <View
        className="gap-1 rounded-xl border border-destructive/40 bg-destructive/5 p-3"
        testID="porcelain-settings-data-error"
      >
        <Text className="text-sm font-medium text-destructive">
          Could not load what git carries
        </Text>
        <Text className="text-xs text-muted-foreground">
          {dispositions.error.message || 'The daemon refused the request.'}
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-4" testID="porcelain-settings-data">
      <View className="gap-1">
        <Text className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
          What git carries
        </Text>
        <Text className="text-xs leading-5 text-muted-foreground">
          Every channel below is stored in .porcelain/ inside this repo.{' '}
          <Text className="text-xs font-medium leading-5 text-foreground">Shared</Text> lets git
          carry it to teammates, other worktrees, and your other machines.{' '}
          <Text className="text-xs font-medium leading-5 text-foreground">Local</Text> ignores it
          here — the file still exists, it just never leaves this clone.
        </Text>
      </View>

      <View
        className="gap-2 rounded-xl border border-border bg-muted/40 p-3"
        testID="porcelain-settings-data-visibility"
      >
        <Text className="text-sm font-medium text-foreground">
          {hidden ? 'Hidden from git in this clone' : 'Visible to git'}
        </Text>
        {hidden ? (
          <Text className="text-xs leading-5 text-muted-foreground">
            Nothing shows in git status. Sharing anything lifts this.
          </Text>
        ) : null}
        <Button
          className="self-start"
          disabled={setVisibility.isPending}
          size="sm"
          testID="porcelain-settings-data-visibility-toggle"
          variant="outline"
          onPress={() => {
            setVisibility.mutate({ hidden: !hidden, repoPath })
          }}
        >
          <Text>{hidden ? 'Start sharing' : 'Hide from git'}</Text>
        </Button>
      </View>

      <View className="gap-3">
        {(dispositions.data ?? []).map((channel) => (
          <DispositionRow
            key={channel.key}
            channel={channel}
            disabled={setDisposition.isPending}
            onChange={(disposition) => {
              setDisposition.mutate(
                { disposition, key: channel.key, repoPath },
                { onSuccess: (result) => setLastUntracked(result.untracked) },
              )
            }}
          />
        ))}
      </View>

      {lastUntracked.length > 0 ? (
        <Text className="text-xs text-muted-foreground" testID="porcelain-settings-data-untracked">
          Untracked {lastUntracked.length} {lastUntracked.length === 1 ? 'file' : 'files'} — still
          on disk, removal staged.
        </Text>
      ) : null}
    </View>
  )
}

function DispositionRow({
  channel,
  disabled,
  onChange,
}: {
  channel: ChannelDisposition
  disabled: boolean
  onChange: (disposition: 'shared' | 'local') => void
}): React.JSX.Element {
  return (
    <View
      className="gap-2 rounded-xl border border-border bg-card p-3"
      testID={`porcelain-settings-data-channel-${channel.key}`}
    >
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-foreground">{channel.label}</Text>
        <Text className="text-xs leading-4 text-muted-foreground">{channel.hint}</Text>
      </View>
      <SegmentedControl<'shared' | 'local'>
        disabled={disabled}
        options={[
          {
            value: 'shared',
            label: 'Shared',
            testID: `porcelain-settings-data-channel-${channel.key}-shared`,
          },
          {
            value: 'local',
            label: 'Local',
            testID: `porcelain-settings-data-channel-${channel.key}-local`,
          },
        ]}
        value={channel.disposition}
        onChange={onChange}
      />
      <Text
        className="text-xs leading-4 text-muted-foreground"
        testID={`porcelain-settings-data-channel-${channel.key}-state`}
      >
        {describeDisposition(channel.disposition, channel.trackedPaths.length)}
      </Text>
    </View>
  )
}
