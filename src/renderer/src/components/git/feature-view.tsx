import type { FeatureReading } from '@backend/feature-view'
import type { FileSource } from '@backend/review-set'
import { CanvasBody } from '@renderer/components/git/canvas-body'
import { EvidencePanel } from '@renderer/components/git/evidence-panel'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { isTerminalTarget, isTextEntry } from '@renderer/lib/keyboard'
import { copyText } from '@renderer/lib/utils'
import { jumpTargets, nextTarget, useReviewFocusStore } from '@renderer/stores/review-focus'
import { useZenStore } from '@renderer/stores/zen'
import { Check, Copy, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SourceMarker } from './feature-list'
import { ReadingSurfaceBody } from './reading-surface'

const SOURCE_LABEL: Record<FileSource, string> = {
  changed: 'changed',
  context: 'context',
  shipped: 'shipped',
}

// The one-sentence prompt the empty state hands to the clipboard — enough for any
// agent with the companion skill installed to publish the Review.
const AGENT_PROMPT =
  'Publish a review of this feature to Porcelain using the review-with-porcelain skill (porcelain review set --sections ...).'

type CanvasTab = 'overview' | 'evidence'

/** Unique-file counts per source, across sections and groups (a file anchored twice counts once). */
function sourceCounts(reading: FeatureReading): Record<FileSource, number> {
  const seen = new Map<string, FileSource>()
  const files = [
    ...reading.sections.flatMap((section) => section.files),
    ...reading.groups.flatMap((group) => group.files),
  ]
  for (const file of files) {
    if (!seen.has(file.path)) seen.set(file.path, file.source)
  }
  const counts: Record<FileSource, number> = { changed: 0, context: 0, shipped: 0 }
  for (const source of seen.values()) counts[source]++
  return counts
}

// Plain-key document navigation, registered only while the Review is mounted:
// J/K jump to the next/previous Overview chapter (via the review-focus store,
// consumed by the reading surface), Z toggles zen mode. Loop evidence is its own
// canvas tab — J/K stay scoped to Overview (the evidence iframe would eat keys).
// No modifiers, and never over a text field or a focused terminal.
function useReviewKeys(reading: FeatureReading | null | undefined, canvasTab: CanvasTab): void {
  const requestJump = useReviewFocusStore((s) => s.requestJump)
  const toggleZen = useZenStore((s) => s.toggle)
  const readingRef = useRef(reading)
  readingRef.current = reading
  const canvasTabRef = useRef(canvasTab)
  canvasTabRef.current = canvasTab

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (isTextEntry(e.target) || isTerminalTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        toggleZen()
        return
      }
      if (key !== 'j' && key !== 'k') return
      // Evidence pane is full-height HTML — leave J/K alone there.
      if (canvasTabRef.current !== 'overview') return
      const doc = readingRef.current
      if (!doc) return
      const targets = jumpTargets({
        sectionCount: doc.sections.length,
        hasMoreFiles: doc.groups.length > 0,
        hasEvidence: false,
      })
      const active = useReviewFocusStore.getState().activeSection
      const target = nextTarget(targets, active, key === 'j' ? 1 : -1)
      if (target) {
        e.preventDefault()
        requestJump(target)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestJump, toggleZen])
}

// The "No review yet" empty state: no baseline, no fallback — the Review exists
// only when an agent publishes one. The copy button hands the exact ask to the
// clipboard (copyText — never navigator.clipboard, absent on the tailnet client).
function EmptyState(): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const copyPrompt = async (): Promise<void> => {
    await copyText(AGENT_PROMPT)
    setCopied(true)
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-info" />
          No review yet
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          The Review renders here — thesis, walkthrough sections, code, and loop evidence — once
          your agent publishes one via the porcelain CLI.
        </p>
        <Button variant="outline" size="sm" onClick={copyPrompt}>
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? 'Copied' : 'Copy agent prompt'}
        </Button>
      </div>
    </div>
  )
}

