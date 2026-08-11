import { describe, expect, it } from 'vitest'
import { sessionWatchesFrameSchema } from '../session'
import { terminalOutputFrameSchema } from '../terminal'
import { boardNotificationFixture } from './board.fixtures'
import {
  BOARD_CHANGE_KINDS,
  boardChangeSchema,
  boardNotificationFixtures,
} from './board.notifications'

describe('Board change notifications', () => {
  it('covers exactly the declared change categories', () => {
    expect(boardChangeSchema.options.map((option) => option.shape.kind.value)).toEqual([
      ...BOARD_CHANGE_KINDS,
    ])
    expect(Object.keys(boardNotificationFixtures)).toEqual([...BOARD_CHANGE_KINDS])
  })

  it('accepts the board.changed fixture', () => {
    expect(boardChangeSchema.parse(boardNotificationFixtures['board.changed'])).toEqual(
      boardNotificationFixtures['board.changed'],
    )
    expect(boardChangeSchema.parse(boardNotificationFixture())).toEqual(boardNotificationFixture())
  })

  it('is a notification and cannot parse as watch or stream traffic', () => {
    const notification = boardNotificationFixture()
    expect(boardChangeSchema.safeParse(notification).success).toBe(true)
    expect(sessionWatchesFrameSchema.safeParse(notification).success).toBe(false)
    expect(terminalOutputFrameSchema.safeParse(notification).success).toBe(false)
  })

  it('rejects board.changed without projectPath', () => {
    const { projectPath: _dropped, ...withoutProject } = boardNotificationFixtures['board.changed']
    expect(boardChangeSchema.safeParse(withoutProject).success).toBe(false)
  })

  it('rejects board.changed with an empty projectPath', () => {
    expect(
      boardChangeSchema.safeParse({
        ...boardNotificationFixtures['board.changed'],
        projectPath: '',
      }).success,
    ).toBe(false)
  })

  it('rejects board.changed carrying an unknown field', () => {
    expect(
      boardChangeSchema.safeParse({
        ...boardNotificationFixtures['board.changed'],
        payload: 'entity',
      }).success,
    ).toBe(false)
  })

  it('rejects a generic changed kind', () => {
    expect(
      boardChangeSchema.safeParse({ kind: 'changed', projectPath: '/synthetic/repo' }).success,
    ).toBe(false)
  })
})
