import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import {
  tasksChangeSchema,
  tasksContractFixtures,
  tasksNotificationFixture,
  tasksProcedures,
} from '@porcelain/contracts/tasks'
import { describe, expect, it } from 'vitest'
import { tasksNotificationEffects } from './tasks-notifications'
import { tasksTableQuery } from './tasks-queries'

const ENVIRONMENT = 'environment-a'
const OTHER_ENVIRONMENT = 'environment-b'

const tasksCatalog = {
  procedures: { listTasks: tasksProcedures.listTasks },
  notification: tasksChangeSchema,
  publicError: publicErrorSchema,
}

describe('tasksNotificationEffects', () => {
  it('maps tasks.changed to the table identity of the Environment it was told about', () => {
    const notification = tasksNotificationFixture()
    expect(tasksNotificationEffects(notification, ENVIRONMENT)).toEqual([
      tasksTableQuery(ENVIRONMENT),
    ])
  })

  it('names no other Environment, and defaults to the directly-connected daemon', () => {
    const notification = tasksNotificationFixture()
    const effects = tasksNotificationEffects(notification, ENVIRONMENT)
    expect(effects).toHaveLength(1)
    expect(effects).not.toContainEqual(tasksTableQuery(OTHER_ENVIRONMENT))
    expect(effects).not.toContainEqual(tasksTableQuery(null))
    expect(tasksNotificationEffects(notification)).toEqual([tasksTableQuery(null)])
  })

  it('rejects malformed and unrelated notifications via the contract mock', () => {
    const daemon = createValidatingDaemonMock(tasksCatalog, {
      listTasks: () => ({ ok: true, value: tasksContractFixtures.listTasks.output }),
    })

    const seen: unknown[] = []
    daemon.subscribe((notification) => {
      seen.push(tasksNotificationEffects(tasksChangeSchema.parse(notification), ENVIRONMENT))
    })

    const valid = tasksNotificationFixture()
    expect(daemon.emit(valid)).toEqual(valid)
    expect(seen).toEqual([[tasksTableQuery(ENVIRONMENT)]])

    // A scope the flat signal does not carry
    expect(() => daemon.emit({ kind: 'tasks.changed', projectPath: '/synthetic/repo' })).toThrow()
    // Another domain's change
    expect(() =>
      daemon.emit({ kind: 'files.scope-changed', projectPath: '/synthetic/repo' }),
    ).toThrow()
    // Raw legacy event string envelope
    expect(() => daemon.emit({ type: 'tasks' })).toThrow()

    expect(seen).toHaveLength(1)
  })
})
