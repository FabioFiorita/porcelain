import type { ReviewDoc, ReviewReading } from '@porcelain/contracts/review'
import { Text, View } from 'react-native'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { PreviewView, readerDocument } from '@/features/files'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'

import { IntentDocBody } from './doc-body'
import { type DocTab, DocTabs } from './review-chrome'
import { intentMarkup } from './review-markup'
import { useReviewStore } from './review-store'
import { useReviewIntentDocs } from './use-review'

/**
 * Intent: whatever the agent reached for to make the case.
 *
 * Documents written under `.porcelain/intent/` become panes, plus the review set's thesis — the
 * same sources the desktop canvas offers, in the same order. One pane renders bare; more than one gets a strip, so a review with a single
 * `index.md` never pays for chrome it does not need.
 *
 * The document set is only read while this canvas is up (see `useReviewIntentDocs`), which is
 * the whole reason Intent is a tab rather than a chapter of one long page.
 */
export function IntentBody({
  active,
  reading,
}: {
  /** Focus AND tab visibility — the gate on a read that can reach 8 MiB. */
  active: boolean
  reading: ReviewReading
}): React.JSX.Element {
  const { docs, error, isLoading } = useReviewIntentDocs(active)
  const pane = useReviewStore((state) => state.intentPane)
  const setPane = useReviewStore((state) => state.setIntentPane)
  const scheme = useResolvedColorScheme()

  const panes = intentPanes(reading, docs ?? [])
  const current = panes.find((entry) => entry.key === pane) ?? panes[0]

  if (error !== null) {
    return (
      <View className="p-4">
        <ErrorNote message={error.message} testID="porcelain-review-intent-error" />
      </View>
    )
  }

  if (current === undefined) {
    if (isLoading && docs === undefined) {
      return (
        <Text
          className="p-4 text-sm text-muted-foreground"
          testID="porcelain-review-intent-loading"
        >
          Loading Intent…
        </Text>
      )
    }
    return (
      <EmptyNote
        body="No Intent yet — a document under .porcelain/intent/ or a thesis. Walkthrough sections live on Process; files live on Execution."
        testID="porcelain-review-intent-empty"
        title="Nothing to read yet"
      />
    )
  }

  return (
    <View className="flex-1" testID="porcelain-review-intent">
      {panes.length === 1 ? null : (
        <DocTabs
          tabs={panes}
          testIDPrefix="porcelain-review-intent-tab"
          value={current.key}
          onChange={setPane}
        />
      )}
      <IntentPaneBody pane={current} scheme={scheme} />
    </View>
  )
}

/**
 * A pane is one of the agent's documents, or the thesis the review set carries. Resolved to a
 * body at render time, so the strip can list
 * them all without building any of them.
 */
type IntentPane = DocTab & ({ kind: 'doc'; doc: ReviewDoc } | { kind: 'markup'; markup: string })

function intentPanes(reading: ReviewReading, docs: readonly ReviewDoc[]): IntentPane[] {
  const panes: IntentPane[] = docs.map((doc) => ({
    doc,
    key: `doc:${doc.file}`,
    kind: 'doc',
    label: doc.label,
  }))

  const markup = intentMarkup(reading)
  if (markup !== null) {
    panes.push({ key: 'document', kind: 'markup', label: 'Document', markup })
  }

  return panes
}

function IntentPaneBody({
  pane,
  scheme,
}: {
  pane: IntentPane
  scheme: 'light' | 'dark'
}): React.JSX.Element {
  if (pane.kind === 'markup') {
    return (
      <PreviewView
        document={readerDocument(pane.markup, scheme)}
        testID="porcelain-review-intent-document"
      />
    )
  }
  return <IntentDocBody doc={pane.doc} testIDPrefix="porcelain-review-intent-doc" />
}
