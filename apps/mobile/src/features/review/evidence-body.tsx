import { ScrollView, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName, type IconTone } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { SegmentedControl } from '@/components/segmented-control'
import type { EvidenceCheck, EvidenceMeta } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

import { IntentDocBody } from './doc-body'
import { EvidenceGallery } from './evidence-gallery'
import { type DocTab, DocTabs } from './review-chrome'
import { type EvidenceTab, useReviewStore } from './review-store'
import { useReviewEvidenceAssets, useReviewEvidenceDocs } from './use-review'

const CHECK_FACE: Record<EvidenceCheck['status'], { glyph: ChromeIconName; tone: IconTone }> = {
  fail: { glyph: 'circleX', tone: 'destructive' },
  pass: { glyph: 'circleCheck', tone: 'success' },
  skip: { glyph: 'minus', tone: 'muted' },
}

const SUB_TABS: readonly { value: EvidenceTab; label: string }[] = [
  { label: 'Checks', value: 'checks' },
  { label: 'Results', value: 'results' },
  { label: 'Assets', value: 'assets' },
]

/**
 * Evidence: what the agent actually ran, and the proof of it.
 *
 * One directory read three ways, not one document. **Checks** is the agent's structured
 * claim, **Results** the documents it wrote to back the claim (`evidence/results/`, with a
 * legacy `index.html` folded in as "Report"), **Assets** the screenshots. A sub-tab with
 * nothing behind it stays visible and disabled, so the shape of a pack is legible before
 * you tap — and the first sub-tab that has anything is the one that opens, so a pack
 * without checks lands on Results rather than a dead pane.
 *
 * The header keeps only what is true of the whole pack: title, when it was written, and the
 * one-line pass/fail. The checks LIST is a sub-tab like the others — on a phone it is the
 * longest of the three, and pinning it above every tab left the proof itself in a sliver.
 *
 * Every read here is gated on this canvas being up: a pack runs to megabytes, and only the
 * mounted sub-tab's body fetches at all.
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
  const picked = useReviewStore((state) => state.evidenceTab)
  const setPicked = useReviewStore((state) => state.setEvidenceTab)

  if (meta === null) {
    return (
      <EmptyNote
        body="When your agent publishes proof of what it ran, it shows here. Ask it for evidence prepare, then evidence check."
        testID="porcelain-review-evidence-empty"
        title="No evidence yet"
      />
    )
  }

  // The listings are authoritative once they land; until then the meta counts keep the
  // sub-tabs from flashing disabled on a pack that has plenty in it.
  const counts: Record<EvidenceTab, number> = {
    assets: assets?.length ?? meta.assets ?? 0,
    checks: meta.checks.length,
    results: docs?.length ?? (meta.results ?? 0) + (meta.hasReport === true ? 1 : 0),
  }
  const current = picked ?? SUB_TABS.find((tab) => counts[tab.value] > 0)?.value ?? 'checks'

  return (
    <View className="flex-1" testID="porcelain-review-evidence">
      <EvidenceHeader meta={meta} />
      <View className="px-4 py-2">
        <SegmentedControl<EvidenceTab>
          options={SUB_TABS.map((tab) => ({
            disabled: counts[tab.value] === 0,
            label: `${tab.label} ${counts[tab.value]}`,
            testID: `porcelain-review-evidence-subtab-${tab.value}`,
            value: tab.value,
          }))}
          testID="porcelain-review-evidence-subtabs"
          value={current}
          onChange={setPicked}
        />
      </View>
      {current === 'checks' ? (
        <ChecksPane checks={meta.checks} />
      ) : current === 'results' ? (
        <ResultsPane />
      ) : (
        <AssetsPane />
      )}
    </View>
  )
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
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-2 px-4 py-2"
      testID="porcelain-review-evidence-checks"
    >
      {checks.map((check) => (
        <CheckRow key={check.label} check={check} />
      ))}
    </ScrollView>
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
 * Results: `evidence/results/` as the same document strip Intent uses, over the same
 * two-media renderer. One document renders bare — a strip of one pill is chrome, not a
 * choice.
 */
function ResultsPane(): React.JSX.Element {
  const { docs, error, isLoading } = useReviewEvidenceDocs(true)
  const selected = useReviewStore((state) => state.evidenceDoc)
  const setSelected = useReviewStore((state) => state.setEvidenceDoc)

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

  const current = docs.find((doc) => doc.file === selected) ?? docs[0]
  if (current === undefined) {
    return (
      <EmptyNote
        body="Documents your agent writes to evidence/results/ show here — markdown or a styled HTML page."
        testID="porcelain-review-evidence-results-empty"
        title="No documents in this pack"
      />
    )
  }

  const tabs: DocTab[] = docs.map((doc) => ({ key: doc.file, label: doc.label }))

  return (
    <View className="flex-1" testID="porcelain-review-evidence-results">
      {tabs.length === 1 ? null : (
        <DocTabs
          tabs={tabs}
          testIDPrefix="porcelain-review-evidence-tab"
          value={current.file}
          onChange={setSelected}
        />
      )}
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
