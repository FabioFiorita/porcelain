import { boardCardFixture } from '@porcelain/contracts/board'
import { beforeEach, describe, expect, it } from 'vitest'
import { draftFromCard, useCardDraftStore } from './card-draft-store'

describe('draftFromCard', () => {
  it('copies title, body, status, and id for edit', () => {
    const card = boardCardFixture({
      title: 'Ship',
      body: 'Details',
      status: 'doing',
    })
    expect(draftFromCard(card)).toEqual({
      id: card.id,
      title: 'Ship',
      body: 'Details',
      status: 'doing',
    })
  })

  it('uses an empty body when the card has none', () => {
    const card = boardCardFixture({ body: undefined })
    expect(draftFromCard(card).body).toBe('')
  })
})

describe('useCardDraftStore', () => {
  beforeEach(() => {
    useCardDraftStore.setState({ draft: null })
  })

  it('opens and closes an unpersisted draft', () => {
    useCardDraftStore.getState().open({ title: '', body: '', status: 'todo' })
    expect(useCardDraftStore.getState().draft).toEqual({
      title: '',
      body: '',
      status: 'todo',
    })
    useCardDraftStore.getState().close()
    expect(useCardDraftStore.getState().draft).toBeNull()
  })
})
