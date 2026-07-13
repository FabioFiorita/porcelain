import { delimiter } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mergePathSegments, parseLoginPath } from './login-shell-env'

describe('parseLoginPath', () => {
  it('reads a plain PATH (no trailing newline, as `printf %s` prints it)', () => {
    expect(parseLoginPath('/opt/homebrew/bin:/usr/bin:/bin')).toBe(
      '/opt/homebrew/bin:/usr/bin:/bin',
    )
  })

  it('takes the LAST line when the shell prints warnings first (fish etc.)', () => {
    expect(parseLoginPath('warning: something\n/opt/homebrew/bin:/usr/bin')).toBe(
      '/opt/homebrew/bin:/usr/bin',
    )
  })

  it('returns null for empty output', () => {
    expect(parseLoginPath('')).toBeNull()
    expect(parseLoginPath('   \n  ')).toBeNull()
  })

  it('returns null when the last line has no `/` (not a PATH)', () => {
    expect(parseLoginPath('command not found: foo')).toBeNull()
  })
})

describe('mergePathSegments', () => {
  it('puts login segments first, then appends current-only segments', () => {
    const merged = mergePathSegments('/opt/homebrew/bin:/usr/bin', '/usr/bin:/sbin')
    expect(merged).toBe(['/opt/homebrew/bin', '/usr/bin', '/sbin'].join(delimiter))
  })

  it('dedupes segments across and within the two sources', () => {
    const merged = mergePathSegments('/a:/b:/a', '/b:/c:/c')
    expect(merged).toBe(['/a', '/b', '/c'].join(delimiter))
  })

  it('drops empty segments', () => {
    const merged = mergePathSegments('/a::/b', ':/c:')
    expect(merged).toBe(['/a', '/b', '/c'].join(delimiter))
  })

  it('falls back to the current PATH when the login PATH is null', () => {
    expect(mergePathSegments(null, '/usr/bin:/bin')).toBe(['/usr/bin', '/bin'].join(delimiter))
  })

  it('handles an empty current PATH', () => {
    expect(mergePathSegments('/a:/b', '')).toBe(['/a', '/b'].join(delimiter))
  })
})
