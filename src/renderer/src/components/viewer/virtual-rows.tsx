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
}

/** Virtualized fixed-height row list for code/diff content. Only visible rows mount. */
export function VirtualRows<T>({
  rows,
  renderRow,
  className,
  scrollToLine,
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
      <div className="relative w-max min-w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          if (row === undefined) return null
          return (
            <div
              key={item.key}
              className="absolute left-0 w-max min-w-full"
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
