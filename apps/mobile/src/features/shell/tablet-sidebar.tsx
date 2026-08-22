import { type HubProjectGroup, groupEquivalentProjects } from '@porcelain/client-runtime/projects'
import { useRouter } from 'expo-router'
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui'
import { useMemo } from 'react'
import { Pressable, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'
import { EmptyNote, IconAction } from '@/components/panel-chrome'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { Text } from '@/components/ui/text'
import { WorktreeRow } from '@/features/hub/worktree-row'
import { useHubInventories, useHubRepoPath } from '@/features/projects'
import type { Environment } from '@/features/remote'
import { cn } from '@/lib/utils'

import { shellSheetHref } from './shell-sheets'

/**
 * The tablet's leading panel: the web client's left sidebar, on iPad.
 *
 * It is navigation only, in the web sidebar's order — Search, the daemon-wide destinations, the
 * Hub tree, Settings in the footer. Two things about it are worth naming:
 *
 * **The destination rows are `TabTrigger`s, not links.** A trigger rendered outside the
 * `TabList` switches the tab navigator by name without pushing anything, which is what lets the
 * iPad drop the bottom bar without giving up the four stacks behind it: leaving Terminals for
 * Settings from this panel keeps the Terminals stack, and its attached session, exactly where it
 * was. A `router.push` here would have grown the current stack instead.
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
      {/* Web's order, and web's trailing `+` on the row that can create one. Tasks before
          Terminals because that is the order `app-sidebar.tsx` puts them in, and two clients
          that disagree about the order of two rows is exactly the kind of drift this pass is
          for. */}
      <View className="gap-0.5 px-2 pt-2">
        <DestinationRow action={<NewTaskAction />} glyph="checklist" label="Tasks" name="tasks" />
        <DestinationRow glyph="terminal" label="Terminals" name="terminals" />
      </View>
      <WorktreeList />
      <View className="border-t border-border px-2 py-2">
        <DestinationRow glyph="settings" label="Settings" name="settings" />
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
  const router = useRouter()

  return (
    <View className="min-h-12 flex-row items-center gap-2 border-b border-border pl-3 pr-1">
      <ChromeGlyph name="layers" size={17} tone="foreground" />
      <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
        Porcelain
      </Text>
      <IconAction
        accessibilityLabel="New Worktree"
        glyph="plus"
        testID="porcelain-tablet-new-worktree"
        tone="foreground"
        onPress={() => {
          router.push('/new-worktree')
        }}
      />
    </View>
  )
}

/** Compose a Task without leaving whatever the viewer is showing. */
function NewTaskAction(): React.JSX.Element {
  const router = useRouter()

  return (
    <IconAction
      accessibilityLabel="New Task"
      glyph="plus"
      testID="porcelain-tablet-new-task"
      onPress={() => {
        router.push('/tasks/new')
      }}
    />
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

type DestinationRowProps = TabTriggerSlotProps & {
  glyph: ChromeIconName
  label: string
}

function DestinationButton({
  glyph,
  isFocused,
  label,
  style,
  ...props
}: DestinationRowProps): React.JSX.Element {
  return (
    <Pressable
      {...props}
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      className={cn(
        'min-h-9 min-w-0 flex-1 flex-row items-center gap-2 rounded-md px-2',
        isFocused === true ? 'bg-accent' : 'active:bg-accent/40',
      )}
      style={style}
      testID={`porcelain-tablet-${label.toLowerCase()}`}
    >
      <ChromeGlyph name={glyph} size={15} tone={isFocused === true ? 'foreground' : 'muted'} />
      <Text
        className={cn(
          'min-w-0 flex-1 text-xs font-medium',
          isFocused === true ? 'text-accent-foreground' : 'text-muted-foreground',
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * A destination row. No `href`: a `TabTrigger` outside the `TabList` acts as the trigger of the
 * same `name` that IS in the list, which is how the hidden list can stay the one declaration of
 * where each tab points.
 */
function DestinationRow({
  action,
  glyph,
  label,
  name,
}: {
  /** A trailing control that belongs to the destination but is not the destination — Tasks' `+`. */
  action?: React.ReactNode
  glyph: ChromeIconName
  label: string
  name: string
}): React.JSX.Element {
  if (action === undefined) {
    return (
      <TabTrigger asChild name={name}>
        <DestinationButton glyph={glyph} label={label} />
      </TabTrigger>
    )
  }

  // The trigger wraps the ROW, not the row plus its action: a `+` inside the trigger would
  // switch the tab on its way to opening the composer.
  return (
    <View className="flex-row items-center">
      <TabTrigger asChild name={name}>
        <DestinationButton glyph={glyph} label={label} />
      </TabTrigger>
      {action}
    </View>
  )
}

function WorktreeList(): React.JSX.Element {
  const inventories = useHubInventories()
  const activePath = useHubRepoPath()
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
      <SurfaceScroll gap={4} paddingTop={4}>
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
    <View testID={`porcelain-tablet-sidebar-project-${group.groupingKey}`}>
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
