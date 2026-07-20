import { EvidenceChecksRow, EvidenceHeaderRow } from '@renderer/components/git/reading-surface'
import { ExcalidrawHost } from '@renderer/components/viewer/excalidraw-host'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { useEvidenceHtml } from '@renderer/hooks/use-evidence'
import { useRepoStore } from '@renderer/stores/repo'
import type { EvidenceCheck } from '@shared/evidence-check'

/**
 * Full-height Loop evidence canvas pane: header (title + pass/fail + Clear),
 * structured checks, then HTML (sandbox) or Excalidraw body by medium.
 * HTML path unchanged: `sandbox="" srcDoc` — no allow-* tokens.
 */
export function EvidencePanel({
  title,
  updatedAt,
  checks,
}: {
  title: string
  updatedAt: string
  checks: EvidenceCheck[]
}): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const { evidence } = useEvidenceHtml(repo?.path ?? '')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EvidenceHeaderRow title={title} checks={checks} />
      <p className="sticky left-0 max-w-[var(--vrows-vw)] px-3 pb-1 font-sans text-2xs text-muted-foreground">
        Updated {formatUpdatedAt(updatedAt)}
        {evidence?.medium === 'excalidraw' ? ' · Excalidraw' : ''}
      </p>
      {checks.length > 0 && <EvidenceChecksRow checks={checks} />}
      <div className="min-h-0 flex-1 px-3 pb-3 pt-1">
        {evidence === undefined ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : evidence === null ? (
          <p className="p-4 text-sm text-muted-foreground">Loop evidence was cleared.</p>
        ) : evidence.medium === 'excalidraw' && evidence.scene ? (
          <ExcalidrawHost scene={evidence.scene} />
        ) : evidence.html ? (
          <div className="h-full min-h-0 overflow-hidden rounded-md border">
            <HtmlView html={evidence.html} title={evidence.title} />
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No evidence body.</p>
        )}
      </div>
    </div>
  )
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
