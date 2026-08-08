import { describe, expect, it } from 'vitest'

import { tokenChipLabel, tokenOptionLabel, tokenPicker } from './commit-tokens'

const TYPES = ['feat', 'fix', 'refactor']

describe('tokenChipLabel', () => {
  it('prompts with the kind while nothing is chosen', () => {
    expect(tokenChipLabel('type', null)).toBe('type')
    expect(tokenChipLabel('scope', null)).toBe('scope')
  })

  it('writes a scope the way the message will write it', () => {
    expect(tokenChipLabel('scope', 'mobile')).toBe('(mobile)')
    expect(tokenChipLabel('type', 'feat')).toBe('feat')
  })
})

describe('tokenOptionLabel', () => {
  it('matches the chip, so an option looks like what choosing it produces', () => {
    expect(tokenOptionLabel('scope', 'mobile')).toBe('(mobile)')
    expect(tokenOptionLabel('type', 'fix')).toBe('fix')
  })
})

describe('tokenPicker', () => {
  it('offers everything the repo already uses on an empty query', () => {
    const picker = tokenPicker(TYPES, '')
    expect(picker.matches).toEqual(TYPES)
    expect(picker.addition).toBeNull()
    expect(picker.empty).toBe(false)
  })

  it('filters on a substring, not a prefix', () => {
    expect(tokenPicker(TYPES, 'fact').matches).toEqual(['refactor'])
  })

  it('matches case-insensitively so a repo gets one spelling of its token', () => {
    // Typing "Fix" for a repo that writes "fix" must show the existing token, not invite a
    // second spelling of it.
    expect(tokenPicker(TYPES, 'FIX').matches).toEqual(['fix'])
  })

  it('offers to add a token the repo has never used, exactly as typed', () => {
    const picker = tokenPicker(TYPES, '  chore  ')
    expect(picker.addition).toBe('chore')
    expect(picker.matches).toEqual([])
    expect(picker.empty).toBe(false)
  })

  it('never offers to add one the repo already has', () => {
    expect(tokenPicker(TYPES, 'fix').addition).toBeNull()
  })

  it('offers a differently-cased addition, since casing is the repo’s business', () => {
    const picker = tokenPicker(TYPES, 'Fix')
    expect(picker.matches).toEqual(['fix'])
    expect(picker.addition).toBe('Fix')
  })

  it('is empty only when there is neither a match nor anything to add', () => {
    expect(tokenPicker([], '').empty).toBe(true)
    expect(tokenPicker([], 'chore').empty).toBe(false)
  })
})
