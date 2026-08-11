import {
  fileContentQuery,
  filesPinsQuery,
  filesProjectKey,
  filesScopeQuery,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import { describe, expect, it } from 'vitest'

import {
  filesQueryKey,
  filesQueryKeyForIdentity,
  isFilesQueryKey,
  isFilesTreeQueryKey,
  parseFilesQueryKey,
} from './files-query-key'

describe('mobile Files query keys', () => {
  it('isolates environment and normalized project identity', () => {
    const identity = filesTreeQuery('/synthetic/repo/', '.', false)
    expect(filesQueryKey('env-a', identity)).not.toEqual(filesQueryKey('env-b', identity))
    expect(filesQueryKey('env-a', identity)).toEqual(
      filesQueryKeyForIdentity('env-a', filesTreeQuery('/synthetic/repo', '.', false)),
    )
    expect(filesProjectKey('/synthetic/repo/')).toBe('/synthetic/repo')
    expect(filesQueryKey('env-a', filesPinsQuery('/synthetic/repo'))).not.toEqual(
      filesQueryKey('env-a', filesScopeQuery('/synthetic/repo')),
    )
  })

  it('parses only the daemon three-tuple and recognizes tree identities', () => {
    const treeKey = filesQueryKey('env-a', filesTreeQuery('/synthetic/repo', 'src', true))
    const contentKey = filesQueryKey('env-a', fileContentQuery('/synthetic/repo', 'src/main.ts'))
    expect(parseFilesQueryKey(treeKey)).toEqual({ environmentId: 'env-a', query: treeKey[2] })
    expect(isFilesQueryKey(treeKey)).toBe(true)
    expect(isFilesTreeQueryKey(treeKey)).toBe(true)
    expect(isFilesTreeQueryKey(contentKey)).toBe(false)
    expect(parseFilesQueryKey(['daemon', 'env-a', 'readDir', {}])).toBeNull()
  })
})
