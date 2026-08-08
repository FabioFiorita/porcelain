import { createContext, useContext } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView, type SafeAreaViewProps } from 'react-native-screens/experimental'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { cn } from '@/lib/utils'

import { SurfaceGlyph } from './shell-icon'
import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import { SURFACES, type Surface, type SurfaceId, surfaceById } from './surfaces'

/**
 * The tablet SplitView's four columns: rail, list, viewer, companion.
 *
 * Each one is the same shape — a `ColumnSurface` for paint and insets, a 36pt title band, and
 * the active surface's own panel inside it. They live together because that shape is the thing
 * they share; the title bar above them is `tablet-header.tsx`.
 */

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
  const slots = surfaceSlots(surfaceId)

  return (
    <ColumnSurface
      className={cn('bg-background', !primaryCollapsed && 'border-l border-border')}
      edges={{ bottom: true, left: true, right: true }}
    >
      <View className="flex-1 pt-4">
        {/*
          The SAME 36pt band the rail's "Destinations" title sits in, at the same `pt-4`, so
          the two column titles share a baseline across the divider. They were a text box and
          a centred band before, which put them 4pt apart — close enough to read as a
          rendering fault rather than a choice.

          Collapsing the rail moves the system toggle into this column's top-left. The title
          steps aside for it instead of dropping below it: a 72pt top inset pushed the whole
          column down and left a dead band across the top, and the list is the thing you came
          here to read. Indenting the one line the toggle overlaps costs nothing.
        */}
        <View className={cn('h-9 justify-center', primaryCollapsed ? 'pl-14 pr-4' : 'px-4')}>
          <Text className="text-xl font-bold text-foreground">{surface.listTitle}</Text>
        </View>
        <slots.list active />
      </View>
    </ColumnSurface>
  )
}

export function CompanionColumn(): React.JSX.Element {
  const surfaceId = useShellStore((state) => state.activeSurface)
  const toggleInspector = useShellStore((state) => state.toggleInspector)
  const slots = surfaceSlots(surfaceId)

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

export function ViewerCanvas({ surfaceId }: { surfaceId: SurfaceId }): React.JSX.Element {
  const slots = surfaceSlots(surfaceId)
  const overflow = useContext(ColumnOverflowContext)
  return (
    // The viewer is a column like any other, and its floating chrome — the selection bar a
    // comment is filed from — anchors to this box's bottom edge. See `ColumnOverflowContext`.
    // nativewind-allow-style: the overflow is measured at runtime, not a class.
    <View className="flex-1 bg-background" style={{ paddingBottom: overflow }}>
      <slots.viewer active />
    </View>
  )
}
