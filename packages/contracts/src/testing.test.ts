import { describe, expect, it } from 'vitest'
import { openRepoPathInputSchema, openRepoPathOutputSchema } from './projects/projects.contract'
import { defineContractFixture, parseContractFixture } from './testing'

const VALID_OUTPUT = {
  path: '/synthetic/projects/alpha',
  name: 'alpha',
}

describe('contract fixtures', () => {
  it('parses a valid value at construction and returns the schema output', () => {
    const fixture = defineContractFixture(openRepoPathOutputSchema, VALID_OUTPUT)
    expect(fixture).toEqual(VALID_OUTPUT)
    expect(parseContractFixture(openRepoPathInputSchema, '/synthetic/projects/alpha')).toBe(
      '/synthetic/projects/alpha',
    )
  })

  it('rejects an invalid fixture value before it can be used', () => {
    expect(() =>
      defineContractFixture(openRepoPathOutputSchema, { path: '/synthetic/projects/alpha' }),
    ).toThrow()
    expect(() => parseContractFixture(openRepoPathInputSchema, 42)).toThrow()
  })
})
