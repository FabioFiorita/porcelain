import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import { gitChangeSchema, gitNotificationFixtures, gitProcedures } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'
import { gitNotificationEffects } from './git-notifications'

const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other-repo'

function queryNames(queries: readonly { domain: string; name: string }[]): readonly string[] {
  return queries.map((query) => `${query.domain}/${query.name}`)
}

describe('gitNotificationEffects', () => {
  it('maps the typed working-tree fact to exactly current-worktree identities', () => {
    expect(
      queryNames(gitNotificationEffects(gitNotificationFixtures['git.working-tree-changed'])),
    ).toEqual([
      'git/head',
      'git/flow',
      'git/range-flow',
      'git/status',
      'git/diff',
      'git/log',
      'git/commit-conventions',
      'git/suggestions',
      'review/reading',
      'review/view',
      'review/reviewed-paths',
    ])
  })

  it('keeps notification effects project-scoped and excludes roster/inbox identities', () => {
    const notification = gitNotificationFixtures['git.working-tree-changed']
    const effects = gitNotificationEffects(notification)
    const other = gitNotificationEffects({ ...notification, projectPath: OTHER_PROJECT })
    expect(effects).not.toEqual(other)
    expect(effects.every((effect) => effect.projectPath === PROJECT)).toBe(true)
    expect(queryNames(effects)).not.toContain('git/branches')
    expect(queryNames(effects)).not.toContain('git/worktrees')
    expect(queryNames(effects)).not.toContain('review/worktree-inbox')
  })

  it('validates the RT-001 notification at the TST-001 mock boundary', () => {
    const daemon = createValidatingDaemonMock(
      {
        procedures: gitProcedures,
        notification: gitChangeSchema,
        publicError: publicErrorSchema,
      },
      {},
    )
    const effects: (readonly string[])[] = []
    daemon.subscribe((notification) => {
      effects.push(queryNames(gitNotificationEffects(gitChangeSchema.parse(notification))))
    })

    expect(daemon.emit(gitNotificationFixtures['git.working-tree-changed'])).toEqual(
      gitNotificationFixtures['git.working-tree-changed'],
    )
    expect(effects).toHaveLength(1)
    expect(() => daemon.emit({ kind: 'git.working-tree-changed' })).toThrow()
    expect(() => daemon.emit({ kind: 'review.changed', projectPath: PROJECT })).toThrow()
  })
})
