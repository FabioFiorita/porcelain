import { describe, expect, it } from 'vitest'
import { ACTIONS_CHANGE_KINDS } from '../actions'
import { BOARD_CHANGE_KINDS } from '../board'
import { FILES_CHANGE_KINDS } from '../files'
import { GIT_CHANGE_KINDS } from '../git'
import { PROTOCOL_VERSION } from '../protocol'
import { REVIEW_CHANGE_KINDS } from '../review'
import { TASKS_CHANGE_KINDS } from '../tasks'
import { TERMINAL_CHANGE_KINDS } from '../terminal'
import {
  type SessionChange,
  sessionChangeFrameSchema,
  sessionChangeSchema,
  sessionContractFixtures,
  sessionHelloFrameSchema,
  sessionMismatchFrameSchema,
  sessionReadyFrameSchema,
} from './session.contract'

const everyChangeKind = [
  ...FILES_CHANGE_KINDS,
  ...GIT_CHANGE_KINDS,
  ...REVIEW_CHANGE_KINDS,
  ...BOARD_CHANGE_KINDS,
  ...TASKS_CHANGE_KINDS,
  ...ACTIONS_CHANGE_KINDS,
  ...TERMINAL_CHANGE_KINDS,
]

/**
 * Every project-scoped kind's fixture. `tasks.changed` is deliberately absent: the Tasks
 * table is daemon-wide, so its change carries no project and cannot be built here.
 */
const projectScopedChangeFixtures = {
  'files.scope-changed': { kind: 'files.scope-changed', projectPath: '/synthetic/repo' },
  'files.tree-changed': {
    kind: 'files.tree-changed',
    projectPath: '/synthetic/repo',
    paths: ['src'],
  },
  'files.content-changed': {
    kind: 'files.content-changed',
    projectPath: '/synthetic/repo',
    paths: ['src/open.ts'],
  },
  'git.working-tree-changed': {
    kind: 'git.working-tree-changed',
    projectPath: '/synthetic/repo',
  },
  'review.changed': { kind: 'review.changed', projectPath: '/synthetic/repo' },
  'board.changed': { kind: 'board.changed', projectPath: '/synthetic/repo' },
  'actions.changed': { kind: 'actions.changed', projectPath: '/synthetic/repo' },
  'terminal.dev-servers-changed': {
    kind: 'terminal.dev-servers-changed',
    projectPath: '/synthetic/repo',
    projectId: 'project-1',
    worktreeId: 'worktree-1',
  },
} as const satisfies Record<Exclude<SessionChange['kind'], 'tasks.changed'>, SessionChange>

const changeFixtures: Record<SessionChange['kind'], SessionChange> = {
  ...projectScopedChangeFixtures,
  'tasks.changed': { kind: 'tasks.changed' },
}

const projectScopedChangeKinds = Object.keys(projectScopedChangeFixtures) as Array<
  keyof typeof projectScopedChangeFixtures
>

