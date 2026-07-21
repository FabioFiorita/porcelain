import type { FeatureReading } from '@backend/feature-view'
import { SidebarHeaderActionsProvider } from '@renderer/components/shell/sidebar-header-actions'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useRepoStore } from '@renderer/stores/repo'
import { useReviewFocusStore } from '@renderer/stores/review-focus'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureList } from './feature-list'

// Same convention as changes-list: mock the domain hook, never tRPC. useFeatureReading
// hands back a FeatureReading shaped exactly like the real featureReading query.
vi.mock('@renderer/hooks/use-feature-reading', () => ({
  useFeatureReading: vi.fn(),
}))
const clearSpy = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@renderer/hooks/use-feature-view', () => ({
  useClearFeatureReview: () => ({ clear: clearSpy, isClearing: false }),
}))
vi.mock('@renderer/hooks/use-diff', () => ({ useDiffFilePrefetch: () => async () => {} }))
// FeatureList mounts CommentComposer (right-click → "Comment on file"), which uses the
// comment hook — mock the domain hook, never the tRPC proxy (the component-test rule).
vi.mock('@renderer/hooks/use-comments', () => ({
  useCommentActions: () => ({ add: async () => {} }),
}))
// Reviewed marks (green check + strikethrough, Mark/Unmark menu) — mock the domain hook.
// reviewedPaths is swapped per-test; the toggle spies record mark/unmark calls.
const markSpy = vi.hoisted(() => vi.fn(async () => {}))
const unmarkSpy = vi.hoisted(() => vi.fn(async () => {}))
const reviewedPaths = vi.hoisted(() => ({ current: new Set<string>() }))
vi.mock('@renderer/hooks/use-reviewed', () => ({
  useReviewedPaths: () => reviewedPaths.current,
  useToggleReviewed: () => ({ mark: markSpy, unmark: unmarkSpy }),
}))

// FeatureList now renders the Review inbox above the outline; stub its worktree hook
// (a real tRPC query otherwise) so these outline-focused cases render without a client.
vi.mock('@renderer/hooks/use-worktrees', () => ({
  useWorktreeInbox: () => [],
}))

const reading: FeatureReading = {
  name: 'Crew call-outs',
  thesis: 'One paragraph of intent.',
  sections: [
    {
      title: 'Entry point',
      prose: 'Where the flow starts.',
      files: [
        {
          path: 'src/components/callout.tsx',
          source: 'changed',
          additions: 12,
          deletions: 3,
          hunks: [
            {
              header: '@@ -1 +1,2 @@',
              lines: [
                { kind: 'context', oldLine: 1, newLine: 1, text: 'keep' },
                { kind: 'add', oldLine: null, newLine: 2, text: 'new' },
                { kind: 'add', oldLine: null, newLine: 3, text: 'lines' },
              ],
            },
          ],
        },
      ],
    },
  ],
  groups: [
    {
      layer: 'Services',
      files: [
        {
          path: 'server/callout-service.ts',
          source: 'shipped',
          note: 'labels must match CALLOUT_TEMPLATES',
          ranges: [],
        },
      ],
    },
  ],
  evidence: {
    title: 'Loop closed',
    updatedAt: '2026-07-18T00:00:00.000Z',
    checks: [],
    medium: 'html',
  },
}

// The note block contains a child element (the label chip), so match on the
// element's own textContent rather than getByText's default node text.
const byTextContent =
  (text: string) =>
  (_: string, el: Element | null): boolean =>
    el?.textContent === text

function renderList(): void {
  // Header actions (Refresh, Review actions …) portal into a slot — without a
  // provider they render nowhere (same pattern as AgentList tests).
  const slot = document.createElement('div')
  document.body.appendChild(slot)
  render(
    <SidebarHeaderActionsProvider value={slot}>
      <SidebarProvider>
        <FeatureList />
      </SidebarProvider>
    </SidebarHeaderActionsProvider>,
  )
}

