import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import { tasksContractFixtures, tasksProcedures } from '@porcelain/contracts/tasks'
import { describe, expect, it } from 'vitest'
import { resolveTasksTarget, tasksMutations } from './tasks-mutations'
import { tasksTableQuery } from './tasks-queries'

const ENVIRONMENT = 'environment-a'
const OTHER_ENVIRONMENT = 'environment-b'
const fixtures = tasksContractFixtures

const tasksProcedureCatalog = {
  procedures: tasksProcedures,
  notification: { parse: (value: unknown) => value },
  publicError: publicErrorSchema,
}

describe('tasksMutations', () => {
  it('binds each definition to exactly one canonical Tasks procedure', () => {
    expect(tasksMutations.create.procedure).toBe(tasksProcedures.createTask)
    expect(tasksMutations.create.procedureName).toBe('createTask')

    expect(tasksMutations.update.procedure).toBe(tasksProcedures.updateTask)
    expect(tasksMutations.update.procedureName).toBe('updateTask')

    expect(tasksMutations.delete.procedure).toBe(tasksProcedures.deleteTask)
    expect(tasksMutations.delete.procedureName).toBe('deleteTask')

    expect(tasksMutations.create.procedure).not.toBe(tasksProcedures.listTasks)
  })

  it('affects only the table identity of the Environment it is told to write to', () => {
    for (const definition of [
      tasksMutations.create,
      tasksMutations.update,
      tasksMutations.delete,
    ]) {
      const affected = definition.affectedQueries({ environmentId: ENVIRONMENT })
      expect(affected).toEqual([tasksTableQuery(ENVIRONMENT)])
      expect(affected).toHaveLength(1)
      expect(affected[0]).not.toEqual(tasksTableQuery(OTHER_ENVIRONMENT))
      expect(affected[0]).not.toEqual(tasksTableQuery(null))
      expect(definition.requiresAuthoritativeRefetch).toBe(true)

      const local = definition.affectedQueries({ environmentId: null })
      expect(local).toEqual([tasksTableQuery(null)])
    }
  })

  it('dispatches bound procedures through the validating daemon mock', async () => {
    const daemon = createValidatingDaemonMock(tasksProcedureCatalog, {
      createTask: () => ({ ok: true, value: fixtures.createTask.output }),
      updateTask: () => ({ ok: true, value: fixtures.updateTask.output }),
      deleteTask: () => ({ ok: true, value: fixtures.deleteTask.output }),
    })

    const outcomes = await Promise.all([
      daemon.dispatch({
        procedure: tasksMutations.create.procedureName,
        kind: tasksMutations.create.procedure.kind,
        input: fixtures.createTask.input,
      }),
      daemon.dispatch({
        procedure: tasksMutations.update.procedureName,
        kind: tasksMutations.update.procedure.kind,
        input: fixtures.updateTask.input,
      }),
      daemon.dispatch({
        procedure: tasksMutations.delete.procedureName,
        kind: tasksMutations.delete.procedure.kind,
        input: fixtures.deleteTask.input,
      }),
    ])

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true, true])
    expect(daemon.requests().map((request) => request.procedure)).toEqual([
      'createTask',
      'updateTask',
      'deleteTask',
    ])
  })
})

describe('resolveTasksTarget', () => {
  it('refuses an unknown Environment with the no-target code', () => {
    const resolved = resolveTasksTarget(undefined)
    expect(resolved).toEqual({ ok: false, error: { code: 'tasks.no-environment-target' } })
  })

  it('accepts null as the directly-connected daemon, not as "unknown"', () => {
    const resolved = resolveTasksTarget(null)
    expect(resolved).toEqual({ ok: true, value: { environmentId: null } })
  })

  it('keeps undefined and null apart — collapsing them would route a write by guess', () => {
    const unknown = resolveTasksTarget(undefined)
    const local = resolveTasksTarget(null)
    expect(unknown.ok).toBe(false)
    expect(local.ok).toBe(true)
    expect(unknown).not.toEqual(local)
    if (unknown.ok) throw new Error('an undefined Environment must not resolve to a target')
    if (!local.ok) throw new Error('null is the directly-connected daemon and must resolve')
    expect(unknown.error.code).toBe('tasks.no-environment-target')
    expect(local.value.environmentId).toBeNull()
  })

  it('passes a named Environment through unchanged', () => {
    expect(resolveTasksTarget(ENVIRONMENT)).toEqual({
      ok: true,
      value: { environmentId: ENVIRONMENT },
    })
  })
})
