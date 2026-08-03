import { EvidenceChecksRow, EvidenceHeaderRow } from '@renderer/components/git/reading-surface'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { useEvidenceHtml } from '@renderer/hooks/use-evidence'
import { evidenceHtmlEmptyMessage } from '@renderer/lib/evidence-message'
import { useRepoStore } from '@renderer/stores/repo'
import type { EvidenceCheck } from '@shared/evidence-check'
import { TestIds } from '@shared/test-ids'

/**
 * Full-height Evidence canvas pane: header (title + pass/fail + Clear),
 * structured checks, then sandboxed HTML body. HTML only — Excalidraw is an
 * Intent medium, not evidence.
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
  const empty = evidenceHtmlEmptyMessage(evidence)

  return (
    <div data-testid={TestIds.evidencePanel} className="flex h-full min-h-0 flex-col">
      <EvidenceHeaderRow title={title} checks={checks} />
      <p className="sticky left-0 max-w-[var(--vrows-vw)] px-3 pb-1 font-sans text-2xs text-muted-foreground">
        Updated {formatUpdatedAt(updatedAt)}
      </p>
      {checks.length > 0 && <EvidenceChecksRow checks={checks} />}
      <div className="min-h-0 flex-1 px-3 pb-3 pt-1">
        {empty ? (
          <p className="p-4 text-sm text-muted-foreground">{empty}</p>
        ) : evidence?.html ? (
          <div className="h-full min-h-0 overflow-hidden rounded-md border">
            <HtmlView html={evidence.html} title={evidence.title} />
          </div>
        ) : null}
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
