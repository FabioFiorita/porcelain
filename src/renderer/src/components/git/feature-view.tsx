import type { FeatureReading, ReadingFile } from '@backend/feature-view'
import type { FileSource } from '@backend/review-set'
import { CanvasBody } from '@renderer/components/git/canvas-body'
import { EvidencePanel } from '@renderer/components/git/evidence-panel'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDiffFilePrefetch } from '@renderer/hooks/use-diff'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useReviewedPaths } from '@renderer/hooks/use-reviewed'
import {
  FEATURE_CANVAS_TABS,
  type FeatureCanvasTab,
  isFeatureCanvasTab,
} from '@renderer/lib/feature-canvas'
import { highlightRangesForFile } from '@renderer/lib/highlight-ranges'
import { isTerminalTarget, isTextEntry } from '@renderer/lib/keyboard'
import { dirName, fileName } from '@renderer/lib/paths'
import { cn, copyText } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { jumpTargets, nextTarget, useReviewFocusStore } from '@renderer/stores/review-focus'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
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
  'Publish a review of this feature to Porcelain using the feature-review skill (porcelain review set --sections ...).'

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

function uniqueFiles(files: ReadingFile[]): ReadingFile[] {
  const seen = new Set<string>()
  const out: ReadingFile[] = []
  for (const file of files) {
    if (seen.has(file.path)) continue
    seen.add(file.path)
    out.push(file)
  }
  return out
}

