import type { FlowGroup } from '@main/flow'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangesList } from './changes-list'

// Same convention as history-list: mock the domain hooks, never tRPC. useGitFlow
// hands back grouped flow data shaped exactly like the real gitFlow result; the
// diff-prefetch hook is a no-op since hover prefetching is irrelevant here.
vi.mock('@renderer/hooks/use-git-flow', () => ({ useGitFlow: vi.fn() }))
vi.mock('@renderer/hooks/use-diff', () => ({ useDiffFilePrefetch: () => async () => {} }))
vi.mock('@renderer/hooks/use-commit', () => ({
  useFileStaging: () => ({ stageFile: async () => {}, unstageFile: async () => {} }),
}))

const groups: FlowGroup[] = [
  {
    layer: 'Components',
    files: [
      {
        path: 'src/components/widget.tsx',
        status: 'modified',
        connects: [],
        additions: 12,
        deletions: 3,
        staged: false,
        unstaged: true,
      },
    ],
  },
  {
    layer: 'Data',
    files: [
      {
        path: 'src/db/schema.ts',
        status: 'added',
        connects: [],
        additions: 40,
        deletions: 0,
        staged: true,
        unstaged: false,
      },
      {
        path: 'src/db/legacy.ts',
        status: 'deleted',
        connects: [],
        additions: 0,
        deletions: 18,
        staged: false,
        unstaged: true,
      },
    ],
  },
]

function renderList(): void {
  render(
    <SidebarProvider>
      <ChangesList />
    </SidebarProvider>,
  )
}

describe('ChangesList', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
    usePreferencesStore.setState({ sidebarTab: 'changes' })
    vi.mocked(useGitFlow).mockReturnValue({ groups, refresh: async () => {} })
  })

  it('renders each layer group with its files and +adds/−dels', () => {
    renderList()
    expect(screen.getByText('Components')).toBeInTheDocument()
    expect(screen.getByText('Data')).toBeInTheDocument()
    expect(screen.getByText('widget.tsx')).toBeInTheDocument()
    expect(screen.getByText('schema.ts')).toBeInTheDocument()
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByText('−3')).toBeInTheDocument()
  })

  it('marks staged files with an indicator and leaves unstaged ones bare', () => {
    renderList()
    // schema.ts is staged (staged: true, unstaged: false) → "Staged" dot.
    expect(screen.getByTitle('Staged')).toBeInTheDocument()
    // widget.tsx is unstaged only → no indicator at all.
    expect(screen.queryByTitle('Partially staged')).not.toBeInTheDocument()
  })

  it('opens a diff tab keyed by path when a file row is clicked', () => {
    renderList()
    screen.getByText('widget.tsx').click()

    const path = 'src/components/widget.tsx'
    const { tabs, activeTabId } = useTabsStore.getState().panes[0]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ id: tabId('diff', path), kind: 'diff', path })
    expect(activeTabId).toBe(tabId('diff', path))
  })

  it('"Open file" opens the full file at its absolute path and switches to Files', async () => {
    renderList()
    fireEvent.contextMenu(screen.getByText('widget.tsx'))
    fireEvent.click(await screen.findByText('Open file'))

    const absolute = '/repo/src/components/widget.tsx'
    const { tabs, activeTabId } = useTabsStore.getState().panes[0]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ id: tabId('file', absolute), kind: 'file', path: absolute })
    expect(activeTabId).toBe(tabId('file', absolute))
    expect(usePreferencesStore.getState().sidebarTab).toBe('files')
  })

  it('omits "Open file" for a deleted file (it no longer exists on disk)', async () => {
    renderList()
    fireEvent.contextMenu(screen.getByText('legacy.ts'))
    // Stage is present (the file is unstaged), so the menu opened — but Open file isn't.
    expect(await screen.findByText('Stage')).toBeInTheDocument()
    expect(screen.queryByText('Open file')).not.toBeInTheDocument()
  })
})
