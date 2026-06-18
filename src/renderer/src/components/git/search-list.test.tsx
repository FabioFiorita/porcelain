import type { CodeSearchResult } from '@main/git'
import { useCodeSearch } from '@renderer/hooks/use-search'
import { useRepoStore } from '@renderer/stores/repo'
import { useSearchStore } from '@renderer/stores/search'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchList } from './search-list'

// Mock the domain hook — never tRPC. useCodeSearch feeds result data.
vi.mock('@renderer/hooks/use-search', () => ({ useCodeSearch: vi.fn() }))

// Base UI's Collapsible measures its panel via ResizeObserver; jsdom lacks it.
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

const result: CodeSearchResult = {
  truncated: false,
  files: [
    {
      path: 'src/foo/bar.ts',
      matchCount: 1,
      hunks: [
        {
          lines: [
            { line: 41, text: 'function bar() {', match: false },
            { line: 42, text: '  const r = doThing()', match: true },
            { line: 43, text: '}', match: false },
          ],
        },
      ],
    },
  ],
}

describe('SearchList', () => {
  beforeEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    useRepoStore.setState({ repo: { path: '/myrepo', name: 'myrepo' } })
    useSearchStore.setState({
      query: '',
      regex: false,
      caseSensitive: false,
      showFilters: false,
      include: '',
      exclude: '',
      recent: [],
    })
    vi.mocked(useCodeSearch).mockReturnValue({ result: undefined, error: null, isFetching: false })
  })

  it('prompts before a query is entered', () => {
    render(<SearchList />)
    expect(screen.getByText(/Search the repository/)).toBeInTheDocument()
  })

  it('renders the match grouped under its file and opens it at the line on click', () => {
    vi.mocked(useCodeSearch).mockReturnValue({ result, error: null, isFetching: false })
    useSearchStore.setState({ query: 'doThing' })
    render(<SearchList />)

    expect(screen.getByText('bar.ts')).toBeInTheDocument()
    expect(screen.getByText('1 result in 1 file')).toBeInTheDocument()

    screen.getByText('doThing').closest('button')?.click()

    const { tabs, activeTabId } = useTabsStore.getState().panes[0]
    expect(tabs[0]).toMatchObject({
      id: tabId('file', '/myrepo/src/foo/bar.ts'),
      kind: 'file',
      path: '/myrepo/src/foo/bar.ts',
      line: 42,
    })
    expect(activeTabId).toBe(tabId('file', '/myrepo/src/foo/bar.ts'))
  })

  it('shows "No results" when the search returns nothing', () => {
    vi.mocked(useCodeSearch).mockReturnValue({
      result: { files: [], truncated: false },
      error: null,
      isFetching: false,
    })
    useSearchStore.setState({ query: 'doThing' })
    render(<SearchList />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('shows the error message (e.g. an invalid regex)', () => {
    vi.mocked(useCodeSearch).mockReturnValue({
      result: undefined,
      error: { message: 'invalid regex' },
      isFetching: false,
    })
    useSearchStore.setState({ query: 'doThing' })
    render(<SearchList />)
    expect(screen.getByText('invalid regex')).toBeInTheDocument()
  })

  it('toggles regex mode via the toolbar button', () => {
    render(<SearchList />)
    expect(useSearchStore.getState().regex).toBe(false)
    screen.getByLabelText('Use regular expression').click()
    expect(useSearchStore.getState().regex).toBe(true)
  })
})
