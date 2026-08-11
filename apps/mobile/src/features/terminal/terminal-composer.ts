import {
  MAX_TERMINAL_WRITE_CODE_UNITS,
  terminalFilePromptReference,
  terminalImagePromptReference,
} from '@porcelain/contracts/terminal'
import { create } from 'zustand'

type TerminalComposerAttachmentBase = {
  base64: string
  filename: string
  id: string
}

export type TerminalComposerAttachment =
  | (TerminalComposerAttachmentBase & {
      kind: 'image'
      mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
    })
  | (TerminalComposerAttachmentBase & { kind: 'file'; mime: string })

export type NewTerminalComposerAttachment =
  | Omit<Extract<TerminalComposerAttachment, { kind: 'image' }>, 'id'>
  | Omit<Extract<TerminalComposerAttachment, { kind: 'file' }>, 'id'>

export type TerminalComposerDraft = {
  attachments: TerminalComposerAttachment[]
  expanded: boolean
  text: string
}

type TerminalComposerState = {
  drafts: Record<string, TerminalComposerDraft | undefined>
  nextAttachmentId: number
  addAttachment: (id: string, attachment: NewTerminalComposerAttachment) => void
  clear: (id: string) => void
  removeAttachment: (id: string, attachmentId: string) => void
  setExpanded: (id: string, expanded: boolean) => void
  setText: (id: string, text: string) => void
}

const EMPTY_DRAFT: TerminalComposerDraft = { attachments: [], expanded: false, text: '' }

function draftFor(state: TerminalComposerState, id: string): TerminalComposerDraft {
  return state.drafts[id] ?? EMPTY_DRAFT
}

/**
 * Native composer state intentionally lives outside TerminalView. The view remounts when a
 * tablet changes its selected session, but an unfinished command belongs to the shell, not a
 * particular renderer mount.
 */
export const useTerminalComposerStore = create<TerminalComposerState>()((set) => ({
  addAttachment: (id, attachment) => {
    set((state) => {
      const draft = draftFor(state, id)
      // The id is only local UI identity. Image bytes remain the source of truth until the
      // daemon accepts them, so no timestamp/random value has product meaning here.
      const localId = `attachment-${state.nextAttachmentId}`
      const withId: TerminalComposerAttachment =
        attachment.kind === 'image'
          ? { ...attachment, id: localId }
          : { ...attachment, id: localId }
      return {
        drafts: {
          ...state.drafts,
          [id]: { ...draft, attachments: [...draft.attachments, withId] },
        },
        nextAttachmentId: state.nextAttachmentId + 1,
      }
    })
  },
  clear: (id) => {
    set((state) => ({ drafts: { ...state.drafts, [id]: EMPTY_DRAFT } }))
  },
  drafts: {},
  nextAttachmentId: 1,
  removeAttachment: (id, attachmentId) => {
    set((state) => {
      const draft = draftFor(state, id)
      return {
        drafts: {
          ...state.drafts,
          [id]: {
            ...draft,
            attachments: draft.attachments.filter((attachment) => attachment.id !== attachmentId),
          },
        },
      }
    })
  },
  setExpanded: (id, expanded) => {
    set((state) => {
      const draft = draftFor(state, id)
      return { drafts: { ...state.drafts, [id]: { ...draft, expanded } } }
    })
  },
  setText: (id, text) => {
    set((state) => {
      const draft = draftFor(state, id)
      return { drafts: { ...state.drafts, [id]: { ...draft, text } } }
    })
  },
}))

export type ComposerDelivery = {
  attachments: readonly TerminalComposerAttachment[]
  bracketedPaste: boolean
  submit: boolean
  text: string
}

export type ComposerDeliveryResult =
  | { result: 'ok' }
  | { result: 'attachment-failed'; failure: 'no-session' | 'too-large' | 'write-failed' }
  | { result: 'too-large' }

export type ComposerDeliveryDependencies = {
  upload: (
    attachment: TerminalComposerAttachment,
  ) => Promise<{ path?: string; result: 'ok' | 'no-session' | 'too-large' | 'write-failed' }>
  write: (bytes: string) => void
}

/**
 * Bytes written by the composer are a terminal paste, not keyboard events. In bracketed-paste
 * mode even a one-character draft carries the delimiters: the program asked to distinguish a
 * paste from typing. Send's Return is deliberately outside the delimiters so it submits only
 * after the application has accepted the complete draft.
 */
export function composerDeliveryBytes({
  bracketedPaste,
  submit,
  text,
}: Omit<ComposerDelivery, 'attachments'>): string {
  const body = text.replace(/\n/g, '\r')
  const paste = bracketedPaste && body !== '' ? `\x1b[200~${body}\x1b[201~` : body
  return submit ? `${paste}\r` : paste
}

/**
 * Upload first, insert once. The daemon leaves `insert: false` uploads out of the PTY entirely;
 * only after every file returned a path do we insert the ordered references, command draft, and
 * optional Return as a single frame. A retry after any failed upload therefore cannot duplicate
 * a partial prompt.
 */
export async function deliverComposerDraft(
  delivery: ComposerDelivery,
  dependencies: ComposerDeliveryDependencies,
): Promise<ComposerDeliveryResult> {
  const references: string[] = []
  for (const attachment of delivery.attachments) {
    const outcome = await dependencies
      .upload(attachment)
      .catch(() => ({ result: 'write-failed' as const }))
    if (outcome.result !== 'ok') return { failure: outcome.result, result: 'attachment-failed' }
    if (outcome.path === undefined) {
      return { failure: 'write-failed', result: 'attachment-failed' }
    }
    references.push(
      attachment.kind === 'image'
        ? terminalImagePromptReference(outcome.path)
        : terminalFilePromptReference(outcome.path),
    )
  }
  const bytes = `${references.join('')}${composerDeliveryBytes(delivery)}`
  if (bytes.length > MAX_TERMINAL_WRITE_CODE_UNITS) return { result: 'too-large' }
  dependencies.write(bytes)
  return { result: 'ok' }
}
