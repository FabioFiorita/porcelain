import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useClearEvidence, useEvidenceHtml } from '@renderer/hooks/use-evidence'
import { Eraser } from 'lucide-react'

/**
 * Renders agent-authored loop evidence: a self-contained HTML document proving the
 * work was validated (browser/simulator checks, screenshots, pass/fail steps). Same
 * sandbox rules as the feature artifact — ACTIVE content from an external process,
 * shown ONLY inside a FULLY SANDBOXED iframe (`sandbox=""`, `srcdoc`, no allow-scripts
 * /allow-same-origin/allow-popups). Sandbox does NOT block a remote `<img>`/stylesheet
 * /font — only the parent CSP (`default-src 'self'; img-src 'self' data:`) does,
 * inherited by `srcdoc`. That CSP is the real guard against an HTML-only exfil channel,
 * so never widen `img-src`/`default-src` while evidence (or artifacts) render.
 *
 * Clear is the point of this surface's short lifetime: once the human has reviewed the
 * proof (e.g. before commit/push), they erase it. The agent can always re-push.
 */
export function EvidenceView({ repoPath }: { repoPath: string }): React.JSX.Element {
  const { evidence } = useEvidenceHtml(repoPath)
  const { clear, isClearing } = useClearEvidence()

  if (evidence === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }
  if (evidence === null) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No loop evidence. Your agent writes index.html under ~/.porcelain/loop-evidence/ after
        validating the work (browser, simulator, …) — Feature tab shows it automatically.
      </p>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1">
        <span className="truncate font-mono text-xs text-muted-foreground">{evidence.title}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground"
                onClick={clear}
                disabled={isClearing}
                aria-label="Clear loop evidence"
              >
                <Eraser />
              </Button>
            }
          />
          <TooltipContent>Clear loop evidence</TooltipContent>
        </Tooltip>
      </div>
      {/* sandbox="" is fully inert: no scripts, no same-origin, no network. srcdoc keeps
          the document self-contained. Do NOT add allow-* tokens here. */}
      <iframe
        title={evidence.title}
        srcDoc={evidence.html}
        sandbox=""
        className="min-h-0 w-full flex-1 border-0 bg-background"
      />
    </div>
  )
}
