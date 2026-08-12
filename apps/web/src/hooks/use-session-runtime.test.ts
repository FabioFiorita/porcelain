import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { sessionContractFixtures } from '@porcelain/contracts/session'
import { terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { createDaemonSession, type DaemonSession } from '@renderer/lib/daemon'
import type { SessionSocket, SessionSocketHandlers } from '@renderer/lib/session-browser-adapter'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type Pane, useTabsStore } from '@renderer/stores/tabs'
import { useTreeDirsStore } from '@renderer/stores/tree-dirs'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { trpcWrapper } from './trpc-test-harness'
import {
  invalidateForChange,
  invalidateForRecovery,
  type SessionQueryUtils,
  useSessionRuntime,
} from './use-session-runtime'

const PROJECT = '/synthetic/repo'

/**
 * A utils double that records which authoritative queries a signal invalidated. Structural, so
 * nothing here reimplements React Query — the assertion is the mapping, not the cache.
 */
function recordingUtils(): { utils: SessionQueryUtils; invalidated: string[] } {
  const invalidated: string[] = []
  const query = (name: string): { invalidate: () => Promise<void> } => ({
    invalidate: (): Promise<void> => {
      invalidated.push(name)
      return Promise.resolve()
    },
  })
  const utils: SessionQueryUtils = {
    invalidate: (): Promise<void> => {
      invalidated.push('*')
      return Promise.resolve()
    },
    gitFlow: query('gitFlow'),
    gitDiffFile: query('gitDiffFile'),
    gitRangeFlow: query('gitRangeFlow'),
    gitCommitFlow: query('gitCommitFlow'),
    repoLayers: query('repoLayers'),
    featureView: query('featureView'),
    featureReading: query('featureReading'),
    exploreFeature: query('exploreFeature'),
    reviewComments: query('reviewComments'),
    loopEvidence: query('loopEvidence'),
    loopEvidenceHtml: query('loopEvidenceHtml'),
    reviewEvidenceDocs: query('reviewEvidenceDocs'),
    reviewEvidenceAssets: query('reviewEvidenceAssets'),
    reviewEvidenceAsset: query('reviewEvidenceAsset'),
    boardCards: query('boardCards'),
    files: query('files'),
    actions: query('actions'),
  }
  return { utils, invalidated }
}

async function invalidatedBy(change: Parameters<typeof invalidateForChange>[0]): Promise<string[]> {
  const { utils, invalidated } = recordingUtils()
  await invalidateForChange(change, utils)
  return invalidated.sort()
}

describe('Session change invalidation mapping', () => {
  it('leaves all files.* kinds to the Files feature adapter (no session invalidation)', async () => {
    expect(await invalidatedBy({ kind: 'files.scope-changed', projectPath: PROJECT })).toEqual([])
    expect(
      await invalidatedBy({
        kind: 'files.tree-changed',
        projectPath: PROJECT,
        paths: ['src'],
      }),
    ).toEqual([])
    expect(
      await invalidatedBy({
        kind: 'files.content-changed',
        projectPath: PROJECT,
        paths: ['src/open.ts'],
      }),
    ).toEqual([])
  })

  it('refreshes non-comments Review surfaces; comments are feature-owned', async () => {
    expect(await invalidatedBy({ kind: 'review.changed', projectPath: PROJECT })).toEqual(
      [
        'exploreFeature',
        'featureReading',
        'featureView',
        'gitCommitFlow',
        'gitFlow',
        'gitRangeFlow',
        'loopEvidence',
        'loopEvidenceHtml',
        'repoLayers',
        'reviewEvidenceAsset',
        'reviewEvidenceAssets',
        'reviewEvidenceDocs',
      ].sort(),
    )
  })

  it('leaves board.changed to the Board feature adapter and refreshes actions only', async () => {
    expect(await invalidatedBy({ kind: 'board.changed', projectPath: PROJECT })).toEqual([])
    expect(await invalidatedBy({ kind: 'actions.changed', projectPath: PROJECT })).toEqual([
      'actions',
    ])
  })
})

describe('Session recovery invalidation', () => {
  it('invalidates everything daemon-derived when the session lost its proof', async () => {
    const { utils, invalidated } = recordingUtils()

    await invalidateForRecovery({ reason: 'reconnect', scope: { kind: 'session' } }, utils)
    await invalidateForRecovery({ reason: 'epoch-changed', scope: { kind: 'session' } }, utils)

    expect(invalidated).toEqual([
      '*',
      'reviewComments',
      'boardCards',
      'files',
      '*',
      'reviewComments',
      'boardCards',
      'files',
    ])
  })

  it('invalidates the affected project scope including the files feature slot', async () => {
    const { utils, invalidated } = recordingUtils()

    await invalidateForRecovery(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      utils,
    )

    // Narrower than the whole client, still wholesale: a gap says only that something was missed.
    expect(invalidated).not.toContain('*')
    expect(invalidated).toContain('files')
    expect(invalidated).not.toContain('readDir')
    expect(invalidated).not.toContain('readFile')
    expect(invalidated).toContain('boardCards')
    expect(invalidated).toContain('featureReading')
  })
})

type MountedSession = {
  readonly sockets: FakeSocket[]
  readonly socket: () => FakeSocket
  readonly session: DaemonSession
  readonly result: { current: ReturnType<typeof useSessionRuntime> }
  readonly unmount: () => void
  readonly deliver: (frame: unknown) => void
  readonly frames: () => Record<string, unknown>[]
}

