import { MAX_PASTE_FILE_BYTES } from '@porcelain/contracts/terminal'
import { terminalAdapterFor, terminalPasteFailureMessage } from '@renderer/features/terminal'
import { runUserAction } from '@shared/background'
import { toast } from 'sonner'
import { blobToBase64 } from './terminal-clipboard'

export const PASTE_FILE_TOO_LARGE_MESSAGE = 'That file is too large to attach (8 MiB limit).'

/**
 * Transfer browser/Electron-selected files as bytes to the terminal's daemon. `File.name` is
 * only a display hint; the daemon sanitizes it and mints the actual scratch-file path, so a
 * browser path or drag payload can never be interpreted as a daemon-local path.
 */
async function attachTerminalFile(id: string, file: File): Promise<void> {
  if (file.size > MAX_PASTE_FILE_BYTES) {
    toast.error('Could not attach the file', {
      description: PASTE_FILE_TOO_LARGE_MESSAGE,
    })
    return
  }
  try {
    await terminalAdapterFor(id).pasteFileToTerminal({
      id,
      filename: file.name || 'attachment',
      mime: file.type || 'application/octet-stream',
      dataBase64: await blobToBase64(file),
    })
  } catch (error: unknown) {
    toast.error('Could not attach the file', {
      description: terminalPasteFailureMessage(error),
    })
  }
}

/** Attach dropped or selected files in the order the host supplied them. */
export async function attachTerminalFiles(id: string, files: readonly File[]): Promise<void> {
  for (const file of files) await attachTerminalFile(id, file)
}

/** Native picker shared by Electron and browsers; no local path is exposed to the daemon. */
export function chooseTerminalFiles(id: string): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? [])
    runUserAction(
      async () => {
        try {
          await attachTerminalFiles(id, files)
        } finally {
          input.remove()
        }
      },
      (error) => {
        toast.error('Could not attach the file', {
          description: error instanceof Error ? error.message : String(error),
        })
        input.remove()
      },
    )
  })
  input.click()
}
