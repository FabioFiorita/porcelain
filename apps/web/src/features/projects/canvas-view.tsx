import { MarkdownView } from '@renderer/components/viewer/markdown-view'
import { daemonBaseUrl } from '@renderer/lib/daemon'
import { settleBackground } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useEffect, useRef, useState } from 'react'
import { useCanvas, useMintCanvasAccessToken } from './project-data'

/**
 * Message a Canvas's click-interception bootstrap posts for every non-fragment
 * link click (see canvas-operations.ts — appended server-side to every HTML
 * Canvas response). The sandboxed iframe has no `allow-top-navigation` or
 * `allow-popups`, so it cannot navigate itself or open a window; this is the
 * only way a link inside it can reach anywhere at all.
 */
function externalLinkHref(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  if (record.source !== 'porcelain-canvas') return null
  return typeof record.href === 'string' ? record.href : null
}

/**
 * The HTML iframe: `sandbox="allow-scripts"` and NOTHING else — no
 * `allow-same-origin`, so even though this loads from the daemon's own
 * origin (canvas-http.ts), the document itself gets an opaque origin with no
 * access to the app's localStorage, daemon token, or credentialed fetches.
 * `src` (not `srcdoc`) is why the CSP `GET /canvas/<token>` sets on its own
 * response — not the app shell's — governs what the iframe's script can do.
 */
function CanvasHtmlFrame({
  projectId,
  canvasId,
  title,
  worktreePath,
}: {
  projectId: string
  canvasId: string
  title: string
  worktreePath: string | undefined
}): React.JSX.Element {
  const { mint } = useMintCanvasAccessToken()
  const [src, setSrc] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false
    setSrc(null)
    // A failed mint leaves src null — the loading state (never a broken iframe).
    settleBackground(
      mint({ projectId, canvasId, worktreePath }).then((token) => {
        if (!cancelled) setSrc(`${daemonBaseUrl()}/canvas/${token}`)
      }),
      'fallback',
    )
    return () => {
      cancelled = true
    }
  }, [projectId, canvasId, worktreePath, mint])

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      if (event.source !== iframeRef.current?.contentWindow) return
      const href = externalLinkHref(event.data)
      if (href === null) return
      window.open(href, '_blank', 'noopener,noreferrer')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (src === null) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <iframe
      ref={iframeRef}
      data-testid={TestIds.canvasIframe}
      title={title}
      src={src}
      sandbox="allow-scripts"
      className="h-full w-full flex-1 border-0 bg-background"
    />
  )
}

/**
 * Viewer content for a 'canvas' tab. `canvasId` is the tab's `path`.
 * `worktreePath` is the tab's target checkout: a promoted Canvas must open from
 * the tracked source, not the private record it shadows.
 */
export function CanvasView({
  projectId,
  canvasId,
  worktreePath,
}: {
  projectId: string
  canvasId: string
  worktreePath?: string
}): React.JSX.Element {
  const { canvas, isLoading } = useCanvas(projectId, canvasId, worktreePath ?? null)

  if (isLoading || canvas === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>
  }
  if (canvas.record.kind === 'markdown') {
    return <MarkdownView content={canvas.content} />
  }
  return (
    <CanvasHtmlFrame
      projectId={projectId}
      canvasId={canvasId}
      title={canvas.record.title}
      worktreePath={worktreePath}
    />
  )
}