type FakeSocket = SessionSocket & {
  readonly handlers: SessionSocketHandlers
  readonly sent: string[]
  readonly closed: () => boolean
}

const readyFrame = { t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch: 'epoch-1' }

function filePane(...paths: string[]): Pane {
  return {
    tabs: paths.map((path) => ({ id: `file:${path}`, kind: 'file', title: path, path })),
    activeTabId: null,
  }
}

/**
 * Mount the hook over an injected daemon session with a fake socket. Production uses
 * `primary`; tests never construct a second runtime on top of primary.
 *
 * `ready: false` leaves the session mid-handshake, which is the only state a mismatch can
 * arrive in — the daemon answers hello with ready or with refusal, never both.
 */
async function mountSession({ ready = true }: { ready?: boolean } = {}): Promise<MountedSession> {
  const sockets: FakeSocket[] = []
  const wrapper = trpcWrapper(() => Promise.resolve(null))

  const session = createDaemonSession(
    { url: 'http://127.0.0.1:43118', token: 'synthetic-token' },
    {
      // No reconnect runs in these tests; the adapter's backoff is proved in its own suite.
      schedule: () => (): void => undefined,
      openSocket: ({ handlers }) => {
        const sent: string[] = []
        let isClosed = false
        const socket: FakeSocket = {
          handlers,
          sent,
          send: (payload) => sent.push(payload),
          close: () => {
            isClosed = true
          },
          closed: () => isClosed,
        }
        sockets.push(socket)
        return socket
      },
    },
  )

  const hook = renderHook(() => useSessionRuntime({ session }), { wrapper })

  const socket = (): FakeSocket => {
    const current = sockets.at(-1)
    if (!current) throw new Error('no socket was opened')
    return current
  }

  await waitFor(() => expect(sockets).toHaveLength(1))
  act(() => socket().handlers.opened())
  if (ready) act(() => socket().handlers.message(JSON.stringify(readyFrame)))

  return {
    sockets,
    socket,
    session,
    result: hook.result,
    unmount: hook.unmount,
    deliver: (frame) => act(() => socket().handlers.message(JSON.stringify(frame))),
    frames: () => socket().sent.map((raw) => JSON.parse(raw) as Record<string, unknown>),
  }
}

beforeEach(() => {
  useProjectSelectionStore.setState({ project: { path: PROJECT, name: 'repo' } })
  useTabsStore.setState({ panes: [filePane()], activePaneIndex: 0 })
  useTreeDirsStore.setState({ dirs: new Set<string>() })
})

describe('useSessionRuntime lifecycle', () => {
  it('announces the protocol and selects the project without Viewer file/dir watch interests', async () => {
    useTabsStore.setState({ panes: [filePane(`${PROJECT}/src/open.ts`)], activePaneIndex: 0 })
    useTreeDirsStore.setState({ dirs: new Set([`${PROJECT}/src`]) })

    const session = await mountSession()

    expect(session.frames()[0]).toEqual({
      t: 'session:hello',
      protocolVersion: PROTOCOL_VERSION,
    })
    // selectProject may emit an empty watches restatement; session must not register
    // open Viewer files or expanded tree dirs (Files interest bridge owns that).
    const watchFrames = session.frames().filter((f) => f.t === 'session:watches')
    for (const frame of watchFrames) {
      expect(frame).toMatchObject({ projectPath: PROJECT, files: [], dirs: [] })
    }
    expect(session.result.current.status).toBe('open')
    expect(session.result.current.updateRequired).toBeUndefined()
  })

  it('does not restate Viewer interests when a file opens or a directory expands', async () => {
    const session = await mountSession()

    act(() => {
      useTabsStore.setState({ panes: [filePane(`${PROJECT}/src/a.ts`)], activePaneIndex: 0 })
    })
    act(() => {
      useTreeDirsStore.setState({ dirs: new Set([`${PROJECT}/src`]) })
    })

    // Files bridge owns interest recomputation; session never observes panes/treeDirs.
    const watchFrames = session.frames().filter((f) => f.t === 'session:watches')
    for (const frame of watchFrames) {
      expect(frame).toMatchObject({ files: [], dirs: [] })
    }
    expect(
      watchFrames.some(
        (f) => Array.isArray(f.files) && (f.files as string[]).includes(`${PROJECT}/src/a.ts`),
      ),
    ).toBe(false)
  })

  it('does not forward terminal frames to the query cache (terminal stays on the session)', async () => {
    const session = await mountSession()
    const before = session.frames().length

    session.deliver(terminalStreamFixtures.output.data)

    // Terminal frames are consumed by createDaemonSession's dispatch, not by RQ invalidation.
    // No extra outbound frames, and the hook's status stays open.
    expect(session.frames()).toHaveLength(before)
    expect(session.result.current.status).toBe('open')
  })

  it('surfaces the daemon refusing this build protocol as a recoverable UI state', async () => {
    const session = await mountSession({ ready: false })

    session.deliver(sessionContractFixtures.mismatch)

    await waitFor(() =>
      expect(session.result.current.updateRequired).toEqual(sessionContractFixtures.mismatch),
    )
    expect(session.result.current.status).toBe('update-required')
    expect(session.socket().closed()).toBe(true)
  })

  it('unmounts without tearing down the shared session socket', async () => {
    useTabsStore.setState({ panes: [filePane(`${PROJECT}/src/a.ts`)], activePaneIndex: 0 })
    const session = await mountSession()

    session.unmount()

    // The socket belongs to the DaemonSession, not the hook: unmount must not close it
    // (production primary stays up for terminal traffic).
    expect(session.socket().closed()).toBe(false)
  })
})
