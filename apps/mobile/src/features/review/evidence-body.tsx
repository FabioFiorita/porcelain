import { Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName, type IconTone } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { SurfaceScroll } from '@/components/surface-scroll'
import type { EvidenceCheck, EvidenceMeta } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

import { IntentDocBody } from './doc-body'
import { EvidenceGallery } from './evidence-gallery'
import { type DocTab, DocTabs } from './review-chrome'
import { useReviewStore } from './review-store'
import { useReviewEvidenceAssets, useReviewEvidenceDocs } from './use-review'

const CHECK_FACE: Record<EvidenceCheck['status'], { glyph: ChromeIconName; tone: IconTone }> = {
  fail: { glyph: 'circleX', tone: 'destructive' },
  pass: { glyph: 'circleCheck', tone: 'success' },
  skip: { glyph: 'minus', tone: 'muted' },
}

/**
 * Evidence: what the agent actually ran, and the proof of it.
 *
 * One directory read as a flat set of panes: **Checks**, the agent's structured claim; then
 * each document it wrote to back that claim (`evidence/results/`, with a legacy `index.html`
 * folded in as "Report"); then **Assets**, the screenshots. A pane with nothing behind it stays
 * visible and dimmed, so the shape of a pack is legible before you tap — and the first pane
 * that has anything is the one that opens, so a pack without checks lands on a document rather
 * than a dead pane.
 *
 * The documents are panes in their own right rather than a "Results" pane you then choose
 * inside. That grouping cost a whole extra level of tabs: the canvas' own Intent · Execution ·
 * Evidence switch, a second full-width segmented control under it that looked exactly like the
 * first, and a THIRD strip inside Results as soon as a pack published two documents. Intent
 * already treats its documents, its board and its narrative as one flat set (`intentPanes`);
 * Evidence says the same thing the same way, and the level nobody wanted disappears.
 *
 * The header keeps only what is true of the whole pack: title, when it was written, and the
 * one-line pass/fail.
 *
 * Every read here is gated on this canvas being up: a pack runs to megabytes, and only the
 * mounted pane's body fetches at all.
 */
export function EvidenceBody({
  active,
  meta,
}: {
  /** Focus AND tab visibility — the gate on reads that can reach megabytes. */
  active: boolean
  /** From `featureReading`; `null` when the agent has published no evidence. */
  meta: EvidenceMeta | null
}): React.JSX.Element {
  const enabled = active && meta !== null
  const { docs } = useReviewEvidenceDocs(enabled)
  const { assets } = useReviewEvidenceAssets(enabled)
  const picked = useReviewStore((state) => state.evidencePane)
  const setPicked = useReviewStore((state) => state.setEvidencePane)

  if (meta === null) {
    return (
      <EmptyNote
        body="When your agent publishes proof of what it ran, it shows here. Ask it for evidence prepare, then evidence check."
        testID="porcelain-review-evidence-empty"
        title="No evidence yet"
      />
    )
  }

  const panes = evidencePanes(meta, docs, assets)
  // The reader's own pick wins while it still has anything behind it; otherwise open on the
  // first pane that does, so a pack with no checks lands on its documents, not a dead one.
  const current =
    panes.find((pane) => pane.key === picked && pane.disabled !== true) ??
    panes.find((pane) => pane.disabled !== true) ??
    panes[0]

  return (
    <View className="flex-1" testID="porcelain-review-evidence">
      <EvidenceHeader meta={meta} />
      <DocTabs
        tabs={panes}
        testIDPrefix="porcelain-review-evidence-tab"
        value={current?.key ?? 'checks'}
        onChange={setPicked}
      />
      {current === undefined || current.key === 'checks' ? (
        <ChecksPane checks={meta.checks} />
      ) : current.key === 'assets' ? (
        <AssetsPane />
      ) : (
        <ResultsPane file={current.key.slice('doc:'.length)} />
      )}
    </View>
  )
}

/**
 * The pack as one flat strip: the claim, each document behind it, then the screenshots.
 *
 * Ordered claim → argument → exhibits, which is the order the proof is read in. The listings
 * are authoritative once they land; until then `meta`'s own counts keep a pane from flashing
 * dimmed on a pack that has plenty in it. Before the document listing arrives there is nothing
 * to name the documents with, so they are represented by a single placeholder that resolves
 * into real pills — the alternative is a strip that cannot show the pack has documents at all.
 */
function evidencePanes(
  meta: EvidenceMeta,
  docs: readonly { file: string; label: string }[] | undefined,
  assets: readonly unknown[] | undefined,
): DocTab[] {
  const assetCount = assets?.length ?? meta.assets ?? 0
  const listedDocs = (meta.results ?? 0) + (meta.hasReport === true ? 1 : 0)

  const documents: DocTab[] =
    docs === undefined
      ? listedDocs > 0
        ? [{ count: listedDocs, disabled: true, key: 'doc:', label: 'Results' }]
        : []
      : docs.map((doc) => ({ key: `doc:${doc.file}`, label: doc.label }))

  return [
    {
      count: meta.checks.length,
      disabled: meta.checks.length === 0,
      key: 'checks',
      label: 'Checks',
    },
    ...documents,
    { count: assetCount, disabled: assetCount === 0, key: 'assets', label: 'Assets' },
  ]
}

