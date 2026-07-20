import { beforeEach, describe, expect, it } from 'vitest'
import { type Tab, tabId, useTabsStore } from './tabs'

const tab = (id: string): Tab => ({ id, kind: 'file', title: id, path: `/repo/${id}` })

const reset = (): void =>
  useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })

const pane = (index = 0) => useTabsStore.getState().panes[index]

describe('tabId', () => {
  it('namespaces a key by kind', () => {
    expect(tabId('file', '/repo/a.ts')).toBe('file:/repo/a.ts')
    expect(tabId('diff', 'src/a.ts')).toBe('diff:src/a.ts')
    expect(tabId('commit', 'abc123')).toBe('commit:abc123')
    expect(tabId('search', 'foo bar')).toBe('search:foo bar')
  })

  it('distinguishes the same key across kinds', () => {
    expect(tabId('file', 'a.ts')).not.toBe(tabId('diff', 'a.ts'))
  })
})

describe('useTabsStore', () => {
  beforeEach(reset)

  it('opens a tab and activates it', () => {
    useTabsStore.getState().openTab(tab('a'))
    expect(pane().tabs).toHaveLength(1)
    expect(pane().activeTabId).toBe('a')
  })

  it('does not duplicate an already open tab', () => {
    useTabsStore.getState().openTab(tab('a'))
    useTabsStore.getState().openTab(tab('a'))
    expect(pane().tabs).toHaveLength(1)
  })

  it('refreshes line and highlight when re-opening an already-open file tab', () => {
    const path = '/repo/src/a.ts'
    const id = tabId('file', path)
    useTabsStore.getState().openTab({
      id,
      kind: 'file',
      title: 'a.ts',
      path,
      line: 1,
      highlight: [{ start: 1, end: 2 }],
    })
    useTabsStore.getState().openTab({
      id,
      kind: 'file',
      title: 'a.ts',
      path,
      line: 10,
      highlight: [{ start: 10, end: 12 }],
    })
    expect(pane().tabs).toHaveLength(1)
    expect(pane().tabs[0]).toMatchObject({
      line: 10,
      highlight: [{ start: 10, end: 12 }],
    })
  })

  it('keeps a file and a diff of the same path as distinct tabs', () => {
    const path = '/repo/src/a.ts'
    useTabsStore.getState().openTab({ id: tabId('file', path), kind: 'file', title: 'a.ts', path })
    useTabsStore.getState().openTab({ id: tabId('diff', path), kind: 'diff', title: 'a.ts', path })
    expect(pane().tabs.map((t) => t.id)).toEqual(['file:/repo/src/a.ts', 'diff:/repo/src/a.ts'])
  })

  it('activates the neighbor when closing the active tab', () => {
    useTabsStore.getState().openTab(tab('a'))
    useTabsStore.getState().openTab(tab('b'))
    useTabsStore.getState().openTab(tab('c'))
    useTabsStore.getState().closeTab(0, 'c')
    expect(pane().activeTabId).toBe('b')
  })

  it('keeps the active tab when closing an inactive one', () => {
    useTabsStore.getState().openTab(tab('a'))
    useTabsStore.getState().openTab(tab('b'))
    useTabsStore.getState().closeTab(0, 'a')
    expect(pane().activeTabId).toBe('b')
  })

  it('clears activeTabId when the last tab closes', () => {
    useTabsStore.getState().openTab(tab('a'))
    useTabsStore.getState().closeTab(0, 'a')
    expect(pane().activeTabId).toBeNull()
    expect(pane().tabs).toHaveLength(0)
  })

  describe('preview', () => {
    it('replaces an existing preview tab with the next preview', () => {
      useTabsStore.getState().openTab({ ...tab('a'), preview: true })
      useTabsStore.getState().openTab({ ...tab('b'), preview: true })
      expect(pane().tabs.map((t) => t.id)).toEqual(['b'])
    })

    it('pins a preview tab across panes', () => {
      useTabsStore.getState().openTab({ ...tab('a'), preview: true })
      useTabsStore.getState().pinTab('a')
      expect(pane().tabs[0]?.preview).toBe(false)
    })
  })

  // Sticky pin: pinned tabs reorder to the front of the pane; unpinned scroll in the
  // tab bar. Distinct from pinTab (which only clears the preview flag).
  describe('sticky pin', () => {
    it('moves a tab to the end of the pinned group and clears preview', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTab({ ...tab('b'), preview: true })
      useTabsStore.getState().openTab(tab('c'))
      useTabsStore.getState().togglePinned(0, 'c')
      expect(pane().tabs.map((t) => t.id)).toEqual(['c', 'a', 'b'])
      expect(pane().tabs[0]).toMatchObject({ id: 'c', pinned: true, preview: false })
      expect(
        pane()
          .tabs.filter((t) => t.pinned)
          .map((t) => t.id),
      ).toEqual(['c'])
    })

    it('stacks multiple pins in pin order and unpins to the front of unpinned', () => {
      for (const id of ['a', 'b', 'c', 'd']) {
        useTabsStore.getState().openTab(tab(id))
      }
      useTabsStore.getState().togglePinned(0, 'b')
      useTabsStore.getState().togglePinned(0, 'd')
      expect(pane().tabs.map((t) => t.id)).toEqual(['b', 'd', 'a', 'c'])
      useTabsStore.getState().togglePinned(0, 'b')
      expect(pane().tabs.map((t) => t.id)).toEqual(['d', 'b', 'a', 'c'])
      expect(pane().tabs.find((t) => t.id === 'b')?.pinned).toBe(false)
    })

    it('is a no-op for an unknown tab', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().togglePinned(0, 'zzz')
      expect(pane().tabs.map((t) => t.id)).toEqual(['a'])
    })

    it('closeUnpinnedTabs keeps sticky pins and activates the last survivor', () => {
      for (const id of ['a', 'b', 'c', 'd']) {
        useTabsStore.getState().openTab(tab(id))
      }
      useTabsStore.getState().togglePinned(0, 'b')
      useTabsStore.getState().togglePinned(0, 'd')
      useTabsStore.getState().activateTab(0, 'a')
      useTabsStore.getState().closeUnpinnedTabs(0)
      expect(pane().tabs.map((t) => t.id)).toEqual(['b', 'd'])
      expect(pane().activeTabId).toBe('d')
    })

    it('closeUnpinnedTabs is a no-op when every tab is pinned', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().togglePinned(0, 'a')
      useTabsStore.getState().closeUnpinnedTabs(0)
      expect(pane().tabs.map((t) => t.id)).toEqual(['a'])
      expect(pane().activeTabId).toBe('a')
    })

    it('closeUnpinnedTabs leaves an empty pane when nothing is pinned', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTab(tab('b'))
      useTabsStore.getState().closeUnpinnedTabs(0)
      expect(pane().tabs).toHaveLength(0)
      expect(pane().activeTabId).toBeNull()
    })

    it('scopes sticky pin to one pane', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTabToSide(tab('a'))
      useTabsStore.getState().togglePinned(0, 'a')
      expect(pane(0).tabs[0]?.pinned).toBe(true)
      expect(pane(1).tabs[0]?.pinned).toBeUndefined()
    })
  })

  describe('bulk closing', () => {
    beforeEach(() => {
      for (const id of ['a', 'b', 'c', 'd']) {
        useTabsStore.getState().openTab(tab(id))
      }
    })

    it('closes other tabs and keeps the anchor active when the active tab closed', () => {
      useTabsStore.getState().activateTab(0, 'd')
      useTabsStore.getState().closeOtherTabs(0, 'b')
      expect(pane().tabs.map((t) => t.id)).toEqual(['b'])
      expect(pane().activeTabId).toBe('b')
    })

    it('closes tabs to the left of the anchor', () => {
      useTabsStore.getState().activateTab(0, 'a')
      useTabsStore.getState().closeTabsToLeft(0, 'c')
      expect(pane().tabs.map((t) => t.id)).toEqual(['c', 'd'])
      expect(pane().activeTabId).toBe('c')
    })

    it('closes tabs to the right of the anchor', () => {
      useTabsStore.getState().activateTab(0, 'd')
      useTabsStore.getState().closeTabsToRight(0, 'b')
      expect(pane().tabs.map((t) => t.id)).toEqual(['a', 'b'])
      expect(pane().activeTabId).toBe('b')
    })

    it('keeps the active tab when it survives a bulk close', () => {
      useTabsStore.getState().activateTab(0, 'd')
      useTabsStore.getState().closeTabsToLeft(0, 'c')
      expect(pane().activeTabId).toBe('d')
    })

    it('closes all tabs', () => {
      useTabsStore.getState().closeAllTabs()
      expect(useTabsStore.getState().panes).toHaveLength(1)
      expect(pane().tabs).toHaveLength(0)
      expect(pane().activeTabId).toBeNull()
    })

    it('ignores bulk close for an unknown tab', () => {
      useTabsStore.getState().closeOtherTabs(0, 'zzz')
      expect(pane().tabs).toHaveLength(4)
    })
  })

  // closeTabEverywhere drops a tab id from every pane at once — used when its source
  // is gone (terminal killed, file's diff discarded) and the caller has the id, not a
  // pane. It activates a neighbor and collapses an emptied split like a normal close.
  describe('closeTabEverywhere', () => {
    it('removes the tab from both panes and collapses the emptied split', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTab(tab('shared'))
      useTabsStore.getState().openTabToSide(tab('shared'))
      // 'shared' now lives in both panes (a file clones across a split)
      expect(pane(0).tabs.map((t) => t.id)).toEqual(['a', 'shared'])
      expect(pane(1).tabs.map((t) => t.id)).toEqual(['shared'])
      useTabsStore.getState().closeTabEverywhere('shared')
      // pane 1 emptied → split collapses; pane 0 keeps 'a'
      expect(useTabsStore.getState().panes).toHaveLength(1)
      expect(pane(0).tabs.map((t) => t.id)).toEqual(['a'])
      expect(pane(0).activeTabId).toBe('a')
    })

    it('is a no-op for a tab that is not open', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().closeTabEverywhere('zzz')
      expect(pane().tabs.map((t) => t.id)).toEqual(['a'])
    })
  })

  describe('split panes', () => {
    it('opens a second pane to the side and focuses it', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTabToSide(tab('b'))
      expect(useTabsStore.getState().panes).toHaveLength(2)
      expect(useTabsStore.getState().activePaneIndex).toBe(1)
      expect(pane(0).tabs.map((t) => t.id)).toEqual(['a'])
      expect(pane(1).tabs.map((t) => t.id)).toEqual(['b'])
    })

    it('routes subsequent opens to the active pane', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTabToSide(tab('b'))
      useTabsStore.getState().openTab(tab('c'))
      expect(pane(0).tabs.map((t) => t.id)).toEqual(['a'])
      expect(pane(1).tabs.map((t) => t.id)).toEqual(['b', 'c'])
    })

    it('opens into the existing other pane when already split', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTabToSide(tab('b'))
      useTabsStore.getState().setActivePane(0)
      useTabsStore.getState().openTabToSide(tab('c'))
      expect(useTabsStore.getState().panes).toHaveLength(2)
      expect(pane(1).tabs.map((t) => t.id)).toEqual(['b', 'c'])
      expect(useTabsStore.getState().activePaneIndex).toBe(1)
    })

    it('collapses the split when the second pane empties', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTabToSide(tab('b'))
      useTabsStore.getState().closeTab(1, 'b')
      expect(useTabsStore.getState().panes).toHaveLength(1)
      expect(pane(0).tabs.map((t) => t.id)).toEqual(['a'])
      expect(useTabsStore.getState().activePaneIndex).toBe(0)
    })

    it('promotes the surviving pane when the first pane empties', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTabToSide(tab('b'))
      useTabsStore.getState().closeTab(0, 'a')
      expect(useTabsStore.getState().panes).toHaveLength(1)
      expect(pane(0).tabs.map((t) => t.id)).toEqual(['b'])
      expect(useTabsStore.getState().activePaneIndex).toBe(0)
    })

    it('cycles tabs within the active pane only', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().openTab(tab('b'))
      useTabsStore.getState().openTabToSide(tab('c'))
      useTabsStore.getState().cycleTab(1)
      // active pane is the second one, which has a single tab → no change
      expect(pane(1).activeTabId).toBe('c')
      useTabsStore.getState().setActivePane(0)
      useTabsStore.getState().activateTab(0, 'a')
      useTabsStore.getState().cycleTab(1)
      expect(pane(0).activeTabId).toBe('b')
    })
  })

  // A terminal is one xterm instance, so it can live in only one pane — opening it to
  // the side MOVES it (a generic tab is cloned), and re-opening an already-open one
  // activates it in place. Otherwise a duplicate would blank one pane's terminal.
  describe('terminal panes', () => {
    const term = (id: string): Tab => ({ id, kind: 'terminal', title: id, path: id })

    it('moves a terminal to the side instead of cloning it', () => {
      useTabsStore.getState().openTab(term('t1'))
      useTabsStore.getState().openTab(term('t2'))
      useTabsStore.getState().openTabToSide(term('t2'))
      expect(useTabsStore.getState().panes).toHaveLength(2)
      expect(pane(0).tabs.map((t) => t.id)).toEqual(['t1'])
      expect(pane(1).tabs.map((t) => t.id)).toEqual(['t2'])
      expect(useTabsStore.getState().activePaneIndex).toBe(1)
    })

    it('activates an already-open terminal in place rather than duplicating it', () => {
      useTabsStore.getState().openTab(term('t1'))
      useTabsStore.getState().openTabToSide(term('t2'))
      // focus the left pane, then re-open t2 (e.g. from the roster) — it stays in pane 1
      useTabsStore.getState().setActivePane(0)
      useTabsStore.getState().openTab(term('t2'))
      expect(pane(0).tabs.map((t) => t.id)).toEqual(['t1'])
      expect(pane(1).tabs.map((t) => t.id)).toEqual(['t2'])
      expect(useTabsStore.getState().activePaneIndex).toBe(1)
    })
  })

  // Renaming a session in the roster retitles its open terminal tab(s) — matched by
  // kind 'terminal' and path === session id — across both panes; other tabs untouched.
  describe('retitleTerminalTab', () => {
    it('retitles the session tab in every pane and leaves others untouched', () => {
      useTabsStore.setState({
        panes: [
          {
            tabs: [
              { id: 'file:x', kind: 'file', title: 'x', path: 'sid' },
              { id: 'terminal:sid', kind: 'terminal', title: 'zsh', path: 'sid' },
            ],
            activeTabId: 'terminal:sid',
          },
          {
            tabs: [{ id: 'terminal:sid', kind: 'terminal', title: 'zsh', path: 'sid' }],
            activeTabId: 'terminal:sid',
          },
        ],
        activePaneIndex: 0,
      })
      useTabsStore.getState().retitleTerminalTab('sid', 'dev server')
      expect(pane(0).tabs.map((t) => t.title)).toEqual(['x', 'dev server'])
      expect(pane(1).tabs.map((t) => t.title)).toEqual(['dev server'])
    })

    it('is a no-op when no terminal tab matches the session', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().retitleTerminalTab('sid', 'dev server')
      expect(pane().tabs.map((t) => t.title)).toEqual(['a'])
    })
  })

  // When a thread's auto-title lands, its open agent tab(s) — matched by kind 'agent' and
  // path === thread id — retitle across both panes; other tabs untouched.
  describe('retitleAgentTab', () => {
    it('retitles the thread tab in every pane and leaves others untouched', () => {
      useTabsStore.setState({
        panes: [
          {
            tabs: [
              { id: 'file:x', kind: 'file', title: 'x', path: 'tid' },
              { id: 'agent:tid', kind: 'agent', title: 'New thread', path: 'tid' },
            ],
            activeTabId: 'agent:tid',
          },
          {
            tabs: [{ id: 'agent:tid', kind: 'agent', title: 'New thread', path: 'tid' }],
            activeTabId: 'agent:tid',
          },
        ],
        activePaneIndex: 0,
      })
      useTabsStore.getState().retitleAgentTab('tid', 'Fix login bug')
      expect(pane(0).tabs.map((t) => t.title)).toEqual(['x', 'Fix login bug'])
      expect(pane(1).tabs.map((t) => t.title)).toEqual(['Fix login bug'])
    })

    it('is a no-op when no agent tab matches the thread', () => {
      useTabsStore.getState().openTab(tab('a'))
      useTabsStore.getState().retitleAgentTab('tid', 'Fix login bug')
      expect(pane().tabs.map((t) => t.title)).toEqual(['a'])
    })
  })
})
