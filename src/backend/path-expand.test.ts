import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandUserPath } from './path-expand'

describe('expandUserPath', () => {
  it('leaves absolute paths alone', () => {
    expect(expandUserPath('/tmp/shot.png')).toBe('/tmp/shot.png')
  })

  it('expands ~ and ~/', () => {
    expect(expandUserPath('~')).toBe(homedir())
    expect(expandUserPath('~/.porcelain/loop-evidence/a/shot.png')).toBe(
      join(homedir(), '.porcelain/loop-evidence/a/shot.png'),
    )
  })

  it('decodes file:// URLs', () => {
    expect(expandUserPath('file:///tmp/board-focus-shot/default.png')).toBe(
      '/tmp/board-focus-shot/default.png',
    )
  })

  it('trims whitespace', () => {
    expect(expandUserPath('  /tmp/a.png  ')).toBe('/tmp/a.png')
  })

  it('passes through non-path strings unchanged', () => {
    expect(expandUserPath('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(expandUserPath('relative/a.png')).toBe('relative/a.png')
  })
})
