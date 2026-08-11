// @vitest-environment node
import { chmod, readFile, stat, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MAX_PASTE_FILE_BYTES, MAX_PASTE_IMAGE_BYTES } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createTerminalPasteAdapter, PASTE_RETENTION_MS, safePasteFilename } from './terminal-paste'

const DATA_BASE64 = Buffer.from('attachment-bytes').toString('base64')
const EMPTY_ID = ''

describe('safePasteFilename', () => {
  it('keeps only the client filename leaf and replaces unsafe characters', () => {
    expect(safePasteFilename('../../Quarterly report.pdf')).toBe('Quarterly_report.pdf')
    expect(safePasteFilename('..')).toBe('attachment')
    expect(safePasteFilename('')).toBe('attachment')
  })
})

describe('createTerminalPasteAdapter', () => {
  it('writes inside the daemon root with bounded bytes and private permissions', async () => {
    await withTemporaryDirectory('porcelain-terminal-paste-', async (root) => {
      const adapter = createTerminalPasteAdapter({ root, clock: { now: () => 1_700_000_000_000 } })
      const result = await adapter.save({
        id: 'terminal-1',
        filename: '../../Quarterly report.pdf',
        dataBase64: DATA_BASE64,
        maxBytes: MAX_PASTE_FILE_BYTES,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.path.startsWith(join(root, 'terminal-1'))).toBe(true)
      expect(result.value.path).not.toContain('..')
      expect(result.value.path).toContain('Quarterly_report.pdf')
      expect(await readFile(result.value.path)).toEqual(Buffer.from(DATA_BASE64, 'base64'))
      expect((await stat(join(root, 'terminal-1'))).mode & 0o777).toBe(0o700)
      expect((await stat(result.value.path)).mode & 0o777).toBe(0o600)
    })
  })

  it('maps invalid ids and decoded oversize image/file payloads to a typed failure', async () => {
    await withTemporaryDirectory('porcelain-terminal-paste-failure-', async (root) => {
      const adapter = createTerminalPasteAdapter({ root })
      await expect(
        adapter.save({ id: EMPTY_ID, filename: 'a.txt', dataBase64: DATA_BASE64, maxBytes: 100 }),
      ).resolves.toEqual({ ok: false, error: { code: 'terminal.paste-unavailable' } })
      await expect(
        adapter.save({ id: '..', filename: 'a.txt', dataBase64: DATA_BASE64, maxBytes: 100 }),
      ).resolves.toEqual({ ok: false, error: { code: 'terminal.paste-unavailable' } })
      await expect(
        adapter.save({
          id: 'terminal-1',
          filename: 'image.png',
          dataBase64: Buffer.alloc(MAX_PASTE_IMAGE_BYTES + 1).toString('base64'),
          maxBytes: MAX_PASTE_IMAGE_BYTES,
        }),
      ).resolves.toEqual({ ok: false, error: { code: 'terminal.paste-unavailable' } })
      await expect(
        adapter.save({
          id: 'terminal-1',
          filename: 'file.bin',
          dataBase64: Buffer.alloc(MAX_PASTE_FILE_BYTES + 1).toString('base64'),
          maxBytes: MAX_PASTE_FILE_BYTES,
        }),
      ).resolves.toEqual({ ok: false, error: { code: 'terminal.paste-unavailable' } })
    })
  })

  it('maps an unwritable daemon root to a typed failure', async () => {
    await withTemporaryDirectory('porcelain-terminal-paste-unwritable-', async (root) => {
      const blockedRoot = join(root, 'not-a-directory')
      await writeFile(blockedRoot, 'occupied')
      const adapter = createTerminalPasteAdapter({ root: blockedRoot })

      await expect(
        adapter.save({
          id: 'terminal-1',
          filename: 'a.txt',
          dataBase64: DATA_BASE64,
          maxBytes: 100,
        }),
      ).resolves.toEqual({ ok: false, error: { code: 'terminal.paste-unavailable' } })
    })
  })

  it('sweeps only files older than the retention window', async () => {
    await withTemporaryDirectory('porcelain-terminal-paste-sweep-', async (root) => {
      const adapter = createTerminalPasteAdapter({ root })
      const old = await adapter.save({
        id: 'terminal-1',
        filename: 'old.txt',
        dataBase64: DATA_BASE64,
        maxBytes: 100,
      })
      const fresh = await adapter.save({
        id: 'terminal-1',
        filename: 'fresh.txt',
        dataBase64: DATA_BASE64,
        maxBytes: 100,
      })
      if (!old.ok || !fresh.ok) return
      const now = Date.now()
      const oldDate = new Date(now - PASTE_RETENTION_MS - 1)
      await utimes(old.value.path, oldDate, oldDate)
      await chmod(join(root, 'terminal-1'), 0o700)

      await adapter.sweep(now)

      await expect(stat(old.value.path)).rejects.toThrow()
      await expect(stat(fresh.value.path)).resolves.toBeDefined()
    })
  })
})
