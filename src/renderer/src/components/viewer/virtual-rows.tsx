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
}

/** Virtualized fixed-height row list for code/diff content. Only visible rows mount. */
export function VirtualRows<T>({
  rows,
  renderRow,
  className,
  scrollToLine,
  fitWidth = false,
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
              className={cn('absolute left-0', fitWidth ? 'w-full' : 'w-max min-w-full')}
              style={{ top: item.start, height: item.size }}
            >
              {renderRow(row, item.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
