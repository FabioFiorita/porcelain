import { beforeEach, describe, expect, it } from 'vitest'
import { fileTabsOwner, useFileTabsStore } from './file-tabs-store'

beforeEach(() => useFileTabsStore.setState({ owners: {} }))
const owner = JSON.stringify(['local', '/repo'])
describe('tablet file tabs', () => {
  it('reuses an open file while keeping its position and accepting a new line target', () => {
    const tabs = useFileTabsStore.getState()
    tabs.open(owner, 'a.ts')
    tabs.open(owner, 'b.ts')
    tabs.open(owner, 'a.ts', 20)
    expect(useFileTabsStore.getState().owners[owner]).toEqual({
      tabs: [{ path: 'a.ts', line: 20 }, { path: 'b.ts' }],
      activePath: 'a.ts',
    })
  })
  it('keeps independent file lists for each environment and worktree', () => {
    const tabs = useFileTabsStore.getState()
    tabs.open(owner, 'a.ts')
    const remote = fileTabsOwner('remote', '/repo')
    const other = fileTabsOwner('local', '/other')
    if (!remote || !other) throw new Error('Expected tab owners')
    tabs.open(remote, 'b.ts')
    tabs.open(other, 'c.ts')
    expect(useFileTabsStore.getState().owners[owner].activePath).toBe('a.ts')
    expect(useFileTabsStore.getState().owners[remote].activePath).toBe('b.ts')
    expect(useFileTabsStore.getState().owners[other].activePath).toBe('c.ts')
  })
  it('closing a background tab preserves focus and closing the active tab chooses a neighbor', () => {
    const tabs = useFileTabsStore.getState()
    for (const path of ['a.ts', 'b.ts', 'c.ts']) tabs.open(owner, path)
    tabs.close(owner, 'a.ts')
    expect(useFileTabsStore.getState().owners[owner].activePath).toBe('c.ts')
    tabs.close(owner, 'c.ts')
    expect(useFileTabsStore.getState().owners[owner].activePath).toBe('b.ts')
    tabs.close(owner, 'b.ts')
    expect(useFileTabsStore.getState().owners[owner]).toEqual({ tabs: [], activePath: null })
  })
  it('retargets tabs after folder moves and removes descendants after trash', () => {
    const tabs = useFileTabsStore.getState()
    tabs.open(owner, 'src/a.ts', 5)
    tabs.open(owner, 'src/b.ts')
    tabs.open(owner, 'README.md')
    tabs.open(owner, 'src/a.ts')
    tabs.move(owner, 'src', 'lib')
    expect(useFileTabsStore.getState().owners[owner].activePath).toBe('lib/a.ts')
    expect(useFileTabsStore.getState().owners[owner].tabs[0]).toEqual({ path: 'lib/a.ts', line: 5 })
    tabs.remove(owner, 'lib')
    expect(useFileTabsStore.getState().owners[owner]).toEqual({
      tabs: [{ path: 'README.md' }],
      activePath: 'README.md',
    })
  })
})
