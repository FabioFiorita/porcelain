import { describe, expect, it } from 'vitest'
import { createCanvasAccessTokens } from './canvas-access-tokens'

describe('Canvas access tokens', () => {
  it('resolves a freshly minted token to its scope', () => {
    const tokens = createCanvasAccessTokens()
    const token = tokens.mint({ projectId: 'proj-1', canvasId: 'canvas-1' }, 0)
    expect(tokens.resolve(token, 0)).toEqual({ projectId: 'proj-1', canvasId: 'canvas-1' })
  })

  it('mints unique tokens for the same scope', () => {
    const tokens = createCanvasAccessTokens()
    const a = tokens.mint({ projectId: 'proj-1', canvasId: 'canvas-1' }, 0)
    const b = tokens.mint({ projectId: 'proj-1', canvasId: 'canvas-1' }, 0)
    expect(a).not.toBe(b)
  })

  it('returns null for an unknown token', () => {
    const tokens = createCanvasAccessTokens()
    expect(tokens.resolve('nope', 0)).toBeNull()
  })

  it('expires a token after its TTL', () => {
    const tokens = createCanvasAccessTokens()
    const token = tokens.mint({ projectId: 'proj-1', canvasId: 'canvas-1' }, 0)
    expect(tokens.resolve(token, 5 * 60 * 1000)).toBeNull()
  })

  it('still resolves just under the TTL boundary', () => {
    const tokens = createCanvasAccessTokens()
    const token = tokens.mint({ projectId: 'proj-1', canvasId: 'canvas-1' }, 0)
    expect(tokens.resolve(token, 5 * 60 * 1000 - 1)).toEqual({
      projectId: 'proj-1',
      canvasId: 'canvas-1',
    })
  })

  it('forgets an expired token so it cannot be resolved again later by a reused id', () => {
    const tokens = createCanvasAccessTokens()
    const token = tokens.mint({ projectId: 'proj-1', canvasId: 'canvas-1' }, 0)
    expect(tokens.resolve(token, 10 * 60 * 1000)).toBeNull()
    // A second resolve at the same (already-expired) instant stays null — not a crash,
    // not a resurrection of the swept entry.
    expect(tokens.resolve(token, 10 * 60 * 1000)).toBeNull()
  })
})
