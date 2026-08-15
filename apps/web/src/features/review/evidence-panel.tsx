import type { EvidenceDocDescriptor } from '@porcelain/contracts/review'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { compactButtonClass } from '@renderer/lib/controls'
import { evidenceOverCapMessage } from '@renderer/lib/evidence-message'
import type { EvidenceCheck } from '@shared/evidence-check'
import { TestIds } from '@shared/test-ids'
import { useState } from 'react'
import { EvidenceGallery } from './evidence-gallery'
import { EvidenceChecksRow, EvidenceHeaderRow } from './reading-evidence-rows'
import { ReviewDocBody } from './review-doc-body'
import { useEvidenceDoc, useReviewEvidence } from './review-queries'

type SubTab = 'checks' | 'results' | 'assets'

const SUB_TABS: ReadonlyArray<{ id: SubTab; label: string }> = [
  { id: 'checks', label: 'Checks' },
  { id: 'results', label: 'Results' },
  { id: 'assets', label: 'Assets' },
]

/** Why a sub-tab is disabled — the tooltip names the directory the agent writes. */
const SUB_TAB_EMPTY: Record<SubTab, string> = {
  checks: 'No checks in this pack',
  results: 'No documents in evidence/results/',
  assets: 'No media in evidence/assets/',
}

/**
 * Full-height Evidence canvas pane: the header (title · pass/fail · Updated ·
 * Clear) over the pack's three sub-tabs.
 *
 * Evidence is one directory read three ways, not one document: **Checks** is the
 * agent's structured claim, **Results** the documents it wrote to back the claim,
 * **Assets** the screenshots. A sub-tab with nothing in it stays visible and
 * DISABLED with a tooltip — the same rule the canvas uses for Evidence itself, so
 * the shape of a pack is legible before you click.
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
  const pack = useReviewEvidence()
  const docs = pack?.results ?? []
  const assets = pack?.assets ?? []
  const counts: Record<SubTab, number> = {
    checks: checks.length,
    results: docs.length,
    assets: assets.length,
  }
  // Null until the human picks: the default follows the data as the Results and
  // Assets queries land, so a checks-less pack opens on Results, not a dead pane.
  const [picked, setPicked] = useState<SubTab | null>(null)
  const current = picked ?? SUB_TABS.find((tab) => counts[tab.id] > 0)?.id ?? 'checks'

  return (
    <div data-testid={TestIds.evidencePanel} className="flex h-full min-h-0 flex-col">
      <EvidenceHeaderRow title={title} checks={checks} />
      <p className="sticky left-0 max-w-[var(--vrows-vw)] px-3 pb-1 font-sans text-2xs text-muted-foreground">
        Updated {formatUpdatedAt(updatedAt)}
      </p>
      <Tabs
        value={current}
        onValueChange={(value: string): void => {
          const tab = SUB_TABS.find((candidate) => candidate.id === value)
          if (tab && counts[tab.id] > 0) setPicked(tab.id)
        }}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-b px-3">
          <TabsList variant="line" className="h-8 w-full justify-start">
            {SUB_TABS.map((tab) => {
              const count = counts[tab.id]
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger
                    render={
                      <TabsTrigger
                        value={tab.id}
                        disabled={count === 0}
                        data-testid={TestIds.evidenceSubTab(tab.id)}
                        className="flex-none px-3 data-disabled:opacity-40"
                      >
                        {tab.label}
                        <Badge variant="outline" className="text-2xs">
                          {count}
                        </Badge>
                      </TabsTrigger>
                    }
                  />
                  <TooltipContent side="bottom">
                    {count === 0 ? SUB_TAB_EMPTY[tab.id] : `${tab.label} — ${count}`}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TabsList>
        </div>
        <TabsContent value="checks" className="min-h-0 flex-1 outline-none">
          <div
            data-testid={TestIds.evidenceChecksPane}
            className="h-full min-h-0 overflow-y-auto py-1"
          >
            {checks.length > 0 ? (
              <EvidenceChecksRow checks={checks} />
            ) : (
              <EmptyPane message={SUB_TAB_EMPTY.checks} />
            )}
          </div>
        </TabsContent>
        <TabsContent value="results" className="min-h-0 flex-1 outline-none">
          <ResultsPane docs={docs} />
        </TabsContent>
        <TabsContent value="assets" className="min-h-0 flex-1 outline-none">
          {assets.length > 0 ? (
            <EvidenceGallery assets={assets} active={current === 'assets'} />
          ) : (
            <EmptyPane message={SUB_TAB_EMPTY.assets} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Results: the `evidence/results/` document descriptors as the same pill strip Intent
 * uses, over the same two-media renderer. One document renders bare — no strip for a
 * single pill. Bodies are fetched one at a time by descriptor `file`, so a pack of
 * documents costs one body, not all of them.
 */
function ResultsPane({ docs }: { docs: readonly EvidenceDocDescriptor[] }): React.JSX.Element {
  const [picked, setPicked] = useState<string | null>(null)
  const current = docs.find((doc) => doc.file === picked) ?? docs[0]

  if (!current) return <EmptyPane message={SUB_TAB_EMPTY.results} />

  return (
    <div data-testid={TestIds.evidenceResultsPane} className="flex h-full min-h-0 flex-col">
      {docs.length > 1 && (
        <div
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 px-3 py-1.5"
          data-testid={TestIds.evidenceDocTabs}
        >
          {docs.map((doc) => (
            <Button
              key={doc.file}
              size="sm"
              variant={doc.file === current.file ? 'secondary' : 'ghost'}
              className={compactButtonClass}
              data-testid={TestIds.intentDocTab(doc.label)}
              onClick={() => setPicked(doc.file)}
            >
              {doc.label}
            </Button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ResultsBody key={current.file} descriptor={current} />
      </div>
    </div>
  )
}

/** One Results document: the descriptor names it, the body query fetches it. */
function ResultsBody({ descriptor }: { descriptor: EvidenceDocDescriptor }): React.JSX.Element {
  const available = descriptor.state === 'available'
  const { doc, isLoading } = useEvidenceDoc(descriptor.file, available)
  if (descriptor.state === 'unavailable') {
    return <EmptyPane message={evidenceOverCapMessage(descriptor)} />
  }
  if (isLoading) return <EmptyPane message="Loading…" />
  if (!doc) return <EmptyPane message="No document body." />
  return <ReviewDocBody doc={doc} />
}

function EmptyPane({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-sm text-center text-sm text-muted-foreground">{message}</p>
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