describe('Session change envelope', () => {
  it('composes exactly the nine domain change kinds', () => {
    expect(sessionChangeSchema.options.map((option) => option.shape.kind.value).sort()).toEqual(
      [...everyChangeKind].sort(),
    )
    expect(everyChangeKind).toHaveLength(9)
    expect(projectScopedChangeKinds).toHaveLength(8)
  })

  it('keeps tasks.changed daemon-wide: strict, carrying only kind', () => {
    // The daemon's delivery rule reads "no projectPath" as "reaches every subscription",
    // so a Tasks change that could carry a project would silently become project-scoped.
    const tasksOption = sessionChangeSchema.options.find(
      (option) => option.shape.kind.value === 'tasks.changed',
    )
    expect(Object.keys(tasksOption?.shape ?? {})).toEqual(['kind'])
    expect(sessionChangeSchema.parse({ kind: 'tasks.changed' })).toEqual({ kind: 'tasks.changed' })
    expect(
      sessionChangeSchema.safeParse({ kind: 'tasks.changed', projectPath: '/synthetic/repo' })
        .success,
    ).toBe(false)
    expect(
      sessionChangeFrameSchema.safeParse({
        t: 'session:change',
        epoch: 'synthetic-epoch',
        sequence: 7,
        change: { kind: 'tasks.changed', projectPath: '/synthetic/repo' },
      }).success,
    ).toBe(false)
  })

  for (const kind of everyChangeKind) {
    it(`carries ${kind} inside a session:change frame`, () => {
      const frame = {
        t: 'session:change',
        epoch: 'synthetic-epoch',
        sequence: 7,
        change: changeFixtures[kind],
      }
      expect(sessionChangeFrameSchema.parse(frame)).toEqual(frame)
    })
  }

  for (const kind of projectScopedChangeKinds) {
    it(`rejects ${kind} inside a frame when projectPath is missing`, () => {
      const { projectPath: _dropped, ...change } = projectScopedChangeFixtures[kind]
      expect(
        sessionChangeFrameSchema.safeParse({
          t: 'session:change',
          epoch: 'synthetic-epoch',
          sequence: 7,
          change,
        }).success,
      ).toBe(false)
    })
  }

  it('accepts the change fixture and requires epoch and sequence', () => {
    expect(sessionChangeFrameSchema.parse(sessionContractFixtures.change)).toEqual(
      sessionContractFixtures.change,
    )
    const { epoch: _epoch, ...withoutEpoch } = sessionContractFixtures.change
    const { sequence: _sequence, ...withoutSequence } = sessionContractFixtures.change
    expect(sessionChangeFrameSchema.safeParse(withoutEpoch).success).toBe(false)
    expect(sessionChangeFrameSchema.safeParse(withoutSequence).success).toBe(false)
    expect(
      sessionChangeFrameSchema.safeParse({ ...sessionContractFixtures.change, epoch: '' }).success,
    ).toBe(false)
  })

  it('rejects a non-monotonic-capable sequence value', () => {
    for (const sequence of [-1, 1.5, '1']) {
      expect(
        sessionChangeFrameSchema.safeParse({ ...sessionContractFixtures.change, sequence }).success,
      ).toBe(false)
    }
  })

  it('rejects an unknown field on the frame', () => {
    expect(
      sessionChangeFrameSchema.safeParse({ ...sessionContractFixtures.change, repo: '/elsewhere' })
        .success,
    ).toBe(false)
  })

  it('rejects terminal stream frames as change notifications', () => {
    expect(
      sessionChangeFrameSchema.safeParse({
        t: 'session:change',
        epoch: 'synthetic-epoch',
        sequence: 1,
        change: { kind: 'terminal:data', projectPath: '/synthetic/repo', data: 'hello' },
      }).success,
    ).toBe(false)
  })
})

describe('Session handshake frames', () => {
  it('accepts a hello announcing this build protocol', () => {
    expect(sessionHelloFrameSchema.parse(sessionContractFixtures.hello)).toEqual(
      sessionContractFixtures.hello,
    )
  })

  it('rejects a hello on any other protocol version or with extra data', () => {
    expect(
      sessionHelloFrameSchema.safeParse({
        t: 'session:hello',
        protocolVersion: PROTOCOL_VERSION + 1,
      }).success,
    ).toBe(false)
    expect(sessionHelloFrameSchema.safeParse({ t: 'session:hello' }).success).toBe(false)
    expect(
      sessionHelloFrameSchema.safeParse({ ...sessionContractFixtures.hello, repo: '/synthetic' })
        .success,
    ).toBe(false)
  })

  it('accepts a ready carrying the daemon protocol version and epoch', () => {
    expect(sessionReadyFrameSchema.parse(sessionContractFixtures.ready)).toEqual(
      sessionContractFixtures.ready,
    )
    const { epoch: _dropped, ...withoutEpoch } = sessionContractFixtures.ready
    expect(sessionReadyFrameSchema.safeParse(withoutEpoch).success).toBe(false)
    expect(
      sessionReadyFrameSchema.safeParse({ ...sessionContractFixtures.ready, epoch: '' }).success,
    ).toBe(false)
  })

  it('accepts a mismatch with the stable public error code and both versions', () => {
    expect(sessionMismatchFrameSchema.parse(sessionContractFixtures.mismatch)).toEqual(
      sessionContractFixtures.mismatch,
    )
    expect(sessionContractFixtures.mismatch.code).toBe('protocol.update-required')
    expect(
      sessionMismatchFrameSchema.parse({ ...sessionContractFixtures.mismatch, received: 0 })
        .received,
    ).toBe(0)
  })

  it('rejects a mismatch missing a version, or on another error code', () => {
    const { received: _dropped, ...withoutReceived } = sessionContractFixtures.mismatch
    expect(sessionMismatchFrameSchema.safeParse(withoutReceived).success).toBe(false)
    expect(
      sessionMismatchFrameSchema.safeParse({
        ...sessionContractFixtures.mismatch,
        code: 'state.conflict',
      }).success,
    ).toBe(false)
    expect(
      sessionMismatchFrameSchema.safeParse({ ...sessionContractFixtures.mismatch, expected: -1 })
        .success,
    ).toBe(false)
  })
})
