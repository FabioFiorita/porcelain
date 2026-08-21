import { type HubProjectGroup, groupEquivalentProjects } from '@porcelain/client-runtime/projects'
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, ScreenHeader } from '@/components/panel-chrome'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Text } from '@/components/ui/text'
import { useHubInventories, useHubRepoPath } from '@/features/projects'
import type { Environment } from '@/features/remote'
import { cn } from '@/lib/utils'

import { NewWorktreeHeaderAction } from './hub-header-actions'
import { WorktreeRow } from './worktree-row'

/**
 * The Hub list — every Worktree of every paired Environment in ONE list, grouped by Project.
 *
 * There is deliberately no Environment filter and no search field. An Environment is a fact
 * ABOUT a Worktree, printed on its row; making it a scope would put the human back in the
 * position of choosing a machine before they can choose the work, which is the shell this
 * replaces. Projects that are the same repository on two machines share a `groupingKey`, so
 * `groupEquivalentProjects` puts them under one heading without merging the records.
 */
export function HubScreen(): React.JSX.Element {
  const inventories = useHubInventories()
  const activePath = useHubRepoPath()
  const groups = useMemo(
    () => groupEquivalentProjects(inventories.map((entry) => entry.inventory)),
    [inventories],
  )
  // Local pairing record per daemon Environment id: the group members carry the daemon's
  // identity, but opening a Worktree writes to the record this device paired.
  const localByEnvironmentId = useMemo(() => {
    const map = new Map<string, Environment>()
    for (const entry of inventories) map.set(entry.inventory.environment.id, entry.environment)
    return map
  }, [inventories])
  const [collapsed, setCollapsed] = useState<readonly string[]>([])

  return (
    <View className="flex-1 bg-background" testID="porcelain-hub-screen">
      <ScreenHeader
        actions={<NewWorktreeHeaderAction />}
        testID="porcelain-hub-header"
        title="Worktrees"
      />
      <SurfaceScroll gap={4} paddingTop={8}>
        {groups.length === 0 ? (
          <EmptyNote
            body="Pair an environment under Settings, then open a project on that daemon."
            testID="porcelain-hub-empty"
            title="No worktrees yet"
          />
        ) : null}
        {groups.map((group) => (
          <ProjectGroup
            key={group.groupingKey}
            activePath={activePath}
            collapsed={collapsed.includes(group.groupingKey)}
            group={group}
            localByEnvironmentId={localByEnvironmentId}
            onToggle={() => {
              setCollapsed((current) =>
                current.includes(group.groupingKey)
                  ? current.filter((key) => key !== group.groupingKey)
                  : [...current, group.groupingKey],
              )
            }}
          />
        ))}
      </SurfaceScroll>
    </View>
  )
}

function ProjectGroup({
  activePath,
  collapsed,
  group,
  localByEnvironmentId,
  onToggle,
}: {
  activePath: string | null
  collapsed: boolean
  group: HubProjectGroup
  localByEnvironmentId: Map<string, Environment>
  onToggle: () => void
}): React.JSX.Element {
  const rows = group.members.flatMap((member) =>
    member.project.worktrees.map((worktree) => ({
      environmentId: member.environment.id,
      project: member.project,
      worktree,
    })),
  )

  return (
    <View testID={`porcelain-hub-project-${group.groupingKey}`}>
      <Pressable
        accessibilityLabel={`Project ${group.name}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        className={cn(SURFACE_GUTTER, 'flex-row items-center gap-2 py-2')}
        testID={`porcelain-hub-project-toggle-${group.groupingKey}`}
        onPress={onToggle}
      >
        <ChromeGlyph name={collapsed ? 'chevronRight' : 'chevron'} size={11} tone="muted" />
        <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
          {group.name}
        </Text>
        <Text className="text-2xs text-muted-foreground">{rows.length}</Text>
      </Pressable>
      {collapsed
        ? null
        : rows.map((row) => (
            <WorktreeRow
              key={`${row.environmentId}:${row.worktree.id}`}
              environment={localByEnvironmentId.get(row.environmentId) ?? null}
              project={row.project}
              selected={row.worktree.path === activePath}
              worktree={row.worktree}
            />
          ))}
    </View>
  )
}
