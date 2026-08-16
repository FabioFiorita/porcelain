import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorSchema } from '@porcelain/contracts'
import {
  actionsChangeSchema,
  actionsContractFixtures,
  actionsNotificationFixtures,
  actionsProcedures,
} from '@porcelain/contracts/actions'
import { describe, expect, it } from 'vitest'
import { actionsNotificationEffects } from './actions-notifications'
import { actionsQuery, actionTrustQuery } from './actions-queries'

const PROJECT = 'proj-alpha'
const OTHER = 'proj-other'

const actionsCatalog = {
  procedures: {
    actions: actionsProcedures.actions,
  },
  notification: actionsChangeSchema,
  publicError: publicErrorSchema,
}

describe('actionsNotificationEffects', () => {
  it('maps a valid actions.changed fixture to list then trust for its project', () => {
    const notification = actionsNotificationFixtures['actions.changed']
    expect(actionsNotificationEffects(notification)).toEqual([
      actionsQuery(PROJECT),
      actionTrustQuery(PROJECT),
    ])
    expect(actionsNotificationEffects(notification)).not.toEqual([
      actionsQuery(OTHER),
      actionTrustQuery(OTHER),
    ])
  })

  it('rejects malformed and unrelated notifications via the contract mock', () => {
    const daemon = createValidatingDaemonMock(actionsCatalog, {
      actions: () => ({
        ok: true,
        value: actionsContractFixtures.actions.output,
      }),
    })

    const seen: unknown[] = []
    daemon.subscribe((notification) => {
      seen.push(actionsNotificationEffects(actionsChangeSchema.parse(notification)))
    })

    const valid = actionsNotificationFixtures['actions.changed']
    expect(daemon.emit(valid)).toEqual(valid)
    expect(seen).toEqual([[actionsQuery(PROJECT), actionTrustQuery(PROJECT)]])

    // Missing projectId
    expect(() => daemon.emit({ kind: 'actions.changed' })).toThrow()
    // Empty projectId
    expect(() => daemon.emit({ kind: 'actions.changed', projectId: '' })).toThrow()
    // A checkout path instead of a Project id is no longer the wire shape
    expect(() => daemon.emit({ kind: 'actions.changed', projectPath: '/synthetic/repo' })).toThrow()
    // Unknown field
    expect(() =>
      daemon.emit({ kind: 'actions.changed', projectId: PROJECT, payload: true }),
    ).toThrow()
    // Unrelated kind
    expect(() => daemon.emit({ kind: 'files.scope-changed', projectPath: PROJECT })).toThrow()
    // Raw legacy event string envelope
    expect(() => daemon.emit({ type: 'actions' })).toThrow()

    expect(seen).toHaveLength(1)
  })
})
