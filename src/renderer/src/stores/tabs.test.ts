import { beforeEach, describe, expect, it } from 'vitest'
import { type Tab, useTabsStore } from './tabs'

const tab = (id: string): Tab => ({ id, kind: 'file', title: id, path: `/repo/${id}` })

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
})
