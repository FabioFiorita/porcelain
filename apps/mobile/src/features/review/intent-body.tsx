import type { ReviewDoc, ReviewReading } from '@porcelain/contracts/review'
import { Text, View } from 'react-native'
import { EmptyNote, ErrorNote } from '@/components/panel-chrome'
import { markdownToHtml, PreviewView, readerDocument } from '@/features/files'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'

import { IntentDocBody } from './doc-body'
import { type DocTab, DocTabs } from './review-chrome'
import { useReviewStore } from './review-store'
import { useReviewIntentDocs } from './use-review'

/**
 * Intent: whatever the agent reached for to make the case.
 *
 * Documents written under `.porcelain/intent/` become panes, plus the review set's
 * thesis/walkthrough narrative — the same sources the desktop canvas offers, in the same
 * order. One pane renders bare; more than one gets a strip, so a review with a single
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
        body="No Intent yet — a document under .porcelain/intent/, a thesis, or walkthrough sections. Files live on the Execution tab."
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
 * A pane is one of the agent's documents, or the narrative the review set
 * carries in `thesis` / `sections`. Resolved to a body at render time, so the strip can list
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

  const markup = narrativeMarkup(reading)
  if (markup !== null) {
    panes.push({ key: 'document', kind: 'markup', label: 'Document', markup })
  }

  return panes
}

/**
 * The review set's own narrative as one HTML fragment: the thesis, then each walkthrough
 * section's heading, prose, inline SVG diagram, and agent-authored HTML block.
 *
 * Prose goes through markdown-it with raw HTML off, so markdown cannot smuggle markup in; the
 * diagram and the section's HTML are inserted as themselves, because that is what they are.
 * The preview document's own CSP (`default-src 'none'`, no scripting, no network) is what
 * makes that safe — the same guarantee the desktop's `sandbox=""` frame gives them.
 */
function narrativeMarkup(reading: ReviewReading): string | null {
  const parts: string[] = []
  if (reading.thesis !== undefined && reading.thesis.trim() !== '') {
    parts.push(markdownToHtml(reading.thesis))
  }
  for (const section of reading.sections) {
    if (section.title.trim() !== '') parts.push(markdownToHtml(`## ${section.title}`))
    if (section.prose.trim() !== '') parts.push(markdownToHtml(section.prose))
    if (section.diagram !== undefined) parts.push(section.diagram)
    if (section.html !== undefined) parts.push(section.html)
  }
  return parts.length === 0 ? null : parts.join('\n')
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
