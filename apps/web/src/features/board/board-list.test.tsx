import { boardContractFixtures } from '@porcelain/contracts/board'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BoardList } from './board-list'
import { renderBoard } from './test-support'

describe('BoardList', () => {
  it('renders column labels, card titles, and add accessibility labels', async () => {
    renderBoard(<BoardList />)
    await waitFor(() =>
      expect(
        screen.getByText(boardContractFixtures.listBoardCards.output[0]!.title),
      ).toBeInTheDocument(),
    )
    // "Open board" portals into the sidebar header slot (absent in isolation).
    expect(screen.getByRole('button', { name: 'Add card to To do' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add card to Doing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add card to Done' })).toBeInTheDocument()
  })

  it('surfaces a failed Board read distinctly from an empty Board', async () => {
    renderBoard(<BoardList />, {
      listBoardCards: () => ({
        ok: false,
        error: {
          code: 'board.unavailable',
          category: 'unavailable',
          message: 'The board is unavailable.',
          retryable: true,
          requestId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    })
    await waitFor(() => expect(screen.getByText(/Couldn't load the board/i)).toBeInTheDocument())
  })
})
