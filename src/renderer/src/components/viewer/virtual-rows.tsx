import { cn } from '@renderer/lib/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'

export const ROW_HEIGHT = 20

interface VirtualRowsProps<T> {
  rows: readonly T[]
  renderRow: (row: T, index: number) => React.ReactNode
  className?: string
  /** 1-based line to scroll into view (centered) when it changes. */
  scrollToLine?: number
  /**
   * Size rows to the viewport width (`w-full`) instead of growing to content
   * (`w-max`). Use for fixed multi-column layouts (split diff) where each column
   * owns a share of the width and clips its own overflow — growing to content
   * would let one column's long line overrun the other. Default `false` keeps the
   * single-column horizontal-scroll behavior (unified diff, source view).
   */
  fitWidth?: boolean
  /**
   * Measure each row's real height instead of locking every row to `ROW_HEIGHT`.
   * Default `false` — the big file/diff viewers stay fixed-height (the perf
   * invariant). Opt in ONLY for small, sliced surfaces that need a tall row (the
   * reading surface's wrapping note). When on, the scroll viewport's width is
   * published as the `--vrows-vw` CSS var on the scroll element, so a row that must
   * wrap to the VIEWPORT (not the horizontally-scrolling `w-max` content) can size
   * itself with `max-w-[var(--vrows-vw)]`.
   */
  dynamicHeight?: boolean
}

/** Virtualized fixed-height row list for code/diff content. Only visible rows mount. */
export function VirtualRows<T>({
  rows,
  renderRow,
  className,
  scrollToLine,
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
  virtualizerRef.current = virtualizer

  useEffect(() => {
    if (scrollToLine !== undefined && scrollToLine >= 1) {
      virtualizerRef.current.scrollToIndex(scrollToLine - 1, { align: 'center' })
    }
  }, [scrollToLine])

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
