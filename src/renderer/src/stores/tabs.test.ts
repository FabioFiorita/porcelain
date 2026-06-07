import { beforeEach, describe, expect, it } from 'vitest'
import { type Tab, tabId, useTabsStore } from './tabs'

const tab = (id: string): Tab => ({ id, kind: 'file', title: id, path: `/repo/${id}` })

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
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('opens a tab and activates it', () => {
    useTabsStore.getState().openTab(tab('a'))
    expect(useTabsStore.getState().tabs).toHaveLength(1)
    expect(useTabsStore.getState().activeTabId).toBe('a')
  })

  it('does not duplicate an already open tab', () => {
    useTabsStore.getState().openTab(tab('a'))
    useTabsStore.getState().openTab(tab('a'))
    expect(useTabsStore.getState().tabs).toHaveLength(1)
  })

  it('keeps a file and a diff of the same path as distinct tabs', () => {
    const path = '/repo/src/a.ts'
    useTabsStore.getState().openTab({ id: tabId('file', path), kind: 'file', title: 'a.ts', path })
    useTabsStore.getState().openTab({ id: tabId('diff', path), kind: 'diff', title: 'a.ts', path })
    expect(useTabsStore.getState().tabs.map((t) => t.id)).toEqual([
      'file:/repo/src/a.ts',
      'diff:/repo/src/a.ts',
    ])
  })

  it('activates the neighbor when closing the active tab', () => {
    useTabsStore.getState().openTab(tab('a'))
    useTabsStore.getState().openTab(tab('b'))
    useTabsStore.getState().openTab(tab('c'))
    useTabsStore.getState().closeTab('c')
    expect(useTabsStore.getState().activeTabId).toBe('b')
  })

  it('keeps the active tab when closing an inactive one', () => {
    useTabsStore.getState().openTab(tab('a'))
    useTabsStore.getState().openTab(tab('b'))
    useTabsStore.getState().closeTab('a')
    expect(useTabsStore.getState().activeTabId).toBe('b')
  })

  it('clears activeTabId when the last tab closes', () => {
    useTabsStore.getState().openTab(tab('a'))
    useTabsStore.getState().closeTab('a')
    expect(useTabsStore.getState().activeTabId).toBeNull()
    expect(useTabsStore.getState().tabs).toHaveLength(0)
  })

  describe('bulk closing', () => {
    beforeEach(() => {
      for (const id of ['a', 'b', 'c', 'd']) {
        useTabsStore.getState().openTab(tab(id))
      }
    })

    it('closes other tabs and keeps the anchor active when the active tab closed', () => {
      useTabsStore.getState().activateTab('d')
      useTabsStore.getState().closeOtherTabs('b')
      expect(useTabsStore.getState().tabs.map((t) => t.id)).toEqual(['b'])
      expect(useTabsStore.getState().activeTabId).toBe('b')
    })

    it('closes tabs to the left of the anchor', () => {
      useTabsStore.getState().activateTab('a')
      useTabsStore.getState().closeTabsToLeft('c')
      expect(useTabsStore.getState().tabs.map((t) => t.id)).toEqual(['c', 'd'])
      expect(useTabsStore.getState().activeTabId).toBe('c')
    })

    it('closes tabs to the right of the anchor', () => {
      useTabsStore.getState().activateTab('d')
      useTabsStore.getState().closeTabsToRight('b')
      expect(useTabsStore.getState().tabs.map((t) => t.id)).toEqual(['a', 'b'])
      expect(useTabsStore.getState().activeTabId).toBe('b')
    })

    it('keeps the active tab when it survives a bulk close', () => {
      useTabsStore.getState().activateTab('d')
      useTabsStore.getState().closeTabsToLeft('c')
      expect(useTabsStore.getState().activeTabId).toBe('d')
    })

    it('closes all tabs', () => {
      useTabsStore.getState().closeAllTabs()
      expect(useTabsStore.getState().tabs).toHaveLength(0)
      expect(useTabsStore.getState().activeTabId).toBeNull()
    })

    it('ignores bulk close for an unknown tab', () => {
      useTabsStore.getState().closeOtherTabs('zzz')
      expect(useTabsStore.getState().tabs).toHaveLength(4)
    })
  })
})
