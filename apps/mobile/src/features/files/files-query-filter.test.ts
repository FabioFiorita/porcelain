import {
  fileContentQuery,
  filePreviewQuery,
  filesExactEffect,
  filesPinsQuery,
  filesTreeFamilyEffect,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import {
  filesPathIsSelfOrDescendant,
  filesQueryMatchesEffect,
  invalidateFilesEffects,
  invalidateFilesProjectQueries,
} from './files-query-filter'
import { filesQueryKey } from './files-query-key'

const ENV = 'env-files-filter'
const PROJECT = '/synthetic/repo'

describe('mobile Files query effects', () => {
  it('uses segment-safe path matching and root self-only semantics', () => {
    expect(filesPathIsSelfOrDescendant('src', 'src')).toBe(true)
    expect(filesPathIsSelfOrDescendant('src/components', 'src')).toBe(true)
    expect(filesPathIsSelfOrDescendant('src2', 'src')).toBe(false)
    expect(filesPathIsSelfOrDescendant('ab', 'a')).toBe(false)

    const root = filesQueryKey(ENV, filesTreeQuery(PROJECT, '.', false))
    const nested = filesQueryKey(ENV, filesTreeQuery(PROJECT, 'src', false))
    const rootEffect = { path: '.', projectPath: PROJECT, type: 'tree-subtree' as const }
    expect(filesQueryMatchesEffect(root, rootEffect, ENV)).toBe(true)
    expect(filesQueryMatchesEffect(nested, rootEffect, ENV)).toBe(false)
  })

  it('binds tree families and content subtrees across identity variants', () => {
    const tree = filesQueryKey(ENV, filesTreeQuery(PROJECT, 'src', false))
    const hiddenTree = filesQueryKey(ENV, filesTreeQuery(PROJECT, 'src', true))
    const content = filesQueryKey(ENV, fileContentQuery(PROJECT, 'src/main.ts'))
    const preview = filesQueryKey(ENV, filePreviewQuery(PROJECT, 'src/main.ts'))
    const family = filesTreeFamilyEffect(PROJECT)
    expect(filesQueryMatchesEffect(tree, family, ENV)).toBe(true)
    expect(filesQueryMatchesEffect(hiddenTree, family, ENV)).toBe(true)
    expect(
      filesQueryMatchesEffect(
        content,
        {
          path: 'src',
          projectPath: PROJECT,
          type: 'content-subtree',
        },
        ENV,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        preview,
        {
          path: 'src',
          projectPath: PROJECT,
          type: 'content-subtree',
        },
        ENV,
      ),
    ).toBe(true)
    expect(filesQueryMatchesEffect(tree, family, 'other-env')).toBe(false)
  })

  it('invalidates exact effects and project recovery without touching another project or env', async () => {
    const queryClient = new QueryClient()
    const targetTree = filesQueryKey(ENV, filesTreeQuery(PROJECT, '.', false))
    const targetPins = filesQueryKey(ENV, filesPinsQuery(PROJECT))
    const otherProject = filesQueryKey(ENV, filesPinsQuery('/other/repo'))
    const otherEnvironment = filesQueryKey('other-env', filesPinsQuery(PROJECT))
    for (const key of [targetTree, targetPins, otherProject, otherEnvironment]) {
      queryClient.setQueryData(key, 'cached')
    }

    await invalidateFilesEffects(queryClient, ENV, [filesExactEffect(filesPinsQuery(PROJECT))])
    expect(queryClient.getQueryState(targetPins)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(targetTree)?.isInvalidated).toBe(false)

    await invalidateFilesProjectQueries(queryClient, ENV, PROJECT)
    expect(queryClient.getQueryState(targetTree)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherProject)?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(otherEnvironment)?.isInvalidated).toBe(false)
  })
})
