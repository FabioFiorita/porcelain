import { cn } from '@renderer/lib/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'

export const ROW_HEIGHT = 20

interface VirtualRowsProps<T> {
  rows: readonly T[]
  renderRow: (row: T, index: number) => React.ReactNode
  className?: string
  /** 1-based line to scroll into view (centered by default) when it changes. */
  scrollToLine?: number
  /**
   * Bump to re-run the scroll even when `scrollToLine` is unchanged — a repeated
   * jump to the already-targeted row (the Review outline) must still scroll back.
   */
  scrollNonce?: number
  /** Where the scrolled-to row lands. Default `center` (a code line); the Review's
   *  chapter jumps use `start` so the section header tops the viewport. */
  scrollAlign?: 'start' | 'center'
  /**
   * Called with the index of the topmost visible row while the user scrolls (and
   * once on mount). Fires only when that index CHANGES — no per-scroll-event storm.
   * The Review surface derives its active section/file from it.
   */
  onTopRow?: (index: number) => void
  /**
   * Size rows to the viewport width (`w-full`) instead of growing to content
   * (`w-max`). Use whenever a row must not extend past the viewport: rows that
   * soft-wrap (the diff views — `w-max` is max-CONTENT width, which ignores wrap
   * opportunities, so wrapping without this changes nothing), and fixed
   * multi-column layouts where each column owns a share of the width. Default
   * `false` keeps the horizontal-scroll behavior (source view).
   */
  fitWidth?: boolean
  /**
   * Measure each row's real height instead of locking to `ROW_HEIGHT`, which stays
   * the estimate. Required by any row that can be taller than one line, and the diff
   * surfaces are that: a soft-wrapped line has no fixed height. `source-view.tsx`
   * deliberately stays fixed-height — its lines never wrap, so the total size is
   * exact from the first paint.
   *
   * The measured cost of measuring, accepted by the owner: on a wrap-heavy diff the
   * total scroll height settles upward during the first read as rows are measured
   * (4000 rows: 81k px → 103k px). No jank; a diff whose lines all fit never drifts.
   *
   * When on, the scroll viewport width publishes as `--vrows-vw` so a row wrapping to
   * the VIEWPORT (not the scrolling `w-max` content) can size with
   * `max-w-[var(--vrows-vw)]`.
   */
  dynamicHeight?: boolean
}

/** Virtualized row list for code/diff content. Only visible rows mount; rows are
 *  `ROW_HEIGHT` tall unless `dynamicHeight` measures them. */
export function VirtualRows<T>({
  rows,
  renderRow,
  className,
  scrollToLine,
  scrollNonce,
  scrollAlign = 'center',
  onTopRow,
  fitWidth = false,
  dynamicHeight = false,
}: VirtualRowsProps<T>): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  })

  const virtualizerRef = useRef(virtualizer)
  useEffect(() => {
    virtualizerRef.current = virtualizer
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollNonce deliberately re-fires a jump to the unchanged target line
  useEffect(() => {
    if (scrollToLine !== undefined && scrollToLine >= 1) {
      virtualizerRef.current.scrollToIndex(scrollToLine - 1, { align: scrollAlign })
    }
  }, [scrollToLine, scrollNonce, scrollAlign])

  // Publish the topmost visible row on scroll. The listener stays passive and only
  // calls out when the index changes; the caller keeps `onTopRow` memoized, so this
  // effect re-subscribes only when the row set itself changes.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onTopRow) return
    let last = -1
    const publish = (): void => {
      const item = virtualizerRef.current.getVirtualItems().find((i) => i.end > el.scrollTop)
      if (item && item.index !== last) {
        last = item.index
        onTopRow(item.index)
      }
    }
    publish()
    el.addEventListener('scroll', publish, { passive: true })
    return () => el.removeEventListener('scroll', publish)
  }, [onTopRow])

  // Publish the scroll viewport width as a CSS var (written straight to the DOM during
  // resize, like the app's resize handles — no per-frame React render). Lets a wrapping
  // row size to the viewport, not the `w-max` content width. Only when measuring rows.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !dynamicHeight) return
    const publish = (): void => el.style.setProperty('--vrows-vw', `${el.clientWidth}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [dynamicHeight])

  return (
    <div ref={scrollRef} className={cn('h-full overflow-auto font-mono text-xs', className)}>
      <div
        className={cn('relative', fitWidth ? 'w-full' : 'w-max min-w-full')}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          if (row === undefined) return null
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={dynamicHeight ? virtualizer.measureElement : undefined}
              className={cn('absolute left-0', fitWidth ? 'w-full' : 'w-max min-w-full')}
              style={dynamicHeight ? { top: item.start } : { top: item.start, height: item.size }}
            >
              {renderRow(row, item.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
