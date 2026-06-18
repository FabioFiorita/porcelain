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
})
