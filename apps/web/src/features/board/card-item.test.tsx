import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CardItem } from './card-item'
import { boardCardAt, renderBoard } from './test-support'

const CARD = boardCardAt(0)

describe('CardItem', () => {
  it('renders the card title and opens card actions', async () => {
    const onEdit = vi.fn()
    renderBoard(<CardItem card={CARD} onEdit={onEdit} />)
    await waitFor(() => expect(screen.getByText(CARD.title)).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Card actions'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith(CARD)
  })
})
