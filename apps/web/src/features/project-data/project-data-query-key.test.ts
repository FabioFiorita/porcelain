import {
  projectDataDispositionsQuery,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import { describe, expect, it } from 'vitest'
import { isProjectDataQueryKey, projectDataQueryKey } from './project-data-query-key'

const PROJECT = '/synthetic/repo'
const DAEMON = { host: 'beelink', version: '0.52.1' }

describe('projectDataQueryKey', () => {
  it('composes identity + daemon scope', () => {
    const identity = projectDataDispositionsQuery(PROJECT)
    expect(projectDataQueryKey(DAEMON, identity)).toEqual([
      identity,
      { host: DAEMON.host, version: DAEMON.version },
    ])
    expect(projectDataQueryKey(DAEMON, projectDataVisibilityQuery(PROJECT))[0].name).toBe(
      'visibility',
    )
  })

  it('accepts typed keys and rejects foreign layouts', () => {
    const identity = projectDataDispositionsQuery(PROJECT)
    expect(isProjectDataQueryKey(projectDataQueryKey(DAEMON, identity))).toBe(true)
    expect(isProjectDataQueryKey([identity, { host: null, version: null }])).toBe(true)
    expect(isProjectDataQueryKey([identity, null])).toBe(false)
    expect(isProjectDataQueryKey([{ domain: 'project-data', name: 'notes' }, DAEMON])).toBe(false)
    expect(
      isProjectDataQueryKey([{ domain: 'actions', name: 'list', projectPath: PROJECT }, DAEMON]),
    ).toBe(false)
  })
})
