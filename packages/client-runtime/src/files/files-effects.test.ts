import { describe, expect, it } from 'vitest'
import {
  contentPreviewEffects,
  dedupeFilesForeignDependencies,
  dedupeFilesQueryEffects,
  FILES_FOREIGN_CONTENT_INDEX,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_WORKING_TREE,
  filesContentSubtreeEffect,
  filesExactEffect,
  filesTreeFamilyEffect,
  filesTreeSubtreeEffect,
  treeEffectsForStructuralPath,
  treeSubtreeEffectsForStructuralPath,
} from './files-effects'
import { fileContentQuery, filePreviewQuery, filesPinsQuery, filesTreeQuery } from './files-queries'

const REPO = '/synthetic/repo'
const OTHER = '/synthetic/other-repo'

describe('Files query effect builders', () => {
  it('builds normalized exact, family, and subtree effects', () => {
    const query = filesTreeQuery(REPO, 'src', false)
    expect(filesExactEffect(query)).toEqual({ type: 'exact', query })
    expect(filesTreeFamilyEffect(`${REPO}/`)).toEqual({
      type: 'tree-family',
      projectPath: REPO,
    })
    expect(filesTreeFamilyEffect(REPO)).not.toEqual(filesTreeFamilyEffect(OTHER))
    expect(filesTreeSubtreeEffect(`${REPO}/`, 'a/b')).toEqual({
      type: 'tree-subtree',
      projectPath: REPO,
      path: 'a/b',
    })
    expect(filesContentSubtreeEffect(REPO, 'a/b')).toEqual({
      type: 'content-subtree',
      projectPath: REPO,
      path: 'a/b',
    })
    expect(() => filesTreeSubtreeEffect(REPO, '.')).toThrow('files: invalid tree-subtree path')
    expect(() => filesContentSubtreeEffect(REPO, 'a/../b')).toThrow(
      'files: invalid content-subtree path',
    )
  })
})

describe('dedupeFilesQueryEffects', () => {
  it('dedupes by first-seen structural equality without collapsing family over exact trees', () => {
    const tree = filesTreeQuery(REPO, 'src', false)
    const pins = filesPinsQuery(REPO)
    const family = filesTreeFamilyEffect(REPO)
    const treeSubtree = filesTreeSubtreeEffect(REPO, 'src')
    const contentSubtree = filesContentSubtreeEffect(REPO, 'src')
    const effects = dedupeFilesQueryEffects([
      filesExactEffect(tree),
      filesExactEffect(pins),
      filesExactEffect(tree),
      family,
      filesTreeFamilyEffect(`${REPO}/`),
      treeSubtree,
      filesTreeSubtreeEffect(`${REPO}/`, 'src'),
      contentSubtree,
      filesContentSubtreeEffect(REPO, 'src'),
      filesExactEffect(tree),
    ])
    expect(effects).toEqual([
      filesExactEffect(tree),
      filesExactEffect(pins),
      family,
      treeSubtree,
      contentSubtree,
    ])
    // family present does not remove exact tree identities
    expect(effects.some((e) => e.type === 'exact' && e.query.name === 'tree')).toBe(true)
  })
})

describe('expansion helpers', () => {
  it('treeEffectsForStructuralPath emits both showHidden for self then parent', () => {
    expect(treeEffectsForStructuralPath(REPO, 'a/b')).toEqual([
      filesExactEffect(filesTreeQuery(REPO, 'a/b', false)),
      filesExactEffect(filesTreeQuery(REPO, 'a/b', true)),
      filesExactEffect(filesTreeQuery(REPO, 'a', false)),
      filesExactEffect(filesTreeQuery(REPO, 'a', true)),
    ])
    expect(treeEffectsForStructuralPath(REPO, 'foo')).toEqual([
      filesExactEffect(filesTreeQuery(REPO, 'foo', false)),
      filesExactEffect(filesTreeQuery(REPO, 'foo', true)),
      filesExactEffect(filesTreeQuery(REPO, '.', false)),
      filesExactEffect(filesTreeQuery(REPO, '.', true)),
    ])
    expect(treeEffectsForStructuralPath(REPO, '.')).toEqual([
      filesExactEffect(filesTreeQuery(REPO, '.', false)),
      filesExactEffect(filesTreeQuery(REPO, '.', true)),
    ])
  })

  it('treeSubtreeEffectsForStructuralPath emits subtree plus exact parent trees', () => {
    expect(treeSubtreeEffectsForStructuralPath(REPO, 'docs/guide')).toEqual([
      filesTreeSubtreeEffect(REPO, 'docs/guide'),
      filesExactEffect(filesTreeQuery(REPO, 'docs', false)),
      filesExactEffect(filesTreeQuery(REPO, 'docs', true)),
    ])
    expect(treeSubtreeEffectsForStructuralPath(REPO, 'docs')).toEqual([
      filesTreeSubtreeEffect(REPO, 'docs'),
      filesExactEffect(filesTreeQuery(REPO, '.', false)),
      filesExactEffect(filesTreeQuery(REPO, '.', true)),
    ])
  })

  it('contentPreviewEffects orders content then preview', () => {
    expect(contentPreviewEffects(REPO, 'README.md')).toEqual([
      filesExactEffect(fileContentQuery(REPO, 'README.md')),
      filesExactEffect(filePreviewQuery(REPO, 'README.md')),
    ])
  })
})

describe('foreign token constants and dedupe', () => {
  it('exports stable foreign constants with structural equality', () => {
    expect(FILES_FOREIGN_WORKING_TREE).toEqual({ domain: 'git', name: 'working-tree' })
    expect(FILES_FOREIGN_PATH_INDEX).toEqual({ domain: 'search', name: 'path-index' })
    expect(FILES_FOREIGN_CONTENT_INDEX).toEqual({ domain: 'search', name: 'content-index' })
  })

  it('dedupeFilesForeignDependencies preserves first-seen three-token order', () => {
    expect(
      dedupeFilesForeignDependencies([
        FILES_FOREIGN_WORKING_TREE,
        FILES_FOREIGN_PATH_INDEX,
        FILES_FOREIGN_CONTENT_INDEX,
        FILES_FOREIGN_WORKING_TREE,
        { domain: 'search', name: 'path-index' },
      ]),
    ).toEqual([FILES_FOREIGN_WORKING_TREE, FILES_FOREIGN_PATH_INDEX, FILES_FOREIGN_CONTENT_INDEX])
  })
})
