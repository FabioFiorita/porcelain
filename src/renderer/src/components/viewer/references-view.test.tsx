import type { SymbolLocation } from '@main/lsp'
import { useReferencesQuery } from '@renderer/hooks/use-lsp'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReferencesView } from './references-view'

// Same convention as history-list / changes-list: mock the domain hook, never
// tRPC. useReferencesQuery hands back SymbolLocation[] shaped like the real
// lspReferences result so type drift breaks the build.
vi.mock('@renderer/hooks/use-lsp', () => ({
  useReferencesQuery: vi.fn(),
  useLspEnabledFor: vi.fn(() => true),
}))

const REPO = '/repo'

// Two refs in widget.ts, one in helper.ts — covers grouping by file and counts.
const references: SymbolLocation[] = [
  { path: `${REPO}/src/widget.ts`, line: 4, character: 9, endLine: 4, endCharacter: 15 },
  { path: `${REPO}/src/widget.ts`, line: 20, character: 2, endLine: 20, endCharacter: 8 },
  { path: `${REPO}/src/helper.ts`, line: 0, character: 6, endLine: 0, endCharacter: 12 },
]

function renderView(): void {
  render(<ReferencesView path={`${REPO}/src/widget.ts`} line={4} character={9} />)
}

describe('ReferencesView', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
    vi.mocked(useReferencesQuery).mockReturnValue({ references, isLoading: false })
  })

  it('renders the total count and groups references by file', () => {
    renderView()
    expect(screen.getByText('3 references in 2 files')).toBeInTheDocument()
    // file group headers show the basename of each referenced file (widget.ts also
    // appears in the view header — the seed path — so both occurrences exist)
    expect(screen.getAllByText('widget.ts').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('helper.ts')).toBeInTheDocument()
    // each reference row renders its 1-based column; the two widget.ts refs and the
    // one helper.ts ref all show
    expect(screen.getByText('column 10')).toBeInTheDocument()
    expect(screen.getByText('column 3')).toBeInTheDocument()
    expect(screen.getByText('column 7')).toBeInTheDocument()
  })

  it('opens the file at the 1-based reference line when a row is clicked', () => {
    renderView()
    // the helper.ts reference is at 0-based line 0 → opens at 1-based line 1
    screen.getByText('column 7').click()

    const { tabs, activeTabId } = useTabsStore.getState().panes[0]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({
      id: tabId('file', `${REPO}/src/helper.ts`),
      kind: 'file',
      path: `${REPO}/src/helper.ts`,
      line: 1,
    })
    expect(activeTabId).toBe(tabId('file', `${REPO}/src/helper.ts`))
  })

  it('shows the empty state when there are no references', () => {
    vi.mocked(useReferencesQuery).mockReturnValue({ references: [], isLoading: false })
    renderView()
    expect(screen.getByText('No references')).toBeInTheDocument()
  })
})
