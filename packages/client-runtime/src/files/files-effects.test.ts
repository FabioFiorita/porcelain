import { describe, expect, it } from 'vitest'
import {
  contentPreviewEffects,
  dedupeFilesForeignDependencies,
  dedupeFilesQueryEffects,
  FILES_FOREIGN_CONTENT_INDEX,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_WORKING_TREE,
  filesExactEffect,
  filesTreeFamilyEffect,
  treeEffectsForStructuralPath,
  treeSelfEffects,
} from './files-effects'
import { fileContentQuery, filePreviewQuery, filesPinsQuery, filesTreeQuery } from './files-queries'

const REPO = '/synthetic/repo'
const OTHER = '/synthetic/other-repo'

describe('filesExactEffect and filesTreeFamilyEffect', () => {
  it('builds exact and tree-family effects with normalized projectPath', () => {
    const query = filesTreeQuery(REPO, 'src', false)
    expect(filesExactEffect(query)).toEqual({ type: 'exact', query })
    expect(filesTreeFamilyEffect(`${REPO}/`)).toEqual({
      type: 'tree-family',
      projectPath: REPO,
    })
    expect(filesTreeFamilyEffect(REPO)).not.toEqual(filesTreeFamilyEffect(OTHER))
  })
})

describe('dedupeFilesQueryEffects', () => {
  it('dedupes by first-seen structural equality without collapsing family over exact trees', () => {
    const tree = filesTreeQuery(REPO, 'src', false)
    const pins = filesPinsQuery(REPO)
    const family = filesTreeFamilyEffect(REPO)
    const effects = dedupeFilesQueryEffects([
      filesExactEffect(tree),
      filesExactEffect(pins),
      filesExactEffect(tree),
      family,
      filesTreeFamilyEffect(`${REPO}/`),
      filesExactEffect(tree),
    ])
    expect(effects).toEqual([filesExactEffect(tree), filesExactEffect(pins), family])
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

  it('treeSelfEffects emits only self path × both showHidden', () => {
    expect(treeSelfEffects(REPO, 'docs/guide copy.md')).toEqual([
      filesExactEffect(filesTreeQuery(REPO, 'docs/guide copy.md', false)),
      filesExactEffect(filesTreeQuery(REPO, 'docs/guide copy.md', true)),
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