describe('FeatureList', () => {
  beforeEach(() => {
    clearSpy.mockClear()
    markSpy.mockClear()
    unmarkSpy.mockClear()
    reviewedPaths.current = new Set()
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
    useReviewFocusStore.setState({
      canvasTab: 'intent',
      activeSection: null,
      visiblePath: null,
      jump: null,
    })
    vi.mocked(useFeatureReading).mockReturnValue({ reading, refresh: async () => {} })
  })

  it('shows the empty state when no review set exists', () => {
    vi.mocked(useFeatureReading).mockReturnValue({ reading: null, refresh: async () => {} })
    renderList()
    expect(screen.getByText(/No review yet/)).toBeInTheDocument()
  })

  it('renders the outline: name, progress, chapters, files, and the note', () => {
    renderList()
    expect(screen.getByText('Crew call-outs')).toBeInTheDocument()
    expect(screen.getByText('0/2 reviewed')).toBeInTheDocument()
    expect(screen.getByText('Entry point')).toBeInTheDocument()
    expect(screen.getByText('More files')).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('callout.tsx')).toBeInTheDocument()
    expect(screen.getByText('callout-service.ts')).toBeInTheDocument()
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByText('Loop closed')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Intent' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Execution' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Evidence' })).toBeInTheDocument()
    expect(
      screen.getByText(byTextContent('labels must match CALLOUT_TEMPLATES')),
    ).toBeInTheDocument()
  })

  it('opens the Review and jumps to a section from its chapter title', () => {
    renderList()
    fireEvent.click(screen.getByText('Entry point'))
    const { tabs } = useTabsStore.getState().panes[0]
    expect(tabs[0]).toMatchObject({ id: tabId('feature', '/repo'), kind: 'feature' })
    expect(useReviewFocusStore.getState().jump?.target).toEqual({ kind: 'section', index: 0 })
  })

  it('jumps to the evidence canvas tab from the Evidence shortcut', () => {
    renderList()
    // Shortcut uses the evidence title when present.
    fireEvent.click(screen.getByText('Loop closed'))
    expect(useReviewFocusStore.getState().jump?.target).toEqual({ kind: 'evidence' })
    expect(useReviewFocusStore.getState().canvasTab).toBe('evidence')
  })

  it('opens Intent from the Intent shortcut', () => {
    renderList()
    fireEvent.click(screen.getByText('What is this, and what’s the idea?'))
    expect(useReviewFocusStore.getState().jump?.target).toEqual({ kind: 'intent' })
  })

  it('opens a changed file as a working-tree diff (matches Changes primary open)', () => {
    renderList()
    screen.getByText('callout.tsx').click()
    const path = 'src/components/callout.tsx'
    const { tabs } = useTabsStore.getState().panes[0]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ id: tabId('diff', path), kind: 'diff', path })
  })

  it('opens the file at its absolute path for an unchanged shipped file', () => {
    renderList()
    screen.getByText('callout-service.ts').click()
    const absolute = '/repo/server/callout-service.ts'
    const { tabs } = useTabsStore.getState().panes[0]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ id: tabId('file', absolute), kind: 'file', path: absolute })
  })

  it('offers "Open file" for a changed file from the context menu', () => {
    renderList()
    fireEvent.contextMenu(screen.getByText('callout.tsx'))
    fireEvent.click(screen.getByText('Open file'))
    const absolute = '/repo/src/components/callout.tsx'
    const { tabs } = useTabsStore.getState().panes[0]
    expect(tabs[0]).toMatchObject({
      id: tabId('file', absolute),
      kind: 'file',
      path: absolute,
    })
  })

  it('offers "Comment on file" from an outline row context menu', () => {
    renderList()
    fireEvent.contextMenu(screen.getByText('callout.tsx'))
    expect(screen.getByText('Comment on file')).toBeInTheDocument()
  })

  it('offers "Mark reviewed" for an unreviewed file and marks it', () => {
    renderList()
    fireEvent.contextMenu(screen.getByText('callout.tsx'))
    fireEvent.click(screen.getByText('Mark reviewed'))
    expect(markSpy).toHaveBeenCalledWith('src/components/callout.tsx')
  })

  it('strikes through a reviewed file and offers "Unmark reviewed"', () => {
    reviewedPaths.current = new Set(['src/components/callout.tsx'])
    renderList()
    expect(screen.getByText('callout.tsx')).toHaveClass('line-through')
    fireEvent.contextMenu(screen.getByText('callout.tsx'))
    fireEvent.click(screen.getByText('Unmark reviewed'))
    expect(unmarkSpy).toHaveBeenCalledWith('src/components/callout.tsx')
  })

  it('clears only after AlertDialog confirm', () => {
    renderList()
    fireEvent.click(screen.getByLabelText('Review actions'))
    fireEvent.click(screen.getByText('Clear review & evidence'))
    expect(clearSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Confirm clear review and evidence'))
    expect(clearSpy).toHaveBeenCalledTimes(1)
  })
})
