import {
  fileContentQuery,
  filePreviewQuery,
  filesPinsQuery,
  filesScopeQuery,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import { describe, expect, it } from 'vitest'
import {
  filesQueryKey,
  isFilesQueryKey,
  isFilesTreeQueryKey,
  parseFilesQueryKey,
} from './files-query-key'

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

describe('Files query-key parsing', () => {
  const TREE = filesTreeQuery(PROJECT, 'src', false)

  it('rejects a malformed daemon scope', () => {
    expect(isFilesQueryKey([TREE, { host: 'beelink' }])).toBe(false)
    expect(isFilesQueryKey([TREE, { host: 1, version: null }])).toBe(false)
    expect(isFilesQueryKey([TREE, { host: null, version: null, extra: true }])).toBe(false)
    expect(isFilesQueryKey([TREE, null])).toBe(false)
    expect(isFilesQueryKey([TREE])).toBe(false)
    // A null-identity daemon is a real scope, not a malformed one.
    expect(isFilesQueryKey([TREE, { host: null, version: null }])).toBe(true)
  })

  it('rejects malformed identities and foreign key layouts', () => {
    expect(isFilesQueryKey([{ ...TREE, showHidden: 'yes' }, DAEMON])).toBe(false)
    expect(isFilesQueryKey([{ ...TREE, extra: 1 }, DAEMON])).toBe(false)
    expect(isFilesQueryKey([{ domain: 'files', name: 'tree', projectPath: PROJECT }, DAEMON])).toBe(
      false,
    )
    expect(isFilesQueryKey([{ ...TREE, projectPath: 'relative' }, DAEMON])).toBe(false)
    // The mobile three-tuple layout is not a Web key.
    expect(isFilesQueryKey(['daemon', 'env-1', TREE])).toBe(false)
    expect(isFilesQueryKey([TREE, DAEMON, 'extra'])).toBe(false)
    expect(isFilesTreeQueryKey([{ ...TREE, name: 'pins' }, DAEMON])).toBe(false)
  })

  it('returns the identity and scope for a valid key, null otherwise', () => {
    const parsed = parseFilesQueryKey(filesQueryKey(DAEMON, TREE))
    expect(parsed?.query).toEqual(TREE)
    expect(parsed?.daemon).toEqual(DAEMON)
    expect(parseFilesQueryKey([{ domain: 'board', name: 'cards' }, DAEMON])).toBeNull()
  })

  it('keeps segment-safe Files paths parseable', () => {
    // `a` must not be read as a prefix of `ab`; both are valid identities.
    const a = filesTreeQuery(PROJECT, 'a', false)
    const ab = filesTreeQuery(PROJECT, 'ab', false)
    expect(isFilesTreeQueryKey(filesQueryKey(DAEMON, a))).toBe(true)
    expect(isFilesTreeQueryKey(filesQueryKey(DAEMON, ab))).toBe(true)
    expect(parseFilesQueryKey(filesQueryKey(DAEMON, a))?.query).not.toEqual(
      parseFilesQueryKey(filesQueryKey(DAEMON, ab))?.query,
    )
  })
})
