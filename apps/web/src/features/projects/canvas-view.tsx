import { MarkdownView } from '@renderer/components/viewer/markdown-view'
import { daemonBaseUrl } from '@renderer/lib/daemon'
import { environmentSessionFor } from '@renderer/lib/environment-sessions'
import { settleBackground } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useEffect, useRef, useState } from 'react'
import { useCanvas, useMintCanvasAccessToken } from './project-data'
import { StructuredCanvasView } from './structured-canvas-view'

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
  return typeof record.href === 'string' && /^https?:\/\//i.test(record.href) ? record.href : null
}

/**
 * The HTML iframe: `sandbox="allow-scripts"` and NOTHING else — no
 * `allow-same-origin`, so even though this loads from the daemon's own
 * origin (canvas-http.ts), the document itself gets an opaque origin with no
 * access to the app's localStorage, daemon token, or credentialed fetches.
 * `src` (not `srcdoc`) is why the CSP `GET /canvas/<token>` sets on its own
 * response — not the app shell's — governs what the iframe's script can do.
 */
function useCanvasDocumentUrl({
  projectId,
  canvasId,
  worktreePath,
  environmentId,
}: {
  projectId: string
  canvasId: string
  worktreePath: string | undefined
  environmentId: string | undefined
}): { src: string | null; error: string | null } {
  const { mint } = useMintCanvasAccessToken()
  const environment = environmentSessionFor(environmentId ?? null)
  const environmentBaseUrl = environment?.session.baseUrl() ?? daemonBaseUrl()
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setSrc(null)
    setError(null)
    const input = {
      projectId,
      canvasId,
      ...(worktreePath === undefined ? {} : { worktreePath }),
      ...(environmentId === undefined ? {} : { environmentId }),
    }
    settleBackground(
      (async () => {
        try {
          const token = await mint(input)
          if (!cancelled) setSrc(`${environmentBaseUrl}/canvas/${token}`)
        } catch (cause) {
          if (!cancelled) {
            setError(
              cause instanceof Error && cause.message.length > 0
                ? cause.message
                : 'Could not open this Canvas.',
            )
          }
        }
      })(),
      'fallback',
    )
    return () => {
      cancelled = true
    }
  }, [projectId, canvasId, worktreePath, environmentId, environmentBaseUrl, mint])

  return { src, error }
}

function CanvasHtmlFrame({
  projectId,
  canvasId,
  title,
  worktreePath,
  environmentId,
}: {
  projectId: string
  canvasId: string
  title: string
  worktreePath: string | undefined
  environmentId: string | undefined
}): React.JSX.Element {
  const { src, error } = useCanvasDocumentUrl({
    projectId,
    canvasId,
    worktreePath,
    environmentId,
  })
  const iframeRef = useRef<HTMLIFrameElement>(null)

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

  if (error !== null) {
    return <div className="p-4 text-sm text-destructive">{error}</div>
  }
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

function CanvasStructuredFrame({
  projectId,
  canvasId,
  content,
  worktreePath,
  environmentId,
}: {
  projectId: string
  canvasId: string
  content: string
  worktreePath: string | undefined
  environmentId: string | undefined
}): React.JSX.Element {
  // The same narrow token used by HTML Canvas documents also scopes real Review attachments.
  // A Review remains readable if minting fails; only its bundled evidence becomes unavailable.
  const { src } = useCanvasDocumentUrl({ projectId, canvasId, worktreePath, environmentId })
  return (
    <StructuredCanvasView
      content={content}
      repoPath={worktreePath}
      assetBaseUrl={src === null ? null : `${src}/assets`}
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
  environmentId,
}: {
  projectId: string
  canvasId: string
  worktreePath?: string
  environmentId?: string
}): React.JSX.Element {
  const { canvas, isLoading, loadError } = useCanvas(
    projectId,
    canvasId,
    worktreePath ?? null,
    environmentId ?? null,
  )

  if (loadError !== null) {
    return <div className="p-4 text-sm text-destructive">{loadError}</div>
  }
  if (isLoading || canvas === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>
  }
  if (canvas.record.kind === 'markdown') {
    return <MarkdownView content={canvas.content} />
  }
  if (canvas.record.kind === 'structured') {
    return (
      <CanvasStructuredFrame
        projectId={projectId}
        canvasId={canvasId}
        content={canvas.content}
        worktreePath={worktreePath}
        environmentId={environmentId}
      />
    )
  }
  return (
    <CanvasHtmlFrame
      projectId={projectId}
      canvasId={canvasId}
      title={canvas.record.title}
      worktreePath={worktreePath}
      environmentId={environmentId}
    />
  )
}
