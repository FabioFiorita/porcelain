import { type TerminalServerFrame, terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'
import { createTerminalStreamState } from './terminal-stream'

function runningState() {
  const state = createTerminalStreamState()
  expect(state.requestAttach('term-1', 'req-2', 100)).toBeDefined()
  expect(state.receive(terminalStreamFixtures.lifecycle.attached)).toMatchObject([
    { type: 'request-succeeded', frame: { t: 'terminal:attached' } },
  ])
  return state
}

function data(sequence: number, epoch = 'epoch-1'): TerminalServerFrame {
  return {
    t: 'terminal:data',
    id: 'term-1',
    data: `chunk-${sequence}`,
    epoch,
    sequence,
  }
}

describe('Terminal stream requests and attachment state', () => {
  it('builds strict create and paste-file requests without generating ids or time', () => {
    const state = createTerminalStreamState()
    const create = state.requestCreate(
      { t: 'terminal:create', name: 'zsh', cwd: '/synthetic/repo' },
      'req-1',
      100,
    )

    expect(create).toEqual({
      kind: 'create',
      reqId: 'req-1',
      deadline: 100,
      frame: {
        t: 'terminal:create',
        reqId: 'req-1',
        name: 'zsh',
        cwd: '/synthetic/repo',
      },
    })
    expect(state.receive(terminalStreamFixtures.lifecycle.created)).toMatchObject([
      { type: 'request-succeeded', frame: { t: 'terminal:created', id: 'term-1' } },
    ])
    state.receive(data(1))

    const paste = state.requestPasteFile(
      {
        t: 'terminal:paste-file',
        id: 'term-1',
        filename: 'evidence.txt',
        mime: 'text/plain',
        dataBase64: 'ZmlsZQ==',
      },
      'req-3',
      200,
    )
    expect(paste).toMatchObject({
      kind: 'paste-file',
      reqId: 'req-3',
      deadline: 200,
      frame: { t: 'terminal:paste-file', reqId: 'req-3', id: 'term-1' },
    })
  })

  it('suppresses duplicate attaches before and after the baseline', () => {
    const state = createTerminalStreamState()

    expect(state.requestAttach('term-1', 'req-2', 100)).toBeDefined()
    expect(state.requestAttach('term-1', 'req-9', 100)).toBeUndefined()
    state.receive(terminalStreamFixtures.lifecycle.attached)
    expect(state.requestAttach('term-1', 'req-10', 100)).toBeUndefined()
  })

  it('applies attach success before contiguous live output', () => {
    const state = runningState()

    expect(state.receive(data(1))).toMatchObject([{ type: 'data', frame: data(1) }])
    expect(state.state('term-1')).toEqual({
      id: 'term-1',
      status: 'running',
      epoch: 'epoch-1',
      sequence: 1,
    })
  })

  it('uses the first create stream frame as an honest baseline', () => {
    const state = createTerminalStreamState()
    state.requestCreate({ t: 'terminal:create', name: 'zsh', cwd: '/synthetic/repo' }, 'req-1', 100)
    state.receive(terminalStreamFixtures.lifecycle.created)

    expect(state.receive(data(8))).toMatchObject([{ type: 'data', frame: data(8) }])
    expect(state.state('term-1')?.sequence).toBe(8)
  })

  it('drops stale frames and recovers once on a sequence gap', () => {
    const state = runningState()
    state.receive(data(1))

    expect(state.receive(data(1))).toEqual([])
    expect(state.receive(data(5))).toEqual([
      {
        type: 'recovery-required',
        recovery: {
          reason: 'sequence-gap',
          reattach: ['term-1'],
          refreshRoster: true,
        },
      },
    ])
    expect(state.receive(data(6))).toEqual([])
    expect(state.state('term-1')?.status).toBe('awaiting-reattach')
  })

  it('recovers on an epoch change without exposing the mismatched bytes', () => {
    const state = runningState()
    state.receive(data(1))

    expect(state.receive(data(2, 'epoch-2'))).toEqual([
      {
        type: 'recovery-required',
        recovery: {
          reason: 'epoch-changed',
          reattach: ['term-1'],
          refreshRoster: true,
        },
      },
    ])
  })

  it('recovers when live output arrives before an attach baseline', () => {
    const state = createTerminalStreamState()
    state.attach('term-1')

    expect(state.receive(data(1))).toEqual([
      {
        type: 'recovery-required',
        recovery: {
          reason: 'sequence-gap',
          reattach: ['term-1'],
          refreshRoster: true,
        },
      },
    ])
    expect(state.state('term-1')?.status).toBe('awaiting-reattach')
  })

  it('routes typed errors only to their matching request', () => {
    const state = createTerminalStreamState()
    state.requestAttach('term-gone', 'req-2', 100)

    expect(state.receive(terminalStreamFixtures.error)).toMatchObject([
      {
        type: 'request-failed',
        failure: { reason: 'server', error: { code: 'terminal.not-found' } },
      },
    ])
    expect(state.state('term-gone')).toBeUndefined()
  })

  it('turns expiry and socket close into typed failures while preserving established intent', () => {
    const state = runningState()
    state.requestPasteFile(
      {
        t: 'terminal:paste-file',
        id: 'term-1',
        filename: 'evidence.txt',
        mime: 'text/plain',
        dataBase64: 'ZmlsZQ==',
      },
      'req-3',
      10,
    )

    expect(state.expire(10)).toMatchObject([
      { type: 'request-failed', failure: { reason: 'deadline' } },
    ])
    expect(state.close()).toEqual([])
    expect(state.desiredAttachments()).toEqual(['term-1'])
    expect(state.state('term-1')?.status).toBe('awaiting-reattach')
  })

  it('retains natural exits until an explicit detach or kill', () => {
    const state = runningState()
    expect(state.receive(terminalStreamFixtures.output.data)).toMatchObject([{ type: 'data' }])
    expect(state.receive(terminalStreamFixtures.lifecycle.exit)).toMatchObject([{ type: 'exit' }])
    expect(state.state('term-1')?.status).toBe('exited')
    expect(state.kill('term-1', 'req-7')).toEqual({
      t: 'terminal:kill',
      reqId: 'req-7',
      id: 'term-1',
    })
    expect(state.state('term-1')).toBeUndefined()
  })

  it('validates write and resize commands against the current running state', () => {
    const state = runningState()

    expect(state.write('term-1', '', 'req-w0')).toBeUndefined()
    expect(state.write('term-1', 'hello', 'req-w1')).toEqual({
      t: 'terminal:write',
      reqId: 'req-w1',
      id: 'term-1',
      data: 'hello',
    })
    expect(state.write('term-1', 'x'.repeat(65_537), 'req-w2')).toBeUndefined()
    expect(state.resize('term-1', 0, 24, 'req-r0')).toBeUndefined()
    expect(state.resize('term-1', 120, 40, 'req-r1')).toEqual({
      t: 'terminal:resize',
      reqId: 'req-r1',
      id: 'term-1',
      cols: 120,
      rows: 40,
    })
  })

  it('reattaches every desired session and refreshes the roster on reconnect', () => {
    const first = runningState()
    expect(first.requestAttach('term-2', 'req-12', 100)).toBeDefined()
    first.receive({
      ...terminalStreamFixtures.lifecycle.attached,
      reqId: 'req-12',
      id: 'term-2',
    })

    expect(first.reconnect()).toEqual([
      {
        type: 'recovery-required',
        recovery: {
          reason: 'reconnect',
          reattach: ['term-1', 'term-2'],
          refreshRoster: true,
        },
      },
    ])
    expect(first.state('term-1')?.status).toBe('awaiting-reattach')
    expect(first.state('term-2')?.status).toBe('awaiting-reattach')
    expect(first.requestAttach('term-1', 'req-20', 100)).toBeDefined()
  })
})
