import { useGitBranches } from '@renderer/features/git'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UPSTREAM_COMPARE_BASE } from '@porcelain/contracts/git'
import { ChangesBasePicker } from './changes-base-picker'

vi.mock('@renderer/features/git', () => ({ useGitBranches: vi.fn() }))

// cmdk calls scrollIntoView on the selected item; jsdom doesn't ship it (the
// ResizeObserver it also needs is stubbed once, in the shared test setup).
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = (): void => {}
}

function open(): void {
  fireEvent.click(screen.getByTestId(TestIds.changesBasePicker))
}

describe('ChangesBasePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useGitBranches).mockReturnValue({
      branches: [
        { name: 'main', remote: null },
        { name: 'develop', remote: null },
        { name: 'release', remote: 'origin' },
      ],
      isFetching: false,
      refresh: vi.fn(),
    })
  })

  const picker = (props: Partial<Parameters<typeof ChangesBasePicker>[0]> = {}) => (
    <ChangesBasePicker
      repoPath="/repo"
      selected="origin/main"
      defaultBase="origin/main"
      requested={undefined}
      onSelect={vi.fn()}
      {...props}
    />
  )

  it('labels itself with the base actually measured against', () => {
    render(picker({ selected: 'develop', requested: 'develop' }))

    expect(screen.getByTestId(TestIds.changesBasePicker)).toHaveTextContent('vs develop')
  })

  it('offers the default, the upstream, and both kinds of branch', () => {
    render(picker())
    open()

    expect(screen.getByTestId(TestIds.changesBaseOption('origin/main'))).toHaveTextContent(
      'default',
    )
    expect(screen.getByTestId(TestIds.changesBaseOption(UPSTREAM_COMPARE_BASE))).toHaveTextContent(
      'Upstream',
    )
    expect(screen.getByTestId(TestIds.changesBaseOption('develop'))).toBeInTheDocument()
    expect(screen.getByTestId(TestIds.changesBaseOption('origin/release'))).toBeInTheDocument()
  })

  it('reports a chosen ref so the caller can re-query against it', () => {
    const onSelect = vi.fn()
    render(picker({ onSelect }))
    open()

    fireEvent.click(screen.getByTestId(TestIds.changesBaseOption('develop')))

    expect(onSelect).toHaveBeenCalledWith('develop')
  })

  it('CLEARS the pick when the default is chosen, so it keeps following a moving default', () => {
    const onSelect = vi.fn()
    render(picker({ onSelect, requested: 'develop', selected: 'develop' }))
    open()

    fireEvent.click(screen.getByTestId(TestIds.changesBaseOption('origin/main')))

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('marks the ref that was asked for, not the one being read', () => {
    // A pick that no longer resolves: the daemon fell back to the default, so the
    // label reads the truth while the check still shows what was requested.
    render(picker({ requested: 'gone', selected: 'origin/main' }))
    open()

    expect(screen.getByTestId(TestIds.changesBaseOption('origin/main'))).toHaveTextContent(
      'default',
    )
    expect(screen.queryByTestId(TestIds.changesBaseOption('gone'))).toBeNull()
  })
})
