import { terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'
import { createTerminalRequestRegistry, type TerminalRequest } from './terminal-requests'

function request(
  kind: TerminalRequest['kind'],
  frame: TerminalRequest['frame'],
  reqId = frame.reqId,
  deadline = 100,
): TerminalRequest {
  return { kind, frame, reqId, deadline }
}

describe('Terminal request registry', () => {
  it('correlates every request kind with its canonical success reply', () => {
    const registry = createTerminalRequestRegistry()
    const requests: readonly TerminalRequest[] = [
      request('create', terminalStreamFixtures.lifecycle.create),
      request('attach', terminalStreamFixtures.lifecycle.attach),
      request('paste-file', terminalStreamFixtures.input.pasteFile),
    ]

    for (const pending of requests) expect(registry.add(pending)).toBe(true)

    expect(registry.settle(terminalStreamFixtures.lifecycle.created)).toMatchObject({
      kind: 'succeeded',
      request: requests[0],
    })
    expect(registry.settle(terminalStreamFixtures.lifecycle.attached)).toMatchObject({
      kind: 'succeeded',
      request: requests[1],
    })
    expect(registry.settle(terminalStreamFixtures.input.filePasted)).toMatchObject({
      kind: 'succeeded',
      request: requests[2],
    })
  })

  it('rejects duplicate ids and preserves a request after a wrong-kind reply', () => {
    const registry = createTerminalRequestRegistry()
    const pending = request('create', terminalStreamFixtures.lifecycle.create)

    expect(registry.add(pending)).toBe(true)
    expect(registry.add(pending)).toBe(false)
    expect(
      registry.settle({
        ...terminalStreamFixtures.lifecycle.attached,
        reqId: pending.reqId,
      }),
    ).toBeUndefined()
    expect(registry.has(pending.reqId)).toBe(true)
  })

  it('ignores an error for another terminal and accepts the matching typed error', () => {
    const registry = createTerminalRequestRegistry()
    const pending = request('attach', terminalStreamFixtures.lifecycle.attach)

    expect(registry.add(pending)).toBe(true)
    expect(registry.settle(terminalStreamFixtures.error)).toBeUndefined()
    expect(registry.has(pending.reqId)).toBe(true)

    const error = {
      ...terminalStreamFixtures.error,
      reqId: pending.reqId,
      // Read from the fixture, not from `pending.frame`: TerminalRequest['frame'] is the whole
      // client-frame union and only some members carry an id.
      id: terminalStreamFixtures.lifecycle.attach.id,
    }
    expect(registry.settle(error)).toMatchObject({
      kind: 'failed',
      failure: { reason: 'server', error: error.error },
    })
    expect(registry.has(pending.reqId)).toBe(false)
  })

  it('expires explicit deadlines and closes remaining requests without ambient time', () => {
    const registry = createTerminalRequestRegistry()
    const expired = request(
      'create',
      { ...terminalStreamFixtures.lifecycle.create, reqId: 'expired' },
      'expired',
      10,
    )
    const open = request(
      'attach',
      { ...terminalStreamFixtures.lifecycle.attach, reqId: 'open' },
      'open',
      20,
    )

    expect(registry.add(expired)).toBe(true)
    expect(registry.add(open)).toBe(true)
    expect(registry.expire(10)).toMatchObject([
      { kind: 'failed', request: expired, failure: { reason: 'deadline' } },
    ])
    expect(registry.close()).toMatchObject([
      { kind: 'failed', request: open, failure: { reason: 'closed' } },
    ])
  })
})
