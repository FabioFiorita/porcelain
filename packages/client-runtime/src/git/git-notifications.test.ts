import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import { gitChangeSchema, gitNotificationFixtures, gitProcedures } from '@porcelain/contracts/git'
import { reviewChangeSchema, reviewNotificationFixtures } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'

import { gitNotificationEffects, gitReviewNotificationEffects } from './git-notifications'

const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other-repo'

function names(queries: readonly { domain: string; name: string }[]): readonly string[] {
  return queries.map((query) => `${query.domain}/${query.name}`)
}

describe('Git notification effects', () => {
  it('maps the typed working-tree fact to all mutable project families', () => {
    expect(
      names(gitNotificationEffects(gitNotificationFixtures['git.working-tree-changed'])),
    ).toEqual([
      'git/head',
      'git/flow',
      'git/range-flow',
      'git/status',
      'git/diff',
      'git/range-diff',
      'git/diff-reading-family',
      'git/log-family',
      'git/file-log-family',
      'git/commit-conventions',
      'git/suggestions',
      'review/reading',
      'review/view',
      'review/reviewed-paths',
    ])
  })

  it('keeps notification effects project-scoped and excludes immutable/roster identities', () => {
    const notification = gitNotificationFixtures['git.working-tree-changed']
    const effects = gitNotificationEffects(notification)
    const other = gitNotificationEffects({ ...notification, projectPath: OTHER_PROJECT })
    expect(effects).not.toEqual(other)
    expect(
      effects.every((effect) => !('projectPath' in effect) || effect.projectPath === PROJECT),
    ).toBe(true)
    expect(names(effects)).not.toContain('git/branches')
    expect(names(effects)).not.toContain('git/worktrees')
    expect(names(effects)).not.toContain('review/worktree-inbox')
    expect(names(effects)).not.toContain('git/commit-models')
  })

  it('maps Review layer changes only to Git grouping and stacked-reading identities', () => {
    expect(
      names(gitReviewNotificationEffects(reviewNotificationFixtures['review.changed'])),
    ).toEqual([
      'git/flow',
      'git/range-flow',
      'git/diff',
      'git/range-diff',
      'git/diff-reading',
      'git/diff-reading',
    ])
    expect(
      gitReviewNotificationEffects(
        reviewChangeSchema.parse({ kind: 'review.changed', projectPath: OTHER_PROJECT }),
      ),
    ).not.toEqual(gitReviewNotificationEffects({ kind: 'review.changed', projectPath: PROJECT }))
  })

  it('validates the Git notification at the validating mock boundary', () => {
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
      effects.push(names(gitNotificationEffects(gitChangeSchema.parse(notification))))
    })

    expect(daemon.emit(gitNotificationFixtures['git.working-tree-changed'])).toEqual(
      gitNotificationFixtures['git.working-tree-changed'],
    )
    expect(effects).toHaveLength(1)
    expect(() => daemon.emit({ kind: 'git.working-tree-changed' })).toThrow()
    expect(() => daemon.emit({ kind: 'review.changed', projectPath: PROJECT })).toThrow()
  })
})
