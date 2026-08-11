import {
  fileContentQuery,
  filePreviewQuery,
  filesContentSubtreeEffect,
  filesExactEffect,
  filesPinsQuery,
  filesTreeFamilyEffect,
  filesTreeQuery,
  filesTreeSubtreeEffect,
} from '@porcelain/client-runtime/files'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  filesPathIsSelfOrDescendant,
  filesQueryMatchesEffect,
  invalidateFilesEffects,
} from './files-query-filter'
import { filesQueryKey } from './files-query-key'

const PROJECT = '/synthetic/repo'
const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'mac', version: '0.52.1' }

describe('filesPathIsSelfOrDescendant', () => {
  it('is segment-safe: a matches a and a/x, not ab', () => {
    expect(filesPathIsSelfOrDescendant('a', 'a')).toBe(true)
    expect(filesPathIsSelfOrDescendant('a/x', 'a')).toBe(true)
    expect(filesPathIsSelfOrDescendant('ab', 'a')).toBe(false)
    expect(filesPathIsSelfOrDescendant('src', 'src')).toBe(true)
    expect(filesPathIsSelfOrDescendant('src/x', 'src')).toBe(true)
    expect(filesPathIsSelfOrDescendant('src2', 'src')).toBe(false)
  })
})

describe('filesQueryMatchesEffect', () => {
  it('matches exact identities only when daemon and query equal', () => {
    const query = filesTreeQuery(PROJECT, 'src', false)
    const key = filesQueryKey(DAEMON, query)
    const effect = filesExactEffect(query)
    expect(filesQueryMatchesEffect(key, effect, DAEMON)).toBe(true)
    expect(filesQueryMatchesEffect(key, effect, OTHER_DAEMON)).toBe(false)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src', true)),
        effect,
        DAEMON,
      ),
    ).toBe(false)
  })

  it('tree-family hits all showHidden rows for the project', () => {
    const effect = filesTreeFamilyEffect(PROJECT)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, '.', false)),
        effect,
        DAEMON,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src', true)),
        effect,
        DAEMON,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery('/synthetic/other', '.', false)),
        effect,
        DAEMON,
      ),
    ).toBe(false)
    expect(
      filesQueryMatchesEffect(filesQueryKey(DAEMON, filesPinsQuery(PROJECT)), effect, DAEMON),
    ).toBe(false)
  })

  it('tree-subtree is segment-safe and treats . as self only', () => {
    const srcEffect = filesTreeSubtreeEffect(PROJECT, 'src')
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src', false)),
        srcEffect,
        DAEMON,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src/x', true)),
        srcEffect,
        DAEMON,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src2', false)),
        srcEffect,
        DAEMON,
      ),
    ).toBe(false)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'a', false)),
        filesTreeSubtreeEffect(PROJECT, 'a'),
        DAEMON,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'ab', false)),
        filesTreeSubtreeEffect(PROJECT, 'a'),
        DAEMON,
      ),
    ).toBe(false)

    // Factory rejects '.', but matchers must treat root subtree as self-only.
    const rootEffect = {
      type: 'tree-subtree' as const,
      projectPath: PROJECT,
      path: '.',
    }
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, '.', false)),
        rootEffect,
        DAEMON,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src', false)),
        rootEffect,
        DAEMON,
      ),
    ).toBe(false)
  })

  it('content-subtree matches nested content and preview identities', () => {
    const effect = filesContentSubtreeEffect(PROJECT, 'src')
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, fileContentQuery(PROJECT, 'src/a.ts')),
        effect,
        DAEMON,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filePreviewQuery(PROJECT, 'src/index.html')),
        effect,
        DAEMON,
      ),
    ).toBe(true)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, fileContentQuery(PROJECT, 'src2/a.ts')),
        effect,
        DAEMON,
      ),
    ).toBe(false)
    expect(
      filesQueryMatchesEffect(
        filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src', false)),
        effect,
        DAEMON,
      ),
    ).toBe(false)
  })
})

describe('invalidateFilesEffects', () => {
  it('uses exact:true for exact effects and predicates for family/subtree', async () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const exact = filesExactEffect(filesPinsQuery(PROJECT))
    const family = filesTreeFamilyEffect(PROJECT)
    await invalidateFilesEffects(queryClient, DAEMON, [exact, family, family])
    expect(spy).toHaveBeenCalledWith({
      queryKey: filesQueryKey(DAEMON, filesPinsQuery(PROJECT)),
      exact: true,
    })
    expect(spy).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    })
    // family deduped — one predicate call, not two
    expect(spy.mock.calls.filter((c) => 'predicate' in (c[0] as object))).toHaveLength(1)
  })
})
