// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createFilePreviewTokens } from './file-preview-tokens'

describe('createFilePreviewTokens', () => {
  it('resolves a minted grant back to its exact file scope', () => {
    const tokens = createFilePreviewTokens()
    const token = tokens.mint({ projectPath: '/synthetic/repo', path: 'docs/index.html' })
    expect(tokens.resolve(token)).toEqual({
      projectPath: '/synthetic/repo',
      path: 'docs/index.html',
    })
  })

  it('mints a distinct token per grant and never resolves an unknown one', () => {
    const tokens = createFilePreviewTokens()
    const one = tokens.mint({ projectPath: '/synthetic/repo', path: 'a.html' })
    const two = tokens.mint({ projectPath: '/synthetic/repo', path: 'a.html' })
    expect(one).not.toBe(two)
    expect(tokens.resolve('not-a-token')).toBeNull()
  })

  it('expires a grant a few minutes on', () => {
    const tokens = createFilePreviewTokens()
    const minted = 1_000_000
    const token = tokens.mint({ projectPath: '/synthetic/repo', path: 'a.html' }, minted)
    expect(tokens.resolve(token, minted + 60_000)).not.toBeNull()
    expect(tokens.resolve(token, minted + 10 * 60_000)).toBeNull()
  })
})
