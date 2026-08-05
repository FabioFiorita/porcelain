import { IntentDocBody } from '@renderer/components/git/intent-doc-body'
import { EvidenceChecksRow, EvidenceHeaderRow } from '@renderer/components/git/reading-surface'
import { Button } from '@renderer/components/ui/button'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { useEvidenceHtml } from '@renderer/hooks/use-evidence'
import { useReviewEvidenceDocs } from '@renderer/hooks/use-review-intent'
import { compactButtonClass } from '@renderer/lib/controls'
import { evidenceHtmlEmptyMessage } from '@renderer/lib/evidence-message'
import { useRepoStore } from '@renderer/stores/repo'
import type { EvidenceCheck } from '@shared/evidence-check'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'

/**
 * Full-height Evidence canvas pane: header (title + pass/fail + Clear),
 * structured checks, then the proof itself.
 *
 * Proof is rarely one page — a run log, a query plan, a diagram of what was
 * exercised — so `index.html` is the Report tab and any other document in
 * `evidence/` becomes a tab beside it, same media and caps as Intent. The
 * checks stay pinned above every tab: they are the summary, not one view of it.
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
  const docs = useReviewEvidenceDocs()
  const [active, setActive] = useState<string | null>(null)
  const current = active ?? 'report'

  return (
    <div data-testid={TestIds.evidencePanel} className="flex h-full min-h-0 flex-col">
      <EvidenceHeaderRow title={title} checks={checks} />
      <p className="sticky left-0 max-w-[var(--vrows-vw)] px-3 pb-1 font-sans text-2xs text-muted-foreground">
        Updated {formatUpdatedAt(updatedAt)}
      </p>
      {checks.length > 0 && <EvidenceChecksRow checks={checks} />}
      {docs.length > 0 && (
        <div
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 px-3 py-1.5"
          data-testid={TestIds.evidenceDocTabs}
        >
          {[{ file: 'report', label: 'Report' }, ...docs].map((tab) => (
            <Button
              key={tab.file}
              size="sm"
              variant={tab.file === current ? 'secondary' : 'ghost'}
              className={compactButtonClass}
              data-testid={TestIds.intentDocTab(tab.label)}
              onClick={() => setActive(tab.file === 'report' ? null : tab.file)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 px-3 pb-3 pt-1">
        {current !== 'report' ? (
          (() => {
            const doc = docs.find((d) => d.file === current)
            return doc ? <IntentDocBody doc={doc} /> : null
          })()
        ) : empty ? (
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
