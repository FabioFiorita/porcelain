import { describe, expect, it } from 'vitest'
import { moveToTrash } from './move-to-trash'

describe('moveToTrash interop', () => {
  it('exports a callable that accepts a path string', () => {
    // The packaging trap is "not a function" at call time — pin the export shape.
    expect(typeof moveToTrash).toBe('function')
    expect(moveToTrash.length).toBe(1)
  })
})
