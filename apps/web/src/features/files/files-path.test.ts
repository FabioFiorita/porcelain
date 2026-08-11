import { describe, expect, it } from 'vitest'
import {
  normalizeProjectRoot,
  projectAbsoluteFromRelative,
  projectRelativeFromAbsolute,
  treePathFromAbsolute,
} from './files-path'

const REPO = '/synthetic/repo'
const FILE_ABS = '/synthetic/repo/docs/notes.txt'

describe('normalizeProjectRoot', () => {
  it('normalizes trailing slashes including root variants', () => {
    expect(normalizeProjectRoot('/repo/')).toBe('/repo')
    expect(normalizeProjectRoot('/')).toBe('/')
    expect(normalizeProjectRoot('//')).toBe('/')
    expect(normalizeProjectRoot('///')).toBe('/')
  })
})

describe('projectRelativeFromAbsolute', () => {
  it('converts absolute paths under the project to relative wire paths', () => {
    expect(projectRelativeFromAbsolute(REPO, FILE_ABS)).toBe('docs/notes.txt')
    expect(projectRelativeFromAbsolute('/repo/', '/repo/a.ts')).toBe('a.ts')
  })

  it('returns null for root equality, outside paths, and parent segments', () => {
    expect(projectRelativeFromAbsolute(REPO, REPO)).toBeNull()
    expect(projectRelativeFromAbsolute(REPO, '/other/a.ts')).toBeNull()
    expect(projectRelativeFromAbsolute(REPO, '/synthetic/repo/foo/../bar')).toBeNull()
  })
})

describe('projectAbsoluteFromRelative', () => {
  it('builds UI absolute paths without double slash when root is /', () => {
    expect(projectAbsoluteFromRelative('/', 'etc/passwd')).toBe('/etc/passwd')
    expect(projectAbsoluteFromRelative(REPO, 'docs/guide copy.md')).toBe(
      '/synthetic/repo/docs/guide copy.md',
    )
  })
})

describe('treePathFromAbsolute', () => {
  it('maps project root to . and nested dirs to relative', () => {
    expect(treePathFromAbsolute(REPO, REPO)).toBe('.')
    expect(treePathFromAbsolute(REPO, `${REPO}/src`)).toBe('src')
    expect(treePathFromAbsolute(REPO, `${REPO}/src/components`)).toBe('src/components')
  })

  it('returns null outside the project', () => {
    expect(treePathFromAbsolute(REPO, '/other/src')).toBeNull()
  })

  it('round-trips absolute dirs under the project', () => {
    const abs = `${REPO}/packages/web`
    const tree = treePathFromAbsolute(REPO, abs)
    expect(tree).toBe('packages/web')
    if (tree === null) throw new Error('expected tree path')
    expect(projectAbsoluteFromRelative(REPO, tree)).toBe(abs)
  })
})
