import { describe, expect, it } from 'vitest'
import { exceedsReadLimit, MAX_READ_BYTES } from './read-limits'

describe('exceedsReadLimit', () => {
  it('allows empty files', () => {
    expect(exceedsReadLimit(0)).toBe(false)
  })

  it('allows files exactly at the limit', () => {
    expect(exceedsReadLimit(MAX_READ_BYTES)).toBe(false)
  })

  it('rejects files over the limit', () => {
    expect(exceedsReadLimit(MAX_READ_BYTES + 1)).toBe(true)
  })
})
