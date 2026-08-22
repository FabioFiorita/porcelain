import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ActionSheet, IconAction, type SheetAction } from '@/components/panel-chrome'
import { SurfaceScroll } from '@/components/surface-scroll'
import { cn } from '@/lib/utils'

import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import { type SurfaceId, SURFACES, surfaceById } from './surfaces'
import { ColumnChrome } from './window-chrome'

/**
 * The tablet's trailing panel: **Surfaces**, the web client's right sidebar.
 *
 * ```
 *  ┌──────────────────────────────┐
 *  │ ⌗ Files ×  ⎇ Changes ×    +  │  ← the strip: what is open, what is showing
 *  ├──────────────────────────────┤
 *  │  the active surface's list   │  ← rows open detail into the VIEWER, not in here
 *  └──────────────────────────────┘
 * ```
 *
 * **What this replaces, and why it was wrong.** This column used to be a *companion*: it read
 * `activeSurface` — whatever surface a routed screen had last reported — and drew that surface's
 * companion card, or the words "No companion here". So the surfaces themselves lived in the
 * VIEWER, as a list of six rows the Worktree screen pushed, and the iPad spent its centre column
 * on a menu while the panel beside it explained that the menu had no companion. The Mac app has
 * never done that: its surfaces are the right sidebar's tabs and its viewer holds the file, the
 * diff, the commit, the Canvas. This panel is that sidebar.
 *
 * **The strip is the tab bar, and it is not a navigator.** Opening a surface adds it to the
 * strip; closing takes it out; an empty strip shows the launcher instead. Rail order, never
 * insertion order — the same two tabs must always read the same way round. That is
 * `apps/web`'s `useSurfaceSessionStore.openTabs` / `sidebarTab` pair, kept on the shell store
 * here because this client has no separate preferences store to split them across.
 *
 * **Row taps push into the Hub stack**, which is mounted in the centre viewer, so a diff opened
 * from this panel arrives with the pop gesture and the Android back button — the same push the
 * phone makes from the same list. The columns do not talk through a selection store any more.
 *
 * Deliberately NOT reordered by drag, and with no per-tab "close others / close to the right"
 * menu: both are pointer gestures the web client earns from a mouse. The long-press action sheet
 * carries close-others and close-all, which is the pair a touch strip actually needs.
 */
export function SurfacesPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const openSurfaces = useShellStore((state) => state.openSurfaces)
  const activeSurface = useShellStore((state) => state.activeSurface)
  const openSurface = useShellStore((state) => state.openSurface)
  const closeSurface = useShellStore((state) => state.closeSurface)
  const setOpenSurfaces = useShellStore((state) => state.setOpenSurfaces)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const [menuFor, setMenuFor] = useState<SurfaceId | null>(null)
  const [launcherOpen, setLauncherOpen] = useState(false)

  // A strip that holds a surface which is no longer showing has to show SOMETHING; falling back
  // to the first open tab keeps the panel from going blank on a state the store cannot produce
  // but a future one might.
  const active =
    activeSurface !== null && openSurfaces.includes(activeSurface)
      ? activeSurface
      : (openSurfaces[0] ?? null)
  const available = SURFACES.filter((surface) => !openSurfaces.includes(surface.id))

  return (
    <View
      className="flex-1 overflow-hidden rounded-xl border border-border bg-background"
      testID="porcelain-tablet-inspector"
    >
      <View className="min-h-12 flex-row items-center gap-1 border-b border-border pl-2 pr-1">
        {active === null ? (
          <Text
            className="min-w-0 flex-1 px-1 text-sm font-semibold text-foreground"
            numberOfLines={1}
            testID="porcelain-surfaces-title"
          >
            Surfaces
          </Text>
        ) : (
          <SurfaceStrip
            active={active}
            open={openSurfaces}
            onActivate={setActiveSurface}
            onClose={closeSurface}
            onMenu={setMenuFor}
          />
        )}
        {available.length === 0 ? null : (
          <IconAction
            accessibilityLabel="Open a surface"
            glyph="plus"
            testID="porcelain-surfaces-add"
            tone="foreground"
            onPress={() => {
              setLauncherOpen(true)
            }}
          />
        )}
        <IconAction
          accessibilityLabel="Close the Surfaces panel"
          glyph="close"
          testID="porcelain-tablet-inspector-close"
          tone="foreground"
          onPress={onClose}
        />
      </View>

      <ColumnChrome>
        {active === null ? (
          <SurfaceLauncher onOpen={openSurface} />
        ) : (
          <SurfaceBodies active={active} open={openSurfaces} />
        )}
      </ColumnChrome>

      <ActionSheet
        actions={[
          {
            glyph: 'close',
            id: 'close',
            label: 'Close',
            onPress: () => {
              if (menuFor !== null) closeSurface(menuFor)
            },
          },
          {
            glyph: 'layers',
            id: 'close-others',
            label: 'Close others',
            onPress: () => {
              if (menuFor !== null) setOpenSurfaces([menuFor], menuFor)
            },
          },
          {
            destructive: true,
            glyph: 'eraser',
            id: 'close-all',
            label: 'Close all',
            onPress: () => {
              setOpenSurfaces([])
            },
          },
        ]}
        open={menuFor !== null}
        subtitle={menuFor === null ? undefined : surfaceById(menuFor).hint}
        testID="porcelain-surfaces-tab-menu"
        title={menuFor === null ? '' : surfaceById(menuFor).label}
        onClose={() => {
          setMenuFor(null)
        }}
      />

      <ActionSheet
        actions={available.map(
          (surface): SheetAction => ({
            glyph: surface.glyph,
            id: surface.id,
            label: surface.label,
            onPress: () => {
              openSurface(surface.id)
            },
          }),
        )}
        open={launcherOpen}
        subtitle="Keep a project view beside the viewer."
        testID="porcelain-surfaces-add-sheet"
        title="Open a surface"
        onClose={() => {
          setLauncherOpen(false)
        }}
      />
    </View>
  )
}

