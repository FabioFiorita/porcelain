import { describe, expect, it } from 'vitest'
import {
  FilesIdentityError,
  fileContentQuery,
  fileContentQuerySchema,
  filePreviewQuery,
  filesPinsQuery,
  filesProjectKey,
  filesQuerySchema,
  filesScopeQuery,
  filesTreePathsAffectedBy,
  filesTreeQuery,
  filesTreeQuerySchema,
  isFileContentQuery,
  isFilePreviewQuery,
  isFilesTreeQuery,
  parentFilesPath,
} from './files-queries'

const REPO = '/synthetic/repo'
const OTHER = '/synthetic/other-repo'

describe('filesProjectKey', () => {
  it('throws non-empty message for empty string', () => {
    expect(() => filesProjectKey('')).toThrow(FilesIdentityError)
    expect(() => filesProjectKey('')).toThrow('files: project path must be non-empty')
  })

  it('throws absolute message for relative, NUL, backslash, and overlength paths', () => {
    const cases = [
      'repo',
      './repo',
      '/a\0b',
      '/repo\\win',
      `/${'x'.repeat(4096)}`, // length > 4096 once slash added
    ]
    for (const value of cases) {
      expect(() => filesProjectKey(value), value).toThrow(FilesIdentityError)
      expect(() => filesProjectKey(value), value).toThrow('files: project path must be absolute')
    }
  })

  it('returns root and strips trailing slashes without inventing dot-segment collapse', () => {
    expect(filesProjectKey('/')).toBe('/')
    expect(filesProjectKey('//')).toBe('/')
    expect(filesProjectKey('///')).toBe('/')
    expect(filesProjectKey('/repo/')).toBe('/repo')
    expect(filesProjectKey('/repo//')).toBe('/repo')
    expect(filesProjectKey('/repo')).toBe('/repo')
    // No dot-segment collapse beyond trailing-slash strip
    expect(filesProjectKey('/repo/./nested/')).toBe('/repo/./nested')
  })
})

describe('query identity builders', () => {
  it('produces equal identities for equal normalized inputs', () => {
    expect(filesTreeQuery(REPO, 'src', false)).toEqual(filesTreeQuery(`${REPO}/`, 'src', false))
    expect(filesTreeQuery(REPO, '.', true)).toEqual({
      domain: 'files',
      name: 'tree',
      projectPath: REPO,
      path: '.',
      showHidden: true,
    })
    expect(filesPinsQuery(REPO)).toEqual(filesPinsQuery(`${REPO}/`))
    expect(filesScopeQuery(REPO)).toEqual({
      domain: 'files',
      name: 'scope',
      projectPath: REPO,
    })
    expect(fileContentQuery(REPO, 'README.md')).toEqual({
      domain: 'files',
      name: 'content',
      projectPath: REPO,
      path: 'README.md',
    })
    expect(filePreviewQuery(REPO, 'docs/index.html')).toEqual({
      domain: 'files',
      name: 'preview',
      projectPath: REPO,
      path: 'docs/index.html',
    })
  })

  it('isolates projectPath, path, and showHidden dimensions', () => {
    expect(filesTreeQuery(REPO, 'src', false)).not.toEqual(filesTreeQuery(OTHER, 'src', false))
    expect(filesTreeQuery(REPO, 'src', false)).not.toEqual(filesTreeQuery(REPO, 'lib', false))
    expect(filesTreeQuery(REPO, 'src', false)).not.toEqual(filesTreeQuery(REPO, 'src', true))
    expect(fileContentQuery(REPO, 'a.ts')).not.toEqual(fileContentQuery(REPO, 'b.ts'))
    expect(filePreviewQuery(REPO, 'a.html')).not.toEqual(filePreviewQuery(OTHER, 'a.html'))
    expect(filesPinsQuery(REPO)).not.toEqual(filesPinsQuery(OTHER))
    expect(filesScopeQuery(REPO)).not.toEqual(filesScopeQuery(OTHER))
  })

  it('uses path "." for root listing, never empty string', () => {
    const root = filesTreeQuery(REPO, '.', false)
    expect(root.path).toBe('.')
    expect(root.path).not.toBe('')
  })

  it('rejects invalid tree paths and content/preview root marker', () => {
    expect(() => filesTreeQuery(REPO, '')).toThrow('files: invalid tree path')
    expect(() => filesTreeQuery(REPO, '/abs')).toThrow('files: invalid tree path')
    expect(() => filesTreeQuery(REPO, 'a/../b')).toThrow('files: invalid tree path')
    expect(() => fileContentQuery(REPO, '.')).toThrow('files: invalid content path')
    expect(() => filePreviewQuery(REPO, '.')).toThrow('files: invalid content path')
    expect(() => fileContentQuery(REPO, '')).toThrow('files: invalid content path')
    expect(() => filePreviewQuery(REPO, '/abs')).toThrow('files: invalid content path')
  })

  it('type guards discriminate tree, content, and preview', () => {
    const tree = filesTreeQuery(REPO, 'src', false)
    const content = fileContentQuery(REPO, 'a.ts')
    const preview = filePreviewQuery(REPO, 'a.html')
    const pins = filesPinsQuery(REPO)

    expect(isFilesTreeQuery(tree)).toBe(true)
    expect(isFilesTreeQuery(content)).toBe(false)
    expect(isFileContentQuery(content)).toBe(true)
    expect(isFileContentQuery(preview)).toBe(false)
    expect(isFilePreviewQuery(preview)).toBe(true)
    expect(isFilePreviewQuery(pins)).toBe(false)
  })
})

