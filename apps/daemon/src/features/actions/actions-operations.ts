import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import type {
  Action,
  ActionRunTarget,
  ActionView,
  PrepareActionRunOutput,
} from '@porcelain/contracts/actions'
import type { SessionChange } from '@porcelain/contracts/session'
import {
  type ActionsFileAction,
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
  ActionsProjects,
  ActionsSource,
  ActionsStore,
  ActionsStoreResult,
  ActionTrustStore,
} from './actions-ports'
import { commandFingerprint } from './json-action-trust-store'

export type ActionsOperations = {
  listActions: (input: { projectId: string }) => Promise<ActionsOperationResult<ActionView[]>>
  trustActions: (input: {
    projectId: string
    ids: string[]
  }) => Promise<ActionsOperationResult<void>>
  addAction: (input: {
    projectId: string
    title: string
    command: string
    where?: 'primary' | 'local'
  }) => Promise<ActionsOperationResult<Action>>
  updateAction: (input: {
    projectId: string
    id: string
    title?: string
    command?: string
    where?: 'primary' | 'local'
  }) => Promise<ActionsOperationResult<void>>
  moveAction: (input: {
    projectId: string
    id: string
    direction: 'up' | 'down'
  }) => Promise<ActionsOperationResult<void>>
  deleteAction: (input: { projectId: string; id: string }) => Promise<ActionsOperationResult<void>>
  prepareActionRun: (input: {
    actionId: string
    target: ActionRunTarget
  }) => Promise<ActionsOperationResult<PrepareActionRunOutput>>
}

