/**
 * Renderer-neutral terminal clipboard policy.  The terminal renderer decides how text
 * is injected (Ghostty currently uses `paste()`); this module decides which clipboard
 * representation is meaningful to a remote PTY.  Keeping that distinction here lets a
 * future renderer such as Ghostty retain the same host clipboard behaviour.
 */

export type TerminalClipboardContents = {
  text: string
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
