import type { FeatureReading } from '@porcelain/contracts/review'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureList } from './feature-list'
import { useReviewFocusStore } from './review-focus-store'
import { useReviewReading } from './review-queries'

// Same convention as changes-list: mock the domain hook, never tRPC. useReviewReading
// hands back a FeatureReading shaped exactly like the real featureReading query.
vi.mock('./review-queries', () => ({
  useReviewReading: vi.fn(),
}))
// FeatureList mounts CommentComposer (right-click → "Comment on file"), which uses the
// comment hook — mock the domain hook, never the tRPC proxy (the component-test rule).
vi.mock('@renderer/features/review', () => ({
  useCommentActions: () => ({ add: async () => {} }),
}))
// Reviewed marks (green check + strikethrough, Mark/Unmark menu) — mock the domain hook.
// reviewedPaths is swapped per-test; the toggle spies record mark/unmark calls.
const markSpy = vi.hoisted(() => vi.fn(async () => {}))
const unmarkSpy = vi.hoisted(() => vi.fn(async () => {}))
const reviewedPaths = vi.hoisted(() => ({ current: new Set<string>() }))
// FeatureList also renders the Review inbox above the outline; stub its Git workspace hook
// (a real tRPC query otherwise) so these outline-focused cases render without a client.
vi.mock('@renderer/features/git', () => ({
  useDiffFileHoverPrefetch: () => () => {},
  useGitWorkspace: () => ({
    branch: 'main',
    branches: [],
    head: undefined,
    inbox: [],
    refreshBranches: async () => {},
    worktrees: [],
  }),
  useReviewedPaths: () => reviewedPaths.current,
  useToggleReviewed: () => ({ mark: markSpy, unmark: unmarkSpy }),
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
  render(
    <SidebarProvider>
      <FeatureList />
    </SidebarProvider>,
  )
}

describe('FeatureList', () => {
  beforeEach(() => {
    markSpy.mockClear()
    unmarkSpy.mockClear()
    reviewedPaths.current = new Set()
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useProjectSelectionStore.setState({ project: { path: '/repo', name: 'repo' } })
    usePreferencesStore.setState({ sidebarTab: 'feature' })
    useReviewFocusStore.setState({
      canvasTab: 'intent',
      activeSection: null,
      visiblePath: null,
      jump: null,
    })
    vi.mocked(useReviewReading).mockReturnValue({ reading, refresh: async () => {} })
  })

  it('shows the start-a-Review empty state when no review set exists', () => {
    vi.mocked(useReviewReading).mockReturnValue({ reading: null, refresh: async () => {} })
    renderList()
    expect(screen.getByText(/Start a Review/)).toBeInTheDocument()
  })

  it('renders the outline: name, progress, chapters, files, and the note', () => {
    renderList()
    expect(screen.getByText('Crew call-outs')).toBeInTheDocument()
    expect(screen.getByText(/0\/2 reviewed/)).toBeInTheDocument()
    expect(screen.getByText('Entry point')).toBeInTheDocument()
    expect(screen.getByText('More files')).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('callout.tsx')).toBeInTheDocument()
    expect(screen.getByText('callout-service.ts')).toBeInTheDocument()
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Review' })).toBeInTheDocument()
    // Canvas tabs live in the viewer only — not duplicated in the sidebar.
    expect(screen.queryByRole('tab', { name: 'Intent' })).not.toBeInTheDocument()
    expect(
      screen.getByText(byTextContent('labels must match CALLOUT_TEMPLATES')),
    ).toBeInTheDocument()
  })

  it('opens the Review and jumps to a section from its chapter title', () => {
    renderList()
    fireEvent.click(screen.getByText('Entry point'))
    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    const { tabs } = pane
    expect(tabs[0]).toMatchObject({ id: tabId('feature', '/repo'), kind: 'feature' })
    expect(useReviewFocusStore.getState().jump?.target).toEqual({ kind: 'section', index: 0 })
  })

  it('opens the Review canvas on Intent from Open Review', () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Open Review' }))
    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    const { tabs } = pane
    expect(tabs[0]).toMatchObject({ id: tabId('feature', '/repo'), kind: 'feature' })
    expect(useReviewFocusStore.getState().jump?.target).toEqual({ kind: 'intent' })
  })

  it('opens a changed file as a working-tree diff (matches Changes primary open)', () => {
    renderList()
    screen.getByText('callout.tsx').click()
    const path = 'src/components/callout.tsx'
    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    const { tabs } = pane
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ id: tabId('diff', path), kind: 'diff', path })
  })

  it('opens the file at its absolute path for an unchanged shipped file', () => {
    renderList()
    screen.getByText('callout-service.ts').click()
    const absolute = '/repo/server/callout-service.ts'
    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    const { tabs } = pane
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ id: tabId('file', absolute), kind: 'file', path: absolute })
  })

  it('offers "Open file" for a changed file from the context menu', () => {
    renderList()
    fireEvent.contextMenu(screen.getByText('callout.tsx'))
    fireEvent.click(screen.getByText('Open file'))
    const absolute = '/repo/src/components/callout.tsx'
    const pane = useTabsStore.getState().panes[0]
    if (pane === undefined) throw new Error('expected pane 0')
    const { tabs } = pane
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

  it('does not host Clear review (that lives on the right-rail companion)', () => {
    renderList()
    expect(screen.queryByText('Clear review & evidence')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Review actions')).not.toBeInTheDocument()
  })

  // Committing lives on Changes only — the outline never grew a second entry point.
  it('does not host Commit changes at any progress', () => {
    reviewedPaths.current = new Set(['src/components/callout.tsx', 'server/callout-service.ts'])
    renderList()
    expect(screen.queryByRole('button', { name: 'Commit changes' })).not.toBeInTheDocument()
  })

  it('reports reading progress on the meta line', () => {
    reviewedPaths.current = new Set(['src/components/callout.tsx'])
    renderList()
    expect(screen.getByText(/1\/2 reviewed/)).toBeInTheDocument()
  })
})
