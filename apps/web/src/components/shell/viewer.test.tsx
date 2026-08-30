import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Viewer } from './viewer'

vi.mock('@renderer/components/git/diff-view', () => ({
  DiffView: ({ filePath }: { filePath: string }) => <div data-testid="lazy-diff">{filePath}</div>,
}))
vi.mock('@renderer/components/git/commit-view', () => ({
  CommitView: ({ hash }: { hash: string }) => <div data-testid="lazy-commit">{hash}</div>,
}))
vi.mock('@renderer/components/git/changeset-view', () => ({
  ChangesetView: ({ path }: { path: string }) => <div data-testid="lazy-changeset">{path}</div>,
}))
vi.mock('@renderer/components/viewer/search-view', () => ({
  SearchView: ({ query }: { query: string }) => <div data-testid="lazy-search">{query}</div>,
}))
vi.mock('@renderer/components/viewer/file-content', () => ({
  FileContent: ({ path }: { path: string }) => <div data-testid="lazy-file">{path}</div>,
}))
vi.mock('@renderer/features/projects/canvas-view', () => ({
  CanvasView: ({ canvasId }: { canvasId: string }) => (
    <div data-testid="lazy-canvas">{canvasId}</div>
  ),
}))

describe('Viewer empty landing', () => {
  beforeEach(() => {
    useTabsStore.getState().closeAllTabs()
  })

  it('shows one empty state for every no-tab landing', () => {
    render(<Viewer />)
    const empty = screen.getByTestId(TestIds.viewerEmpty)
    expect(empty).toHaveAttribute('data-slot', 'empty')
    expect(empty).toHaveTextContent('Open a surface to get started')
    expect(empty).toHaveTextContent('Choose one from the Surfaces rail.')
    expect(screen.queryByTestId(TestIds.glance)).toBeNull()
    expect(screen.queryByTestId(TestIds.hubHome)).toBeNull()
    expect(screen.queryByTestId(TestIds.hubProjectSummary)).toBeNull()
  })

  it.each([
    ['diff', 'lazy-diff'],
    ['commit', 'lazy-commit'],
    ['changeset', 'lazy-changeset'],
    ['search', 'lazy-search'],
    ['file', 'lazy-file'],
    ['canvas', 'lazy-canvas'],
  ] as const)('loads the %s tab surface through its lazy boundary', async (kind, testId) => {
    useTabsStore.getState().openTab({
      id: `test-${kind}`,
      kind,
      title: kind,
      path: `${kind}-path`,
      ...(kind === 'canvas'
        ? {
            target: {
              environmentId: 'local',
              projectId: 'project-1',
              worktreeId: 'worktree-1',
              path: '/repo',
            },
          }
        : {}),
    })

    render(<Viewer />)

    expect(await screen.findByTestId(testId)).toHaveTextContent(`${kind}-path`)
  })
})
