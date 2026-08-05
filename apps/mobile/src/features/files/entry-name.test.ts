import { describe, expect, it } from 'vitest'

import { nameError } from './entry-name'

describe('nameError', () => {
  it('accepts an ordinary file name', () => {
    expect(nameError('use-search.ts')).toBeNull()
  })

  it('accepts a dotfile, whose leading dot is not a reserved name', () => {
    expect(nameError('.gitignore')).toBeNull()
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(nameError('')).not.toBeNull()
    expect(nameError('   ')).not.toBeNull()
  })

  it('rejects a path separator, which would write outside the chosen folder', () => {
    expect(nameError('src/index.ts')).not.toBeNull()
    expect(nameError('../escape.ts')).not.toBeNull()
    expect(nameError('a\\b')).not.toBeNull()
  })

  it('rejects the directory aliases', () => {
    expect(nameError('.')).not.toBeNull()
    expect(nameError('..')).not.toBeNull()
  })
})
