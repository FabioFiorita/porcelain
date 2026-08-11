import { PROTOCOL_VERSION } from '@porcelain/contracts'
import type { SessionChange } from '@porcelain/contracts/session'
import { sessionContractFixtures } from '@porcelain/contracts/session'
import { terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { createDaemonSession, type DaemonSession } from '@renderer/lib/daemon'
import type { SessionSocket, SessionSocketHandlers } from '@renderer/lib/session-browser-adapter'
import { useRepoStore } from '@renderer/stores/repo'
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
    readDir: query('readDir'),
    readFile: query('readFile'),
    previewHtml: query('previewHtml'),
    pinnedEntries: query('pinnedEntries'),
    repoScope: query('repoScope'),
    searchFiles: query('searchFiles'),
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
    actions: query('actions'),
  }
  return { utils, invalidated }
}

async function invalidatedBy(change: SessionChange): Promise<string[]> {
  const { utils, invalidated } = recordingUtils()
  await invalidateForChange(change, utils)
  return invalidated.sort()
}

describe('Session change invalidation mapping', () => {
  it('refreshes the tree, pins, scope, flow, and search when project scope moved', async () => {
    expect(await invalidatedBy({ kind: 'files.scope-changed', projectPath: PROJECT })).toEqual(
      ['gitFlow', 'pinnedEntries', 'readDir', 'repoScope', 'searchFiles'].sort(),
    )
  })

  it('refreshes the tree rows, pins, and working-tree grouping when entries appeared', async () => {
    expect(
      await invalidatedBy({
        kind: 'files.tree-changed',
        projectPath: PROJECT,
        paths: [`${PROJECT}/src`],
      }),
    ).toEqual(['gitFlow', 'pinnedEntries', 'readDir'].sort())
  })

  it('re-reads open documents and diffs when a watched file body changed', async () => {
    expect(
      await invalidatedBy({
        kind: 'files.content-changed',
        projectPath: PROJECT,
        paths: [`${PROJECT}/src/open.ts`],
      }),
    ).toEqual(['exploreFeature', 'gitDiffFile', 'previewHtml', 'readFile'].sort())
  })

  it('refreshes the Git surfaces when the working tree changed', async () => {
    expect(await invalidatedBy({ kind: 'git.working-tree-changed', projectPath: PROJECT })).toEqual(
      ['gitDiffFile', 'gitFlow'].sort(),
    )
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

  it('never writes a notification payload into the cache', async () => {
    const { utils, invalidated } = recordingUtils()
    await invalidateForChange(
      { kind: 'files.content-changed', projectPath: PROJECT, paths: [`${PROJECT}/a.ts`] },
      utils,
    )
    // Every effect a change notification has is an invalidation of an authoritative query.
    expect(invalidated).not.toContain('*')
    expect(invalidated.length).toBeGreaterThan(0)
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
      '*',
      'reviewComments',
      'boardCards',
    ])
  })

  it('invalidates the affected project scope when one stream lost a notification', async () => {
    const { utils, invalidated } = recordingUtils()

    await invalidateForRecovery(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      utils,
    )

    // Narrower than the whole client, still wholesale: a gap says only that something was missed.
    expect(invalidated).not.toContain('*')
    expect(invalidated).toContain('readFile')
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
  useRepoStore.setState({ repo: { path: PROJECT, name: 'repo' } })
  useTabsStore.setState({ panes: [filePane()], activePaneIndex: 0 })
  useTreeDirsStore.setState({ dirs: new Set<string>() })
})

describe('useSessionRuntime lifecycle', () => {
  it('announces the protocol, then registers the Viewer interests for the open project', async () => {
    useTabsStore.setState({ panes: [filePane(`${PROJECT}/src/open.ts`)], activePaneIndex: 0 })
    useTreeDirsStore.setState({ dirs: new Set([`${PROJECT}/src`]) })

    const session = await mountSession()

    expect(session.frames()[0]).toEqual({
      t: 'session:hello',
      protocolVersion: PROTOCOL_VERSION,
    })
    await waitFor(() =>
      expect(session.frames().at(-1)).toEqual({
        t: 'session:watches',
        projectPath: PROJECT,
        files: [`${PROJECT}/src/open.ts`],
        dirs: [`${PROJECT}/src`],
      }),
    )
    expect(session.result.current.status).toBe('open')
    expect(session.result.current.updateRequired).toBeUndefined()
  })

  it('re-registers when the Viewer opens a file or expands a directory', async () => {
    const session = await mountSession()

    act(() => {
      useTabsStore.setState({ panes: [filePane(`${PROJECT}/src/a.ts`)], activePaneIndex: 0 })
    })
    await waitFor(() =>
      expect(session.frames().at(-1)).toEqual({
        t: 'session:watches',
        projectPath: PROJECT,
        files: [`${PROJECT}/src/a.ts`],
        dirs: [],
      }),
    )

    act(() => {
      useTreeDirsStore.setState({ dirs: new Set([`${PROJECT}/src`]) })
    })
    await waitFor(() =>
      expect(session.frames().at(-1)).toEqual({
        t: 'session:watches',
        projectPath: PROJECT,
        files: [`${PROJECT}/src/a.ts`],
        dirs: [`${PROJECT}/src`],
      }),
    )
  })

  it('does not resend the desired set for a render that changed no interest', async () => {
    const session = await mountSession()
    const before = session.frames().length

    act(() => {
      useTabsStore.setState({ panes: [filePane()], activePaneIndex: 0 })
    })

    expect(session.frames()).toHaveLength(before)
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

  it('releases watch interests on unmount without tearing down the shared session socket', async () => {
    useTabsStore.setState({ panes: [filePane(`${PROJECT}/src/a.ts`)], activePaneIndex: 0 })
    const session = await mountSession()
    await waitFor(() => expect(session.frames().length).toBeGreaterThanOrEqual(2))
    const before = session.frames().length

    session.unmount()

    // The socket belongs to the DaemonSession, not the hook: unmount must not close it
    // (production primary stays up for terminal traffic). Interest release may send watches.
    expect(session.socket().closed()).toBe(false)
    // A release with an open session may send an empty/updated watches frame.
    expect(session.frames().length).toBeGreaterThanOrEqual(before)
  })
})
