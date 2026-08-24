import { groupEquivalentProjects, type HubProjectGroup } from '@porcelain/client-runtime/projects'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, IconAction } from '@/components/panel-chrome'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Text } from '@/components/ui/text'
import { ProjectHeading } from '@/features/hub/project-heading'
import { useHubOverlayStore } from '@/features/hub/hub-overlay-store'
import { WorktreeRow } from '@/features/hub/worktree-row'
import { useHubInventories, useHubRepoPath } from '@/features/projects'
import type { Environment } from '@/features/remote'
import { cn } from '@/lib/utils'

import { shellSheetHref } from './shell-sheets'
import { useShellStore } from './shell-store'

/**
 * The tablet's leading panel: the web client's left sidebar, on iPad.
 *
 * It is navigation only, in the web sidebar's order — Search, the Hub tree, Settings in the
 * footer. Two things about it are worth naming:
 *
 * **Settings opens the dialog**, the same overlay the web and Mac apps use. A `TabTrigger`
 * would have swapped the viewer to the phone Settings stack, which is the wrong shape here.
 *
 * **The Worktree list is in the panel, not behind it.** On a phone the Hub list IS a screen; at
 * iPad width the list beside the thing it opened is the whole point of the extra column, and it
 * is the same `WorktreeRow` the phone list uses so selection and the retire gesture behave the
 * same. It opens with `navigate` rather than `push`: this column never leaves the screen, so
 * switching Worktrees from it must not deepen the stack it is standing next to.
 */
export function TabletSidebar(): React.JSX.Element {
  return (
    <View
      className="flex-1 overflow-hidden rounded-xl border border-border bg-background"
      testID="porcelain-tablet-sidebar"
    >
      <SidebarHeader />
      <SearchRow />
      <WorktreeList />
      <View className="border-t border-border px-2 py-2">
        <SettingsRow />
      </View>
    </View>
  )
}

/**
 * The product's own name over the panel, the way the web sidebar heads itself — and the `+`
 * that adds a Worktree.
 *
 * That control used to live only in the viewer's header at the Hub root, which is the one place
 * on a tablet you almost never stand: the moment the viewer navigates to a file it is gone, and
 * the sidebar beside it is where the list it adds to actually is. Web puts it here for the same
 * reason.
 */
function SidebarHeader(): React.JSX.Element {
  const openProjectPicker = useHubOverlayStore((state) => state.openProjectPicker)

  return (
    <View className="min-h-12 flex-row items-center gap-2 border-b border-border pl-3 pr-1">
      <Image
        accessibilityIgnoresInvertColors
        className="size-5 shrink-0 rounded-md"
        source={require('../../../assets/images/icon.png')}
        testID="porcelain-tablet-logo"
      />
      <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
        Porcelain
      </Text>
      <IconAction
        accessibilityLabel="Open project"
        glyph="plus"
        testID="porcelain-tablet-open-project"
        tone="foreground"
        onPress={() => {
          openProjectPicker()
        }}
      />
    </View>
  )
}

/**
 * Quick open, as the field the web sidebar puts at the top rather than a glyph in a bar.
 *
 * A button rather than a live input: the palette is a presented sheet with its own field, and
 * two fields for one search is the thing the web client's own Search button avoids.
 */
function SearchRow(): React.JSX.Element {
  const router = useRouter()

  return (
    <View className="px-2 pt-2">
      <Pressable
        accessibilityLabel="Quick open"
        accessibilityRole="button"
        className="min-h-9 flex-row items-center gap-2 rounded-md border border-input px-2 active:bg-accent"
        testID="porcelain-tablet-search"
        onPress={() => {
          router.push(shellSheetHref('search'))
        }}
      >
        <ChromeGlyph name="search" size={14} tone="muted" />
        <Text className="min-w-0 flex-1 text-xs text-muted-foreground" numberOfLines={1}>
          Search
        </Text>
      </Pressable>
    </View>
  )
}

function SettingsRow(): React.JSX.Element {
  const openSettings = useShellStore((state) => state.openSettings)

  return (
    <Pressable
      accessibilityLabel="Settings"
      accessibilityRole="button"
      className="min-h-9 min-w-0 flex-row items-center gap-2 rounded-md px-2 active:bg-accent/40"
      testID="porcelain-tablet-settings"
      onPress={() => {
        openSettings()
      }}
    >
      <ChromeGlyph name="settings" size={15} tone="muted" />
      <Text className="min-w-0 flex-1 text-xs font-medium text-muted-foreground" numberOfLines={1}>
        Settings
      </Text>
    </Pressable>
  )
}

function WorktreeList(): React.JSX.Element {
  const inventories = useHubInventories()
  const activePath = useHubRepoPath()
  const [collapsed, setCollapsed] = useState<readonly string[]>([])
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
    <View className="min-h-0 flex-1">
      <Text
        className={cn(
          SURFACE_GUTTER,
          'pt-4 pb-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground',
        )}
      >
        Worktrees
      </Text>
      <SurfaceScroll edgeToEdge gap={4} paddingTop={4}>
        {groups.length === 0 ? (
          <EmptyNote
            body="Pair an environment under Settings, then open a project on that daemon."
            testID="porcelain-tablet-sidebar-empty"
            title="No worktrees yet"
          />
        ) : null}
        {groups.map((group) => (
          <SidebarGroup
            key={group.groupingKey}
            activePath={activePath}
            collapsed={collapsed.includes(group.groupingKey)}
            group={group}
            localByEnvironmentId={localByEnvironmentId}
            onToggle={() =>
              setCollapsed((current) =>
                current.includes(group.groupingKey)
                  ? current.filter((key) => key !== group.groupingKey)
                  : [...current, group.groupingKey],
              )
            }
          />
        ))}
      </SurfaceScroll>
    </View>
  )
}

function SidebarGroup({
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
    <View testID={`porcelain-tablet-sidebar-project-${group.groupingKey}`}>
      <ProjectHeading
        collapsed={collapsed}
        environments={localByEnvironmentId}
        group={group}
        testID={`porcelain-tablet-sidebar-project-toggle-${group.groupingKey}`}
        onToggle={onToggle}
      />
      {collapsed
        ? null
        : rows.map((row) => (
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
