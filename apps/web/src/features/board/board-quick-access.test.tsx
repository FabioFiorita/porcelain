import { boardContractFixtures } from '@porcelain/contracts/board'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BoardQuickAccess } from './board-quick-access'
import { renderBoard } from './test-support'

describe('BoardQuickAccess', () => {
  it('focuses the first Doing card and exposes Start Review / Edit / Delete labels', async () => {
    renderBoard(<BoardQuickAccess />)
    const doing = boardContractFixtures.listBoardCards.output.find((c) => c.status === 'doing')
    await waitFor(() => expect(screen.getByText(doing!.title)).toBeInTheDocument())
    expect(screen.getByLabelText('Edit card')).toBeInTheDocument()
    expect(screen.getByLabelText('Start Review from this card')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete card')).toBeInTheDocument()
  })

  it('shows the empty Focus rail when there are no cards', async () => {
    renderBoard(<BoardQuickAccess />, {
      listBoardCards: () => ({ ok: true, value: [] }),
    })
    await waitFor(() => expect(screen.getByText('No cards yet')).toBeInTheDocument())
  })
})
