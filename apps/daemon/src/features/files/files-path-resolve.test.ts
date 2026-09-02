import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPathOutsideRoot, joinLexical } from './files-path-resolve'

describe('isPathOutsideRoot', () => {
  it('allows paths under the root including ..foo names', () => {
    expect(isPathOutsideRoot('/repo', '/repo/src/main.ts')).toBe(false)
    expect(isPathOutsideRoot('/repo', '/repo/..foo')).toBe(false)
    expect(isPathOutsideRoot('/repo', '/repo/dir/..config/x')).toBe(false)
  })

  it('rejects parent and absolute relatives', () => {
    expect(isPathOutsideRoot('/repo', '/other')).toBe(true)
    expect(isPathOutsideRoot('/repo', '/repo/../other')).toBe(true)
    // relative() of an absolute escape yields absolute or .. form
    expect(isPathOutsideRoot('/repo', '/')).toBe(true)
  })
})

describe('joinLexical', () => {
  it('rejects the project root itself as a file target', () => {
    expect(joinLexical('/repo', '.')).toEqual({ ok: false, reason: 'outside' })
  })

  it('joins a contained relative path', () => {
    expect(joinLexical('/repo', 'src/main.ts')).toEqual({
      ok: true,
      lexicalAbsolute: resolve('/repo', 'src/main.ts'),
    })
  })
})
