import type { Evidence } from '@backend/evidence-store'

/** Format a byte count for human-facing over-cap copy (always MB, one decimal). */
export function formatEvidenceMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Empty-state copy for the evidence HTML pane.
 * Returns `null` when `evidence.html` is ready to render in the sandboxed iframe.
 *
 * Over-cap packs return a concrete size message — never "cleared" (title/checks
 * still exist on disk; only the inlined body was dropped for the 4 MB read cap).
 */
export function evidenceHtmlEmptyMessage(evidence: Evidence | null | undefined): string | null {
  if (evidence === undefined) return 'Loading…'
  if (evidence === null) return 'Evidence was cleared.'
  if (evidence.htmlUnavailable?.reason === 'too-large') {
    const { bytes, maxBytes } = evidence.htmlUnavailable
    return `Evidence too large (${formatEvidenceMb(bytes)} > ${formatEvidenceMb(maxBytes)}) — shrink screenshots (e.g. JPEG ~540px) and rewrite index.html.`
  }
  if (evidence.html) return null
  return 'No evidence body.'
}
