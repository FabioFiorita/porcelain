// @vitest-environment node
import { publicErrorSchema } from '@porcelain/contracts'
import { callTRPCProcedure } from '@trpc/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePublicError } from '../../daemon-composition/public-error'
import { createTerminalRouter } from './terminal-router'

// Terminal residual surface only: roster + rename. Actions live on the Actions feature router.
const terminal = {
  create: vi.fn(),
  attach: vi.fn(),
  detach: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  pasteImage: vi.fn(),
  pasteFile: vi.fn(),
  list: vi.fn(),
  rename: vi.fn(),
  detachSink: vi.fn(),
  sweep: vi.fn(),
}

const terminalRouter = createTerminalRouter(terminal)

const REQUEST_ID = '00000000-0000-4000-8000-000000000020'
const PUBLIC_CONTEXT = { auth: { kind: 'admin' }, requestId: REQUEST_ID } as const

const SESSION = {
  id: 'session-1',
  name: 'Synthetic shell',
  cwd: '/synthetic/repo',
  status: 'running',
  createdAt: 1,
} as const

function caller() {
  return terminalRouter.createCaller(PUBLIC_CONTEXT)
}

/** Deliver raw untrusted input the typed caller cannot express — the wire's own entry point. */
async function callWithRawInput(path: string, type: 'query' | 'mutation', input: unknown) {
  return await callTRPCProcedure({
    router: terminalRouter,
    path,
    type,
    ctx: PUBLIC_CONTEXT,
    getRawInput: async () => input,
    signal: undefined,
    batchIndex: 0,
  })
}

async function rejected(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('Expected a tRPC rejection')
}

function expectPublicCode(error: unknown, code: string, unexpected: boolean) {
  const normalized = normalizePublicError(error, REQUEST_ID)
  expect(normalized.unexpected).toBe(unexpected)
  expect(publicErrorSchema.parse(normalized.error)).toMatchObject({ code, requestId: REQUEST_ID })
}

beforeEach(() => {
  terminal.list.mockReturnValue([SESSION])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('terminal router contract input', () => {
  it('rejects supplied input on the void roster query without listing terminals', async () => {
    terminal.list.mockReturnValue([SESSION])
    expectPublicCode(
      await rejected(() => callWithRawInput('terminalSessions', 'query', { repoPath: '/x' })),
      'request.invalid',
      false,
    )
    expect(terminal.list).not.toHaveBeenCalled()
  })

  it('rejects an unknown key on rename without renaming the session', async () => {
    expectPublicCode(
      await rejected(() =>
        callWithRawInput('renameTerminal', 'mutation', {
          id: SESSION.id,
          name: 'Renamed',
          cwd: '/elsewhere',
        }),
      ),
      'request.invalid',
      false,
    )
    expect(terminal.rename).not.toHaveBeenCalled()
  })
})

describe('terminal router contract output', () => {
  it('serializes the roster with its status, exit code, and default creation time', async () => {
    terminal.list.mockReturnValueOnce([
      SESSION,
      { id: 'session-2', name: 'Gone', cwd: '/synthetic/repo', status: 'exited', exitCode: 1 },
    ] as never)

    expect(await caller().terminalSessions()).toEqual([
      SESSION,
      {
        id: 'session-2',
        name: 'Gone',
        cwd: '/synthetic/repo',
        status: 'exited',
        exitCode: 1,
        createdAt: 0,
      },
    ])
  })

  it('serializes a rename as undefined and forwards the requested name unchanged', async () => {
    expect(await caller().renameTerminal({ id: SESSION.id, name: '  Renamed  ' })).toBeUndefined()
    expect(terminal.rename).toHaveBeenCalledWith(SESSION.id, '  Renamed  ')
  })

  it('refuses to serialize a roster row whose status violates the contract', async () => {
    terminal.list.mockReturnValueOnce([{ ...SESSION, status: 'sleeping' }] as never)

    expectPublicCode(await rejected(() => caller().terminalSessions()), 'internal.unexpected', true)
  })
})
