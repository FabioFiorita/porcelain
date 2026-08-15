import { describe, expect, it } from 'vitest'
import { devServerMutations, devServersNotificationEffects } from './dev-server-mutations'
import { devServersQuery, devServersQuerySchema } from './dev-server-queries'

const TARGET = {
  projectId: 'project-1',
  worktreeId: 'worktree-1',
  path: '/repo/main',
} as const

describe('development server query identity', () => {
  it('is a validated identity keyed by Project and Worktree, not by path', () => {
    const identity = devServersQuery(TARGET)

    expect(devServersQuerySchema.parse(identity)).toEqual({
      domain: 'terminal',
      name: 'dev-servers',
      projectId: 'project-1',
      worktreeId: 'worktree-1',
    })
  })

  it('separates two Worktrees of the same Project into different rows', () => {
    expect(devServersQuery(TARGET)).not.toEqual(
      devServersQuery({ ...TARGET, worktreeId: 'worktree-2' }),
    )
  })

  it('rejects an identity missing its Worktree', () => {
    expect(
      devServersQuerySchema.safeParse({
        domain: 'terminal',
        name: 'dev-servers',
        projectId: 'project-1',
      }).success,
    ).toBe(false)
  })
})

describe('development server mutation consequences', () => {
  it('start invalidates exactly the target Worktree roster', () => {
    expect(
      devServerMutations.start.affectedQueries({
        target: TARGET,
        label: 'web',
        command: 'pnpm dev',
      }),
    ).toEqual([devServersQuery(TARGET)])
  })

  it('stop and dismiss invalidate the Worktree the caller names, never everything', () => {
    const input = { id: 'dev-server-1', projectId: 'project-1', worktreeId: 'worktree-2' }

    expect(devServerMutations.stop.affectedQueries(input)).toEqual([
      devServersQuery({ projectId: 'project-1', worktreeId: 'worktree-2' }),
    ])
    expect(devServerMutations.dismiss.affectedQueries(input)).toEqual([
      devServersQuery({ projectId: 'project-1', worktreeId: 'worktree-2' }),
    ])
  })

  it('binds each mutation to its own catalog procedure', () => {
    expect(devServerMutations.start.procedureName).toBe('startDevServer')
    expect(devServerMutations.stop.procedureName).toBe('stopDevServer')
    expect(devServerMutations.dismiss.procedureName).toBe('dismissDevServer')
    expect(devServerMutations.start.procedure.kind).toBe('mutation')
  })

  it('never answers a command optimistically — the daemon owns "is it running?"', () => {
    for (const mutation of Object.values(devServerMutations)) {
      expect(mutation.requiresAuthoritativeRefetch).toBe(true)
    }
  })
})

describe('development server notification effects', () => {
  it('maps a roster change to the one identity it made stale', () => {
    expect(
      devServersNotificationEffects({
        kind: 'terminal.dev-servers-changed',
        projectPath: '/repo/main',
        projectId: 'project-1',
        worktreeId: 'worktree-1',
      }),
    ).toEqual([devServersQuery(TARGET)])
  })
})
