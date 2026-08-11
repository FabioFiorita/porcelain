import { describeDisposition } from '@porcelain/client-runtime/companion-disposition'
import { View } from 'react-native'

import { EmptyNote, ErrorNote, PanelLabel } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { useActiveEnvironment, useConnectionState } from '@/lib/daemon/environments-store'
import type { ChannelDisposition } from '@/lib/daemon/procedures/companion'
import { cn } from '@/lib/utils'
import { useCompanionData } from './use-settings'

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
      <EmptyNote
        body="Pair an environment first. What git carries is a property of the repository on the daemon."
        testID="porcelain-settings-data-no-env"
        title="No environment"
      />
    )
  }

  if (connection.kind !== 'ready') {
    return (
      <EmptyNote
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
      <EmptyNote
        body="Open a project from the header. Companion data is stored per repository."
        testID="porcelain-settings-data-empty"
        title="No repository selected"
      />
    )
  }

  return <CompanionDataEditor repoPath={repoPath} />
}

function CompanionDataEditor({ repoPath }: { repoPath: string }): React.JSX.Element {
  const companion = useCompanionData(repoPath)
  const hidden = companion.hidden

  if (companion.isLoading) {
    return (
      <Text className="py-6 text-sm text-muted-foreground" testID="porcelain-settings-data-loading">
        Loading channels…
      </Text>
    )
  }

  if (companion.error !== null) {
    return (
      <ErrorNote
        message={`Could not load what git carries. ${companion.error.message || 'The daemon refused the request.'}`}
        testID="porcelain-settings-data-error"
      />
    )
  }

  return (
    <View className="gap-4" testID="porcelain-settings-data">
      <View className="gap-1">
        <PanelLabel>What git carries</PanelLabel>
        <Text className="text-xs leading-5 text-muted-foreground">
          Every channel below is stored in .porcelain/ inside this repo.{' '}
          <Text className="text-xs font-medium leading-5 text-foreground">Shared</Text> lets git
          carry it to teammates, other worktrees, and your other machines.{' '}
          <Text className="text-xs font-medium leading-5 text-foreground">Local</Text> ignores it
          here — the file still exists, it just never leaves this clone.
        </Text>
      </View>

      <View className={cn(PANEL_CARD, 'gap-2 p-3')} testID="porcelain-settings-data-visibility">
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
          disabled={companion.isPending}
          size="sm"
          testID="porcelain-settings-data-visibility-toggle"
          variant="outline"
          onPress={() => {
            companion.setVisibility(!hidden)
          }}
        >
          <Text>{hidden ? 'Start sharing' : 'Hide from git'}</Text>
        </Button>
      </View>

      <View className="gap-3">
        {companion.channels.map((channel) => (
          <DispositionRow
            key={channel.key}
            channel={channel}
            disabled={companion.isPending}
            onChange={(disposition) => {
              companion.setDisposition(channel.key, disposition)
            }}
          />
        ))}
      </View>

      {companion.failure === null ? null : (
        <ErrorNote message={companion.failure} testID="porcelain-settings-data-write-error" />
      )}

      {companion.untracked.length > 0 ? (
        <Text className="text-xs text-muted-foreground" testID="porcelain-settings-data-untracked">
          Untracked {companion.untracked.length}{' '}
          {companion.untracked.length === 1 ? 'file' : 'files'} — still on disk, removal staged.
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
      className={cn(PANEL_CARD, 'gap-2 p-3')}
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
