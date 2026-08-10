import { describe, expect, it } from 'vitest'
import { GIT_CHANGE_KINDS, gitChangeSchema, gitNotificationFixtures } from './git.notifications'

describe('Git change notifications', () => {
  it('covers exactly the declared change categories', () => {
    expect(gitChangeSchema.options.map((option) => option.shape.kind.value)).toEqual([
      ...GIT_CHANGE_KINDS,
    ])
    expect(Object.keys(gitNotificationFixtures)).toEqual([...GIT_CHANGE_KINDS])
  })

  it('accepts the git.working-tree-changed fixture', () => {
    expect(gitChangeSchema.parse(gitNotificationFixtures['git.working-tree-changed'])).toEqual(
      gitNotificationFixtures['git.working-tree-changed'],
    )
  })

  it('rejects git.working-tree-changed without projectPath', () => {
    const { projectPath: _dropped, ...withoutProject } =
      gitNotificationFixtures['git.working-tree-changed']
    expect(gitChangeSchema.safeParse(withoutProject).success).toBe(false)
  })

  it('rejects git.working-tree-changed with an empty projectPath', () => {
    expect(
      gitChangeSchema.safeParse({
        ...gitNotificationFixtures['git.working-tree-changed'],
        projectPath: '',
      }).success,
    ).toBe(false)
  })

  it('rejects git.working-tree-changed carrying an unknown field', () => {
    expect(
      gitChangeSchema.safeParse({
        ...gitNotificationFixtures['git.working-tree-changed'],
        payload: 'entity',
      }).success,
    ).toBe(false)
  })

  it('rejects a generic changed kind', () => {
    expect(
      gitChangeSchema.safeParse({ kind: 'changed', projectPath: '/synthetic/repo' }).success,
    ).toBe(false)
  })
})
