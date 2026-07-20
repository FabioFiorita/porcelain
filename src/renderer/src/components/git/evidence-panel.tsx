import { EvidenceChecksRow, EvidenceHeaderRow } from '@renderer/components/git/reading-surface'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { useEvidenceHtml } from '@renderer/hooks/use-evidence'
import { useRepoStore } from '@renderer/stores/repo'
import type { EvidenceCheck } from '@shared/evidence-check'

/**
 * Full-height Loop evidence canvas pane: header (title + pass/fail + Clear),
 * structured checks, then the sandboxed HTML body. Same `sandbox="" srcDoc`
 * path as the old fixed-height chapter row — only placement changes.
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
      </p>
      {checks.length > 0 && <EvidenceChecksRow checks={checks} />}
      <div className="min-h-0 flex-1 px-3 pb-3 pt-1">
        <div className="h-full min-h-0 overflow-hidden rounded-md border">
          {evidence ? (
            <HtmlView html={evidence.html} title={evidence.title} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              {evidence === undefined ? 'Loading…' : 'Loop evidence was cleared.'}
            </p>
          )}
        </div>
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
