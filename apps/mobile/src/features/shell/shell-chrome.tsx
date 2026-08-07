import { createContext, useContext } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView, type SafeAreaViewProps } from 'react-native-screens/experimental'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import {
  COMPANION,
  LIST_ITEMS,
  type ListItem,
  SURFACES,
  type Surface,
  type SurfaceId,
  surfaceById,
  VIEWER_PLACEHOLDERS,
} from './mock-data'
import { SurfaceGlyph } from './shell-icon'
import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import { useIsAppFullscreen } from './use-app-window'
import { useWorkspaceHeader } from './workspace-switchers'

/**
 * Tablet title bar — web geometry:
 * - Search is absolutely centered in the full bar (not leftover flex space).
 * - Project is an avatar-only switcher (web rail pattern); name lives in a11y + sheet.
 * - Left/right clusters are content-width only so they never cover the search hit target.
 */
export function TabletHeader(_props: { platformLabel: string }): React.JSX.Element {
  const openSheet = useShellStore((state) => state.openSheet)
  const toggleInspector = useShellStore((state) => state.toggleInspector)
  const inspectorVisible = useShellStore((state) => state.inspectorVisible)
  const isFullscreen = useIsAppFullscreen()
  const { branch, environmentLabel, projectInitial, projectName, repo, worktree } =
    useWorkspaceHeader()

  return (
    <View className="border-b border-border bg-background px-3 pb-2 pt-1.5">
      <View className="relative h-12">
        {/* True window center — independent of asymmetric left/right chrome. */}
        <View
          pointerEvents="box-none"
          className="absolute inset-0 z-0 items-center justify-center px-14"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search files, folders, commands, commits"
            className="h-10 w-full max-w-[27.5rem] flex-row items-center gap-2 rounded-xl border border-border/70 bg-muted px-3 active:bg-accent"
            testID="porcelain-tablet-search"
            onPress={() => {
              openSheet('search')
            }}
          >
            <ChromeGlyph name="search" size={15} />
            <Text className="min-w-0 flex-1 text-sm text-muted-foreground" numberOfLines={1}>
              Search files, folders, commands…
            </Text>
          </Pressable>
        </View>

        {/* Left: avatar project + branch + worktree (content-width, above search layer). */}
        <View
          className={cn(
            'absolute bottom-0 left-0 top-0 z-10 flex-row items-center gap-2',
            isFullscreen ? 'pl-1' : 'pl-[72px]',
          )}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch project${repo === null ? '' : `, ${projectName}`}`}
            className="relative size-10 items-center justify-center rounded-xl border border-border bg-secondary active:bg-accent"
            testID="porcelain-tablet-project"
            onPress={() => {
              openSheet('project')
            }}
          >
            <Text className="text-sm font-semibold text-foreground">{projectInitial}</Text>
            <View className="absolute -bottom-0.5 -right-0.5 size-3.5 items-center justify-center rounded-full border border-border bg-card">
              <ChromeGlyph name="chevron" size={8} />
            </View>
          </Pressable>

          <HeaderChip
            accessibilityLabel={`Branch ${branch}`}
            label={branch}
            onPress={() => {
              openSheet('branch')
            }}
            subtitle="Branch"
            testID="porcelain-tablet-branch"
          />
          <HeaderChip
            accessibilityLabel={`Worktree ${worktree}`}
            label={worktree}
            onPress={() => {
              openSheet('worktree')
            }}
            subtitle="Worktree"
            testID="porcelain-tablet-worktree"
          />
        </View>

        {/* Right: settings → bolt → environment */}
        <View className="absolute bottom-0 right-0 top-0 z-10 flex-row items-center gap-2">
          <HeaderIconButton
            accessibilityLabel="Settings"
            onPress={() => {
              openSheet('settings')
            }}
            symbol="settings"
            testID="porcelain-tablet-settings"
          />
          <HeaderIconButton
            accessibilityLabel={inspectorVisible ? 'Hide companion' : 'Show companion'}
            onPress={toggleInspector}
            symbol="companion"
            testID="porcelain-tablet-companion"
          />
          <View className="h-10 shrink-0 justify-center rounded-xl border border-border bg-card px-3">
            <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Environment
            </Text>
            <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
              {environmentLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function HeaderChip({
  accessibilityLabel,
  label,
  subtitle,
  onPress,
  testID,
}: {
  accessibilityLabel: string
  label: string
  subtitle: string
  onPress: () => void
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="h-10 shrink-0 flex-row items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 active:bg-accent"
      testID={testID}
      onPress={onPress}
    >
      <View className="gap-0.5">
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {subtitle}
        </Text>
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <ChromeGlyph name="chevron" size={12} />
    </Pressable>
  )
}

/** Icon control — matches search / env chip height. */
function HeaderIconButton({
  accessibilityLabel,
  onPress,
  symbol,
  testID,
}: {
  accessibilityLabel: string
  onPress: () => void
  symbol: 'settings' | 'companion'
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="size-10 items-center justify-center rounded-xl border border-border bg-card active:bg-accent"
      testID={testID}
      onPress={onPress}
    >
      <ChromeGlyph name={symbol} size={16} tone="foreground" />
    </Pressable>
  )
}

/**
 * How far a SplitView column overruns the bottom of the screen, in points.
 *
 * The iPad shell puts its own header above the native SplitView, but the columns inside it are
 * still laid out at the full window height — so every column ends that far below the screen and
 * quietly loses whatever sits at its bottom: the rail's companion toggle, and the selection bar
 * a comment is filed from. The shell measures the offset once and every column subtracts it.
 * Zero everywhere else, which is why the phone never showed the bug.
 */
const ColumnOverflowContext = createContext(0)

export function ColumnOverflowProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: number
}): React.JSX.Element {
  return <ColumnOverflowContext.Provider value={value}>{children}</ColumnOverflowContext.Provider>
}

/**
 * A tablet column's paint, its safe-area padding, and its share of the overflow above.
 *
 * `react-native-screens`' `SafeAreaView` is a native host NativeWind does not interop, so a
 * `className` on it is silently dropped — which is why the rail and the list column rendered
 * as bare black holes inside the iPad SplitView while every styled child inside them was fine.
 * The fill and the border go on a plain `View` around it, and the SafeAreaView keeps doing the
 * one thing it is here for: the insets. Wrapping rather than padding by hand keeps the fill
 * under the inset strip, where a column's background belongs.
 */
function ColumnSurface({
  children,
  className,
  edges,
}: {
  children: React.ReactNode
  className: string
  edges: SafeAreaViewProps['edges']
}): React.JSX.Element {
  const overflow = useContext(ColumnOverflowContext)
  return (
    // nativewind-allow-style: the overflow is measured at runtime, not a class.
    <View className={cn('flex-1', className)} style={{ paddingBottom: overflow }}>
      {/* nativewind-allow-style: this host drops className, which is the whole point above. */}
      <SafeAreaView edges={edges} style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </View>
  )
}

export function PrimaryColumn(): React.JSX.Element {
  const activeId = useShellStore((state) => state.activeSurface)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)

  return (
    <ColumnSurface className="bg-sidebar" edges={{ bottom: true, left: true }}>
      <ScrollView
        className="flex-1"
        /* surface-gutter-allow: an icon rail, not a surface — its width IS the tap targets,
           and a 16pt gutter would push them off their own column. */
        contentContainerClassName="grow gap-2 px-2 pb-5 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/*
          The title shares a line with the system SplitView toggle rather than clearing it.
          Measured on an iPad Pro 13": the toggle is a 36pt square at y=109, so a 36pt band
          starting at the column's `pt-4` puts this title's centre on the toggle's, and the
          first destination lands just under both instead of 34pt below the toggle with an
          empty strip between. The toggle sits at the column's right edge and this text runs
          out of the left, so the two never meet.
        */}
        <View className="h-9 justify-center px-2">
          <Text className="text-xl font-bold text-foreground">Destinations</Text>
        </View>
        <View className="gap-0.5">
          {SURFACES.map((surface) => (
            <SurfaceNavLink
              key={surface.id}
              active={surface.id === activeId}
              surface={surface}
              onPress={() => {
                setActiveSurface(surface.id)
              }}
            />
          ))}
        </View>
        {/* No companion toggle down here: the header's bolt is the one control for it, and a
            rail that ends in a second copy of a header button reads as two ways to be wrong. */}
      </ScrollView>
    </ColumnSurface>
  )
}

function SurfaceNavLink({
  active,
  surface,
  onPress,
}: {
  active: boolean
  surface: Surface
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={surface.label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={cn(
        'w-full flex-row items-center justify-start gap-3 rounded-xl px-3 py-3 active:bg-accent dark:active:bg-accent/50',
        active ? 'bg-accent' : 'bg-transparent',
      )}
      onPress={onPress}
      testID={`porcelain-tablet-destination-${surface.id}`}
    >
      <SurfaceGlyph active={active} surface={surface.id} />
      <UiText
        className={cn(
          'min-w-0 flex-1 text-left text-sm font-medium leading-6',
          active ? 'text-accent-foreground' : 'text-foreground',
        )}
      >
        {surface.label}
      </UiText>
      {active ? <View className="size-1.5 rounded-full bg-primary" /> : null}
    </Pressable>
  )
}

export function SupplementaryColumn({
  primaryCollapsed,
}: {
  primaryCollapsed: boolean
}): React.JSX.Element {
  const surfaceId = useShellStore((state) => state.activeSurface)
  const surface = surfaceById(surfaceId)
  const items = LIST_ITEMS[surface.id]
  const selectedId = useShellStore((state) => state.selectedIds[surface.id])
  const selectItem = useShellStore((state) => state.selectItem)
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  const slots = surfaceSlots(surfaceId)

  // A real surface owns its whole column: its header carries live counts and scope controls
  // that the mock title / hint block has no room for.
  if (slots !== undefined) {
    return (
      <ColumnSurface
        className={cn('bg-background', !primaryCollapsed && 'border-l border-border')}
        edges={{ bottom: true, left: true, right: true }}
      >
        <View className="flex-1 pt-4">
          {/*
            Collapsing the rail moves the system toggle into this column's top-left. The title
            steps aside for it instead of dropping below it: a 72pt top inset pushed the whole
            column down and left a dead band across the top, and the list is the thing you came
            here to read. Indenting the one line the toggle overlaps costs nothing.
          */}
          <Text
            className={cn(
              'pb-1 text-xl font-bold text-foreground',
              primaryCollapsed ? 'pl-14 pr-4' : 'px-4',
            )}
          >
            {surface.listTitle}
          </Text>
          <slots.list active />
        </View>
      </ColumnSurface>
    )
  }

  return (
    <ColumnSurface
      className={cn('bg-background', !primaryCollapsed && 'border-l border-border')}
      edges={{ bottom: true, left: true, right: true }}
    >
      <View className="flex-1 gap-4 pb-5 pl-3 pr-3 pt-5">
        <View className={cn('gap-1', primaryCollapsed ? 'pl-12 pr-1' : 'px-1')}>
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Supplementary
          </Text>
          <Text className="text-xl font-bold text-foreground">{surface.listTitle}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">{surface.listHint}</Text>
        </View>

        {surface.id === 'search' ? (
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5"
            onPress={() => {
              useShellStore.getState().openSheet('search')
            }}
          >
            <ChromeGlyph name="search" size={16} />
            <Text className="flex-1 text-sm text-muted-foreground">Search the workspace…</Text>
          </Pressable>
        ) : null}

        <Separator />

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-1">
            {items.map((item) => (
              <ListRow
                key={item.id}
                item={item}
                selected={item.id === selected?.id}
                onPress={() => {
                  selectItem(surface.id, item.id)
                }}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </ColumnSurface>
  )
}

function ListRow({
  item,
  selected,
  onPress,
}: {
  item: ListItem
  selected: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-accent',
        selected && 'bg-muted/70',
      )}
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-medium text-foreground" numberOfLines={1}>
          {item.label}
        </Text>
        <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
          {item.detail}
        </Text>
      </View>
      {item.badge ? (
        <Badge variant="outline">
          <UiText>{item.badge}</UiText>
        </Badge>
      ) : null}
      {item.state === 'attention' && !item.badge ? (
        <View className="size-2 rounded-full bg-primary" />
      ) : null}
    </Pressable>
  )
}

export function CompanionColumn(): React.JSX.Element {
  const surfaceId = useShellStore((state) => state.activeSurface)
  const surface = surfaceById(surfaceId)
  const sections = COMPANION[surface.id]
  const toggleInspector = useShellStore((state) => state.toggleInspector)
  const slots = surfaceSlots(surfaceId)

  if (slots !== undefined) {
    return (
      <ColumnSurface
        className="border-l border-border bg-muted/20"
        edges={{ bottom: true, right: true }}
      >
        <View className="flex-row items-start justify-between gap-2 px-3 pt-4">
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-bold text-foreground">Companion</Text>
          </View>
          <Button
            accessibilityLabel="Close companion"
            onPress={toggleInspector}
            size="icon"
            variant="ghost"
          >
            <ChromeGlyph name="close" size={16} tone="foreground" />
          </Button>
        </View>
        <slots.companion active />
      </ColumnSurface>
    )
  }

  return (
    <ColumnSurface
      className="border-l border-border bg-muted/20"
      edges={{ bottom: true, right: true }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-6 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-bold text-foreground">Companion</Text>
          </View>
          <Button
            accessibilityLabel="Close companion"
            onPress={toggleInspector}
            size="icon"
            variant="ghost"
          >
            <ChromeGlyph name="close" size={16} tone="foreground" />
          </Button>
        </View>

        {sections.map((section) => (
          <View key={section.id} className="gap-2 rounded-2xl border border-border bg-card p-3">
            <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </Text>
            <View className="gap-2">
              {section.rows.map((row) => (
                <View key={row.id} className="gap-0.5">
                  <Text className="text-sm font-medium text-foreground">{row.label}</Text>
                  {row.detail ? (
                    <Text className="text-xs text-muted-foreground">{row.detail}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </ColumnSurface>
  )
}

export function ViewerCanvas({ surfaceId }: { surfaceId: SurfaceId }): React.JSX.Element {
  const slots = surfaceSlots(surfaceId)
  const overflow = useContext(ColumnOverflowContext)
  return (
    // The viewer is a column like any other, and its floating chrome — the selection bar a
    // comment is filed from — anchors to this box's bottom edge. See `ColumnOverflowContext`.
    // nativewind-allow-style: the overflow is measured at runtime, not a class.
    <View className="flex-1 bg-background" style={{ paddingBottom: overflow }}>
      {slots === undefined ? <MockViewerCanvas surfaceId={surfaceId} /> : <slots.viewer active />}
    </View>
  )
}

function MockViewerCanvas({ surfaceId }: { surfaceId: SurfaceId }): React.JSX.Element {
  const surface = SURFACES.find((entry) => entry.id === surfaceId) ?? SURFACES[0]
  const items = LIST_ITEMS[surface.id]
  const selectedId = useShellStore((state) => state.selectedIds[surface.id])
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  const placeholder = VIEWER_PLACEHOLDERS[surface.viewerKind]

  return (
    <ScrollView
      className="flex-1 bg-background"
      /* surface-gutter-allow: the placeholder standing in for a viewer that has not landed —
         prose in an empty pane, not a surface anything aligns to. */
      contentContainerClassName="gap-5 px-6 py-6"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-2">
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Viewer · {surface.label}
        </Text>
        <Text className="text-3xl font-extrabold tracking-tight text-foreground">
          {selected?.label ?? placeholder.title}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {selected?.detail ?? 'Select an item in the supplementary list.'}
        </Text>
      </View>

      <View className="gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        <Text className="text-base font-semibold text-foreground">{placeholder.title}</Text>
        <Text className="text-sm leading-6 text-muted-foreground">{placeholder.body}</Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Badge variant="secondary">
          <UiText>Mock shell</UiText>
        </Badge>
        <Badge variant="outline">
          <UiText>{surface.viewerKind}</UiText>
        </Badge>
      </View>
    </ScrollView>
  )
}
