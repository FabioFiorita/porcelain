import { boardContractFixtures } from '@porcelain/contracts/board'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BoardView } from './board-view'
import { renderBoard } from './test-support'

describe('BoardView', () => {
  it('renders the wide kanban columns and cards', async () => {
    renderBoard(<BoardView />)
    await waitFor(() =>
      expect(
        screen.getByText(boardContractFixtures.listBoardCards.output[0]!.title),
      ).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Add card to To do')).toBeInTheDocument()
  })

  it('shows empty-column copy when a column has no cards', async () => {
    renderBoard(<BoardView />, {
      listBoardCards: () => ({ ok: true, value: [] }),
    })
    await waitFor(() => expect(screen.getAllByText('No cards yet').length).toBeGreaterThan(0))
  })
})
