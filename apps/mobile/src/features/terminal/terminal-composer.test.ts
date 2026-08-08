import { describe, expect, it, vi } from 'vitest'

import {
  composerDeliveryBytes,
  deliverComposerDraft,
  useTerminalComposerStore,
} from './terminal-composer'

describe('terminal command composer drafts', () => {
  it('keeps drafts scoped to their terminal sessions', () => {
    const store = useTerminalComposerStore.getState()
    store.clear('composer-one')
    store.clear('composer-two')
    store.setText('composer-one', 'git status')
    store.addAttachment('composer-one', {
      base64: 'one',
      filename: 'one.png',
      kind: 'image',
      mime: 'image/png',
    })
    store.setText('composer-two', 'pnpm test')

    const drafts = useTerminalComposerStore.getState().drafts
    expect(drafts['composer-one']).toMatchObject({ text: 'git status' })
    expect(drafts['composer-one']?.attachments).toHaveLength(1)
    expect(drafts['composer-two']).toMatchObject({ attachments: [], text: 'pnpm test' })
  })

  it('removes one queued image without reusing its local identity', () => {
    const store = useTerminalComposerStore.getState()
    store.clear('composer-remove')
    store.addAttachment('composer-remove', {
      base64: 'first',
      filename: 'first.png',
      kind: 'image',
      mime: 'image/png',
    })
    store.addAttachment('composer-remove', {
      base64: 'second',
      filename: 'second.pdf',
      kind: 'file',
      mime: 'application/pdf',
    })
    const firstId =
      useTerminalComposerStore.getState().drafts['composer-remove']?.attachments[0]?.id
    if (firstId === undefined) throw new Error('expected a queued attachment')

    store.removeAttachment('composer-remove', firstId)
    store.addAttachment('composer-remove', {
      base64: 'third',
      filename: 'third.png',
      kind: 'image',
      mime: 'image/png',
    })

    expect(useTerminalComposerStore.getState().drafts['composer-remove']?.attachments).toEqual([
      expect.objectContaining({ base64: 'second' }),
      expect.objectContaining({ base64: 'third' }),
    ])
    expect(
      new Set(
        useTerminalComposerStore
          .getState()
          .drafts['composer-remove']?.attachments.map((attachment) => attachment.id),
      ).size,
    ).toBe(2)
  })
})

describe('terminal command composer bytes', () => {
  it('inserts multiline text without appending Return', () => {
    expect(composerDeliveryBytes({ bracketedPaste: false, submit: false, text: 'one\ntwo' })).toBe(
      'one\rtwo',
    )
  })

  it('brackets an insert and appends Send Return after the paste completes', () => {
    expect(composerDeliveryBytes({ bracketedPaste: true, submit: true, text: 'one\ntwo' })).toBe(
      '\x1b[200~one\rtwo\x1b[201~\r',
    )
  })
})

describe('terminal command composer attachment delivery', () => {
  it('uploads every image in order, then writes all references and the command once', async () => {
    const events: string[] = []
    const result = await deliverComposerDraft(
      {
        attachments: [
          {
            base64: 'first',
            filename: 'first.png',
            id: 'image-1',
            kind: 'image',
            mime: 'image/png',
          },
          {
            base64: 'second',
            filename: 'second.pdf',
            id: 'image-2',
            kind: 'file',
            mime: 'application/pdf',
          },
        ],
        bracketedPaste: false,
        submit: true,
        text: 'describe this',
      },
      {
        upload: async (attachment) => {
          events.push(`upload:${attachment.id}`)
          return { path: `/daemon/${attachment.id}.png`, result: 'ok' }
        },
        write: (bytes) => {
          events.push(`write:${bytes}`)
        },
      },
    )

    expect(result).toEqual({ result: 'ok' })
    expect(events).toEqual([
      'upload:image-1',
      'upload:image-2',
      'write:Analyze this image: /daemon/image-1.png Analyze this file: /daemon/image-2.png describe this\r',
    ])
  })

  it('does not write anything when the second image upload fails, so retry is safe', async () => {
    const write = vi.fn()
    const uploads: string[] = []
    const result = await deliverComposerDraft(
      {
        attachments: [
          {
            base64: 'first',
            filename: 'first.png',
            id: 'image-1',
            kind: 'image',
            mime: 'image/png',
          },
          {
            base64: 'too-big',
            filename: 'second.png',
            id: 'image-2',
            kind: 'image',
            mime: 'image/png',
          },
        ],
        bracketedPaste: false,
        submit: true,
        text: 'describe this',
      },
      {
        upload: async (attachment) => {
          uploads.push(attachment.id)
          return attachment.id === 'image-2'
            ? { result: 'too-large' }
            : { path: '/daemon/image-1.png', result: 'ok' }
        },
        write,
      },
    )

    expect(result).toEqual({ failure: 'too-large', result: 'attachment-failed' })
    expect(uploads).toEqual(['image-1', 'image-2'])
    expect(write).not.toHaveBeenCalled()
  })

  it('writes exactly once when a retained draft is retried after its second upload recovers', async () => {
    const write = vi.fn()
    const delivery = {
      attachments: [
        {
          base64: 'first',
          filename: 'first.png',
          id: 'image-1',
          kind: 'image' as const,
          mime: 'image/png' as const,
        },
        {
          base64: 'second',
          filename: 'second.png',
          id: 'image-2',
          kind: 'image' as const,
          mime: 'image/png' as const,
        },
      ],
      bracketedPaste: false,
      submit: false,
      text: 'inspect both',
    }
    let attempt = 0
    const upload = async (attachment: { id: string }) => {
      if (attachment.id === 'image-2' && attempt++ === 0) return { result: 'write-failed' as const }
      return { path: `/daemon/${attachment.id}.png`, result: 'ok' as const }
    }

    await expect(deliverComposerDraft(delivery, { upload, write })).resolves.toEqual({
      failure: 'write-failed',
      result: 'attachment-failed',
    })
    await expect(deliverComposerDraft(delivery, { upload, write })).resolves.toEqual({
      result: 'ok',
    })

    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(
      'Analyze this image: /daemon/image-1.png Analyze this image: /daemon/image-2.png inspect both',
    )
  })

  it('keeps the command unsent when the image request rejects', async () => {
    const write = vi.fn()
    const result = await deliverComposerDraft(
      {
        attachments: [
          {
            base64: 'unavailable',
            filename: 'one.png',
            id: 'image-1',
            kind: 'image',
            mime: 'image/png',
          },
        ],
        bracketedPaste: false,
        submit: false,
        text: 'describe this',
      },
      {
        upload: async () => Promise.reject(new Error('offline')),
        write,
      },
    )

    expect(result).toEqual({ failure: 'write-failed', result: 'attachment-failed' })
    expect(write).not.toHaveBeenCalled()
  })
})
