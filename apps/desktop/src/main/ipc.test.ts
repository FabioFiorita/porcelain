import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The shuttle is the ONE surviving Electron IPC data path, and `ipcRenderer.invoke`
 * hands main a payload with no type at all. These tests hold the parse: a real request
 * still reaches tRPC's fetch adapter untouched, and anything else is answered with a
 * deterministic 400 without a `Request` ever being built.
 */

type Handler = (event: { sender: unknown }, payload: unknown) => Promise<unknown>

const handlers = new Map<string, Handler>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler): void => {
      handlers.set(channel, handler)
    },
  },
}))

type FetchHandlerOptions = {
  endpoint: string
  req: Request
  createContext: () => { sender: unknown }
}

const fetchRequestHandler = vi.fn(
  async (_opts: FetchHandlerOptions): Promise<Response> =>
    new Response('{"result":{"data":null}}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
)

vi.mock('@trpc/server/adapters/fetch', () => ({
  fetchRequestHandler: (opts: FetchHandlerOptions) => fetchRequestHandler(opts),
}))

vi.mock('./shell-api', () => ({ shellRouter: { __brand: 'shell-router' } }))

const SENDER = { id: 1 }

const VALID = {
  url: 'http://localhost/trpc-shell/windowInit',
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"0":{}}',
}

async function invoke(payload: unknown): Promise<unknown> {
  const handler = handlers.get('trpc-shell')
  if (handler === undefined) throw new Error('trpc-shell handler was never registered')
  return handler({ sender: SENDER }, payload)
}

beforeEach(async () => {
  handlers.clear()
  fetchRequestHandler.mockClear()
  const { registerTrpcHandler } = await import('./ipc')
  registerTrpcHandler()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('trpc-shell shuttle', () => {
  it('replays a valid request through the fetch adapter and shuttles the reply back', async () => {
    const reply = await invoke(VALID)

    expect(fetchRequestHandler).toHaveBeenCalledTimes(1)
    const opts = fetchRequestHandler.mock.calls[0]?.[0]
    if (opts === undefined) throw new Error('the shuttle never reached the fetch adapter')
    expect(opts.endpoint).toBe('/trpc-shell')
    expect(opts.req.url).toBe(VALID.url)
    expect(opts.req.method).toBe('POST')
    expect(await opts.req.text()).toBe(VALID.body)
    expect(opts.createContext().sender).toBe(SENDER)

    expect(reply).toEqual({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"result":{"data":null}}',
    })
  })

  it('accepts a bodyless request (the GET half of the batch link)', async () => {
    await invoke({ url: 'http://localhost/trpc-shell/updateStatus', method: 'GET', headers: {} })
    expect(fetchRequestHandler).toHaveBeenCalledTimes(1)
  })

  it('answers 400 and never dispatches a malformed payload', async () => {
    const malformed: unknown[] = [
      undefined,
      null,
      'not-a-request',
      [VALID],
      { ...VALID, url: undefined },
      { ...VALID, method: undefined },
      { ...VALID, headers: undefined },
      { ...VALID, url: '' },
      { ...VALID, url: 42 },
      { ...VALID, method: 7 },
      { ...VALID, headers: { 'content-length': 12 } },
      { ...VALID, headers: 'content-type: application/json' },
      { ...VALID, body: 99 },
      { ...VALID, body: { batch: 1 } },
      { ...VALID, extra: 'smuggled' },
    ]

    for (const payload of malformed) {
      const reply = await invoke(payload)
      expect(reply, JSON.stringify(payload ?? null)).toEqual({
        status: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: { message: 'malformed trpc-shell request' } }),
      })
    }

    expect(fetchRequestHandler).not.toHaveBeenCalled()
  })
})
