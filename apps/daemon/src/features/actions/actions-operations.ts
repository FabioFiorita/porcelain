import { randomUUID } from 'node:crypto'
import type { Action, ActionView } from '@porcelain/contracts/actions'
import type { SessionChange } from '@porcelain/contracts/session'
import {
  planCreateAction,
  planDeleteAction,
  planMoveAction,
  planUpdateAction,
  sortActions,
} from '@porcelain/shared/actions-file'
import { createActionsChangesPublisher } from './actions-notifications'
import type {
  ActionsChanges,
  ActionsClock,
  ActionsIds,
  ActionsOperationResult,
  ActionsStore,
  ActionTrustStore,
} from './actions-ports'
import { commandFingerprint, createJsonActionTrustStore } from './json-action-trust-store'
import { createJsonActionsStore } from './json-actions-store'

export type ActionsOperations = {
  listActions: (input: { projectPath: string }) => Promise<ActionsOperationResult<ActionView[]>>
  trustActions: (input: {
    projectPath: string
    ids: string[]
  }) => Promise<ActionsOperationResult<void>>
  addAction: (input: {
    projectPath: string
    title: string
    command: string
    where?: 'primary' | 'local'
  }) => Promise<ActionsOperationResult<Action>>
  updateAction: (input: {
    projectPath: string
    id: string
    title?: string
    command?: string
    where?: 'primary' | 'local'
  }) => Promise<ActionsOperationResult<void>>
  moveAction: (input: {
    projectPath: string
    id: string
    direction: 'up' | 'down'
  }) => Promise<ActionsOperationResult<void>>
  deleteAction: (input: {
    projectPath: string
    id: string
  }) => Promise<ActionsOperationResult<void>>
  prepareActionRun: (input: { projectPath: string; actionId: string }) => Promise<
    ActionsOperationResult<{
      id: string
      title: string
      command: string
      where: 'primary' | 'local'
      projectPath: string
    }>
  >
}

