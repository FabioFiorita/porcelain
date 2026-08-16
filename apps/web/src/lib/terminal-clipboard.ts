/**
 * Renderer-neutral terminal clipboard policy.  The terminal renderer decides how text
 * is injected (Ghostty currently uses `paste()`); this module decides which clipboard
 * representation is meaningful to a remote PTY.  Keeping that distinction here lets a
 * future renderer such as Ghostty retain the same host clipboard behaviour.
 */

export const TERMINAL_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const

export type TerminalImageMime = (typeof TERMINAL_IMAGE_MIME_TYPES)[number]

export type TerminalClipboardImage = {
  mime: TerminalImageMime
  dataBase64: string
}

export type TerminalClipboardContents = {
  text: string
  image: TerminalClipboardImage | null
}

export type TerminalPasteKind = 'text' | 'image' | 'empty'

export function isTerminalImageMime(mime: string): mime is TerminalImageMime {
  return (TERMINAL_IMAGE_MIME_TYPES as readonly string[]).includes(mime)
}

/**
 * An image wins when a clipboard carries both formats. Image paste is an attachment
 * transfer to the daemon; pasting a browser-generated text alternative into the remote
 * shell would otherwise reproduce the X11/Wayland clipboard failure this path replaces.
 */
export function terminalPasteKind(
  contents: TerminalClipboardContents,
  imageOnly: boolean = false,
): TerminalPasteKind {
  if (contents.image !== null) return 'image'
  if (!imageOnly && contents.text !== '') return 'text'
  return 'empty'
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('unexpected FileReader result'))
        return
      }
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}
