import { boardProjectPathSchema } from '@porcelain/contracts/board'
import { describe, expect, it } from 'vitest'
import { boardCardsQuery } from './board-queries'

const PATH_A = boardProjectPathSchema.parse('/synthetic/repo-a')
const PATH_B = boardProjectPathSchema.parse('/synthetic/repo-b')

describe('boardCardsQuery', () => {
  it('produces equal identities for the same Project path', () => {
    expect(boardCardsQuery(PATH_A)).toEqual(boardCardsQuery(PATH_A))
    expect(boardCardsQuery(PATH_A)).toEqual({
      domain: 'board',
      name: 'cards',
      projectPath: PATH_A,
    })
  })

  it('produces distinct identities for different Project paths', () => {
    expect(boardCardsQuery(PATH_A)).not.toEqual(boardCardsQuery(PATH_B))
    expect(boardCardsQuery(PATH_A).projectPath).toBe(PATH_A)
    expect(boardCardsQuery(PATH_B).projectPath).toBe(PATH_B)
  })
})
