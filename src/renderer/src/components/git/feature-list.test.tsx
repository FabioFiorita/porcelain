import type { FeatureView } from '@main/feature-view'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useFeatureView } from '@renderer/hooks/use-feature-view'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureList } from './feature-list'

// Same convention as changes-list: mock the domain hook, never tRPC. useFeatureView
// hands back a FeatureView shaped exactly like the real featureView query.
const clearSpy = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@renderer/hooks/use-feature-view', () => ({
  useFeatureView: vi.fn(),
  useClearFeatureReview: () => ({ clear: clearSpy, isClearing: false }),
}))
vi.mock('@renderer/hooks/use-diff', () => ({ useDiffFilePrefetch: () => async () => {} }))
// FeatureList mounts CommentComposer (right-click → "Comment on file"), which uses the
// comment hook — mock the domain hook, never the tRPC proxy (the component-test rule).
vi.mock('@renderer/hooks/use-comments', () => ({
  useCommentActions: () => ({ add: async () => {} }),
}))

const view: FeatureView = {
  name: 'Crew call-outs',
  fromAgent: true,
  groups: [
    {
      layer: 'Components',
      files: [
        {
          path: 'src/components/callout.tsx',
          source: 'changed',
          status: 'modified',
          additions: 12,
          deletions: 3,
          connects: [],
        },
      ],
    },
    {
      layer: 'Services',
      files: [
        {
          path: 'server/callout-service.ts',
          source: 'shipped',
          note: 'labels must match CALLOUT_TEMPLATES',
          connects: [],
        },
      ],
    },
  ],
}

// The legend counts and the note both contain a child element (a marker / the flag
// icon), so match on the element's own textContent rather than getByText's default
// node text (which skips elements that have element children).
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
    clearSpy.mockClear()
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
    vi.mocked(useFeatureView).mockReturnValue({ view, refresh: async () => {} })
  })

  it('arms then confirms a clear of the agent review set (two-step)', () => {
    renderList()
    // the label names its scope — the agent set, not the whole view
    const btn = screen.getByLabelText('Clear agent review set')
    fireEvent.click(btn) // first click only arms — does not clear
    expect(clearSpy).not.toHaveBeenCalled()
    // arming flips the label to its confirm state
    fireEvent.click(screen.getByLabelText('Confirm clear agent review set')) // confirm
    expect(clearSpy).toHaveBeenCalledTimes(1)
  })

  it('renders the feature name, flow-grouped files, and per-source counts', () => {
    renderList()
    expect(screen.getByText('Crew call-outs')).toBeInTheDocument()
    expect(screen.getByText('Components')).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('callout.tsx')).toBeInTheDocument()
    expect(screen.getByText('callout-service.ts')).toBeInTheDocument()
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByText(byTextContent('1 changed'))).toBeInTheDocument()
    expect(screen.getByText(byTextContent('1 shipped'))).toBeInTheDocument()
  })

  it('shows the agent note flagged on a shipped file', () => {
    renderList()
    expect(
      screen.getByText(byTextContent('labels must match CALLOUT_TEMPLATES')),
    ).toBeInTheDocument()
  })

  it('opens a working-tree diff tab for a changed file', () => {
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

  it('offers "Comment on file" from a flow node context menu', () => {
    renderList()
    fireEvent.contextMenu(screen.getByText('callout.tsx'))
    expect(screen.getByText('Comment on file')).toBeInTheDocument()
  })
})
