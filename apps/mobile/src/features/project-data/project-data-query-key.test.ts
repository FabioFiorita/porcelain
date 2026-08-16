import { projectDataDispositionsQuery } from '@porcelain/client-runtime/project-data'
import { describe, expect, it } from 'vitest'
import { isProjectDataQueryKey, projectDataQueryKey } from './project-data-query-key'

const PROJECT = '/synthetic/repo'
const ENV = 'env-project-data'

describe('mobile Project Data query keys', () => {
  it('isolates by environment and project', () => {
    const identity = projectDataDispositionsQuery(PROJECT)
    expect(projectDataQueryKey(ENV, identity)).toEqual(['daemon', ENV, identity])
    expect(projectDataQueryKey(ENV, projectDataDispositionsQuery('/other'))[2]).not.toEqual(
      identity,
    )
  })

  it('accepts typed identities and rejects foreign layouts', () => {
    const identity = projectDataDispositionsQuery(PROJECT)
    expect(isProjectDataQueryKey(projectDataQueryKey(ENV, identity))).toBe(true)
    expect(isProjectDataQueryKey([identity, { host: null, version: null }])).toBe(false)
    expect(
      isProjectDataQueryKey([
        'daemon',
        ENV,
        { domain: 'actions', name: 'list', projectPath: PROJECT },
      ]),
    ).toBe(false)
    expect(isProjectDataQueryKey(['daemon', '', identity])).toBe(false)
  })
})
