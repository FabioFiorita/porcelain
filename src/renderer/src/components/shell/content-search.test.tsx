import type { GrepMatch } from '@main/diff'
import { useTextSearch } from '@renderer/hooks/use-search'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentSearch } from './content-search'

// Mock the domain hook — never tRPC. useTextSearch feeds match data.
vi.mock('@renderer/hooks/use-search', () => ({ useTextSearch: vi.fn() }))

// cmdk uses ResizeObserver and scrollIntoView internally; jsdom doesn't ship them.
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}
// cmdk calls scrollIntoView on the selected item; stub it on the prototype.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = (): void => {}
}

const matches: GrepMatch[] = [
  { path: 'src/foo/bar.ts', line: 42, text: '  const result = doThing()' },
  { path: 'src/baz.tsx', line: 7, text: 'export function doThing()' },
]

function openDialog(): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'KeyF', shiftKey: true, metaKey: true, bubbles: true }),
  )
}

describe('ContentSearch', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: '/myrepo', name: 'myrepo' } })
    vi.mocked(useTextSearch).mockReturnValue({ matches: undefined, error: null, isFetching: false })
  })

  it('renders match rows with path:line + trimmed text after Cmd+Shift+F', async () => {
    vi.mocked(useTextSearch).mockReturnValue({ matches, error: null, isFetching: false })
    render(<ContentSearch />)
    openDialog()

    expect(await screen.findByText('src/foo/bar.ts:42')).toBeInTheDocument()
    expect(screen.getByText('const result = doThing()')).toBeInTheDocument()
    expect(screen.getByText('src/baz.tsx:7')).toBeInTheDocument()
    expect(screen.getByText('export function doThing()')).toBeInTheDocument()
  })

  it('opens the dialog on Cmd+Shift+F', async () => {
    render(<ContentSearch />)
    openDialog()
    expect(await screen.findByPlaceholderText('Search in files…')).toBeInTheDocument()
  })

  it('closes the dialog on a second Cmd+Shift+F', async () => {
    render(<ContentSearch />)
    openDialog()
    await screen.findByPlaceholderText('Search in files…')
    openDialog()
    // Wait for the dialog to be removed from the DOM (Base UI removes after exit animation)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search in files…')).not.toBeInTheDocument()
    })
  })

  it('shows no affordance while the query is empty', async () => {
    vi.mocked(useTextSearch).mockReturnValue({ matches: undefined, error: null, isFetching: true })
    render(<ContentSearch />)
    openDialog()
    await screen.findByPlaceholderText('Search in files…')
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument()
    expect(screen.queryByText('No matches')).not.toBeInTheDocument()
  })

  it('shows "Searching…" once a query is entered and a fetch is in flight', async () => {
    vi.mocked(useTextSearch).mockReturnValue({ matches: undefined, error: null, isFetching: true })
    render(<ContentSearch />)
    openDialog()
    const input = await screen.findByPlaceholderText('Search in files…')
    fireEvent.change(input, { target: { value: 'doThing' } })
    expect(await screen.findByText('Searching…')).toBeInTheDocument()
  })

  it('shows "No matches" once a query is entered and the search returns empty', async () => {
    vi.mocked(useTextSearch).mockReturnValue({ matches: [], error: null, isFetching: false })
    render(<ContentSearch />)
    openDialog()
    const input = await screen.findByPlaceholderText('Search in files…')
    fireEvent.change(input, { target: { value: 'doThing' } })
    expect(await screen.findByText('No matches')).toBeInTheDocument()
  })

  it('shows error message when error is returned', async () => {
    vi.mocked(useTextSearch).mockReturnValue({
      matches: undefined,
      error: { message: 'git grep failed: exit 2' },
      isFetching: false,
    })
    render(<ContentSearch />)
    openDialog()
    expect(await screen.findByText('git grep failed: exit 2')).toBeInTheDocument()
  })

  it('selecting a match opens a file tab at the absolute path with line', async () => {
    vi.mocked(useTextSearch).mockReturnValue({ matches, error: null, isFetching: false })
    render(<ContentSearch />)
    openDialog()

    const item = await screen.findByText('src/foo/bar.ts:42')
    item.click()

    const { tabs, activeTabId } = useTabsStore.getState().panes[0]
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({
      id: tabId('file', '/myrepo/src/foo/bar.ts'),
      kind: 'file',
      path: '/myrepo/src/foo/bar.ts',
      line: 42,
    })
    expect(activeTabId).toBe(tabId('file', '/myrepo/src/foo/bar.ts'))
  })
})
