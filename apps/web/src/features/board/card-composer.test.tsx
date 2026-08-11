import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CardComposer } from './card-composer'
import { useCardDraftStore } from './card-draft-store'
import { renderBoard } from './test-support'

describe('CardComposer', () => {
  beforeEach(() => {
    useCardDraftStore.setState({ draft: null })
  })

  it('opens a new-card draft with accessibility labels and saves', async () => {
    useCardDraftStore.getState().open({ title: '', body: '', status: 'todo' })
    const { mock } = renderBoard(<CardComposer />)

    expect(screen.getByLabelText('Card title')).toBeInTheDocument()
    expect(screen.getByLabelText('Card details')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'New work' } })
    fireEvent.click(screen.getByTestId('card-composer-save'))

    await waitFor(() => {
      expect(mock.requests().some((r) => r.procedure === 'createBoardCard')).toBe(true)
    })
  })
})
