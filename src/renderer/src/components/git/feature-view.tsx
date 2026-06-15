import { Button } from '@renderer/components/ui/button'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { RefreshCw, Sparkles } from 'lucide-react'
import { ReadingSurfaceBody } from './reading-surface'

// The viewer's `feature` tab: the inline reading surface. MCP-only — it renders
// only when an agent has pushed a review set; the baseline directs you to the
// Feature sidebar tab (the static list). The slice itself is computed in main.
export function FeatureView(): React.JSX.Element {
  const { reading, refresh } = useFeatureReading()

  if (reading === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  if (reading === null) {
    return (
      <div className="mx-auto max-w-md p-8 text-sm text-muted-foreground">
        <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <Sparkles className="size-4 text-info" />
          Inline feature read
        </p>
        <p>
          This view renders the whole feature — just the relevant lines — once your agent pushes a
          review set over MCP. Until then, the <span className="font-medium">Feature</span> tab (⌘4)
          shows the static baseline list. Connect Porcelain's MCP server from Settings → “Claude
          Code plugin”.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{reading.name}</span>
          <span className="flex shrink-0 items-center gap-1 rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-normal text-info">
            <Sparkles className="size-3" />
            from agent
          </span>
        </span>
        <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh feature view">
          <RefreshCw />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ReadingSurfaceBody reading={reading} />
      </div>
    </div>
  )
}
