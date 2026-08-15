import type {
  EvidenceCheck,
  EvidenceDocDescriptor,
  ReviewEvidence,
} from '@porcelain/contracts/review'
import { Text, View } from 'react-native'
import { ChromeGlyph, type ChromeIconName, type IconTone } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { SurfaceScroll } from '@/components/surface-scroll'
import { describeBytes } from '@/features/files'
import { cn } from '@/lib/utils'

import { IntentDocBody } from './doc-body'
import { EvidenceGallery } from './evidence-gallery'
import { type DocTab, DocTabs } from './review-chrome'
import type { ReviewReadingEvidence } from './review-lifecycle'
import { useReviewStore } from './review-store'
import { useReviewEvidence, useReviewEvidenceDoc } from './use-review'

const CHECK_FACE: Record<EvidenceCheck['status'], { glyph: ChromeIconName; tone: IconTone }> = {
  fail: { glyph: 'circleX', tone: 'destructive' },
  pass: { glyph: 'circleCheck', tone: 'success' },
  skip: { glyph: 'minus', tone: 'muted' },
}

/**
 * Evidence: what the agent actually ran, and the proof of it.
 *
 * One pack read as a flat set of panes: **Checks**, the agent's structured claim; then each
 * document it wrote to back that claim (`evidence/results/`); then **Assets**, the screenshots.
 * A pane with nothing behind it stays visible and dimmed, so the shape of a pack is legible
 * before you tap — and the first pane that has anything is the one that opens, so a pack
 * without checks lands on a document rather than a dead pane.
 *
 * The documents are panes in their own right rather than a "Results" pane you then choose
 * inside. That grouping cost a whole extra level of tabs: the canvas' own Intent · Process · Execution ·
 * Evidence switch, a second full-width segmented control under it that looked exactly like the
 * first, and a THIRD strip inside Results as soon as a pack published two documents. Intent
 * already treats its documents, its board and its narrative as one flat set (`intentPanes`);
 * Evidence says the same thing the same way, and the level nobody wanted disappears.
 *
 * The header keeps only what is true of the whole pack: title, when it was written, and the
 * one-line pass/fail.
 *
 * The listing is one cheap aggregate — checks plus descriptors, no bodies — and it is gated on
 * this canvas being up. A document's text and an image's bytes are fetched one at a time by
 * the pane that shows them, so a pack running to megabytes never lands on a tab nobody opened.
 */
export function EvidenceBody({
  active,
  meta,
}: {
  /** Focus AND tab visibility — the gate on reads that can reach megabytes. */
  active: boolean
  /** From `reviewReading`; `null` when the agent has published no evidence. */
  meta: ReviewReadingEvidence | null
}): React.JSX.Element {
  const enabled = active && meta !== null
  const { evidence } = useReviewEvidence(enabled)
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

  const panes = evidencePanes(meta, evidence)
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
 * Ordered claim → argument → exhibits, which is the order the proof is read in. The counts are
 * the aggregate's own descriptors — the reading carries the chapter's checks and nothing else,
 * so until the pack lands the strip shows exactly what it can prove: the checks it already has.
 */
function evidencePanes(
  meta: ReviewReadingEvidence,
  pack: ReviewEvidence | null | undefined,
): DocTab[] {
  const assetCount = pack?.assets.length ?? 0
  const documents: DocTab[] = (pack?.results ?? []).map((doc) => ({
    key: `doc:${doc.file}`,
    label: doc.label,
  }))

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
function EvidenceHeader({ meta }: { meta: ReviewReadingEvidence }): React.JSX.Element {
  const failed = meta.checks.filter((check) => check.status === 'fail').length
  const passed = meta.checks.filter((check) => check.status === 'pass').length

  return (
    <View className="shrink-0 flex-row items-center gap-2 border-b border-border px-3 py-2">
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-semibold text-foreground" numberOfLines={2}>
          {meta.title}
        </Text>
        <Text className="text-3xs text-muted-foreground" numberOfLines={1}>
          Updated {formatUpdatedAt(meta.updatedAt)}
        </Text>
      </View>
      {meta.checks.length === 0 ? null : (
        <Text
          className={cn(
            'font-mono text-2xs font-semibold',
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
        <Text className="text-2xs leading-4 text-foreground">{check.label}</Text>
        {check.detail === undefined ? null : (
          <Text className="font-mono text-3xs leading-4 text-muted-foreground">{check.detail}</Text>
        )}
      </View>
    </View>
  )
}

/**
 * One document from `evidence/results/`, picked out of the pack's descriptors.
 *
 * The strip names a file; this resolves it to a descriptor and hands the body fetch to
 * {@link ResultsDoc}, so a document past the daemon's cap says so from its listed size
 * instead of asking for bytes that will not come.
 */
function ResultsPane({ file }: { file: string }): React.JSX.Element {
  const { error, evidence, isLoading } = useReviewEvidence(true)

  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-review-evidence-error" />
      </View>
    )
  }
  if (evidence === undefined) {
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
  const results = evidence?.results ?? []
  const current = results.find((doc) => doc.file === file) ?? results[0]
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
      <ResultsDoc descriptor={current} />
    </View>
  )
}

/** One Results document's body, over the same two-media renderer Intent uses. */
function ResultsDoc({ descriptor }: { descriptor: EvidenceDocDescriptor }): React.JSX.Element {
  const unavailable = descriptor.state === 'unavailable'
  const { doc, error, isLoading } = useReviewEvidenceDoc(descriptor.file, !unavailable)

  if (unavailable) {
    return (
      <EmptyNote
        body={`This document is ${describeBytes(descriptor.bytes)} — past the size the daemon will send. Open it in the repo instead.`}
        testID="porcelain-review-evidence-doc-unavailable"
        title="Too large to show"
      />
    )
  }
  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-review-evidence-doc-error" />
      </View>
    )
  }
  if (doc === undefined || doc === null) {
    return (
      <Text
        className="p-4 text-sm text-muted-foreground"
        testID={
          isLoading
            ? 'porcelain-review-evidence-doc-loading'
            : 'porcelain-review-evidence-doc-missing'
        }
      >
        {isLoading ? 'Loading the document…' : 'This document is no longer in the pack.'}
      </Text>
    )
  }

  return <IntentDocBody doc={doc} testIDPrefix="porcelain-review-evidence-doc" />
}

/** Assets: the screenshots, native. The listing is cheap; the bytes are not, so they wait. */
function AssetsPane(): React.JSX.Element {
  const { error, evidence, isLoading } = useReviewEvidence(true)

  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-review-evidence-assets-error" />
      </View>
    )
  }
  if (evidence === undefined) {
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
  return <EvidenceGallery assets={evidence?.assets ?? []} />
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
