import { actionsQuery, actionTrustQuery } from '@porcelain/client-runtime/actions'
import { describe, expect, it } from 'vitest'
import {
  actionsCacheKeyForIdentity,
  actionsListKeyForProject,
  actionsListQueryKey,
  isActionsQueryKey,
} from './actions-query-key'

const PROJECT = 'proj-alpha'
const OTHER = 'proj-beta'
const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'mac', version: '0.52.1' }

describe('actionsListQueryKey', () => {
  it('composes list identity + daemon scope and isolates projects/daemons', () => {
    const identity = actionsQuery(PROJECT)
    expect(actionsListQueryKey(DAEMON, identity)).toEqual([
      identity,
      { host: DAEMON.host, version: DAEMON.version },
    ])
    expect(actionsListKeyForProject(DAEMON, PROJECT)).toEqual([
      { domain: 'actions', name: 'list', projectId: PROJECT },
      { host: DAEMON.host, version: DAEMON.version },
    ])
    expect(actionsListKeyForProject(DAEMON, OTHER)[0]).not.toEqual(
      actionsListKeyForProject(DAEMON, PROJECT)[0],
    )
    expect(actionsListKeyForProject(OTHER_DAEMON, PROJECT)[1]).not.toEqual(
      actionsListKeyForProject(DAEMON, PROJECT)[1],
    )
  })

  it('collapses trust identity onto the same project list key', () => {
    const listKey = actionsCacheKeyForIdentity(DAEMON, actionsQuery(PROJECT))
    const trustKey = actionsCacheKeyForIdentity(DAEMON, actionTrustQuery(PROJECT))
    expect(trustKey).toEqual(listKey)
    expect(trustKey[0]).toEqual({ domain: 'actions', name: 'list', projectId: PROJECT })
  })
})

describe('isActionsQueryKey', () => {
  const LIST = actionsQuery(PROJECT)

  it('accepts list and trust identity keys with null-identity daemon scope', () => {
    expect(isActionsQueryKey(actionsListQueryKey(DAEMON, LIST))).toBe(true)
    expect(isActionsQueryKey([LIST, { host: null, version: null }])).toBe(true)
    expect(isActionsQueryKey([actionTrustQuery(PROJECT), { host: null, version: null }])).toBe(true)
  })

  it('rejects malformed daemon scope and foreign layouts', () => {
    expect(isActionsQueryKey([LIST, { host: 'beelink' }])).toBe(false)
    expect(isActionsQueryKey([LIST, { host: null, version: 2 }])).toBe(false)
    expect(isActionsQueryKey([LIST, { host: null, version: null, extra: true }])).toBe(false)
    expect(isActionsQueryKey([LIST, null])).toBe(false)
    expect(isActionsQueryKey([LIST])).toBe(false)
    expect(isActionsQueryKey([{ domain: 'actions', name: 'list' }, DAEMON])).toBe(false)
    expect(isActionsQueryKey([{ domain: 'actions', name: 'list', projectId: '' }, DAEMON])).toBe(
      false,
    )
    // A path-keyed cache row is not an Actions key any more.
    expect(
      isActionsQueryKey([
        { domain: 'actions', name: 'list', projectPath: '/synthetic/repo' },
        DAEMON,
      ]),
    ).toBe(false)
    expect(
      isActionsQueryKey([{ domain: 'board', name: 'cards', projectId: PROJECT }, DAEMON]),
    ).toBe(false)
    expect(isActionsQueryKey(['daemon', 'env-1', LIST])).toBe(false)
    expect(isActionsQueryKey([LIST, DAEMON, 'extra'])).toBe(false)
  })
})
