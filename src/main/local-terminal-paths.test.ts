import { describe, expect, it } from 'vitest'
import { localTerminalPathKey, parseLocalTerminalPathState } from './local-terminal-paths'

describe('localTerminalPathKey', () => {
  it('scopes a repo path to its environment', () => {
    expect(localTerminalPathKey('env-1', '/home/you/code/app')).toBe('env-1\n/home/you/code/app')
  })

  it('keys the local environment under a stable name, not null', () => {
    expect(localTerminalPathKey(null, '/home/you/code/app')).toBe('local\n/home/you/code/app')
  })

  it('keeps the SAME repo path on two machines apart — the reason the key is composite', () => {
    const beelink = localTerminalPathKey('env-1', '/home/you/code/app')
    const other = localTerminalPathKey('env-2', '/home/you/code/app')
    expect(beelink).not.toBe(other)
  })

  it('cannot collide across a path that contains the separator characters', () => {
    // A ':' separator would make ('a', 'b:c') and ('a:b', 'c') the same key; '\n' can't
    // appear in an environment id (a uuid) so the split point is unambiguous.
    expect(localTerminalPathKey('a', 'b:c')).not.toBe(localTerminalPathKey('a:b', 'c'))
  })
})

describe('parseLocalTerminalPathState', () => {
  it('reads a stored mapping', () => {
    const state = parseLocalTerminalPathState({ paths: { 'env-1\n/srv/app': '/Users/you/app' } })
    expect(state.paths['env-1\n/srv/app']).toBe('/Users/you/app')
  })

  it('falls back to empty on corrupt, legacy, or absent shapes rather than throwing', () => {
    expect(parseLocalTerminalPathState(null).paths).toEqual({})
    expect(parseLocalTerminalPathState({ paths: { a: 3 } }).paths).toEqual({})
    expect(parseLocalTerminalPathState('nonsense').paths).toEqual({})
    expect(parseLocalTerminalPathState({ other: true }).paths).toEqual({})
  })
})
