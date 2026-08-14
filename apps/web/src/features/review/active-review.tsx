import type { FileSource, ReadingFile, ReviewReading } from '@porcelain/contracts/review'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDiffFileHoverPrefetch, useReviewedPaths } from '@renderer/features/git'
import {
  ACTIVE_REVIEW_TABS,
  type ActiveReviewTab,
  isActiveReviewTab,
} from '@renderer/lib/active-review-tabs'
import { compactButtonClass } from '@renderer/lib/controls'
import { highlightRangesForFile } from '@renderer/lib/highlight-ranges'
import { isTerminalTarget, isTextEntry } from '@renderer/lib/keyboard'
import { dirName, fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { useZenStore } from '@renderer/stores/zen'
import { TestIds } from '@shared/test-ids'
import { Check, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EvidencePanel } from './evidence-panel'
import { ReadingSurfaceBody } from './reading-surface'
import { ReviewDocBody } from './review-doc-body'
import { jumpTargets, nextTarget, useReviewFocusStore } from './review-focus-store'
import { SourceMarker } from './review-list'
import { useReviewIntent, useReviewReading } from './review-queries'
import { useReviewStartStore } from './review-start-store'

const SOURCE_LABEL: Record<FileSource, string> = {
  changed: 'changed',
  context: 'context',
  shipped: 'shipped',
}

/** Unique-file counts per source, across sections and groups (a file anchored twice counts once). */
function sourceCounts(reading: ReviewReading): Record<FileSource, number> {
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
  reading: ReviewReading | null | undefined,
  canvasTab: ActiveReviewTab,
): void {
  const requestJump = useReviewFocusStore((s) => s.requestJump)
  const toggleZen = useZenStore((s) => s.toggle)
  const readingRef = useRef(reading)
  const canvasTabRef = useRef(canvasTab)
  useEffect(() => {
    readingRef.current = reading
    canvasTabRef.current = canvasTab
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
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
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requestJump, toggleZen])
}

// Empty canvas: start-of-unit home. No baseline — the Review exists only when an
// agent publishes one.
function EmptyState(): React.JSX.Element {
  // Board → Review may prefill a name once; keep it local so it stays stable.
  const [suggestedName] = useState(() => useReviewStartStore.getState().consumeSuggestedName())

  return (
    <div
      data-testid={TestIds.activeReviewEmpty}
      className="flex h-full items-center justify-center p-8"
    >
      <div className="max-w-md">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="size-4 text-info" />
          Start this unit of work
        </p>
        <p className="mb-3 text-sm text-muted-foreground">
          The Review is where a unit begins and ends — bug, feature, chore, or investigation. Your
          agent starts one through the porcelain-companion skill: Intent first (name + thesis), then
          Execution and Evidence as work finishes. Clear any previous unit before starting a new
          one.
        </p>
        {suggestedName && (
          <p className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs text-foreground">
            Suggested name: <span className="font-medium">{suggestedName}</span>
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The viewer's `review` tab: the Review canvas — header (name + source counts)
 * over three tabs: **Intent** (narrative / freeform board), **Execution** (files +
 * notes), **Evidence** (the pack: checks, results, assets). Human questions appear as
 * tab hover tooltips.
 * Outline jumps pick the tab; J/K stay on Intent.
 */
export function ActiveReview(): React.JSX.Element {
  const { reading } = useReviewReading()
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
    <div data-testid={TestIds.activeReview} className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-3 py-1.5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xs font-medium">{reading.name}</h1>
          <p className="mt-0.5 truncate text-2xs text-muted-foreground">
            Previous unit still up — Clear in the Review list or right rail when this story is done.
          </p>
        </div>
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
        onValueChange={(value: string): void => {
          if (isActiveReviewTab(value)) {
            // No evidence yet → keep Intent (or stay) rather than an empty Evidence shell.
            if (value === 'evidence' && !hasEvidence) return
            setCanvasTab(value)
          }
        }}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-b px-3">
          <TabsList variant="line" className="h-9 w-full justify-start">
            {ACTIVE_REVIEW_TABS.map((tab) => {
              const disabled = tab.id === 'evidence' && !hasEvidence
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger
                    render={
                      <TabsTrigger
                        value={tab.id}
                        disabled={disabled}
                        data-testid={TestIds.activeReviewTab(tab.id)}
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
                No evidence yet. Checks, result documents, or screenshots — whatever your agent
                publishes shows up here.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Intent: whatever the agent reached for to make the case — documents it wrote
 * under `.porcelain/intent/` (markdown or a self-contained HTML page), plus the
 * review set's own narrative.
 *
 * Each becomes a pane. One pane renders bare; more than one gets a strip, so a
 * single `index.md` never pays for chrome it doesn't need.
 */
function IntentBody({ reading }: { reading: ReviewReading }): React.JSX.Element {
  const docs = useReviewIntent()
  const hasDoc =
    reading.sections.length > 0 || (reading.thesis !== undefined && reading.thesis.trim() !== '')

  const panes: Array<{ key: string; label: string; render: () => React.JSX.Element }> = [
    ...docs.map((doc) => ({
      key: `doc:${doc.file}`,
      label: doc.label,
      render: (): React.JSX.Element => <ReviewDocBody doc={doc} />,
    })),
    ...(hasDoc
      ? [
          {
            key: 'document',
            label: 'Document',
            render: (): React.JSX.Element => (
              <ReadingSurfaceBody
                reading={reading}
                trackFocus
                includeEvidence={false}
                includeAnchors={false}
              />
            ),
          },
        ]
      : []),
  ]

  const [active, setActive] = useState<string | null>(null)
  const current = panes.find((pane) => pane.key === active) ?? panes[0]

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          No Intent yet — a document under <span className="font-mono">.porcelain/intent/</span>, a
          thesis, walkthrough sections, or a freeform board. Files live on the Execution tab.
        </p>
      </div>
    )
  }

  if (panes.length === 1) return current.render()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 px-3 py-1.5"
        data-testid={TestIds.intentDocTabs}
      >
        {panes.map((pane) => (
          <Button
            key={pane.key}
            size="sm"
            variant={pane.key === current.key ? 'secondary' : 'ghost'}
            className={compactButtonClass}
            data-testid={TestIds.intentDocTab(pane.label)}
            onClick={() => setActive(pane.key)}
          >
            {pane.label}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1">{current.render()}</div>
    </div>
  )
}

/**
 * Execution: scrollable list of Review files with agent notes — same open
 * semantics as the sidebar outline (diff for changed, file for context/shipped).
 */
function ExecutionBody({ reading }: { reading: ReviewReading }): React.JSX.Element {
  const repoPath = useHubRepoPath()
  const openTab = useTabsStore((s) => s.openTab)
  const prefetchDiff = useDiffFileHoverPrefetch()
  const reviewed = useReviewedPaths()

  if (repoPath === null) {
    return <p className="p-4 text-sm text-muted-foreground">No project open.</p>
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

  const handleOpenFile = (file: ReadingFile): void => {
    const absolute = `${repoPath}/${file.path}`
    const ranges = highlightRangesForFile(file)
    openTab(
      targetedTab(
        'file',
        absolute,
        {
          title: fileName(file.path),
          line: ranges?.[0]?.start,
          highlight: ranges,
        },
        activeTabTarget(),
      ),
    )
  }

  const handleOpenDiff = (file: ReadingFile): void => {
    openTab(targetedTab('diff', file.path, { title: fileName(file.path) }, activeTabTarget()))
  }

  const handlePrimaryOpen = (file: ReadingFile): void => {
    if (file.source === 'changed') handleOpenDiff(file)
    else handleOpenFile(file)
  }

  const renderFile = (file: ReadingFile): React.JSX.Element => {
    const isReviewed = reviewed.has(file.path)
    const name = fileName(file.path)
    const dir = dirName(file.path)
    return (
      <div key={file.path} className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => handlePrimaryOpen(file)}
          onMouseEnter={() => {
            if (file.source === 'changed') prefetchDiff(file.path)
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