/** Title, when it was written, and the one-line verdict — true of the whole pack. */
function EvidenceHeader({ meta }: { meta: EvidenceMeta }): React.JSX.Element {
  const failed = meta.checks.filter((check) => check.status === 'fail').length
  const passed = meta.checks.filter((check) => check.status === 'pass').length

  return (
    <View className="shrink-0 flex-row items-center gap-2 border-b border-border px-3 py-2">
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-semibold text-foreground" numberOfLines={2}>
          {meta.title}
        </Text>
        <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
          Updated {formatUpdatedAt(meta.updatedAt)}
        </Text>
      </View>
      {meta.checks.length === 0 ? null : (
        <Text
          className={cn(
            'font-mono text-[11px] font-semibold',
            failed > 0 ? 'text-destructive' : 'text-success',
          )}
          testID="porcelain-review-evidence-summary"
        >
          {failed > 0 ? `${failed} failed` : `${passed} passed`}
        </Text>
      )}
    </View>
  )
}

/** Checks: the agent's structured claim, one row per thing it says it ran. */
function ChecksPane({ checks }: { checks: EvidenceCheck[] }): React.JSX.Element {
  if (checks.length === 0) {
    return (
      <EmptyNote
        body="This pack records no checks. Ask the agent for evidence check to write what it ran."
        testID="porcelain-review-evidence-checks-empty"
        title="No checks in this pack"
      />
    )
  }
  return (
    <SurfaceScroll gap={8} paddingTop={8} testID="porcelain-review-evidence-checks">
      {checks.map((check) => (
        <CheckRow key={check.label} check={check} />
      ))}
    </SurfaceScroll>
  )
}

function CheckRow({ check }: { check: EvidenceCheck }): React.JSX.Element {
  const face = CHECK_FACE[check.status]
  return (
    <View
      accessibilityLabel={`${check.label}: ${check.status}${check.detail === undefined ? '' : `, ${check.detail}`}`}
      accessibilityRole="text"
      className="flex-row items-start gap-2"
    >
      <View className="pt-0.5">
        <ChromeGlyph name={face.glyph} size={13} tone={face.tone} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] leading-4 text-foreground">{check.label}</Text>
        {check.detail === undefined ? null : (
          <Text className="font-mono text-[10px] leading-4 text-muted-foreground">
            {check.detail}
          </Text>
        )}
      </View>
    </View>
  )
}

/**
 * One document from `evidence/results/`, over the same two-media renderer Intent uses.
 *
 * It renders exactly the document the strip above named — it no longer owns a strip of its
 * own, because its documents ARE pills in that strip now.
 */
function ResultsPane({ file }: { file: string }): React.JSX.Element {
  const { docs, error, isLoading } = useReviewEvidenceDocs(true)

  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-review-evidence-error" />
      </View>
    )
  }
  if (docs === undefined) {
    return (
      <Text
        className="p-4 text-sm text-muted-foreground"
        testID={isLoading ? 'porcelain-review-evidence-loading' : 'porcelain-review-evidence-idle'}
      >
        {isLoading ? 'Loading evidence…' : 'No daemon connected.'}
      </Text>
    )
  }

  // The strip is built from the same listing, so a miss means the pane was picked from a
  // listing that has since changed — fall back to the first document rather than a blank pane.
  const current = docs.find((doc) => doc.file === file) ?? docs[0]
  if (current === undefined) {
    return (
      <EmptyNote
        body="Documents your agent writes to evidence/results/ show here — markdown or a styled HTML page."
        testID="porcelain-review-evidence-results-empty"
        title="No documents in this pack"
      />
    )
  }

  return (
    <View className="flex-1" testID="porcelain-review-evidence-results">
      <IntentDocBody doc={current} testIDPrefix="porcelain-review-evidence-doc" />
    </View>
  )
}

/** Assets: the screenshots, native. The listing is cheap; the bytes are not, so they wait. */
function AssetsPane(): React.JSX.Element {
  const { assets, error, isLoading } = useReviewEvidenceAssets(true)

  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-review-evidence-assets-error" />
      </View>
    )
  }
  if (assets === undefined) {
    return (
      <Text
        className="p-4 text-sm text-muted-foreground"
        testID={
          isLoading
            ? 'porcelain-review-evidence-assets-loading'
            : 'porcelain-review-evidence-assets-idle'
        }
      >
        {isLoading ? 'Loading the gallery…' : 'No daemon connected.'}
      </Text>
    )
  }
  return <EvidenceGallery assets={assets} />
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
