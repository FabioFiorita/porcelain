import {
  MAX_PASTE_FILE_BYTES,
  MAX_PASTE_IMAGE_BYTES,
  terminalFilePromptReference,
  terminalImagePromptReference,
} from '@porcelain/contracts/terminal'
import type {
  TerminalPastePort,
  TerminalPasteSuccess,
  TerminalResult,
  TerminalStreamFailure,
} from './terminal-ports'

/**
 * Pasting an attachment into a live session: store the bytes daemon-side, then type the path
 * the daemon minted. Split out of the session manager because it is about bytes and prompts,
 * not lifetime — the manager only lends it the two things it needs from a session.
 */

const MIME_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** What a paste needs from the session it targets: whether it is alive, and how to type. */
export type PasteTargetSession = Readonly<{
  status: 'running' | 'exited'
  write(data: string): void
}>

export type TerminalPasteOperations = Readonly<{
  pasteImage(input: {
    id: string
    mime: string
    dataBase64: string
    insert?: boolean
  }): Promise<TerminalResult<TerminalPasteSuccess, TerminalStreamFailure>>
  pasteFile(input: {
    id: string
    filename: string
    mime: string
    dataBase64: string
    insert?: boolean
  }): Promise<TerminalResult<TerminalPasteSuccess, TerminalStreamFailure>>
}>

export function createTerminalPasteOperations(options: {
  store: TerminalPastePort
  session: (id: string) => PasteTargetSession | undefined
}): TerminalPasteOperations {
  const { session: sessionFor, store } = options

  async function pasteAttachment(input: {
    id: string
    filename: string
    dataBase64: string
    maxBytes: number
    insert?: boolean
    prompt: (path: string) => string
  }): Promise<TerminalResult<TerminalPasteSuccess, TerminalStreamFailure>> {
    const session = sessionFor(input.id)
    if (session === undefined) return { ok: false, error: { code: 'terminal.not-found' } }
    if (session.status === 'exited') return { ok: false, error: { code: 'terminal.exited' } }
    const saved = await store.save(input)
    if (!saved.ok) return saved
    if (input.insert !== false) session.write(input.prompt(saved.value.path))
    return { ok: true, value: { result: 'ok', path: saved.value.path } }
  }

  return Object.freeze({
    pasteImage: (input) =>
      pasteAttachment({
        ...input,
        filename: `image.${MIME_EXTENSIONS[input.mime] ?? 'bin'}`,
        maxBytes: MAX_PASTE_IMAGE_BYTES,
        prompt: terminalImagePromptReference,
      }),
    pasteFile: (input) =>
      pasteAttachment({
        ...input,
        maxBytes: MAX_PASTE_FILE_BYTES,
        prompt: terminalFilePromptReference,
      }),
  })
}
