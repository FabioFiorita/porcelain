import { describe, expect, it } from 'vitest'
import { toWireRelativePath } from './wire-path'

describe('toWireRelativePath', () => {
  it('preserves POSIX relative paths', () => {
    expect(toWireRelativePath('src/components/app.tsx', '/')).toBe('src/components/app.tsx')
  })

  it('normalizes Windows relative paths for the wire', () => {
    expect(toWireRelativePath('src\\components\\app.tsx', '\\')).toBe('src/components/app.tsx')
  })
})
