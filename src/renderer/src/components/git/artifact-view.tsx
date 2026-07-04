import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useArtifactHtml, useClearArtifact } from '@renderer/hooks/use-artifact'
import { Eraser } from 'lucide-react'

/**
 * Renders an agent-authored feature artifact: a self-contained HTML document that
 * explains the feature. The HTML is ACTIVE content from an external process, so it is
 * shown ONLY inside a FULLY SANDBOXED iframe — `sandbox=""` (no allow-scripts, no
 * allow-same-origin, no allow-popups) so scripts never run and it can't reach the
 * parent, and `srcdoc` so it's a self-contained document. Sandbox does NOT block a
 * remote `<img>`/stylesheet/font — only the parent CSP (`default-src 'self'; img-src
 * 'self' data:`) does, inherited by `srcdoc`. That CSP is the real guard against an
 * HTML-only exfil channel, so never widen `img-src`/`default-src` while artifacts render.
 */
export function ArtifactView({ repoPath }: { repoPath: string }): React.JSX.Element {
  const { artifact } = useArtifactHtml(repoPath)
  const { clear, isClearing } = useClearArtifact()

  if (artifact === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }
  if (artifact === null) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No feature artifact. Your agent can author one over MCP (set_feature_artifact).
      </p>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1">
        <span className="truncate font-mono text-xs text-muted-foreground">{artifact.title}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground"
                onClick={clear}
                disabled={isClearing}
                aria-label="Clear artifact"
              >
                <Eraser />
              </Button>
            }
          />
          <TooltipContent>Clear artifact</TooltipContent>
        </Tooltip>
      </div>
      {/* sandbox="" is fully inert: no scripts, no same-origin, no network. srcdoc keeps
          the document self-contained. Do NOT add allow-* tokens here. */}
      <iframe
        title={artifact.title}
        srcDoc={artifact.html}
        sandbox=""
        className="min-h-0 w-full flex-1 border-0 bg-background"
      />
    </div>
  )
}
