import { beforeEach, describe, expect, it } from 'vitest'
import { useRevealStore } from './reveal'

describe('reveal store', () => {
  beforeEach(() => {
    useRevealStore.setState({ path: null })
  })

  it('starts with no reveal target', () => {
    expect(useRevealStore.getState().path).toBeNull()
  })

  it('reveal() sets the target path', () => {
    useRevealStore.getState().reveal('/repo/src/a.ts')
    expect(useRevealStore.getState().path).toBe('/repo/src/a.ts')
  })

  it('reveal() replaces a previous target', () => {
    useRevealStore.getState().reveal('/repo/src/a.ts')
    useRevealStore.getState().reveal('/repo/src/b.ts')
    expect(useRevealStore.getState().path).toBe('/repo/src/b.ts')
  })

  it('clear() drops the target once consumed', () => {
    useRevealStore.getState().reveal('/repo/src/a.ts')
    useRevealStore.getState().clear()
    expect(useRevealStore.getState().path).toBeNull()
  })

  it('clear() is a no-op when there is no target', () => {
    useRevealStore.getState().clear()
    expect(useRevealStore.getState().path).toBeNull()
  })
})
