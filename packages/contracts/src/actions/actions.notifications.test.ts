import { describe, expect, it } from 'vitest'
import {
  ACTIONS_CHANGE_KINDS,
  actionsChangeSchema,
  actionsNotificationFixtures,
} from './actions.notifications'

describe('Actions change notifications', () => {
  it('covers exactly the declared change categories', () => {
    expect(actionsChangeSchema.options.map((option) => option.shape.kind.value)).toEqual([
      ...ACTIONS_CHANGE_KINDS,
    ])
    expect(Object.keys(actionsNotificationFixtures)).toEqual([...ACTIONS_CHANGE_KINDS])
  })

  it('accepts the actions.changed fixture', () => {
    expect(actionsChangeSchema.parse(actionsNotificationFixtures['actions.changed'])).toEqual(
      actionsNotificationFixtures['actions.changed'],
    )
  })

  it('rejects actions.changed without projectId', () => {
    const { projectId: _dropped, ...withoutProject } =
      actionsNotificationFixtures['actions.changed']
    expect(actionsChangeSchema.safeParse(withoutProject).success).toBe(false)
  })

  it('rejects actions.changed with an empty projectId', () => {
    expect(
      actionsChangeSchema.safeParse({
        ...actionsNotificationFixtures['actions.changed'],
        projectId: '',
      }).success,
    ).toBe(false)
  })

  it('rejects actions.changed carrying an unknown field', () => {
    expect(
      actionsChangeSchema.safeParse({
        ...actionsNotificationFixtures['actions.changed'],
        payload: 'entity',
      }).success,
    ).toBe(false)
  })

  it('rejects a generic changed kind', () => {
    expect(
      actionsChangeSchema.safeParse({ kind: 'changed', projectId: 'proj-alpha' }).success,
    ).toBe(false)
  })
})