export function createActionsOperations(options: {
  store?: ActionsStore
  trustStore?: ActionTrustStore
  clock?: ActionsClock
  ids?: ActionsIds
  changes?: ActionsChanges
  publishSessionChange?: (change: SessionChange) => void
}): ActionsOperations {
  const store = options.store ?? createJsonActionsStore()
  const trustStore = options.trustStore ?? createJsonActionTrustStore()
  const clock = options.clock ?? { now: () => Date.now() }
  const ids = options.ids ?? { create: () => randomUUID() }
  const changes =
    options.changes ??
    createActionsChangesPublisher(options.publishSessionChange ?? (() => undefined))

  async function listActions(input: {
    projectPath: string
  }): Promise<ActionsOperationResult<ActionView[]>> {
    const [fileResult, trustResult] = await Promise.all([
      store.read(input.projectPath),
      trustStore.readFingerprints(input.projectPath),
    ])
    if (!fileResult.ok) return fileResult
    if (!trustResult.ok) return trustResult

    const views: ActionView[] = sortActions(fileResult.value.actions).map((action) => ({
      ...action,
      trusted: trustResult.value.has(commandFingerprint(action.command)),
    }))
    return { ok: true, value: views }
  }

  async function trustActions(input: {
    projectPath: string
    ids: string[]
  }): Promise<ActionsOperationResult<void>> {
    const fileResult = await store.read(input.projectPath)
    if (!fileResult.ok) return fileResult

    const wanted = new Set(input.ids)
    const commands = fileResult.value.actions
      .filter((action) => wanted.has(action.id))
      .map((action) => action.command)

    const trusted = await trustStore.trustCommands(input.projectPath, commands)
    if (!trusted.ok) return trusted

    changes.publish({ type: 'actions.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }

  async function addAction(input: {
    projectPath: string
    title: string
    command: string
    where?: 'primary' | 'local'
  }): Promise<ActionsOperationResult<Action>> {
    const now = clock.now()
    const id = ids.create()

    const result = await store.transact(input.projectPath, (current) => {
      const planned = planCreateAction(current, {
        id,
        title: input.title,
        command: input.command,
        where: input.where,
        order: now,
        createdAt: now,
      })
      if (!planned.ok) return planned
      return { ok: true, value: { kind: 'create', file: planned.file, action: planned.action } }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'create') {
      return { ok: false, error: { code: 'actions.unavailable' } }
    }

    // Human-authored through the app — auto-trust the new command text.
    const trusted = await trustStore.trustCommands(input.projectPath, [result.value.action.command])
    if (!trusted.ok) return trusted

    changes.publish({ type: 'actions.changed', projectPath: input.projectPath })
    return { ok: true, value: result.value.action }
  }

  async function updateAction(input: {
    projectPath: string
    id: string
    title?: string
    command?: string
    where?: 'primary' | 'local'
  }): Promise<ActionsOperationResult<void>> {
    const result = await store.transact(input.projectPath, (current) => {
      const planned = planUpdateAction(current, {
        actionId: input.id,
        title: input.title,
        command: input.command,
        where: input.where,
      })
      if (!planned.ok) return planned
      return { ok: true, value: { kind: 'update', file: planned.file, action: planned.action } }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'update') {
      return { ok: false, error: { code: 'actions.unavailable' } }
    }

    if (input.command !== undefined) {
      const trusted = await trustStore.trustCommands(input.projectPath, [input.command])
      if (!trusted.ok) return trusted
    }

    changes.publish({ type: 'actions.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }

  async function moveAction(input: {
    projectPath: string
    id: string
    direction: 'up' | 'down'
  }): Promise<ActionsOperationResult<void>> {
    // End-of-list no-ops must not write or notify — plan first via a read.
    const current = await store.read(input.projectPath)
    if (!current.ok) return current

    const planned = planMoveAction(current.value, {
      actionId: input.id,
      direction: input.direction,
    })
    if (!planned.ok) return planned
    if (planned.kind === 'noop') {
      return { ok: true, value: undefined }
    }

    const result = await store.transact(input.projectPath, (file) => {
      const next = planMoveAction(file, {
        actionId: input.id,
        direction: input.direction,
      })
      if (!next.ok) return next
      if (next.kind === 'noop') {
        // Concurrent change made this a no-op; still ok, no durable rewrite needed.
        // Force a write of the current file is wasteful — treat as success without write by
        // rejecting the transaction path. Re-read outcome: return not as change reject.
        return {
          ok: true,
          value: { kind: 'move', file: next.file, action: next.action },
        }
      }
      return { ok: true, value: { kind: 'move', file: next.file, action: next.action } }
    })

    if (!result.ok) return result
    changes.publish({ type: 'actions.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }

  async function deleteAction(input: {
    projectPath: string
    id: string
  }): Promise<ActionsOperationResult<void>> {
    const result = await store.transact(input.projectPath, (current) => {
      const planned = planDeleteAction(current, { actionId: input.id })
      if (!planned.ok) return planned
      return {
        ok: true,
        value: { kind: 'delete', file: planned.file, actionId: planned.actionId },
      }
    })

    if (!result.ok) return result
    changes.publish({ type: 'actions.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }

  async function prepareActionRun(input: { projectPath: string; actionId: string }): Promise<
    ActionsOperationResult<{
      id: string
      title: string
      command: string
      where: 'primary' | 'local'
      projectPath: string
    }>
  > {
    const [fileResult, trustResult] = await Promise.all([
      store.read(input.projectPath),
      trustStore.readFingerprints(input.projectPath),
    ])
    if (!fileResult.ok) return fileResult
    if (!trustResult.ok) return trustResult

    const action = fileResult.value.actions.find((row) => row.id === input.actionId)
    if (action === undefined) {
      return { ok: false, error: { code: 'actions.not-found', actionId: input.actionId } }
    }
    if (!trustResult.value.has(commandFingerprint(action.command))) {
      return { ok: false, error: { code: 'actions.untrusted', actionId: input.actionId } }
    }

    return {
      ok: true,
      value: {
        id: action.id,
        title: action.title,
        command: action.command,
        where: action.where === 'local' ? 'local' : 'primary',
        projectPath: input.projectPath,
      },
    }
  }

  return Object.freeze({
    listActions,
    trustActions,
    addAction,
    updateAction,
    moveAction,
    deleteAction,
    prepareActionRun,
  })
}
