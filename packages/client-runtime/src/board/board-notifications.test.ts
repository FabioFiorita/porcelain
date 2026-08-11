import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import {
  boardChangeSchema,
  boardContractFixtures,
  boardNotificationFixture,
  boardProcedures,
  boardProjectPathSchema,
} from '@porcelain/contracts/board'
import { describe, expect, it } from 'vitest'
import { boardNotificationEffects } from './board-notifications'
import { boardCardsQuery } from './board-queries'

const PROJECT = boardProjectPathSchema.parse('/synthetic/repo')
const OTHER = boardProjectPathSchema.parse('/synthetic/other')

const boardCatalog = {
  procedures: {
    listBoardCards: boardProcedures.listBoardCards,
  },
  notification: boardChangeSchema,
  publicError: publicErrorSchema,
}

describe('boardNotificationEffects', () => {
  it('maps a valid board.changed fixture to one cards identity for its Project', () => {
    const notification = boardNotificationFixture(PROJECT)
    expect(boardNotificationEffects(notification)).toEqual([boardCardsQuery(PROJECT)])
    expect(boardNotificationEffects(notification)).not.toEqual([boardCardsQuery(OTHER)])
  })

  it('rejects malformed and unrelated notifications via the contract mock', () => {
    const daemon = createValidatingDaemonMock(boardCatalog, {
      listBoardCards: () => ({
        ok: true,
        value: boardContractFixtures.listBoardCards.output,
      }),
    })

    const seen: unknown[] = []
    daemon.subscribe((notification) => {
      seen.push(boardNotificationEffects(boardChangeSchema.parse(notification)))
    })

    const valid = boardNotificationFixture(PROJECT)
    expect(daemon.emit(valid)).toEqual(valid)
    expect(seen).toEqual([[boardCardsQuery(PROJECT)]])

    // Missing projectPath
    expect(() => daemon.emit({ kind: 'board.changed' })).toThrow()
    // Empty projectPath
    expect(() => daemon.emit({ kind: 'board.changed', projectPath: '' })).toThrow()
    // Unknown field
    expect(() =>
      daemon.emit({ kind: 'board.changed', projectPath: PROJECT, payload: true }),
    ).toThrow()
    // Unrelated kind
    expect(() => daemon.emit({ kind: 'files.tree-changed', projectPath: PROJECT })).toThrow()
    // Raw legacy event string envelope
    expect(() => daemon.emit({ type: 'board' })).toThrow()

    expect(seen).toHaveLength(1)
  })
})
