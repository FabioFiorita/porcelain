import {
  type TerminalAttachValue,
  terminalClientFrameSchema,
  terminalServerFrameSchema,
} from '@porcelain/contracts/terminal'
import { describe, expect, it, vi } from 'vitest'
import type { TerminalOperations, TerminalStreamSink } from './terminal-ports'
import { createTerminalStreamGateway } from './terminal-stream-gateway'

const ATTACHMENT: TerminalAttachValue = {
  id: 'terminal-1',
  scrollback: 'ready',
  status: 'running',
  epoch: 'epoch-1',
  sequence: 4,
}

function makeOperations(): TerminalOperations {
  return {
    create: vi.fn(() => ({ ok: true, value: 'terminal-1' })),
    attach: vi.fn(() => ({ ok: true, value: ATTACHMENT })),
    detach: vi.fn(() => ({ ok: true, value: undefined })),
    write: vi.fn(() => ({ ok: true, value: undefined })),
    resize: vi.fn(() => ({ ok: true, value: undefined })),
    kill: vi.fn(() => ({ ok: true, value: undefined })),
    pasteImage: vi.fn(async () => ({ ok: true, value: { result: 'ok' } })),
    pasteFile: vi.fn(async () => ({ ok: true, value: { result: 'ok' } })),
    list: vi.fn(() => []),
    rename: vi.fn(),
    detachSink: vi.fn(),
    sweep: vi.fn(),
  }
}

function makeSink(): TerminalStreamSink & { frames: unknown[] } {
  const frames: unknown[] = []
  return { frames, isAlive: () => true, send: (frame) => frames.push(frame) }
}

function command(value: unknown) {
  return terminalClientFrameSchema.parse(value)
}

async function flushBackgroundWork(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Terminal stream gateway', () => {
  it('correlates lifecycle and attach success frames with strict contract values', () => {
    const operations = makeOperations()
    const sink = makeSink()
    const gateway = createTerminalStreamGateway({ operations, sink })

    gateway.receive(
      command({ t: 'terminal:create', reqId: 'create-1', name: 'shell', cwd: '/repo' }),
    )
    gateway.receive(command({ t: 'terminal:attach', reqId: 'attach-1', id: 'terminal-1' }))

    expect(sink.frames).toEqual([
      { t: 'terminal:created', reqId: 'create-1', id: 'terminal-1' },
      { t: 'terminal:attached', reqId: 'attach-1', ...ATTACHMENT },
    ])
    for (const frame of sink.frames) terminalServerFrameSchema.parse(frame)
    expect(operations.create).toHaveBeenCalledWith(
      expect.objectContaining({ reqId: 'create-1', cwd: '/repo' }),
      sink,
    )
    expect(operations.attach).toHaveBeenCalledWith('terminal-1', sink)
  })

  it('does not reply to successful no-reply commands and detaches the sink explicitly', () => {
    const operations = makeOperations()
    const sink = makeSink()
    const gateway = createTerminalStreamGateway({ operations, sink })

    gateway.receive(command({ t: 'terminal:detach', reqId: 'detach-1', id: 'terminal-1' }))
    gateway.receive(
      command({ t: 'terminal:write', reqId: 'write-1', id: 'terminal-1', data: 'ls' }),
    )
    gateway.receive(
      command({ t: 'terminal:resize', reqId: 'resize-1', id: 'terminal-1', cols: 80, rows: 24 }),
    )
    gateway.receive(command({ t: 'terminal:kill', reqId: 'kill-1', id: 'terminal-1' }))

    expect(sink.frames).toEqual([])
    expect(operations.detach).toHaveBeenCalledWith('terminal-1', sink)
    expect(operations.write).toHaveBeenCalledWith('terminal-1', 'ls')
    expect(operations.resize).toHaveBeenCalledWith('terminal-1', 80, 24)
    expect(operations.kill).toHaveBeenCalledWith('terminal-1')

    gateway.detach()
    expect(operations.detachSink).toHaveBeenCalledWith(sink)
  })

  it('maps typed failures to a fresh public error while preserving request and target ids', () => {
    const operations = makeOperations()
    vi.mocked(operations.attach).mockReturnValue({
      ok: false,
      error: { code: 'terminal.not-found' },
    })
    const sink = makeSink()
    const gateway = createTerminalStreamGateway({ operations, sink })

    gateway.receive(command({ t: 'terminal:attach', reqId: 'missing-1', id: 'ghost' }))

    const frame = terminalServerFrameSchema.parse(sink.frames[0])
    expect(frame).toMatchObject({
      t: 'terminal:error',
      reqId: 'missing-1',
      id: 'ghost',
      error: { code: 'terminal.not-found', category: 'not-found', retryable: false },
    })
    if (frame.t !== 'terminal:error') throw new Error('expected an error frame')
    expect(frame.error.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('returns async image/file paste results and correlates async failures', async () => {
    const operations = makeOperations()
    const sink = makeSink()
    const gateway = createTerminalStreamGateway({ operations, sink })

    gateway.receive(
      command({
        t: 'terminal:paste-image',
        reqId: 'image-1',
        id: 'terminal-1',
        mime: 'image/png',
        dataBase64: 'YWJj',
      }),
    )
    gateway.receive(
      command({
        t: 'terminal:paste-file',
        reqId: 'file-1',
        id: 'terminal-1',
        filename: 'report.pdf',
        mime: 'application/pdf',
        dataBase64: 'YWJj',
      }),
    )
    await flushBackgroundWork()

    expect(sink.frames).toEqual([
      { t: 'terminal:image-pasted', reqId: 'image-1', id: 'terminal-1', result: 'ok' },
      { t: 'terminal:file-pasted', reqId: 'file-1', id: 'terminal-1', result: 'ok' },
    ])
    for (const frame of sink.frames) terminalServerFrameSchema.parse(frame)

    vi.mocked(operations.pasteImage).mockResolvedValueOnce({
      ok: false,
      error: { code: 'terminal.paste-unavailable' },
    })
    gateway.receive(
      command({
        t: 'terminal:paste-image',
        reqId: 'image-2',
        id: 'terminal-1',
        mime: 'image/png',
        dataBase64: 'YWJj',
      }),
    )
    await flushBackgroundWork()
    expect(sink.frames.at(-1)).toMatchObject({
      t: 'terminal:error',
      reqId: 'image-2',
      id: 'terminal-1',
      error: { code: 'terminal.paste-unavailable' },
    })
  })
})
