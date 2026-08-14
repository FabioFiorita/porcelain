import { describe, expect, it } from 'vitest'
import { type HubTarget, hubTabKey, hubTargetOf, sameHubTarget } from './hub-target'

const alpha: HubTarget = {
  environmentId: 'env-1',
  projectId: 'proj-1',
  worktreeId: 'wt-main',
  path: '/repos/alpha',
}
const topic: HubTarget = {
  environmentId: 'env-1',
  projectId: 'proj-1',
  worktreeId: 'wt-topic',
  path: '/repos/alpha-worktrees/topic',
}

describe('Hub tab targeting', () => {
  it('keeps the same path as two tabs when the Environment or Worktree differs', () => {
    expect(hubTabKey('file', 'README.md', alpha)).toBe('file:env-1:proj-1:wt-main:README.md')
    expect(hubTabKey('file', 'README.md', topic)).toBe('file:env-1:proj-1:wt-topic:README.md')
    expect(hubTabKey('file', 'README.md', alpha)).not.toBe(hubTabKey('file', 'README.md', topic))
    expect(hubTabKey('file', 'README.md', { ...alpha, environmentId: 'env-2' })).toBe(
      'file:env-2:proj-1:wt-main:README.md',
    )
  })

  it('falls back to an unscoped key when no Worktree is selected', () => {
    expect(hubTabKey('file', 'README.md', null)).toBe('file:README.md')
  })

  it('exposes a Worktree target only for a Worktree selection', () => {
    expect(hubTargetOf({ kind: 'home' })).toBeNull()
    expect(hubTargetOf({ kind: 'project', environmentId: 'env-1', projectId: 'proj-1' })).toBeNull()
    expect(
      hubTargetOf({
        kind: 'worktree',
        environmentId: 'env-1',
        projectId: 'proj-1',
        worktreeId: 'wt-main',
        path: '/repos/alpha',
      }),
    ).toEqual(alpha)
  })

  it('compares targets by the three identities, not by path', () => {
    expect(sameHubTarget(alpha, { ...alpha, path: '/moved/alpha' })).toBe(true)
    expect(sameHubTarget(alpha, topic)).toBe(false)
    expect(sameHubTarget(alpha, null)).toBe(false)
  })
})
