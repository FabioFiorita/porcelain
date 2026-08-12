import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { PANEL_CARD } from '@/components/surface-layout'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import {
  type Environment,
  type EnvironmentId,
  useActiveEnvironment,
  useConnectionState,
  useEnvironments,
  useEnvironmentsCorrupt,
} from '@/features/remote'
import { cn } from '@/lib/utils'
import { AddConnectionForm, CreateGroupForm } from './environment-forms'
import { describeConnection } from './environment-labels'
import { GroupDetail } from './group-detail'
import { useEnvironmentsNavigation } from './use-environments-panel'

/**
 * Environments section — list, create, and detail for client-owned groups.
 *
 * This file is the router between the four screens and nothing else: the forms live in
 * `environment-forms.tsx`, the group editor in `group-detail.tsx`, their state in
 * `use-environments-panel.ts`, and every label in `environment-labels.ts`.
 */
export function EnvironmentsSettings(): React.JSX.Element {
  const nav = useEnvironmentsNavigation()
  const environments = useEnvironments()
  const corrupt = useEnvironmentsCorrupt()
  const { route } = nav

  if (route.kind === 'create') {
    return <CreateGroupForm onCancel={nav.toList} onCreated={nav.toDetail} />
  }

  if (route.kind === 'detail') {
    const environment = environments.find((entry) => entry.id === route.id)
    if (environment === undefined) {
      return (
        <View className="gap-3">
          <Text className="text-sm text-muted-foreground">That environment was removed.</Text>
          <Button variant="outline" onPress={nav.toList}>
            <Text>Back</Text>
          </Button>
        </View>
      )
    }
    return (
      <GroupDetail
        environment={environment}
        onBack={nav.toList}
        onDeleted={nav.toList}
        onAddConnection={() => {
          nav.toAddConnection(environment.id)
        }}
      />
    )
  }

  if (route.kind === 'add-connection') {
    const back = (): void => {
      nav.toDetail(route.id)
    }
    return <AddConnectionForm groupId={route.id} onAdded={back} onCancel={back} />
  }

  return (
    <EnvironmentsList
      corrupt={corrupt}
      environments={environments}
      onCreate={nav.toCreate}
      onOpen={nav.toDetail}
    />
  )
}

function EnvironmentsList({
  environments,
  corrupt,
  onCreate,
  onOpen,
}: {
  environments: readonly Environment[]
  corrupt: boolean
  onCreate: () => void
  onOpen: (id: EnvironmentId) => void
}): React.JSX.Element {
  const active = useActiveEnvironment()
  const connection = useConnectionState()

  return (
    <View className="gap-3" testID="porcelain-settings-environments">
      <Text className="text-sm text-muted-foreground">
        Pair this device with a daemon. Prefer LAN first; add Tailscale or Funnel as fallbacks.
        Production port 43117 is never used for product work on this app.
      </Text>

      {corrupt ? (
        <ErrorNote
          message="Saved environments unreadable. The on-device index could not be parsed. Existing credentials were not deleted — reinstall or restore from a backup, then re-pair."
          testID="porcelain-settings-environments-corrupt"
        />
      ) : null}

      {environments.length === 0 && !corrupt ? (
        <EmptyNote
          body="Create a group with a connection link from the host Share settings."
          testID="porcelain-settings-environments-empty"
          title="No environments yet"
        />
      ) : null}

      {environments.map((environment) => {
        const isActive = environment.id === active?.id
        const statusLabel = describeConnection(environment, isActive, connection)
        return (
          <Pressable
            key={environment.id}
            accessibilityLabel={`${environment.nickname}, ${statusLabel}`}
            accessibilityRole="button"
            className={cn(
              PANEL_CARD,
              'flex-row items-center gap-3 p-3 active:bg-accent',
              isActive && 'border-primary/40 bg-primary/5',
            )}
            testID={`porcelain-settings-environment-${environment.id}`}
            onPress={() => {
              onOpen(environment.id)
            }}
          >
            <View className="size-10 items-center justify-center rounded-lg bg-muted">
              <ChromeGlyph name={environment.icon} size={18} tone="foreground" />
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="font-medium text-foreground" numberOfLines={1}>
                {environment.nickname}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
            {isActive ? <Text className="text-xs font-semibold text-primary">Active</Text> : null}
            <ChromeGlyph name="chevronRight" size={14} />
          </Pressable>
        )
      })}

      <Button testID="porcelain-settings-create-environment" variant="outline" onPress={onCreate}>
        <Text>Create environment group</Text>
      </Button>
    </View>
  )
}
