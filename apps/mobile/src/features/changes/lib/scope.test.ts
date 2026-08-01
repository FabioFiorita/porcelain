import { describe, expect, it } from 'vitest'

import { firstParam, parseScope, scopeParams } from './scope'

describe('parseScope', () => {
  it('reads a commit scope', () => {
    expect(parseScope('commit', 'abc123')).toEqual({ hash: 'abc123', type: 'commit' })
  })

  it('falls back to the working tree for anything malformed', () => {
    expect(parseScope('commit', undefined)).toEqual({ type: 'working' })
    expect(parseScope('commit', '')).toEqual({ type: 'working' })
    expect(parseScope('branch', 'abc123')).toEqual({ type: 'working' })
    expect(parseScope(undefined, undefined)).toEqual({ type: 'working' })
  })

  it('takes the first value when the router hands back an array', () => {
    expect(parseScope(['commit'], ['abc123'])).toEqual({ hash: 'abc123', type: 'commit' })
  })
})

describe('scopeParams', () => {
  it('round-trips through parseScope', () => {
    const params = scopeParams({ hash: 'abc123', type: 'commit' })
    expect(parseScope(params.scope, params.hash)).toEqual({ hash: 'abc123', type: 'commit' })
    const working = scopeParams({ type: 'working' })
    expect(parseScope(working.scope, working.hash)).toEqual({ type: 'working' })
  })
})

describe('firstParam', () => {
  it('normalises the string-or-array param the router hands back', () => {
    expect(firstParam('src/a.ts')).toBe('src/a.ts')
    expect(firstParam(['src/a.ts', 'src/b.ts'])).toBe('src/a.ts')
    expect(firstParam(undefined)).toBe('')
  })
})
