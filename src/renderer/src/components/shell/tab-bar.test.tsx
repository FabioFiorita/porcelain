import { type Tab, useTabsStore } from '@renderer/stores/tabs'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TabBar } from './tab-bar'

// jsdom has no layout engine, so scrollIntoView is undefined by default — stub it
// and assert the active-tab effect calls it (the real horizontal scroll can't be
// observed here, only that the effect fires on activation change).
const scrollIntoView = vi.fn()

function tab(id: string, title: string, extra: Partial<Tab> = {}): Tab {
  return { id, kind: 'file', title, path: id, ...extra }
}

describe('TabBar', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView
    scrollIntoView.mockClear()
    useTabsStore.setState({
      panes: [
        {
          tabs: [tab('file:a', 'alpha'), tab('file:b', 'beta')],
          activeTabId: 'file:a',
        },
      ],
      activePaneIndex: 0,
    })
  })

  afterEach(() => {
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
  })

  it('scrolls the active tab into view on mount', () => {
    render(<TabBar paneIndex={0} />)
    expect(scrollIntoView).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' })
  })

  it('scrolls the newly activated tab into view when the active tab changes', () => {
    render(<TabBar paneIndex={0} />)
    scrollIntoView.mockClear()

    act(() => useTabsStore.getState().activateTab(0, 'file:b'))
    expect(scrollIntoView).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' })
  })

  it('marks sticky-pinned tabs with data-pinned', () => {
    useTabsStore.setState({
      panes: [
        {
          tabs: [
            tab('file:agent', 'Agent', { pinned: true }),
            tab('file:a', 'alpha'),
            tab('file:b', 'beta'),
          ],
          activeTabId: 'file:a',
        },
      ],
      activePaneIndex: 0,
    })
    render(<TabBar paneIndex={0} />)
    expect(screen.getByRole('tab', { name: /Agent/i })).toHaveAttribute('data-pinned', 'true')
    expect(screen.getByRole('tab', { name: /alpha/i })).not.toHaveAttribute('data-pinned')
  })
})
