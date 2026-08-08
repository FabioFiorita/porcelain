// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_PASTE_IMAGE_BYTES } from '@porcelain/contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Same reason terminal-manager.test.ts mocks this: a real PTY would spawn a real login
// shell per test. `write` is what this module's "ok" path asserts against.
vi.mock('node-pty', () => ({ spawn: () => makePty() }))

import {
  PASTE_RETENTION_MS,
  pasteFileToTerminal,
  pasteImageToTerminal,
  sweepPastedImages,
} from './image-paste'
import { createTerminal, type TerminalSender } from './terminal-manager'

interface FakePty {
  onData: (listener: (data: string) => void) => void
  onExit: (listener: (event: { exitCode: number }) => void) => void
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: (signal?: string) => void
}

const ptys: FakePty[] = []

function makePty(): FakePty {
  const pty: FakePty = {
    onData: () => {},
    onExit: () => {},
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  }
  ptys.push(pty)
  return pty
}

function makeSender(): TerminalSender {
  return { send: vi.fn(), isDestroyed: () => false }
}

/** A minimal, valid PNG: an actual decodable file, not just arbitrary bytes. */
const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

let home: string

beforeEach(async () => {
  ptys.length = 0
  home = await mkdtemp(join(tmpdir(), 'porcelain-image-paste-'))
  process.env.PORCELAIN_HOME = home
})

afterEach(async () => {
  delete process.env.PORCELAIN_HOME
  await rm(home, { recursive: true, force: true })
})

describe('pasteImageToTerminal', () => {
  it('refuses an unknown session before writing anything', async () => {
    const outcome = await pasteImageToTerminal({
      id: 'not-a-real-session',
      mime: 'image/png',
      dataBase64: ONE_PIXEL_PNG_BASE64,
    })
    expect(outcome).toEqual({ result: 'no-session' })
  })

  it('rejects a decoded payload over the cap without touching the PTY', async () => {
    const id = createTerminal(makeSender(), { name: 'shell', cwd: '/repo' })
    const oversized = Buffer.alloc(MAX_PASTE_IMAGE_BYTES + 1).toString('base64')

    const outcome = await pasteImageToTerminal({ id, mime: 'image/png', dataBase64: oversized })

    expect(outcome).toEqual({ result: 'too-large' })
    expect(ptys[0]?.write).not.toHaveBeenCalled()
  })

  it('writes the file, types a natural-language mention, and reports the path', async () => {
    const id = createTerminal(makeSender(), { name: 'shell', cwd: '/repo' })

    const outcome = await pasteImageToTerminal({
      id,
      mime: 'image/png',
      dataBase64: ONE_PIXEL_PNG_BASE64,
    })

    expect(outcome.result).toBe('ok')
    expect(outcome.path).toBeDefined()
    const path = outcome.path
    if (path === undefined) throw new Error('expected a path')

    // The file really landed under the daemon's own home, never a repo working tree.
    expect(path.startsWith(home)).toBe(true)
    expect(path.endsWith('.png')).toBe(true)
    const written = await readFile(path)
    expect(written).toEqual(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'))
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect((await stat(join(path, '..'))).mode & 0o777).toBe(0o700)

    // Inserted, not submitted: no trailing carriage return, matching a real paste.
    const call = (ptys[0]?.write as ReturnType<typeof vi.fn>).mock.calls.at(0)?.[0] as string
    expect(call).toContain('Analyze this image:')
    expect(call).toContain(path)
    expect(call.endsWith('\r')).toBe(false)
  })

  it('can upload without touching the prompt for atomic multi-image composer delivery', async () => {
    const id = createTerminal(makeSender(), { name: 'shell', cwd: '/repo' })

    const outcome = await pasteImageToTerminal({
      id,
      mime: 'image/png',
      dataBase64: ONE_PIXEL_PNG_BASE64,
      insert: false,
    })

    expect(outcome).toMatchObject({ path: expect.stringMatching(/\.png$/), result: 'ok' })
    expect(ptys[0]?.write).not.toHaveBeenCalled()
  })

  it('attaches through the PTY even when the daemon host has no X11 or Wayland clipboard', async () => {
    const display = process.env.DISPLAY
    const waylandDisplay = process.env.WAYLAND_DISPLAY
    delete process.env.DISPLAY
    delete process.env.WAYLAND_DISPLAY
    try {
      const id = createTerminal(makeSender(), { name: 'shell', cwd: '/repo' })
      const outcome = await pasteImageToTerminal({
        id,
        mime: 'image/png',
        dataBase64: ONE_PIXEL_PNG_BASE64,
      })

      expect(outcome.result).toBe('ok')
      expect(ptys[0]?.write).toHaveBeenCalledWith(expect.stringContaining('Analyze this image:'))
    } finally {
      if (display === undefined) delete process.env.DISPLAY
      else process.env.DISPLAY = display
      if (waylandDisplay === undefined) delete process.env.WAYLAND_DISPLAY
      else process.env.WAYLAND_DISPLAY = waylandDisplay
    }
  })

  it('replies no-session for a dead session even with a valid image', async () => {
    const id = createTerminal(makeSender(), { name: 'shell', cwd: '/repo' })
    const outcome = await pasteImageToTerminal({
      id: `${id}-stale`,
      mime: 'image/png',
      dataBase64: ONE_PIXEL_PNG_BASE64,
    })
    expect(outcome).toEqual({ result: 'no-session' })
  })
})

describe('pasteFileToTerminal', () => {
  it('writes a generic file under the daemon scratch directory and never uses a client path', async () => {
    const id = createTerminal(makeSender(), { name: 'shell', cwd: '/repo' })
    const outcome = await pasteFileToTerminal({
      dataBase64: Buffer.from('report').toString('base64'),
      filename: '../../Quarterly report.pdf',
      id,
      mime: 'application/pdf',
    })

    expect(outcome).toMatchObject({
      result: 'ok',
      path: expect.stringContaining('Quarterly_report.pdf'),
    })
    expect(outcome.path).not.toContain('../')
    expect(ptys[0]?.write).toHaveBeenCalledWith(expect.stringContaining('Analyze this file:'))
  })
})

describe('sweepPastedImages', () => {
  it('deletes only files older than the retention window', async () => {
    const dir = join(home, 'terminal-pastes', 'some-terminal')
    const stale = join(dir, 'old.png')
    const fresh = join(dir, 'new.png')
    await mkdir(dir, { recursive: true })
    await writeFile(stale, 'x')
    await writeFile(fresh, 'y')

    const now = Date.now()
    const old = new Date(now - PASTE_RETENTION_MS - 60_000)
    await utimes(stale, old, old)

    await sweepPastedImages(now)

    await expect(stat(stale)).rejects.toThrow()
    await expect(stat(fresh)).resolves.toBeDefined()
  })

  it('is a no-op when nothing has ever been pasted', async () => {
    await expect(sweepPastedImages()).resolves.toBeUndefined()
  })
})