describe('parentFilesPath and filesTreePathsAffectedBy', () => {
  it('returns null parent for root marker and "." for bare segment', () => {
    expect(parentFilesPath('.')).toBeNull()
    expect(parentFilesPath('foo')).toBe('.')
    expect(parentFilesPath('a/b')).toBe('a')
    expect(parentFilesPath('a/b/c')).toBe('a/b')
  })

  it('lists self then parent for structural path keys', () => {
    expect(filesTreePathsAffectedBy('.')).toEqual(['.'])
    expect(filesTreePathsAffectedBy('foo')).toEqual(['foo', '.'])
    expect(filesTreePathsAffectedBy('a/b')).toEqual(['a/b', 'a'])
  })
})

describe('files identity schemas', () => {
  it('accepts every identity its own constructor produces', () => {
    const identities = [
      filesTreeQuery(REPO, '.', false),
      filesTreeQuery(REPO, 'src/nested', true),
      filesTreeQuery('/', '.', false),
      filesPinsQuery(REPO),
      filesScopeQuery(REPO),
      fileContentQuery(REPO, 'README.md'),
      filePreviewQuery(REPO, 'docs/index.html'),
    ]
    for (const identity of identities) {
      expect(filesQuerySchema.safeParse(identity).success, JSON.stringify(identity)).toBe(true)
    }
  })

  it('rejects missing, numeric, and extra fields', () => {
    expect(filesQuerySchema.safeParse({ domain: 'files', name: 'pins' }).success).toBe(false)
    expect(
      filesQuerySchema.safeParse({ domain: 'files', name: 'pins', projectPath: 42 }).success,
    ).toBe(false)
    expect(
      filesTreeQuerySchema.safeParse({
        domain: 'files',
        name: 'tree',
        projectPath: REPO,
        path: 'src',
      }).success,
    ).toBe(false)
    expect(
      filesTreeQuerySchema.safeParse({
        domain: 'files',
        name: 'tree',
        projectPath: REPO,
        path: 'src',
        showHidden: 'yes',
      }).success,
    ).toBe(false)
    expect(
      filesQuerySchema.safeParse({
        domain: 'files',
        name: 'pins',
        projectPath: REPO,
        extra: true,
      }).success,
    ).toBe(false)
  })

  it('rejects a wrong domain or an unknown name', () => {
    expect(
      filesQuerySchema.safeParse({ domain: 'board', name: 'pins', projectPath: REPO }).success,
    ).toBe(false)
    expect(
      filesQuerySchema.safeParse({ domain: 'files', name: 'evidence', projectPath: REPO }).success,
    ).toBe(false)
  })

  it('holds the same path vocabulary as the constructors', () => {
    // `'.'` is a tree path only; content and preview address a real file.
    expect(
      filesTreeQuerySchema.safeParse({
        domain: 'files',
        name: 'tree',
        projectPath: REPO,
        path: '.',
        showHidden: false,
      }).success,
    ).toBe(true)
    expect(
      fileContentQuerySchema.safeParse({
        domain: 'files',
        name: 'content',
        projectPath: REPO,
        path: '.',
      }).success,
    ).toBe(false)
    for (const path of ['', '/abs', 'a/../b', 'win\\path']) {
      expect(
        fileContentQuerySchema.safeParse({
          domain: 'files',
          name: 'content',
          projectPath: REPO,
          path,
        }).success,
        path,
      ).toBe(false)
    }
    for (const projectPath of ['', 'repo', '/repo\\win', '/a\0b']) {
      expect(
        filesQuerySchema.safeParse({
          domain: 'files',
          name: 'pins',
          projectPath,
        }).success,
        projectPath,
      ).toBe(false)
    }
  })
})
