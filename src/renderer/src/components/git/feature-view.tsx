import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { kbdLabel } from '@renderer/lib/keyboard'
import { Sparkles } from 'lucide-react'
import { ReadingSurfaceBody } from './reading-surface'

// The viewer's `feature` tab: the inline reading surface. MCP-only — it renders
// only when an agent has pushed a review set; the baseline directs you to the
// Feature sidebar tab (the static list). The slice itself is computed in main.
export function FeatureView(): React.JSX.Element {
  const { reading } = useFeatureReading()

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
          review set over MCP. Until then, the <span className="font-medium">Feature</span> tab (
          {kbdLabel('mod', '5')}) shows the static baseline list. Connect Porcelain's MCP server
          from Settings → “Claude Code plugin”.
        </p>
      </div>
    )
  }

  // No title bar: the tab already names this view and it live-refreshes on MCP
  // writes, so the inline read is a clean, chromeless reading surface.
  return <ReadingSurfaceBody reading={reading} />
}
