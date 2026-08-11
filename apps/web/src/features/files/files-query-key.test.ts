import {
  fileContentQuery,
  filePreviewQuery,
  filesPinsQuery,
  filesScopeQuery,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import { describe, expect, it } from 'vitest'
import { filesQueryKey, isFilesQueryKey, isFilesTreeQueryKey } from './files-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'mac', version: '0.52.1' }

describe('filesQueryKey', () => {
  it('embeds each of the five FIL-004 identities with daemon scope', () => {
    const tree = filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src', false))
    expect(tree[0]).toEqual({
      domain: 'files',
      name: 'tree',
      projectPath: PROJECT,
      path: 'src',
      showHidden: false,
    })
    expect(tree[1]).toEqual(DAEMON)

    const pins = filesQueryKey(DAEMON, filesPinsQuery(PROJECT))
    expect(pins[0]).toEqual({ domain: 'files', name: 'pins', projectPath: PROJECT })

    const scope = filesQueryKey(DAEMON, filesScopeQuery(PROJECT))
    expect(scope[0]).toEqual({ domain: 'files', name: 'scope', projectPath: PROJECT })

    const content = filesQueryKey(DAEMON, fileContentQuery(PROJECT, 'README.md'))
    expect(content[0]).toEqual({
      domain: 'files',
      name: 'content',
      projectPath: PROJECT,
      path: 'README.md',
    })

    const preview = filesQueryKey(DAEMON, filePreviewQuery(PROJECT, 'docs/index.html'))
    expect(preview[0]).toEqual({
      domain: 'files',
      name: 'preview',
      projectPath: PROJECT,
      path: 'docs/index.html',
    })
  })

  it('isolates by projectPath and daemon host/version', () => {
    const a = filesQueryKey(DAEMON, filesTreeQuery(PROJECT, '.', false))
    const otherProject = filesQueryKey(DAEMON, filesTreeQuery(OTHER, '.', false))
    const otherDaemon = filesQueryKey(OTHER_DAEMON, filesTreeQuery(PROJECT, '.', false))
    expect(a[0]).not.toEqual(otherProject[0])
    expect(a[1]).not.toEqual(otherDaemon[1])
  })
})

describe('isFilesQueryKey / isFilesTreeQueryKey', () => {
  it('recognizes Files identities and tree specifically', () => {
    const treeKey = filesQueryKey(DAEMON, filesTreeQuery(PROJECT, '.', true))
    const pinsKey = filesQueryKey(DAEMON, filesPinsQuery(PROJECT))
    expect(isFilesQueryKey(treeKey)).toBe(true)
    expect(isFilesQueryKey(pinsKey)).toBe(true)
    expect(isFilesTreeQueryKey(treeKey)).toBe(true)
    expect(isFilesTreeQueryKey(pinsKey)).toBe(false)
    expect(isFilesQueryKey([{ domain: 'board', name: 'cards' }, DAEMON])).toBe(false)
  })
})
