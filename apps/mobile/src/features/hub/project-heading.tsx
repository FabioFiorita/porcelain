import type { HubProjectGroup } from '@porcelain/client-runtime/projects'
import { Alert, Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { IconAction } from '@/components/panel-chrome'
import { RowContextMenu, type RowMenuAction } from '@/components/ui/row-context-menu'
import { Text } from '@/components/ui/text'
import { usePersonalizationStore } from '@/features/settings/personalization-store'
import type { Environment } from '@/features/remote'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { useHubOverlayStore } from './hub-overlay-store'
import { useRemoveHubProject } from './hub-mutations'

/**
 * The Project name above its Worktrees.
 *
 * A tap expands or collapses (when `onToggle` is passed). A long-press opens Personalization
 * for that Project — the same gesture the web client's context menu uses, because pins and
 * hides belong to the Project, not to Settings.
 */
export function ProjectHeading({
  collapsed,
  group,
  environments,
  onToggle,
  testID,
}: {
  collapsed?: boolean
  group: HubProjectGroup
  environments: Map<string, Environment>
  onToggle?: () => void
  testID: string
}): React.JSX.Element {
  const openPersonalization = usePersonalizationStore((state) => state.open)
  const openWorktreeSetup = useHubOverlayStore((state) => state.openWorktreeSetup)
  const removeProject = useRemoveHubProject()
  const worktreeCount = group.members.reduce(
    (count, member) => count + member.project.worktrees.length,
    0,
  )
  const targets = group.members.flatMap((member) => {
    const environment = environments.get(member.environment.id)
    return environment === undefined ? [] : [{ environment, member }]
  })
  const suffix = (name: string): string => (group.members.length > 1 ? ` · ${name}` : '')
  const actions: RowMenuAction[] = targets
    .flatMap<RowMenuAction>(({ environment, member }) => [
      {
        glyph: 'plus',
        id: `new-worktree-${member.project.id}`,
        label: `New worktree${suffix(member.environment.name)}`,
        onPress: () => openWorktreeSetup({ environment, project: member.project }),
      },
      {
        glyph: 'settings',
        id: `personalization-${member.project.id}`,
        label: `Personalization${suffix(member.environment.name)}`,
        onPress: () =>
          openPersonalization({
            environmentId: member.environment.id,
            projectId: member.project.id,
            projectName: member.project.name,
            projectPath: member.project.path,
          }),
      },
      {
        glyph: 'copy',
        id: `copy-path-${member.project.id}`,
        label: `Copy project path${suffix(member.environment.name)}`,
        onPress: () => {
          void copyText(member.project.path)
        },
      },
    ])
    .concat(
      targets.map(
        ({ environment, member }) =>
          ({
            destructive: true,
            glyph: 'trash',
            id: `remove-${member.project.id}`,
            label: `Remove project${suffix(member.environment.name)}`,
            onPress: () =>
              Alert.alert(
                `Remove ${member.project.name}?`,
                'The repository stays on disk. Porcelain removes it from this Projects list.',
                [
                  { style: 'cancel', text: 'Cancel' },
                  {
                    style: 'destructive',
                    text: 'Remove',
                    onPress: () => {
                      void removeProject.remove(environment, member.project.id)
                    },
                  },
                ],
              ),
          }) satisfies RowMenuAction,
      ),
    )

  return (
    <View className={cn(SURFACE_GUTTER, 'flex-row items-center gap-1 py-1')}>
      <View className="min-w-0 flex-1">
        <RowContextMenu actions={actions} testID={`${testID}-menu`} title={group.name}>
          <Pressable
            accessibilityLabel={`Project ${group.name}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: !collapsed }}
            className="min-h-9 min-w-0 flex-row items-center gap-2"
            testID={testID}
            onPress={onToggle}
          >
            <ChromeGlyph
              name={collapsed === true ? 'chevronRight' : 'chevron'}
              size={11}
              tone="muted"
            />
            <ChromeGlyph name="folder" size={14} tone="muted" />
            <Text
              className="min-w-0 flex-1 text-sm font-semibold text-foreground"
              numberOfLines={1}
            >
              {group.name}
            </Text>
            <Text className="text-2xs text-muted-foreground">{worktreeCount}</Text>
          </Pressable>
        </RowContextMenu>
      </View>
      {targets[0] === undefined ? null : (
        <IconAction
          accessibilityLabel={`New worktree in ${group.name}`}
          glyph="plus"
          testID={`${testID}-new-worktree`}
          tone="muted"
          onPress={() =>
            openWorktreeSetup({
              environment: targets[0]!.environment,
              project: targets[0]!.member.project,
            })
          }
        />
      )}
    </View>
  )
}
