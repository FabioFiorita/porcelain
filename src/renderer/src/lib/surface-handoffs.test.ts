import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { beforeEach, describe, expect, it } from 'vitest'
import { openChanges, openDiff, openFeatureReview, openFile } from './surface-handoffs'

describe('surface-handoffs', () => {
  beforeEach(() => {
    useTabsStore.setState({
      panes: [{ tabs: [], activeTabId: null }],
      activePaneIndex: 0,
    })
    usePreferencesStore.setState({ sidebarTab: 'files' })
    useRepoStore.setState({ repo: { path: '/repo', name: 'repo' } })
  })

  it('openChanges switches to the Changes sidebar', () => {
    openChanges()
    expect(usePreferencesStore.getState().sidebarTab).toBe('changes')
  })

  it('openChanges with continuousReview opens the All changes review tab', () => {
    openChanges({ continuousReview: true })
    const pane = useTabsStore.getState().panes[0]
    expect(pane?.tabs.some((t) => t.kind === 'review' && t.path === 'working')).toBe(true)
  })

  it('openChanges with path opens a diff tab', () => {
    openChanges({ path: 'src/a.ts' })
    const pane = useTabsStore.getState().panes[0]
    expect(pane?.tabs.some((t) => t.kind === 'diff' && t.path === 'src/a.ts')).toBe(true)
  })

  it('openDiff opens a diff tab by relative path', () => {
    openDiff('pkg/x.ts')
    const pane = useTabsStore.getState().panes[0]
    expect(pane?.tabs.some((t) => t.kind === 'diff' && t.path === 'pkg/x.ts')).toBe(true)
  })

  it('openFile opens a file tab', () => {
    openFile('/repo/src/a.ts')
    const pane = useTabsStore.getState().panes[0]
    expect(pane?.tabs.some((t) => t.kind === 'file' && t.path === '/repo/src/a.ts')).toBe(true)
  })

  it('openFeatureReview opens Feature sidebar and feature tab', () => {
    openFeatureReview()
    expect(usePreferencesStore.getState().sidebarTab).toBe('feature')
    const pane = useTabsStore.getState().panes[0]
    expect(pane?.tabs.some((t) => t.kind === 'feature' && t.path === '/repo')).toBe(true)
  })
})
