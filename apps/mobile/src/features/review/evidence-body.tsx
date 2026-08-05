import { ScrollView, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName, type IconTone } from '@/components/chrome-glyph'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { previewDocument } from '@/features/files/preview-document'
import { PreviewView } from '@/features/files/preview-view'
import type { Evidence, EvidenceCheck, EvidenceMeta } from '@/lib/daemon/procedures/review'
import { cn } from '@/lib/utils'

import { IntentDocBody } from './doc-body'
import { type DocTab, DocTabs } from './review-chrome'
import { useReviewStore } from './review-store'
import { useEvidenceHtml, useReviewEvidenceDocs } from './use-review'

/** The report is not a file on disk from the tab strip's point of view — it is `index.html`. */
const REPORT_KEY = 'report'

const CHECK_FACE: Record<EvidenceCheck['status'], { glyph: ChromeIconName; tone: IconTone }> = {
  fail: { glyph: 'circleX', tone: 'destructive' },
  pass: { glyph: 'circleCheck', tone: 'success' },
  skip: { glyph: 'minus', tone: 'muted' },
}

/**
 * Evidence: what the agent actually ran, and the proof of it.
 *
 * The structured checks stay above every tab because they are the summary, not one view of
 * it — a pass/fail line you can read in a second is the point of the surface on a phone. The
 * report itself (`evidence/index.html`) is the first tab; any other document beside it is a
 * tab of its own, same media and caps as Intent.
 *
 * The HTML is only read while this canvas is up: an evidence pack runs to megabytes of
 * inlined screenshots, and fetching it beside the reading would make opening the Review
 * expensive for a tab nobody asked for.
 */
export function EvidenceBody({
  active,
  meta,
}: {
  /** Focus AND tab visibility — the gate on a read that can reach 4 MiB. */
  active: boolean
  /** From `featureReading`; `null` when the agent has published no evidence. */
  meta: EvidenceMeta | null
}): React.JSX.Element {
  const { docs } = useReviewEvidenceDocs(active && meta !== null)
  const { error, evidence, isLoading } = useEvidenceHtml(active && meta !== null)
  const selected = useReviewStore((state) => state.evidenceDoc)
  const setSelected = useReviewStore((state) => state.setEvidenceDoc)

  if (meta === null) {
    return (
      <EmptyNote
        body="When your agent publishes HTML proof of what it ran, it shows here. Ask it for evidence prepare, then evidence check."
        testID="porcelain-review-evidence-empty"
        title="No evidence yet"
      />
    )
  }

  const extras = docs ?? []
  const tabs: DocTab[] = [
    { key: REPORT_KEY, label: 'Report' },
    ...extras.map((doc) => ({ key: doc.file, label: doc.label })),
  ]
  const current = selected === null ? REPORT_KEY : selected
  const doc = extras.find((entry) => entry.file === current)

  return (
    <View className="flex-1" testID="porcelain-review-evidence">
      <EvidenceHeader meta={meta} />
      {tabs.length === 1 ? null : (
        <DocTabs
          tabs={tabs}
          testIDPrefix="porcelain-review-evidence-tab"
          value={current}
          onChange={(key) => {
            setSelected(key === REPORT_KEY ? null : key)
          }}
        />
      )}
      {doc !== undefined ? (
        <IntentDocBody doc={doc} testIDPrefix="porcelain-review-evidence-doc" />
      ) : (
        <EvidenceReport error={error} evidence={evidence} isLoading={isLoading} />
      )}
    </View>
  )
}

/** Title, when it was written, and the checks — the part that stays above every tab. */
function EvidenceHeader({ meta }: { meta: EvidenceMeta }): React.JSX.Element {
  const failed = meta.checks.filter((check) => check.status === 'fail').length
  const passed = meta.checks.filter((check) => check.status === 'pass').length

  return (
    <View className="shrink-0 gap-2 border-b border-border px-3 py-2">
      <View className="flex-row items-center gap-2">
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

      {meta.checks.length === 0 ? null : (
        <ScrollView
          className="max-h-28"
          contentContainerClassName="gap-1"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          testID="porcelain-review-evidence-checks"
        >
          {meta.checks.map((check) => (
            <CheckRow key={check.label} check={check} />
          ))}
        </ScrollView>
      )}
    </View>
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
        <Text className="text-[11px] leading-4 text-foreground" numberOfLines={2}>
          {check.label}
        </Text>
        {check.detail === undefined ? null : (
          <Text className="font-mono text-[10px] leading-4 text-muted-foreground" numberOfLines={2}>
            {check.detail}
          </Text>
        )}
      </View>
    </View>
  )
}

/**
 * The proof itself.
 *
 * The over-cap case gets real copy rather than a blank pane: the title and the checks are
 * still on disk and still true, and only the inlined body was dropped for the read cap — so
 * the message names both sizes and what to do about it, exactly as the desktop does.
 */
function EvidenceReport({
  error,
  evidence,
  isLoading,
}: {
  error: Error | null
  evidence: Evidence | null | undefined
  isLoading: boolean
}): React.JSX.Element {
  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-review-evidence-error" />
      </View>
    )
  }
  if (evidence === undefined) {
    return isLoading ? (
      <Text
        className="p-4 text-sm text-muted-foreground"
        testID="porcelain-review-evidence-loading"
      >
        Loading evidence…
      </Text>
    ) : (
      <EmptyNote
        body="The daemon returned nothing for this evidence pack."
        testID="porcelain-review-evidence-unavailable"
        title="Nothing to show"
      />
    )
  }
  if (evidence === null) {
    return (
      <EmptyNote
        body="The evidence pack was cleared since this Review was read."
        testID="porcelain-review-evidence-cleared"
        title="Evidence was cleared"
      />
    )
  }
  if (evidence.htmlUnavailable !== undefined) {
    const { bytes, maxBytes } = evidence.htmlUnavailable
    return (
      <EmptyNote
        body={`This pack is ${formatMb(bytes)}, past the ${formatMb(maxBytes)} read cap, so its body was dropped — the checks above are still the real result. Shrink the screenshots (JPEG around 540px wide) and rewrite index.html.`}
        testID="porcelain-review-evidence-too-large"
        title="Evidence too large to render"
      />
    )
  }
  if (evidence.html === undefined || evidence.html === '') {
    return (
      <EmptyNote
        body="The pack has checks but no index.html body. Ask the agent to write one in the directory evidence prepare printed."
        testID="porcelain-review-evidence-no-body"
        title="No evidence body"
      />
    )
  }
  return (
    <PreviewView
      document={previewDocument(evidence.html)}
      testID="porcelain-review-evidence-report"
    />
  )
}

/** Always MB with one decimal — the same shape the desktop's over-cap copy uses. */
function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
