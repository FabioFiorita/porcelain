import { describe, expect, it } from 'vitest'
import { entryExists, uniqueDuplicatePath } from './unique-duplicate-path'

describe('uniqueDuplicatePath', () => {
  const none = (): boolean => false

  it('inserts " copy" before a file extension', () => {
    expect(uniqueDuplicatePath('/repo/src/bar.ts', false, none)).toBe('/repo/src/bar copy.ts')
  })

  it('appends " copy" to a directory (no extension split)', () => {
    expect(uniqueDuplicatePath('/repo/src/utils', true, none)).toBe('/repo/src/utils copy')
  })

  it('treats a dotfile as having no extension', () => {
    expect(uniqueDuplicatePath('/repo/.gitignore', false, none)).toBe('/repo/.gitignore copy')
  })

  it('numbers subsequent copies when earlier ones exist', () => {
    const taken = new Set(['/repo/bar copy.ts', '/repo/bar copy 2.ts'])
    expect(uniqueDuplicatePath('/repo/bar.ts', false, (c) => taken.has(c))).toBe(
      '/repo/bar copy 3.ts',
    )
  })

  it('only splits the final extension', () => {
    expect(uniqueDuplicatePath('/repo/archive.tar.gz', false, none)).toBe(
      '/repo/archive.tar copy.gz',
    )
  })

  it('advances past a dangling-sibling collision when entryExists treats it as occupied', () => {
    // entryExists semantics: dangling symlink counts as occupied
    const taken = new Set(['/repo/bar copy.ts'])
    expect(uniqueDuplicatePath('/repo/bar.ts', false, (c) => taken.has(c))).toBe(
      '/repo/bar copy 2.ts',
    )
  })

  it('throws when no free name within the bound', () => {
    expect(() => uniqueDuplicatePath('/repo/bar.ts', false, () => true)).toThrow(
      /no free name within 10000/,
    )
  })
})

describe('entryExists', () => {
  it('returns false for a missing path', () => {
    expect(entryExists('/tmp/porcelain-entry-exists-missing-path-xyz')).toBe(false)
  })
})
