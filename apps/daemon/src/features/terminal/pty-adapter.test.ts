// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('node-pty', () => ({ spawn: vi.fn() }))

import { createPtyAdapter } from './pty-adapter'

type FakePty = {
  write: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
  onData: (listener: (data: string) => void) => void
  onExit: (listener: (event: { exitCode: number }) => void) => void
  emitData: (data: string) => void
  emitExit: (exitCode: number) => void
}

function fakePty(): FakePty {
  let dataListener: ((data: string) => void) | undefined
  let exitListener: ((event: { exitCode: number }) => void) | undefined
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: (listener) => {
      dataListener = listener
    },
    onExit: (listener) => {
      exitListener = listener
    },
    emitData: (data) => dataListener?.(data),
    emitExit: (exitCode) => exitListener?.({ exitCode }),
  }
}

describe('createPtyAdapter', () => {
  it('maps the injected environment and process callbacks without spawning a shell', () => {
    const process = fakePty()
    const spawn = vi.fn(() => process)
    const adapter = createPtyAdapter({
      environment: {
        shell: '/bin/fish',
        environment: { PATH: '/usr/bin', TERM: 'xterm-256color' },
      },
      spawn,
    })
    const data = vi.fn()
    const exit = vi.fn()
    const pty = adapter.spawn({ cwd: '/synthetic/repo', cols: 120, rows: 40 })

    expect(spawn).toHaveBeenCalledWith('/bin/fish', ['-l'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: '/synthetic/repo',
      env: { PATH: '/usr/bin', TERM: 'xterm-256color' },
    })

    pty.onData(data)
    pty.onExit(exit)
    process.emitData('hello')
    process.emitExit(7)
    pty.write('input')
    pty.resize(80, 24)
    pty.kill()

    expect(data).toHaveBeenCalledWith('hello')
    expect(exit).toHaveBeenCalledWith(7)
    expect(process.write).toHaveBeenCalledWith('input')
    expect(process.resize).toHaveBeenCalledWith(80, 24)
    expect(process.kill).toHaveBeenCalledOnce()
  })
})
