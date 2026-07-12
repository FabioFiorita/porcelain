import { beforeEach, describe, expect, it } from 'vitest'
import { type Attachment, useAgentDraftsStore } from './agent-drafts'

const STORAGE_KEY = 'porcelain-agent-drafts'

const image = (id: string): Attachment => ({
  id,
  mediaType: 'image/png',
  base64: 'AAAA',
  dataUrl: 'data:image/png;base64,AAAA',
  thumbnail: null,
})

describe('useAgentDraftsStore', () => {
  beforeEach(() => {
    useAgentDraftsStore.setState({ drafts: {} })
    localStorage.removeItem(STORAGE_KEY)
  })

  it('setDraft creates then patches a thread draft without touching siblings', () => {
    const { setDraft } = useAgentDraftsStore.getState()
    setDraft('t1', { text: 'hello' })
    setDraft('t2', { text: 'other' })
    setDraft('t1', { images: [image('a')] })

    const { drafts } = useAgentDraftsStore.getState()
    expect(drafts.t1).toEqual({ text: 'hello', images: [image('a')] })
    expect(drafts.t2).toEqual({ text: 'other', images: [] })
  })

  it('clearDraft drops just that thread', () => {
    const { setDraft, clearDraft } = useAgentDraftsStore.getState()
    setDraft('t1', { text: 'a' })
    setDraft('t2', { text: 'b' })
    clearDraft('t1')

    expect(useAgentDraftsStore.getState().drafts.t1).toBeUndefined()
    expect(useAgentDraftsStore.getState().drafts.t2?.text).toBe('b')
  })

  it('persists only the text — images are stripped before serializing', () => {
    useAgentDraftsStore.getState().setDraft('t1', { text: 'keep me', images: [image('a')] })

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(persisted.state.drafts).toEqual({ t1: { text: 'keep me' } })
  })

  it('rehydrates text with images defaulted to [], dropping empty-text entries', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 0,
        state: { drafts: { t1: { text: 'survivor' }, t2: { text: '' } } },
      }),
    )
    await useAgentDraftsStore.persist.rehydrate()

    const { drafts } = useAgentDraftsStore.getState()
    expect(drafts.t1).toEqual({ text: 'survivor', images: [] })
    expect(drafts.t2).toBeUndefined()
  })
})
