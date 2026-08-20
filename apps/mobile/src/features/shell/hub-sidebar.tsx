import { type HubProjectGroup, groupEquivalentProjects } from '@porcelain/client-runtime/projects'
import { useMemo } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmptyNote } from '@/components/panel-chrome'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Text } from '@/components/ui/text'
import { WorktreeRow } from '@/features/hub/worktree-row'
import { useHubInventories, useHubRepoPath } from '@/features/projects'
import type { Environment } from '@/features/remote'
import { cn } from '@/lib/utils'

/**
 * The tablet shell's leading column: the Hub list, kept beside the screen it opened.
 *
 * This is the same list `HubScreen` paints and the same `WorktreeRow` it paints it with — the
 * row owns selection and the swipe-to-retire gesture, so a Worktree chosen here behaves as one
 * chosen from the full-width list. It opens with `navigate` rather than `push`: this column
 * never leaves the screen, so switching Worktrees from it must not deepen the stack it is
 * standing next to. What is not shared is the
 * screen's chrome: no large title (the native bar belongs to the stack in the other column, and
 * there is only one), no `+` action (it is a header action of that bar), and no collapse state
 * (a 320pt column is a scan, not a workspace).
 *
 * It deliberately does not render `HubScreen` itself: that component declares `Stack.Screen`
 * options for the bar above it, and this column has no navigator of its own to declare them to.
 */
export function HubSidebar(): React.JSX.Element {
  const inventories = useHubInventories()
  const activePath = useHubRepoPath()
  const insets = useSafeAreaInsets()
  const groups = useMemo(
    () => groupEquivalentProjects(inventories.map((entry) => entry.inventory)),
    [inventories],
  )
  const localByEnvironmentId = useMemo(() => {
    const map = new Map<string, Environment>()
    for (const entry of inventories) map.set(entry.inventory.environment.id, entry.environment)
    return map
  }, [inventories])

  return (
    <View
      className="flex-1 border-r border-border bg-background"
      /* nativewind-allow-style: the status bar and the home indicator overlay this column
         directly — it sits outside the tab stack that would otherwise clear them for it. */
      style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}
      testID="porcelain-hub-sidebar"
    >
      <Text
        className={cn(
          SURFACE_GUTTER,
          'py-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground',
        )}
      >
        Worktrees
      </Text>
      <SurfaceScroll gap={4} paddingTop={4}>
        {groups.length === 0 ? (
          <EmptyNote
            body="Pair an environment under Settings, then open a project on that daemon."
            testID="porcelain-hub-sidebar-empty"
            title="No worktrees yet"
          />
        ) : null}
        {groups.map((group) => (
          <SidebarGroup
            key={group.groupingKey}
            activePath={activePath}
            group={group}
            localByEnvironmentId={localByEnvironmentId}
          />
        ))}
      </SurfaceScroll>
    </View>
  )
}

function SidebarGroup({
  activePath,
  group,
  localByEnvironmentId,
}: {
  activePath: string | null
  group: HubProjectGroup
  localByEnvironmentId: Map<string, Environment>
}): React.JSX.Element {
  const rows = group.members.flatMap((member) =>
    member.project.worktrees.map((worktree) => ({
      environmentId: member.environment.id,
      project: member.project,
      worktree,
    })),
  )

  return (
    <View testID={`porcelain-hub-sidebar-project-${group.groupingKey}`}>
      <Text
        className={cn(SURFACE_GUTTER, 'py-2 text-sm font-semibold text-foreground')}
        numberOfLines={1}
      >
        {group.name}
      </Text>
      {rows.map((row) => (
        <WorktreeRow
          key={`${row.environmentId}:${row.worktree.id}`}
          environment={localByEnvironmentId.get(row.environmentId) ?? null}
          open="navigate"
          project={row.project}
          selected={row.worktree.path === activePath}
          worktree={row.worktree}
        />
      ))}
    </View>
  )
}