// Plain-key document navigation, registered only while the Review is mounted:
// J/K jump Intent chapters, Z toggles zen. Execution/Evidence leave J/K alone.
function useReviewKeys(
  reading: FeatureReading | null | undefined,
  canvasTab: FeatureCanvasTab,
): void {
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
      if (canvasTabRef.current !== 'intent') return
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
          The Review renders here — Intent (the idea), Execution (the files), and Evidence (proof) —
          once your agent publishes one via the porcelain CLI.
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
 * over three tabs: **Intent** (narrative / freeform board), **Execution** (files +
 * notes), **Evidence** (HTML proof). Human questions appear as tab hover tooltips.
 * Outline jumps pick the tab; J/K stay on Intent.
 */
export function FeatureView(): React.JSX.Element {
  const { reading } = useFeatureReading()
  const canvasTab = useReviewFocusStore((s) => s.canvasTab)
  const setCanvasTab = useReviewFocusStore((s) => s.setCanvasTab)
  const jump = useReviewFocusStore((s) => s.jump)
  const clearJump = useReviewFocusStore((s) => s.clearJump)
  const setVisible = useReviewFocusStore((s) => s.setVisible)
  useReviewKeys(reading, canvasTab)

  // Leaving the Review resets the published focus so the outline and Quick Access
  // don't keep highlighting a chapter nobody is reading.
  useEffect(() => {
    return () => useReviewFocusStore.getState().setVisible(null, null)
  }, [])

  // Outline / pill / shortcut jumps: set canvas tab; section/top stay on Intent
  // and still scroll the narrative virtualizer.
  useEffect(() => {
    if (!jump) return
    if (jump.target.kind === 'evidence') {
      setCanvasTab('evidence')
      setVisible('evidence', null)
      clearJump()
      return
    }
    if (jump.target.kind === 'execution') {
      setCanvasTab('execution')
      setVisible(null, null)
      clearJump()
      return
    }
    if (jump.target.kind === 'intent') {
      setCanvasTab('intent')
      setVisible(null, null)
      clearJump()
      return
    }
    // section | top → Intent (ReadingSurfaceBody consumes the jump for scroll).
    setCanvasTab('intent')
  }, [jump, clearJump, setVisible, setCanvasTab])

  // Evidence cleared while on that tab → fall back to Intent.
  useEffect(() => {
    if (reading && reading.evidence === null && canvasTab === 'evidence') {
      setCanvasTab('intent')
    }
  }, [reading, canvasTab, setCanvasTab])

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
      <Tabs
        value={canvasTab}
        onValueChange={(value) => {
          if (isFeatureCanvasTab(value)) {
            // No evidence yet → keep Intent (or stay) rather than an empty Evidence shell.
            if (value === 'evidence' && !hasEvidence) return
            setCanvasTab(value)
          }
        }}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-b px-3">
          <TabsList variant="line" className="h-9 w-full justify-start">
            {FEATURE_CANVAS_TABS.map((tab) => {
              const disabled = tab.id === 'evidence' && !hasEvidence
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger
                    render={
                      <TabsTrigger
                        value={tab.id}
                        disabled={disabled}
                        className="flex-none px-3 data-disabled:opacity-40"
                      />
                    }
                  >
                    {tab.label}
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {disabled ? 'No evidence published yet' : tab.question}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TabsList>
        </div>
        <TabsContent value="intent" className="min-h-0 flex-1 outline-none">
          <IntentBody reading={reading} />
        </TabsContent>
        <TabsContent value="execution" className="min-h-0 flex-1 outline-none">
          <ExecutionBody reading={reading} />
        </TabsContent>
        <TabsContent value="evidence" className="min-h-0 flex-1 outline-none">
          {reading.evidence ? (
            <EvidencePanel
              title={reading.evidence.title}
              updatedAt={reading.evidence.updatedAt}
              checks={reading.evidence.checks}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <p className="max-w-sm text-center text-sm text-muted-foreground">
                No evidence yet. When your agent publishes HTML proof, it shows here.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Intent: freeform board and/or narrative document (thesis + section prose —
 * no code anchors; Execution owns files). Board | Document when both exist.
 */
function IntentBody({ reading }: { reading: FeatureReading }): React.JSX.Element {
  const hasCanvas = reading.canvas !== undefined
  const hasDoc =
    reading.sections.length > 0 || (reading.thesis !== undefined && reading.thesis.trim() !== '')
  const [mode, setMode] = useState<'board' | 'document'>(hasCanvas ? 'board' : 'document')

  if (hasCanvas && hasDoc) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-1.5">
          <Button
            size="sm"
            variant={mode === 'board' ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setMode('board')}
          >
            Board
          </Button>
          <Button
            size="sm"
            variant={mode === 'document' ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setMode('document')}
          >
            Document
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          {mode === 'board' && reading.canvas ? (
            <CanvasBody canvas={reading.canvas} />
          ) : (
            <ReadingSurfaceBody
              reading={reading}
              trackFocus
              includeEvidence={false}
              includeAnchors={false}
            />
          )}
        </div>
      </div>
    )
  }
  if (hasCanvas && reading.canvas) {
    return <CanvasBody canvas={reading.canvas} />
  }
  if (!hasDoc) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          No Intent narrative yet — thesis, walkthrough sections, or a freeform board. Files live on
          the Execution tab.
        </p>
      </div>
    )
  }
  return (
    <ReadingSurfaceBody
      reading={reading}
      trackFocus
      includeEvidence={false}
      includeAnchors={false}
    />
  )
}

/**
 * Execution: scrollable list of feature files with agent notes — same open
 * semantics as the sidebar outline (diff for changed, file for context/shipped).
 */
function ExecutionBody({ reading }: { reading: FeatureReading }): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const prefetchDiff = useDiffFilePrefetch()
  const reviewed = useReviewedPaths()

  if (!repo) {
    return <p className="p-4 text-sm text-muted-foreground">No repo open.</p>
  }

  const sectionBlocks = reading.sections.map((section, index) => ({
    key: `section-${index}`,
    title: section.title,
    files: uniqueFiles(section.files),
  }))
  const hasFiles =
    sectionBlocks.some((b) => b.files.length > 0) || reading.groups.some((g) => g.files.length > 0)

  if (!hasFiles) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          No files in this Review yet. The agent lists them via{' '}
          <span className="font-mono text-2xs">review set --files</span>.
        </p>
      </div>
    )
  }

  const openFile = (file: ReadingFile): void => {
    const absolute = `${repo.path}/${file.path}`
    const ranges = highlightRangesForFile(file)
    openTab({
      id: tabId('file', absolute),
      kind: 'file',
      title: fileName(file.path),
      path: absolute,
      line: ranges?.[0]?.start,
      highlight: ranges,
    })
  }

  const openDiff = (file: ReadingFile): void => {
    openTab({
      id: tabId('diff', file.path),
      kind: 'diff',
      title: fileName(file.path),
      path: file.path,
    })
  }

  const primaryOpen = (file: ReadingFile): void => {
    if (file.source === 'changed') openDiff(file)
    else openFile(file)
  }

  const renderFile = (file: ReadingFile): React.JSX.Element => {
    const isReviewed = reviewed.has(file.path)
    const name = fileName(file.path)
    const dir = dirName(file.path)
    return (
      <div key={file.path} className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => primaryOpen(file)}
          onMouseEnter={() => {
            if (file.source === 'changed') void prefetchDiff(file.path)
          }}
          className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <SourceMarker source={file.source} />
            {isReviewed && <Check className="size-3 shrink-0 text-success" aria-label="Reviewed" />}
            <span
              className={cn(
                'min-w-0 flex-1 truncate font-mono text-sm-minus',
                isReviewed && 'line-through text-muted-foreground',
              )}
            >
              {name}
            </span>
            {file.additions !== undefined && file.additions > 0 && (
              <span className="shrink-0 font-mono text-2xs text-success">+{file.additions}</span>
            )}
            {file.deletions !== undefined && file.deletions > 0 && (
              <span className="shrink-0 font-mono text-2xs text-destructive">
                −{file.deletions}
              </span>
            )}
          </div>
          {dir && (
            <span className="truncate pl-3.5 font-mono text-2xs text-muted-foreground/70">
              {dir}
            </span>
          )}
        </button>
        {file.note && (
          <div className="mx-2 mb-1 rounded-lg border border-border/60 bg-muted px-2.5 py-2">
            <span className="text-3xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Note
            </span>
            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
              {file.note}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3">
      <div className="flex flex-col gap-3">
        {sectionBlocks.map((block) =>
          block.files.length === 0 ? null : (
            <div key={block.key}>
              <p className="mb-1 px-2 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {block.title}
              </p>
              <div className="flex flex-col gap-0.5">{block.files.map(renderFile)}</div>
            </div>
          ),
        )}
        {reading.groups.map((group) => (
          <div key={group.layer}>
            <p className="mb-1 px-2 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {group.layer}
            </p>
            <div className="flex flex-col gap-0.5">{group.files.map(renderFile)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
