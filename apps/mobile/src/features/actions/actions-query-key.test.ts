import { actionTrustQuery } from '@porcelain/client-runtime/actions'
import { describe, expect, it } from 'vitest'
import {
  actionsCacheKeyForIdentity,
  actionsListKeyForProject,
  actionsListQueryKey,
  isActionsQueryKey,
} from './actions-query-key'

const PROJECT = 'proj-alpha'
const OTHER = 'proj-beta'
const ENV = 'env-actions-test'
const OTHER_ENV = 'env-other'

const listFor = (projectId: string) => ({ domain: 'actions', name: 'list', projectId }) as const

describe('mobile actions query keys', () => {
  it('isolates by environment and Project id', () => {
    const identity = listFor(PROJECT)
    expect(actionsListQueryKey(ENV, identity)).toEqual(['daemon', ENV, identity])
    expect(actionsListKeyForProject(ENV, PROJECT)).toEqual([
      'daemon',
      ENV,
      { domain: 'actions', name: 'list', projectId: PROJECT },
    ])
    expect(actionsListKeyForProject(ENV, OTHER)[2]).not.toEqual(
      actionsListKeyForProject(ENV, PROJECT)[2],
    )
    expect(actionsListKeyForProject(OTHER_ENV, PROJECT)[1]).not.toEqual(
      actionsListKeyForProject(ENV, PROJECT)[1],
    )
  })

  it('collapses trust identity onto the same project list key', () => {
    const listKey = actionsCacheKeyForIdentity(ENV, listFor(PROJECT))
    const trustKey = actionsCacheKeyForIdentity(ENV, actionTrustQuery(PROJECT))
    expect(trustKey).toEqual(listKey)
    expect(trustKey[2]).toEqual({ domain: 'actions', name: 'list', projectId: PROJECT })
  })

  it('isActionsQueryKey accepts list/trust and rejects foreign layouts', () => {
    const list = listFor(PROJECT)
    expect(isActionsQueryKey(actionsListQueryKey(ENV, list))).toBe(true)
    expect(isActionsQueryKey(['daemon', ENV, actionTrustQuery(PROJECT)])).toBe(true)
    expect(isActionsQueryKey([list, { host: null, version: null }])).toBe(false)
    expect(
      isActionsQueryKey(['daemon', ENV, { domain: 'board', name: 'cards', projectId: PROJECT }]),
    ).toBe(false)
    // Actions are keyed by the stable Project id, so a checkout-path identity is foreign (#24).
    expect(
      isActionsQueryKey([
        'daemon',
        ENV,
        { domain: 'actions', name: 'list', projectPath: '/synthetic/repo' },
      ]),
    ).toBe(false)
    expect(isActionsQueryKey(['daemon', '', list])).toBe(false)
  })
})
