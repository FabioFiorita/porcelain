import { boardContractFixtures, boardProcedures } from '@porcelain/contracts/board'
import { describe, expect, it, vi } from 'vitest'

import { callDaemon, namedContractProcedure } from './procedure'

/** Structural client seam used by callDaemon — only query/mutation are exercised here. */
type TransportClient = {
  query: (name: string, input: unknown) => Promise<unknown>
  mutation: (name: string, input: unknown) => Promise<unknown>
}

describe('canonical structural procedure descriptors', () => {
  it('accepts a BRD-001 contract descriptor with catalog name for callDaemon', async () => {
    const procedure = namedContractProcedure('listBoardCards', boardProcedures.listBoardCards)
    expect(procedure.kind).toBe('query')
    expect(procedure.name).toBe('listBoardCards')
    expect(procedure.input).toBe(boardProcedures.listBoardCards.input)
    expect(procedure.output).toBe(boardProcedures.listBoardCards.output)
    expect(procedure.errors).toEqual(['board.unavailable'])

    const cards = boardContractFixtures.listBoardCards.output
    const client: TransportClient = {
      query: vi.fn(async (_name: string, input: unknown) => {
        expect(input).toBe(boardContractFixtures.listBoardCards.input)
        return cards
      }),
      mutation: vi.fn(),
    }

    // callDaemon's first arg is DaemonClient; the structural subset is enough for this unit.
    const result = await callDaemon(
      client as Parameters<typeof callDaemon>[0],
      procedure,
      boardContractFixtures.listBoardCards.input,
    )
    expect(result).toEqual(cards)
    expect(client.query).toHaveBeenCalledWith(
      'listBoardCards',
      boardContractFixtures.listBoardCards.input,
    )
  })

  it('rejects invalid contract input before transport', async () => {
    const procedure = namedContractProcedure('listBoardCards', boardProcedures.listBoardCards)
    const client: TransportClient = {
      query: vi.fn(),
      mutation: vi.fn(),
    }

    await expect(
      callDaemon(client as Parameters<typeof callDaemon>[0], procedure, ''),
    ).rejects.toThrow()
    expect(client.query).not.toHaveBeenCalled()
  })
})
