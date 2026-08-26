import { beforeEach, describe, expect, it } from 'vitest'
import { useChangesetCollapseStore } from './changeset-collapse'

describe('changeset collapse store', () => {
  beforeEach(() => useChangesetCollapseStore.getState().clear())

  it('keeps collapsed files isolated by worktree and changeset scope', () => {
    const store = useChangesetCollapseStore.getState()
    store.toggle('/repo-a\0working', 'src/a.ts')

    expect(useChangesetCollapseStore.getState().collapsedByScope).toEqual({
      '/repo-a\0working': ['src/a.ts'],
    })

    useChangesetCollapseStore.getState().toggle('/repo-a\0working', 'src/a.ts')
    expect(useChangesetCollapseStore.getState().collapsedByScope['/repo-a\0working']).toEqual([])
  })

  it('keeps mark-reviewed collapse idempotent', () => {
    const store = useChangesetCollapseStore.getState()
    store.collapse('/repo-a\0working', 'src/a.ts')
    useChangesetCollapseStore.getState().collapse('/repo-a\0working', 'src/a.ts')

    expect(useChangesetCollapseStore.getState().collapsedByScope['/repo-a\0working']).toEqual([
      'src/a.ts',
    ])
  })
})
