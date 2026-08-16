import {
  projectDataDispositionsQuery,
  projectDataLayersQuery,
  projectDataVisibilityQuery,
} from '@porcelain/client-runtime/project-data'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  invalidateProjectDataLayers,
  isProjectDataQueryKey,
  projectDataQueryKey,
} from './project-data-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'mac', version: '0.52.1' }

describe('projectDataQueryKey', () => {
  it('composes identity + daemon scope and isolates projects/daemons', () => {
    const identity = projectDataLayersQuery(PROJECT)
    expect(projectDataQueryKey(DAEMON, identity)).toEqual([
      identity,
      { host: DAEMON.host, version: DAEMON.version },
    ])
    expect(projectDataQueryKey(DAEMON, projectDataLayersQuery(OTHER))[0]).not.toEqual(
      projectDataQueryKey(DAEMON, identity)[0],
    )
    expect(projectDataQueryKey(OTHER_DAEMON, identity)[1]).not.toEqual(
      projectDataQueryKey(DAEMON, identity)[1],
    )
    expect(projectDataQueryKey(DAEMON, projectDataLayersQuery(PROJECT))[0].name).toBe('layers')
    expect(projectDataQueryKey(DAEMON, projectDataDispositionsQuery(PROJECT))[0].name).toBe(
      'dispositions',
    )
    expect(projectDataQueryKey(DAEMON, projectDataVisibilityQuery(PROJECT))[0].name).toBe(
      'visibility',
    )
  })
})

describe('isProjectDataQueryKey', () => {
  const LAYERS = projectDataLayersQuery(PROJECT)

  it('accepts identity keys including a null-identity daemon scope', () => {
    expect(isProjectDataQueryKey(projectDataQueryKey(DAEMON, LAYERS))).toBe(true)
    expect(isProjectDataQueryKey([LAYERS, { host: null, version: null }])).toBe(true)
    expect(
      isProjectDataQueryKey(projectDataQueryKey(DAEMON, projectDataLayersQuery(PROJECT))),
    ).toBe(true)
  })

  it('rejects malformed daemon scope and foreign layouts', () => {
    expect(isProjectDataQueryKey([LAYERS, { host: 'beelink' }])).toBe(false)
    expect(isProjectDataQueryKey([LAYERS, { host: null, version: 2 }])).toBe(false)
    expect(isProjectDataQueryKey([LAYERS, { host: null, version: null, extra: true }])).toBe(false)
    expect(isProjectDataQueryKey([LAYERS, null])).toBe(false)
    expect(isProjectDataQueryKey([LAYERS])).toBe(false)
    expect(isProjectDataQueryKey([{ domain: 'project-data', name: 'notes' }, DAEMON])).toBe(false)
    expect(
      isProjectDataQueryKey([{ domain: 'project-data', name: 'readNotes', projectPath: PROJECT }]),
    ).toBe(false)
    expect(
      isProjectDataQueryKey([{ domain: 'actions', name: 'list', projectPath: PROJECT }, DAEMON]),
    ).toBe(false)
    expect(isProjectDataQueryKey(['daemon', 'env-1', LAYERS])).toBe(false)
    expect(isProjectDataQueryKey([LAYERS, DAEMON, 'extra'])).toBe(false)
  })
})

describe('invalidateProjectDataLayers', () => {
  it('invalidates layers and leaves dispositions and visibility', async () => {
    const queryClient = new QueryClient()
    const layers = projectDataQueryKey(DAEMON, projectDataLayersQuery(PROJECT))
    const dispositions = projectDataQueryKey(DAEMON, projectDataDispositionsQuery(PROJECT))
    const visibility = projectDataQueryKey(DAEMON, projectDataVisibilityQuery(PROJECT))
    queryClient.setQueryData(layers, { layers: [], custom: false })
    queryClient.setQueryData(dispositions, [])
    queryClient.setQueryData(visibility, { hidden: false })

    await invalidateProjectDataLayers(queryClient)

    expect(queryClient.getQueryState(layers)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(dispositions)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(visibility)?.isInvalidated).toBeFalsy()
  })
})
