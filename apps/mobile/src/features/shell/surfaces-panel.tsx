import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote, ICON_ACTION } from '@/components/panel-chrome'
import { AnchoredMenu, type RowMenuAction, RowContextMenu } from '@/components/ui/row-context-menu'
import { SurfaceScroll } from '@/components/surface-scroll'
import { useHubRepoPath } from '@/features/projects'
import { cn } from '@/lib/utils'

import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import { SURFACES, type SurfaceId, surfaceById } from './surfaces'
import { ColumnChrome } from './window-chrome'

/**
 * The tablet's trailing panel: **Surfaces**, the web client's right sidebar.
 *
 * ```
 *  ┌──────────────────────────────┐
 *  │ ⌗ Files ×  ⎇ Changes      +  │  ← the strip: what is open, what is showing
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
 * Deliberately NOT reordered by drag: that is a pointer gesture the web client earns from a
 * mouse. Its "close others / close to the right" family is a long press on a tab here.
 */
export function SurfacesPanel(): React.JSX.Element {
  const openSurfaces = useShellStore((state) => state.openSurfaces)
  const activeSurface = useShellStore((state) => state.activeSurface)
  const openSurface = useShellStore((state) => state.openSurface)
  const closeSurface = useShellStore((state) => state.closeSurface)
  const setOpenSurfaces = useShellStore((state) => state.setOpenSurfaces)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)

  // A strip holding a surface that is no longer showing has to show SOMETHING; falling back to
  // the first open tab keeps the panel from going blank on a state the store cannot produce but
  // a future one might.
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
      {/* `min-h-12`, the height the sidebar's header and the viewer's header both take. Three
          columns whose top bands disagree by a few points is the first thing a reader sees. */}
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
            onReplace={setOpenSurfaces}
          />
        )}
        {available.length === 0 ? null : (
          <AnchoredMenu
            actions={available.map(
              (surface): RowMenuAction => ({
                glyph: surface.glyph,
                id: surface.id,
                label: surface.label,
                onPress: () => {
                  openSurface(surface.id)
                },
              }),
            )}
            testID="porcelain-surfaces-add"
            title="Open a surface"
          >
            {/* A host `Pressable`, not `IconAction`: the menu's trigger clones its child to
                take a ref and compose the press, and a function component absorbs both — the
                first cut of this button drew correctly and opened nothing. */}
            <Pressable
              accessibilityLabel="Open a surface"
              accessibilityRole="button"
              className={ICON_ACTION}
              hitSlop={4}
              testID="porcelain-surfaces-add-button"
            >
              <ChromeGlyph name="plus" size={17} tone="foreground" />
            </Pressable>
          </AnchoredMenu>
        )}
      </View>

      <ColumnChrome>
        {active === null ? (
          <SurfaceLauncher onOpen={openSurface} />
        ) : (
          <SurfaceBodies active={active} open={openSurfaces} />
        )}
      </ColumnChrome>
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
 *
 * **Search is the surface that does not need a Worktree** — it opens its own scope — so it is
 * the one exception to the "select a Worktree first" note, exactly as `SurfaceContent` on web.
 * Without this every surface fell back to its own empty state, and Files' ("everything here is
 * hidden by the project's scope, or the folder is empty") reads as a broken tree rather than as
 * nothing being selected.
 */
function SurfaceBodies({
  active,
  open,
}: {
  active: SurfaceId
  open: readonly SurfaceId[]
}): React.JSX.Element {
  const repoPath = useHubRepoPath()

  if (repoPath === null && active !== 'search') {
    return (
      <EmptyNote
        body="Pick one from the Worktrees list and its surfaces open here."
        testID="porcelain-surfaces-no-worktree"
        title="No Worktree selected"
      />
    )
  }

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
  onReplace,
  open,
}: {
  active: SurfaceId
  onActivate: (id: SurfaceId) => void
  onClose: (id: SurfaceId) => void
  onReplace: (next: readonly SurfaceId[], activate?: SurfaceId) => void
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
        const menu: RowMenuAction[] = [
          {
            glyph: 'close',
            id: 'close',
            label: `Close ${surface.label}`,
            onPress: () => {
              onClose(id)
            },
          },
          {
            disabled: open.length < 2,
            glyph: 'layers',
            id: 'close-others',
            label: 'Close others',
            onPress: () => {
              onReplace([id], id)
            },
          },
          {
            destructive: true,
            glyph: 'eraser',
            id: 'close-all',
            label: 'Close all',
            onPress: () => {
              onReplace([])
            },
          },
        ]

        return (
          <RowContextMenu
            key={id}
            actions={menu}
            testID={`porcelain-surfaces-tab-${id}`}
            title={surface.label}
          >
            <Pressable
              accessibilityLabel={surface.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={cn(
                'h-8 shrink-0 flex-row items-center gap-1.5 rounded-lg pl-2',
                selected ? 'bg-accent pr-1' : 'pr-2 active:bg-accent/40',
              )}
              onPress={() => {
                onActivate(id)
              }}
            >
              <ChromeGlyph
                name={surface.glyph}
                size={13}
                tone={selected ? 'foreground' : 'muted'}
              />
              <Text
                className={cn(
                  'text-xs font-medium',
                  selected ? 'text-accent-foreground' : 'text-muted-foreground',
                )}
                numberOfLines={1}
              >
                {surface.label}
              </Text>
              {/* Only the SHOWING tab carries a close mark. The web strip reveals one on hover,
                  which is a gesture a touch screen does not have — and a mark on every tab cost
                  24pt each, so a third tab was already being clipped in a 320pt panel. Every tab
                  can still be closed from its long-press menu; the one you are looking at gets
                  the one-tap affordance. */}
              {selected ? (
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
              ) : null}
            </Pressable>
          </RowContextMenu>
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
