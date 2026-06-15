import { Button } from '@renderer/components/ui/button'
import { useExplore } from '@renderer/hooks/use-explore'
import { Compass, RefreshCw } from 'lucide-react'
import { ReadingSurfaceBody } from './reading-surface'

// The viewer's `explore` tab: a read-only feature flow seeded from a symbol (or a
// whole file), rendered through the same sliced reading surface as the MCP read.
// Nothing is changed — every file is `context`, flow-ordered entry-point → data.
export function ExploreView({
  path,
  symbol,
}: {
  path: string
  symbol?: string
}): React.JSX.Element {
  const { reading, refresh } = useExplore(path, symbol)

  if (reading === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Tracing the flow…</p>
  }

  const total = reading.groups.reduce((n, g) => n + g.files.length, 0)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{reading.name}</span>
          <span className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
            <Compass className="size-3" />
            explore · {total} {total === 1 ? 'file' : 'files'}
          </span>
        </span>
        <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Re-trace feature flow">
          <RefreshCw />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {total === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No connected files traced from this {symbol ? 'symbol' : 'file'}. The walk follows
            relative imports only — a cross-seam reference (a route string, an aliased import) won't
            trace here.
          </p>
        ) : (
          <ReadingSurfaceBody reading={reading} />
        )}
      </div>
    </div>
  )
}
