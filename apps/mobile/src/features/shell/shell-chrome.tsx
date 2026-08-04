import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
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
import { ChromeGlyph, SurfaceGlyph } from './shell-icon'
import { useShellStore } from './shell-store'
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
  const { branch, environmentLabel, projectInitial, repo, worktree } = useWorkspaceHeader()

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
            accessibilityLabel={`Switch project${repo === null ? '' : `, ${repo.name}`}`}
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

export function PrimaryColumn(): React.JSX.Element {
  const activeId = useShellStore((state) => state.activeSurface)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const toggleInspector = useShellStore((state) => state.toggleInspector)
  const inspectorVisible = useShellStore((state) => state.inspectorVisible)

  return (
    <SafeAreaView className="flex-1 bg-sidebar" edges={{ bottom: true, left: true }}>
      {/* Top padding clears the native SplitView sidebar toggle over the rail. */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow gap-4 px-2 pb-5 pt-14"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1 px-2">
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Destinations
          </Text>
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

        {/* Settings lives only in the header gear — keep companion toggle as rail affordance. */}
        <View className="mt-auto gap-2 px-1">
          <Separator />
          <Button onPress={toggleInspector} size="sm" variant="outline">
            <ChromeGlyph name="companion" size={16} tone="foreground" />
            <UiText>{inspectorVisible ? 'Hide companion' : 'Show companion'}</UiText>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    <Button
      accessibilityState={{ selected: active }}
      className={cn(
        'h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5',
        active ? 'bg-accent' : 'bg-transparent',
      )}
      onPress={onPress}
      variant="ghost"
    >
      <SurfaceGlyph active={active} surface={surface.id} />
      <UiText
        className={cn(
          'flex-1 text-left text-sm font-medium',
          active ? 'text-accent-foreground' : 'text-foreground',
        )}
      >
        {surface.label}
      </UiText>
      {active ? <View className="size-1.5 rounded-full bg-primary" /> : null}
    </Button>
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

  return (
    <SafeAreaView
      className="flex-1 border-l border-border bg-card"
      edges={{ bottom: true, left: true, right: true }}
    >
      {/* Extra top inset clears the system SplitView collapse control when the rail hides. */}
      <View
        className={cn('flex-1 gap-4 pb-5 pr-3', primaryCollapsed ? 'pt-[72px] pl-11' : 'pt-5 pl-3')}
      >
        <View className="gap-1 px-1">
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
    </SafeAreaView>
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

  return (
    <SafeAreaView
      className="flex-1 border-l border-border bg-muted/20"
      edges={{ bottom: true, right: true }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-3 pb-6 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Companion
            </Text>
            <Text className="text-xl font-bold text-foreground">{surface.companionTitle}</Text>
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
    </SafeAreaView>
  )
}

export function ViewerCanvas({ surfaceId }: { surfaceId: SurfaceId }): React.JSX.Element {
  const surface = SURFACES.find((entry) => entry.id === surfaceId) ?? SURFACES[0]
  const items = LIST_ITEMS[surface.id]
  const selectedId = useShellStore((state) => state.selectedIds[surface.id])
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  const placeholder = VIEWER_PLACEHOLDERS[surface.viewerKind]

  return (
    <ScrollView
      className="flex-1 bg-background"
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
