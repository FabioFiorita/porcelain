import { projectDataLayersQuery } from '@porcelain/client-runtime/project-data'
import { describe, expect, it } from 'vitest'
import { isProjectDataQueryKey, projectDataQueryKey } from './project-data-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const ENV = 'env-project-data'
const OTHER_ENV = 'env-other'

describe('mobile Project Data query keys', () => {
  it('isolates by environment and project', () => {
    const identity = projectDataLayersQuery(PROJECT)
    expect(projectDataQueryKey(ENV, identity)).toEqual(['daemon', ENV, identity])
    expect(projectDataQueryKey(ENV, projectDataLayersQuery(OTHER))[2]).not.toEqual(
      projectDataQueryKey(ENV, identity)[2],
    )
    expect(projectDataQueryKey(OTHER_ENV, identity)[1]).not.toEqual(
      projectDataQueryKey(ENV, identity)[1],
    )
    expect(projectDataQueryKey(ENV, projectDataLayersQuery(PROJECT))[2].name).toBe('layers')
  })

  it('accepts typed identities and rejects foreign layouts', () => {
    const layers = projectDataLayersQuery(PROJECT)
    expect(isProjectDataQueryKey(projectDataQueryKey(ENV, layers))).toBe(true)
    expect(isProjectDataQueryKey([layers, { host: null, version: null }])).toBe(false)
    expect(
      isProjectDataQueryKey([
        'daemon',
        ENV,
        { domain: 'actions', name: 'list', projectPath: PROJECT },
      ]),
    ).toBe(false)
    expect(isProjectDataQueryKey(['daemon', '', layers])).toBe(false)
  })
})