export function createActionsOperations(options: {
  /** Read order; the `private` daemon-root store is the only writable one today. */
  sources: readonly ActionsSource[]
  trustStore: ActionTrustStore
  projects: ActionsProjects
  clock?: ActionsClock
  ids?: ActionsIds
  changes?: ActionsChanges
  publishSessionChange?: (change: SessionChange) => void
}): ActionsOperations {
  const writable = options.sources.find((source) => source.kind === 'private')
  if (writable === undefined) {
    throw new Error('actions: a writable private source is required')
  }
  const store: ActionsStore = writable.store
  const trustStore = options.trustStore
  const clock = options.clock ?? { now: () => Date.now() }
  const ids = options.ids ?? { create: () => randomUUID() }
  const changes =
    options.changes ??
    createActionsChangesPublisher(options.publishSessionChange ?? (() => undefined))

  /**
   * Every configured source in order, first claim of an id winning. With one source
   * this is the private store's own list; #26's tracked overlay slots in beside it
   * without the read path changing shape.
   */
  async function readAllSources(
    projectId: string,
  ): Promise<ActionsStoreResult<ActionsFileAction[]>> {
    const merged: ActionsFileAction[] = []
    const seen = new Set<string>()
    for (const source of options.sources) {
      const read = await source.store.read(projectId)
      if (!read.ok) return read
      for (const action of read.value.actions) {
        if (seen.has(action.id)) continue
        seen.add(action.id)
        merged.push(action)
      }
    }
    return { ok: true, value: merged }
  }

  async function listActions(input: {
    projectId: string
  }): Promise<ActionsOperationResult<ActionView[]>> {
    const [actionsResult, trustResult] = await Promise.all([
      readAllSources(input.projectId),
      trustStore.readFingerprints(input.projectId),
    ])
    if (!actionsResult.ok) return actionsResult
    if (!trustResult.ok) return trustResult

    const views: ActionView[] = sortActions(actionsResult.value).map((action) => ({
      ...action,
      trusted: trustResult.value.has(commandFingerprint(action.command)),
    }))
    return { ok: true, value: views }
  }

  async function trustActions(input: {
    projectId: string
    ids: string[]
  }): Promise<ActionsOperationResult<void>> {
    const actionsResult = await readAllSources(input.projectId)
    if (!actionsResult.ok) return actionsResult

    const wanted = new Set(input.ids)
    const commands = actionsResult.value
      .filter((action) => wanted.has(action.id))
      .map((action) => action.command)

    const trusted = await trustStore.trustCommands(input.projectId, commands)
    if (!trusted.ok) return trusted

    changes.publish({ type: 'actions.changed', projectId: input.projectId })
    return { ok: true, value: undefined }
  }

  async function addAction(input: {
    projectId: string
    title: string
    command: string
    where?: 'primary' | 'local'
  }): Promise<ActionsOperationResult<Action>> {
    const now = clock.now()
    const id = ids.create()

    const result = await store.transact(input.projectId, (current) => {
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
    const trusted = await trustStore.trustCommands(input.projectId, [result.value.action.command])
    if (!trusted.ok) return trusted

    changes.publish({ type: 'actions.changed', projectId: input.projectId })
    return { ok: true, value: result.value.action }
  }

  async function updateAction(input: {
    projectId: string
    id: string
    title?: string
    command?: string
    where?: 'primary' | 'local'
  }): Promise<ActionsOperationResult<void>> {
    const result = await store.transact(input.projectId, (current) => {
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
      // Fingerprint the stored normalized command, not the raw input text.
      const trusted = await trustStore.trustCommands(input.projectId, [result.value.action.command])
      if (!trusted.ok) return trusted
    }

    changes.publish({ type: 'actions.changed', projectId: input.projectId })
    return { ok: true, value: undefined }
  }

  async function moveAction(input: {
    projectId: string
    id: string
    direction: 'up' | 'down'
  }): Promise<ActionsOperationResult<void>> {
    // End-of-list no-ops must not write or notify — plan first via a read.
    const current = await store.read(input.projectId)
    if (!current.ok) return current

    const planned = planMoveAction(current.value, {
      actionId: input.id,
      direction: input.direction,
    })
    if (!planned.ok) return planned
    if (planned.kind === 'noop') {
      return { ok: true, value: undefined }
    }

    let concurrentNoop = false
    const result = await store.transact(input.projectId, (file) => {
      const next = planMoveAction(file, {
        actionId: input.id,
        direction: input.direction,
      })
      if (!next.ok) return next
      if (next.kind === 'noop') {
        // Concurrent change made this a no-op: reject the transaction so nothing durable
        // is written; the flag below converts the sentinel reject back into void success.
        concurrentNoop = true
        return { ok: false, error: { code: 'request.invalid' } }
      }
      return { ok: true, value: { kind: 'move', file: next.file, action: next.action } }
    })

    if (concurrentNoop) {
      return { ok: true, value: undefined }
    }
    if (!result.ok) return result
    changes.publish({ type: 'actions.changed', projectId: input.projectId })
    return { ok: true, value: undefined }
  }

  async function deleteAction(input: {
    projectId: string
    id: string
  }): Promise<ActionsOperationResult<void>> {
    const result = await store.transact(input.projectId, (current) => {
      const planned = planDeleteAction(current, { actionId: input.id })
      if (!planned.ok) return planned
      return {
        ok: true,
        value: { kind: 'delete', file: planned.file, actionId: planned.actionId },
      }
    })

    if (!result.ok) return result
    changes.publish({ type: 'actions.changed', projectId: input.projectId })
    return { ok: true, value: undefined }
  }

  /**
   * Authorize exactly one run. Three independent gates, all of them the daemon's:
   * the Action exists in this Project, the target names a checkout this daemon
   * currently lists for that Project, and the command text is trusted on this
   * machine. Nothing is spawned here — the client creates the terminal the human
   * then watches, so a curated Action still cannot execute without a human press.
   */
  async function prepareActionRun(input: {
    actionId: string
    target: ActionRunTarget
  }): Promise<ActionsOperationResult<PrepareActionRunOutput>> {
    const projectId = input.target.projectId
    const [actionsResult, trustResult, worktreeResult] = await Promise.all([
      readAllSources(projectId),
      trustStore.readFingerprints(projectId),
      options.projects.listWorktreePaths(projectId),
    ])
    if (!actionsResult.ok) return actionsResult
    if (!trustResult.ok) return trustResult
    if (!worktreeResult.ok) return worktreeResult

    const action = actionsResult.value.find((row) => row.id === input.actionId)
    if (action === undefined) {
      return { ok: false, error: { code: 'actions.not-found', actionId: input.actionId } }
    }

    const cwd = resolve(input.target.path)
    const known = worktreeResult.value.some((path) => resolve(path) === cwd)
    if (!known) {
      return { ok: false, error: { code: 'actions.target-invalid', actionId: input.actionId } }
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
        cwd,
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
