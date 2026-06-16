import { describe, expect, it } from 'vitest'
import { applyCommitPrefix, parseCommitPrefix } from './commit-message'

describe('parseCommitPrefix', () => {
  it('parses type and scope from a conventional first line', () => {
    expect(parseCommitPrefix('feat(auth): add login')).toEqual({ type: 'feat', scope: 'auth' })
  })

  it('parses a type with no scope', () => {
    expect(parseCommitPrefix('fix: a bug')).toEqual({ type: 'fix', scope: null })
  })

  it('tolerates a breaking-change bang', () => {
    expect(parseCommitPrefix('feat(api)!: drop v1')).toEqual({ type: 'feat', scope: 'api' })
  })

  it('returns nulls for a freeform message (no colon)', () => {
    expect(parseCommitPrefix('fix the thing')).toEqual({ type: null, scope: null })
  })

  it('only looks at the first line', () => {
    expect(parseCommitPrefix('feat: x\n\nfix(body): not a prefix')).toEqual({
      type: 'feat',
      scope: null,
    })
  })
})

describe('applyCommitPrefix', () => {
  it('adds a prefix to a bare subject', () => {
    expect(applyCommitPrefix('add login', 'feat', null)).toBe('feat: add login')
  })

  it('adds a type + scope', () => {
    expect(applyCommitPrefix('add login', 'feat', 'auth')).toBe('feat(auth): add login')
  })

  it('rewrites an existing prefix in place', () => {
    expect(applyCommitPrefix('feat(auth): add login', 'fix', 'auth')).toBe('fix(auth): add login')
  })

  it('changes only the scope, keeping the body', () => {
    expect(applyCommitPrefix('feat(auth): add login', 'feat', 'ui')).toBe('feat(ui): add login')
  })

  it('strips the prefix when type is null', () => {
    expect(applyCommitPrefix('feat(auth): add login', null, null)).toBe('add login')
  })

  it('drops the scope without a type (a bare (scope): is invalid)', () => {
    expect(applyCommitPrefix('feat(auth): add login', null, 'auth')).toBe('add login')
  })

  it('preserves the body and trailing lines', () => {
    expect(applyCommitPrefix('add login\n\nlong body here', 'feat', 'auth')).toBe(
      'feat(auth): add login\n\nlong body here',
    )
  })

  it('is idempotent when re-applying the same prefix', () => {
    const once = applyCommitPrefix('add login', 'feat', 'auth')
    expect(applyCommitPrefix(once, 'feat', 'auth')).toBe(once)
  })
})
