import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClearColumnButton } from './clear-column-button'
import { renderBoard } from './test-support'

describe('ClearColumnButton', () => {
  it('renders nothing when the column is empty', () => {
    renderBoard(<ClearColumnButton status="done" count={0} />)
    expect(screen.queryByLabelText('Clear Done')).not.toBeInTheDocument()
  })

  it('confirms before clearing and issues clearBoardColumn', async () => {
    const { mock } = renderBoard(<ClearColumnButton status="done" count={2} />)
    fireEvent.click(screen.getByLabelText('Clear Done'))
    expect(screen.getByText('Clear Done?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => {
      expect(mock.requests().some((r) => r.procedure === 'clearBoardColumn')).toBe(true)
    })
  })
})