/**
 * Every open surface stays MOUNTED; only the active one is visible and only it polls.
 *
 * Unmounting the inactive tabs is what a naive strip does, and it costs the thing a strip is
 * for: flipping back to Changes would re-run its whole read, lose the scroll position, and drop
 * the scope switch. `display: none` is how `TabSlot` keeps the phone's tabs alive too, so the
 * two shells hold state the same way. `active` is false for the hidden ones, which is what
 * stops five surfaces polling one daemon at once.
 */
function SurfaceBodies({
  active,
  open,
}: {
  active: SurfaceId
  open: readonly SurfaceId[]
}): React.JSX.Element {
  return (
    <View className="min-h-0 flex-1">
      {open.map((id) => {
        const Body = surfaceSlots(id).panel
        const showing = id === active
        return (
          <View
            key={id}
            className="absolute inset-0"
            /* nativewind-allow-style: a hidden tab has to stay mounted to keep its reads and
               its scroll offset, and `display` is the one property that removes it from layout
               without removing it from the tree. */
            style={{ display: showing ? 'flex' : 'none' }}
            testID={`porcelain-surface-body-${id}`}
          >
            <Body active={showing} />
          </View>
        )
      })}
    </View>
  )
}

function SurfaceStrip({
  active,
  onActivate,
  onClose,
  onMenu,
  open,
}: {
  active: SurfaceId
  onActivate: (id: SurfaceId) => void
  onClose: (id: SurfaceId) => void
  onMenu: (id: SurfaceId) => void
  open: readonly SurfaceId[]
}): React.JSX.Element {
  return (
    <ScrollView
      className="min-w-0 flex-1"
      contentContainerClassName="flex-row items-center gap-1"
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="porcelain-surfaces-strip"
    >
      {open.map((id) => {
        const surface = surfaceById(id)
        const selected = id === active
        return (
          <Pressable
            key={id}
            accessibilityLabel={surface.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={cn(
              'h-8 shrink-0 flex-row items-center gap-1.5 rounded-lg pl-2 pr-1',
              selected ? 'bg-accent' : 'active:bg-accent/40',
            )}
            testID={`porcelain-surfaces-tab-${id}`}
            onLongPress={() => {
              onMenu(id)
            }}
            onPress={() => {
              onActivate(id)
            }}
          >
            <ChromeGlyph name={surface.glyph} size={13} tone={selected ? 'foreground' : 'muted'} />
            <Text
              className={cn(
                'text-xs font-medium',
                selected ? 'text-accent-foreground' : 'text-muted-foreground',
              )}
              numberOfLines={1}
            >
              {surface.label}
            </Text>
            {/* The close mark is inside the tab, not a second row of controls: a strip that
                needs a mouse-over to reveal its close button has nothing to reveal on a touch
                screen, so it is simply always there. */}
            <Pressable
              accessibilityLabel={`Close ${surface.label}`}
              accessibilityRole="button"
              className="size-6 items-center justify-center rounded-md active:bg-accent"
              hitSlop={4}
              testID={`porcelain-surfaces-close-${id}`}
              onPress={() => {
                onClose(id)
              }}
            >
              <ChromeGlyph name="close" size={11} tone="muted" />
            </Pressable>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/**
 * What an empty panel shows: the six surfaces as cards, the web client's `SurfaceLauncher`.
 *
 * Two columns of tap targets rather than a list, because the point of an empty panel is to be
 * refilled in one gesture and a 24pt row is a worse target than a 96pt card.
 */
function SurfaceLauncher({ onOpen }: { onOpen: (id: SurfaceId) => void }): React.JSX.Element {
  return (
    <SurfaceScroll gap={12} paddingTop={16} testID="porcelain-surfaces-launcher">
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-foreground">Open a surface</Text>
        <Text className="text-xs text-muted-foreground">
          Keep useful project views beside the viewer.
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {SURFACES.map((surface) => (
          <Pressable
            key={surface.id}
            accessibilityLabel={surface.label}
            accessibilityRole="button"
            /* panel-card-allow: a launcher tile is a tap target wearing the card's shell, not a
               content card — `PANEL_CARD`'s 2xl radius on a 96pt tile reads as a pill. */
            className="min-h-24 grow basis-[45%] gap-2 rounded-xl border border-border bg-card p-3 active:bg-accent/50"
            testID={`porcelain-surfaces-launch-${surface.id}`}
            onPress={() => {
              onOpen(surface.id)
            }}
          >
            <ChromeGlyph name={surface.glyph} size={16} tone="muted" />
            <Text className="text-xs font-medium text-foreground">{surface.label}</Text>
            <Text className="text-3xs leading-4 text-muted-foreground">{surface.hint}</Text>
          </Pressable>
        ))}
      </View>
    </SurfaceScroll>
  )
}