/**
 * The viewer's `feature` tab: the Review canvas — header (name + source counts)
 * over a tabbed body. **Overview** is the walkthrough document (thesis → sections
 * → More files, no evidence chapter). **Loop evidence** is a full-height panel
 * when the agent has published proof. Outline jumps pick the tab; J/K stay on
 * Overview.
 */
export function FeatureView(): React.JSX.Element {
  const { reading } = useFeatureReading()
  const [canvasTab, setCanvasTab] = useState<CanvasTab>('overview')
  const jump = useReviewFocusStore((s) => s.jump)
  const clearJump = useReviewFocusStore((s) => s.clearJump)
  const setVisible = useReviewFocusStore((s) => s.setVisible)
  useReviewKeys(reading, canvasTab)

  // Leaving the Review resets the published focus so the outline and Quick Access
  // don't keep highlighting a chapter nobody is reading.
  useEffect(() => {
    return () => useReviewFocusStore.getState().setVisible(null, null)
  }, [])

  // Outline / Loop-evidence row jumps: evidence opens the evidence canvas tab
  // (no scroll). Section/top jumps force Overview; ReadingSurfaceBody still
  // consumes the jump for virtualizer scroll.
  useEffect(() => {
    if (!jump) return
    if (jump.target.kind === 'evidence') {
      setCanvasTab('evidence')
      setVisible('evidence', null)
      clearJump()
      return
    }
    setCanvasTab('overview')
  }, [jump, clearJump, setVisible])

  // Evidence cleared while on that tab → fall back to Overview.
  useEffect(() => {
    if (reading && reading.evidence === null && canvasTab === 'evidence') {
      setCanvasTab('overview')
    }
  }, [reading, canvasTab])

  // Publish evidence focus while that canvas tab is active (outline highlight).
  useEffect(() => {
    if (canvasTab === 'evidence' && reading?.evidence) {
      setVisible('evidence', null)
    }
  }, [canvasTab, reading?.evidence, setVisible])

  if (reading === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  if (reading === null) return <EmptyState />

  const counts = sourceCounts(reading)
  const hasEvidence = reading.evidence !== null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-3 py-1.5">
        <h1 className="min-w-0 flex-1 truncate text-xs font-medium">{reading.name}</h1>
        <div className="flex shrink-0 items-center gap-3 text-2xs text-muted-foreground">
          {(['changed', 'context', 'shipped'] as const).map((source) => (
            <span key={source} className="flex items-center gap-1.5">
              <SourceMarker source={source} />
              {counts[source]} {SOURCE_LABEL[source]}
            </span>
          ))}
        </div>
      </div>
      {hasEvidence && reading.evidence ? (
        <Tabs
          value={canvasTab}
          onValueChange={(value) => {
            if (value === 'overview' || value === 'evidence') setCanvasTab(value)
          }}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="border-b px-3">
            <TabsList variant="line" className="h-9 w-full justify-start">
              <TabsTrigger value="overview" className="flex-none px-3">
                Overview
              </TabsTrigger>
              <TabsTrigger value="evidence" className="flex-none px-3">
                Loop evidence
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview" className="min-h-0 flex-1 outline-none">
            <OverviewBody reading={reading} />
          </TabsContent>
          <TabsContent value="evidence" className="min-h-0 flex-1 outline-none">
            <EvidencePanel
              title={reading.evidence.title}
              updatedAt={reading.evidence.updatedAt}
              checks={reading.evidence.checks}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="min-h-0 flex-1">
          <OverviewBody reading={reading} />
        </div>
      )}
    </div>
  )
}

/** Overview: freeform canvas when agent published one; else structured document. */
function OverviewBody({ reading }: { reading: FeatureReading }): React.JSX.Element {
  if (reading.canvas) {
    return <CanvasBody canvas={reading.canvas} />
  }
  return <ReadingSurfaceBody reading={reading} trackFocus includeEvidence={false} />
}
