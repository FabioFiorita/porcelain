import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { TerminalPastePort } from './terminal-ports'

export const PASTE_RETENTION_MS = 24 * 60 * 60_000

type PasteClock = Readonly<{ now(): number }>

function failure(): { ok: false; error: { code: 'terminal.paste-unavailable' } } {
  return { ok: false, error: { code: 'terminal.paste-unavailable' } }
}

export function safePasteFilename(filename: string): string {
  const leaf = filename.replaceAll('\\', '/').split('/').at(-1) ?? ''
  const safe = leaf.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+$/, '')
  return (safe === '' ? 'attachment' : safe).slice(0, 120)
}

export function createTerminalPasteAdapter(options: {
  root: string
  clock?: PasteClock
}): TerminalPastePort {
  const clock = options.clock ?? { now: () => Date.now() }

  return Object.freeze({
    async save(input) {
      if (
        input.id === '' ||
        input.id === '.' ||
        input.id === '..' ||
        basename(input.id) !== input.id
      ) {
        return failure()
      }
      const buffer = Buffer.from(input.dataBase64, 'base64')
      if (buffer.byteLength > input.maxBytes) return failure()

      const directory = join(options.root, input.id)
      const path = join(
        directory,
        `${clock.now()}-${randomBytes(4).toString('hex')}-${safePasteFilename(input.filename)}`,
      )
      try {
        await mkdir(directory, { mode: 0o700, recursive: true })
        await chmod(directory, 0o700)
        await writeFile(path, buffer, { mode: 0o600 })
      } catch {
        return failure()
      }
      return { ok: true, value: { path } }
    },

    async sweep(now) {
      let terminalIds: string[]
      try {
        terminalIds = await readdir(options.root)
      } catch {
        return
      }
      for (const terminalId of terminalIds) {
        const directory = join(options.root, terminalId)
        let files: string[]
        try {
          files = await readdir(directory)
        } catch {
          continue
        }
        for (const file of files) {
          const path = join(directory, file)
          const info = await stat(path).catch(() => null)
          if (info !== null && now - info.mtimeMs > PASTE_RETENTION_MS) {
            try {
              await rm(path, { force: true })
            } catch (error) {
              console.debug('[terminal-paste] sweep could not remove', path, error)
            }
          }
        }
      }
    },
  })
}
