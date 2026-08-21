import {
  FlatList,
  type FlatListProps,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from 'react-native'

import { type SurfaceContentOptions, surfaceContentStyle } from '@/components/surface-layout'
import { useBottomChrome } from '@/features/shell/bottom-chrome'
import { cn } from '@/lib/utils'

/**
 * The two scroll containers every mobile surface uses, and the only place content padding is
 * decided.
 *
 * Three separate bugs were all the same bug, and this is the shape that ends them:
 *
 *   1. **The tab bar was reserved by hand at every call site.** A `bottomInset` number was
 *      threaded through as many as five layers of props to reach the list that needed it —
 *      route → phone screen → browser → viewer → pane — so every new surface had to know to ask
 *      for it, every intermediate layer had to remember to forward it, and a layer that forgot
 *      failed silently with rows stranded under the bar. It had reached the point of being
 *      interpolated into an HTML string served to a WebView. These read the shell directly, so
 *      no caller passes a number and no layer can drop one.
 *
 *   2. **The same number was wrong on iPad.** See `features/shell/bottom-chrome` — the inset is
 *      a property of the shell, and asking the shell is what makes one component correct in a
 *      phone tab and an iPad column at once.
 *
 *   3. **`contentContainerClassName` and `contentContainerStyle` silently annihilate.**
 *      `react-native-css` maps the class prop onto the style prop and the merge only preserves
 *      both for `style` itself, so a list passing both lost its ENTIRE class-derived padding
 *      with no warning and source that still read correctly. Here there is one prop, built
 *      once, so the pair cannot occur.
 *
 * `contentInsetAdjustmentBehavior="never"` is deliberate: iOS applies its own automatic inset
 * to a scroll view it recognises as a screen's primary one, and an automatic inset stacked on
 * the reserved one is the double padding this was supposed to remove. One mechanism, ours.
 *
 * `largeTitle` is the one screen class that has to hand the mechanism back. An iOS large title
 * collapses by watching the offset of the scroll view UIKit has adjusted, so under
 * `headerLargeTitle` the bar simply never collapses and the first rows sit behind it. Those
 * screens switch to `automatic` AND stop reserving the bottom inset themselves, because
 * `automatic` already applies the safe area — which, inside a `UITabBarController` child,
 * already contains the tab bar (see `bottom-chrome`). Adding ours on top is the same double
 * padding from the other end. Android has neither a large title nor this property, so it keeps
 * reserving the bar by hand.
 *
 * A surface that genuinely cannot use these — a native host with its own scroll view, a
 * horizontally scrolling strip — is not a bottom-edge surface and does not need them.
 */

type SurfacePadding = Pick<SurfaceContentOptions, 'edgeToEdge' | 'gap' | 'paddingTop'> & {
  /** This is the primary scroll view of a screen whose native header has `headerLargeTitle`. */
  largeTitle?: boolean
}

/**
 * Who owns the safe-area insets on this scroll view: UIKit under a large title, us everywhere
 * else. Returns the bottom inset to reserve by hand and the property to hand UIKit.
 */
function insetOwnership(
  largeTitle: boolean,
  bottomInset: number,
): { adjust: 'automatic' | 'never'; reserve: number } {
  if (largeTitle && Platform.OS === 'ios') return { adjust: 'automatic', reserve: 0 }
  return { adjust: 'never', reserve: bottomInset }
}

/** The vertical scroll container for a surface: a stack of rows, cards, or prose. */
export function SurfaceScroll({
  children,
  className,
  edgeToEdge,
  gap,
  largeTitle = false,
  paddingTop,
  ...rest
}: SurfacePadding &
  Omit<ScrollViewProps, 'contentContainerStyle' | 'contentContainerClassName'> & {
    children: React.ReactNode
  }): React.JSX.Element {
  const { adjust, reserve } = insetOwnership(largeTitle, useBottomChrome())
  return (
    <ScrollView
      className={cn('flex-1', className)}
      contentContainerStyle={surfaceContentStyle({
        bottomInset: reserve,
        edgeToEdge,
        gap,
        paddingTop,
      })}
      contentInsetAdjustmentBehavior={adjust}
      {...rest}
    >
      {children}
    </ScrollView>
  )
}

/**
 * The virtualised equivalent, for a row set whose length is the agent's to choose.
 *
 * Generic in the item so `renderItem` keeps its type; `ref` is an ordinary prop under React 19,
 * which is what lets the callers that scroll to a row keep doing so.
 */
export function SurfaceList<ItemT>({
  className,
  edgeToEdge,
  gap,
  largeTitle = false,
  paddingTop,
  ...rest
}: SurfacePadding &
  Omit<FlatListProps<ItemT>, 'contentContainerStyle' | 'contentContainerClassName'> & {
    /** React 19 forwards this into props like any other; the runtime spread below needs only
     * the type to say so — see the note above. */
    ref?: React.Ref<FlatList<ItemT>>
  }): React.JSX.Element {
  const { adjust, reserve } = insetOwnership(largeTitle, useBottomChrome())
  return (
    <FlatList<ItemT>
      className={cn('flex-1', className)}
      contentContainerStyle={surfaceContentStyle({
        bottomInset: reserve,
        edgeToEdge,
        gap,
        paddingTop,
      })}
      contentInsetAdjustmentBehavior={adjust}
      {...rest}
    />
  )
}
