import { beforeEach, describe, expect, it } from 'vitest'
import { useTreeDirsStore } from './tree-dirs'

describe('tree-dirs store', () => {
  beforeEach(() => {
    useTreeDirsStore.setState({ dirs: new Set() })
  })

  it('starts empty', () => {
    expect(useTreeDirsStore.getState().dirs.size).toBe(0)
  })

  it('add() registers a dir', () => {
    useTreeDirsStore.getState().add('/repo/src')
    expect([...useTreeDirsStore.getState().dirs]).toEqual(['/repo/src'])
  })

  it('add() is idempotent and keeps the same set identity on a no-op', () => {
    useTreeDirsStore.getState().add('/repo/src')
    const before = useTreeDirsStore.getState().dirs
    useTreeDirsStore.getState().add('/repo/src')
    const after = useTreeDirsStore.getState().dirs
    expect(after).toBe(before)
    expect(after.size).toBe(1)
  })

  it('add() produces a new set identity on a real change', () => {
    useTreeDirsStore.getState().add('/repo/src')
    const before = useTreeDirsStore.getState().dirs
    useTreeDirsStore.getState().add('/repo/lib')
    expect(useTreeDirsStore.getState().dirs).not.toBe(before)
    expect(useTreeDirsStore.getState().dirs.size).toBe(2)
  })

  it('remove() drops a dir', () => {
    useTreeDirsStore.getState().add('/repo/src')
    useTreeDirsStore.getState().remove('/repo/src')
    expect(useTreeDirsStore.getState().dirs.size).toBe(0)
  })

  it('remove() keeps the same set identity when the dir was not present', () => {
    useTreeDirsStore.getState().add('/repo/src')
    const before = useTreeDirsStore.getState().dirs
    useTreeDirsStore.getState().remove('/repo/lib')
    expect(useTreeDirsStore.getState().dirs).toBe(before)
  })
})
