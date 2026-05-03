import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export const ROW_HEIGHT = 20

interface VirtualRowsProps<T> {
  rows: readonly T[]
  renderRow: (row: T, index: number) => React.ReactNode
  className?: string
}

/** Virtualized fixed-height row list for code/diff content. Only visible rows mount. */
export function VirtualRows<T>({
  rows,
  renderRow,
  className,
}: VirtualRowsProps<T>): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  })

  return (
    <div ref={scrollRef} className={`h-full overflow-auto font-mono text-xs ${className ?? ''}`}>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          if (row === undefined) return null
          return (
            <div
              key={item.key}
              className="absolute inset-x-0"
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
