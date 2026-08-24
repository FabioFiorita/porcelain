import { type HubProjectGroup, groupEquivalentProjects } from '@porcelain/client-runtime/projects'
import { useMemo, useState } from 'react'
import { View } from 'react-native'

import { EmptyNote, ScreenHeader } from '@/components/panel-chrome'
import { SurfaceScroll } from '@/components/surface-scroll'
import { useHubInventories, useHubRepoPath } from '@/features/projects'
import type { Environment } from '@/features/remote'
import { useShellStore } from '@/features/shell/shell-store'
import { useShellLayout } from '@/features/shell/use-app-window'

import { HubHeaderActions } from './hub-header-actions'
import { ProjectHeading } from './project-heading'
import { WorktreeRow } from './worktree-row'

/**
 * The Hub list — every Worktree of every paired Environment in ONE list, grouped by Project.
 *
 * There is deliberately no Environment filter and no search field. An Environment is a fact
 * ABOUT a Worktree, printed on its row; making it a scope would put the human back in the
 * position of choosing a machine before they can choose the work, which is the shell this
 * replaces. Projects that are the same repository on two machines share a `groupingKey`, so
 * `groupEquivalentProjects` puts them under one heading without merging the records.
 *
 * **On a tablet with its navigation panel open, this screen is the empty viewer.** The panel
 * already carries the same list, drawn with the same rows, so the viewer was printing a second
 * copy of the sidebar next to the sidebar. The web client does not: with nothing selected its
 * viewer says so, and the tree beside it is the one place Worktrees live. The list comes back
 * the moment the panel is closed or the window is too narrow for it — that is the phone's
 * shape, where the list IS the screen.
 */
export function HubScreen(): React.JSX.Element {
  const sidebarShowsTheList = useShellStore((state) => state.sidebarVisible)
  const inPanels = useShellLayout() === 'split'
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

  if (inPanels && sidebarShowsTheList) {
    return (
      <View className="flex-1 bg-background" testID="porcelain-hub-screen">
        <ScreenHeader
          actions={<HubHeaderActions />}
          testID="porcelain-hub-header"
          title="Worktrees"
        />
        {/* A header over an empty column reads as a pane that failed to load. Say what the
            viewer is for, the way it does once a Worktree IS open. */}
        <EmptyNote
          body="Pick one from the panel on the left, then open a file, a diff or a Canvas from the Surfaces panel."
          testID="porcelain-hub-viewer-empty"
          title="No Worktree open"
        />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background" testID="porcelain-hub-screen">
      <ScreenHeader
        actions={<HubHeaderActions />}
        testID="porcelain-hub-header"
        title="Worktrees"
      />
      <SurfaceScroll edgeToEdge gap={4} paddingTop={8}>
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
      <ProjectHeading
        collapsed={collapsed}
        environments={localByEnvironmentId}
        group={group}
        testID={`porcelain-hub-project-toggle-${group.groupingKey}`}
        onToggle={onToggle}
      />
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
